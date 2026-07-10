
-- Tighten orders insert policy
drop policy if exists "orders_authenticated_insert" on public.orders;
create policy "orders_authenticated_insert" on public.orders
  for insert to authenticated
  with check (auth.uid() = user_id);

-- Lock down SECURITY DEFINER helpers
revoke execute on function public.has_role(uuid, public.app_role) from public, anon, authenticated;
grant execute on function public.has_role(uuid, public.app_role) to service_role;

revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.set_updated_at() from public, anon, authenticated;

-- Storage policies for event-covers (path convention: <organizer_user_id>/<filename>)
create policy "event_covers_public_read" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'event-covers');

create policy "event_covers_org_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'event-covers'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "event_covers_org_update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'event-covers'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "event_covers_org_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'event-covers'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
