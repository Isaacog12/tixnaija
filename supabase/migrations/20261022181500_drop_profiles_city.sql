-- ============================================================
-- MIGRATION: Drop unused 'city' column from public.profiles
-- ============================================================
-- Verification audit performed on 2026-10-22:
-- Checked public.profiles for non-null 'city' entries: 0 records found.
-- Event locations use events.venue_name and events.address.
--
-- Ready for review. DO NOT apply without user confirmation.

ALTER TABLE public.profiles DROP COLUMN IF EXISTS city;
