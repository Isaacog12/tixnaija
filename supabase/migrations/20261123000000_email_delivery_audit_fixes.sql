-- Email delivery audit fixes:
--   1. durable per-message claims prevent concurrent/retried provider sends;
--   2. outbox rows can be deduplicated by an explicit idempotency key;
--   3. support resends and approved email changes queue exactly one notice;
--   4. attendee edits report whether the delivery address actually changed;
--   5. every cancellation/postponement transition queues attendee and buyer email.

ALTER TABLE public.email_outbox
  ADD COLUMN IF NOT EXISTS idempotency_key text,
  ADD COLUMN IF NOT EXISTS claimed_at timestamptz;

ALTER TABLE public.email_outbox
  DROP CONSTRAINT IF EXISTS email_outbox_idempotency_key_key;
ALTER TABLE public.email_outbox
  ADD CONSTRAINT email_outbox_idempotency_key_key UNIQUE (idempotency_key);

CREATE INDEX IF NOT EXISTS email_outbox_claim_idx
  ON public.email_outbox (status, created_at);

CREATE TABLE IF NOT EXISTS public.email_delivery_log (
  delivery_key text PRIMARY KEY,
  status text NOT NULL DEFAULT 'processing'
    CHECK (status IN ('processing', 'sent', 'failed')),
  claimed_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  last_error text
);

CREATE INDEX IF NOT EXISTS email_delivery_log_status_idx
  ON public.email_delivery_log (status, claimed_at);

ALTER TABLE public.email_delivery_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.email_delivery_log FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.email_delivery_log TO service_role;

