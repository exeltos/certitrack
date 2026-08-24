# Phase 8 — Single Navigation & Full Demo Data

## Changes
- Removed the legacy company certificate tabs/menu entirely from HTML and JS.
- Removed hidden legacy navigation placeholders from the suppliers page.
- The shared sidebar is now the only authenticated primary navigation.
- Added a consistent demo dataset used across company and supplier screens.
- Company demo now contains 12 suppliers with compliance, expiry, missing-document and registration states.
- Company certificate demo contains active and expiring certificates.
- Supplier demo contains 8 certificates and 5 linked companies, including blocked access state.
- Company Suppliers demo now renders the Suppliers screen itself instead of reusing the dashboard demo.
- Supplier Companies demo now uses the shared demo dataset and protects write actions.
- Company overview KPIs and attention list now use the same shared demo dataset.

## Validation
- No legacy `navTabs`, `.tab-btn`, `btnSuppliers` or `btnCertificates` references remain in company pages/scripts.
- All JavaScript files pass `node --check`.
