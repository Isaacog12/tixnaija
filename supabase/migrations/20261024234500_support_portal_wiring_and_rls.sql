-- Migration: Complete Support Portal wiring, RLS policies, seed macros, and RPC enhancements
-- File: supabase/migrations/20261024234500_support_portal_wiring_and_rls.sql

-- 1. RLS Policies for Support Cases (Allow Staff & Admin access)
DROP POLICY IF EXISTS "Staff can view all cases" ON public.support_cases;
CREATE POLICY "Staff can view all cases"
ON public.support_cases FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'customer_care'::public.app_role)
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
);

DROP POLICY IF EXISTS "Staff can update cases" ON public.support_cases;
CREATE POLICY "Staff can update cases"
ON public.support_cases FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(), 'customer_care'::public.app_role)
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
);

-- 2. RLS Policies for Case Messages (Allow Staff & Admin access)
DROP POLICY IF EXISTS "Staff can view all case messages" ON public.support_case_messages;
CREATE POLICY "Staff can view all case messages"
ON public.support_case_messages FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'customer_care'::public.app_role)
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
);

DROP POLICY IF EXISTS "Staff can insert case messages" ON public.support_case_messages;
CREATE POLICY "Staff can insert case messages"
ON public.support_case_messages FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'customer_care'::public.app_role)
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
);

-- 3. Relax Audit Logs RLS Policy (Remove strict AAL2 MFA requirement)
DROP POLICY IF EXISTS "Admins with MFA can view audit logs" ON public.support_audit_logs;
DROP POLICY IF EXISTS "Admins can view audit logs" ON public.support_audit_logs;
CREATE POLICY "Admins can view audit logs"
ON public.support_audit_logs FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
);

-- 4. RLS Policies for Support Macros & Make created_by Nullable
ALTER TABLE public.support_macros ALTER COLUMN created_by DROP NOT NULL;

DROP POLICY IF EXISTS "Staff can view macros" ON public.support_macros;
CREATE POLICY "Staff can view macros"
ON public.support_macros FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'customer_care'::public.app_role)
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
);

DROP POLICY IF EXISTS "Staff can manage macros" ON public.support_macros;
CREATE POLICY "Staff can manage macros"
ON public.support_macros FOR ALL TO authenticated
USING (
  public.has_role(auth.uid(), 'customer_care'::public.app_role)
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
);

-- 5. Seed Support Macros (Standard Nigerian Ticketing Templates)
INSERT INTO public.support_macros (title, category, content, created_by)
VALUES
  (
    'Ticket Delivery / Resend Confirmation',
    'tickets',
    'Hello,

Thank you for contacting TixNaija Support.

We have re-dispatched your ticket confirmation with the QR codes directly to your registered email address. Please allow 1 to 2 minutes for delivery and be sure to check your Spam or Promotions folder.

If you still cannot locate the email, let us know and we will be glad to assist further!

Best regards,
TixNaija Support Team',
    (SELECT id FROM auth.users ORDER BY created_at ASC LIMIT 1)
  ),
  (
    'Paystack Bank Transfer Clearing Delay',
    'payments',
    'Hello,

Thank you for reaching out to us.

Bank transfer transactions on Paystack can occasionally experience a 2 to 10 minute settlement delay between your financial institution and the payment gateway. Once Paystack validates payment completion, your tickets are generated and dispatched immediately.

If the amount has debited your bank and more than 15 minutes have passed, please reply with your bank transaction session ID or transfer receipt so we can quickly locate and reconcile your order.

Best regards,
TixNaija Support Team',
    (SELECT id FROM auth.users ORDER BY created_at ASC LIMIT 1)
  ),
  (
    'Event Postponement & Refund Information',
    'refunds',
    'Hello,

Thank you for contacting TixNaija regarding your refund request.

Under platform guidelines and organizer agreements, refund eligibility applies when an event is officially postponed, rescheduled, or cancelled by the event host. Our support team has triaged your claim and queued it for administrative review.

You will receive an automated email notice as soon as the review is finalized.

Best regards,
TixNaija Support Team',
    (SELECT id FROM auth.users ORDER BY created_at ASC LIMIT 1)
  ),
  (
    'Door Admission & QR Code Scanning',
    'checkin',
    'Hello,

For admission at the venue gate, you may present your digital ticket QR code directly on your mobile device or bring a clear printed copy.

Helpful Tip: Please turn your phone screen brightness up to maximum when presenting your ticket to the door scanner to ensure quick entry.

Best regards,
TixNaija Support Team',
    (SELECT id FROM auth.users ORDER BY created_at ASC LIMIT 1)
  ),
  (
    'Dual-Control Email Typo Correction',
    'account',
    'Hello,

If you entered a typo in your email during checkout, please reply with your phone number and the exact Paystack payment reference or amount.

To safeguard ticket holders against unauthorized transfers, our security protocol requires dual-control verification. Once verified, our administrative team will re-issue the tickets to your corrected address and invalidate previous codes.

Best regards,
TixNaija Support Team',
    (SELECT id FROM auth.users ORDER BY created_at ASC LIMIT 1)
  )
