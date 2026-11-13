-- Shared pgTAP fixtures for every test file in this directory.
--
-- Deliberately NOT wrapped in BEGIN/ROLLBACK: the schema, functions, and
-- grants created here must commit so later files (run in filename order by
-- `supabase test db`) can use them. It still emits valid TAP itself so
-- pg_prove doesn't flag it as a planless file.

create extension if not exists pgtap with schema extensions;

create schema if not exists tests;

-- Seeds a minimal-but-realistic auth.users row and returns its id. Fires
-- on_auth_user_created, so the seeded user already has a public.profiles
-- row via handle_new_user() -- don't insert one yourself on top of this.
-- `metadata` lands in raw_user_meta_data (e.g. {"display_name": "..."}).
create or replace function tests.create_supabase_user(email text, metadata jsonb default '{}'::jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id uuid := gen_random_uuid();
begin
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at, confirmation_token, recovery_token,
    email_change_token_new, email_change
  ) values (
    '00000000-0000-0000-0000-000000000000', new_id, 'authenticated', 'authenticated',
    email, extensions.crypt('test-password', extensions.gen_salt('bf')),
    now(), '{"provider":"email","providers":["email"]}'::jsonb, metadata,
    now(), now(), '', '', '', ''
  );
  return new_id;
end;
$$;

-- security definer + pinned search_path: authenticated/anon have no SELECT
-- on auth.users, so a plain `language sql` lookup would fail the moment a
-- test calls this after switching roles.
create or replace function tests.get_supabase_uid(email text)
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select id from auth.users where auth.users.email = $1;
$$;

-- Switches the current transaction to `authenticated`, with a JWT claims
-- set that makes auth.uid() resolve to the given user. Scoped to the
-- transaction (SET LOCAL) -- the wrapping file's ROLLBACK undoes it.
create or replace function tests.authenticate_as(email text)
returns void
language plpgsql
as $$
declare
  uid uuid;
begin
  uid := tests.get_supabase_uid(email);
  if uid is null then
    raise exception 'tests.authenticate_as: no such user %', email;
  end if;
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
end;
$$;

-- Switches the current transaction to `anon`, with no JWT claims.
create or replace function tests.authenticate_as_anon()
returns void
language plpgsql
as $$
begin
  execute 'set local role anon';
  perform set_config('request.jwt.claims', '', true);
end;
$$;

-- Switches the current transaction to `service_role` (the trusted
-- admin/backfill path that bypasses RLS and the identity-preservation
-- trigger). No JWT claims needed -- service_role isn't gated by auth.uid().
create or replace function tests.authenticate_as_service_role()
returns void
language plpgsql
as $$
begin
  execute 'set local role service_role';
end;
$$;

-- `authenticated`/`anon`/`service_role` all need to keep calling these
-- helpers after SET LOCAL ROLE switches them away from the connecting
-- (superuser) role -- without schema USAGE + function EXECUTE, a test can
-- authenticate as one user and then lose the ability to call
-- tests.authenticate_as() again to switch to the next one.
grant usage on schema tests to anon, authenticated, service_role;
grant execute on all functions in schema tests to anon, authenticated, service_role;
alter default privileges in schema tests grant execute on functions to anon, authenticated, service_role;

select plan(2);

select has_schema('tests', 'tests schema exists for shared fixtures');
select has_function('tests', 'authenticate_as', array['text'], 'role-impersonation helper exists');

select * from finish();
