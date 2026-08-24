# CertiTrack Phase 28 — Organization Network

- Unified account model: Organization only in the active UI.
- Removed legacy Company/Supplier page trees and legacy registration pages from the shipped frontend.
- Partners now open a dedicated partner card with shared certificates.
- Shared certificates support View + Download; ownership remains with the partner organization.
- Own certificates support View + Download + Edit + Delete.
- Partner rows support View + Remove relationship; incoming requests support Accept/Reject.
- Added partner-safe storage read policy and relationship delete policy to the Supabase migration.
- Platform Admin now presents Organizations, relationships and certificates without Company/Supplier account types.
- Desktop login/register pages use the viewport without page scrolling.
- Removed stale Tailwind CSP reference and dead legacy frontend modules.
