# Phase 33 Canonical Backend Model

```text
auth.users
   │
   └── organization_members ────── organizations
                 │                       │
                 │                       ├── certificates ── certificate_types
                 │                       │        │
                 │                       │        └── private Storage PDF
                 │                       │
                 │                       ├── organization_relationships ── organizations
                 │                       │
                 │                       ├── relationship_invitations
                 │                       │
                 └── notifications       ├── notification_preferences
                                         │
                                         └── audit_log
```

## Security boundaries
- Membership is the primary tenant boundary.
- RLS is enabled on every client-accessible public table.
- Certificates are readable by own organization members, or by active partners only when `visibility='partners'`.
- Storage is private. Paths begin with the owning organization UUID.
- Relationship state transitions use SECURITY DEFINER RPCs rather than direct client updates.
- Audit rows are not writable by normal authenticated clients.

## Roles
- `owner`: full organization administration.
- `admin`: organization administration, members, relationships, certificates.
- `member`: operational certificate creation/update and partner request initiation.
- `viewer`: read-only organization access.
- `platform_admin`: separate platform allowlist, not a normal organization role.

## Lifecycle rules
- Organization: pending_verification → active → suspended / closure_requested → closed.
- Relationship: pending → active / declined; active → ended; blocked is retained as history/control state.
- Certificate: active row → soft deleted (`deleted_at`). Physical PDF deletion/retention policy will be finalized later.
