# Live chat handoff — proposed design (not built)

Status: **idea only.** Nothing in this file is implemented. Written down 2026-11-16 so it can be picked up later.

## The idea

Today, when the TixNaija assistant can't answer, it records a `support_cases` row and emails
`isaacnerds@gmail.com` + `support.tixnaija@gmail.com`. The customer gets a neutral "I've passed this to
the support team" reply and then waits.

The proposal: if a human is actually available right then, the widget offers a **live chat** instead of
an email escalation, and the conversation happens inside the same floating panel.

## Key constraint

The bot is a Supabase edge function (`supabase/functions/support-bot`). **It cannot know who is online** —
agent presence lives on websockets in a browser, not in Postgres. So the availability check must happen
client-side in the widget (`src/components/support-chat.tsx`), not in the function.

## Availability signal

Two signals, both required:

1. **Presence** — Realtime presence channel (e.g. `support:agents`), set by the staff console while it is
   open. Realtime is already used in `src/routes/__root.tsx` for `events`, `ticket_types`,
   `sponsored_banners`, so no new dependency.
2. **Explicit toggle** — a `support_agent_status` row (`is_online`, `updated_at`) that a staff member flips
   to "Accepting chats". Presence alone is not enough: a tab left open does not mean the person is free.

Show "Chat with a human now" only when presence exists **and** the toggle is on.

## Flow

| # | Where | Behaviour |
|---|-------|-----------|
| 1 | Widget → new function `support-chat-start` | Creates `support_chat_sessions` (guest token or `user_id`), returns session id + token. Reuses the existing per-IP / per-session rate limit from `support-bot`. |
| 2 | Staff console `/support` (`src/routes/_authenticated/support.tsx`) | New "Live" tab lists waiting sessions via Realtime insert. Agent clicks **Accept** → `status='active'`, `agent_id` set. |
| 3 | Both sides | `support_chat_messages` inserts; each side subscribes to `postgres_changes` filtered on `session_id`. Typing indicators via Realtime Broadcast. |
| 4 | Timeout (~90s) | No agent accepts → fall back to today's path: `support_cases` + the two `email_outbox` rows, and tell the user "no one is free right now, we've emailed the team." |
| 5 | Close | Agent closes → `status='closed'`. Optionally copy the transcript onto the `support_cases` row. |

## Rough schema

```
support_agent_status   (user_id pk, is_online bool, updated_at)
support_chat_sessions  (id, user_id nullable, guest_email nullable, guest_token uuid,
                        status waiting|active|closed|expired, agent_id nullable,
                        created_at, accepted_at, closed_at)
support_chat_messages  (id, session_id fk, sender_kind user|agent|bot,
                        sender_id nullable, body text, created_at)
```

Guest sessions need `user_id` nullable, same reason `support_cases.customer_id` had to become nullable.

## Risks / things that bite

- **Guests have no auth.** Never let the browser insert into the chat tables with the anon key — anyone
  could inject messages into another session. Route every guest write through an edge function holding the
  service role, validating a random session token. (Same posture as `support-bot` today.)
- **Abuse.** Open chat is a spam magnet. Keep the per-IP cap, the 500-char limit, and the sensitive-data
  refusal gate (card / CVV / PIN / OTP / password / BVN) in front of it.
- **Stranded users.** A "connecting you to an agent" that never resolves is worse than no chat at all.
  The hard timeout plus automatic email fallback is mandatory, not a nicety.
- **Realtime metering.** ~200 concurrent connections on the free tier. One channel per open widget tab,
  session only opens on demand — fine at current scale.
- **Effort.** Roughly a day: 2–3 tables + RLS, 2–3 edge functions, a state machine in
  `src/components/support-chat.tsx`, and a queue pane in the support console.
- **Operations matter more than code.** This only works if someone is genuinely watching the console.

## Suggested phasing

- **Phase 1 (small, useful on its own).** Bot asks "would you like to chat with a human now?" If the toggle
  is on and presence exists, show a live "Start chat" button; otherwise escalate exactly as today. Ships the
  availability plumbing with no chat thread.
- **Phase 2.** The actual Realtime conversation behind that button.

## Open questions for when we pick this up

- How many agents will be on duty at once?
- Guests only, signed-in only, or both? (Decides how much guest-token plumbing is needed.)
- Should a live chat also create a `support_cases` row for record-keeping, or live only in the chat tables?
- Should the transcript be emailed to the customer at the end, like an escalation is today?
