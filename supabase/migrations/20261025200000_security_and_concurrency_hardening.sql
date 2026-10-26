-- ============================================================
-- Migration: 20261025200000_security_and_concurrency_hardening.sql
-- Description:
--   1. Add FOR UPDATE inventory row lock & scope checks to process_checkout
--   2. Restrict process_checkout execution strictly to service_role
--   3. Create secure process_free_checkout RPC for anon & authenticated
--   4. Strengthen get_guest_orders with access code validation & rate limiting
-- ============================================================

-- 1. Hardened process_checkout (Callable ONLY by service_role)
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
  p_promoter_link_id uuid default null,
  p_checkout_answers jsonb default null
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
  -- 1. Validate Event Status
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

  IF v_event.end_datetime IS NOT NULL AND v_event.end_datetime < now() THEN
    RAISE EXCEPTION 'This event has ended. Tickets are no longer available for purchase.';
  END IF;

  -- 2. Concurrency Row Lock & Inventory Validation
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_tickets)
  LOOP
    v_ticket_type_id := (v_item->>'ticketTypeId')::uuid;
    v_count := (v_item->>'count')::integer;

    IF v_count IS NULL OR v_count <= 0 THEN
      RAISE EXCEPTION 'Ticket count must be a positive integer';
    END IF;

    -- Lock the ticket type row to prevent concurrent overselling races
    SELECT * INTO v_ticket_type
    FROM public.ticket_types
    WHERE id = v_ticket_type_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Ticket type % not found', v_ticket_type_id;
    END IF;

    -- Enforce that ticket belongs strictly to p_event_id
    IF v_ticket_type.event_id != p_event_id THEN
      RAISE EXCEPTION 'Ticket type % does not belong to event %', v_ticket_type_id, p_event_id;
    END IF;

    IF (v_ticket_type.quantity_available - v_ticket_type.quantity_sold) < v_count THEN
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

  v_computed_total := greatest(0, v_computed_subtotal - v_computed_discount);

  -- 4. Verify payment amounts match
  IF p_amount_paid < v_computed_total THEN
    RAISE EXCEPTION 'Payment mismatch: expected at least %, got %', v_computed_total, p_amount_paid;
  END IF;

  -- Validate promoter link if provided
  IF p_promoter_link_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.promoter_links
      WHERE id = p_promoter_link_id
        AND event_id = p_event_id
        AND active = true
    ) THEN
      p_promoter_link_id := NULL;
    END IF;
  END IF;

  -- Determine final recipient info
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
    promoter_link_id, checkout_answers
  ) VALUES (
    p_event_id, p_user_id, p_buyer_name, p_buyer_email, p_buyer_phone,
    v_computed_subtotal, v_computed_discount, v_computed_total, p_promo_code_id, 'paid', p_payment_reference,
    p_is_gift, p_recipient_name, p_recipient_email, p_gift_message, p_access_code,
    p_promoter_link_id, p_checkout_answers
  ) RETURNING id INTO v_order_id;

  -- 6. Generate tickets and update sold counts
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
        order_item_id, attendee_name, attendee_email, status, checkout_answers
      ) VALUES (
        v_order_item_id, 
        coalesce(v_item->'attendee_names'->>(i-1), v_actual_recipient_name),
        coalesce(v_item->'attendee_emails'->>(i-1), v_actual_recipient_email),
        'valid',
        v_item->'answers'
      ) RETURNING id INTO v_new_ticket_id;
      
      v_ticket_ids := array_append(v_ticket_ids, v_new_ticket_id);
    END LOOP;
  END LOOP;

  -- 7. Create inbox messages
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

-- 2. Restrict process_checkout permissions strictly to service_role
REVOKE ALL ON FUNCTION public.process_checkout FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_checkout TO service_role;


-- 3. Create process_free_checkout RPC for genuine 100% free registrations
CREATE OR REPLACE FUNCTION public.process_free_checkout(
  p_event_id uuid,
  p_user_id uuid,
  p_buyer_name text,
  p_buyer_email text,
  p_buyer_phone text,
  p_tickets jsonb,
  p_promo_code_id uuid default null,
  p_is_gift boolean default false,
  p_recipient_name text default null,
  p_recipient_email text default null,
  p_gift_message text default null,
  p_access_code text default null,
  p_promoter_link_id uuid default null,
  p_checkout_answers jsonb default null
) returns uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_computed_subtotal integer := 0;
  v_computed_discount integer := 0;
  v_computed_total integer := 0;
  v_promo record;
  v_item jsonb;
  v_ticket_type record;
  v_ticket_type_id uuid;
  v_count integer;
  v_free_reference text;
  v_actual_user_id uuid;
