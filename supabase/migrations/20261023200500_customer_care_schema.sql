-- Migration 2: Customer Care Schema, PII Isolation, Anti-Stacking, Tables & Baseline RLS

-- 1. Isolated private schema for internal security helpers
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

-- 2. Case sequences & types
CREATE SEQUENCE IF NOT EXISTS public.support_case_seq START WITH 10001;
GRANT USAGE ON SEQUENCE public.support_case_seq TO authenticated;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'support_case_status') THEN
    CREATE TYPE public.support_case_status AS ENUM ('open', 'pending', 'resolved', 'closed');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'support_case_priority') THEN
    CREATE TYPE public.support_case_priority AS ENUM ('low', 'medium', 'high', 'urgent');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'support_case_category') THEN
    CREATE TYPE public.support_case_category AS ENUM ('payment', 'missing_ticket', 'refund', 'event_inquiry', 'account', 'other');
  END IF;
END $$;

-- 3. Private Contact Storage (user_contacts) & PII Isolation
-- Segregates emails and phone numbers from public profiles queries
CREATE TABLE IF NOT EXISTS public.user_contacts (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  phone_number TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

ALTER TABLE public.user_contacts ENABLE ROW LEVEL SECURITY;
-- Deliberately NO RLS policies created: inaccessible via PostgREST client queries
REVOKE ALL ON public.user_contacts FROM anon, authenticated, public;
GRANT ALL ON public.user_contacts TO service_role;

-- Backfill existing users into user_contacts
INSERT INTO public.user_contacts (user_id, email, phone_number)
SELECT u.id, lower(u.email), p.phone
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
ON CONFLICT (user_id) DO UPDATE
SET email = EXCLUDED.email,
    phone_number = COALESCE(user_contacts.phone_number, EXCLUDED.phone_number);

-- Backfill phone numbers from recent orders if not set on profile
UPDATE public.user_contacts uc
SET phone_number = latest_order.buyer_phone
FROM (
  SELECT DISTINCT ON (user_id) user_id, buyer_phone
  FROM public.orders
  WHERE user_id IS NOT NULL AND buyer_phone IS NOT NULL AND trim(buyer_phone) <> ''
  ORDER BY user_id, created_at DESC
) latest_order
WHERE uc.user_id = latest_order.user_id AND (uc.phone_number IS NULL OR uc.phone_number = '');

-- Trigger: Sync user_contacts on auth.users email changes
CREATE OR REPLACE FUNCTION public.sync_user_contacts()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.user_contacts (user_id, email)
  VALUES (NEW.id, lower(NEW.email))
  ON CONFLICT (user_id) 
  DO UPDATE SET email = lower(EXCLUDED.email), updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_user_contacts ON auth.users;
CREATE TRIGGER trg_sync_user_contacts
AFTER INSERT OR UPDATE OF email ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.sync_user_contacts();

-- Trigger: Sync phone changes from profiles
CREATE OR REPLACE FUNCTION public.sync_profile_phone_to_contacts()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.user_contacts 
  SET phone_number = NEW.phone, updated_at = now()
  WHERE user_id = NEW.id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_profile_phone ON public.profiles;
CREATE TRIGGER trg_sync_profile_phone
AFTER INSERT OR UPDATE OF phone ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.sync_profile_phone_to_contacts();

-- Fast lookup indexes
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_user_contacts_email ON public.user_contacts (email);
CREATE INDEX IF NOT EXISTS idx_user_contacts_phone ON public.user_contacts (phone_number);
CREATE INDEX IF NOT EXISTS idx_profiles_fullname_trgm ON public.profiles USING gin (full_name gin_trgm_ops);

-- Restored lookup indexes on orders & tickets
CREATE INDEX IF NOT EXISTS idx_orders_payment_reference ON public.orders(payment_reference);
CREATE INDEX IF NOT EXISTS idx_orders_buyer_email_lower ON public.orders(lower(buyer_email));
CREATE INDEX IF NOT EXISTS idx_orders_buyer_phone ON public.orders(buyer_phone);
CREATE INDEX IF NOT EXISTS idx_tickets_ticket_code ON public.tickets(ticket_code);

-- 4. Anti-Stacking Role Conflict Trigger & Role Change Audit
CREATE OR REPLACE FUNCTION public.check_user_role_conflict()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Block assigning customer_care to an organizer
  IF NEW.role = 'customer_care'::public.app_role THEN
    IF EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = NEW.user_id AND role = 'organizer'::public.app_role
    ) OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = NEW.user_id AND is_organizer = TRUE
    ) THEN
      RAISE EXCEPTION 'Conflict of interest: A user cannot hold both organizer and customer_care roles.';
    END IF;
  END IF;

  -- Block assigning organizer to a customer care agent
  IF NEW.role = 'organizer'::public.app_role THEN
    IF EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = NEW.user_id AND role = 'customer_care'::public.app_role
    ) THEN
      RAISE EXCEPTION 'Conflict of interest: A customer care agent cannot hold the organizer role.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_user_role_conflict ON public.user_roles;
CREATE TRIGGER trg_check_user_role_conflict
BEFORE INSERT OR UPDATE ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.check_user_role_conflict();

