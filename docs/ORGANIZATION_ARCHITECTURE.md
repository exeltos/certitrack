# CertiTrack — Canonical Architecture (Phase 39)

The production model has one business entity: **Organization**.

An organization may be a customer, supplier, contractor or partner depending on a relationship. Those are not account types.

Core runtime:
- `organizations`
- `organization_members`
- `certificates`
- `certificate_files`
- `certificate_types`
- `organization_relationships`
- `relationship_invitations`
- `notification_preferences`
- `notifications`
- `email_outbox`
- `audit_log`
- `platform_admins`

Private certificate Storage:
- `organizationcertificates`

Legacy `companies`, `suppliers`, certificate tables and buckets are migration sources only. They are not queried by the Phase39 frontend.
