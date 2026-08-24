# Service Level Agreement & Status Page (DRAFT)

## Before publishing an SLA

An SLA is a promise with financial/contractual weight — don't publish
specific numbers until you've:

1. Set up uptime monitoring (`docs/operations/MONITORING_SETUP.md`) and
   watched it for at least a few weeks to know your actual baseline.
2. Confirmed your backup/recovery capability (`docs/operations/BACKUP_DR_POLICY.md`)
   can actually support whatever recovery time you promise.
3. Decided whether you're offering this to all customers or only specific
   (paid/enterprise) tiers.

## Suggested starting SLA (fill in real numbers once measured)

| Metric | Target |
|---|---|
| Uptime | [e.g. 99.5% monthly, typical for a small SaaS on Netlify+Supabase] |
| Planned maintenance windows | [e.g. announced 48h in advance, outside business hours] |
| Support response time | [e.g. 1 business day for standard, 4 hours for critical] |
| Incident communication | Status page updated within [X] minutes of a detected incident |

## Status page setup

A public status page separates "is CertiTrack down" from "did they tell me."
Options, roughly cheapest to most capable:

- **Instatus** or **Statuspage.io** (Atlassian) — hosted, quick to set up,
  can auto-post from monitoring webhooks.
- **Self-hosted** (e.g. Cachet, or a static page in this repo updated
  manually) — cheaper but relies on someone remembering to update it during
  an incident, which is exactly when people forget.

Recommended for CertiTrack's current size: a hosted option (Instatus has a
usable free tier) wired to the uptime checks from
`docs/operations/MONITORING_SETUP.md`, so a check failure auto-updates the
public page without you having to do it by hand mid-incident.

## What to publish

- Current status (operational / degraded / outage) for: main app, API
  (Supabase), email notifications.
- Incident history (even minor ones — it builds trust, and hiding a past
  incident that a customer already noticed hurts more than disclosing it).
- Do **not** publish an SLA number you haven't yet verified you can meet.
