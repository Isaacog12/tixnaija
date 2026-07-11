create or replace function public.process_test_checkout(
  p_event_id uuid,
  p_user_id uuid,
  p_buyer_name text,
  p_buyer_email text,
  p_buyer_phone text,
  p_tickets jsonb,
  p_subtotal_kobo integer,
  p_discount_kobo integer,
  p_total_kobo integer,
  p_payment_reference text
) returns uuid
language plpgsql security definer
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
begin
  -- 1. Get event info
  select * into v_event from public.events where id = p_event_id;
  if not found then
    raise exception 'Event not found';
  end if;

  -- 2. Verify availability
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
  end loop;

  -- 3. Create order
  insert into public.orders (
    event_id, user_id, buyer_name, buyer_email, buyer_phone,
    subtotal_kobo, total_kobo, status, payment_reference
  ) values (
    p_event_id, p_user_id, p_buyer_name, p_buyer_email, p_buyer_phone,
    p_total_kobo, p_total_kobo, 'paid', p_payment_reference
  ) returning id into v_order_id;

  -- 4. Generate tickets and update counts
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

  -- 5. Create inbox message
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
