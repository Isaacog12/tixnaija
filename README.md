# TixNaija

Nigerian event ticketing platform. Organizers publish events and ticket tiers; buyers check out
with Paystack, receive QR tickets by email, and are scanned in at the gate. The same app carries
the organizer dashboard, the platform admin console and the customer-care desk.

TixNaija is its own product. It is not affiliated with, and shares nothing with, Tix Africa.

## Stack

| Layer | Choice |
| --- | --- |
| UI | React 19, TanStack Router, Tailwind CSS v4, Radix UI primitives |
| Rendering | TanStack Start (SSR) on Vite 8, Nitro for the production build |
| Data | Supabase: Postgres with row-level security, Auth, Edge Functions |
| Tests | Vitest (unit), Playwright (end-to-end) |

## Requirements

- Node.js 20 or newer (developed on Node 22+)
- npm (a `package-lock.json` is committed; use `npm ci` for reproducible installs)
- The Supabase CLI for migrations and type generation

## Getting started

```bash
npm install
npm run dev        # http://localhost:8080
```

Create `.env.local` in the project root before the first run. It is git-ignored.

### Environment variables

Browser-exposed values (bundled by Vite, so they must stay publishable):

| Variable | Purpose |
| --- | --- |
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase anon/publishable key |

Server-only values (used by SSR loaders and server functions — never prefix these with `VITE_`):

| Variable | Purpose |
| --- | --- |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_PUBLISHABLE_KEY` | Publishable key for SSR reads that act as the user |
| `SUPABASE_SERVICE_ROLE_KEY` | Bypasses RLS; server processes only |
| `APP_SECRET_KEY` | Signs internal server tokens |

`SUPABASE_SERVICE_ROLE_KEY` and `APP_SECRET_KEY` must never reach the browser bundle, a log line or
a commit. Only the publishable key is safe to expose.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Vite dev server with HMR |
| `npm run build` | Production build (Nitro/Cloudflare target) |
| `npm run build:dev` | Build in development mode |
| `npm run preview` | Serve the built output |
| `npm run lint` | ESLint |
| `npm run format` | Prettier |
| `npm test` | Vitest unit tests |
| `npm run test:e2e` | Playwright tests |

End-to-end tests default to `https://tixnaija.name.ng`; set `PLAYWRIGHT_BASE_URL` to point them at a
local server.

## Database

Schema changes live in `supabase/migrations/`, numbered by timestamp and applied in filename order.

```bash
supabase link --project-ref <project-ref>
supabase db push
```

Generate the TypeScript schema after any migration:

```bash
supabase gen types typescript --project-id <project-ref> --schema public \
  > src/integrations/supabase/types.ts
```

`src/integrations/supabase/types.ts` is generated output. Do not hand-edit it: regenerate it, then
fix whatever the compiler reports. Anything that returns `jsonb` (the support-desk RPCs, for
example) is typed by hand in `src/lib/support-rpc-types.ts`, and that file has to be updated when
the SQL contract changes.

## Money rules

- Amounts are stored as integer kobo. Use `formatNaira` / `nairaToKobo` from `src/lib/currency.ts`
  instead of formatting inline.
- Refunds are never mirrored by changing `orders.status` or `ticket_status`; a refund is a row in
  `refund_requests`.
- Deleting an event never deletes refund records. Permanently clearing an event is refused while a
  buyer has paid with no processed refund, or while a refund request is open. The server enforces
  this in `admin_delete_event`; `src/lib/event-deletion.ts` mirrors the rule so the UI cannot offer
  an action that will be rejected.

## Layout

```
src/
  routes/                    File-based routes (TanStack Router); _authenticated/ needs a session
  components/                UI, including admin/, support/ and ui/ primitives
  lib/                       Shared logic: errors, toast, island store, currency, deletion rules
  integrations/supabase/     Browser and server clients plus generated types
supabase/
  migrations/                Schema, RLS policies and RPCs
  functions/                 Edge Functions (email outbox, Paystack webhooks)
```

## Design notes

- Notifications use the Dynamic Island (`src/components/ui/dynamic-island.tsx`), driven by
  `src/lib/island-store.ts`. Import `toast` from `@/lib/toast`, not a toast library.
- Errors shown to users go through `friendlyError()` in `src/lib/errors.ts` so raw Postgres and
  PostgREST text never reaches the screen.
