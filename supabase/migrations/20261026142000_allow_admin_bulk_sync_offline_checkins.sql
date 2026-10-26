-- Allow Admins to perform bulk offline check-in sync, matching check_in_ticket RPC
-- Prevents admin bulk sync requests from failing with unauthorized error count.

CREATE OR REPLACE FUNCTION public.bulk_sync_offline_checkins(p_scans jsonb)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_caller_uid uuid;
    v_scan jsonb;
    v_ticket_code text;
    v_scanned_at timestamp with time zone;
    
    v_ticket_id uuid;
    v_status public.ticket_status;
    v_organizer_id uuid;
    v_is_admin boolean := false;
    
    v_success_count int := 0;
    v_fail_count int := 0;
BEGIN
    v_caller_uid := auth.uid();
    
    IF v_caller_uid IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Not authenticated');
    END IF;

    -- Check if caller is admin
    SELECT EXISTS (
        SELECT 1 FROM public.user_roles WHERE user_id = v_caller_uid AND role = 'admin'
    ) INTO v_is_admin;

    -- p_scans is a JSON array: [{"ticket_code": "...", "scanned_at": "..."}, ...]
    FOR v_scan IN SELECT * FROM jsonb_array_elements(p_scans)
    LOOP
        v_ticket_code := v_scan->>'ticket_code';
        v_scanned_at := (v_scan->>'scanned_at')::timestamp with time zone;
        
        -- Lookup ticket
        SELECT 
            t.id, t.status, e.organizer_id
        INTO 
            v_ticket_id, v_status, v_organizer_id
        FROM public.tickets t
        JOIN public.order_items oi ON oi.id = t.order_item_id
        JOIN public.ticket_types tt ON tt.id = oi.ticket_type_id
        JOIN public.events e ON e.id = tt.event_id
        WHERE t.ticket_code = v_ticket_code
        FOR UPDATE OF t;
        
        -- Skip invalid or unauthorized (caller must be event organizer or platform admin)
        IF v_ticket_id IS NULL OR (v_organizer_id != v_caller_uid AND NOT v_is_admin) THEN
            v_fail_count := v_fail_count + 1;
            CONTINUE;
        END IF;
        
        -- If already checked in or cancelled, skip
        IF v_status != 'valid' THEN
            v_fail_count := v_fail_count + 1;
            CONTINUE;
        END IF;
        
        -- Mark as checked in
        UPDATE public.tickets
        SET 
            status = 'checked_in',
            checked_in_at = v_scanned_at,
            checked_in_by = v_caller_uid
        WHERE id = v_ticket_id;
        
        v_success_count := v_success_count + 1;
    END LOOP;

    RETURN json_build_object(
        'success', true, 
        'synced_count', v_success_count, 
        'failed_count', v_fail_count
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.bulk_sync_offline_checkins(jsonb) TO authenticated;
