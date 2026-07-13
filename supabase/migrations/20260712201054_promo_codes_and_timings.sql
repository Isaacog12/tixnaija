-- 1. Create validate_promo_code RPC
create or replace function public.validate_promo_code(
  p_event_id uuid,
  p_code text
) returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  v_promo record;
begin
  select id, discount_type, discount_value, max_uses, times_used, expires_at
  into v_promo
  from public.promo_codes
  where event_id = p_event_id
    and code = upper(p_code)
    and active = true;

  if not found then
    raise exception 'Invalid promo code';
  end if;

  if v_promo.expires_at is not null and v_promo.expires_at <= now() then
    raise exception 'Promo code has expired';
  end if;

  if v_promo.max_uses is not null and v_promo.times_used >= v_promo.max_uses then
    raise exception 'Promo code usage limit reached';
  end if;

  return jsonb_build_object(
    'id', v_promo.id,
    'discount_type', v_promo.discount_type,
    'discount_value', v_promo.discount_value
  );
end;
$$;

grant execute on function public.validate_promo_code to anon, authenticated, service_role;

-- 2. Drop the old test checkout RPC
drop function if exists public.process_test_checkout;

-- 3. Create the new production process_checkout RPC
create or replace function public.process_checkout(
  p_event_id uuid,
  p_user_id uuid,
  p_buyer_name text,
  p_buyer_email text,
  p_buyer_phone text,
  p_tickets jsonb,
  p_amount_paid integer,  -- the actual amount verified by Paystack
  p_payment_reference text,
  p_promo_code_id uuid default null
) returns uuid
language plpgsql security definer
set search_path = public
as $$
declare
  v_order_id uuid;
  v_ticket_type record;
  v_item jsonb;
  v_count integer;
  v_ticket_type_id uuid;
  v_event record;
  v_ticket_ids uuid[] := array[]::uuid[];
  v_new_ticket_id uuid;
  v_order_item_id uuid;
  
  v_computed_subtotal integer := 0;
  v_computed_discount integer := 0;
  v_computed_total integer := 0;
  v_promo record;
begin
  -- 1. Get event info
  select * into v_event from public.events where id = p_event_id;
  if not found then
    raise exception 'Event not found';
  end if;

  -- 2. Verify availability and compute subtotal securely
  for v_item in select * from jsonb_array_elements(p_tickets)
  loop
    v_ticket_type_id := (v_item->>'ticketTypeId')::uuid;
    v_count := (v_item->>'count')::integer;

    select * into v_ticket_type from public.ticket_types where id = v_ticket_type_id;
    if not found then
      raise exception 'Ticket type % not found', v_ticket_type_id;
    end if;

    if v_ticket_type.quantity_available - v_ticket_type.quantity_sold < v_count then
      raise exception 'Not enough tickets available for %', v_ticket_type.name;
    end if;
    
    v_computed_subtotal := v_computed_subtotal + (v_ticket_type.price_kobo * v_count);
  end loop;

  -- 3. Process promo code if provided
  if p_promo_code_id is not null then
    -- Atomically check and increment times_used to prevent race conditions
    update public.promo_codes
    set times_used = times_used + 1
    where id = p_promo_code_id
      and event_id = p_event_id
      and active = true
      and (expires_at is null or expires_at > now())
      and (max_uses is null or times_used < max_uses)
    returning discount_type, discount_value into v_promo;

    if not found then
      raise exception 'Promo code is invalid, expired, or fully claimed.';
    end if;

    -- Calculate discount
    if v_promo.discount_type = 'percent' then
      v_computed_discount := (v_computed_subtotal * v_promo.discount_value) / 100;
    else
      v_computed_discount := v_promo.discount_value;
    end if;

    -- Discount cannot exceed subtotal
    if v_computed_discount > v_computed_subtotal then
      v_computed_discount := v_computed_subtotal;
    end if;
  end if;

  v_computed_total := v_computed_subtotal - v_computed_discount;

  -- 4. Verify payment amounts match
  if v_computed_total != p_amount_paid then
    raise exception 'Payment mismatch: expected %, got %', v_computed_total, p_amount_paid;
  end if;

  -- 5. Create order
  insert into public.orders (
    event_id, user_id, buyer_name, buyer_email, buyer_phone,
    subtotal_kobo, discount_kobo, total_kobo, promo_code_id, status, payment_reference
  ) values (
    p_event_id, p_user_id, p_buyer_name, p_buyer_email, p_buyer_phone,
    v_computed_subtotal, v_computed_discount, v_computed_total, p_promo_code_id, 'paid', p_payment_reference
  ) returning id into v_order_id;

  -- 6. Generate tickets and update counts
  for v_item in select * from jsonb_array_elements(p_tickets) loop
    v_ticket_type_id := (v_item->>'ticketTypeId')::uuid;
    v_count := (v_item->>'count')::integer;

    select price_kobo into v_ticket_type from public.ticket_types where id = v_ticket_type_id;

    -- Update sold count
    update public.ticket_types 
    set quantity_sold = quantity_sold + v_count 
    where id = v_ticket_type_id;

    -- Insert order_item
    insert into public.order_items (
      order_id, ticket_type_id, quantity, unit_price_kobo
    ) values (
      v_order_id, v_ticket_type_id, v_count, v_ticket_type.price_kobo
    ) returning id into v_order_item_id;

    -- Insert tickets
    for i in 1..v_count loop
      insert into public.tickets (
        order_item_id, attendee_name, attendee_email, status
      ) values (
        v_order_item_id, 
        coalesce(v_item->'attendee_names'->>(i-1), p_buyer_name),
        p_buyer_email,
        'valid'
      ) returning id into v_new_ticket_id;
      
      v_ticket_ids := array_append(v_ticket_ids, v_new_ticket_id);
    end loop;
  end loop;

  -- 7. Create inbox message
  insert into public.messages (
    recipient_id, recipient_email, type, title, body, related_order_id, related_ticket_ids
  ) values (
    p_user_id, p_buyer_email, 'ticket_delivery',
    'Your tickets for ' || v_event.title || ' are ready 🎟️',
    'Your tickets for ' || v_event.title || ' are ready!' || E'\n\n' ||
    'Date: ' || v_event.start_datetime::date || E'\n' ||
    'Location: ' || coalesce(v_event.venue_name, 'Online') || E'\n\n' ||
    'Click the link below to view your tickets.',
    v_order_id, v_ticket_ids
  );

  return v_order_id;
end;
$$;

revoke execute on function public.process_checkout from public;
grant execute on function public.process_checkout to anon, authenticated, service_role;
