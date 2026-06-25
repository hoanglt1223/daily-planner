# CLAUDE.md — Daily Planner

All-in-one work planner that replaces five tools: Kanban × Calendar × Timesheet × Calendly × Todoist.
Focus: personal use and small teams / SMEs.
Core value: capacity check, show free slots when a manager assigns urgent work.

Pillar → implementation map:
- **Kanban** → `tasks` (status/priority/category) + kanban board UI
- **Calendar** → `time_blocks` (startAt/endAt) + lazy recurring expansion
- **Timesheet** → `time_blocks.actualMinutes` + `reports` function
- **Calendly** → `bookings` + public `/book/:token` page
- **Todoist** → `tasks.recurringRule` (freq/byDay/interval/defaultTime/defaultDurationMinutes)

## Tech stack (FIXED)

- **Frontend:** React 19 + TypeScript + Vite SPA, React Router v7, Tailwind CSS 4, shadcn/ui (new-york). Path alias `@` → `src/`.
- **Backend:** Vercel Serverless Functions (Node, ESM).
- **DB:** Neon Postgres (HTTP driver) + Drizzle ORM.
- **Storage:** Vercel Blob (5MB/file, 1GB total).
- **Auth:** JWT HS256 + optional `x-owner-token` for anonymous ownership.

## Vercel Hobby constraints (HARD LIMITS)

- **Max 12 serverless functions.** We target ≤8. Current count: **7** (`auth`, `tasks`, `time-blocks`, `reports`, `admin`, `share`, `bookings`).
- **10s timeout, 4.5MB request body.**
- Sub-actions dispatched via `vercel.json` rewrites → query params:
  - `/api/auth/:action` → `/api/auth?action=:action`
  - `/api/tasks/:id` → `/api/tasks?id=:id`
  - `/api/time-blocks/:id` → `/api/time-blocks?id=:id`
  - `/api/reports/:kind` → `/api/reports?kind=:kind`
  - `/api/admin/:action` → `/api/admin?action=:action`
  - `/api/share/:token` → `/api/share?token=:token`
  - `/api/bookings/:action` → `/api/bookings?action=:action`
  - `/api/bookings/:action/:id` → `/api/bookings?action=:action&id=:id`
- DB free tier: 0.5GB. Blob free tier: 1GB.

## ESM rules (CRITICAL)

- `package.json` has `"type": "module"`.
- **All relative imports inside `api/` and `server/` MUST end with `.js`** even for `.ts` source.
  - ✅ `import { db } from '../server/lib/db/client.js'`
  - ❌ `import { db } from '../server/lib/db/client'`
- Frontend `src/` does NOT need `.js` extensions (Vite handles it).

## File layout

```
api/                  ← serverless functions (each top-level file = 1 function)
  auth.ts
  tasks.ts
  time-blocks.ts
  reports.ts
  admin.ts
server/lib/           ← shared backend code — NOT counted as functions
  auth.ts
  auth-middleware.ts
  db/
    client.ts
    schema.ts
    migrations/
src/                  ← frontend SPA
  components/
  pages/
  lib/
  router.tsx
  main.tsx
  index.css
```

**Rule:** Shared backend code lives in `server/lib/`, NEVER in `api/lib/` — Vercel treats every file under `api/` as a function.

## Database

- Schema: `server/lib/db/schema.ts` (drizzle-orm/pg-core).
- Tables: `users`, `categories`, `tasks`, `time_blocks`.
- Config: `drizzle.config.ts`.
- **Schema changes DO NOT auto-apply on deploy.** Run `npm run db:push` manually before deploying schema changes.
- Scripts: `db:push`, `db:generate`, `db:studio`.

## Auth

- JWT signed in `server/lib/auth.ts` (HS256, 7-day expiry, scrypt password hash).
- Middleware: `requireAuth` / `requireAdmin` / `tryAuth` in `server/lib/auth-middleware.ts`.
- Anonymous ownership: client generates UUID, stores in localStorage, sends as `x-owner-token` header.

## Deployment

- Vercel auto-deploys from `git push`. **Do NOT run `vercel --prod` manually.**
- Env vars (set in Vercel dashboard): `DATABASE_URL`, `JWT_SECRET`, `VITE_APP_URL`, plus optional: `ADMIN_EMAIL`, `RESEND_API_KEY`, `EMAIL_FROM`, `BLOB_READ_WRITE_TOKEN`.
- Before deploying schema changes: `npm run db:push`.
- See full checklist in [`docs/deployment-guide.md`](./docs/deployment-guide.md).

## Admin bootstrap

`ADMIN_EMAIL` (comma-separated allowlist) auto-promotes matching accounts to `admin` on register AND on next login. Avoids needing direct SQL access for first admin.

## Adding features

- Need a new endpoint? Check function count first. Prefer extending an existing function via `action` query.
- shadcn components: `npx shadcn@latest add <component>` — placed in `src/components/ui/`.
- Keep individual files <200 lines.

## Domain model

- `users` — adds `role` (`user|manager|admin`), `shareToken` (nanoid 16), `privacy` (`details_to_managers|busy_only_to_managers|private`), `timezone`, `materializedUntil` (recurring cursor).
- `manager_users` — m:n manager↔user mapping. Cross-team works automatically (no team table).
- `tasks` — kanban cards: `estimatedMinutes`, `recurringRule` (JSON with `freq|byDay|interval|defaultTime|defaultDurationMinutes`), `status`, `priority`, `categoryId`.
- `time_blocks` — scheduled calendar instances: `startAt`, `endAt`, `taskId?`, `actualMinutes?`, `status` (`planned|in_progress|completed|skipped|pending`). Unique `(taskId, startAt)` for recurring idempotency.
- `bookings` — Calendly-style external bookings. Unique `(ownerUserId, startAt)` prevents double-book.

## Recurring expansion (lazy, 3-week window)

- `server/lib/recurring/expand.ts` — pure function: rule → occurrences in [from, to].
- `server/lib/recurring/materializer.ts` — `materializeIfStale(userId)` extends `time_blocks` up to `today + 21d`, idempotent via unique index. Called inside `api/time-blocks.ts` GET and `api/share.ts` GET.

## Privacy / cross-team busy

- `?viewUser=<uuid>` on `/api/time-blocks`: viewer is target itself OR `admin` OR present in `manager_users(manager_id=viewer, user_id=target)`.
- Response respects target's `privacy`:
  - `details_to_managers` → full block payload
  - `busy_only_to_managers` → titles redacted to `"Busy"`
  - `private` → 403 to non-self / non-admin

## Share + booking

- Per-user `shareToken`. `/u/:token` = public read-only week. `/book/:token` = public Calendly-style booking page (30-min slots, 14-day horizon).
- Booking flow: visitor POSTs → creates `bookings` (`pending`) + provisional `time_blocks` (`status='pending'`). Owner approves in dashboard → block → `planned`. Reject → block deleted.
