# Daily Planner

Time-blocked kanban + calendar + timesheet for personal work management. Drag tasks onto a day/week grid, run recurring events, and see at a glance how much free time you have when a new urgent task lands.

## Stack

React 19 · Vite · TypeScript · Tailwind 4 · shadcn/ui · React Router 7 · Vercel Functions · Neon Postgres · Drizzle ORM · JWT auth.

## Setup

```bash
# 1. Install
npm install

# 2. Env
cp .env.example .env.local
# Fill in DATABASE_URL (Neon), JWT_SECRET (long random),
# ADMIN_EMAIL (your email, auto-promoted to admin on first login).

# 3. Database schema → Neon
npm run db:push

# 4. Dev
npm run dev          # Vite on :5173

# For API functions locally, install Vercel CLI:
npx vercel dev       # serves api/ + SPA on a single port
```

## Scripts

| Script | Purpose |
|---|---|
| `dev` | Vite dev server |
| `build` | `tsc -b && vite build` → `dist/` |
| `preview` | Preview built SPA |
| `lint` | ESLint |
| `db:push` | Apply schema to Neon (run before deploying schema changes) |
| `db:generate` | Generate SQL migrations |
| `db:studio` | Drizzle Studio UI |

## Deploy

Push to git → Vercel auto-deploys. **Run `npm run db:push` first if schema changed.**

Set these env vars in Vercel: `DATABASE_URL`, `JWT_SECRET`, `BLOB_READ_WRITE_TOKEN`, `VITE_APP_URL`.

## Project layout

See [`CLAUDE.md`](./CLAUDE.md) — covers function-count cap, ESM `.js` import rule, and `server/lib/` rationale.
See [`docs/deployment-guide.md`](./docs/deployment-guide.md) — end-to-end deploy checklist with all env vars.

## Pages

- `/` — Landing
- `/login`, `/register` — Auth
- `/dashboard` — Today's capacity summary
- `/planner` — Day/week time-blocked kanban
- `/admin` — User management (admin role only)

## API

All under `/api/*` (consolidated to 5 functions under the Vercel Hobby 12-function cap):

- `POST /api/auth/register` · `POST /api/auth/login` · `GET /api/auth/me`
- `GET|POST /api/tasks` · `PATCH|DELETE /api/tasks/:id`
- `GET|POST /api/time-blocks?from=&to=` · `PATCH|DELETE /api/time-blocks/:id`
- `GET /api/reports/summary?from=&to=` · `GET /api/reports/capacity`
- `GET /api/admin/users` · `POST /api/admin/set-role`
