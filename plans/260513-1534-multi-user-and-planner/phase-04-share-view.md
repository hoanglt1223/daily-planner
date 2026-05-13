# Phase 04 — Shared read-only view

**Status:** Pending · **Priority:** P1 · **Depends on:** Phase 01, 02, 03

## Overview

Per-user shareable URL `/u/:token` showing current week + next 2 weeks read-only. Respects user's `privacy` setting:
- `details_to_managers` → public link shows titles + categories
- `busy_only_to_managers` → public link shows only "busy" boxes (no titles)
- `private` → public link disabled (404)

## Endpoint

`api/share.ts` (new function, +1 to budget):

| Method | Path | Auth | Behavior |
|---|---|---|---|
| GET | `/api/share/:token` | none | returns `{ user: {name, timezone}, blocks: [...], privacy }`; blocks redacted per privacy |
| POST | `/api/share?action=enable` | requireAuth | generates nanoid(16), saves to `users.shareToken` |
| POST | `/api/share?action=disable` | requireAuth | sets `users.shareToken = null` |
| POST | `/api/share?action=privacy` | requireAuth | body `{ privacy }`, validates enum |

Use `vercel.json` rewrite: `/api/share/:token` → `/api/share?token=:token`.

## Redaction logic

```ts
function redactBlock(block, privacy) {
  if (privacy === 'details_to_managers') return block; // full
  if (privacy === 'busy_only_to_managers') return {
    id: block.id, startAt: block.startAt, endAt: block.endAt, status: block.status,
    title: 'Busy',
  };
  // private mode never reaches this point (404 before)
}
```

## Frontend

- New page `src/pages/share-view-page.tsx` — fetches `/api/share/:token`, renders read-only week using same `planner-grid.tsx` components in `readOnly` mode (no DndContext).
- Dashboard gets a "Share my week" panel with copy-link button + privacy radio.

## Router

```tsx
{ path: '/u/:token', element: <ShareViewPage /> }
```

`vercel.json` SPA fallback already covers `/u/...`.

## Todo

- [ ] `api/share.ts` with token GET + enable/disable/privacy POSTs
- [ ] Rewrite rule in `vercel.json`
- [ ] `share-view-page.tsx`
- [ ] Share panel in dashboard
- [ ] Read-only flag on `planner-grid` components

## Success criteria

- User enables share → gets URL `https://app/u/abc123def456...`
- Visiting URL in incognito shows week, no auth required
- Toggling privacy to `busy_only_to_managers` removes titles from public view immediately

## Risks

- Token enumeration — nanoid(16) = 95 bits entropy, safe.
- Cache: share endpoint should set `Cache-Control: private, max-age=60` to avoid leaking via CDN.