BEGIN
  -- Prevent caller from spoofing user_id: bind strictly to auth.uid()
  IF auth.uid() IS NOT NULL THEN
    v_actual_user_id := auth.uid();
  ELSE
    v_actual_user_id := NULL;
  END IF;

  -- Validate that items calculate to 0
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_tickets)
  LOOP
    v_ticket_type_id := (v_item->>'ticketTypeId')::uuid;
    v_count := (v_item->>'count')::integer;

    IF v_count IS NULL OR v_count <= 0 THEN
      RAISE EXCEPTION 'Ticket count must be a positive integer';
    END IF;

    SELECT price_kobo, event_id INTO v_ticket_type
    FROM public.ticket_types
    WHERE id = v_ticket_type_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Ticket type % not found', v_ticket_type_id;
    END IF;

    IF v_ticket_type.event_id != p_event_id THEN
      RAISE EXCEPTION 'Ticket type does not belong to this event';
    END IF;

    v_computed_subtotal := v_computed_subtotal + (v_ticket_type.price_kobo * v_count);
  END LOOP;

  IF p_promo_code_id IS NOT NULL THEN
    SELECT discount_type, discount_value INTO v_promo
    FROM public.promo_codes
    WHERE id = p_promo_code_id
      AND event_id = p_event_id
      AND active = true
      AND (expires_at IS NULL OR expires_at > now())
      AND (max_uses IS NULL OR times_used < max_uses);

    IF FOUND THEN
      IF v_promo.discount_type = 'percent' THEN
        v_computed_discount := (v_computed_subtotal * v_promo.discount_value) / 100;
      ELSE
        v_computed_discount := v_promo.discount_value;
      END IF;
    END IF;
  END IF;

  v_computed_total := greatest(0, v_computed_subtotal - v_computed_discount);

  -- STRICT SECURITY GUARD:
  -- Any order with a computed total above 0 MUST go through Paystack gateway verification!
  IF v_computed_total > 0 THEN
    RAISE EXCEPTION 'Security error: Paid orders must be processed and verified through the payment gateway.';
  END IF;

  v_free_reference := 'FREE_' || floor(extract(epoch from now()) * 1000)::text || '_' || substr(md5(random()::text), 1, 8);

  -- Call the internal process_checkout function
  RETURN public.process_checkout(
    p_event_id,
    v_actual_user_id,
    p_buyer_name,
    p_buyer_email,
    p_buyer_phone,
    p_tickets,
    0,
    v_free_reference,
    p_promo_code_id,
    p_is_gift,
    p_recipient_name,
    p_recipient_email,
    p_gift_message,
    p_access_code,
    p_promoter_link_id,
    p_checkout_answers
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.process_free_checkout TO anon, authenticated, service_role;


-- 4. Secure Guest Orders Lookup with Mandatory Access Code and Rate Limiting
DROP FUNCTION IF EXISTS public.get_guest_orders(text);
DROP FUNCTION IF EXISTS public.get_guest_orders(text, text);

CREATE OR REPLACE FUNCTION public.get_guest_orders(
  p_email text,
  p_access_code text
) returns table (
  id uuid,
  event_id uuid,
  buyer_name text,
  buyer_email text,
  total_kobo bigint,
  status text,
  created_at timestamptz,
  event_title text,
  event_slug text,
  event_city text,
  event_cover text,
  event_start timestamptz
)
language plpgsql security definer
set search_path = public
as $$
declare
  v_ip_address text;
  v_attempt_count integer;
  v_headers json;
begin
  -- Access code is strictly mandatory to prevent email-only enumeration
  if p_email is null or trim(p_email) = '' or p_access_code is null or trim(p_access_code) = '' then
    raise exception 'Both email and access code are required to view guest orders.';
  end if;

  -- 1. Extract IP address from request headers
  begin
    v_headers := current_setting('request.headers', true)::json;
    v_ip_address := v_headers->>'x-forwarded-for';
  exception when others then
    v_ip_address := 'unknown';
  end;

  if v_ip_address is null then
    v_ip_address := 'unknown';
  end if;
  v_ip_address := split_part(v_ip_address, ',', 1);

  -- 2. Log attempt in rate_limit_log
  insert into public.rate_limit_log (ip_address, endpoint)
  values (v_ip_address, 'get_guest_orders');

  -- 3. Enforce rate limit: max 5 attempts per 10 minutes per IP
  select count(*) into v_attempt_count
  from public.rate_limit_log
  where ip_address = v_ip_address
    and endpoint = 'get_guest_orders'
    and created_at > now() - interval '10 minutes';

  if v_attempt_count > 5 then
    raise exception 'Too many lookup attempts. Please wait 10 minutes and try again.';
  end if;

  return query
    select
      o.id,
      o.event_id,
      o.buyer_name,
      o.buyer_email,
      o.total_kobo,
      o.status::text,
      o.created_at,
      e.title as event_title,
      e.slug as event_slug,
      e.city as event_city,
      e.cover_image_url as event_cover,
      e.start_datetime as event_start
    from public.orders o
    join public.events e on o.event_id = e.id
    where lower(o.buyer_email) = lower(trim(p_email))
      and o.status IN ('paid', 'comp')
      and (
        o.access_code = trim(p_access_code)
        or o.payment_reference = trim(p_access_code)
      )
    order by o.created_at desc
    limit 20;
end;
$$;

GRANT EXECUTE ON FUNCTION public.get_guest_orders(text, text) TO anon, authenticated, service_role;


-- 5. Secure get_guest_order_full: Drop email-only overload and require access_code
DROP FUNCTION IF EXISTS public.get_guest_order_full(uuid, text);
DROP FUNCTION IF EXISTS public.get_guest_order_full(uuid, text, text);

CREATE OR REPLACE FUNCTION public.get_guest_order_full(
  p_order_id uuid,
  p_email text,
  p_access_code text
) returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  v_ip_address text;
  v_attempt_count integer;
  v_headers json;
  v_result jsonb;
begin
  if p_email is null or trim(p_email) = '' or p_access_code is null or trim(p_access_code) = '' then
    raise exception 'Both email and access code are required.';
  end if;

  -- Extract IP address
  begin
    v_headers := current_setting('request.headers', true)::json;
    v_ip_address := v_headers->>'x-forwarded-for';
  exception when others then
    v_ip_address := 'unknown';
  end;

  if v_ip_address is null then
    v_ip_address := 'unknown';
  end if;
  v_ip_address := split_part(v_ip_address, ',', 1);

  -- Log attempt
  insert into public.rate_limit_log (ip_address, endpoint)
  values (v_ip_address, 'get_guest_order_full');

  -- Rate limit check
  select count(*) into v_attempt_count
  from public.rate_limit_log
  where ip_address = v_ip_address
    and endpoint = 'get_guest_order_full'
    and created_at > now() - interval '10 minutes';

  if v_attempt_count > 5 then
    raise exception 'Too many ticket lookup attempts. Please wait 10 minutes.';
  end if;

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
        'access_code', o.access_code,
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
  ) into v_result
  from orders o
  where o.id = p_order_id
    and (lower(o.buyer_email) = lower(trim(p_email)) or lower(coalesce(o.recipient_email, '')) = lower(trim(p_email)))
    and (o.access_code = trim(p_access_code) or o.payment_reference = trim(p_access_code))
    and o.status IN ('paid', 'comp');

  if v_result is null then
    raise exception 'Order not found or invalid access credentials.';
  end if;

  return v_result;
