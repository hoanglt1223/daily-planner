# Phase 04 — External calendar sync (brief)

Replaces: Calendar (Google / Outlook). Impact: High. Effort: High. New function: **Likely yes — the only item that threatens the function cap.**

## Problem
No two-way sync with external calendars. External meetings don't show as busy here; planned blocks don't appear in the user's Google/Outlook calendar. Weakens the "replace your calendar" claim and makes booking conflict-blind.

## Scope (to detail next round)
- OAuth connect (Google Calendar first; Outlook/Graph optional second provider).
- **Inbound**: pull external events → busy `time_blocks` (or a parallel busy source) so capacity + booking slots respect them.
- **Outbound**: push `planned` blocks as external calendar events; keep in sync on edit/delete.
- Sync via incremental pull (sync tokens) and/or webhook channels; reconcile on a cursor like the recurring `materializedUntil` pattern.

## Function-count impact (RISK)
- Needs an OAuth callback endpoint and likely a webhook receiver. Could be folded into one new `api/integrations.ts` (action-dispatched) to stay at **+1 function (7 → 8)**, holding the ≤8 target. Confirm before building.

## Schema (additive)
- `calendar_connections` (userId, provider, accessToken, refreshToken, expiry, syncToken, channelId/expiry).
- `time_blocks`: add `externalId?` + `source?` to mark synced events and prevent echo loops.
- Run `npm run db:push`.

## Risks (highest of the four)
- Token storage = secrets at rest; encrypt + never log.
- 10s timeout: sync must be incremental/batched, not full-calendar each call.
- Echo loops: outbound push must not re-import as inbound.
- Build after Phase 02 so booking conflict checks consume synced busy.
- Provider review/verification (Google OAuth consent screen) is a real calendar-time cost.

## Open question
Google only, or Google + Outlook from the start? (Doubles OAuth + sync surface.)