-- Block profiles.is_organizer from being set if user is customer_care
CREATE OR REPLACE FUNCTION public.check_profile_organizer_conflict()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.is_organizer = TRUE AND (OLD.is_organizer IS DISTINCT FROM TRUE) THEN
    IF EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = NEW.id AND role = 'customer_care'::public.app_role
    ) THEN
      RAISE EXCEPTION 'Conflict of interest: Cannot activate organizer status for customer care staff.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_profile_organizer_conflict ON public.profiles;
CREATE TRIGGER trg_check_profile_organizer_conflict
BEFORE INSERT OR UPDATE OF is_organizer ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.check_profile_organizer_conflict();

-- Plain actor_id UUID, actor_email snapshot, NO foreign key constraint
CREATE TABLE IF NOT EXISTS public.support_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID,
  actor_email TEXT,
  action VARCHAR(64) NOT NULL,
  target_type VARCHAR(32) NOT NULL,
  target_id TEXT NOT NULL,
  details JSONB DEFAULT '{}'::jsonb NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Append-only triggers (Block UPDATE, DELETE, and TRUNCATE)
CREATE OR REPLACE FUNCTION public.enforce_audit_log_append_only()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'support_audit_logs is append-only and cannot be updated, deleted, or truncated.';
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_log_no_modify ON public.support_audit_logs;
CREATE TRIGGER trg_audit_log_no_modify
BEFORE UPDATE OR DELETE ON public.support_audit_logs
FOR EACH STATEMENT EXECUTE FUNCTION public.enforce_audit_log_append_only();

DROP TRIGGER IF EXISTS trg_audit_log_no_truncate ON public.support_audit_logs;
CREATE TRIGGER trg_audit_log_no_truncate
BEFORE TRUNCATE ON public.support_audit_logs
FOR EACH STATEMENT EXECUTE FUNCTION public.enforce_audit_log_append_only();

REVOKE UPDATE, DELETE, TRUNCATE ON public.support_audit_logs FROM anon, authenticated, service_role;

-- Audit all role changes
CREATE OR REPLACE FUNCTION public.audit_role_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_email_snapshot TEXT;
BEGIN
  IF v_actor IS NOT NULL THEN
    SELECT email INTO v_email_snapshot FROM auth.users WHERE id = v_actor;
  END IF;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.support_audit_logs (actor_id, actor_email, action, target_type, target_id, details)
    VALUES (
      v_actor, 
      v_email_snapshot, 
      'role_granted', 
      'user', 
      NEW.user_id::text, 
      jsonb_build_object('role', NEW.role, 'via', CASE WHEN v_actor IS NULL THEN 'service_role' ELSE 'admin_api' END)
    );
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.support_audit_logs (actor_id, actor_email, action, target_type, target_id, details)
    VALUES (
      v_actor, 
      v_email_snapshot, 
      'role_revoked', 
      'user', 
      OLD.user_id::text, 
      jsonb_build_object('role', OLD.role, 'via', CASE WHEN v_actor IS NULL THEN 'service_role' ELSE 'admin_api' END)
    );
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_role_change ON public.user_roles;
CREATE TRIGGER trg_audit_role_change
AFTER INSERT OR DELETE ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.audit_role_change();

-- 5. Support Core Tables
CREATE TABLE IF NOT EXISTS public.support_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_number VARCHAR(20) UNIQUE NOT NULL DEFAULT ('CASE-' || nextval('public.support_case_seq')),
  customer_id UUID REFERENCES auth.users(id) NOT NULL,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  subject VARCHAR(150) NOT NULL,
  category public.support_case_category NOT NULL DEFAULT 'other',
  status public.support_case_status NOT NULL DEFAULT 'open',
  priority public.support_case_priority NOT NULL DEFAULT 'medium',
  assigned_to UUID REFERENCES auth.users(id),
  is_escalated BOOLEAN DEFAULT FALSE NOT NULL,
  escalated_at TIMESTAMPTZ,
  escalated_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  resolved_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.support_case_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID REFERENCES public.support_cases(id) ON DELETE CASCADE NOT NULL,
  sender_id UUID REFERENCES auth.users(id) NOT NULL,
  is_internal BOOLEAN DEFAULT FALSE NOT NULL,
  content VARCHAR(3000) NOT NULL CHECK (length(trim(content)) > 0),
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.support_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_type VARCHAR(16) NOT NULL CHECK (target_type IN ('customer', 'order', 'ticket', 'refund')),
  target_id TEXT NOT NULL,
  author_id UUID REFERENCES auth.users(id) NOT NULL,
  note TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Email Outbox (Asynchronous Delivery via ZeptoMail Worker)
CREATE TABLE IF NOT EXISTS public.email_outbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  case_id UUID REFERENCES public.support_cases(id) ON DELETE SET NULL,
  recipient_email TEXT NOT NULL,
  template VARCHAR(64) NOT NULL,
  payload JSONB DEFAULT '{}'::jsonb NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'sent', 'failed')),
  retry_count INT DEFAULT 0 NOT NULL,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  sent_at TIMESTAMPTZ
);

