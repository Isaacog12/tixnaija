-- Replace the public API key cron headers with a server-only Vault secret.
-- Store the same random value as the Edge Function secret CRON_SECRET and as
-- the Vault secret named tixnaija_cron_secret before these jobs run.
-- The waitlist notification trigger uses WAITLIST_TRIGGER_SECRET from Edge
-- Function secrets and the matching Vault secret waitlist_trigger_secret.
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

DO $$
DECLARE
  v_job record;
BEGIN
  FOR v_job IN
    SELECT jobid
    FROM cron.job
    WHERE jobname IN ('send_event_reminders_hourly', 'send_abandoned_reminders_hourly')
  LOOP
    PERFORM cron.unschedule(v_job.jobid);
  END LOOP;
END;
$$;

SELECT cron.schedule(
  'send_event_reminders_hourly',
  '0 * * * *',
  $job$
    SELECT net.http_post(
      url := 'https://bjijftxksykbjknbleul.supabase.co/functions/v1/send-event-reminders',
      headers := jsonb_build_object('x-cron-secret', secret.decrypted_secret),
      body := '{}'::jsonb
    )
    FROM vault.decrypted_secrets AS secret
    WHERE secret.name = 'tixnaija_cron_secret';
  $job$
);

SELECT cron.schedule(
  'send_abandoned_reminders_hourly',
  '0 * * * *',
  $job$
    SELECT net.http_post(
      url := 'https://bjijftxksykbjknbleul.supabase.co/functions/v1/send-abandoned-reminders',
      headers := jsonb_build_object('x-cron-secret', secret.decrypted_secret),
      body := '{}'::jsonb
    )
    FROM vault.decrypted_secrets AS secret
    WHERE secret.name = 'tixnaija_cron_secret';
  $job$
);
