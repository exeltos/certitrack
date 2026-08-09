# Current RLS review — based on repository migrations only

This is not a live Supabase snapshot. The definitive review must use `supabase/AUDIT_DATABASE_AND_RLS.sql` against the current project.

## Important findings already visible in the repository

1. `suppliers_insert_authenticated` uses `WITH CHECK (true)`. Any authenticated account can insert a supplier row. This should be replaced with a controlled registration/import path.
2. `company_suppliers_update_members` lets either relationship member update the row and its WITH CHECK only verifies membership after the update. A supplier can potentially change `company_id` while keeping its own `supplier_id`, which is too broad. Access/status fields should be controlled separately from relationship identity.
3. Platform Admin currently has no explicit RLS policy in the migrations. Phase 15 intentionally does not weaken RLS to make the admin UI work.
4. `audit_log` has tenant read access but no authenticated insert policy. This is acceptable only if audit events are written by trusted server/service-role functions; confirm this in the live database/functions.
5. Certificate UPDATE/DELETE policies still rely partly on legacy `*_user_id` ownership instead of consistently checking stable organization IDs. This should be normalized after data backfill is confirmed.
6. The repository migrations assume several core tables already existed before Phase 3. Therefore the repository alone is not sufficient to prove the complete live schema.
7. Storage is private in Phase 3C and supplier document reads are relationship + visibility gated. This is directionally correct, but live storage policies must be checked for leftover legacy policies.

## Next step

Run the read-only audit SQL and export/copy the result sets. Then review every table, FK, index, RLS policy, storage policy, function and trigger before applying an Admin RLS migration.
