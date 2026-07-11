-- 1. Orders policy
drop policy if exists "orders_buyer_view_own" on public.orders;
create policy "orders_buyer_view_own" on public.orders
  for select to authenticated
  using (
    user_id = auth.uid() or 
    lower(buyer_email) = lower(auth.jwt()->>'email')
  );

-- 2. Order items policy
drop policy if exists "order_items_view_via_order" on public.order_items;
create policy "order_items_view_via_order" on public.order_items
  for select to authenticated
  using (exists (
    select 1 from public.orders o
    where o.id = order_id
    and (
      o.user_id = auth.uid()
      or lower(o.buyer_email) = lower(auth.jwt()->>'email')
      or exists (select 1 from public.events e where e.id = o.event_id and e.organizer_id = auth.uid())
    )
  ));

-- 3. Tickets policy
drop policy if exists "tickets_view_own" on public.tickets;
create policy "tickets_view_own" on public.tickets
  for select to authenticated
  using (
    lower(attendee_email) = lower(auth.jwt()->>'email') or
    exists (
      select 1 from public.order_items oi
      join public.orders o on o.id = oi.order_id
      where oi.id = public.tickets.order_item_id 
      and (
        o.user_id = auth.uid() 
        or lower(o.buyer_email) = lower(auth.jwt()->>'email')
      )
    )
  );
