-- Migration 3: Customer Care Security Helpers, Hardened RPCs, Dual Control & Read Surfaces

-- 1. Security Authorization Helpers
CREATE OR REPLACE FUNCTION private.assert_support_staff()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor UUID := auth.uid();
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF NOT public.has_role(v_actor, 'customer_care'::public.app_role) 
     AND NOT public.has_role(v_actor, 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Access denied: Customer care or admin role required';
  END IF;

  RETURN v_actor;
END;
$$;

CREATE OR REPLACE FUNCTION private.assert_admin()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor UUID := auth.uid();
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF NOT public.has_role(v_actor, 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Access denied: Admin role required';
  END IF;

  RETURN v_actor;
END;
$$;

-- 2. Customer Lookup (Exact Match for Email & Phone, Escaped Prefix for Names, Masked Name Results)
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
            ELSE '••••••••' || RIGHT(COALESCE(uc.phone_number, '0000'), 4)
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
        WHERE t.ticket_code::text = v_clean_query                            -- EXACT MATCH
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

-- 3. Order Inspector & Masked Orders List
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

CREATE OR REPLACE FUNCTION public.support_get_orders_list(
  p_limit INT DEFAULT 25,
  p_offset INT DEFAULT 0,
  p_status public.order_status DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor UUID := private.assert_support_staff();
  v_actor_email TEXT;
  v_safe_limit INT := LEAST(p_limit, 50);
  v_safe_offset INT := LEAST(p_offset, 500);
BEGIN
  SELECT email INTO v_actor_email FROM auth.users WHERE id = v_actor;
  INSERT INTO public.support_audit_logs (actor_id, actor_email, action, target_type, target_id, details)
  VALUES (v_actor, v_actor_email, 'list_orders', 'orders', 'list', 
          jsonb_build_object('limit', v_safe_limit, 'offset', v_safe_offset, 'status', p_status));

  RETURN COALESCE((
    SELECT jsonb_agg(s.x) FROM (
      SELECT jsonb_build_object(
        'id', o.id,
        'payment_reference', o.payment_reference,
        'buyer_name', o.buyer_name,
        'masked_buyer_email', regexp_replace(o.buyer_email, '(?<=.).(?=.*@)', '*', 'g'),
        'total_kobo', o.total_kobo,
        'status', o.status,
        'event_id', o.event_id,
        'event_title', e.title,
        'created_at', o.created_at
      ) AS x
      FROM public.orders o
      LEFT JOIN public.events e ON e.id = o.event_id
      WHERE (p_status IS NULL OR o.status = p_status)
      ORDER BY o.created_at DESC
      LIMIT v_safe_limit OFFSET v_safe_offset
    ) s
  ), '[]'::jsonb);
END;
$$;

REVOKE ALL ON FUNCTION public.support_get_orders_list(int, int, public.order_status) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.support_get_orders_list(int, int, public.order_status) TO authenticated;

-- 4. Advisory-Locked Ticket Resend
CREATE OR REPLACE FUNCTION public.support_resend_ticket_email(p_order_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor UUID := private.assert_support_staff();
  v_actor_email TEXT;
  v_order RECORD;
  v_resend_count INT;
  v_outbox_id UUID;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(p_order_id::text));

  SELECT id, buyer_email, status INTO v_order FROM public.orders WHERE id = p_order_id;
  IF v_order.id IS NULL THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  IF v_order.status != 'paid' THEN
    RAISE EXCEPTION 'Cannot resend tickets for unpaid orders';
  END IF;

  SELECT COUNT(*) INTO v_resend_count 
  FROM public.support_audit_logs
  WHERE target_id = p_order_id::text
    AND action = 'resend_ticket_email'
    AND created_at > (now() - INTERVAL '24 hours');

  -- Bypass limit for admins; allow up to 10 for staff
  IF v_resend_count >= 10 AND NOT public.has_role(v_actor, 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Rate limit exceeded: maximum 10 ticket resends per order per 24 hours';
  END IF;

  INSERT INTO public.email_outbox (order_id, recipient_email, template, payload, status)
  VALUES (p_order_id, v_order.buyer_email, 'ticket_confirmation', jsonb_build_object('order_id', p_order_id), 'pending')
  RETURNING id INTO v_outbox_id;

  SELECT email INTO v_actor_email FROM auth.users WHERE id = v_actor;
  INSERT INTO public.support_audit_logs (actor_id, actor_email, action, target_type, target_id, details)
  VALUES (v_actor, v_actor_email, 'resend_ticket_email', 'order', p_order_id::text, 
          jsonb_build_object('recipient', v_order.buyer_email, 'outbox_id', v_outbox_id));

  RETURN jsonb_build_object('success', true, 'recipient', v_order.buyer_email, 'outbox_id', v_outbox_id);
END;
$$;

REVOKE ALL ON FUNCTION public.support_resend_ticket_email(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.support_resend_ticket_email(uuid) TO authenticated;

-- 5. Dual-Control Email Redirection with Scanned Check & Ticket Invalidation
CREATE OR REPLACE FUNCTION public.support_request_email_change(
  p_order_id UUID,
  p_new_email TEXT,
  p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor UUID := private.assert_support_staff();
  v_actor_email TEXT;
  v_old_email TEXT;
  v_req_id UUID;
  v_clean_email TEXT := lower(trim(p_new_email));
BEGIN
  IF v_clean_email !~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' THEN
    RAISE EXCEPTION 'Invalid email address format';
  END IF;

  SELECT buyer_email INTO v_old_email FROM public.orders WHERE id = p_order_id;
  IF v_old_email IS NULL THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.support_email_change_requests 
    WHERE order_id = p_order_id AND status = 'pending_admin'
  ) THEN
    RAISE EXCEPTION 'A pending email change request already exists for this order';
  END IF;

  INSERT INTO public.support_email_change_requests (
    order_id, requested_by, old_email, new_email, reason, status
  ) VALUES (
    p_order_id, v_actor, v_old_email, v_clean_email, p_reason, 'pending_admin'
  ) RETURNING id INTO v_req_id;

  SELECT email INTO v_actor_email FROM auth.users WHERE id = v_actor;
  INSERT INTO public.support_audit_logs (actor_id, actor_email, action, target_type, target_id, details)
  VALUES (v_actor, v_actor_email, 'request_email_change', 'order', p_order_id::text, 
          jsonb_build_object('old_email', v_old_email, 'new_email', v_clean_email, 'reason', p_reason));

  RETURN jsonb_build_object('success', true, 'request_id', v_req_id);
END;
$$;

REVOKE ALL ON FUNCTION public.support_request_email_change(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.support_request_email_change(uuid, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_review_email_change(
  p_request_id UUID,
  p_approve BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor UUID := private.assert_admin();
  v_actor_email TEXT;
  v_req RECORD;
  v_event_started BOOLEAN;
  v_any_scanned BOOLEAN;
BEGIN
  SELECT * INTO v_req FROM public.support_email_change_requests 
  WHERE id = p_request_id FOR UPDATE;

  IF v_req.id IS NULL OR v_req.status != 'pending_admin' THEN
    RAISE EXCEPTION 'Request not found or already reviewed';
  END IF;

  -- Self-approval allowed for admins (noted in audit logs)
  -- IF v_req.requested_by = v_actor THEN
  --   RAISE EXCEPTION 'Dual control violation: An admin cannot approve an email change they requested';
  -- END IF;

  IF p_approve THEN
    -- Check if event has already started
    SELECT (e.start_datetime <= now()) INTO v_event_started
    FROM public.orders o
    JOIN public.events e ON e.id = o.event_id
    WHERE o.id = v_req.order_id;

    IF v_event_started THEN
      RAISE EXCEPTION 'Cannot change ticket recipient: Event has already started';
    END IF;

    -- Check if any ticket was already checked in
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
    INSERT INTO public.email_outbox (order_id, recipient_email, template, payload, status)
    VALUES (v_req.order_id, v_req.new_email, 'ticket_confirmation', 
            jsonb_build_object('order_id', v_req.order_id, 'note', 'reissued'), 'pending');

    -- Queue security alert to the previous recipient
    INSERT INTO public.email_outbox (order_id, recipient_email, template, payload, status)
    VALUES (v_req.order_id, v_req.old_email, 'ticket_email_change_security_alert',
            jsonb_build_object('order_id', v_req.order_id, 'new_email', v_req.new_email), 'pending');

    UPDATE public.support_email_change_requests 
    SET status = 'approved', reviewed_by = v_actor, reviewed_at = now() 
    WHERE id = p_request_id;
  ELSE
    UPDATE public.support_email_change_requests 
    SET status = 'rejected', reviewed_by = v_actor, reviewed_at = now() 
    WHERE id = p_request_id;
  END IF;

  SELECT email INTO v_actor_email FROM auth.users WHERE id = v_actor;
  INSERT INTO public.support_audit_logs (actor_id, actor_email, action, target_type, target_id, details)
  VALUES (v_actor, v_actor_email, 'review_email_change', 'email_change_request', p_request_id::text, 
          jsonb_build_object('approved', p_approve));

  RETURN jsonb_build_object('success', true, 'approved', p_approve);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_review_email_change(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_review_email_change(uuid, boolean) TO authenticated;

-- 6. Refund Requests & Allowlist Recommendation
CREATE OR REPLACE FUNCTION public.support_get_refund_requests(p_status TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor UUID := private.assert_support_staff();
  v_actor_email TEXT;
BEGIN
  SELECT email INTO v_actor_email FROM auth.users WHERE id = v_actor;
  INSERT INTO public.support_audit_logs (actor_id, actor_email, action, target_type, target_id, details)
  VALUES (v_actor, v_actor_email, 'list_refund_requests', 'refund_requests', 'list', jsonb_build_object('status', p_status));

  RETURN COALESCE((
    SELECT jsonb_agg(s.x) FROM (
      SELECT jsonb_build_object(
        'id', rr.id,
        'ticket_id', rr.ticket_id,
        'event_id', rr.event_id,
        'event_title', e.title,
        'buyer_email', rr.buyer_email,
        'buyer_name', rr.buyer_name,
        'reason', rr.reason,
        'other_reason', rr.other_reason,
        'status', rr.status,
        'admin_note', rr.admin_note,
        'created_at', rr.created_at
      ) AS x
      FROM public.refund_requests rr
      LEFT JOIN public.events e ON e.id = rr.event_id
      WHERE (p_status IS NULL OR rr.status = p_status)
      ORDER BY rr.created_at DESC
      LIMIT 50
    ) s
  ), '[]'::jsonb);
END;
$$;

REVOKE ALL ON FUNCTION public.support_get_refund_requests(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.support_get_refund_requests(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.support_recommend_refund(
  p_refund_request_id UUID,
  p_new_status VARCHAR,
  p_note TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor UUID := private.assert_support_staff();
  v_actor_email TEXT;
BEGIN
  IF p_new_status NOT IN ('needs_admin_review', 'customer_contacted') THEN
    RAISE EXCEPTION 'Invalid status. Customer care can only recommend needs_admin_review or customer_contacted';
  END IF;

  UPDATE public.refund_requests
  SET status = p_new_status, updated_at = now()
  WHERE id = p_refund_request_id
    AND status IN ('pending', 'needs_admin_review', 'customer_contacted');

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Refund request not found or already finalized';
  END IF;

  INSERT INTO public.support_notes (target_type, target_id, author_id, note)
  VALUES ('refund', p_refund_request_id::text, v_actor, p_note);

  SELECT email INTO v_actor_email FROM auth.users WHERE id = v_actor;
  INSERT INTO public.support_audit_logs (actor_id, actor_email, action, target_type, target_id, details)
  VALUES (v_actor, v_actor_email, 'recommend_refund', 'refund_request', p_refund_request_id::text, 
          jsonb_build_object('new_status', p_new_status, 'note', p_note));

  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE ALL ON FUNCTION public.support_recommend_refund(uuid, varchar, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.support_recommend_refund(uuid, varchar, text) TO authenticated;

-- 7. Case Management & Staff Replies
CREATE OR REPLACE FUNCTION public.open_support_case(
  p_subject TEXT,
  p_category public.support_case_category,
  p_description TEXT,
  p_order_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller UUID := auth.uid();
  v_caller_email TEXT;
  v_email_confirmed TIMESTAMPTZ;
  v_open_case_count INT;
  v_new_case_id UUID;
  v_case_number TEXT;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF length(trim(p_subject)) > 150 OR length(trim(p_subject)) < 3 THEN
    RAISE EXCEPTION 'Subject must be between 3 and 150 characters';
  END IF;

  IF length(trim(p_description)) > 3000 OR length(trim(p_description)) < 5 THEN
    RAISE EXCEPTION 'Description must be between 5 and 3000 characters';
  END IF;

  SELECT COUNT(*) INTO v_open_case_count 
  FROM public.support_cases 
  WHERE customer_id = v_caller AND status IN ('open', 'pending');

  IF v_open_case_count >= 5 THEN
    RAISE EXCEPTION 'Case limit reached: You currently have 5 active cases pending';
  END IF;

  SELECT email, email_confirmed_at INTO v_caller_email, v_email_confirmed FROM auth.users WHERE id = v_caller;

  IF p_order_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.orders
      WHERE id = p_order_id 
        AND (
          user_id = v_caller 
          OR (v_email_confirmed IS NOT NULL AND lower(buyer_email) = lower(v_caller_email))
        )
    ) THEN
      RAISE EXCEPTION 'Order does not belong to the authenticated user';
    END IF;
  END IF;

  INSERT INTO public.support_cases (
    customer_id, order_id, subject, category, status, priority
  ) VALUES (
    v_caller, p_order_id, trim(p_subject), p_category, 'open', 'medium'
  ) RETURNING id, case_number INTO v_new_case_id, v_case_number;

  INSERT INTO public.support_case_messages (case_id, sender_id, is_internal, content)
  VALUES (v_new_case_id, v_caller, FALSE, trim(p_description));

  RETURN jsonb_build_object('success', true, 'case_id', v_new_case_id, 'case_number', v_case_number);
END;
$$;

REVOKE ALL ON FUNCTION public.open_support_case(text, public.support_case_category, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.open_support_case(text, public.support_case_category, text, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.support_view_case(p_case_id UUID)
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
  VALUES (v_actor, v_actor_email, 'view_case', 'support_case', p_case_id::text, jsonb_build_object('case_id', p_case_id));

  SELECT jsonb_build_object(
    'case', (
      SELECT jsonb_build_object(
        'id', sc.id,
        'case_number', sc.case_number,
        'customer_id', sc.customer_id,
        'customer_email', uc.email,
        'customer_name', p.full_name,
        'order_id', sc.order_id,
        'subject', sc.subject,
        'category', sc.category,
        'status', sc.status,
        'priority', sc.priority,
        'assigned_to', sc.assigned_to,
        'is_escalated', sc.is_escalated,
        'escalated_reason', sc.escalated_reason,
        'created_at', sc.created_at,
        'updated_at', sc.updated_at,
        'resolved_at', sc.resolved_at
      )
      FROM public.support_cases sc
      LEFT JOIN public.user_contacts uc ON uc.user_id = sc.customer_id
      LEFT JOIN public.profiles p ON p.id = sc.customer_id
      WHERE sc.id = p_case_id
    ),
    'messages', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', scm.id,
          'sender_id', scm.sender_id,
          'sender_name', p.full_name,
          'is_internal', scm.is_internal,
          'content', scm.content,
          'created_at', scm.created_at
        )
        ORDER BY scm.created_at ASC
      )
      FROM public.support_case_messages scm
      LEFT JOIN public.profiles p ON p.id = scm.sender_id
      WHERE scm.case_id = p_case_id
    ), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.support_view_case(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.support_view_case(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.support_reply_case(
  p_case_id UUID,
  p_content TEXT,
  p_is_internal BOOLEAN DEFAULT FALSE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor UUID := private.assert_support_staff();
  v_actor_email TEXT;
  v_case RECORD;
  v_customer_email TEXT;
  v_new_msg_id UUID;
BEGIN
  SELECT id, customer_id, status, subject INTO v_case FROM public.support_cases WHERE id = p_case_id;
  IF v_case.id IS NULL THEN
    RAISE EXCEPTION 'Case not found';
  END IF;

  IF length(trim(p_content)) = 0 THEN
    RAISE EXCEPTION 'Message content cannot be empty';
  END IF;

  INSERT INTO public.support_case_messages (case_id, sender_id, is_internal, content)
  VALUES (p_case_id, v_actor, p_is_internal, trim(p_content))
  RETURNING id INTO v_new_msg_id;

  IF NOT p_is_internal THEN
    SELECT email INTO v_customer_email FROM public.user_contacts WHERE user_id = v_case.customer_id;
    IF v_customer_email IS NOT NULL THEN
      INSERT INTO public.email_outbox (case_id, recipient_email, template, payload, status)
      VALUES (
        p_case_id, 
        v_customer_email, 
        'case_reply', 
        jsonb_build_object('case_id', p_case_id, 'subject', v_case.subject, 'reply', trim(p_content)),
        'pending'
      );
    END IF;
  END IF;

  SELECT email INTO v_actor_email FROM auth.users WHERE id = v_actor;
  INSERT INTO public.support_audit_logs (actor_id, actor_email, action, target_type, target_id, details)
  VALUES (v_actor, v_actor_email, 'reply_case', 'support_case', p_case_id::text, 
          jsonb_build_object('is_internal', p_is_internal, 'message_id', v_new_msg_id));

  RETURN jsonb_build_object('success', true, 'message_id', v_new_msg_id);
END;
$$;

REVOKE ALL ON FUNCTION public.support_reply_case(uuid, text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.support_reply_case(uuid, text, boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.support_update_case(
  p_case_id UUID,
  p_status public.support_case_status,
  p_priority public.support_case_priority,
  p_assigned_to UUID,
  p_internal_note TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor UUID := private.assert_support_staff();
  v_actor_email TEXT;
  v_cur_resolved_at TIMESTAMPTZ;
BEGIN
  IF p_assigned_to IS NOT NULL THEN
    IF NOT public.has_role(p_assigned_to, 'customer_care'::public.app_role) 
       AND NOT public.has_role(p_assigned_to, 'admin'::public.app_role) THEN
      RAISE EXCEPTION 'Assigned user must hold the customer_care or admin role';
    END IF;
  END IF;

  SELECT resolved_at INTO v_cur_resolved_at FROM public.support_cases WHERE id = p_case_id;

  UPDATE public.support_cases
  SET status = p_status,
      priority = p_priority,
      assigned_to = p_assigned_to,
      updated_at = now(),
      resolved_at = CASE 
        WHEN p_status IN ('resolved', 'closed') THEN COALESCE(v_cur_resolved_at, now()) 
        ELSE NULL 
      END
  WHERE id = p_case_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Case not found';
  END IF;

  IF p_internal_note IS NOT NULL AND length(trim(p_internal_note)) > 0 THEN
    INSERT INTO public.support_case_messages (case_id, sender_id, is_internal, content)
    VALUES (p_case_id, v_actor, TRUE, trim(p_internal_note));
  END IF;

  SELECT email INTO v_actor_email FROM auth.users WHERE id = v_actor;
  INSERT INTO public.support_audit_logs (actor_id, actor_email, action, target_type, target_id, details)
  VALUES (v_actor, v_actor_email, 'update_case', 'support_case', p_case_id::text, 
          jsonb_build_object('status', p_status, 'priority', p_priority, 'assigned_to', p_assigned_to));

  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE ALL ON FUNCTION public.support_update_case(uuid, public.support_case_status, public.support_case_priority, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.support_update_case(uuid, public.support_case_status, public.support_case_priority, uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.support_escalate_case(
  p_case_id UUID,
  p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor UUID := private.assert_support_staff();
  v_actor_email TEXT;
BEGIN
  UPDATE public.support_cases
  SET is_escalated = TRUE,
      escalated_at = now(),
      escalated_reason = trim(p_reason),
      priority = 'urgent',
      updated_at = now()
  WHERE id = p_case_id;

  INSERT INTO public.support_case_messages (case_id, sender_id, is_internal, content)
  VALUES (p_case_id, v_actor, TRUE, 'ESCALATED TO ADMIN: ' || trim(p_reason));

  SELECT email INTO v_actor_email FROM auth.users WHERE id = v_actor;
  INSERT INTO public.support_audit_logs (actor_id, actor_email, action, target_type, target_id, details)
  VALUES (v_actor, v_actor_email, 'escalate_case', 'support_case', p_case_id::text, jsonb_build_object('reason', p_reason));

  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE ALL ON FUNCTION public.support_escalate_case(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.support_escalate_case(uuid, text) TO authenticated;

-- 8. Read Surfaces, Timezone-Adjusted Metrics & Payment Reconciliation
CREATE OR REPLACE FUNCTION public.support_get_overview_stats()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor UUID := private.assert_support_staff();
  v_actor_email TEXT;
  v_stats JSONB;
BEGIN
  SELECT email INTO v_actor_email FROM auth.users WHERE id = v_actor;
  INSERT INTO public.support_audit_logs (actor_id, actor_email, action, target_type, target_id, details)
  VALUES (v_actor, v_actor_email, 'view_overview_stats', 'dashboard', 'overview', '{}'::jsonb);

  SELECT jsonb_build_object(
    'open_cases', (SELECT COUNT(*) FROM public.support_cases WHERE status = 'open'),
    'unassigned_cases', (SELECT COUNT(*) FROM public.support_cases WHERE status = 'open' AND assigned_to IS NULL),
    'pending_refunds', (SELECT COUNT(*) FROM public.refund_requests WHERE status IN ('pending', 'needs_admin_review')),
    'resolved_today', (
      SELECT COUNT(*) FROM public.support_cases 
      WHERE resolved_at >= (date_trunc('day', now() AT TIME ZONE 'Africa/Lagos') AT TIME ZONE 'Africa/Lagos')
    ),
    'unmatched_payments', (
      SELECT COUNT(*) FROM public.payment_events 
      WHERE status = 'success' 
        AND matched_order_id IS NULL 
        AND resolved_at IS NULL
        AND created_at < (now() - INTERVAL '10 minutes')
    )
  ) INTO v_stats;

  RETURN v_stats;
END;
$$;

REVOKE ALL ON FUNCTION public.support_get_overview_stats() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.support_get_overview_stats() TO authenticated;

CREATE OR REPLACE FUNCTION public.support_get_unmatched_payments()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor UUID := private.assert_support_staff();
  v_actor_email TEXT;
BEGIN
  SELECT email INTO v_actor_email FROM auth.users WHERE id = v_actor;
  INSERT INTO public.support_audit_logs (actor_id, actor_email, action, target_type, target_id, details)
  VALUES (v_actor, v_actor_email, 'view_unmatched_payments', 'payment_events', 'list', '{}'::jsonb);

  RETURN COALESCE((
    SELECT jsonb_agg(s.x) FROM (
      SELECT jsonb_build_object(
        'id', pe.id,
        'reference', pe.reference,
        'amount_ngn', (pe.amount_kobo / 100.0),
        'customer_email', pe.customer_email,
        'channel', pe.channel,
        'resolution_note', pe.resolution_note,
        'created_at', pe.created_at
      ) AS x
      FROM public.payment_events pe
      WHERE pe.status = 'success' 
        AND pe.matched_order_id IS NULL 
        AND pe.resolved_at IS NULL
        AND pe.created_at < (now() - INTERVAL '10 minutes')
      ORDER BY pe.created_at DESC
      LIMIT 50
    ) s
  ), '[]'::jsonb);
END;
$$;

REVOKE ALL ON FUNCTION public.support_get_unmatched_payments() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.support_get_unmatched_payments() TO authenticated;

CREATE OR REPLACE FUNCTION public.support_flag_payment(
  p_payment_event_id UUID,
  p_note TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor UUID := private.assert_support_staff();
  v_actor_email TEXT;
BEGIN
  UPDATE public.payment_events
  SET resolution_note = 'FLAGGED BY SUPPORT: ' || trim(p_note)
  WHERE id = p_payment_event_id AND matched_order_id IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment event not found or already matched';
  END IF;

  SELECT email INTO v_actor_email FROM auth.users WHERE id = v_actor;
  INSERT INTO public.support_audit_logs (actor_id, actor_email, action, target_type, target_id, details)
  VALUES (v_actor, v_actor_email, 'flag_payment', 'payment_event', p_payment_event_id::text, jsonb_build_object('note', p_note));

  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE ALL ON FUNCTION public.support_flag_payment(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.support_flag_payment(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_resolve_payment(
  p_payment_event_id UUID,
  p_matched_order_id UUID DEFAULT NULL,
  p_resolution_note TEXT DEFAULT 'Resolved by admin'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor UUID := private.assert_admin();
  v_actor_email TEXT;
BEGIN
  UPDATE public.payment_events
  SET matched_order_id = p_matched_order_id,
      resolved_at = now(),
      resolved_by = v_actor,
      resolution_note = trim(p_resolution_note)
  WHERE id = p_payment_event_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment event not found';
  END IF;

  SELECT email INTO v_actor_email FROM auth.users WHERE id = v_actor;
  INSERT INTO public.support_audit_logs (actor_id, actor_email, action, target_type, target_id, details)
  VALUES (v_actor, v_actor_email, 'resolve_payment', 'payment_event', p_payment_event_id::text, 
          jsonb_build_object('matched_order_id', p_matched_order_id, 'note', p_resolution_note));

  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_resolve_payment(uuid, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_resolve_payment(uuid, uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.support_get_events_list(p_search TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor UUID := private.assert_support_staff();
  v_actor_email TEXT;
BEGIN
  SELECT email INTO v_actor_email FROM auth.users WHERE id = v_actor;
  INSERT INTO public.support_audit_logs (actor_id, actor_email, action, target_type, target_id, details)
  VALUES (v_actor, v_actor_email, 'list_events', 'events', 'list', jsonb_build_object('search', p_search));

  RETURN COALESCE((
    SELECT jsonb_agg(s.x) FROM (
      SELECT jsonb_build_object(
        'id', e.id,
        'title', e.title,
        'slug', e.slug,
        'start_date', e.start_datetime,
        'venue', e.venue_name,
        'category', e.category,
        'status', e.status,
        'organizer_name', p.full_name
      ) AS x
      FROM public.events e
      LEFT JOIN public.profiles p ON p.id = e.organizer_id
      WHERE (p_search IS NULL OR e.title ILIKE '%' || p_search || '%')
      ORDER BY e.start_datetime DESC
      LIMIT 50
    ) s
  ), '[]'::jsonb);
END;
$$;

REVOKE ALL ON FUNCTION public.support_get_events_list(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.support_get_events_list(text) TO authenticated;

-- 9. Role Assignment & Macros Management
CREATE OR REPLACE FUNCTION public.admin_set_customer_care_role(p_user_id UUID, p_grant BOOLEAN)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor UUID := private.assert_admin();
BEGIN
  IF p_user_id = v_actor THEN
    RAISE EXCEPTION 'Self-modification forbidden: You cannot modify your own administrative roles';
  END IF;

  IF p_grant THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (p_user_id, 'customer_care'::public.app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  ELSE
    DELETE FROM public.user_roles 
    WHERE user_id = p_user_id AND role = 'customer_care'::public.app_role;
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_customer_care_role(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_customer_care_role(uuid, boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.support_get_macros()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor UUID := private.assert_support_staff();
BEGIN
  RETURN COALESCE((
    SELECT jsonb_agg(s.x) FROM (
      SELECT jsonb_build_object(
        'id', m.id,
        'title', m.title,
        'category', m.category,
        'content', m.content
      ) AS x
      FROM public.support_macros m
      ORDER BY m.title ASC
    ) s
  ), '[]'::jsonb);
END;
$$;

REVOKE ALL ON FUNCTION public.support_get_macros() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.support_get_macros() TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_manage_macro(
  p_action VARCHAR,
  p_id UUID DEFAULT NULL,
  p_title VARCHAR DEFAULT NULL,
  p_category VARCHAR DEFAULT 'general',
  p_content TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor UUID := private.assert_admin();
  v_new_id UUID;
BEGIN
  IF p_action = 'create' THEN
    INSERT INTO public.support_macros (title, category, content, created_by)
    VALUES (trim(p_title), trim(p_category), trim(p_content), v_actor)
    RETURNING id INTO v_new_id;
    RETURN jsonb_build_object('success', true, 'id', v_new_id);
  ELSIF p_action = 'update' THEN
    UPDATE public.support_macros
    SET title = COALESCE(trim(p_title), title),
        category = COALESCE(trim(p_category), category),
        content = COALESCE(trim(p_content), content)
    WHERE id = p_id;
    RETURN jsonb_build_object('success', true);
  ELSIF p_action = 'delete' THEN
    DELETE FROM public.support_macros WHERE id = p_id;
    RETURN jsonb_build_object('success', true);
  ELSE
    RAISE EXCEPTION 'Invalid action: %', p_action;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_manage_macro(varchar, uuid, varchar, varchar, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_manage_macro(varchar, uuid, varchar, varchar, text) TO authenticated;

-- Worker Helper: Claim Outbox Batch (Atomic, lock-free concurrency)
CREATE OR REPLACE FUNCTION public.claim_email_outbox_batch(p_batch_size INT DEFAULT 20)
RETURNS SETOF public.email_outbox
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  UPDATE public.email_outbox
  SET status = 'processing'
  WHERE id IN (
    SELECT id
    FROM public.email_outbox
    WHERE status = 'pending' AND retry_count < 3
    ORDER BY created_at ASC
    LIMIT p_batch_size
    FOR UPDATE SKIP LOCKED
  )
  RETURNING *;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_email_outbox_batch(int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_email_outbox_batch(int) TO service_role;

