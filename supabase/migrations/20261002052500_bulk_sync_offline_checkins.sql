create or replace function public.bulk_sync_offline_checkins(p_scans jsonb)
returns json
language plpgsql
security definer
as $$
declare
    v_caller_uid uuid;
    v_scan jsonb;
    v_ticket_code text;
    v_scanned_at timestamp with time zone;
    
    v_ticket_id uuid;
    v_status public.ticket_status;
    v_organizer_id uuid;
    
    v_success_count int := 0;
    v_fail_count int := 0;
begin
    v_caller_uid := auth.uid();
    
    if v_caller_uid is null then
        return json_build_object('success', false, 'error', 'Not authenticated');
    end if;

    -- p_scans is a JSON array: [{"ticket_code": "...", "scanned_at": "..."}, ...]
    for v_scan in select * from jsonb_array_elements(p_scans)
    loop
        v_ticket_code := v_scan->>'ticket_code';
        v_scanned_at := (v_scan->>'scanned_at')::timestamp with time zone;
        
        -- Lookup ticket
        select 
            t.id, t.status, e.organizer_id
        into 
            v_ticket_id, v_status, v_organizer_id
        from public.tickets t
        join public.order_items oi on oi.id = t.order_item_id
        join public.ticket_types tt on tt.id = oi.ticket_type_id
        join public.events e on e.id = tt.event_id
        where t.ticket_code = v_ticket_code
        for update of t;
        
        -- Skip invalid or unauthorized
        if v_ticket_id is null or v_organizer_id != v_caller_uid then
            v_fail_count := v_fail_count + 1;
            continue;
        end if;
        
        -- If already checked in or cancelled, it fails
        if v_status != 'valid' then
            v_fail_count := v_fail_count + 1;
            continue;
        end if;
        
        -- Check in
        update public.tickets
        set 
            status = 'checked_in',
            checked_in_at = v_scanned_at,
            checked_in_by = v_caller_uid
        where id = v_ticket_id;
        
        v_success_count := v_success_count + 1;
    end loop;

    return json_build_object(
        'success', true, 
        'synced_count', v_success_count,
        'failed_count', v_fail_count
    );
end;
$$;
