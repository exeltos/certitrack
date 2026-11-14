// Writes the HTML shell of every page. All pages are identical except for the
// script they load; content is rendered by that script.
// Usage: node scripts/build-pages.mts
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

// HTML file -> entry script (under src/). Every signed-in page loads the same
// app entry: the router inside it shows the right page and moves between pages
// without reloading.
const APP = 'app/main.ts';
export const PAGES: Record<string, string> = {
  'index.html': 'pages/public/home.ts',
  'pages/demo/index.html': 'pages/public/demo.ts',
  'pages/auth/login.html': 'pages/auth/login.ts',
  'pages/auth/register.html': 'pages/auth/register.ts',
  'pages/auth/forgot.html': 'pages/auth/forgot.ts',
  'pages/auth/reset-password.html': 'pages/auth/resetPassword.ts',
  'pages/organization/dashboard.html': APP,
  'pages/organization/certificates.html': APP,
  'pages/organization/partners.html': APP,
  'pages/organization/partner.html': APP,
  'pages/organization/requests.html': APP,
  'pages/organization/profile.html': APP,
  'pages/admin/dashboard.html': APP,
  'pages/admin/organizations.html': APP,
  'pages/admin/network.html': APP,
  'pages/admin/audit.html': APP,
  'pages/admin/settings.html': APP,
  'pages/admin/presentations.html': APP
};

const shell = (script: string): string => `<!doctype html>
<html lang="el">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>CertiTrack</title>
<meta name="description" content="CertiTrack — πιστοποιητικά και συμμόρφωση μεταξύ συνεργαζόμενων οργανισμών.">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="/src/styles/app.css">
<script>try{var s=localStorage.getItem('theme');document.documentElement.dataset.theme=(s?s==='dark':matchMedia('(prefers-color-scheme: dark)').matches)?'dark':'light'}catch(e){}</script>
<script type="module" blocking="render" src="/src/${script}"></script>
</head>
<body${script === APP ? ' class="app-pending"' : ''}></body>
</html>
`;

if (import.meta.url === `file://${process.argv[1]}`) build();

function build(): void {
for (const [file, script] of Object.entries(PAGES)) {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, shell(script));
}
// Old URL kept working for bookmarks and old emails.
writeFileSync('pages/organization/compliance.html', `<!doctype html><meta charset="utf-8"><meta http-equiv="refresh" content="0; url=/pages/organization/requests.html"><title>CertiTrack</title><a href="/pages/organization/requests.html">CertiTrack</a>\n`);
console.log(`wrote ${Object.keys(PAGES).length + 1} pages`);
}
