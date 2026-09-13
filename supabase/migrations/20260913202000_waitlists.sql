-- Enable pg_net for webhook calls if not exists
CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE TABLE public.waitlist_entries (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  ticket_tier_id uuid references public.ticket_types(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  name text not null,
  email text not null,
  status text not null default 'waiting',
  created_at timestamptz not null default now()
);

-- prevent duplicate active waitlist entries for the same user per tier
CREATE UNIQUE INDEX waitlist_unique_idx ON public.waitlist_entries(email, event_id, coalesce(ticket_tier_id, '00000000-0000-0000-0000-000000000000'::uuid)) WHERE status = 'waiting';

-- Enable RLS
ALTER TABLE public.waitlist_entries ENABLE ROW LEVEL SECURITY;

-- Organizers can manage waitlists for their events
CREATE POLICY "waitlist_organizer_manage" ON public.waitlist_entries 
FOR ALL TO authenticated 
USING (exists (select 1 from public.events e where e.id = event_id and e.organizer_id = auth.uid())) 
WITH CHECK (exists (select 1 from public.events e where e.id = event_id and e.organizer_id = auth.uid()));

-- Anyone can insert into waitlist
CREATE POLICY "waitlist_insert" ON public.waitlist_entries 
FOR INSERT TO public 
WITH CHECK (true);

-- Add additive quantity_cancelled to calculate remaining spots dynamically without changing quantity_sold
ALTER TABLE public.ticket_types ADD COLUMN quantity_cancelled integer not null default 0;

-- Trigger to notify waitlist via Edge Function when inventory frees up
CREATE OR REPLACE FUNCTION public.handle_ticket_tier_waitlist()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_supabase_url text;
  v_anon_key text;
  v_waitlist_count integer;
BEGIN
  -- Only trigger if available spots increased and are greater than 0
  IF (NEW.quantity_available - (NEW.quantity_sold - NEW.quantity_cancelled)) > (OLD.quantity_available - (OLD.quantity_sold - OLD.quantity_cancelled)) 
     AND (NEW.quantity_available - (NEW.quantity_sold - NEW.quantity_cancelled)) > 0 THEN
     
     -- Check if there is anyone on the waitlist for this tier
     SELECT count(*) INTO v_waitlist_count 
     FROM public.waitlist_entries 
     WHERE ticket_tier_id = NEW.id AND status = 'waiting';
     
     IF v_waitlist_count > 0 THEN
       v_supabase_url := current_setting('app.settings.supabase_url', true);
       v_anon_key := current_setting('app.settings.anon_key', true);
       
       IF v_supabase_url IS NOT NULL AND v_anon_key IS NOT NULL THEN
         PERFORM net.http_post(
             url:=v_supabase_url || '/functions/v1/notify-waitlist',
             headers:=json_build_object(
                 'Content-Type', 'application/json', 
                 'Authorization', 'Bearer ' || v_anon_key
             )::jsonb,
             body:=json_build_object('ticket_tier_id', NEW.id)::jsonb
         );
       END IF;
     END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_ticket_tier_update
  AFTER UPDATE ON public.ticket_types
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_ticket_tier_waitlist();


-- Update the cancel_ticket RPC to increment quantity_cancelled instead of touching quantity_sold
create or replace function public.cancel_ticket(p_ticket_id uuid)
returns void
language plpgsql security definer
as $$
declare
  v_organizer_id uuid;
  v_ticket_tier_id uuid;
begin
  -- Ensure the caller is authenticated
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  -- Verify the ticket belongs to an event owned by the caller
  select e.organizer_id, oi.ticket_type_id 
  into v_organizer_id, v_ticket_tier_id
  from public.tickets t
  join public.order_items oi on oi.id = t.order_item_id
  join public.orders o on o.id = oi.order_id
  join public.events e on e.id = o.event_id
  where t.id = p_ticket_id;

  if not found then
    raise exception 'Ticket not found';
  end if;

  if v_organizer_id != auth.uid() then
    raise exception 'Not authorized to modify this ticket';
  end if;

  -- Update the ticket status to cancelled
  update public.tickets
  set status = 'cancelled'
  where id = p_ticket_id;

  -- Increment quantity_cancelled on the ticket_type to free up inventory for waitlist dynamically
  if v_ticket_tier_id is not null then
    update public.ticket_types
    set quantity_cancelled = quantity_cancelled + 1
    where id = v_ticket_tier_id;
  end if;

end;
$$;
