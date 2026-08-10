# Production Fix 01 — audit_log identity sequence

The first execution of `01_certitrack_production_schema.sql` failed with:

`cannot change ownership of identity sequence "audit_log_id_seq"`

Cause:
The live `audit_log.id` already owns an identity-backed sequence. The compatibility block tried to recreate/reassign the same sequence.

Fix:
The production migration now preserves the existing identity/sequence unchanged and only adds the canonical audit columns.

Safety:
The main production file runs inside one explicit transaction (`BEGIN ... COMMIT`). Because the error occurred before COMMIT, PostgreSQL aborted the transaction; partial canonical schema changes should not persist.

Run `00b_confirm_failed_run_rolled_back.sql` before retrying `01`.
