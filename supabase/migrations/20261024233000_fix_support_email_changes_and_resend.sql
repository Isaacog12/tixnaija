-- Migration: Enable RLS policies for support_email_change_requests and email_outbox, and relax self-approval restriction

-- 1. Policies for support_email_change_requests
DROP POLICY IF EXISTS "Staff and admins can view email change requests" ON public.support_email_change_requests;
CREATE POLICY "Staff and admins can view email change requests"
ON public.support_email_change_requests FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role) 
  OR public.has_role(auth.uid(), 'customer_care'::public.app_role)
);

DROP POLICY IF EXISTS "Staff can insert email change requests" ON public.support_email_change_requests;
CREATE POLICY "Staff can insert email change requests"
ON public.support_email_change_requests FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::public.app_role) 
  OR public.has_role(auth.uid(), 'customer_care'::public.app_role)
);

DROP POLICY IF EXISTS "Admins can update email change requests" ON public.support_email_change_requests;
CREATE POLICY "Admins can update email change requests"
ON public.support_email_change_requests FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
);

-- 2. Policies for email_outbox
DROP POLICY IF EXISTS "Staff and admins can view email outbox" ON public.email_outbox;
CREATE POLICY "Staff and admins can view email outbox"
ON public.email_outbox FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role) 
  OR public.has_role(auth.uid(), 'customer_care'::public.app_role)
);

DROP POLICY IF EXISTS "Staff and admins can insert email outbox" ON public.email_outbox;
CREATE POLICY "Staff and admins can insert email outbox"
ON public.email_outbox FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::public.app_role) 
  OR public.has_role(auth.uid(), 'customer_care'::public.app_role)
);

-- 3. Update admin_review_email_change (Allow admins to approve even if self-requested)
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
          jsonb_build_object('approved', p_approve, 'is_self_approved', (v_req.requested_by = v_actor)));

  RETURN jsonb_build_object('success', true, 'approved', p_approve);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_review_email_change(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_review_email_change(uuid, boolean) TO authenticated;

-- 4. Update support_resend_ticket_email
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

  IF v_resend_count >= 10 THEN
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
