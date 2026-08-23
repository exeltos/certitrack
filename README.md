# CertiTrack

Certificate compliance tracking platform for organizations and their supply
chain partners: track certificate expiry, share compliance status with
connected partner organizations, and get notified before something lapses.

Static frontend (no build step) + Supabase (Postgres, Auth, Storage, Edge
Functions) + Netlify Functions for email/notification workflows.

## Getting started

```bash
npm install
npm run dev     # local static server, see scripts/dev-server.js
npm test        # unit test suite (vitest)
```

The frontend reads its Supabase connection from `src/config/appConfig.js`.
There is no build step — pages import ES modules directly via `<script type="module">`.

## Project layout

| Path | What's there |
|---|---|
| `pages/`, `src/pages/` | HTML pages and their page-specific JS, grouped by role (`organization`, `company`, `supplier`, `admin`, `auth`) |
| `src/services/` | Supabase data-access layer |
| `src/core/`, `src/shared/`, `src/components/` | Shared logic, utilities, and UI building blocks |
| `netlify/functions/` | Serverless functions: email sending, password reset, scheduled notification jobs |
| `supabase/production/` | The canonical schema + preflight/validation scripts — **read `docs/NEXT_ACTION.md` before running anything here** |
| `supabase/migrations/` | Incremental migrations, applied in order |
| `tests/` | Unit tests (vitest) |
| `docs/` | All project documentation — architecture history, security review, operations runbooks, legal drafts |

## Before deploying

1. Read `docs/CANONICAL_RELEASE.md` for the current baseline.
2. Read `docs/NEXT_ACTION.md` — it describes the exact next safe step for the
   live Supabase project. Don't skip ahead of it.
3. Read `docs/CURRENT_RLS_REVIEW_BEFORE_LIVE_AUDIT.md` and
   `docs/SECURITY_HARDENING.md` for open security items.

## Documentation index

- **Architecture history**: `docs/PHASE*.md` — one file per development phase, oldest to newest. `docs/CANONICAL_RELEASE.md` tells you which baseline is current.
- **Security**: `docs/SECURITY_HARDENING.md`, `docs/CURRENT_RLS_REVIEW_BEFORE_LIVE_AUDIT.md`
- **Operations**: `docs/operations/` — monitoring, backups/DR, staging setup, SLA
- **Legal (drafts, need lawyer review)**: `docs/legal/` — privacy policy, terms of service, data retention
- **User guide**: `docs/user-guide/`

## Testing

```bash
npm test
```

Unit tests cover pure logic (certificate status/date math, password policy).
They don't hit a real Supabase instance — see `docs/operations/STAGING_SETUP.md`
for how to test against a real (non-production) database.

## CI

`.github/workflows/ci.yml` runs the test suite, a secret-leak scan, and a
basic migration sanity check on every push and pull request.
