-- Trigger behavior (profiles): handle_new_user() and
-- preserve_profile_identity(), plus the SECURITY DEFINER/search_path
-- posture handle_new_user() depends on to be safely callable at all.

begin;
select plan(7);

-- handle_new_user() populates display_name from raw_user_meta_data.
select tests.create_supabase_user('trigger-new@example.com', jsonb_build_object('display_name', 'Triggered')) as new_id \gset
select is(
  (select display_name from public.profiles where id = :'new_id'::uuid),
  'Triggered',
  'handle_new_user() creates a profiles row with display_name from raw_user_meta_data'
);

-- handle_new_user() stays SECURITY DEFINER with search_path pinned to
-- public -- it runs as part of an INSERT into auth.users made by any role
-- (including anon, mid-signup), so it must not resolve `public.profiles`
-- through a caller-controlled search_path.
select is(
  (select prosecdef from pg_proc where pronamespace = 'public'::regnamespace and proname = 'handle_new_user'),
  true,
  'handle_new_user() is SECURITY DEFINER'
);
select is(
  (select proconfig from pg_proc where pronamespace = 'public'::regnamespace and proname = 'handle_new_user'),
  array['search_path=public'],
  'handle_new_user() has search_path pinned to public'
);

-- preserve_profile_identity(): an authenticated UPDATE cannot change id or
-- created_at -- both are forced back to OLD. If id had actually changed,
-- this WHERE clause (still searching for the original id) would find
-- nothing; if created_at had actually changed, it wouldn't still read as
-- "recent".
select tests.create_supabase_user('trigger-identity@example.com') as identity_id \gset
select tests.authenticate_as('trigger-identity@example.com');
update public.profiles set id = gen_random_uuid(), created_at = now() - interval '10 years'
  where id = :'identity_id'::uuid;
select is(
  (select count(*)::int from public.profiles where id = :'identity_id'::uuid),
  1,
  'authenticated UPDATE cannot change id (forced back to OLD)'
);
select is(
  (select created_at > now() - interval '1 minute' from public.profiles where id = :'identity_id'::uuid),
  true,
  'authenticated UPDATE cannot change created_at (forced back to OLD)'
);

-- service_role is exempt from that guard.
select tests.authenticate_as_service_role();
update public.profiles set created_at = timestamptz '2000-01-01' where id = :'identity_id'::uuid;
select is(
  (select created_at from public.profiles where id = :'identity_id'::uuid),
  timestamptz '2000-01-01',
  'service_role is exempt from preserve_profile_identity()'
);

-- service_role can also move id itself -- sanity-check the full exemption,
-- not just created_at. profiles.id has both a primary key and a foreign
-- key to auth.users(id), so the new id has to be a real, currently-
-- unoccupied auth.users id: seed another user, then free up its
-- profiles row first (service_role already has the DELETE grant for
-- that, see 03-profiles-grants.sql).
select tests.create_supabase_user('trigger-identity-target@example.com') as target_id \gset
delete from public.profiles where id = :'target_id'::uuid;
select lives_ok(
  format('update public.profiles set id = %L where id = %L', :'target_id', :'identity_id'),
  'service_role can change id (fully exempt from the guard)'
);

select * from finish();
rollback;
