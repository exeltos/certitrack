# Phase 31

- Reliable in-app certificate PDF preview using the signed storage URL in an embedded viewer with no CertiTrack download action.
- Certificate create/edit form now includes title, type, certificate number, issue date, expiry date, issuer, notes, visibility and PDF upload/replacement.
- Private certificates receive a full-row visual treatment, not only an icon/badge.
- Permanent checkboxes on own-certificate rows plus Select all, Print selected and Export CSV.
- Partner list has no action buttons. The whole row opens the partner relationship card.
- Partner card owns relationship actions (accept/reject/cancel/remove) and shows partner details plus shared certificates.
- Removing a partner removes only organization_relationships. It never deletes the partner organization/account/certificates.
- Added additive Supabase migration `phase31_certificate_metadata.sql` for richer certificate metadata.
