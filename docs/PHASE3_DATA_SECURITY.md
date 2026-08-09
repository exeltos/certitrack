# CertiTrack Phase 3 — Data & Security Foundation

This package is intentionally backward-compatible with the existing UI.

## Business access model implemented by the migration

- Company: its own company certificates.
- Company: shared (not private) certificates of suppliers linked through `company_suppliers`, only while supplier access is not blocked.
- Supplier: only its own certificates.
- Supplier: may see only its own `company_suppliers` relationships, so it can see which companies saved it.
- Company: cannot use `company_suppliers` as a reverse directory to discover other companies connected to a supplier.

## Apply order

1. Back up the Supabase database.
2. Run `supabase/migrations/20260809_phase3a_tenant_security.sql`.
3. Test login as one company and one supplier.
4. Deploy this Phase 3 frontend package.
5. Run `supabase/migrations/20260809_phase3b_compliance_foundation.sql`.
6. Do not remove legacy `*_user_id`, name/email/AFM certificate columns yet.

## Important Storage note

The supplied buckets are currently public. Do **not** flip them to private before the frontend is migrated from `getPublicUrl()` to signed URLs; doing so would break existing certificate links. Storage hardening is deliberately staged for Phase 3C.

## Existing data

Phase 3A backfills `company_id` / `supplier_id` on existing certificate rows from their legacy `*_user_id` ownership. New uploads in this package populate both legacy and stable organization IDs.

## Compliance foundation

Phase 3B adds:
- `certificate_types`
- `requirement_profiles`
- `requirement_profile_items`
- `company_supplier_requirements`
- `audit_log`
- `certificate_type_id`
- `verification_status`

The current UI does not depend on these yet; they are additive groundwork for the next UI/compliance step.


## Phase 3C — Private Storage

Deploy the Phase 3C frontend package first, while buckets are still public.
Then run `supabase/migrations/20260809_phase3c_private_storage.sql`.

What changes:
- both certificate buckets become private;
- browser pages use `createSignedUrl()` for preview;
- newly uploaded records store the object path in `file_url`;
- legacy rows containing old public URLs continue to work because the frontend extracts the object path;
- company users can sign/read only their own company files;
- supplier users can sign/read their own supplier files;
- connected companies can sign/read only non-private supplier certificates while `company_suppliers.access <> 'blocked'`;
- no files are moved and no existing certificate rows are deleted.

Signed preview links expire after 10 minutes.
Signed links intentionally sent by the company email workflow expire after 24 hours.


### Phase 3C deployment order — do not reverse it

1. Deploy the files from this Phase 3C ZIP to the site.
2. Confirm the site loads and login works.
3. Only then run `20260809_phase3c_private_storage.sql`.
4. Run `supabase/PHASE3C_VERIFY.sql`.
5. Test:
   - supplier opens own certificate;
   - supplier sees companies that saved it;
   - company opens own certificate;
   - company opens a shared supplier certificate;
   - company cannot see a supplier certificate marked private;
   - blocked company cannot open that supplier's certificate.

If the SQL is run before the Phase 3C frontend is deployed, old pages using public URLs will stop opening PDFs.
