-- Drop the old order_items policy that restricts to user_id
drop policy if exists "order_items_view_via_order" on public.order_items;

-- Create a new one that allows access if user_id matches OR if buyer_email matches the logged in user's email
create policy "order_items_view_via_order" on public.order_items
  for select to authenticated
  using (exists (
    select 1 from public.orders o
    where o.id = order_id
    and (
      o.user_id = auth.uid()
      or o.buyer_email = (auth.jwt()->>'email')
      or exists (select 1 from public.events e where e.id = o.event_id and e.organizer_id = auth.uid())
    )
  ));

-- Drop the old tickets policy (the one named tickets_buyer_view_own) just to be totally clean
drop policy if exists "tickets_buyer_view_own" on public.tickets;

-- Ensure tickets policy covers guest emails properly (we created tickets_view_own earlier, this makes sure it's up to date)
drop policy if exists "tickets_view_own" on public.tickets;
create policy "tickets_view_own" on public.tickets
  for select to authenticated
  using (
    attendee_email = (auth.jwt()->>'email') or
    exists (
      select 1 from public.order_items oi
      join public.orders o on o.id = oi.order_id
      where oi.id = public.tickets.order_item_id 
      and (
        o.user_id = auth.uid() 
        or o.buyer_email = (auth.jwt()->>'email')
      )
    )
  );