end;
$$;

GRANT EXECUTE ON FUNCTION public.get_guest_order_full(uuid, text, text) TO anon, authenticated, service_role;


-- 6. Allow Admins to Scan Tickets in check_in_ticket
CREATE OR REPLACE FUNCTION public.check_in_ticket(p_ticket_code text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_ticket_id uuid;
    v_status public.ticket_status;
    v_checked_in_at timestamp with time zone;
    v_organizer_id uuid;
    v_attendee_name text;
    v_ticket_name text;
    v_caller_uid uuid;
    v_is_admin boolean := false;
BEGIN
    v_caller_uid := auth.uid();
    
    IF v_caller_uid IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Not authenticated');
    END IF;

    -- Lookup ticket details along with event organizer_id
    SELECT 
        t.id, t.status, t.checked_in_at, t.attendee_name, e.organizer_id, tt.name
    INTO 
        v_ticket_id, v_status, v_checked_in_at, v_attendee_name, v_organizer_id, v_ticket_name
    FROM public.tickets t
    JOIN public.order_items oi ON oi.id = t.order_item_id
    JOIN public.ticket_types tt ON tt.id = oi.ticket_type_id
    JOIN public.events e ON e.id = tt.event_id
    WHERE t.ticket_code = p_ticket_code::uuid
    FOR UPDATE OF t;

    -- If ticket doesn't exist
    IF v_ticket_id IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Invalid ticket code');
    END IF;

    -- Check if caller is admin
    SELECT EXISTS (
        SELECT 1 FROM public.user_roles WHERE user_id = v_caller_uid AND role = 'admin'
    ) INTO v_is_admin;

    -- Ensure caller is organizer or admin
    IF v_caller_uid != v_organizer_id AND NOT v_is_admin THEN
        RETURN json_build_object('success', false, 'error', 'Unauthorized: You are not the organizer of this event or an admin');
    END IF;

    -- Check current status
    IF v_status = 'cancelled' THEN
        RETURN json_build_object('success', false, 'error', 'This ticket has been cancelled');
    END IF;

    IF v_status = 'checked_in' THEN
        RETURN json_build_object(
            'success', true, 
            'already_checked_in', true, 
            'checked_in_at', v_checked_in_at,
            'attendee_name', v_attendee_name,
            'ticket_name', v_ticket_name
        );
    END IF;

    -- Valid and unused -> Check in!
    UPDATE public.tickets
    SET 
        status = 'checked_in',
        checked_in_at = now(),
        checked_in_by = v_caller_uid
    WHERE id = v_ticket_id AND status != 'checked_in';

    RETURN json_build_object(
        'success', true, 
        'already_checked_in', false,
        'checked_in_at', now(),
        'attendee_name', v_attendee_name,
        'ticket_name', v_ticket_name
    );
EXCEPTION WHEN invalid_text_representation THEN
    RETURN json_build_object('success', false, 'error', 'Invalid ticket code format');
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_in_ticket(text) TO authenticated;

