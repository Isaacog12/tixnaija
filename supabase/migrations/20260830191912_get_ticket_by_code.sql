-- Create a secure RPC function to fetch ticket details by ticket_code, bypassing RLS.
-- This allows anyone with the secret link to view the ticket stub.
CREATE OR REPLACE FUNCTION public.get_ticket_by_code(p_ticket_code UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ticket JSON;
BEGIN
  SELECT json_build_object(
    'id', t.id,
    'order_item_id', t.order_item_id,
    'ticket_code', t.ticket_code,
    'status', t.status,
    'attendee_name', t.attendee_name,
    'attendee_email', t.attendee_email,
    'checked_in_at', t.checked_in_at,
    'created_at', t.created_at,
    'order_items', json_build_object(
      'order_id', oi.order_id,
      'ticket_types', json_build_object(
        'id', tt.id,
        'name', tt.name,
        'price_kobo', tt.price_kobo,
        'description', tt.description
      ),
      'orders', json_build_object(
        'id', o.id,
        'buyer_name', o.buyer_name,
        'buyer_email', o.buyer_email,
        'created_at', o.created_at,
        'events', json_build_object(
          'id', e.id,
          'title', e.title,
          'slug', e.slug,
          'description', e.description,
          'city', e.city,
          'state', e.state,
          'address', e.address,
          'venue_name', e.venue_name,
          'start_datetime', e.start_datetime,
          'end_datetime', e.end_datetime,
          'cover_image_url', e.cover_image_url
        )
      )
    )
  )
  INTO v_ticket
  FROM public.tickets t
  JOIN public.order_items oi ON oi.id = t.order_item_id
  JOIN public.orders o ON o.id = oi.order_id
  JOIN public.ticket_types tt ON tt.id = oi.ticket_type_id
  JOIN public.events e ON e.id = o.event_id
  WHERE t.ticket_code = p_ticket_code;

  RETURN v_ticket;
END;
$$;
