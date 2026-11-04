# TixNaija Repository Audit Report
**Commit Reference:** `8a67d27`  
**Scope:** Static codebase audit covering Mobile (Expo/React Native), Website (TanStack Start/Vite), Supabase Database/RLS, and Edge Functions.

---

## Executive Summary

The codebase has a comprehensive foundation across both web and mobile, but contains critical items that must be resolved before production release. 

To streamline remediation, findings are split into two independent domains:
1. **[Part 1: Mobile Application](#part-1-mobile-application)** (Expo, React Native, EAS, Mobile Checkout)
2. **[Part 2: Website & Backend / Database](#part-2-website--backend--database)** (Vite/TanStack Web App, Supabase RLS, Edge Functions, Vercel)

---

# Part 1: Mobile Application

### 1. High-Priority Payment & Business Logic Bugs
* **Paid Checkout Payload Missing `buyerEmail`:**
  * **File:** `mobile/app/checkout/[eventId].tsx`
  * **Problem:** Mobile checkout passes the email only in the root Paystack payload, omitting `buyerEmail` from the `metadata` object.
  * **Impact:** `verify-payment` extracts `metadata.buyerEmail` to insert orders. Users get charged via Paystack, but ticket and order creation fails on the backend.
* **Nonexistent Ticket-Tier Columns:**
  * **Files:** `mobile/app/events/create.tsx`, `mobile/app/events/index.tsx`
  * **Problem:** Mobile code queries and inserts `capacity` and `remaining`. The actual Supabase schema uses `quantity_available` and `quantity_sold`.
  * **Impact:** Event creation fails mid-way (leaving orphan event rows), and organizer event tier listings fail.
* **Broken Promo-Code Validation:**
  * **File:** `mobile/app/checkout/[eventId].tsx`
  * **Problem:** Queries `uses_count` instead of the database column `times_used`. Furthermore, all discounts are calculated as percentages, breaking fixed discounts.
  * **Impact:** Promo codes fail query validation entirely.

### 2. Runtime Errors & Missing React Native Imports
* **Missing `ActivityIndicator`:**
  * **File:** `mobile/app/(tabs)/index.tsx`
  * **Problem:** Used in the pagination footer without being imported from `react-native`.
* **Missing `SafeAreaView`:**
  * **File:** `mobile/app/e/[slug].tsx`
  * **Problem:** Used in event detail views without import.
* **Missing `Platform`:**
  * **File:** `mobile/app/order/[orderId].tsx`
  * **Problem:** Missing import, causing potential runtime reference crashes on order details.
* **Deprecated `Clipboard` Import:**
  * **File:** `mobile/app/support/lookup.tsx`
  * **Problem:** Imports `Clipboard` directly from `react-native`, which is removed in modern React Native versions. Should use `@react-native-clipboard/clipboard` or `expo-clipboard`.

### 3. UI, Datetime & Interaction Quirks
* **Timezone Shifting for Nigerian Dates:**
  * **File:** `mobile/app/events/create.tsx`
  * **Problem:** Local date conversion shifts datetimes unexpectedly when formatted for UTC/WAT.
* **Checkbox Validation Failure:**
  * **File:** `mobile/app/checkout/[eventId].tsx`
  * **Problem:** Required terms checkboxes pass validation even when unchecked.
* **Checkout Verification Lock Freeze:**
  * **File:** `mobile/app/checkout/[eventId].tsx`
  * **Problem:** If payment verification encounters an error, `verifyLock` never resets, permanently disabling retry actions until the user restarts the app.

### 4. Storage, Cache & Scanner Security
* **Shared Device Ticket Leak (AsyncStorage):**
  * **File:** `mobile/app/(tabs)/tickets.tsx`
  * **Problem:** Raw ticket codes and details are cached under a single global AsyncStorage key. Logging out does not clear this cache.
  * **Impact:** On shared devices, a new user can see the previous user’s offline tickets and QR codes.
* **Gate Scanner Queue & Event Filtering:**
  * **File:** `mobile/app/(tabs)/scan.tsx`
  * **Problem 1:** Offline scan synchronization wipes the entire local queue on response, even if individual scans failed on the server.
  * **Problem 2:** Online ticket check-in sends only the ticket code without scoping to the selected `eventId`. Gate staff managing multiple events could mistakenly scan a ticket valid for a different event.

### 5. Git History & Credential Exposure
* **Supabase `service_role` JWT in Git History:**
  * **File:** `mobile/test-query.js` (introduced in commit `5dd9b338ef08`)
  * **Problem:** Although the test script was deleted in a later commit, the privileged `service_role` key remains visible in git history.
  * **Action:** Immediately rotate the Supabase `service_role` secret in the Supabase Dashboard.

### 6. Dependencies & Build Configuration
* **`npm ci` Desynchronization:**
  * **Files:** `mobile/package.json`, `mobile/package-lock.json`
  * **Problem:** Lockfile is out of sync with `package.json`, missing Babel and Metro packages required for clean CI builds.
* **22 Dependency Vulnerabilities:**
  * 1 critical (`tar` vulnerability in Expo/Metro toolchain), 5 high, 10 moderate, 6 low.
* **EAS Build Artifact Profile:**
  * **File:** `mobile/eas.json`
  * **Status:** Configured for `apk` distribution under preview and production. If Google Play Store release is intended, an `aab` (Android App Bundle) profile is required.

---

# Part 2: Website & Backend / Database

### 1. Database & Row Level Security (RLS)
* **Unbounded Anonymous Order-Read Policy:**
  * **Migration:** `supabase/migrations/20260721180000_guest_ticket_lookup.sql`
  * **Problem:** RLS policy condition includes `OR buyer_email IS NOT NULL`.
  * **Impact:** Grants any unauthenticated client (`anon`) full SELECT access to all order records and customer details in the database.
* **Waitlist Trigger Secret Fallback:**
  * **Migration:** `supabase/migrations/20261026135000_secure_waitlist_trigger_and_secret.sql`
  * **Problem:** Database trigger uses a hardcoded fallback secret to authenticate with the `notify-waitlist` Edge Function.
* **Unrestricted Public Waitlist Inserts:**
  * **Migration:** `supabase/migrations/20260913202000_waitlists.sql`
  * **Problem:** Uses `WITH CHECK (true)` with no rate-limiting or anti-abuse protection, allowing arbitrary automated submissions.
* **Overly Permissive Promo & Staff Policies:**
  * **Migration:** `supabase/migrations/20260929_add_promo_staff_delete.sql`
  * **Problem:** `promo_codes_read` and `event_staff_read` allow `USING (true)`, making inactive promo codes, discount details, and staff user IDs publicly readable.
* **Cosmetic Account Suspension:**
  * **Migration:** `supabase/migrations/20260715160000_admin_rls_and_actions.sql`
  * **Problem:** Admin suspend RPC toggles `profiles.suspended`, but this status is never checked in RLS policies, Edge Functions, or checkout flows.
* **Missing Public Organizer Profile View:**
  * **Files:** `src/routes/e.$slug.tsx`, `src/routes/box-office.$organizerSlug.tsx`
  * **Problem:** Public pages query `profiles` directly, but existing RLS restricts profile reads to owners/admins. Public users may see empty organizer information.

### 2. Supabase Edge Functions & Email
* **Unauthenticated Background/Batch Functions:**
  * **Functions:** `process-email-outbox`, `send-event-reminders`, `send-abandoned-reminders`
  * **Problem:** Functions operate with service-role privileges but lack caller verification or cron secret checks. Any authenticated user can trigger email batches.
* **HTML Injection in Email Templates:**
  * **Functions:** `send-event-broadcast/index.ts`, `send-ticket-confirmation/index.ts`
  * **Problem:** Organizer-provided text (broadcast messages and confirmation notes) is directly interpolated into raw HTML email strings without sanitization or HTML escaping.
* **Blocked Unsubscribe Endpoint:**
  * **File:** `src/routes/unsubscribe.tsx`, `supabase/config.toml`
  * **Problem:** `unsubscribe` function verifies HMAC tokens, but lacks `verify_jwt = false` in `config.toml`. Unauthenticated email recipients clicking "Unsubscribe" may get rejected by the Supabase API Gateway.

### 3. Website Frontend & Privacy
* **Guest Credentials Leaked in Query Strings:**
  * **Files:** `src/routes/my-tickets.tsx`, `src/routes/orders.$orderId.tickets.tsx`
  * **Problem:** Order lookup passes guest email and access code directly as URL parameters (`?email=...&code=...`), leaking sensitive ticket credentials into browser history and server logs.
* **Missing `noindex` Meta Tag:**
  * **File:** `src/routes/orders.$orderId.tickets.tsx`
  * **Problem:** Direct ticket access pages lack `noindex` robots headers, creating potential search index leakage.

### 4. Hosting & Deployment Configuration
* **Vercel Environment Variable Mismatch:**
  * **File:** `vercel.json`
  * **Problem:** Sets `VITE_SUPABASE_ANON_KEY`, whereas `src/integrations/supabase/client.ts` looks for `VITE_SUPABASE_PUBLISHABLE_KEY` or `SUPABASE_PUBLISHABLE_KEY`.
* **Dependencies & CI Pipeline:**
  * **Problem:** Web lockfile has 8 vulnerabilities (including a critical transitive DOMPurify vulnerability). Root `npm ci` experiences timeouts during clean builds.

---

## Action Plan by Domain

### Immediate Mobile Tasks:
1. Fix `buyerEmail` parameter in `mobile/app/checkout/[eventId].tsx`.
2. Update ticket column references from `capacity`/`remaining` to `quantity_available`/`quantity_sold`.
3. Fix imports (`ActivityIndicator`, `SafeAreaView`, `Platform`, Clipboard replacement).
4. Synchronize `mobile/package.json` and `mobile/package-lock.json` so `npm ci` passes cleanly.
5. Scope AsyncStorage ticket cache by user ID and clear on sign-out.

### Immediate Website & Backend Tasks:
1. **Rotate the exposed Supabase service-role key** in the Supabase dashboard.
2. Drop the insecure `OR buyer_email IS NOT NULL` condition from order RLS policies.
3. Configure `verify_jwt = false` and cron secret verification on background email/reminder functions.
4. Align `vercel.json` environment variable names with the client initialization code.
5. Create a safe, public database view or RPC for organizer profiles (`display_name`, `avatar_url`, `bio`, `slug`).
