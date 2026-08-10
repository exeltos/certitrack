# CertiTrack Phase 33 — Backend Foundation Management Guide

## Στόχος της φάσης
Η Phase 33 κλειδώνει το canonical backend model. Δεν ενεργοποιεί ακόμη production email templates, password policy, expiry cron ή transactional email provider — αυτά μπαίνουν στις επόμενες φάσεις πάνω στη σταθερή βάση.

## Τι δημιουργήθηκε
- `organizations`: μία νομική οντότητα ανά ΑΦΜ/VAT.
- `organization_members`: πολλοί χρήστες ανά οργανισμό με `owner/admin/member/viewer`.
- `certificate_types`: κεντρικός κατάλογος τύπων πιστοποιητικών.
- `certificates`: ένα ενιαίο certificate model, private/partners visibility, PDF metadata και soft delete.
- `organization_relationships`: σχέση μεταξύ οργανισμών με ιστορικό· δεν γίνεται hard delete από το UI.
- `relationship_invitations`: προσκλήσεις προς υπάρχον ή νέο οργανισμό.
- `notification_preferences`, `notifications`: foundation για in-app/email ειδοποιήσεις.
- `audit_log`: immutable ιστορικό βασικών αλλαγών.
- `platform_admins`: explicit allowlist για platform administration.
- Private Storage bucket `organizationcertificates` μόνο για PDF έως 25 MB.
- RLS policies και server-side helper/RPC functions.

## Τι αλλάζει στην αρχιτεκτονική
Ο παλιός περιορισμός «ένας auth user = μία εταιρεία» καταργείται. Ένας οργανισμός μπορεί να έχει πολλούς χρήστες. Το ownership δεν βασίζεται πλέον στο `organizations.user_id`, αλλά στο `organization_members`.

Η διαγραφή πιστοποιητικού προορίζεται να γίνει soft delete (`deleted_at/deleted_by`). Η κατάργηση συνεργασίας αλλάζει status σε `ended` και κρατά ιστορικό.

## Τι πρέπει να κάνεις ΕΣΥ τώρα
**Τίποτα στο production Supabase ακόμη.**

1. Κράτησε το Phase 32/τρέχον Supabase project ως έχει.
2. Μην τρέξεις το migration από SQL Editor.
3. Μην διαγράψεις τους παλιούς πίνακες `companies`, `suppliers`, `company_certificates`, `supplier_certificates`.
4. Μην αλλάξεις Auth settings ακόμη.

Στην επόμενη κίνηση θα κάνουμε preflight του πραγματικού Supabase project (schema/backups/config) και μετά θα αποφασίσουμε αν θα εφαρμοστεί σε staging ή απευθείας με ασφαλές migration plan.

## Αρχεία αυτής της φάσης
- `supabase/migrations/20260810133000_phase33_backend_foundation.sql`
- `supabase/tests/phase33_schema_checks.sql`
- `docs/PHASE33_MANAGEMENT_GUIDE.md`
- `docs/PHASE33_BACKEND_MODEL.md`

## Πώς θα εφαρμοστεί όταν δώσουμε έγκριση
Η προτεινόμενη διαδικασία είναι μέσω Supabase CLI migrations, όχι copy/paste στο SQL Editor:

```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase migration list
supabase db push --dry-run
supabase db push
```

Το `db push --dry-run` θα προηγείται πάντα της πραγματικής εφαρμογής.

## Τι θα ελέγξουμε μετά το migration
1. `organization_model_version()` επιστρέφει `33`.
2. Υπάρχουν όλοι οι canonical πίνακες.
3. RLS είναι ενεργό σε όλους τους εκτεθειμένους πίνακες.
4. Το bucket είναι private, δέχεται μόνο PDF και έχει όριο 25 MB.
5. Ο Organization A δεν διαβάζει private certificate του B.
6. Με active relationship βλέπει μόνο certificate με visibility=`partners`.
7. Member μπορεί να δημιουργεί/αλλάζει certificate αλλά όχι να αλλάζει ownership.
8. Viewer δεν μπορεί να γράφει.
9. Relationship ενεργοποιείται μόνο από τον προσκεκλημένο owner/admin μέσω RPC.
10. End relationship δεν διαγράφει κανέναν οργανισμό.

## Rollback / ασφάλεια
Το Phase 33 δεν προβλέπει διαγραφή legacy πινάκων. Πριν production deployment θα πάρουμε backup και θα καταγράψουμε migration history. Legacy cleanup θα γίνει σε πολύ μεταγενέστερη φάση, μόνο αφού ολοκληρωθούν data migration και end-to-end tests.

## Πότε θεωρείται ολοκληρωμένη η Phase 33
Η φάση θεωρείται ολοκληρωμένη όταν:
- το schema είναι versioned μέσα στο project,
- το migration έχει περάσει preflight,
- έχουμε επαληθεύσει constraints/indexes/RLS design,
- και έχουμε καθαρό management plan πριν αγγίξουμε production.

## Επόμενη φάση
**Phase 34 — Auth & Account Security**:
- Confirm Email υποχρεωτικό,
- password policy,
- forgot/reset password flow,
- redirect URLs,
- email templates GR/EN,
- account/session security settings,
- tests signup → verify → login → recovery.

## Preflight της πραγματικής βάσης
Υπάρχει read-only αρχείο `supabase/preflight/phase33_preflight.sql`. Όταν φτάσουμε στο deployment, αυτό είναι το πρώτο SQL που μπορεί να εκτελεστεί με ασφάλεια για αποτύπωση της υπάρχουσας βάσης. Δεν αλλάζει δεδομένα ή schema.
