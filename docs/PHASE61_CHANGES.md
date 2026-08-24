# Phase 61 — Partner Table & Email MIME Fix

## Partner card
- Replaced the generic wide certificate table with a dedicated partner certificate list.
- No horizontal scroll on desktop/tablet.
- First column no longer clips on the left.
- Columns use the available width instead of fixed oversized minimums.
- List height follows content and only becomes vertically scrollable when needed.
- Mobile view becomes a compact stacked row.

## Email
- Replaced DenoMailer with Nodemailer for SMTP message construction.
- Removed manual MIME headers and duplicate MIME-Version behavior.
- Nodemailer now owns UTF-8 subject/body encoding and multipart generation.
- Existing SMTP secrets remain unchanged.
