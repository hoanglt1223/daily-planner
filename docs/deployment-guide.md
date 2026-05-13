# Deployment Guide

End-to-end checklist for getting Daily Planner from local checkout to production on Vercel + Neon.

## 1. Local setup

```bash
git clone <repo>
cd daily-planner
npm install
cp .env.example .env.local   # then fill in values (see below)
npm run db:push              # applies schema to Neon
npm run dev                  # SPA on :5173 — OR — npx vercel dev for full-stack
```

## 2. Required env vars

Set in `.env.local` for dev, in Vercel project settings for prod.

| Var | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | **yes** | Neon postgres connection string. Format: `postgres://user:pass@host/db?sslmode=require` |
| `JWT_SECRET` | **yes** | Long random string, ≥32 chars. Generate: `openssl rand -hex 32` |
| `VITE_APP_URL` | **yes** | Public URL of the app (used in email links). e.g. `https://daily.example.com` |
| `ADMIN_EMAIL` | recommended | Comma-separated list of emails auto-promoted to admin on register/login. Bootstrap without SQL. |
| `RESEND_API_KEY` | optional | Resend API key. Unset = email logs to console only. |
| `EMAIL_FROM` | optional | Verified sender. e.g. `"Daily Planner <noreply@yourdomain.com>"` |
| `BLOB_READ_WRITE_TOKEN` | optional | Only needed if using Vercel Blob uploads. |

## 3. First admin

Pick one:

- **Easy**: set `ADMIN_EMAIL=you@example.com` in `.env.local` and Vercel env. Register normally — your account is auto-admin. Existing accounts get promoted on next login.
- **Manual**: register normally, then via `npm run db:studio` or `psql "$DATABASE_URL"`:
  ```sql
  UPDATE users SET role = 'admin' WHERE email = 'you@example.com';
  ```

## 4. Vercel deploy

1. Push the repo to GitHub.
2. In Vercel: **Add New Project** → import the repo.
3. Framework preset: **Vite**. Build command + output auto-detected.
4. **Settings → Environment Variables**: add everything from section 2.
5. Deploy.

**Important:** schema changes do NOT auto-apply on deploy. After any `server/lib/db/schema.ts` change:

```bash
npm run db:push       # against the same Neon DB Vercel uses
git push              # triggers Vercel build
```

## 5. Hobby plan limits to watch

- **12 functions max** — current use 7. Adding a new endpoint? Extend an existing function with an `action` query first.
- **10s timeout** per function. The recurring materializer runs on each `/api/time-blocks` GET — keep it under that.
- **4.5 MB request body**.
- **0.5 GB Neon DB**, **1 GB Vercel Blob**, **5 MB per blob**.
- Resend free: **100 emails/day**.

## 6. Smoke test after deploy

- [ ] `/register` works → JWT cookie set
- [ ] `/planner` loads, drag from backlog → grid creates a `time_block`
- [ ] Resize a block → endAt updates
- [ ] Enable share on dashboard → `/u/:token` loads in incognito
- [ ] Submit a booking on `/book/:token` → owner sees pending in inbox
- [ ] Approve booking → status changes, email logs (or sends if Resend set)
- [ ] Admin can change a user's role; manager can see managed users on `/manager`
- [ ] Recurring task: create one with `recurringRule`, blocks materialize for next 21 days

## 7. Common issues

- **`DATABASE_URL is required`** during `db:push`: drizzle-kit only auto-loads `.env`, not `.env.local`. `drizzle.config.ts` already does manual loading — if it ever breaks, check that file.
- **CORS in `vercel dev`**: not needed, single origin serves both.
- **Email "from" rejected**: Resend free uses `onboarding@resend.dev`. For custom domain, verify DNS in Resend dashboard.
- **Time zone confusion**: everything stored as UTC, rendered in `users.timezone` (default `Asia/Bangkok`). Wall-clock recurring rules respect user TZ.
