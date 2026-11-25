-- Close the assistant's feedback loop, and bound what it keeps.
--
-- The bot has written every question to support_bot_queries since
-- 20261118120000_support_desk_features.sql, but nothing read it, so extending
-- the intent rules was guesswork. This adds a staff-readable rollup of what the
-- assistant could not answer, plus a retention window — the table stores
-- customer message text, so it should not live forever.

-- ---------------------------------------------------------------------------
-- 1. Gap rollup
-- ---------------------------------------------------------------------------
-- security_invoker keeps the base table's staff-only policy in force; the view
-- must not become a way around it.
CREATE OR REPLACE VIEW public.support_bot_gaps
WITH (security_invoker = true) AS
SELECT
  coalesce(matched_intent, 'unknown') AS matched_intent,
  count(*)                            AS questions,
  count(*) FILTER (WHERE escalated)   AS escalated,
  count(DISTINCT session_id)          AS sessions,
  min(created_at)                     AS first_seen,
  max(created_at)                     AS last_seen
FROM public.support_bot_queries
WHERE created_at > now() - interval '30 days'
GROUP BY coalesce(matched_intent, 'unknown');

COMMENT ON VIEW public.support_bot_gaps IS
  'Last 30 days of assistant traffic grouped by matched intent, with escalation counts. A high escalated count on unknown means the intent rules are missing a phrasing customers actually use.';

REVOKE ALL ON public.support_bot_gaps FROM PUBLIC, anon;
GRANT SELECT ON public.support_bot_gaps TO authenticated;

-- ---------------------------------------------------------------------------
-- 2. Retention
-- ---------------------------------------------------------------------------
-- Unscheduled first so replaying this migration cannot leave two competing jobs
-- behind (same pattern as 20261112120500_schedule_email_outbox_worker.sql).
CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$
DECLARE
  v_job record;
BEGIN
  FOR v_job IN
    SELECT jobid FROM cron.job WHERE jobname = 'purge_support_bot_queries_daily'
  LOOP
    PERFORM cron.unschedule(v_job.jobid);
  END LOOP;
END;
$$;

SELECT cron.schedule(
  'purge_support_bot_queries_daily',
  '15 4 * * *',
  $job$
    DELETE FROM public.support_bot_queries
     WHERE created_at < now() - interval '180 days';
  $job$
);
