-- Fix admin_cancel_event to use order_item_id instead of order_id
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
  SET status        = 'cancelled',
      cancelled_at  = now(),
      organizer_note = COALESCE(p_note, 'Taken down by platform admin.')
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
      user_email, event_id, subject, body, action_url, action_text
    ) VALUES (
      v_buyer.buyer_email,
      p_event_id,
      'Event Cancelled: ' || v_event.title,
      'This event has been taken down by the platform. ' || COALESCE(p_note, '') ||
      ' Please expect a refund to your original payment method.',
      '/orders/' || v_buyer.order_id || '/tickets',
      'View Details'
    );
  END LOOP;
END;
$$;
