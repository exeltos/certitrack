# CertiTrack Phase 4.3 — Demo Data, Design Polish & Mobile

## Demo mode

A standalone, read-only demo experience is available at:

`/pages/demo/index.html`

It uses only local fixture data from `src/demo/demoData.js` and does not read or write Supabase.

The demo can switch between:
- Company
- Supplier
- Admin

This makes it safe for UI review, sales demonstrations and layout testing without creating real users or records.

## Design improvements

- softer application background and stronger content hierarchy;
- cleaner KPI cards and list panels;
- common hover/focus/tap behavior;
- less duplicated navigation;
- shared sidebar remains the source of navigation;
- legacy company tab controls remain in the DOM only where existing JS still references their IDs, but are visually hidden.

## Mobile improvements

At <= 768px:
- left sidebar becomes a fixed bottom navigation bar;
- header/logo/actions become compact;
- KPI/status areas collapse to two-column grids;
- search/filter controls become full width;
- cards use natural height;
- SweetAlert dialogs and PDF viewers respect viewport width;
- safe-area padding is added for devices with bottom insets.

## Data safety

Demo data is not inserted into Supabase. No production/test business records are created by Phase 4.3.
