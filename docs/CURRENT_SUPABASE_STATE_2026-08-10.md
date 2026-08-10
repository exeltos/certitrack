# Current Supabase State — Read-only Preflight (2026-08-10)

Project Ref: `klutmusrabsizqjnzwpu`

Verified row counts:
- auth.users: 0
- companies: 0
- suppliers: 0
- company_certificates: 0
- supplier_certificates: 0
- company_suppliers: 0
- company_supplier_requirements: 0
- requirement_profiles: 0
- requirement_profile_items: 0
- supplier_invites: 0
- company_notifications: 0
- supplier_notifications: 0
- audit_log: 0
- certificate_types: 10

Existing certificate type codes:
CE, INSURANCE, INSURANCE_CLEARANCE, ISO13485, ISO14001, ISO27001, ISO45001,
ISO9001, OPERATING_LICENSE, TAX_CLEARANCE.

Existing Storage buckets:
- companycertificates — public
- suppliercertificates — public

Production strategy:
- preserve and upgrade certificate_types in place,
- leave legacy tables/buckets untouched during initial deployment,
- install the canonical Organization schema beside the empty legacy schema,
- use new private bucket `organizationcertificates`,
- no legacy data/file migration is required for initial go-live.
