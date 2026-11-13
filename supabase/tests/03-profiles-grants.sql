-- Data API grants on profiles (positive and negative). No role-switching
-- needed -- has_table_privilege checks the catalog directly from
-- whatever role is connected.
--
-- Deliberately checked one data-access privilege at a time via
-- has_table_privilege, rather than pgtap's table_privs_are (an exact-set
-- matcher): Supabase's platform defaults grant TRIGGER/REFERENCES/
-- TRUNCATE to every Data API role on every table regardless of this
-- migration, so an exact-set match would always report those three as
-- "extra" even on a correctly-configured table. SELECT/INSERT/UPDATE/
-- DELETE are the privileges this migration actually controls and the
-- ones that gate the Data API's read/write surface.
--
-- These are also the safety net if auto_expose_new_tables is ever flipped
-- back on in supabase/config.toml: that setting only affects *new* tables
-- going forward, but if someone re-enables it and later tables lean on it
-- instead of explicit grants, these assertions would still only cover
-- profiles -- they can't catch a future table skipping its own grants.

begin;
select plan(12);

select ok(has_table_privilege('authenticated', 'public.profiles', 'SELECT'), 'authenticated has SELECT on profiles');
select ok(has_table_privilege('authenticated', 'public.profiles', 'INSERT'), 'authenticated has INSERT on profiles');
select ok(has_table_privilege('authenticated', 'public.profiles', 'UPDATE'), 'authenticated has UPDATE on profiles');
select ok(not has_table_privilege('authenticated', 'public.profiles', 'DELETE'), 'authenticated does not have DELETE on profiles');

select ok(has_table_privilege('service_role', 'public.profiles', 'SELECT'), 'service_role has SELECT on profiles');
select ok(has_table_privilege('service_role', 'public.profiles', 'INSERT'), 'service_role has INSERT on profiles');
select ok(has_table_privilege('service_role', 'public.profiles', 'UPDATE'), 'service_role has UPDATE on profiles');
select ok(has_table_privilege('service_role', 'public.profiles', 'DELETE'), 'service_role has DELETE on profiles');

select ok(not has_table_privilege('anon', 'public.profiles', 'SELECT'), 'anon does not have SELECT on profiles');
select ok(not has_table_privilege('anon', 'public.profiles', 'INSERT'), 'anon does not have INSERT on profiles');
select ok(not has_table_privilege('anon', 'public.profiles', 'UPDATE'), 'anon does not have UPDATE on profiles');
select ok(not has_table_privilege('anon', 'public.profiles', 'DELETE'), 'anon does not have DELETE on profiles');

select * from finish();
rollback;
