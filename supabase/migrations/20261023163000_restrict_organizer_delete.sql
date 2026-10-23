-- ============================================================
-- MIGRATION: Restrict Organizer Deletion When Events Exist
-- ============================================================
-- Status: Prepared for review. DO NOT apply without explicit confirmation.
--
-- Purpose:
-- Change foreign keys on public.events and public.event_series from
-- ON DELETE CASCADE to ON DELETE RESTRICT so that organizer profiles/users
-- cannot be deleted while they own events or event series.

-- 1. Restrict deletion of public.profiles when referenced by public.events
ALTER TABLE public.events
  DROP CONSTRAINT IF EXISTS events_organizer_id_fkey,
  ADD CONSTRAINT events_organizer_id_fkey
    FOREIGN KEY (organizer_id)
    REFERENCES public.profiles(id)
    ON DELETE RESTRICT;

-- 2. Restrict deletion of auth.users when referenced by public.event_series
ALTER TABLE public.event_series
  DROP CONSTRAINT IF EXISTS event_series_organizer_id_fkey,
  ADD CONSTRAINT event_series_organizer_id_fkey
    FOREIGN KEY (organizer_id)
    REFERENCES auth.users(id)
    ON DELETE RESTRICT;
