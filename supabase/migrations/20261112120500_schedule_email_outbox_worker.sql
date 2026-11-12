-- Migration: Schedule the email_outbox worker.
--
-- email_outbox is drained by the process-email-outbox Edge Function, but no
-- cron job was ever created for it. Rows written by the support portal (ticket
-- resends, approved email-change reissues, support case replies) accumulated in
-- 'pending' indefinitely - the oldest visible rows date from 2026-10-24 with
-- retry_count = 0, which only happens if the worker is never invoked.
--
-- Mirrors 20261027130000_secure_email_job_cron.sql: the shared Vault secret
-- tixnaija_cron_secret is sent as x-cron-secret, so no API key material is
-- stored in cron.job. If the Vault secret is absent the SELECT yields no rows
-- and the job is a harmless no-op rather than a failing request.
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

DO $$
DECLARE
  v_job record;
BEGIN
  FOR v_job IN
    SELECT jobid FROM cron.job WHERE jobname = 'process_email_outbox'
  LOOP
    PERFORM cron.unschedule(v_job.jobid);
  END LOOP;
END;
$$;

SELECT cron.schedule(
  'process_email_outbox',
  '*/2 * * * *',
  $job$
    SELECT net.http_post(
      url := 'https://bjijftxksykbjknbleul.supabase.co/functions/v1/process-email-outbox',
      headers := jsonb_build_object('x-cron-secret', secret.decrypted_secret),
      body := '{}'::jsonb
    )
    FROM vault.decrypted_secrets AS secret
    WHERE secret.name = 'tixnaija_cron_secret';
  $job$
);
