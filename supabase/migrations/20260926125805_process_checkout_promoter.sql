-- 1. validate_promoter_code
CREATE OR REPLACE FUNCTION public.validate_promoter_code(
  p_event_id uuid,
  p_code text
) RETURNS TABLE (
  link_id uuid,
  ticket_type_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT pl.id, pl.ticket_type_id
  FROM public.promoter_links pl
  WHERE pl.event_id = p_event_id
    AND pl.unique_code = p_code
    AND pl.active = true;
END;
$$;

-- Grant execution to anon and authenticated
GRANT EXECUTE ON FUNCTION public.validate_promoter_code(uuid, text) TO anon, authenticated;

-- 2. process_checkout update
CREATE OR REPLACE FUNCTION public.process_checkout(
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
  p_access_code text default null,
  p_promoter_link_id uuid default null
) returns uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
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
BEGIN
  -- 1. Get event info
  SELECT * INTO v_event FROM public.events WHERE id = p_event_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Event not found';
  END IF;

  IF v_event.status = 'cancelled' THEN
    RAISE EXCEPTION 'This event has been cancelled. Tickets are no longer available.';
  END IF;

  IF v_event.status = 'completed' THEN
    RAISE EXCEPTION 'This event has ended. Tickets are no longer available for purchase.';
  END IF;

  IF v_event.end_datetime < now() THEN
    RAISE EXCEPTION 'This event has ended. Tickets are no longer available for purchase.';
  END IF;

  -- 2. Verify availability and compute subtotal securely
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_tickets)
  LOOP
    v_ticket_type_id := (v_item->>'ticketTypeId')::uuid;
    v_count := (v_item->>'count')::integer;

    SELECT * INTO v_ticket_type FROM public.ticket_types WHERE id = v_ticket_type_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Ticket type % not found', v_ticket_type_id;
    END IF;

    IF v_ticket_type.quantity_available - v_ticket_type.quantity_sold < v_count THEN
      RAISE EXCEPTION 'Not enough tickets available for %', v_ticket_type.name;
    END IF;
    
    v_computed_subtotal := v_computed_subtotal + (v_ticket_type.price_kobo * v_count);
  END LOOP;

  -- 3. Process promo code if provided
  IF p_promo_code_id is not null THEN
    UPDATE public.promo_codes
    SET times_used = times_used + 1
    WHERE id = p_promo_code_id
      AND event_id = p_event_id
      AND active = true
      AND (expires_at is null or expires_at > now())
      AND (max_uses is null or times_used < max_uses)
    RETURNING discount_type, discount_value INTO v_promo;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Promo code is invalid, expired, or fully claimed.';
    END IF;

    IF v_promo.discount_type = 'percent' THEN
      v_computed_discount := (v_computed_subtotal * v_promo.discount_value) / 100;
    ELSE
      v_computed_discount := v_promo.discount_value;
    END IF;

    IF v_computed_discount > v_computed_subtotal THEN
      v_computed_discount := v_computed_subtotal;
    END IF;
  END IF;

  v_computed_total := v_computed_subtotal - v_computed_discount;

  -- 4. Verify payment amounts match
  IF p_amount_paid < v_computed_total THEN
    RAISE EXCEPTION 'Payment mismatch: expected at least %, got %', v_computed_total, p_amount_paid;
  END IF;

  -- Determine final recipient info for tickets and delivery
  IF p_is_gift THEN
    v_actual_recipient_email := coalesce(p_recipient_email, p_buyer_email);
    v_actual_recipient_name := coalesce(p_recipient_name, p_buyer_name);
  ELSE
    v_actual_recipient_email := p_buyer_email;
    v_actual_recipient_name := p_buyer_name;
  END IF;

  -- 5. Create order
  INSERT INTO public.orders (
    event_id, user_id, buyer_name, buyer_email, buyer_phone,
    subtotal_kobo, discount_kobo, total_kobo, promo_code_id, status, payment_reference,
    is_gift, recipient_name, recipient_email, gift_message, access_code,
    promoter_link_id
  ) VALUES (
    p_event_id, p_user_id, p_buyer_name, p_buyer_email, p_buyer_phone,
    v_computed_subtotal, v_computed_discount, v_computed_total, p_promo_code_id, 'paid', p_payment_reference,
    p_is_gift, p_recipient_name, p_recipient_email, p_gift_message, p_access_code,
    p_promoter_link_id
  ) RETURNING id INTO v_order_id;

  -- 6. Generate tickets and update counts
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_tickets) LOOP
    v_ticket_type_id := (v_item->>'ticketTypeId')::uuid;
    v_count := (v_item->>'count')::integer;

    SELECT * INTO v_ticket_type FROM public.ticket_types WHERE id = v_ticket_type_id;

    -- Update sold count
    UPDATE public.ticket_types 
    SET quantity_sold = quantity_sold + v_count 
    WHERE id = v_ticket_type_id;

    -- Insert order_item
    INSERT INTO public.order_items (
      order_id, ticket_type_id, quantity, unit_price_kobo
    ) VALUES (
      v_order_id, v_ticket_type_id, v_count, v_ticket_type.price_kobo
    ) RETURNING id INTO v_order_item_id;

    -- Insert tickets
    FOR i in 1..v_count LOOP
      INSERT INTO public.tickets (
        order_item_id, attendee_name, attendee_email, status
      ) VALUES (
        v_order_item_id, 
        coalesce(v_item->'attendee_names'->>(i-1), v_actual_recipient_name),
        v_actual_recipient_email,
        'valid'
      ) RETURNING id INTO v_new_ticket_id;
      
      v_ticket_ids := array_append(v_ticket_ids, v_new_ticket_id);
    END LOOP;
  END LOOP;

  -- 7. Create inbox messages
  
  -- Ticket delivery message to the actual recipient
  INSERT INTO public.messages (
    recipient_id, recipient_email, type, title, body, related_order_id, related_ticket_ids
  ) VALUES (
    CASE WHEN p_is_gift THEN null ELSE p_user_id END, 
    v_actual_recipient_email, 
    'ticket_delivery',
    CASE WHEN p_is_gift THEN 'You received a gift for ' || v_event.title || ' 🎁' ELSE 'Your tickets for ' || v_event.title || ' are ready 🎟️' END,
    CASE WHEN p_is_gift 
      THEN 'You received a gift from ' || p_buyer_name || '!' || coalesce(E'\n\n"' || p_gift_message || '"', '') || E'\n\nYour tickets for ' || v_event.title || ' are ready!' 
      ELSE 'Your tickets for ' || v_event.title || ' are ready!' 
    END || E'\n\nDate: ' || v_event.start_datetime::date || E'\nLocation: ' || coalesce(v_event.venue_name, 'Online') || E'\n\nClick the link below to view your tickets.',
    v_order_id, v_ticket_ids
  );

  -- Payment receipt message to the purchaser
  IF p_is_gift THEN
    INSERT INTO public.messages (
      recipient_id, recipient_email, type, title, body, related_order_id, related_ticket_ids
    ) VALUES (
      p_user_id, p_buyer_email, 'system',
      'Order Confirmation: ' || v_event.title,
      'Thank you for your purchase!' || E'\n\n' ||
      'You bought ' || array_length(v_ticket_ids, 1) || ' ticket(s) as a gift for ' || v_actual_recipient_name || ' (' || v_actual_recipient_email || ').' || E'\n\n' ||
      'Total Paid: ₦' || (v_computed_total / 100)::text || E'\n' ||
      'Payment Reference: ' || p_payment_reference,
      v_order_id, array[]::uuid[]
    );
  END IF;

  RETURN v_order_id;
END;
$$;
