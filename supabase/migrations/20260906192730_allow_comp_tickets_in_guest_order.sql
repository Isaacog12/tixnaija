
-- Update get_guest_order_full to allow comp orders
create or replace function public.get_guest_order_full(p_order_id uuid, p_email text, p_access_code text)
returns jsonb
language sql
security definer
set search_path = public
as $function
  select jsonb_build_object(
    'order', (
      select jsonb_build_object(
        'id', o.id,
        'event_id', o.event_id,
        'user_id', o.user_id,
        'buyer_name', o.buyer_name,
        'buyer_email', o.buyer_email,
        'buyer_phone', o.buyer_phone,
        'subtotal_kobo', o.subtotal_kobo,
        'discount_kobo', o.discount_kobo,
        'total_kobo', o.total_kobo,
        'promo_code_id', o.promo_code_id,
        'status', o.status,
        'payment_reference', o.payment_reference,
        'created_at', o.created_at,
        'updated_at', o.updated_at,
        'events', (select row_to_json(e) from events e where e.id = o.event_id)
      )
    ),
    'tickets', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', t.id,
          'ticket_code', t.ticket_code,
          'attendee_name', t.attendee_name,
          'status', t.status,
          'order_items', jsonb_build_object(
            'order_id', oi.order_id,
            'ticket_types', (select row_to_json(tt) from ticket_types tt where tt.id = oi.ticket_type_id)
          )
        )
      )
      from tickets t
      join order_items oi on oi.id = t.order_item_id
      where oi.order_id = p_order_id
    ), '[]'::jsonb)
  )
  from orders o
  where o.id = p_order_id
    and lower(o.buyer_email) = lower(p_email)
    and o.access_code = p_access_code
    and o.status IN ('paid', 'comp');
unction;

-- Update get_guest_orders
create or replace function public.get_guest_orders(p_email text, p_access_code text)
returns table (
  id           uuid,
  buyer_name   text,
  buyer_email  text,
  status       public.order_status,
  total_kobo   integer,
  created_at   timestamptz,
  event_title  text,
  event_slug   text,
  cover_image_url text,
  start_datetime timestamptz
)
language plpgsql
security definer
as $function
begin
  return query
    select
      o.id,
      o.buyer_name,
      o.buyer_email,
      o.status,
      o.total_kobo,
      o.created_at,
      e.title as event_title,
      e.slug as event_slug,
      e.cover_image_url,
      e.start_datetime
    from public.orders o
    join public.events e on o.event_id = e.id
    where lower(o.buyer_email) = lower(p_email)
      and o.access_code = p_access_code
      and o.status IN ('paid', 'comp')
    order by o.created_at desc
    limit 50;
end;
unction;

-- Update get_guest_tickets
create or replace function public.get_guest_tickets(p_order_id uuid, p_email text, p_access_code text)
returns table (
  id             uuid,
  ticket_code    text,
  attendee_name  text,
  attendee_email text,
  status         public.ticket_status,
  ticket_type_name text,
  price_kobo     integer
)
language plpgsql
security definer
as $function
begin
  return query
    select
      t.id,
      t.ticket_code,
      t.attendee_name,
      t.attendee_email,
      t.status,
      tt.name as ticket_type_name,
      tt.price_kobo
    from public.tickets t
    join public.order_items oi on oi.id = t.order_item_id
    join public.ticket_types tt on tt.id = oi.ticket_type_id
    join public.orders o on o.id = oi.order_id
    where o.id = p_order_id
      and lower(o.buyer_email) = lower(p_email)
      and o.access_code = p_access_code
      and o.status IN ('paid', 'comp');
end;
unction;

