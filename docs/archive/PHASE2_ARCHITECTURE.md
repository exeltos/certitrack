# CertiTrack — Phase 2: Common Architecture & Cleanup

## Scope
This phase reduces duplicated client-side logic without redesigning the application or changing the database model.

## Added shared modules
- `js/core/certificateCore.js`
  - certificate expiry calculations
  - active / expiring soon / expired status
  - KPI counts and status filtering
  - HTML escaping for user-controlled certificate fields
  - storage object path extraction
  - reusable AFM presence validation
- `js/core/selectionMode.js`
  - shared selection-checkbox helpers
  - select-all state handling
  - reusable card checkbox creation
- `js/core/netlifyClient.js`
  - authenticated calls to Netlify functions using the active Supabase session
  - consistent HTTP error handling

## Important cleanup/fixes
- Removed repeated AFM validation in supplier certificates.
- Removed duplicated certificate notification deletion after editing.
- Removed the second full rendering loop from company certificates.
- Removed duplicate supplier certificate edit/view/delete handlers.
- Removed duplicate action binding after company certificate rendering.
- Prevented KPI click handlers from accumulating after repeated reloads.
- Fixed company certificate controls that were referenced outside their JavaScript scope.
- Preserved selection mode when a certificate list is re-rendered.
- Fixed certificate email selection to use the actual certificate `file_url`.
- Replaced duplicated date calculations across dashboards with the common certificate helper.
- Removed remaining nonessential frontend `console.log` debugging output.

## Deliberately deferred
- Supabase schema / RLS redesign.
- Private Storage buckets and signed URLs.
- Organization / multi-user data model.
- Certificate requirement/compliance engine.
- Full design-system/UI redesign.

These belong to the next data-model and product phases because changing them now could break compatibility with the live Supabase project.
