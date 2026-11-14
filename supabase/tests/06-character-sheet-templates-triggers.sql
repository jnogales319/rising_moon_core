-- Trigger behavior (character_sheet_templates):
-- touch_character_sheet_template_updated_at(),
-- preserve_character_sheet_template_identity(), and
-- protect_default_character_sheet_templates().

begin;
select plan(12);

-- touch_character_sheet_template_updated_at(): a client-supplied
-- updated_at value is overwritten by the trigger's own now(), not left
-- as given. (now() is frozen for the whole transaction, so this can't be
-- asserted as "later than before" -- asserting it's not the obviously
-- wrong client-supplied value is the meaningful check here.)
select tests.create_supabase_user('cst-touch@example.com') as touch_id \gset
select tests.authenticate_as('cst-touch@example.com');
insert into public.character_sheet_templates (owner_id, name) values (:'touch_id', 'Touch Me');
update public.character_sheet_templates set updated_at = timestamptz '2000-01-01' where owner_id = :'touch_id'::uuid;
select isnt(
  (select updated_at from public.character_sheet_templates where owner_id = :'touch_id'::uuid),
  timestamptz '2000-01-01',
  'updated_at touch trigger overwrites a client-supplied updated_at value'
);

-- Same trigger, also bound to INSERT: a client-supplied created_at or
-- updated_at on INSERT is overwritten too, not just on UPDATE -- the
-- insert RLS with-check only constrains owner_id/is_default, so without
-- this the column defaults alone wouldn't stop an explicit client value.
select tests.create_supabase_user('cst-insert-touch@example.com') as insert_touch_id \gset
select tests.authenticate_as('cst-insert-touch@example.com');
insert into public.character_sheet_templates (owner_id, name, created_at, updated_at)
  values (:'insert_touch_id', 'Insert Touch Me', timestamptz '2000-01-01', timestamptz '2000-01-01');
select ok(
  (select created_at > now() - interval '1 minute' and updated_at > now() - interval '1 minute'
     from public.character_sheet_templates where owner_id = :'insert_touch_id'::uuid),
  'INSERT trigger overwrites client-supplied created_at and updated_at'
);

-- service_role is exempt from this trigger too, on both INSERT and
-- UPDATE -- mirroring preserve_character_sheet_template_identity()'s
-- service_role exemption, since #76's default-template seeding may need
-- to set a specific created_at rather than always getting now().
select tests.create_supabase_user('cst-touch-service@example.com') as touch_service_id \gset
select tests.authenticate_as_service_role();
insert into public.character_sheet_templates (owner_id, name, created_at, updated_at)
  values (:'touch_service_id', 'Service Touch', timestamptz '2000-01-01', timestamptz '2000-01-01');
select is(
  (select created_at from public.character_sheet_templates where owner_id = :'touch_service_id'::uuid),
  timestamptz '2000-01-01',
  'service_role is exempt from touch_character_sheet_template_updated_at() on INSERT'
);
update public.character_sheet_templates set updated_at = timestamptz '1999-01-01' where owner_id = :'touch_service_id'::uuid;
select is(
  (select updated_at from public.character_sheet_templates where owner_id = :'touch_service_id'::uuid),
  timestamptz '1999-01-01',
  'service_role is exempt from touch_character_sheet_template_updated_at() on UPDATE'
);

-- preserve_character_sheet_template_identity(): an authenticated UPDATE
-- cannot change id, owner_id, or created_at -- all three are forced back
-- to OLD.
select tests.create_supabase_user('cst-identity@example.com') as identity_id \gset
select tests.authenticate_as('cst-identity@example.com');
insert into public.character_sheet_templates (owner_id, name) values (:'identity_id', 'Identity Template');
update public.character_sheet_templates set id = gen_random_uuid(), owner_id = gen_random_uuid(), created_at = now() - interval '10 years'
  where owner_id = :'identity_id'::uuid;
select is(
  (select count(*)::int from public.character_sheet_templates where owner_id = :'identity_id'::uuid),
  1,
  'authenticated UPDATE cannot change id or owner_id (forced back to OLD)'
);
select is(
  (select created_at > now() - interval '1 minute' from public.character_sheet_templates where owner_id = :'identity_id'::uuid),
  true,
  'authenticated UPDATE cannot change created_at (forced back to OLD)'
);

-- service_role is exempt from that guard.
select tests.authenticate_as_service_role();
update public.character_sheet_templates set created_at = timestamptz '2000-01-01' where owner_id = :'identity_id'::uuid;
select is(
  (select created_at from public.character_sheet_templates where owner_id = :'identity_id'::uuid),
  timestamptz '2000-01-01',
  'service_role is exempt from preserve_character_sheet_template_identity()'
);

-- protect_default_character_sheet_templates(): a row with is_default =
-- true (only service_role can create one, per the RLS insert with-check
-- in 05-character-sheet-templates-rls.sql) can never be updated or
-- deleted by its own owner -- the ownership that would normally let them
-- edit/delete their own row doesn't override is_default.
select tests.create_supabase_user('cst-default-owner@example.com') as default_owner_id \gset
select tests.authenticate_as_service_role();
insert into public.character_sheet_templates (owner_id, name, is_default)
  values (:'default_owner_id', 'Default Fate Core', true)
  returning id as default_template_id \gset

select tests.authenticate_as('cst-default-owner@example.com');
select throws_ok(
  format('update public.character_sheet_templates set name = %L where id = %L', 'Hacked Default', :'default_template_id'),
  'default character sheet templates cannot be modified or deleted',
  'owner cannot update a row with is_default = true'
);
select throws_ok(
  format('delete from public.character_sheet_templates where id = %L', :'default_template_id'),
  'default character sheet templates cannot be modified or deleted',
  'owner cannot delete a row with is_default = true'
);

-- service_role is exempt from this guard too.
select tests.authenticate_as_service_role();
select lives_ok(
  format('update public.character_sheet_templates set name = %L where id = %L', 'Renamed Default', :'default_template_id'),
  'service_role can update a row with is_default = true'
);
select lives_ok(
  format('delete from public.character_sheet_templates where id = %L', :'default_template_id'),
  'service_role can delete a row with is_default = true'
);

-- A real cascading delete from auth.users (what GoTrue actually does to
-- delete a user) must not be blocked by an is_default row the deleted
-- user owns. `reset role` here only returns to this suite's connecting
-- role (`postgres`, per 00-helpers.sql) -- it does NOT reproduce a
-- DELETE issued by `supabase_auth_admin` (the role GoTrue actually
-- connects as): `postgres` isn't a member of `supabase_auth_admin` in
-- this project's role grants, so this pgTAP suite cannot impersonate it
-- without widening grants solely for a test. The migration's own
-- comment's broader claim -- that the cascade resolves to `postgres`
-- regardless of which role issues the top-level DELETE -- was verified
-- manually against a live GoTrue user-deletion call, not re-derived by
-- this assertion. What this assertion does cover: the cascade succeeds
-- and the is_default guard doesn't block it.
select tests.create_supabase_user('cst-cascade-owner@example.com') as cascade_owner_id \gset
select tests.authenticate_as_service_role();
insert into public.character_sheet_templates (owner_id, name, is_default)
  values (:'cascade_owner_id', 'Cascade Default', true);
reset role;
select lives_ok(
  format('delete from auth.users where id = %L', :'cascade_owner_id'),
  'deleting the owning user cascades through an is_default row without tripping the guard'
);

select * from finish();
rollback;
