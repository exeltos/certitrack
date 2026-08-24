# CertiTrack Frontend Architecture — Phase 4

## Goal

Phase 4 reorganizes the existing static HTML/JavaScript application without changing the business model or Supabase schema.

## Structure

```text
certitrack-main/
├─ index.html
├─ pages/
│  ├─ auth/
│  │  ├─ login.html
│  │  ├─ company-register.html
│  │  ├─ supplier-register.html
│  │  ├─ forgot.html
│  │  └─ reset-password.html
│  ├─ company/
│  │  ├─ dashboard.html
│  │  ├─ certificates.html
│  │  ├─ profile.html
│  │  └─ supplier.html
│  ├─ supplier/
│  │  ├─ certificates.html
│  │  └─ profile.html
│  └─ admin/
│     └─ dashboard.html
├─ src/
│  ├─ components/
│  │  └─ appShell.js
│  ├─ config/
│  ├─ core/
│  ├─ features/
│  ├─ pages/
│  ├─ services/
│  └─ shared/
├─ assets/
│  ├─ images/
│  ├─ styles/
│  │  ├─ app.css
│  │  └─ pages/
│  └─ templates/
├─ netlify/
│  └─ functions/
├─ supabase/
│  └─ migrations/
└─ docs/
```

## Shared shell

`src/components/appShell.js` now normalizes the common application shell:
- common header structural class;
- one canonical logo path;
- common footer generated centrally;
- current year generated centrally;
- Lucide icon refresh.

Page-specific actions remain in each header for now, because existing JavaScript depends on their IDs. This avoids a breaking rewrite while giving the project a common shell layer.

## CSS

Inline `<style>` blocks were extracted from HTML and moved to `assets/styles/pages/`.
Global shell rules live in `assets/styles/app.css`.

The next design-system pass can progressively move repeated page CSS into common component CSS without touching business logic.

## Compatibility

Old production URLs are redirected by Netlify to the new page locations, so existing links/bookmarks remain valid.


## Phase 4.1 — Architecture Completion

Phase 4.1 completes the structural separation:

- HTML pages contain markup only; no inline CSS and no inline JavaScript.
- Header/footer are mounted through `src/components/appShell.js`.
- Theme behavior is centralized in `src/shared/theme.js`.
- Supabase access from page/feature modules is routed through services:
  - `authService`
  - `companyService`
  - `supplierService`
  - `relationshipService`
  - `certificateService`
  - `notificationService`
  - `storageService`
  - `adminService`
  - `databaseService` for the few dynamic-table admin operations.
- Page/feature code no longer imports `supabaseClient.js` directly.
- Component CSS is separated under `assets/styles/components/`.
- `sidebar.js` now contains the shared authenticated navigation definition; mounting/redesign is intentionally deferred to Phase 4.2 so this architecture pass does not change the established UI behavior.

### Resulting dependency direction

```text
HTML
  ↓
page controller / feature
  ↓
domain service
  ↓
Supabase client
```

Shared UI:

```text
appShell
 ├─ header
 ├─ footer
 ├─ theme
 └─ navigation definition
```
