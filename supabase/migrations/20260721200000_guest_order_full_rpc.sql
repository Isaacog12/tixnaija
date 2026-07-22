create or replace function public.get_guest_order_full(p_order_id uuid, p_email text, p_access_code text)
returns jsonb
language sql
security definer
set search_path = public
as $$
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
  )
  from orders o
  where o.id = p_order_id
    and lower(o.buyer_email) = lower(p_email)
    and o.access_code = p_access_code
    and o.status = 'paid';
$$;

grant execute on function public.get_guest_order_full(uuid, text, text) to anon, authenticated;
