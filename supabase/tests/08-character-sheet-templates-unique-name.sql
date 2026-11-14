-- Case-folded name uniqueness, scoped per owner (unlike profiles'
-- globally-unique display_name): "Fate Core" and "fate core" collide for
-- the same owner, but two different owners can both use "Fate Core".

begin;
select plan(3);

select tests.create_supabase_user('csu-owner@example.com') as owner_id \gset
select tests.authenticate_as('csu-owner@example.com');
insert into public.character_sheet_templates (owner_id, name) values (:'owner_id', 'Fate Core');

-- A case-folded duplicate name for the SAME owner is rejected.
select throws_ok(
  format('insert into public.character_sheet_templates (owner_id, name) values (%L, %L)', :'owner_id', 'fate core'),
  'duplicate key value violates unique constraint "character_sheet_templates_owner_name_lower_key"',
  'a case-folded duplicate name for the same owner is rejected as a unique violation'
);

-- A different owner can use the exact same name -- uniqueness is per-owner, not global.
select tests.create_supabase_user('csu-other@example.com') as other_id \gset
select tests.authenticate_as('csu-other@example.com');
select lives_ok(
  format('insert into public.character_sheet_templates (owner_id, name) values (%L, %L)', :'other_id', 'Fate Core'),
  'a different owner can use the same template name'
);

-- Updating to a case-folded duplicate within the same owner is also rejected.
select tests.authenticate_as('csu-owner@example.com');
insert into public.character_sheet_templates (owner_id, name) values (:'owner_id', 'Fate Condensed');
select throws_ok(
  format('update public.character_sheet_templates set name = %L where owner_id = %L and name = %L', 'fate core', :'owner_id', 'Fate Condensed'),
  'duplicate key value violates unique constraint "character_sheet_templates_owner_name_lower_key"',
  'updating to a case-folded duplicate name within the same owner is rejected'
);

select * from finish();
rollback;
