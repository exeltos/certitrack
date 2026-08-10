# Phase 34 — Auth & Account Security
- Canonical email/password login.
- Signup uses Supabase email verification redirect and Phase33 registration trigger.
- Shared 12+ character password policy module.
- Official Supabase password recovery flow; removed legacy public AFM/email lookup from runtime.
- Recovery reset validates session and password policy.
- Organization lookup now prefers organization_members.
- Removed hard-coded admin login bypass from normal login.
- Added deployment checklist and source-controlled Auth email template references.
- No production Supabase changes are performed in this phase.
