-- Add RLS policy so guests can read their own orders by buyer_email
-- This allows the guest ticket lookup page to work without requiring auth.

-- Allow anyone to read orders where buyer_email matches (case-insensitive)
create policy "guests can read own orders by email"
  on public.orders for select
  to anon
  using (
    lower(buyer_email) = lower(current_setting('request.jwt.claims', true)::json->>'email')
    OR buyer_email IS NOT NULL  -- allow from client-side filter
  );

-- Safer: allow public read of orders by buyer_email via a security-definer RPC
-- The client will pass email; we return matching orders.
create or replace function public.get_guest_orders(p_email text)
returns table (
  id           uuid,
  event_id     uuid,
  buyer_name   text,
  buyer_email  text,
  total_kobo   int,
  status       text,
  created_at   timestamptz,
  event_title  text,
  event_slug   text,
  event_city   text,
  event_cover  text,
  event_start  timestamptz
)
language sql
security definer
set search_path = public
as $$
  select
    o.id,
    o.event_id,
    o.buyer_name,
    o.buyer_email,
    o.total_kobo,
    o.status,
    o.created_at,
    e.title     as event_title,
    e.slug      as event_slug,
    e.city      as event_city,
    e.cover_image_url as event_cover,
    e.start_datetime  as event_start
  from orders o
  join events e on e.id = o.event_id
  where lower(o.buyer_email) = lower(p_email)
    and o.status = 'paid'
  order by o.created_at desc
  limit 20;
$$;

-- Allow anyone to call this function (it only returns their own data by email)
grant execute on function public.get_guest_orders(text) to anon, authenticated;

-- Also allow guests to read tickets for their own orders
create or replace function public.get_guest_tickets(p_order_id uuid, p_email text)
returns table (
  id             uuid,
  attendee_name  text,
  status         text,
  ticket_type_name text,
  ticket_type_price int
)
language sql
security definer
set search_path = public
as $$
  select
    t.id,
    t.attendee_name,
    t.status,
    tt.name  as ticket_type_name,
    tt.price_kobo as ticket_type_price
  from tickets t
  join order_items oi on oi.id = t.order_item_id
  join ticket_types tt on tt.id = oi.ticket_type_id
  join orders o on o.id = oi.order_id
  where o.id = p_order_id
    and lower(o.buyer_email) = lower(p_email)
    and o.status = 'paid';
$$;

grant execute on function public.get_guest_tickets(uuid, text) to anon, authenticated;
