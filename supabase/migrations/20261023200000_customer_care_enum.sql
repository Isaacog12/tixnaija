-- Migration: Add customer_care to public.app_role enum
-- Isolated in its own migration file so the new value is committed before use in subsequent migrations.

ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'customer_care';
