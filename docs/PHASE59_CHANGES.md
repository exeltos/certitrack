# Phase 59 — Notifications & Registration Invite Flow

- Notification read state now uses dedicated RPCs, avoiding direct client UPDATE/RLS ambiguity.
- Closing the notification center marks the notifications shown in that session as reviewed/read.
- Added explicit “Όλες ως διαβασμένες”.
- New notification badge updates immediately.
- If partner lookup finds no registered organization, the UI offers a registration invitation flow and asks for an email.
- Unregistered recipients receive a registration email linking to the CertiTrack registration page.
- Registered recipients continue to receive a normal collaboration request.
- Accepting a relationship refreshes the canonical relation/partner data in-place with retry; no manual browser refresh should be needed.
