/**
 * Contracts for the support-desk RPCs.
 *
 * Every one of these functions returns `JSONB`, so supabase-js can only type
 * the result as `Json`. These types describe what the SQL actually builds
 * (`jsonb_build_object` in supabase/migrations/20261023201000_customer_care_rpcs.sql
 * and 20261118120000_support_desk_features.sql), so a property that the SQL
 * stops returning becomes a compile error instead of a blank cell on screen.
 *
 * Keep each type in step with its function when the SQL changes.
 */

import type { Database } from "@/integrations/supabase/types";

type Enums = Database["public"]["Enums"];

export type SupportCaseStatus = Enums["support_case_status"];
export type SupportCaseCategory = Enums["support_case_category"];
export type SupportCasePriority = Enums["support_case_priority"];
export type SupportOrderStatus = Enums["order_status"];
export type SupportTicketStatus = Enums["ticket_status"];

/** support_view_case(p_case_id) */
export type SupportCaseView = {
  case: {
    id: string;
    case_number: string;
    customer_id: string | null;
    customer_email: string | null;
    customer_name: string | null;
    order_id: string | null;
    subject: string;
    category: SupportCaseCategory;
    status: SupportCaseStatus;
    priority: SupportCasePriority;
    assigned_to: string | null;
    is_escalated: boolean;
    escalated_reason: string | null;
    created_at: string;
    updated_at: string;
    resolved_at: string | null;
  } | null;
  messages: Array<{
    id: string;
    sender_id: string;
    sender_name: string | null;
    is_internal: boolean;
    content: string;
    created_at: string;
  }>;
};

/** support_get_macros() and the rows returned by admin_manage_macro's upsert. */
export type SupportMacro = {
  id: string;
  title: string;
  category: string | null;
  content: string;
};

/** support_get_overview_stats() */
export type SupportOverviewStats = {
  open_cases: number;
  unassigned_cases: number;
  pending_refunds: number;
  resolved_today: number;
  unmatched_payments: number;
};

/** support_get_unmatched_payments() */
export type SupportUnmatchedPayment = {
  id: string;
  reference: string;
  amount_ngn: number;
  customer_email: string | null;
  channel: string | null;
  resolution_note: string | null;
  created_at: string;
};

/** support_get_orders_list() */
export type SupportOrderSummary = {
  id: string;
  payment_reference: string | null;
  buyer_name: string;
  masked_buyer_email: string;
  total_kobo: number;
  status: SupportOrderStatus;
  event_id: string;
  event_title: string | null;
  created_at: string;
};

/** support_get_order_details() */
export type SupportOrderDetails = {
  order: {
    id: string;
    payment_reference: string | null;
    buyer_name: string;
    buyer_email: string;
    buyer_phone: string | null;
    total_kobo: number;
    subtotal_kobo: number;
    discount_kobo: number;
    status: SupportOrderStatus;
    event_id: string;
    created_at: string;
    updated_at: string;
  } | null;
  tickets: Array<{
    id: string;
    ticket_type_name: string;
    attendee_name: string | null;
    attendee_email: string | null;
    status: SupportTicketStatus;
    checked_in_at: string | null;
    checked_in_by: string | null;
    masked_code: string;
  }>;
  delivery_log: Array<{
    id: string;
    recipient_email: string;
    template: string;
    status: string;
    retry_count: number;
    created_at: string;
    sent_at: string | null;
  }>;
  notes: Array<{
    id: string;
    note: string;
    author_name: string | null;
    created_at: string;
  }>;
};

/** support_get_refund_requests() */
export type SupportRefundRequest = {
  id: string;
  ticket_id: string | null;
  event_id: string;
  event_title: string | null;
  buyer_email: string;
  buyer_name: string | null;
  reason: string;
  other_reason: string | null;
  status: string;
  admin_note: string | null;
  created_at: string;
};

/** support_lookup_customer() */
export type SupportLookupResult = {
  customers: Array<{
    id: string;
    full_name: string | null;
    email: string | null;
    phone_number: string | null;
    created_at: string;
  }>;
  orders: Array<{
    id: string;
    payment_reference: string | null;
    buyer_name: string;
    buyer_email: string;
    total_kobo: number;
    status: SupportOrderStatus;
    created_at: string;
  }>;
  tickets: Array<{
    id: string;
    masked_code: string;
    status: SupportTicketStatus;
    attendee_name: string | null;
    attendee_email: string | null;
    order_id: string;
  }>;
};

/** support_get_events_list() */
export type SupportEventSummary = {
  id: string;
  title: string;
  slug: string;
  start_date: string;
  venue: string | null;
  category: Enums["event_category"] | null;
  status: Enums["event_status"];
  organizer_name: string | null;
};

/** support_get_csat_case() */
export type SupportCsatCase = {
  case_number: string;
  subject: string;
  status: SupportCaseStatus;
  already_rated: boolean;
  rating: number | null;
};

/** support_submit_csat() */
export type SupportCsatResult = {
  success: boolean;
  reason?: string;
};
