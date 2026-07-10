drop policy if exists "events_organizer_insert" on public.events;

create policy "events_organizer_insert" on public.events
  for insert to authenticated
  with check (
    auth.uid() = organizer_id 
    and public.has_role(auth.uid(), 'organizer'::public.app_role)
  );
