-- Typo-tolerant event search for the support assistant.
--
-- A customer who types "detty dicember" or "burna boi" got "I couldn't find a
-- published event matching ..." even though the event existed. Trigram
-- similarity fixes that in the database, ordered by how close the title is.
--
-- Everything here is optional at runtime: if pg_trgm is not available on this
-- database, the extension block is skipped, no index or function is created, and
-- the Edge Function falls back to an in-code edit-distance match.

DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_trgm;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_trgm unavailable (%); skipping event title trigram search', SQLERRM;
END;
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_trgm') THEN
    CREATE INDEX IF NOT EXISTS events_title_trgm_idx
      ON public.events USING gin (title gin_trgm_ops);
  END IF;
END;
$$;

-- Only published, upcoming events are exposed: this is the public search path,
-- and it must not reveal a draft, cancelled or ended event.
CREATE OR REPLACE FUNCTION public.search_events_by_title(
  p_term TEXT,
  p_limit INTEGER DEFAULT 3
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  slug TEXT,
  start_datetime TIMESTAMPTZ,
  end_datetime TIMESTAMPTZ,
  venue_name TEXT,
  city TEXT,
  status TEXT,
  postponed_at TIMESTAMPTZ,
  organizer_note TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_term TEXT := btrim(coalesce(p_term, ''));
  v_limit INTEGER := greatest(1, least(coalesce(p_limit, 3), 10));
BEGIN
  IF length(v_term) < 3 THEN
    RETURN;
  END IF;

  -- Guarded so a database without pg_trgm simply returns nothing instead of
  -- erroring on the % operator below.
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_trgm') THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    e.id,
    e.title,
    e.slug,
    e.start_datetime,
    e.end_datetime,
    e.venue_name,
    e.city,
    e.status::text,
    e.postponed_at,
    e.organizer_note
  FROM public.events e
  WHERE e.status = 'published'
    AND e.start_datetime >= now()
    AND (e.title % v_term OR similarity(e.title, v_term) >= 0.30)
  ORDER BY similarity(e.title, v_term) DESC, e.start_datetime ASC
  LIMIT v_limit;
END;
$$;

REVOKE ALL ON FUNCTION public.search_events_by_title(text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.search_events_by_title(text, integer) TO authenticated, service_role;
