-- RLS: visibility & mutation (profiles) + the INSERT policy's identity check.
--
-- anon's and the cross-user DELETE's cases are deliberately throws_ok, not
-- row-count assertions: anon has no SELECT grant at all, and no role but
-- service_role has a DELETE grant at all (see 03-profiles-grants.sql), so
-- both raise permission denied before RLS is even evaluated -- they don't
-- return/affect zero rows, they error outright.
--
-- The cross-user UPDATE check re-authenticates as the owner afterward to
-- confirm state: that mutation IS filtered to zero rows by RLS (rather
-- than denied by GRANT, since authenticated does have UPDATE), so reading
-- row state while still authenticated as the *attacker* would read as
-- "zero rows" regardless of whether the UPDATE did anything -- that's RLS
-- hiding the row from them, not evidence the UPDATE was a no-op.

begin;
select plan(8);

select tests.create_supabase_user('rls-owner@example.com', jsonb_build_object('display_name', 'Owner')) as owner_id \gset
select tests.create_supabase_user('rls-other@example.com', jsonb_build_object('display_name', 'Other')) as other_id \gset

-- Owner can select own row.
select tests.authenticate_as('rls-owner@example.com');
select is(
  (select count(*)::int from public.profiles where id = :'owner_id'::uuid),
  1,
  'owner can select own profile row'
);

-- Owner can update own row.
select lives_ok(
  format('update public.profiles set display_name = %L where id = %L', 'Owner Updated', :'owner_id'),
  'owner can update own profile row'
);
select is(
  (select display_name from public.profiles where id = :'owner_id'::uuid),
  'Owner Updated',
  'owner update actually took effect'
);

-- A second authenticated user sees zero rows for the owner's row.
select tests.authenticate_as('rls-other@example.com');
select is(
  (select count(*)::int from public.profiles where id = :'owner_id'::uuid),
  0,
  'second user cannot select owner profile row'
);

-- A second user's UPDATE of the owner's row is filtered to zero rows by
-- RLS -- confirm by switching back to the owner afterward.
update public.profiles set display_name = 'hacked' where id = :'owner_id'::uuid;
select tests.authenticate_as('rls-owner@example.com');
select is(
  (select display_name from public.profiles where id = :'owner_id'::uuid),
  'Owner Updated',
  'second user update of owner row affects zero rows (owner row untouched)'
);

-- No role but service_role has a DELETE grant on profiles at all, so any
-- authenticated DELETE attempt -- not just a cross-user one -- is denied
-- at the grant level before RLS gets a say.
select tests.authenticate_as('rls-other@example.com');
select throws_ok(
  format('delete from public.profiles where id = %L', :'owner_id'),
  'permission denied for table profiles',
  'authenticated has no DELETE grant, so deleting (even someone else''s row) is denied outright'
);

-- anon (no JWT, no grant) cannot select at all.
select tests.authenticate_as_anon();
select throws_ok(
  'select * from public.profiles',
  'permission denied for table profiles',
  'anon has no SELECT grant on profiles, so a select raises permission denied'
);

-- An authenticated user cannot insert a row with id != auth.uid().
select tests.authenticate_as('rls-other@example.com');
select throws_ok(
  format('insert into public.profiles (id, display_name) values (%L, %L)', gen_random_uuid(), 'not-me'),
  'new row violates row-level security policy for table "profiles"',
  'authenticated cannot insert a profile row for a different id (RLS insert policy)'
);

select * from finish();
rollback;
