create or replace function public.test_has_role()
returns boolean
language sql
stable
security invoker
as $$
  select public.has_role(auth.uid(), 'organizer'::public.app_role);
$$;

grant execute on function public.test_has_role() to authenticated;
