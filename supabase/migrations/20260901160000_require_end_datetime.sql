-- =============================================================================
-- Migration: Require end_datetime on events & auto-complete past events
-- =============================================================================

-- 1. Backfill: set end_datetime = start_datetime + 3 hours for existing rows
UPDATE public.events
SET end_datetime = start_datetime + interval '3 hours'
WHERE end_datetime IS NULL;

-- 2. Make end_datetime NOT NULL going forward
ALTER TABLE public.events
  ALTER COLUMN end_datetime SET NOT NULL;

-- 3. Ensure end is always after start
ALTER TABLE public.events
  ADD CONSTRAINT events_end_after_start CHECK (end_datetime > start_datetime);

-- 4. Partial index so the cron job only scans published events
CREATE INDEX IF NOT EXISTS idx_events_published_end
  ON public.events (end_datetime)
  WHERE status = 'published';

-- 5. Cron job: every 15 minutes, mark published events whose end_datetime
--    has passed as 'completed'.
SELECT cron.schedule(
  'auto_complete_past_events',
  '*/15 * * * *',
  $$
  UPDATE public.events
  SET    status     = 'completed',
         updated_at = now()
  WHERE  status       = 'published'
    AND  end_datetime < now();
  $$
);
