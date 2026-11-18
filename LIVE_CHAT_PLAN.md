# Live chat handoff — proposed design (not built)

Status: **idea only, nothing implemented.** Updated 2026-11-17 after auditing the existing support
schema and console, so this reflects what the codebase already has rather than an imagined greenfield.

## Headline finding

Most of the data layer already exists. TixNaija already has:

- `support_cases` — `case_number` (`CASE-###`), `customer_id` (now nullable for guests), `guest_email`,
  `order_id`, `subject`, `category`, `status`, `priority`, `assigned_to`, escalation fields.
- `support_case_messages` — `case_id`, `sender_id`, `is_internal`, `content` (max 3000), `created_at`.
  This is already a two-way thread.
- RLS for signed-in customers: *"Customers can view non-internal messages of own cases"* and *"Customers
  can insert messages into open cases"* (`sender_id = auth.uid()`, `status != 'closed'`).
- `support_reply_case(case_id, content, is_internal)` RPC, plus a public-reply path that queues a customer
  email through `email_outbox`.
- A working staff console at `/support` (`src/routes/_authenticated/support.tsx`) whose **Support Cases**
  tab already renders the message thread and has a reply composer.
- Realtime already switched on for authenticated users across the whole `public` schema in
  `src/routes/__root.tsx`, so staff see new cases and messages **without any new code**.

What does **not** exist: any notion of an agent being available, and any guest-facing chat path.

## What is genuinely missing

| # | Gap | Why it matters |
|---|-----|----------------|
| 1 | `support_case_messages.sender_id` is `NOT NULL` referencing `auth.users` | Guest and bot messages have no auth user, so they cannot be stored in the existing thread at all. |
| 2 | No agent availability signal | The bot cannot see who is online (presence lives on websockets, not Postgres). Must be decided in the widget. |
| 3 | Guests cannot read or write a case thread | The customer policies key on `customer_id = auth.uid()`, which never matches `NULL` for a guest. |
| 4 | `support_case_messages` is not in the Realtime publication | `supabase_realtime` only covers `events, orders, tickets, ticket_types, profiles`. |
| 5 | A public reply queues an email per message | Wrong for a live chat — one email per sentence. |
| 6 | No live UI | Widget has no live mode; staff console has no queue / accept action. |

## Add — database

One migration:

1. `support_case_messages.sender_id` → **nullable**, plus `sender_kind text NOT NULL DEFAULT 'staff'
   CHECK (sender_kind IN ('customer','guest','staff','bot','system'))`. Existing rows stay valid.
2. Index `support_case_messages (case_id, created_at)`.
3. `support_cases.channel text NOT NULL DEFAULT 'email' CHECK (channel IN ('email','live_chat'))` so live
   chats are distinguishable from email escalations in the same table.
4. `ALTER PUBLICATION supabase_realtime ADD TABLE public.support_case_messages;` — RLS still applies, so a
   signed-in customer only receives messages from their own case.
5. `support_reply_case` gains a way to skip the outbox email when `channel = 'live_chat'`
   (e.g. a 4th argument `p_send_email boolean DEFAULT true`), otherwise every chat line emails the customer.

No new tables. No `support_agent_status` table — see presence below.

## Add — presence (no schema)

Staff console joins a Realtime presence channel `support:agents` with a payload such as
`{ accepting: true }`, toggled by a switch in the console header. The widget reads `presenceState()`;
"Chat with a human now" appears only when at least one state has `accepting: true`.

Presence alone is not enough, which is why the payload carries the explicit flag: a tab left open is not
the same as a person free to talk. Nothing is stored, so a closed laptop means "offline" with no cleanup
job needed.

## Add — guest transport

Guests cannot subscribe to `support_case_messages` (no identity ⇒ no RLS match), and must not be given an
open `SELECT` policy — that would let any anonymous socket read every support conversation. Two options:

- **Poll an edge function (recommended).** New `supabase/functions/support-chat` with
  `verify_jwt = false` in `supabase/config.toml`, actions `start | send | poll | close`, authorized by a
  random per-session token checked server-side with the service role. Widget polls every ~3s only while a
  chat is open. Simple, no auth-model change.
- Anonymous auth (`signInAnonymously`) — gives guests a real JWT so RLS and Realtime just work. Rejected
  for now: it changes the whole guest model across checkout, tickets and lookup, for one feature.

The function must reuse the existing `rate_limit_log` pattern, the 500-char cap and the sensitive-data
refusal gate from `support-bot`. Never accept a client-supplied case id without the session token.

## Add — UI

- `src/components/support-chat.tsx`: add a `mode` (`"bot" | "live"`), a "Chat with a human" affordance shown
  only when presence says someone is accepting, and a 90-second wait state.
- New `src/components/support-live-thread.tsx`: the thread + composer for live mode, kept separate so the
  330-line bot widget does not double in size.
- New `src/components/support/SupportLiveQueueTab.tsx` + `live` added to `TabKey` and `NAV_ITEMS` in
  `src/routes/_authenticated/support.tsx`. Accept = set `assigned_to`; replies reuse the existing
  `support_reply_case`; close = `status='closed'`.

## Modify — bot behaviour

`support-bot` escalates today by writing the case **and both `email_outbox` rows immediately**. With live
chat offered, that means a customer chatting with an agent still fires two internal emails and a "we've
emailed the team" reply.

Recommended: create the case first and return `caseNumber`, offer the live handoff, and only write the
outbox rows if no agent accepts within the timeout (a follow-up `escalate` action). Keep the emails as the
backstop — they are the only alert if nobody is at the console.

## Remove / do not add

- The `support_chat_sessions` and `support_chat_messages` tables sketched in the first version of this
  document. They duplicate `support_cases` + `support_case_messages`.
- A `support_agent_status` table. Presence payload covers it.
- Any anonymous `SELECT` / `INSERT` policy on chat tables.
- Any entry for chat tables in `PUBLIC_REALTIME_TABLES` (`src/routes/__root.tsx`). Those subscriptions are
  broadcast to every signed-out socket and invalidate the entire query cache on each event; a chat message
  per keystroke would be both a leak and a performance problem.
- A second floating widget. Extend the existing one.
- `signInAnonymously` for now.

## Risks

- **Stranded users.** A "connecting you to an agent" that never resolves is worse than no chat. Hard
  timeout + automatic email fallback is mandatory.
- **Abuse.** Keep the per-IP cap, 500-char limit and sensitive-data gate in front of guest chat.
- **Operations, not code.** This only works if someone is genuinely watching the console. Phase 1 makes
  that visible before anyone depends on it.
- **Effort.** Roughly a day: 1 migration, 1 edge function, 3 components, 1 tab registration.

## Suggested phasing

- **Phase 1.** Availability plumbing only: presence + "accepting" toggle in the console, and a "Chat with a
  human now" button in the widget that, for the moment, still creates a normal case. No thread.
- **Phase 2.** The live thread: migration, `support-chat` function, live mode in the widget, queue tab.

## Open questions

- How many agents are on duty at once?
- Guests only, signed-in only, or both? (Decides whether the guest token path in `support-chat` is needed
  in Phase 2, or whether RLS + Realtime is enough.)
- Should a live chat also exist as a `support_cases` row? (Recommended: yes, `channel='live_chat'`, so the
  transcript and case number survive.)
- Should the transcript be emailed to the customer when the chat ends?