-- Returns "claimed", "sent", or "processing". A failed send may be retried;
-- an in-flight lease prevents two workers from mailing the same message.
CREATE OR REPLACE FUNCTION public.claim_email_delivery(p_delivery_key text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_status text;
BEGIN
  IF p_delivery_key IS NULL OR length(trim(p_delivery_key)) = 0 OR length(p_delivery_key) > 500 THEN
    RAISE EXCEPTION 'A valid delivery key is required';
  END IF;

  INSERT INTO public.email_delivery_log (delivery_key, status, claimed_at)
  VALUES (p_delivery_key, 'processing', now())
  ON CONFLICT (delivery_key) DO UPDATE
    SET status = 'processing', claimed_at = now(), sent_at = NULL, last_error = NULL
    WHERE public.email_delivery_log.status = 'failed'
       OR (
         public.email_delivery_log.status = 'processing'
         AND public.email_delivery_log.claimed_at < now() - interval '10 minutes'
       )
  RETURNING status INTO v_status;

  IF FOUND THEN
    RETURN 'claimed';
  END IF;

  SELECT status INTO v_status
  FROM public.email_delivery_log
  WHERE delivery_key = p_delivery_key;

  IF v_status = 'sent' THEN
    RETURN 'sent';
  END IF;

  RETURN 'processing';
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_email_delivery(
  p_delivery_key text,
  p_success boolean,
  p_error text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.email_delivery_log
  SET status = CASE WHEN p_success THEN 'sent' ELSE 'failed' END,
      sent_at = CASE WHEN p_success THEN now() ELSE NULL END,
      last_error = CASE WHEN p_success THEN NULL ELSE left(coalesce(p_error, 'Unknown delivery error'), 2000) END
  WHERE delivery_key = p_delivery_key
    AND status = 'processing';
END;
$$;

REVOKE ALL ON FUNCTION public.claim_email_delivery(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.complete_email_delivery(text, boolean, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_email_delivery(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_email_delivery(text, boolean, text) TO service_role;

-- Internal queue helper. The unique key makes event notifications and
-- dual-control reissues safe to enqueue again after an ambiguous RPC retry.
CREATE OR REPLACE FUNCTION public.queue_email_outbox(
  p_order_id uuid DEFAULT NULL,
  p_recipient_email text DEFAULT NULL,
  p_template text DEFAULT NULL,
  p_payload jsonb DEFAULT '{}'::jsonb,
  p_idempotency_key text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_email text := lower(trim(coalesce(p_recipient_email, '')));
  v_domain text;
  v_id uuid;
BEGIN
  IF v_email !~* '^[^\s@]+@[^\s@]+\.[^\s@]+$' THEN
    RETURN NULL;
  END IF;

  v_domain := split_part(v_email, '@', 2);
  IF v_domain = 'local' OR v_domain LIKE '%.local' THEN
    RETURN NULL;
  END IF;

  IF p_template IS NULL OR length(trim(p_template)) = 0
     OR p_idempotency_key IS NULL OR length(trim(p_idempotency_key)) = 0
     OR length(p_idempotency_key) > 500 THEN
    RAISE EXCEPTION 'Template and idempotency key are required';
  END IF;

  INSERT INTO public.email_outbox (
    order_id, recipient_email, template, payload, status, idempotency_key
  ) VALUES (
    p_order_id, v_email, p_template, coalesce(p_payload, '{}'::jsonb), 'pending', p_idempotency_key
  )
  ON CONFLICT (idempotency_key) DO NOTHING
  RETURNING id INTO v_id;

  IF v_id IS NULL THEN
    SELECT id INTO v_id
    FROM public.email_outbox
    WHERE idempotency_key = p_idempotency_key;
  END IF;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.queue_email_outbox(uuid, text, text, jsonb, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.queue_email_outbox(uuid, text, text, jsonb, text) TO service_role;

-- Claim stale processing rows as well as pending rows so a crashed worker does
-- not strand mail forever. SKIP LOCKED keeps concurrent workers disjoint.
CREATE OR REPLACE FUNCTION public.claim_email_outbox_batch(p_batch_size INT DEFAULT 20)
RETURNS SETOF public.email_outbox
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  UPDATE public.email_outbox
  SET status = 'processing', claimed_at = now()
  WHERE id IN (
    SELECT id
    FROM public.email_outbox
    WHERE retry_count < 3
      AND (
        status = 'pending'
        OR (status = 'processing' AND claimed_at < now() - interval '10 minutes')
      )
    ORDER BY created_at ASC
    LIMIT greatest(1, least(p_batch_size, 100))
    FOR UPDATE SKIP LOCKED
  )
  RETURNING *;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_email_outbox_batch(int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_email_outbox_batch(int) TO service_role;

-- Support resend: one outbox notice per current valid ticket holder. The Edge
-- Function no longer sends a second full confirmation for the same action.
DROP FUNCTION IF EXISTS public.support_resend_ticket_email(uuid);
CREATE OR REPLACE FUNCTION public.support_resend_ticket_email(
  p_order_id UUID,
  p_request_id UUID DEFAULT gen_random_uuid()
)
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
  v_action_id UUID := coalesce(p_request_id, gen_random_uuid());
  v_recipient RECORD;
  v_outbox_id UUID;
  v_first_outbox_id UUID;
  v_first_recipient TEXT;
  v_outbox_ids UUID[] := ARRAY[]::UUID[];
  v_recipients TEXT[] := ARRAY[]::TEXT[];
  v_is_admin BOOLEAN := public.has_role(v_actor, 'admin'::public.app_role);
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(p_order_id::text));

  SELECT id, buyer_email, recipient_email, status INTO v_order
  FROM public.orders WHERE id = p_order_id;
  IF v_order.id IS NULL THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  IF v_order.status NOT IN ('paid', 'comp') THEN
    RAISE EXCEPTION 'Cannot resend tickets for unpaid orders';
  END IF;

  SELECT COUNT(*) INTO v_resend_count
  FROM public.support_audit_logs
  WHERE target_id = p_order_id::text
    AND action = 'resend_ticket_email'
    AND created_at > (now() - INTERVAL '24 hours');

  IF v_resend_count >= 10 AND NOT v_is_admin THEN
    RAISE EXCEPTION 'Rate limit exceeded: maximum 10 ticket resends per order per 24 hours';
  END IF;

  FOR v_recipient IN
    SELECT DISTINCT ON (lower(coalesce(nullif(trim(t.attendee_email), ''), o.buyer_email)))
      lower(coalesce(nullif(trim(t.attendee_email), ''), o.buyer_email)) AS email,
      coalesce(nullif(trim(t.attendee_name), ''), o.buyer_name, 'Attendee') AS name
    FROM public.orders o
    JOIN public.order_items oi ON oi.order_id = o.id
    JOIN public.tickets t ON t.order_item_id = oi.id
    WHERE o.id = p_order_id AND t.status = 'valid'
    ORDER BY 1, t.created_at ASC
  LOOP
    v_outbox_id := public.queue_email_outbox(
      p_order_id,
      v_recipient.email,
      'ticket_confirmation',
      jsonb_build_object('order_id', p_order_id, 'resend', true),
      'support-resend:' || p_order_id::text || ':' || v_action_id::text || ':' || v_recipient.email
    );
    IF v_outbox_id IS NOT NULL THEN
      v_outbox_ids := array_append(v_outbox_ids, v_outbox_id);
      v_recipients := array_append(v_recipients, v_recipient.email);
      IF v_first_outbox_id IS NULL THEN
        v_first_outbox_id := v_outbox_id;
        v_first_recipient := v_recipient.email;
      END IF;
    END IF;
  END LOOP;

  IF cardinality(v_outbox_ids) = 0 THEN
    RAISE EXCEPTION 'No valid ticket recipients found for this order';
  END IF;

  SELECT email INTO v_actor_email FROM auth.users WHERE id = v_actor;
  INSERT INTO public.support_audit_logs (actor_id, actor_email, action, target_type, target_id, details)
  VALUES (
    v_actor, v_actor_email, 'resend_ticket_email', 'order', p_order_id::text,
    jsonb_build_object(
      'recipients', to_jsonb(v_recipients),
      'outbox_ids', to_jsonb(v_outbox_ids),
      'recipient', v_first_recipient,
      'outbox_id', v_first_outbox_id,
      'is_admin', v_is_admin
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'recipient', v_first_recipient,
    'outbox_id', v_first_outbox_id,
    'recipients', to_jsonb(v_recipients),
    'outbox_ids', to_jsonb(v_outbox_ids)
  );
END;
$$;

-- Approved email changes queue one reissue notice and one necessary security
-- alert. The browser must not also call the full ticket-confirmation sender.
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
  v_new_email text;
  v_old_email text;
BEGIN
  SELECT * INTO v_req FROM public.support_email_change_requests
  WHERE id = p_request_id FOR UPDATE;

  IF v_req.id IS NULL OR v_req.status != 'pending_admin' THEN
    RAISE EXCEPTION 'Request not found or already reviewed';
  END IF;

  v_is_self := (v_req.requested_by = v_actor);
  v_new_email := lower(trim(v_req.new_email));
  v_old_email := lower(trim(v_req.old_email));

  IF p_approve THEN
    IF v_new_email !~* '^[^\s@]+@[^\s@]+\.[^\s@]+$' THEN
      RAISE EXCEPTION 'Invalid email address format';
    END IF;
    IF split_part(v_new_email, '@', 2) = 'local' OR split_part(v_new_email, '@', 2) LIKE '%.local' THEN
      RAISE EXCEPTION 'A deliverable email address is required';
    END IF;

    SELECT (e.start_datetime <= now()) INTO v_event_started
    FROM public.orders o
    JOIN public.events e ON e.id = o.event_id
    WHERE o.id = v_req.order_id;

    IF v_event_started THEN
      RAISE EXCEPTION 'Cannot change ticket recipient: Event has already started';
    END IF;

    SELECT EXISTS (
      SELECT 1 FROM public.tickets t
      JOIN public.order_items oi ON oi.id = t.order_item_id
      WHERE oi.order_id = v_req.order_id AND t.checked_in_at IS NOT NULL
    ) INTO v_any_scanned;

    IF v_any_scanned THEN
      RAISE EXCEPTION 'Cannot change recipient: One or more tickets for this order have already been checked in';
    END IF;

    IF v_old_email IS DISTINCT FROM v_new_email THEN
      UPDATE public.tickets
      SET ticket_code = gen_random_uuid(), attendee_email = v_new_email
      WHERE order_item_id IN (
        SELECT id FROM public.order_items WHERE order_id = v_req.order_id
      );

      UPDATE public.orders
      SET buyer_email = v_new_email, recipient_email = v_new_email, updated_at = now()
      WHERE id = v_req.order_id;

      PERFORM public.queue_email_outbox(
        v_req.order_id,
        v_new_email,
        'ticket_confirmation',
        jsonb_build_object('order_id', v_req.order_id, 'note', 'reissued'),
        'email-change:' || p_request_id::text || ':reissue'
      );

      PERFORM public.queue_email_outbox(
        v_req.order_id,
        v_old_email,
        'ticket_email_change_security_alert',
        jsonb_build_object('order_id', v_req.order_id, 'new_email', v_new_email),
        'email-change:' || p_request_id::text || ':security-alert'
      );
    END IF;

    UPDATE public.support_email_change_requests
    SET status = 'approved', reviewed_by = v_actor, reviewed_at = now(), updated_at = now()
    WHERE id = p_request_id;
  ELSE
    UPDATE public.support_email_change_requests
    SET status = 'rejected', reviewed_by = v_actor, reviewed_at = now(), updated_at = now()
    WHERE id = p_request_id;
  END IF;

  SELECT email INTO v_actor_email FROM auth.users WHERE id = v_actor;
  INSERT INTO public.support_audit_logs (actor_id, actor_email, action, target_type, target_id, details)
  VALUES (
    v_actor, v_actor_email,
    CASE WHEN p_approve THEN 'approve_email_change' ELSE 'reject_email_change' END,
    'email_change_request', p_request_id::text,
    jsonb_build_object('approved', p_approve, 'order_id', v_req.order_id, 'new_email', v_new_email, 'self_approved', v_is_self)
  );

  RETURN jsonb_build_object('success', true, 'approved', p_approve);
END;
$$;

REVOKE ALL ON FUNCTION public.support_resend_ticket_email(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.support_resend_ticket_email(uuid, uuid) TO authenticated;

-- Return whether the delivery address changed so callers only email a real
-- reassignment. Case-only edits normalize the stored value without rotating QR.
DROP FUNCTION IF EXISTS public.update_ticket_attendee(uuid, text, text);
CREATE OR REPLACE FUNCTION public.update_ticket_attendee(
  p_ticket_id uuid,
  p_attendee_name text,
  p_attendee_email text
) returns boolean
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_order_user_id uuid;
  v_order_id uuid;
  v_old_attendee_email text;
  v_event_id uuid;
  v_organizer_id uuid;
  v_new_email text := lower(trim(coalesce(p_attendee_email, '')));
  v_email_changed boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT o.user_id, o.id, t.attendee_email, o.event_id, e.organizer_id
  INTO v_order_user_id, v_order_id, v_old_attendee_email, v_event_id, v_organizer_id
  FROM public.tickets t
  JOIN public.order_items oi ON oi.id = t.order_item_id
  JOIN public.orders o ON o.id = oi.order_id
  JOIN public.events e ON e.id = o.event_id
  WHERE t.id = p_ticket_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ticket not found';
  END IF;

  IF v_order_user_id != auth.uid() AND v_organizer_id != auth.uid() THEN
    RAISE EXCEPTION 'Not authorized to modify this ticket';
  END IF;

  v_email_changed := nullif(v_new_email, '') IS NOT NULL
    AND v_new_email IS DISTINCT FROM lower(coalesce(v_old_attendee_email, ''));

  IF v_email_changed THEN
    UPDATE public.orders
    SET recipient_email = CASE WHEN lower(recipient_email) = lower(v_old_attendee_email) THEN v_new_email ELSE recipient_email END,
        buyer_email = CASE WHEN lower(buyer_email) = lower(v_old_attendee_email) THEN v_new_email ELSE buyer_email END
    WHERE id = v_order_id;

    DELETE FROM public.messages
    WHERE related_order_id = v_order_id
      AND lower(recipient_email) = lower(v_old_attendee_email);
  END IF;

  UPDATE public.tickets
  SET attendee_name = coalesce(nullif(trim(p_attendee_name), ''), attendee_name),
      ticket_code = CASE WHEN v_email_changed THEN gen_random_uuid() ELSE ticket_code END,
      attendee_email = CASE WHEN nullif(v_new_email, '') IS NOT NULL THEN v_new_email ELSE attendee_email END
  WHERE id = p_ticket_id;

  RETURN v_email_changed;
END;
$$;

REVOKE ALL ON FUNCTION public.update_ticket_attendee(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_ticket_attendee(uuid, text, text) TO authenticated, service_role;

ALTER TABLE public.waitlist_entries
  ADD COLUMN IF NOT EXISTS notified_at timestamptz;

-- A database trigger covers RPC cancellations, admin takedowns, and direct
-- status updates. Each transition has its own key, so a restored event can be
-- cancelled again later without suppressing the second legitimate notice.
CREATE OR REPLACE FUNCTION public.queue_event_status_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_template text;
  v_action_at timestamptz;
  v_recipient record;
  v_payload jsonb;
BEGIN
  IF TG_OP <> 'UPDATE' THEN
    RETURN NEW;
  END IF;

  IF NEW.status = 'cancelled' AND OLD.status IS DISTINCT FROM 'cancelled' THEN
    v_template := 'event_cancelled';
    v_action_at := coalesce(NEW.cancelled_at, now());
  ELSIF NEW.postponed_at IS NOT NULL AND NEW.postponed_at IS DISTINCT FROM OLD.postponed_at THEN
    v_template := 'event_postponed';
    v_action_at := NEW.postponed_at;
  ELSE
    RETURN NEW;
  END IF;

  v_payload := jsonb_build_object(
    'event_title', NEW.title,
    'event_url', 'https://tixnaija.name.ng/e/' || coalesce(NEW.slug, ''),
    'note', coalesce(NEW.organizer_note, ''),
    'new_start', CASE WHEN v_template = 'event_postponed' THEN to_char(NEW.start_datetime, 'YYYY-MM-DD"T"HH24:MI:SSOF') ELSE NULL END
  );

  FOR v_recipient IN
    SELECT DISTINCT ON (lower(r.email))
      lower(r.email) AS email,
      coalesce(nullif(r.name, ''), 'Attendee') AS name,
      r.order_id
    FROM (
      SELECT o.buyer_email AS email, o.buyer_name AS name, o.id AS order_id, o.created_at
      FROM public.orders o
      WHERE o.event_id = NEW.id
        AND o.status IN ('paid', 'comp')
        AND EXISTS (
          SELECT 1 FROM public.order_items oi
          JOIN public.tickets t ON t.order_item_id = oi.id
          WHERE oi.order_id = o.id AND t.status = 'valid'
        )
      UNION ALL
      SELECT t.attendee_email, t.attendee_name, o.id, t.created_at
      FROM public.orders o
      JOIN public.order_items oi ON oi.order_id = o.id
      JOIN public.tickets t ON t.order_item_id = oi.id
      WHERE o.event_id = NEW.id
        AND o.status IN ('paid', 'comp')
        AND t.status = 'valid'
    ) r
    WHERE r.email ~* '^[^\s@]+@[^\s@]+\.[^\s@]+$'
      AND split_part(lower(r.email), '@', 2) NOT LIKE '%.local'
    ORDER BY lower(r.email), r.created_at ASC
  LOOP
    PERFORM public.queue_email_outbox(
      v_recipient.order_id,
      v_recipient.email,
      v_template,
      v_payload || jsonb_build_object('recipient_name', v_recipient.name),
      v_template || ':' || NEW.id::text || ':' || v_action_at::text || ':' || v_recipient.email
    );
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_queue_event_status_email ON public.events;
CREATE TRIGGER trg_queue_event_status_email
AFTER UPDATE OF status, postponed_at ON public.events
FOR EACH ROW EXECUTE FUNCTION public.queue_event_status_email();

REVOKE ALL ON FUNCTION public.queue_event_status_email() FROM PUBLIC, anon, authenticated;
