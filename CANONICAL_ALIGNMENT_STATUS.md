# CertiTrack — Final Canonical Alignment

This package is the aligned repository baseline.

## Canonical rules

- Frontend and production Supabase schema use the same relationship contract.
- Pending collaboration cancellation uses `ct_cancel_relationship` and deletes the pending relationship.
- Active collaboration termination uses the end-flow and may retain `ended` history.
- Partner lookup is included in the canonical production schema.
- Demo uses the shared canonical stylesheet; broken page-specific Demo CSS reference removed.
- Asset cache marker aligned to `v=54`.
- Current operational documentation uses the SMTP-based email architecture.
- Historical phase files may remain for audit/history but are not operational instructions.

## Deployment note

For an existing live Supabase project, apply only migrations not already applied.
Do not run a full reset unless intentionally rebuilding a fresh environment.

- Phase 55 adds `ct_cancel_relationship(uuid)` so pending collaboration cancellation deletes both the pending relationship and its pending invitation/outbox item.
