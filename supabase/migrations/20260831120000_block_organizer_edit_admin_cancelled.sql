-- ============================================================
-- Add admin_cancelled flag to prevent organizers from
-- modifying events that were cancelled by an admin
-- ============================================================

-- 1. Add the flag column
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS admin_cancelled boolean NOT NULL DEFAULT false;

-- 2. Update admin_cancel_event RPC to set the flag
CREATE OR REPLACE FUNCTION public.admin_cancel_event(
  p_event_id uuid,
  p_note text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_buyer  record;
  v_event  record;
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
  IF v_event.status = 'cancelled' THEN RAISE EXCEPTION 'Event is already cancelled'; END IF;

  UPDATE public.events
  SET status          = 'cancelled',
      cancelled_at    = now(),
      admin_cancelled = true,
      organizer_note  = COALESCE(p_note, 'Taken down by platform admin.')
  WHERE id = p_event_id;

  -- Notify all buyers with valid tickets
  FOR v_buyer IN
    SELECT DISTINCT o.buyer_email, o.id AS order_id
    FROM public.orders o
    JOIN public.order_items oi ON oi.order_id = o.id
    JOIN public.tickets t ON t.order_item_id = oi.id
    WHERE o.event_id = p_event_id AND t.status = 'valid'
  LOOP
    INSERT INTO public.messages (
      recipient_email, type, title, body, related_order_id
    ) VALUES (
      v_buyer.buyer_email,
      'event_update',
      'Event Cancelled: ' || v_event.title,
      'This event has been taken down by the platform. ' || COALESCE(p_note, '') ||
      ' Please expect a refund to your original payment method.',
      v_buyer.order_id
    );
  END LOOP;
END;
$$;

-- 3. Replace the organizer update policy to block edits on admin-cancelled events
DROP POLICY IF EXISTS "events_organizer_update_own" ON public.events;

CREATE POLICY "events_organizer_update_own" ON public.events
  FOR UPDATE TO authenticated
  USING (
    auth.uid() = organizer_id
    AND admin_cancelled = false
  )
  WITH CHECK (
    auth.uid() = organizer_id
    AND admin_cancelled = false
  );

-- 4. Also prevent organizer cancel_event RPC from un-cancelling admin-cancelled events
CREATE OR REPLACE FUNCTION public.cancel_event(
  p_event_id uuid,
  p_note text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_buyer record;
  v_event record;
BEGIN
  SELECT * INTO v_event FROM public.events WHERE id = p_event_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Event not found'; END IF;
  IF v_event.admin_cancelled THEN
    RAISE EXCEPTION 'This event was cancelled by a platform admin and cannot be modified.';
  END IF;

  UPDATE public.events
  SET status = 'cancelled',
      cancelled_at = now(),
      organizer_note = p_note
  WHERE id = p_event_id;

  -- Notify buyers (only those with valid tickets)
  FOR v_buyer IN
    SELECT DISTINCT o.buyer_email, o.id as order_id
    FROM public.orders o
    JOIN public.order_items oi ON oi.order_id = o.id
    JOIN public.tickets t ON t.order_item_id = oi.id
    WHERE o.event_id = p_event_id AND t.status = 'valid'
  LOOP
    INSERT INTO public.messages (
      recipient_email, type, title, body, related_order_id
    ) VALUES (
      v_buyer.buyer_email,
      'event_update',
      'Event Cancelled: ' || v_event.title,
      'This event has been cancelled by the organizer. ' || COALESCE(p_note, 'No further details were provided.') || ' Please expect a refund to your original payment method in accordance with our terms.',
      v_buyer.order_id
    );
  END LOOP;
END;
$$;

-- 5. Also protect postpone_event from admin-cancelled events
CREATE OR REPLACE FUNCTION public.postpone_event(
  p_event_id uuid,
  p_new_start timestamptz,
  p_new_end timestamptz,
  p_note text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_buyer record;
  v_event record;
BEGIN
  SELECT * INTO v_event FROM public.events WHERE id = p_event_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Event not found'; END IF;
  IF v_event.admin_cancelled THEN
    RAISE EXCEPTION 'This event was cancelled by a platform admin and cannot be modified.';
  END IF;

  UPDATE public.events
  SET start_datetime = p_new_start,
      end_datetime = p_new_end,
      postponed_at = now(),
      organizer_note = p_note
  WHERE id = p_event_id;

  -- Notify buyers
  FOR v_buyer IN
    SELECT DISTINCT o.buyer_email, o.id as order_id
    FROM public.orders o
    JOIN public.order_items oi ON oi.order_id = o.id
    JOIN public.tickets t ON t.order_item_id = oi.id
    WHERE o.event_id = p_event_id AND t.status = 'valid'
  LOOP
    INSERT INTO public.messages (
      recipient_email, type, title, body, related_order_id
    ) VALUES (
      v_buyer.buyer_email,
      'event_update',
      'Event Postponed: ' || v_event.title,
      'This event has been postponed. The new start date is ' || to_char(p_new_start, 'FMMonth FMDD, YYYY') || '. ' || COALESCE(p_note, '') || ' Your existing ticket remains valid for the new date.',
      v_buyer.order_id
    );
  END LOOP;
END;
$$;
