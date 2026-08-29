create or replace function public.process_checkout(
    p_event_id uuid,
    p_user_id uuid,
    p_buyer_name text,
    p_buyer_email text,
    p_buyer_phone text,
    p_tickets jsonb,
    p_amount_paid integer,  -- the actual amount verified by Paystack
    p_payment_reference text,
    p_promo_code_id uuid default null,
    p_is_gift boolean default false,
    p_recipient_name text default null,
    p_recipient_email text default null,
    p_gift_message text default null,
    p_access_code text default null
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
    
    v_actual_recipient_email text;
    v_actual_recipient_name text;
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
  
      if v_promo.discount_type = 'percent' then
        v_computed_discount := (v_computed_subtotal * v_promo.discount_value) / 100;
      else
        v_computed_discount := v_promo.discount_value;
      end if;
  
      if v_computed_discount > v_computed_subtotal then
        v_computed_discount := v_computed_subtotal;
      end if;
    end if;
  
    v_computed_total := v_computed_subtotal - v_computed_discount;
  
    -- 4. Verify payment amounts match
    if p_amount_paid < v_computed_total then
      raise exception 'Payment mismatch: expected at least %, got %', v_computed_total, p_amount_paid;
    end if;
  
    -- Determine final recipient info for tickets and delivery
    if p_is_gift then
      v_actual_recipient_email := coalesce(p_recipient_email, p_buyer_email);
      v_actual_recipient_name := coalesce(p_recipient_name, p_buyer_name);
    else
      v_actual_recipient_email := p_buyer_email;
      v_actual_recipient_name := p_buyer_name;
    end if;
  
    -- 5. Create order
    insert into public.orders (
      event_id, user_id, buyer_name, buyer_email, buyer_phone,
      subtotal_kobo, discount_kobo, total_kobo, promo_code_id, status, payment_reference,
      is_gift, recipient_name, recipient_email, gift_message, access_code
    ) values (
      p_event_id, p_user_id, p_buyer_name, p_buyer_email, p_buyer_phone,
      v_computed_subtotal, v_computed_discount, v_computed_total, p_promo_code_id, 'paid', p_payment_reference,
      p_is_gift, p_recipient_name, p_recipient_email, p_gift_message, p_access_code
    ) returning id into v_order_id;
  
    -- 6. Generate tickets and update counts
    for v_item in select * from jsonb_array_elements(p_tickets) loop
      v_ticket_type_id := (v_item->>'ticketTypeId')::uuid;
      v_count := (v_item->>'count')::integer;
  
      select * into v_ticket_type from public.ticket_types where id = v_ticket_type_id;
  
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
          coalesce(nullif(trim(v_item->'attendee_names'->>(i-1)), ''), v_actual_recipient_name),
          coalesce(nullif(trim(v_item->'attendee_emails'->>(i-1)), ''), v_actual_recipient_email),
          'valid'
        ) returning id into v_new_ticket_id;
        
        v_ticket_ids := array_append(v_ticket_ids, v_new_ticket_id);
      end loop;
    end loop;
  
    -- 7. Create inbox messages (Optional, keeping the old behavior for inbox)
    insert into public.messages (
      recipient_id, recipient_email, type, title, body, related_order_id, related_ticket_ids
    ) values (
      case when p_is_gift then null else p_user_id end, 
      v_actual_recipient_email, 
      'ticket_delivery',
      case when p_is_gift then 'You received a gift for ' || v_event.title || ' 🎁 ' else 'Your tickets for ' || v_event.title || ' are ready 🎟️ ' end,
      case when p_is_gift 
        then 'You received a gift from ' || p_buyer_name || '!' || coalesce(E'\n\n"' || p_gift_message || '"', '') || E'\n\nYour tickets for ' || v_event.title || ' are ready!' 
        else 'Your tickets for ' || v_event.title || ' are ready!' 
      end || E'\n\nDate: ' || v_event.start_datetime::date || E'\nLocation: ' || coalesce(v_event.venue_name, 'Online') || E'\n\nClick the link below to view your tickets.',
      v_order_id, v_ticket_ids
    );
  
    if p_is_gift then
      insert into public.messages (
        recipient_id, recipient_email, type, title, body, related_order_id, related_ticket_ids
      ) values (
        p_user_id, p_buyer_email, 'system',
        'Order Confirmation: ' || v_event.title,
        'Thank you for your purchase!' || E'\n\n' ||
        'You bought ' || array_length(v_ticket_ids, 1) || ' ticket(s) as a gift for ' || v_actual_recipient_name || ' (' || v_actual_recipient_email || ').' || E'\n\n' ||
        'Total Paid: ₦' || (v_computed_total / 100)::text || E'\n' ||
        'Payment Reference: ' || p_payment_reference,
        v_order_id, array[]::uuid[]
      );
    end if;
  
    return v_order_id;
  end;
  $$;

create or replace function public.update_ticket_attendee(
  p_ticket_id uuid,
  p_attendee_name text,
  p_attendee_email text
) returns void
language plpgsql security definer
as $$
declare
  v_order_user_id uuid;
begin
  -- Ensure the caller is authenticated
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  -- Verify the ticket belongs to an order owned by the caller
  select o.user_id into v_order_user_id
  from public.tickets t
  join public.order_items oi on oi.id = t.order_item_id
  join public.orders o on o.id = oi.order_id
  where t.id = p_ticket_id;

  if not found then
    raise exception 'Ticket not found';
  end if;

  if v_order_user_id != auth.uid() then
    raise exception 'Not authorized to modify this ticket';
  end if;

  -- Update the ticket
  update public.tickets
  set attendee_name = coalesce(nullif(trim(p_attendee_name), ''), attendee_name),
      attendee_email = coalesce(nullif(trim(p_attendee_email), ''), attendee_email)
  where id = p_ticket_id;
end;
$$;
