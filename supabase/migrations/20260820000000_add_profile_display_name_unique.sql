-- Case-folded uniqueness: "Nightowl" and "nightowl" are
-- the same name for collision purposes, but the value on the row keeps
-- whatever casing the user actually typed.
create unique index profiles_display_name_lower_key
  on public.profiles (lower(display_name));

-- security definer so anon (not yet authenticated, mid-registration) can
-- call this to pre-check availability before signUp() without needing a
-- select grant on profiles itself.
create function public.is_display_name_available(name text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select not exists (
    select 1 from public.profiles where lower(display_name) = lower(name)
  );
$$;

grant execute on function public.is_display_name_available(text) to anon;
