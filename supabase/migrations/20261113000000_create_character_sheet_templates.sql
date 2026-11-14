create table public.character_sheet_templates (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  definition jsonb not null default '{}'::jsonb,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Case-folded uniqueness scoped per owner: "Fate Core" and "fate core"
-- collide for the same owner, but two different owners can each use
-- "Fate Core" -- a copied template never collides with the copier's own
-- names just because it shares a name with the original owner's.
create unique index character_sheet_templates_owner_name_lower_key
  on public.character_sheet_templates (owner_id, lower(name));

alter table public.character_sheet_templates enable row level security;

create policy "Owners can view own templates"
  on public.character_sheet_templates for select
  to authenticated
  using (auth.uid() = owner_id);

-- is_default = false in the with-check: a user can never create their
-- own "official" template this way -- default templates are seeded by
-- service_role (#76), not by the authenticated insert path.
create policy "Owners can insert own templates"
  on public.character_sheet_templates for insert
  to authenticated
  with check (auth.uid() = owner_id and is_default = false);

-- Same is_default = false in the with-check: blocks a user from
-- promoting their own existing template to is_default = true via update.
create policy "Owners can update own templates"
  on public.character_sheet_templates for update
  to authenticated
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id and is_default = false);

create policy "Owners can delete own templates"
  on public.character_sheet_templates for delete
  to authenticated
  using (auth.uid() = owner_id);

-- New tables are NOT auto-exposed to Data API roles without explicit
-- grants (see profiles migration) -- grant explicitly rather than relying
-- on legacy auto-expose behavior. service_role bypasses RLS but still
-- needs its own table-level grant under this model.
grant select, insert, update, delete on public.character_sheet_templates to authenticated;
grant select, insert, update, delete on public.character_sheet_templates to service_role;

-- RLS is row-scoped, not column-scoped: the update policy's with-check
-- (auth.uid() = owner_id) already stops owner_id being reassigned to
-- someone else's id, but id and created_at aren't referenced by any
-- policy, so without this a user could rewrite either through the Data
-- API. service_role is exempt (the trusted admin/seed path, not the
-- untrusted client input this guard exists for).
create function public.preserve_character_sheet_template_identity()
returns trigger
language plpgsql
as $$
begin
  if current_user = 'service_role' then
    return new;
  end if;
  new.id = old.id;
  new.owner_id = old.owner_id;
  new.created_at = old.created_at;
  return new;
end;
$$;

create trigger on_character_sheet_template_update_preserve_identity
  before update on public.character_sheet_templates
  for each row execute function public.preserve_character_sheet_template_identity();

-- Bound to both INSERT and UPDATE: without this, the insert policy's
-- with-check only constrains owner_id/is_default, leaving created_at and
-- updated_at as plain client-suppliable columns on INSERT (the column
-- defaults only apply when a statement omits them, not when a client
-- explicitly sets them to an arbitrary value).
--
-- service_role is exempt, same as preserve_character_sheet_template_identity()
-- above: the trusted admin/seed path (#76's default-template seeding) may
-- need to set a specific created_at rather than always getting now().
create function public.touch_character_sheet_template_updated_at()
returns trigger
language plpgsql
as $$
begin
  if current_user = 'service_role' then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.created_at = now();
  end if;
  new.updated_at = now();
  return new;
end;
$$;

create trigger on_character_sheet_template_set_timestamps
  before insert or update on public.character_sheet_templates
  for each row execute function public.touch_character_sheet_template_updated_at();

-- Defense in depth on top of the RLS with-checks above: this is checked
-- against OLD.is_default regardless of which role or policy let the
-- statement reach this row, so it stays correct even if a later migration
-- (e.g. #74 sharing, #76 default templates) adds a broader policy that
-- forgets to exclude is_default = true rows itself.
--
-- postgres (this table's owner) is exempt alongside service_role:
-- owner_id's FK is `on delete cascade` from auth.users, and Postgres
-- always runs a table's ON DELETE CASCADE action under the *table
-- owner's* role, regardless of which role issued the original DELETE
-- against auth.users (verified empirically -- current_user inside this
-- trigger is `postgres` mid-cascade even when the top-level DELETE is
-- run as supabase_auth_admin or service_role). Without this, deleting a
-- user who owns an is_default row would fail the whole user deletion.
-- `postgres` is never reachable as current_user through the Data API
-- (PostgREST's `authenticator` role only ever SET ROLEs to anon,
-- authenticated, or service_role), so exempting it here doesn't open a
-- client-facing bypass.
create function public.protect_default_character_sheet_templates()
returns trigger
language plpgsql
as $$
begin
  if old.is_default and current_user not in ('service_role', 'postgres') then
    raise exception 'default character sheet templates cannot be modified or deleted';
  end if;
  return coalesce(new, old);
end;
$$;

-- Fires alongside the two BEFORE UPDATE triggers above; Postgres runs
-- same-timing triggers in alphabetical-by-name order ("on_..." before
-- "protect_..."), which is why this one runs last. That ordering isn't
-- load-bearing here -- this checks OLD.is_default, which is fixed for
-- the whole statement regardless of what earlier triggers do to NEW --
-- but keep that in mind before naming a future BEFORE UPDATE trigger on
-- this table something that would sort in between.
create trigger protect_default_character_sheet_templates_trigger
  before update or delete on public.character_sheet_templates
  for each row execute function public.protect_default_character_sheet_templates();
