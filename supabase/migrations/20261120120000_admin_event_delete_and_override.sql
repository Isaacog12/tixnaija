-- ============================================================
-- ADMIN EVENT OVERWRITE + DELETE
--
-- Admins can already read and update any event. This adds:
--   1. soft-delete markers, so an event can be removed from the app
--      while its orders, tickets and payout records stay in place;
--   2. an admin DELETE policy on events;
--   3. admin_delete_event(), which cancels and notifies buyers first,
--      then either keeps the records or purges every row belonging to
--      the event (orders included).
-- ============================================================

-- 1. Soft-delete markers
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS deletion_reason text;

CREATE INDEX IF NOT EXISTS events_deleted_at_idx ON public.events (deleted_at);

-- 2. Admins may delete any event row
DROP POLICY IF EXISTS "events_admin_delete_all" ON public.events;

CREATE POLICY "events_admin_delete_all" ON public.events
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 3. Admin delete RPC
CREATE OR REPLACE FUNCTION public.admin_delete_event(
  p_event_id uuid,
  p_mode text,
  p_note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event   record;
  v_caller  uuid := auth.uid();
  v_email   text;
  v_orders  integer := 0;
  v_tickets integer := 0;
  v_buyers  integer := 0;
BEGIN
  IF v_caller IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = v_caller AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Unauthorized: admin access required';
  END IF;

  IF p_mode IS NULL OR p_mode NOT IN ('keep_records', 'purge') THEN
    RAISE EXCEPTION 'Invalid delete mode: %', p_mode;
  END IF;

  SELECT * INTO v_event FROM public.events WHERE id = p_event_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Event not found'; END IF;

  SELECT count(*) INTO v_orders
    FROM public.orders WHERE event_id = p_event_id;

  SELECT count(*) INTO v_tickets
    FROM public.tickets t
    JOIN public.order_items oi ON oi.id = t.order_item_id
    JOIN public.orders o ON o.id = oi.order_id
   WHERE o.event_id = p_event_id;

  SELECT count(DISTINCT o.buyer_email) INTO v_buyers
    FROM public.orders o WHERE o.event_id = p_event_id;

  -- Buyers are told before anything disappears. admin_cancel_event raises when
  -- the event is already cancelled, so only call it while it is still live.
  IF v_event.status <> 'cancelled' THEN
    PERFORM public.admin_cancel_event(
      p_event_id,
      COALESCE(p_note, 'Deleted by platform admin.')
    );
  END IF;

  IF p_mode = 'keep_records' THEN
    -- Out of the app, but orders, tickets and payouts stay for accounting.
    UPDATE public.events
       SET status          = 'cancelled',
           admin_cancelled = true,
           deleted_at      = now(),
           deleted_by      = v_caller,
           deletion_reason = COALESCE(p_note, 'Removed by platform admin.')
     WHERE id = p_event_id;
  ELSE
    -- Refund history, then tickets (order_items.ticket_type_id is RESTRICT),
    -- then the orders holding the event in place (orders.event_id is RESTRICT),
    -- then the event itself, which cascades the remaining child rows.
    DELETE FROM public.refund_requests WHERE event_id = p_event_id;

    DELETE FROM public.tickets
     WHERE order_item_id IN (
       SELECT oi.id
         FROM public.order_items oi
         JOIN public.orders o ON o.id = oi.order_id
        WHERE o.event_id = p_event_id
     )
        OR order_item_id IN (
       SELECT oi.id
         FROM public.order_items oi
         JOIN public.ticket_types tt ON tt.id = oi.ticket_type_id
        WHERE tt.event_id = p_event_id
     );

    DELETE FROM public.orders WHERE event_id = p_event_id;

    DELETE FROM public.events WHERE id = p_event_id;
  END IF;

  SELECT email INTO v_email FROM auth.users WHERE id = v_caller;

  INSERT INTO public.support_audit_logs (
    actor_id, actor_email, action, target_type, target_id, details
  ) VALUES (
    v_caller,
    v_email,
    CASE WHEN p_mode = 'purge' THEN 'event_purged' ELSE 'event_removed' END,
    'event',
    p_event_id::text,
    jsonb_build_object(
      'mode', p_mode,
      'title', v_event.title,
      'slug', v_event.slug,
      'organizer_id', v_event.organizer_id,
      'orders_affected', v_orders,
      'tickets_affected', v_tickets,
      'buyers_affected', v_buyers,
      'note', p_note
    )
  );

  RETURN jsonb_build_object(
    'mode', p_mode,
    'title', v_event.title,
    'orders', v_orders,
    'tickets', v_tickets,
    'buyers', v_buyers
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_delete_event(uuid, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_delete_event(uuid, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_delete_event(uuid, text, text) TO authenticated;
