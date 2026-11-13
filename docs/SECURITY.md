# Security

## Guarantees enforced by the database

| Guarantee | Where |
|---|---|
| An organization sees only its own data, plus what each connected partner chose to show it | RLS on all tables; `ct_org_can_view_certificate` |
| No transitive access: partners of partners, and partners' other connections, are invisible | `connections_select`, `organizations_select`, `certificate_shares_select` policies |
| A grantee never learns who else a certificate is shared with | `certificate_shares_select` |
| Ending a connection stops access immediately for both sides and removes per-organization shares | `ct_end_connection` |
| Each side manages only its own document requests | `ct_cancel_document_request` / `ct_decline_document_request` |
| Partner PDF downloads are logged; storage refuses partner downloads that were not logged | `ct_open_certificate` + `ct_storage_select` |
| PDFs are private, immutable, PDF-only, ≤ 25 MB | bucket config + storage policies |
| Clients can only edit whitelisted columns; status, ownership, deletion and files change only through `ct_*` functions | column grants + RPCs |
| Notification/email sending, scheduled jobs and the email outbox are not reachable from the browser | no grants / no policies |

All of these are covered by `supabase/tests/10_peer_network_test.sql` (`npm run test:db`).

## Frontend

- Every dynamic value is escaped by the `html` template (`src/lib/html.js`); dialogs
  use native `<dialog>`, and error messages are rendered as text.
- No third-party scripts from CDNs; dependencies are pinned in `assets/vendor/`.
- The Supabase anon key in `src/config/appConfig.js` is public by design; never
  put the service-role key in frontend code.

## Fixed in the 2026-11 rebuild

- Stored XSS: organization names and audit entries were rendered unescaped in the admin dashboard.
- Reflected XSS: the password-reset page rendered `error_description` from the URL as HTML.
- Any signed-in user could call the notification helper and spam any organization.
- Either side of a relationship could edit or delete the other side's compliance requirements.

## Operational checklist

- Supabase Auth: Confirm email ON; password policy ≥ 12 chars with upper/lower/number/symbol.
- Enable MFA for platform admin accounts.
- Run `get_advisors` (Supabase security advisor) after every migration.
