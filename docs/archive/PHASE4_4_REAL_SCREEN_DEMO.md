# CertiTrack Phase 4.4 — Real Screen Demo Sessions

The home page now offers two no-registration demo entries:

- Demo ως Εταιρεία
- Demo ως Προμηθευτής

A demo role is stored locally in the browser (`certitrack.demo.role`). No Supabase account is created and no demo record is written to the database.

## Demo Company

Uses the real Company routes and shared navigation:
- Company dashboard / supplier list
- Company certificates
- Supplier detail
- Company profile

## Demo Supplier

Uses the real Supplier routes and shared navigation:
- Supplier certificates
- Companies that saved the supplier
- Supplier profile

## Safety

Write actions shown in demo screens are intercepted and display an informational message. They never execute a Supabase write.

A persistent DEMO MODE banner is shown on real application screens and includes:
- switch to Company demo;
- switch to Supplier demo;
- exit demo.

Normal login clears any previous demo role before redirecting to a real authenticated screen.