-- Paystack Payment Events (Webhook store, kobo reconciliation, resolution tracking)
CREATE TABLE IF NOT EXISTS public.payment_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference TEXT NOT NULL,
  event_type TEXT NOT NULL,
  amount_kobo BIGINT NOT NULL,
  customer_email TEXT,
  channel VARCHAR(32),
  status VARCHAR(32) NOT NULL,
  metadata JSONB,
  matched_order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  raw_payload JSONB,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES auth.users(id),
  resolution_note TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  CONSTRAINT payment_events_ref_event_uniq UNIQUE (reference, event_type)
);

-- Controlled Email Redirection Requests
CREATE TABLE IF NOT EXISTS public.support_email_change_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES public.orders(id) NOT NULL,
  requested_by UUID REFERENCES auth.users(id) NOT NULL,
  old_email TEXT NOT NULL,
  new_email TEXT NOT NULL,
  reason TEXT NOT NULL,
  status VARCHAR(16) DEFAULT 'pending_admin' NOT NULL CHECK (status IN ('pending_admin', 'approved', 'rejected')),
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Canned Macros / Knowledge Base
CREATE TABLE IF NOT EXISTS public.support_macros (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(100) NOT NULL,
  category VARCHAR(32) NOT NULL DEFAULT 'general',
  content TEXT NOT NULL,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Safely update refund_requests status constraint dynamically
DO $$
DECLARE
  v_con_name text;
BEGIN
  SELECT conname INTO v_con_name
  FROM pg_constraint
  WHERE conrelid = 'public.refund_requests'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%status%';
  IF v_con_name IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.refund_requests DROP CONSTRAINT ' || quote_ident(v_con_name);
  END IF;
END $$;

ALTER TABLE public.refund_requests 
  ADD CONSTRAINT refund_requests_status_check 
  CHECK (status IN ('pending', 'needs_admin_review', 'customer_contacted', 'approved', 'rejected', 'processed'));

-- 6. Direct Table RLS Revocation & Policies
ALTER TABLE public.support_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_case_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_outbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_email_change_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_macros ENABLE ROW LEVEL SECURITY;

-- Admins with AAL2 MFA can view audit logs
DROP POLICY IF EXISTS "Admins with MFA can view audit logs" ON public.support_audit_logs;
DROP POLICY IF EXISTS "Admins can view audit logs" ON public.support_audit_logs;
CREATE POLICY "Admins with MFA can view audit logs"
ON public.support_audit_logs FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role) 
  AND (auth.jwt() ->> 'aal') = 'aal2'
);

-- Customer views own cases only. Staff accesses strictly via RPC.
DROP POLICY IF EXISTS "Customers can view own cases" ON public.support_cases;
CREATE POLICY "Customers can view own cases"
ON public.support_cases FOR SELECT TO authenticated
USING (customer_id = auth.uid());

-- Customer views non-internal messages of own cases only
DROP POLICY IF EXISTS "Customers can view non-internal messages of own cases" ON public.support_case_messages;
CREATE POLICY "Customers can view non-internal messages of own cases"
ON public.support_case_messages FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.support_cases sc
    WHERE sc.id = case_id AND sc.customer_id = auth.uid()
  ) AND is_internal = FALSE
);

DROP POLICY IF EXISTS "Customers can insert messages into open cases" ON public.support_case_messages;
CREATE POLICY "Customers can insert messages into open cases"
ON public.support_case_messages FOR INSERT TO authenticated
WITH CHECK (
  sender_id = auth.uid()
  AND is_internal = FALSE
  AND EXISTS (
    SELECT 1 FROM public.support_cases sc
    WHERE sc.id = case_id 
      AND sc.status != 'closed'
      AND sc.customer_id = auth.uid()
  )
);

-- Customer reply trigger (Reopens resolved or pending cases & touches updated_at)
CREATE OR REPLACE FUNCTION public.handle_customer_case_reply()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_case RECORD;
BEGIN
  SELECT customer_id, status INTO v_case FROM public.support_cases WHERE id = NEW.case_id;
  
  IF NEW.sender_id = v_case.customer_id AND NEW.is_internal = FALSE THEN
    UPDATE public.support_cases
    SET status = CASE 
      WHEN v_case.status IN ('resolved', 'pending') THEN 'open'::public.support_case_status 
      ELSE v_case.status 
    END,
    updated_at = now()
    WHERE id = NEW.case_id;
  ELSE
    UPDATE public.support_cases SET updated_at = now() WHERE id = NEW.case_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_customer_case_reply ON public.support_case_messages;
CREATE TRIGGER trg_customer_case_reply
AFTER INSERT ON public.support_case_messages
FOR EACH ROW EXECUTE FUNCTION public.handle_customer_case_reply();

-- Admins with AAL2 can view payment events
DROP POLICY IF EXISTS "Admins with MFA can view payment events" ON public.payment_events;
DROP POLICY IF EXISTS "Admins can view payment events" ON public.payment_events;
CREATE POLICY "Admins with MFA can view payment events"
ON public.payment_events FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role) 
  AND (auth.jwt() ->> 'aal') = 'aal2'
);
