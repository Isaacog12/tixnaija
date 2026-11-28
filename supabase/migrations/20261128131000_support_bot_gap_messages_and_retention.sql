-- What customers actually typed when the assistant had no answer, and a shorter
-- retention window for the text that makes that possible.
--
-- support_bot_gaps (20261125120000) groups traffic by intent. That shows which
-- topic is failing but not the phrasing, so the rules could still only be
-- extended by guessing. This view groups the normalised message text itself,
-- which is what a new rule or knowledge entry is written from.
--
-- security_invoker keeps the base table's staff-only policy in force: the view
-- must not become a way around it.

CREATE OR REPLACE VIEW public.support_bot_gap_messages
WITH (security_invoker = true) AS
SELECT
  btrim(regexp_replace(lower(coalesce(q.message, '')), '[^a-z0-9]+', ' ', 'g')) AS normalised_message,
  coalesce(q.matched_intent, 'unknown') AS matched_intent,
  count(*)                              AS seen,
  count(*) FILTER (WHERE q.escalated)   AS escalated,
  max(q.created_at)                     AS last_seen
FROM public.support_bot_queries q
WHERE q.created_at > now() - interval '30 days'
  AND coalesce(q.matched_intent, 'unknown') IN ('unknown', 'technical', 'app')
GROUP BY 1, 2
HAVING count(*) >= 2
ORDER BY seen DESC;

COMMENT ON VIEW public.support_bot_gap_messages IS
  'Last 30 days of unmatched or escalated assistant messages, grouped by normalised text with a count and last-seen date. Read this before adding an intent phrase or a knowledge entry.';

REVOKE ALL ON public.support_bot_gap_messages FROM PUBLIC, anon;
GRANT SELECT ON public.support_bot_gap_messages TO authenticated;

-- ---------------------------------------------------------------------------
-- Retention: 30 days, not 180
-- ---------------------------------------------------------------------------
-- The table stores customer message text. Thirty days is enough to spot a gap
-- and write a rule for it; six months of chat text for no product reason is not
-- a reasonable trade. Redaction of addresses, phones, references and long digit
-- runs happens in the Edge Function before the insert, and this bound limits
-- whatever still gets through.
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
     WHERE created_at < now() - interval '30 days';
  $job$
);
