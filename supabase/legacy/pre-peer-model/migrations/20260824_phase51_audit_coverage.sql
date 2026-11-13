-- Phase 51 — Close audit_log coverage gaps
--
-- public.ct_audit_row_change() (defined in the Phase 49 canonical schema)
-- already has branches for 'certificates', 'certificate_files',
-- 'organization_relationships', 'organization_members' and 'organizations' --
-- but only TWO triggers were actually attached (ct_audit_certificate_files,
-- insert-only, and ct_audit_organization_members). That means:
--
--   - Certificate create/edit/soft-delete was NOT being audited at all.
--   - Certificate file replace/delete was NOT being audited (insert-only).
--   - Partner relationship request/accept/decline/end was NOT being audited
--     at the row level (only organization open/close events were, via
--     explicit ct_write_audit() calls elsewhere in the schema).
--
-- This migration attaches the missing triggers using the SAME existing
-- function, so no new logic is introduced -- just the missing wiring.
--
-- Safe to re-run (drop-if-exists before each create).

drop trigger if exists ct_audit_certificate_files on public.certificate_files;
create trigger ct_audit_certificate_files
after insert or update or delete on public.certificate_files
for each row execute procedure public.ct_audit_row_change();

drop trigger if exists ct_audit_certificates on public.certificates;
create trigger ct_audit_certificates
after insert or update or delete on public.certificates
for each row execute procedure public.ct_audit_row_change();

drop trigger if exists ct_audit_organization_relationships on public.organization_relationships;
create trigger ct_audit_organization_relationships
after insert or update or delete on public.organization_relationships
for each row execute procedure public.ct_audit_row_change();

-- organizations: profile edits (name, contact info, etc.) were not audited
-- at the row level before -- only the explicit closure/reopen RPC calls
-- were. This adds coverage for ordinary field edits too.
drop trigger if exists ct_audit_organizations on public.organizations;
create trigger ct_audit_organizations
after update on public.organizations
for each row execute procedure public.ct_audit_row_change();
-- Not AFTER INSERT: organization creation already has its own registration
-- flow context; add an insert branch here later if you want row-level
-- coverage of creation too.

-- Verification query (run manually after applying, not part of the migration):
--   select event_object_table, trigger_name
--   from information_schema.triggers
--   where trigger_schema = 'public' and trigger_name like 'ct_audit_%'
--   order by 1;
-- Expect: certificate_files, certificates, organization_relationships,
-- organization_members, organizations.
