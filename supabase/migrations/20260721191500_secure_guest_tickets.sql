-- 1. Add access_code column to orders
alter table public.orders add column if not exists access_code text;

-- 2. Update process_checkout RPC to accept and store access_code
drop function if exists public.process_checkout;

create or replace function public.process_checkout(
  p_event_id uuid,
  p_user_id uuid,
  p_buyer_name text,
  p_buyer_email text,
  p_buyer_phone text,
  p_tickets jsonb,
  p_amount_paid integer,
  p_payment_reference text,
  p_promo_code_id uuid default null,
  p_is_gift boolean default false,
  p_recipient_name text default null,
  p_recipient_email text default null,
  p_gift_message text default null,
  p_access_code text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_id uuid;
  v_ticket record;
  v_ticket_type record;
  v_order_item_id uuid;
  v_promo_type text;
  v_promo_value integer;
  v_calculated_subtotal integer := 0;
  v_calculated_discount integer := 0;
  v_calculated_total integer := 0;
begin
  -- 1. Calculate and verify totals (skip if free)
  if p_amount_paid > 0 then
    -- basic subtotal
    for v_ticket in select * from jsonb_to_recordset(p_tickets) as x(type_id uuid, count integer)
    loop
      select * into v_ticket_type from ticket_types where id = v_ticket.type_id;
      if not found then
        raise exception 'Invalid ticket type %', v_ticket.type_id;
      end if;
      v_calculated_subtotal := v_calculated_subtotal + (v_ticket_type.price_kobo * v_ticket.count);
    end loop;

    -- apply promo
    if p_promo_code_id is not null then
      select discount_type, discount_value into v_promo_type, v_promo_value
      from promo_codes
      where id = p_promo_code_id and event_id = p_event_id;
      
      if not found then
        raise exception 'Invalid promo code';
      end if;

      if v_promo_type = 'percent' then
        v_calculated_discount := (v_calculated_subtotal * v_promo_value) / 100;
      else
        v_calculated_discount := v_promo_value;
      end if;
      
      v_calculated_discount := least(v_calculated_discount, v_calculated_subtotal);
    end if;

    v_calculated_total := v_calculated_subtotal - v_calculated_discount;
  end if;

  -- 2. Create the Order (storing access_code)
  insert into orders (
    event_id, user_id, buyer_name, buyer_email, buyer_phone,
    subtotal_kobo, discount_kobo, total_kobo, promo_code_id,
    payment_reference, status, is_gift, recipient_name, recipient_email, gift_message,
    access_code
  )
  values (
    p_event_id, p_user_id, p_buyer_name, p_buyer_email, p_buyer_phone,
    v_calculated_subtotal, v_calculated_discount, v_calculated_total, p_promo_code_id,
    p_payment_reference, 'paid', p_is_gift, p_recipient_name, p_recipient_email, p_gift_message,
    p_access_code
  )
  returning id into v_order_id;

  -- 3. Create Order Items & Tickets
  for v_ticket in select * from jsonb_to_recordset(p_tickets) as x(type_id uuid, count integer, names jsonb)
  loop
    select * into v_ticket_type from ticket_types where id = v_ticket.type_id;
    
    -- Check capacity
    if v_ticket_type.capacity is not null then
      if (select count(*) from tickets t 
          join order_items oi on oi.id = t.order_item_id 
          where oi.ticket_type_id = v_ticket_type.id) + v_ticket.count > v_ticket_type.capacity then
        raise exception 'Not enough capacity for ticket type %', v_ticket_type.name;
      end if;
    end if;

    insert into order_items (order_id, ticket_type_id, quantity, unit_price_kobo)
    values (v_order_id, v_ticket.type_id, v_ticket.count, v_ticket_type.price_kobo)
    returning id into v_order_item_id;

    -- Create individual tickets
    for i in 1..v_ticket.count loop
      insert into tickets (order_item_id, attendee_name, status)
      values (
        v_order_item_id, 
        coalesce(nullif(v_ticket.names->>(i-1), ''), p_buyer_name), 
        'valid'
      );
    end loop;
  end loop;

  return v_order_id;
end;
$$;

revoke execute on function public.process_checkout from public;
grant execute on function public.process_checkout to anon, authenticated, service_role;


-- 3. Update get_guest_orders to require access_code
create or replace function public.get_guest_orders(p_email text, p_access_code text)
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
    and o.access_code = p_access_code
    and o.status = 'paid'
  order by o.created_at desc
  limit 20;
$$;

grant execute on function public.get_guest_orders(text, text) to anon, authenticated;

-- 4. Update get_guest_tickets to require access_code
create or replace function public.get_guest_tickets(p_order_id uuid, p_email text, p_access_code text)
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
    and o.access_code = p_access_code
    and o.status = 'paid';
$$;

grant execute on function public.get_guest_tickets(uuid, text, text) to anon, authenticated;
