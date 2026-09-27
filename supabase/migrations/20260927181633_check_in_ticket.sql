CREATE OR REPLACE FUNCTION public.check_in_ticket(p_ticket_code text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_ticket_id uuid;
    v_status public.ticket_status;
    v_checked_in_at timestamp with time zone;
    v_organizer_id uuid;
    v_attendee_name text;
    v_ticket_name text;
    v_caller_uid uuid;
BEGIN
    v_caller_uid := auth.uid();
    
    IF v_caller_uid IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Not authenticated');
    END IF;

    -- Lookup ticket details along with event organizer_id
    SELECT 
        t.id, t.status, t.checked_in_at, t.attendee_name, e.organizer_id, tt.name
    INTO 
        v_ticket_id, v_status, v_checked_in_at, v_attendee_name, v_organizer_id, v_ticket_name
    FROM public.tickets t
    JOIN public.order_items oi ON oi.id = t.order_item_id
    JOIN public.ticket_types tt ON tt.id = oi.ticket_type_id
    JOIN public.events e ON e.id = tt.event_id
    WHERE t.ticket_code = p_ticket_code;

    -- If ticket doesn't exist
    IF v_ticket_id IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Invalid ticket code');
    END IF;

    -- Ensure caller is the organizer (or add admin checks if needed in future)
    IF v_caller_uid != v_organizer_id THEN
        -- We could also check if auth.uid() is an admin from profiles table, but prompt asks to scope to events they own
        RETURN json_build_object('success', false, 'error', 'Unauthorized: You are not the organizer of this event');
    END IF;

    -- Check current status
    IF v_status = 'cancelled' THEN
        RETURN json_build_object('success', false, 'error', 'This ticket has been cancelled');
    END IF;

    IF v_status = 'checked_in' THEN
        RETURN json_build_object(
            'success', true, 
            'already_checked_in', true, 
            'checked_in_at', v_checked_in_at,
            'attendee_name', v_attendee_name,
            'ticket_name', v_ticket_name
        );
    END IF;

    -- Valid and unused -> Check in!
    UPDATE public.tickets
    SET 
        status = 'checked_in',
        checked_in_at = now(),
        checked_in_by = v_caller_uid
    WHERE id = v_ticket_id;

    RETURN json_build_object(
        'success', true, 
        'already_checked_in', false,
        'checked_in_at', now(),
        'attendee_name', v_attendee_name,
        'ticket_name', v_ticket_name
    );
END;
$$;
