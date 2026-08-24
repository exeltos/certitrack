# CertiTrack — Privacy Policy (DRAFT — requires legal review before publishing)

_Last updated: [fill in date]_

This is a starting draft, not a finished legal document. Replace bracketed
placeholders and have it reviewed against GDPR and any applicable Greek data
protection law before publishing it publicly or linking to it from the app.

## 1. Who we are

CertiTrack is operated by **[Legal entity name]**, registered at **[address]**,
VAT/AFM **[number]**. Contact for privacy matters: **[privacy@certitrack.gr]**.

## 2. What data we collect

- **Account data**: name, email, organization name, VAT/AFM, contact details.
- **Certificate data**: certificate metadata and the certificate files you upload.
- **Usage data**: login timestamps, audit trail of actions taken in the app.
- **Technical data**: IP address (used only for rate-limiting/abuse prevention
  and error monitoring — see `docs/operations/MONITORING_SETUP.md`).

We do not collect data we don't need for the product to function. We do not
sell data to third parties.

## 3. Why we process this data (legal basis)

- **Contract**: to provide the certificate-tracking service you signed up for.
- **Legitimate interest**: security monitoring, abuse prevention, service
  improvement.
- **Legal obligation**: where certificate/compliance record-keeping is
  required by law for your industry.

## 4. Who we share data with

See the sub-processor list in `docs/legal/DATA_RETENTION_POLICY.md`
(Supabase, your configured SMTP/email provider, Netlify, and any future error-monitoring provider).
We do not share your data with anyone else without telling you.

## 5. How long we keep data

See `docs/legal/DATA_RETENTION_POLICY.md` for the detailed retention schedule.

## 6. Your rights

Under GDPR you have the right to access, correct, export, and delete your
data, and to object to certain processing. To exercise these rights, contact
**[privacy@certitrack.gr]**. [Once built: link to the in-app data export/
delete features described in DATA_RETENTION_POLICY.md.]

## 7. Security

Certificates are stored in a private storage bucket, accessed only via
short-lived signed URLs. Database access is governed by row-level security
so that organizations can only see their own data and explicitly-connected
partners' data. See `docs/CURRENT_RLS_REVIEW_BEFORE_LIVE_AUDIT.md` for the
current technical review.

## 8. Changes to this policy

[Describe how you'll notify users of material changes — e.g. email + in-app
banner for 30 days.]

## 9. Contact / complaints

You can also lodge a complaint with the Greek Data Protection Authority
(Αρχή Προστασίας Δεδομένων Προσωπικού Χαρακτήρα) — **[link]** — or your local
supervisory authority.

---
**Reminder: this draft must be reviewed by a lawyer before it is published or
relied upon. Anthropic/Claude is not providing legal advice.**
