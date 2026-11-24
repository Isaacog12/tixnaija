-- Admins may permanently delete sold and sold-out events.
--
-- The previous RPC refused a purge while any paid buyer lacked a processed
-- refund or any refund request remained open. An explicit admin purge is now
-- allowed in those cases. Refund requests survive with their event/ticket
-- references cleared, and the audit log records the outstanding obligations.

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
  v_summary jsonb;
  v_event   record;
  v_caller  uuid := auth.uid();
  v_email   text;
  v_orders        integer := 0;
  v_tickets       integer := 0;
  v_buyers        integer := 0;
  v_paid_unrefunded integer := 0;
  v_open_refunds  integer := 0;
  v_revenue_kobo  bigint  := 0;
  v_refunded_kobo bigint  := 0;
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

  -- Same numbers the admin saw in the dialog.
  v_summary := public.admin_event_deletion_preview(p_event_id);
  v_orders        := (v_summary ->> 'orders')::integer;
  v_tickets       := (v_summary ->> 'tickets')::integer;
  v_buyers        := (v_summary ->> 'buyers')::integer;
  v_paid_unrefunded := (v_summary ->> 'paid_unrefunded')::integer;
  v_open_refunds  := (v_summary ->> 'open_refunds')::integer;
  v_revenue_kobo  := (v_summary ->> 'revenue_kobo')::bigint;
  v_refunded_kobo := (v_summary ->> 'refunded_kobo')::bigint;

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
    -- Refund requests are never deleted: they are the record of money returned.
    -- Their event_id/ticket_id fall to NULL on their own, so they outlive the
    -- event.
    --
    -- Then tickets (order_items.ticket_type_id is RESTRICT), then the orders
    -- holding the event in place (orders.event_id is RESTRICT), then the event
    -- itself, which cascades the remaining child rows.
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
      'revenue_kobo', v_revenue_kobo,
      'refunded_kobo', v_refunded_kobo,
      'paid_unrefunded', v_paid_unrefunded,
      'open_refunds', v_open_refunds,
      'money_owed', (v_paid_unrefunded > 0 OR v_open_refunds > 0),
      'refund_records_kept', true,
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
