create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Users can view own profile"
  on public.profiles for select
  to authenticated
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "Users can insert own profile"
  on public.profiles for insert
  to authenticated
  with check (auth.uid() = id);

-- New tables are NOT auto-exposed to Data API roles without explicit grants
-- (the new cloud default, see config.toml's [api] section) — grant
-- explicitly rather than relying on legacy auto-expose behavior. service_role
-- bypasses RLS but still needs its own table-level grant under this model.
grant select, insert, update on public.profiles to authenticated;
grant select, insert, update, delete on public.profiles to service_role;

-- RLS is row-scoped, not column-scoped: without this, "update own profile"
-- would let a user silently rewrite their own created_at (or reassign the
-- row to another id) through the Data API. Force both back to their
-- existing values on every update instead of trusting client input.
-- service_role is exempt (it's the trusted admin/backfill path, not the
-- untrusted client input this guard exists for).
create function public.preserve_profile_identity()
returns trigger
language plpgsql
as $$
begin
  if current_user = 'service_role' then
    return new;
  end if;
  new.id = old.id;
  new.created_at = old.created_at;
  return new;
end;
$$;

create trigger on_profile_update_preserve_identity
  before update on public.profiles
  for each row execute function public.preserve_profile_identity();

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, new.raw_user_meta_data ->> 'display_name');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