ON CONFLICT DO NOTHING;

-- 6. Enhance support_recommend_refund to allow Admins to directly approve or reject
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
  v_is_admin BOOLEAN := public.has_role(v_actor, 'admin'::public.app_role);
  v_refund RECORD;
BEGIN
  IF v_is_admin THEN
    IF p_new_status NOT IN ('needs_admin_review', 'customer_contacted', 'approved', 'rejected') THEN
      RAISE EXCEPTION 'Invalid status. Admin can set needs_admin_review, customer_contacted, approved, or rejected';
    END IF;
  ELSE
    IF p_new_status NOT IN ('needs_admin_review', 'customer_contacted') THEN
      RAISE EXCEPTION 'Invalid status. Customer care can only recommend needs_admin_review or customer_contacted';
    END IF;
  END IF;

  SELECT * INTO v_refund FROM public.refund_requests WHERE id = p_refund_request_id;
  IF v_refund.id IS NULL THEN
    RAISE EXCEPTION 'Refund request not found';
  END IF;

  UPDATE public.refund_requests
  SET status = p_new_status, 
      admin_note = trim(p_note),
      updated_at = now()
  WHERE id = p_refund_request_id;

  -- If approved and ticket_id is present, invalidate/refund ticket
  IF p_new_status = 'approved' AND v_refund.ticket_id IS NOT NULL THEN
    UPDATE public.tickets
    SET status = 'refunded'
    WHERE id = v_refund.ticket_id;
  END IF;

  INSERT INTO public.support_notes (target_type, target_id, author_id, note)
  VALUES ('refund', p_refund_request_id::text, v_actor, p_note);

  SELECT email INTO v_actor_email FROM auth.users WHERE id = v_actor;
  INSERT INTO public.support_audit_logs (actor_id, actor_email, action, target_type, target_id, details)
  VALUES (v_actor, v_actor_email, 'update_refund_status', 'refund_request', p_refund_request_id::text, 
          jsonb_build_object('new_status', p_new_status, 'note', p_note, 'is_admin', v_is_admin));

  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE ALL ON FUNCTION public.support_recommend_refund(uuid, varchar, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.support_recommend_refund(uuid, varchar, text) TO authenticated;

-- 7. Add support_create_case for Staff
CREATE OR REPLACE FUNCTION public.support_create_case(
  p_customer_email TEXT DEFAULT NULL,
  p_customer_id UUID DEFAULT NULL,
  p_subject TEXT DEFAULT 'Customer Inquiry',
  p_category public.support_case_category DEFAULT 'other',
  p_priority public.support_case_priority DEFAULT 'medium',
  p_initial_message TEXT DEFAULT NULL,
  p_order_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor UUID := private.assert_support_staff();
  v_actor_email TEXT;
  v_resolved_customer_id UUID := p_customer_id;
  v_new_case_id UUID;
  v_case_number TEXT;
  v_seq INT;
BEGIN
  IF length(trim(p_subject)) = 0 THEN
    RAISE EXCEPTION 'Subject cannot be empty';
  END IF;

  IF v_resolved_customer_id IS NULL AND p_customer_email IS NOT NULL THEN
    SELECT id INTO v_resolved_customer_id FROM auth.users WHERE lower(email) = lower(trim(p_customer_email)) LIMIT 1;
    IF v_resolved_customer_id IS NULL THEN
      SELECT user_id INTO v_resolved_customer_id FROM public.user_contacts WHERE lower(email) = lower(trim(p_customer_email)) LIMIT 1;
    END IF;
    IF v_resolved_customer_id IS NULL THEN
      SELECT user_id INTO v_resolved_customer_id FROM public.orders WHERE lower(buyer_email) = lower(trim(p_customer_email)) LIMIT 1;
    END IF;
  END IF;

  -- Fallback to staff actor if no customer account exists yet
  IF v_resolved_customer_id IS NULL THEN
    v_resolved_customer_id := v_actor;
  END IF;

  SELECT COALESCE(MAX(SUBSTRING(case_number FROM 5)::INT), 1000) + 1 INTO v_seq
  FROM public.support_cases 
  WHERE case_number ~ '^TIX-[0-9]+$';

  v_case_number := 'TIX-' || LPAD(v_seq::TEXT, 6, '0');

  INSERT INTO public.support_cases (
    customer_id, order_id, subject, category, status, priority, assigned_to
  ) VALUES (
    v_resolved_customer_id, p_order_id, trim(p_subject), p_category, 'open', p_priority, v_actor
  ) RETURNING id INTO v_new_case_id;

  IF p_initial_message IS NOT NULL AND length(trim(p_initial_message)) > 0 THEN
    INSERT INTO public.support_case_messages (case_id, sender_id, is_internal, content)
    VALUES (v_new_case_id, v_actor, FALSE, trim(p_initial_message));
  END IF;

  SELECT email INTO v_actor_email FROM auth.users WHERE id = v_actor;
  INSERT INTO public.support_audit_logs (actor_id, actor_email, action, target_type, target_id, details)
  VALUES (v_actor, v_actor_email, 'create_case_for_customer', 'support_case', v_new_case_id::text, 
          jsonb_build_object('case_number', v_case_number, 'customer_id', v_resolved_customer_id, 'subject', p_subject));

  RETURN jsonb_build_object('success', true, 'case_id', v_new_case_id, 'case_number', v_case_number);
END;
$$;

REVOKE ALL ON FUNCTION public.support_create_case(text, uuid, text, public.support_case_category, public.support_case_priority, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.support_create_case(text, uuid, text, public.support_case_category, public.support_case_priority, text, uuid) TO authenticated;

-- 8. Add support_add_order_note for Staff
CREATE OR REPLACE FUNCTION public.support_add_order_note(
  p_order_id UUID,
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
  v_new_note_id UUID;
BEGIN
  IF length(trim(p_note)) = 0 THEN
    RAISE EXCEPTION 'Note cannot be empty';
  END IF;

  INSERT INTO public.support_notes (target_type, target_id, author_id, note)
  VALUES ('order', p_order_id::text, v_actor, trim(p_note))
  RETURNING id INTO v_new_note_id;

  SELECT email INTO v_actor_email FROM auth.users WHERE id = v_actor;
  INSERT INTO public.support_audit_logs (actor_id, actor_email, action, target_type, target_id, details)
  VALUES (v_actor, v_actor_email, 'add_order_note', 'order', p_order_id::text, 
          jsonb_build_object('note_id', v_new_note_id));

  RETURN jsonb_build_object('success', true, 'note_id', v_new_note_id);
END;
$$;

REVOKE ALL ON FUNCTION public.support_add_order_note(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.support_add_order_note(uuid, text) TO authenticated;

-- 9. Update admin_manage_macro to allow all support staff to create and edit canned responses
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
  v_actor UUID := private.assert_support_staff();
  v_new_id UUID;
BEGIN
  IF p_action = 'create' THEN
    IF length(trim(p_title)) = 0 OR length(trim(p_content)) = 0 THEN
      RAISE EXCEPTION 'Title and content cannot be empty';
    END IF;
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

-- 10. Enhance support_reply_case to fallback to auth.users if user_contacts record is missing
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
    IF v_customer_email IS NULL THEN
      SELECT email INTO v_customer_email FROM auth.users WHERE id = v_case.customer_id;
    END IF;

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

-- 11. Relax Rate Limit on Ticket Resends for Admins and Raise Limit for Staff
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
  v_is_admin BOOLEAN := public.has_role(v_actor, 'admin'::public.app_role);
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

  -- Bypass limit for admins; allow up to 10 for support staff
  IF v_resend_count >= 10 AND NOT v_is_admin THEN
    RAISE EXCEPTION 'Rate limit exceeded: maximum 10 ticket resends per order per 24 hours';
  END IF;

  INSERT INTO public.email_outbox (order_id, recipient_email, template, payload, status)
  VALUES (p_order_id, v_order.buyer_email, 'ticket_confirmation', jsonb_build_object('order_id', p_order_id), 'pending')
  RETURNING id INTO v_outbox_id;

  SELECT email INTO v_actor_email FROM auth.users WHERE id = v_actor;
  INSERT INTO public.support_audit_logs (actor_id, actor_email, action, target_type, target_id, details)
  VALUES (v_actor, v_actor_email, 'resend_ticket_email', 'order', p_order_id::text, 
          jsonb_build_object('recipient', v_order.buyer_email, 'outbox_id', v_outbox_id, 'is_admin', v_is_admin));

  RETURN jsonb_build_object('success', true, 'recipient', v_order.buyer_email, 'outbox_id', v_outbox_id);
END;
$$;

REVOKE ALL ON FUNCTION public.support_resend_ticket_email(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.support_resend_ticket_email(uuid) TO authenticated;

-- 12. Fix support_get_order_details to Join Events & Return Full Email & Phone
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
        'masked_buyer_email', CASE 
          WHEN position('@' in o.buyer_email) > 3 
          THEN left(o.buyer_email, 2) || '••••' || substring(o.buyer_email from position('@' in o.buyer_email) - 1)
          ELSE o.buyer_email 
        END,
        'buyer_phone', o.buyer_phone,
        'masked_buyer_phone', CASE 
          WHEN length(coalesce(o.buyer_phone, '')) >= 8 
          THEN left(o.buyer_phone, 4) || '••••' || right(o.buyer_phone, 3)
          ELSE o.buyer_phone 
        END,
        'total_kobo', o.total_kobo,
        'subtotal_kobo', o.subtotal_kobo,
        'discount_kobo', o.discount_kobo,
        'status', o.status,
        'event_id', o.event_id,
        'event_title', e.title,
        'start_datetime', e.start_datetime,
        'venue_name', e.venue_name,
        'created_at', o.created_at,
        'updated_at', o.updated_at
      )
      FROM public.orders o
      LEFT JOIN public.events e ON e.id = o.event_id
      WHERE o.id = p_order_id
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
          'sent_at', eo.sent_at,
          'error_message', eo.error_message
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

-- 13. Allow Admin Self-Approval in admin_review_email_change
ALTER TABLE public.support_email_change_requests ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

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
  v_is_self BOOLEAN;
BEGIN
  SELECT * INTO v_req FROM public.support_email_change_requests 
  WHERE id = p_request_id FOR UPDATE;

  IF v_req.id IS NULL OR v_req.status != 'pending_admin' THEN
    RAISE EXCEPTION 'Request not found or already reviewed';
  END IF;

  v_is_self := (v_req.requested_by = v_actor);

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
    SET status = 'approved',
        reviewed_by = v_actor,
        reviewed_at = now(),
        updated_at = now()
    WHERE id = p_request_id;
  ELSE
    UPDATE public.support_email_change_requests
    SET status = 'rejected',
        reviewed_by = v_actor,
        reviewed_at = now(),
        updated_at = now()
    WHERE id = p_request_id;
  END IF;

  SELECT email INTO v_actor_email FROM auth.users WHERE id = v_actor;
  INSERT INTO public.support_audit_logs (actor_id, actor_email, action, target_type, target_id, details)
  VALUES (v_actor, v_actor_email, 
          CASE WHEN p_approve THEN 'approve_email_change' ELSE 'reject_email_change' END,
          'email_change_request', p_request_id::text,
          jsonb_build_object('approved', p_approve, 'order_id', v_req.order_id, 'new_email', v_req.new_email, 'self_approved', v_is_self));

  RETURN jsonb_build_object('success', true, 'approved', p_approve);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_review_email_change(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_review_email_change(uuid, boolean) TO authenticated;
