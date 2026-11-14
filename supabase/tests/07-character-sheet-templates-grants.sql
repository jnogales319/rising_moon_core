-- Data API grants on character_sheet_templates (positive and negative).
-- No role-switching needed -- has_table_privilege checks the catalog
-- directly from whatever role is connected.
--
-- Unlike profiles (where only service_role has DELETE), authenticated has
-- a DELETE grant here too -- owners need self-service template deletion
-- (#73) -- so there's no "authenticated lacks X" negative case to check
-- beyond anon having nothing at all.

begin;
select plan(12);

select ok(has_table_privilege('authenticated', 'public.character_sheet_templates', 'SELECT'), 'authenticated has SELECT on character_sheet_templates');
select ok(has_table_privilege('authenticated', 'public.character_sheet_templates', 'INSERT'), 'authenticated has INSERT on character_sheet_templates');
select ok(has_table_privilege('authenticated', 'public.character_sheet_templates', 'UPDATE'), 'authenticated has UPDATE on character_sheet_templates');
select ok(has_table_privilege('authenticated', 'public.character_sheet_templates', 'DELETE'), 'authenticated has DELETE on character_sheet_templates');

select ok(has_table_privilege('service_role', 'public.character_sheet_templates', 'SELECT'), 'service_role has SELECT on character_sheet_templates');
select ok(has_table_privilege('service_role', 'public.character_sheet_templates', 'INSERT'), 'service_role has INSERT on character_sheet_templates');
select ok(has_table_privilege('service_role', 'public.character_sheet_templates', 'UPDATE'), 'service_role has UPDATE on character_sheet_templates');
select ok(has_table_privilege('service_role', 'public.character_sheet_templates', 'DELETE'), 'service_role has DELETE on character_sheet_templates');

select ok(not has_table_privilege('anon', 'public.character_sheet_templates', 'SELECT'), 'anon does not have SELECT on character_sheet_templates');
select ok(not has_table_privilege('anon', 'public.character_sheet_templates', 'INSERT'), 'anon does not have INSERT on character_sheet_templates');
select ok(not has_table_privilege('anon', 'public.character_sheet_templates', 'UPDATE'), 'anon does not have UPDATE on character_sheet_templates');
select ok(not has_table_privilege('anon', 'public.character_sheet_templates', 'DELETE'), 'anon does not have DELETE on character_sheet_templates');

select * from finish();
rollback;
