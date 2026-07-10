-- Drop existing potentially restrictive policies
drop policy if exists "orders_buyer_view_own" on public.orders;
drop policy if exists "tickets_view_own" on public.tickets;

-- New orders policy: match auth.uid() OR auth.jwt()->>'email'
create policy "orders_buyer_view_own" on public.orders
  for select to authenticated
  using (
    user_id = auth.uid() or 
    buyer_email = (auth.jwt()->>'email')
  );

-- New tickets policy: match auth.uid() OR auth.jwt()->>'email'
create policy "tickets_view_own" on public.tickets
  for select to authenticated
  using (
    attendee_email = (auth.jwt()->>'email') or
    exists (
      select 1 from public.order_items oi
      join public.orders o on o.id = oi.order_id
      where oi.id = public.tickets.order_item_id and (o.user_id = auth.uid() or o.buyer_email = (auth.jwt()->>'email'))
    )
  );
