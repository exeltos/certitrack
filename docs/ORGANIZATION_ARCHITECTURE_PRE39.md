# CertiTrack Phase 28 — Organization Architecture

## Canonical model
- `organizations`: every legal entity has one account/profile.
- `certificates`: every certificate belongs to one organization.
- `organization_relationships`: organizations connect to other organizations; supplier/customer is a property of a relationship, not an account role.
- `is_private`: certificate visibility; shared documents are visible only through an active relationship.

## Transitional compatibility
The frontend uses `organizationService`. It first tries the new tables and falls back to legacy `companies`, `suppliers`, `company_certificates`, `supplier_certificates`, and `company_suppliers` when the migration has not yet been applied.

Legacy pages remain in the package only as rollback/reference compatibility. New login and registration route users to `/pages/organization/*`.

## Migration
Run `supabase/phase28_organization_network.sql` after a database backup. It is additive and does not delete legacy tables.
