-- Migration: Fix function right(uuid, integer) does not exist by casting ticket_code to text in support RPCs

-- 1. Fix support_lookup_customer
CREATE OR REPLACE FUNCTION public.support_lookup_customer(p_query TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor UUID := private.assert_support_staff();
  v_actor_email TEXT;
  v_clean_query TEXT;
  v_escaped_name_prefix TEXT;
  v_recent_searches_min INT;
  v_recent_searches_day INT;
  v_normalized_phone TEXT;
  v_result JSONB;
BEGIN
  v_clean_query := trim(p_query);
  IF length(v_clean_query) < 3 THEN
    RAISE EXCEPTION 'Query must be at least 3 characters long';
  END IF;

  -- 1. Rate Limits: Max 30 lookups / min, max 200 lookups / day per agent
  SELECT COUNT(*) INTO v_recent_searches_min
  FROM public.support_audit_logs
  WHERE actor_id = v_actor AND action = 'lookup_customer' AND created_at > (now() - INTERVAL '1 minute');

  IF v_recent_searches_min >= 30 THEN
    RAISE EXCEPTION 'Lookup rate limit exceeded: maximum 30 searches per minute';
  END IF;

  SELECT COUNT(*) INTO v_recent_searches_day
  FROM public.support_audit_logs
  WHERE actor_id = v_actor AND action = 'lookup_customer' AND created_at > (now() - INTERVAL '24 hours');

  IF v_recent_searches_day >= 200 THEN
    RAISE EXCEPTION 'Daily lookup quota reached: maximum 200 customer searches per day';
  END IF;

  -- 2. Normalize Nigerian phone numbers to standard format (+234...)
  v_normalized_phone := v_clean_query;
  IF v_normalized_phone ~ '^0[789][01]\d{8}$' THEN
    v_normalized_phone := '+234' || substring(v_normalized_phone from 2);
  END IF;

  -- 3. Escape wildcard characters for name prefix search
  v_escaped_name_prefix := replace(replace(replace(v_clean_query, '\', '\\'), '%', '\%'), '_', '\_');

  -- 4. Atomic Audit Log
  SELECT email INTO v_actor_email FROM auth.users WHERE id = v_actor;
  INSERT INTO public.support_audit_logs (actor_id, actor_email, action, target_type, target_id, details)
  VALUES (v_actor, v_actor_email, 'lookup_customer', 'query', v_clean_query, jsonb_build_object('query', v_clean_query));

  -- 5. Subquery-wrapped LIMIT 10 Aggregation
  -- Full contact details returned ONLY for exact email/phone match. Name prefix returns masked contact info.
  SELECT jsonb_build_object(
    'customers', COALESCE((
      SELECT jsonb_agg(s.x) FROM (
        SELECT jsonb_build_object(
          'id', p.id,
          'full_name', p.full_name,
          'email', CASE 
            WHEN uc.email = lower(v_clean_query) THEN uc.email 
            ELSE regexp_replace(uc.email, '(?<=.).(?=.*@)', '*', 'g') 
          END,
          'phone_number', CASE 
            WHEN uc.phone_number = v_clean_query OR uc.phone_number = v_normalized_phone THEN uc.phone_number 
            ELSE '••••••••' || RIGHT(COALESCE(uc.phone_number::text, '0000'), 4)
          END,
          'created_at', p.created_at
        ) AS x
        FROM public.profiles p
        JOIN public.user_contacts uc ON uc.user_id = p.id
        WHERE uc.email = lower(v_clean_query)                           -- EXACT MATCH
           OR uc.phone_number = v_clean_query                          -- EXACT MATCH
           OR uc.phone_number = v_normalized_phone                     -- EXACT MATCH
           OR p.full_name ILIKE v_escaped_name_prefix || '%'           -- Prefix Match
        ORDER BY p.created_at DESC
        LIMIT 10
      ) s
    ), '[]'::jsonb),
    'orders', COALESCE((
      SELECT jsonb_agg(s.x) FROM (
        SELECT jsonb_build_object(
          'id', o.id,
          'payment_reference', o.payment_reference,
          'buyer_name', o.buyer_name,
          'buyer_email', o.buyer_email,
          'total_kobo', o.total_kobo,
          'status', o.status,
          'created_at', o.created_at
        ) AS x
        FROM public.orders o
        WHERE o.payment_reference = v_clean_query                      -- EXACT MATCH
           OR lower(o.buyer_email) = lower(v_clean_query)              -- EXACT MATCH
           OR o.buyer_phone = v_clean_query                            -- EXACT MATCH
           OR o.buyer_phone = v_normalized_phone                       -- EXACT MATCH
        ORDER BY o.created_at DESC
        LIMIT 10
      ) s
    ), '[]'::jsonb),
    'tickets', COALESCE((
      SELECT jsonb_agg(s.x) FROM (
        SELECT jsonb_build_object(
          'id', t.id,
          'masked_code', '••••-••••-' || RIGHT(t.ticket_code::text, 4),
          'status', t.status,
          'attendee_name', t.attendee_name,
          'attendee_email', t.attendee_email,
          'order_id', oi.order_id
        ) AS x
        FROM public.tickets t
        JOIN public.order_items oi ON oi.id = t.order_item_id
        WHERE t.ticket_code::text = v_clean_query                      -- Safe TEXT MATCH
        ORDER BY t.created_at DESC
        LIMIT 10
      ) s
    ), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.support_lookup_customer(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.support_lookup_customer(text) TO authenticated;

-- 2. Fix support_get_order_details
CREATE OR REPLACE FUNCTION public.support_get_order_details(p_order_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor UUID := private.assert_support_staff();
  v_actor_email TEXT;
  v_result JSONB;
BEGIN
  SELECT email INTO v_actor_email FROM auth.users WHERE id = v_actor;
  INSERT INTO public.support_audit_logs (actor_id, actor_email, action, target_type, target_id, details)
  VALUES (v_actor, v_actor_email, 'view_order', 'order', p_order_id::text, jsonb_build_object('order_id', p_order_id));

  SELECT jsonb_build_object(
    'order', (
      SELECT jsonb_build_object(
        'id', o.id,
        'payment_reference', o.payment_reference,
        'buyer_name', o.buyer_name,
        'buyer_email', o.buyer_email,
        'buyer_phone', o.buyer_phone,
        'total_kobo', o.total_kobo,
        'subtotal_kobo', o.subtotal_kobo,
        'discount_kobo', o.discount_kobo,
        'status', o.status,
        'event_id', o.event_id,
        'created_at', o.created_at,
        'updated_at', o.updated_at
      )
      FROM public.orders o WHERE o.id = p_order_id
    ),
    'tickets', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', t.id,
        'ticket_type_name', tt.name,
        'attendee_name', t.attendee_name,
        'attendee_email', t.attendee_email,
        'status', t.status,
        'checked_in_at', t.checked_in_at,
        'checked_in_by', t.checked_in_by,
        'masked_code', '••••-••••-' || RIGHT(t.ticket_code::text, 4)
      ))
      FROM public.tickets t
      JOIN public.order_items oi ON oi.id = t.order_item_id
      JOIN public.ticket_types tt ON tt.id = oi.ticket_type_id
      WHERE oi.order_id = p_order_id
    ), '[]'::jsonb),
    'delivery_log', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', eo.id,
          'recipient_email', eo.recipient_email,
          'template', eo.template,
          'status', eo.status,
          'retry_count', eo.retry_count,
          'created_at', eo.created_at,
          'sent_at', eo.sent_at
        ) 
        ORDER BY eo.created_at DESC
      )
      FROM public.email_outbox eo
      WHERE eo.order_id = p_order_id
    ), '[]'::jsonb),
    'notes', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', n.id,
          'note', n.note,
          'author_name', p.full_name,
          'created_at', n.created_at
        )
        ORDER BY n.created_at DESC
      )
      FROM public.support_notes n
      LEFT JOIN public.profiles p ON p.id = n.author_id
      WHERE n.target_type = 'order' AND n.target_id = p_order_id::text
    ), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.support_get_order_details(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.support_get_order_details(uuid) TO authenticated;

-- 3. Fix admin_approve_recipient_change ticket_code rotation to use valid gen_random_uuid()
CREATE OR REPLACE FUNCTION public.admin_approve_recipient_change(p_request_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor UUID := private.assert_admin();
  v_actor_email TEXT;
  v_req RECORD;
  v_any_scanned BOOLEAN := FALSE;
  v_t RECORD;
BEGIN
  SELECT email INTO v_actor_email FROM auth.users WHERE id = v_actor;

  SELECT * INTO v_req
  FROM public.email_change_requests
  WHERE id = p_request_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Request not found';
  END IF;

  IF v_req.status != 'pending' THEN
    RAISE EXCEPTION 'Request is already in status: %', v_req.status;
  END IF;

  IF v_req.target_type = 'order' THEN
    SELECT EXISTS (
      SELECT 1 FROM public.tickets t
      JOIN public.order_items oi ON oi.id = t.order_item_id
      WHERE oi.order_id = v_req.order_id AND t.checked_in_at IS NOT NULL
    ) INTO v_any_scanned;

    IF v_any_scanned THEN
      RAISE EXCEPTION 'Cannot change recipient: One or more tickets for this order have already been checked in';
    END IF;

    -- Invalidate old QR codes by rotating ticket_code to a fresh UUID
    UPDATE public.tickets
    SET ticket_code = gen_random_uuid(),
        attendee_email = v_req.new_email
    WHERE order_item_id IN (
      SELECT id FROM public.order_items WHERE order_id = v_req.order_id
    );

    UPDATE public.orders SET buyer_email = v_req.new_email, updated_at = now() WHERE id = v_req.order_id;

    -- Queue reissued tickets to the new recipient
    FOR v_t IN (
      SELECT t.id, t.ticket_code, t.attendee_name, tt.name AS ticket_type_name, e.title AS event_title, e.start_datetime, e.venue_name
      FROM public.tickets t
      JOIN public.order_items oi ON oi.id = t.order_item_id
      JOIN public.ticket_types tt ON tt.id = oi.ticket_type_id
      JOIN public.events e ON e.id = oi.event_id
      WHERE oi.order_id = v_req.order_id
    ) LOOP
      INSERT INTO public.email_outbox (recipient_email, template, payload, order_id, ticket_id)
      VALUES (
        v_req.new_email,
        'ticket_reissued',
        jsonb_build_object(
          'ticket_id', v_t.id,
          'ticket_code', v_t.ticket_code,
          'attendee_name', v_t.attendee_name,
          'ticket_type', v_t.ticket_type_name,
          'event_title', v_t.event_title,
          'start_datetime', v_t.start_datetime,
          'venue_name', v_t.venue_name
        ),
        v_req.order_id,
        v_t.id
      );
    END LOOP;

  ELSIF v_req.target_type = 'ticket' THEN
    SELECT (checked_in_at IS NOT NULL) INTO v_any_scanned
    FROM public.tickets WHERE id = v_req.ticket_id;

    IF v_any_scanned THEN
      RAISE EXCEPTION 'Cannot change recipient: Ticket has already been checked in';
    END IF;

    UPDATE public.tickets
    SET ticket_code = gen_random_uuid(),
        attendee_email = v_req.new_email
    WHERE id = v_req.ticket_id;

    SELECT t.id, t.ticket_code, t.attendee_name, tt.name AS ticket_type_name, e.title AS event_title, e.start_datetime, e.venue_name, oi.order_id
    INTO v_t
    FROM public.tickets t
    JOIN public.order_items oi ON oi.id = t.order_item_id
    JOIN public.ticket_types tt ON tt.id = oi.ticket_type_id
    JOIN public.events e ON e.id = oi.event_id
    WHERE t.id = v_req.ticket_id;

    INSERT INTO public.email_outbox (recipient_email, template, payload, order_id, ticket_id)
    VALUES (
      v_req.new_email,
      'ticket_reissued',
      jsonb_build_object(
        'ticket_id', v_t.id,
        'ticket_code', v_t.ticket_code,
        'attendee_name', v_t.attendee_name,
        'ticket_type', v_t.ticket_type_name,
        'event_title', v_t.event_title,
        'start_datetime', v_t.start_datetime,
        'venue_name', v_t.venue_name
      ),
      v_t.order_id,
      v_t.id
    );
  END IF;

  UPDATE public.email_change_requests
  SET status = 'approved',
      reviewed_by = v_actor,
      reviewed_at = now()
  WHERE id = p_request_id;

  INSERT INTO public.support_audit_logs (actor_id, actor_email, action, target_type, target_id, details)
  VALUES (v_actor, v_actor_email, 'approve_recipient_change', 'email_change_request', p_request_id::text, jsonb_build_object('request_id', p_request_id, 'new_email', v_req.new_email));

  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_approve_recipient_change(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_approve_recipient_change(uuid) TO authenticated;
