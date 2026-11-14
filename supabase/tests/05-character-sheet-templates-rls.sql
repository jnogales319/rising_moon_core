-- RLS: visibility & mutation (character_sheet_templates), including the
-- insert/update with-check that blocks a user from ever setting
-- is_default = true on their own rows. (The is_default = true
-- *existing-row* immutability trigger -- covering rows seeded by
-- service_role -- is tested in 06-character-sheet-templates-triggers.sql.)
--
-- Cross-user UPDATE and DELETE are both row-count checks, not throws_ok:
-- authenticated has UPDATE and DELETE grants on this table (owner-scoped
-- templates need self-service edit/delete), so a cross-user attempt is
-- filtered to zero rows by RLS rather than denied outright at the grant
-- level -- unlike anon, which has no grants at all.

begin;
select plan(12);

select tests.create_supabase_user('csr-owner@example.com') as owner_id \gset
select tests.create_supabase_user('csr-other@example.com') as other_id \gset

-- Owner can insert own template.
select tests.authenticate_as('csr-owner@example.com');
select lives_ok(
  format('insert into public.character_sheet_templates (owner_id, name) values (%L, %L)', :'owner_id', 'Fate Core'),
  'owner can insert own template'
);

-- Owner can select own row.
select is(
  (select count(*)::int from public.character_sheet_templates where owner_id = :'owner_id'::uuid),
  1,
  'owner can select own template row'
);

-- Owner can update own row.
select lives_ok(
  format('update public.character_sheet_templates set name = %L where owner_id = %L', 'Fate Core Updated', :'owner_id'),
  'owner can update own template row'
);
select is(
  (select name from public.character_sheet_templates where owner_id = :'owner_id'::uuid),
  'Fate Core Updated',
  'owner update actually took effect'
);

-- A second authenticated user sees zero rows for the owner's template.
select tests.authenticate_as('csr-other@example.com');
select is(
  (select count(*)::int from public.character_sheet_templates where owner_id = :'owner_id'::uuid),
  0,
  'second user cannot select owner template row'
);

-- A second user's UPDATE of the owner's row affects zero rows (RLS) --
-- confirm by switching back to the owner afterward.
update public.character_sheet_templates set name = 'hacked' where owner_id = :'owner_id'::uuid;
select tests.authenticate_as('csr-owner@example.com');
select is(
  (select name from public.character_sheet_templates where owner_id = :'owner_id'::uuid),
  'Fate Core Updated',
  'second user update of owner row affects zero rows (owner row untouched)'
);

-- A second user's DELETE of the owner's row affects zero rows (RLS) --
-- confirm by switching back to the owner afterward.
select tests.authenticate_as('csr-other@example.com');
delete from public.character_sheet_templates where owner_id = :'owner_id'::uuid;
select tests.authenticate_as('csr-owner@example.com');
select is(
  (select count(*)::int from public.character_sheet_templates where owner_id = :'owner_id'::uuid),
  1,
  'second user delete of owner row affects zero rows (owner row still exists)'
);

-- anon (no JWT, no grant) cannot select or insert at all.
select tests.authenticate_as_anon();
select throws_ok(
  'select * from public.character_sheet_templates',
  'permission denied for table character_sheet_templates',
  'anon has no SELECT grant, so a select raises permission denied'
);
select throws_ok(
  format('insert into public.character_sheet_templates (owner_id, name) values (%L, %L)', :'owner_id', 'Anon Attempt'),
  'permission denied for table character_sheet_templates',
  'anon has no INSERT grant, so inserting raises permission denied'
);

-- An authenticated user cannot insert a template owned by someone else.
select tests.authenticate_as('csr-other@example.com');
select throws_ok(
  format('insert into public.character_sheet_templates (owner_id, name) values (%L, %L)', :'owner_id', 'Not Mine'),
  'new row violates row-level security policy for table "character_sheet_templates"',
  'authenticated cannot insert a template for a different owner_id (RLS insert policy)'
);

-- An authenticated user cannot insert a template with is_default = true for themselves.
select throws_ok(
  format('insert into public.character_sheet_templates (owner_id, name, is_default) values (%L, %L, true)', :'other_id', 'Faux Default'),
  'new row violates row-level security policy for table "character_sheet_templates"',
  'authenticated cannot insert is_default = true for their own template (RLS insert policy)'
);

-- An authenticated user cannot update their own row to set is_default = true.
select tests.create_supabase_user('csr-promoter@example.com') as promoter_id \gset
select tests.authenticate_as('csr-promoter@example.com');
insert into public.character_sheet_templates (owner_id, name) values (:'promoter_id', 'Promote Me');
select throws_ok(
  format('update public.character_sheet_templates set is_default = true where owner_id = %L', :'promoter_id'),
  'new row violates row-level security policy for table "character_sheet_templates"',
  'authenticated cannot update is_default to true on own row (RLS update with-check)'
);

select * from finish();
rollback;
