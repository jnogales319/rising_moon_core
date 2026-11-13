-- Second migration: case-folded display_name uniqueness and
-- is_display_name_available().

begin;
select plan(7);

-- Case-folded uniqueness: 'Nightowl' then 'nightowl' collide.
select tests.create_supabase_user('display-name-a@example.com', jsonb_build_object('display_name', 'Nightowl')) as a_id \gset
select tests.create_supabase_user('display-name-b@example.com') as b_id \gset
select throws_ok(
  format('update public.profiles set display_name = %L where id = %L', 'nightowl', :'b_id'),
  'duplicate key value violates unique constraint "profiles_display_name_lower_key"',
  'a case-folded duplicate display_name is rejected as a unique violation'
);

-- Two NULL display_names coexist (nullable column; multiple NULLs allowed
-- by the index) -- the two creates above (a_id gets 'Nightowl', b_id's
-- update above never committed thanks to the violation, so b_id is still
-- NULL) plus one more NULL-named user.
select tests.create_supabase_user('display-name-c@example.com') as c_id \gset
select is(
  (select count(*)::int from public.profiles where id in (:'b_id'::uuid, :'c_id'::uuid) and display_name is null),
  2,
  'two rows with a NULL display_name coexist'
);

-- is_display_name_available() reads existing names case-insensitively.
select is(
  public.is_display_name_available('nightowl'),
  false,
  'is_display_name_available() is false when "Nightowl" already exists (case-folded)'
);
select is(
  public.is_display_name_available('unused-name-xyz'),
  true,
  'is_display_name_available() is true for an unused name'
);

-- anon can EXECUTE it despite having no SELECT on profiles (SECURITY
-- DEFINER), and it returns only the boolean -- no row data.
select tests.authenticate_as_anon();
select lives_ok(
  $sql$select public.is_display_name_available('nightowl')$sql$,
  'anon can call is_display_name_available() despite no SELECT grant on profiles'
);

-- It keeps SECURITY DEFINER + search_path = public.
select is(
  (select prosecdef from pg_proc where pronamespace = 'public'::regnamespace and proname = 'is_display_name_available'),
  true,
  'is_display_name_available() is SECURITY DEFINER'
);
select is(
  (select proconfig from pg_proc where pronamespace = 'public'::regnamespace and proname = 'is_display_name_available'),
  array['search_path=public'],
  'is_display_name_available() has search_path pinned to public'
);

select * from finish();
rollback;
