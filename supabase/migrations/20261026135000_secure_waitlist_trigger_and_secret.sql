-- Secure waitlist database trigger with dedicated internal secret
-- Replaces usage of public anon key with a dedicated internal trigger secret.

CREATE OR REPLACE FUNCTION public.trigger_waitlist_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_waitlist_count integer;
  v_supabase_url text;
  v_trigger_secret text;
BEGIN
  -- Only trigger if available spots increased and are greater than 0
  IF (NEW.quantity_available - (NEW.quantity_sold - NEW.quantity_cancelled)) > (OLD.quantity_available - (OLD.quantity_sold - OLD.quantity_cancelled)) 
     AND (NEW.quantity_available - (NEW.quantity_sold - NEW.quantity_cancelled)) > 0 THEN
     
     -- Check if there is anyone on the waitlist for this tier
     SELECT count(*) INTO v_waitlist_count 
     FROM public.waitlist_entries 
     WHERE ticket_tier_id = NEW.id AND status = 'waiting';
     
     IF v_waitlist_count > 0 THEN
       v_supabase_url := coalesce(
         current_setting('app.settings.supabase_url', true),
         'https://bjijftxksykbjknbleul.supabase.co'
       );
       v_trigger_secret := coalesce(
         current_setting('app.settings.internal_trigger_secret', true),
         'tix_internal_waitlist_sec_9942a0e7d5b14c8f'
       );
       
       IF v_supabase_url IS NOT NULL AND v_trigger_secret IS NOT NULL THEN
         PERFORM net.http_post(
             url:=v_supabase_url || '/functions/v1/notify-waitlist',
             headers:=json_build_object(
                 'Content-Type', 'application/json', 
                 'Authorization', 'Bearer ' || v_trigger_secret,
                 'x-internal-trigger-secret', v_trigger_secret
             )::jsonb,
             body:=json_build_object('ticket_tier_id', NEW.id)::jsonb
         );
       END IF;
     END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Drop obsolete waitlist trigger that called handle_ticket_tier_waitlist()
DROP TRIGGER IF EXISTS on_ticket_tier_update ON public.ticket_types;

-- Recreate trigger pointing to the secured notification function
CREATE TRIGGER on_ticket_tier_update
  AFTER UPDATE ON public.ticket_types
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_waitlist_notification();

