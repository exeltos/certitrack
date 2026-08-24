# Phase 39 — Rollback Plan

Before deployment:
- capture current database backup/export,
- retain legacy tables,
- retain legacy Storage buckets,
- do not drop old RLS/policies until canonical validation is complete.

The Phase39 bridge is additive and does not drop legacy source tables or files.

If canonical validation fails:
1. stop frontend deployment,
2. stop notification Cron,
3. keep legacy application pointed at existing legacy data,
4. restore database from the pre-deployment backup if required,
5. investigate migration error before retrying.

Do not use hard-delete cleanup as rollback.
