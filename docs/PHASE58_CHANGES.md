# Phase 58 — Notifications & Email UX

- Notification center now shows unread notifications only.
- Opening a notification marks it read, removes it immediately from the New notifications list, and refreshes the badge.
- Notification history remains in the database for audit/history.
- Accepting a collaboration now automatically reloads the canonical relationship/partner row; no manual browser refresh is required.
- Transactional emails now use a branded responsive HTML shell plus a plain-text fallback.
- Collaboration email copy includes the organization name and a direct action button.
- SMTP mail adds explicit plain-text content and safer line-break encoding to improve UTF-8/MIME rendering.
