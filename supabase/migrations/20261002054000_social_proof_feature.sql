ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_public boolean DEFAULT false;

CREATE OR REPLACE FUNCTION public.get_event_attendees(p_event_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_caller_uid uuid;
  v_caller_is_public boolean := false;
  v_total_attendees int := 0;
  v_public_attendees json := '[]'::json;
BEGIN
  v_caller_uid := auth.uid();
  
  -- Check if caller is logged in and what their visibility setting is
  IF v_caller_uid IS NOT NULL THEN
    SELECT is_public INTO v_caller_is_public FROM public.profiles WHERE id = v_caller_uid;
  END IF;

  -- Count how many distinct people have bought tickets
  SELECT COUNT(DISTINCT o.user_id) INTO v_total_attendees
  FROM public.tickets t
  JOIN public.order_items oi ON oi.id = t.order_item_id
  JOIN public.ticket_types tt ON tt.id = oi.ticket_type_id
  JOIN public.orders o ON o.id = oi.order_id
  WHERE tt.event_id = p_event_id
  AND o.status = 'paid';

  -- If caller is public (or if the user wants to allow organizers to see, but let's stick to the privacy rule for everyone), fetch 5 random avatars
  IF coalesce(v_caller_is_public, false) = true THEN
    
    WITH unique_buyers AS (
      SELECT DISTINCT o.user_id
      FROM public.tickets t
      JOIN public.order_items oi ON oi.id = t.order_item_id
      JOIN public.ticket_types tt ON tt.id = oi.ticket_type_id
      JOIN public.orders o ON o.id = oi.order_id
      WHERE tt.event_id = p_event_id
      AND o.status = 'paid'
    )
    SELECT coalesce(json_agg(
      json_build_object(
        'first_name', split_part(p.full_name, ' ', 1),
        'avatar_url', p.avatar_url,
        'user_id', p.id
      )
    ), '[]'::json) INTO v_public_attendees
    FROM (
      SELECT p.id, p.full_name, p.avatar_url
      FROM unique_buyers ub
      JOIN public.profiles p ON p.id = ub.user_id
      WHERE p.is_public = true
        AND p.id != v_caller_uid -- Don't show the caller their own face in the FOMO list
      ORDER BY random()
      LIMIT 5
    ) p;

  END IF;

  RETURN json_build_object(
    'total_count', v_total_attendees,
    'can_view_avatars', coalesce(v_caller_is_public, false),
    'attendees', coalesce(v_public_attendees, '[]'::json)
  );
END;
$$;
