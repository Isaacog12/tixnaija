-- ============================================================
-- AUDIT FIXES & ADMIN UNDO
-- ============================================================

-- 1. Organizer cannot delete an admin-cancelled event
DROP POLICY IF EXISTS "events_organizer_delete_own" ON public.events;

CREATE POLICY "events_organizer_delete_own" ON public.events
  FOR DELETE TO authenticated 
  USING (
    auth.uid() = organizer_id 
    AND admin_cancelled = false
  );


-- 2. Organizer cannot manage ticket types on an admin-cancelled event
DROP POLICY IF EXISTS "ticket_types_organizer_manage" ON public.ticket_types;

CREATE POLICY "ticket_types_organizer_manage" ON public.ticket_types
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.events e
    WHERE e.id = event_id 
      AND e.organizer_id = auth.uid() 
      AND e.admin_cancelled = false
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.events e
    WHERE e.id = event_id 
      AND e.organizer_id = auth.uid() 
      AND e.admin_cancelled = false
  ));


-- 3. Prevent issue_comp_tickets on admin-cancelled events
CREATE OR REPLACE FUNCTION public.issue_comp_tickets(
  p_event_id uuid,
  p_ticket_type_id uuid,
  p_recipients jsonb[]
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_order_id uuid;
  v_recipient jsonb;
  v_ticket_count integer := array_length(p_recipients, 1);
  v_ticket_type record;
  v_event record;
BEGIN
  -- Validate event is not admin cancelled
  SELECT * INTO v_event FROM public.events WHERE id = p_event_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Event not found'; END IF;
  IF v_event.admin_cancelled THEN
    RAISE EXCEPTION 'This event was cancelled by a platform admin and cannot issue tickets.';
  END IF;

  -- Validate ticket type exists and is for this event
  SELECT * INTO v_ticket_type
  FROM public.ticket_types
  WHERE id = p_ticket_type_id AND event_id = p_event_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ticket type not found';
  END IF;

  -- Create order with 'comp' status and 0 amount
  INSERT INTO public.orders (
    event_id,
    buyer_name,
    buyer_email,
    subtotal_kobo,
    discount_kobo,
    total_kobo,
    status,
    payment_reference
  ) VALUES (
    p_event_id,
    'Comp Issue - Organizer',
    'comp@tixnaija.local',
    0, 0, 0,
    'comp',
    'COMP_' || extract(epoch from now())::text
  ) RETURNING id INTO v_order_id;

  -- Create order item
  INSERT INTO public.order_items (
    order_id,
    ticket_type_id,
    quantity,
    unit_price_kobo
  ) VALUES (
    v_order_id,
    p_ticket_type_id,
    v_ticket_count,
    0
  );

  -- Update quantity sold
  UPDATE public.ticket_types
  SET quantity_sold = quantity_sold + v_ticket_count
  WHERE id = p_ticket_type_id;

  -- Generate tickets and messages
  FOREACH v_recipient IN ARRAY p_recipients
  LOOP
    -- Insert ticket
    INSERT INTO public.tickets (
      order_item_id,
      ticket_code,
      attendee_name,
      attendee_email,
      status
    ) VALUES (
      (SELECT id FROM public.order_items WHERE order_id = v_order_id LIMIT 1),
      gen_random_uuid(),
      v_recipient->>'name',
      v_recipient->>'email',
      'valid'
    );

    -- Insert inbox message
    INSERT INTO public.messages (
      recipient_email,
      type,
      title,
      body,
      related_order_id
    ) VALUES (
      v_recipient->>'email',
      'ticket_delivery',
      'Your Complimentary Ticket',
      'You have been issued a complimentary ticket to ' || v_event.title || '. Go to your orders to view and download your ticket QR code.',
      v_order_id
    );
  END LOOP;

  RETURN v_order_id;
END;
$$;


-- 4. Prevent checkout on cancelled events
CREATE OR REPLACE FUNCTION public.process_checkout(
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
    is_gift, recipient_name, recipient_email, gift_message, access_code
  ) VALUES (
    p_event_id, p_user_id, p_buyer_name, p_buyer_email, p_buyer_phone,
    v_computed_subtotal, v_computed_discount, v_computed_total, p_promo_code_id, 'paid', p_payment_reference,
    p_is_gift, p_recipient_name, p_recipient_email, p_gift_message, p_access_code
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


-- 5. Admin can undo a cancelled event
CREATE OR REPLACE FUNCTION public.admin_undo_cancel_event(
  p_event_id uuid,
  p_note text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event record;
  v_caller uuid := auth.uid();
BEGIN
  -- Caller must be an admin
  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = v_caller AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Unauthorized: admin access required';
  END IF;

  SELECT * INTO v_event FROM public.events WHERE id = p_event_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Event not found'; END IF;
  
  IF NOT v_event.admin_cancelled THEN 
    RAISE EXCEPTION 'Event was not cancelled by an admin.'; 
  END IF;

  UPDATE public.events
  SET status          = 'published',
      cancelled_at    = null,
      admin_cancelled = false,
      organizer_note  = COALESCE(p_note, 'Platform admin has restored this event.')
  WHERE id = p_event_id;
END;
$$;
