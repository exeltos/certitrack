# Phase 35 — Certificate Security Model

## Ownership
Every certificate has exactly one `organization_id`. Ownership cannot be moved by normal client UPDATE.

## File versions
`certificate_files` stores immutable versions. `certificates.current_file_id` points to the currently displayed PDF.

Replacement does not overwrite or delete the previous PDF:
- version 1 → retired
- version 2 → current

This preserves auditability and avoids destructive replacement.

## Visibility
`certificates.visibility`:
- `private`: only the owning organization (and platform administration) can read.
- `partners`: the owning organization plus organizations with an active relationship can read.

Partners can access only the **current** file version. Historical versions remain available only to the owning organization/admin audit path.

## Deletion
Normal certificate deletion is a soft delete:
- `deleted_at`
- `deleted_by`

No client-side hard DELETE policy is provided for canonical certificates, certificate files or Storage objects.

## Storage
Bucket: `organizationcertificates`
- private
- PDF only
- max 25 MB
- object path: `<organization_uuid>/<certificate_uuid>/<random>.pdf`
- immutable objects; replacement uploads a new object

## Roles
- owner: create/edit/delete/view
- admin: create/edit/delete/view
- member: create/edit/view
- viewer: view
- active external partner: view current shared certificate/PDF only
