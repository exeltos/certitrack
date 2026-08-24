# CertiTrack Phase 4.2 — UI & Navigation Architecture

This phase activates the common application navigation layer without changing the database schema or RLS.

## Shared UI components

- `src/components/appShell.js` — application chrome and role-aware shell.
- `src/components/sidebar.js` — Company / Supplier / Admin navigation.
- `src/components/pageHeader.js` — consistent page title, context and action area.
- `src/shared/theme.js` — one theme implementation for the entire application.

## Shared styles

- `assets/styles/components/shell.css`
- `assets/styles/components/sidebar.css`
- `assets/styles/components/page-header.css`
- `assets/styles/components/buttons.css`
- `assets/styles/components/cards.css`
- `assets/styles/components/forms.css`
- `assets/styles/components/tables.css`

## Navigation model

### Company
- Επισκόπηση
- Προμηθευτές
- Πιστοποιητικά
- Ρυθμίσεις

### Supplier
- Πιστοποιητικά
- Οι εταιρείες μου
- Ρυθμίσεις

### Admin
- Επισκόπηση
- Εταιρείες & Προμηθευτές
- System / Audit

The current business flows and existing element IDs remain in place so the UI architecture can be introduced without rewriting certificate or supplier logic.

## Responsive behavior

Desktop uses a persistent left sidebar. At tablet/mobile widths the navigation becomes a horizontal scrollable navigation strip, preserving all destinations without consuming the full viewport width.

## Next phase

Phase 4.3 can progressively redesign individual content areas (dashboard cards, certificate lists, filters and forms) on top of these shared primitives without duplicating shell/navigation code.
