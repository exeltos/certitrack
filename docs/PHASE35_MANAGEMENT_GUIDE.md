# Phase 35 — Management Guide

## What changed
This phase hardens the canonical certificate lifecycle:
- private `organizationcertificates` bucket
- canonical path: `<organization_uuid>/<certificate_uuid>/<random>.pdf`
- PDF-only, maximum 25 MB
- certificate ownership by organization
- current PDF + immutable historical PDF versions through `certificate_files`
- metadata editing and PDF replacement are separate controlled operations
- visibility (`private` / `partners`) is edited only from the certificate edit form
- no visibility action icon in the list
- soft delete for certificates; historical files are retained
- partner read access only to the current PDF of certificates explicitly visible to partners
- role-aware actions: owner/admin/member can create/edit, owner/admin can delete, viewer is read-only
- bulk selection/print/CSV remain client-side read operations

## What you do now
**Nothing in Supabase yet.**
Keep Phase35 as the new checkpoint.

## Do NOT do yet
- Do not run Phase33 or Phase35 migrations.
- Do not create/delete Storage buckets manually.
- Do not make any certificate bucket public.
- Do not delete legacy certificate tables/buckets.
- Do not copy service-role keys into browser code.
- Do not manually recreate RLS policies.

## Why
Phase35 depends on the Phase33 canonical Organization foundation. We will deploy them together only after a read-only preflight and backup of the actual Supabase project.

## What will happen at deployment later
1. Read-only preflight of the real Supabase project.
2. Backup / migration checkpoint.
3. Dry-run Phase33 + Phase35 migrations.
4. Review tables, constraints, RLS and Storage policies.
5. Apply migrations.
6. Configure Auth settings from Phase34.
7. Test with two organizations and at least one active relationship.
8. Only after tests, migrate legacy certificate data/files.

## Acceptance tests after deployment
- Org A creates a certificate with a PDF.
- Storage path contains Org A id + certificate id.
- Org A can preview the PDF.
- Replacement creates version 2; version 1 remains in history.
- Setting visibility to private immediately removes partner access.
- Setting visibility to partners restores access only for an active partner.
- Org B cannot edit/delete/download through application actions.
- An unrelated Org C cannot read the row or storage object.
- Delete hides certificate from normal lists but retains audit/history.
- A member cannot delete if not owner/admin.
- Non-PDF and >25 MB uploads are rejected.
