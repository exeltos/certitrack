# Phase 15 — Multi-tenant SaaS / Platform Admin

## Product model
CertiTrack is treated as a neutral B2B multi-tenant SaaS with three application contexts:

- Company tenant
- Supplier tenant
- Platform Admin

A supplier is an independent tenant/entity and may be linked to multiple companies. Certificates remain owned by the issuing/owning tenant. Company access to supplier certificates depends on the relationship and certificate visibility.

## Platform Admin
Phase 15 replaces the legacy single-table admin screen with a shared SaaS shell and three focused screens:

- Platform overview
- Organizations
- Audit log

The Platform Admin UI intentionally does **not** add broad database privileges in this phase. Production-wide read/update privileges must be introduced only after a full RLS review. The UI shows an explicit restricted-state message if current policies deny cross-tenant access.

## Security rule
Do not use email-address checks for administrator authorization. Platform Admin requires a server-controlled `app_metadata.app_role = admin` claim. The next phase is a full schema/RLS/storage-policy audit before enabling platform-wide administration.
