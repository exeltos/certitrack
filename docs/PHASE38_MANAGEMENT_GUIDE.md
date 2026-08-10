# Phase 38 — Management Guide

## What changed
Phase38 closes the account-management and audit gap before deployment.

### Organization closure
An organization cannot delete itself directly.
An owner can submit a closure request. The organization remains accessible while the request is pending.
A platform administrator can then complete closure in a controlled operation.

On final closure:
- organization status becomes `closed`
- active organization members are suspended
- pending/active partner relationships are ended
- certificates remain stored
- certificate file history remains stored
- audit history remains stored
- the partner organizations themselves are never deleted

### Suspension
Platform Admin can temporarily suspend and later reactivate an organization.

### Membership
Server RPCs now enforce:
- owner/admin role management
- member removal
- at least one active owner must remain
- an owner cannot simply remove themselves without transferring ownership

### Audit
`audit_log` is append-only from the client perspective.
Platform Admin can read platform-wide audit; organization members remain tenant-scoped.

## What you do now
Nothing in Supabase yet.

Do not run Phase38 separately. It depends on Phases 33/35/36/37.

## Next checkpoint
The next phase should be the final pre-deployment audit:
1. inspect all legacy tables and frontend fallbacks,
2. produce migration order,
3. produce backup/rollback plan,
4. inspect real Supabase project read-only,
5. only then begin controlled deployment.
