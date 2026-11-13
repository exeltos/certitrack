// Writes the HTML shell of every page. All pages are identical except for the
// script they load; content is rendered by that script.
// Usage: node scripts/build-pages.mjs
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';

export const PAGES = {
  'index.html': 'public/home.js',
  'pages/demo/index.html': 'public/demo.js',
  'pages/auth/login.html': 'auth/login.js',
  'pages/auth/register.html': 'auth/register.js',
  'pages/auth/forgot.html': 'auth/forgot.js',
  'pages/auth/reset-password.html': 'auth/resetPassword.js',
  'pages/organization/dashboard.html': 'organization/dashboard.js',
  'pages/organization/certificates.html': 'organization/certificates.js',
  'pages/organization/partners.html': 'organization/partners.js',
  'pages/organization/partner.html': 'organization/partner.js',
  'pages/organization/requests.html': 'organization/requests.js',
  'pages/organization/profile.html': 'organization/profile.js',
  'pages/admin/dashboard.html': 'admin/dashboard.js',
  'pages/admin/organizations.html': 'admin/organizations.js',
  'pages/admin/network.html': 'admin/network.js',
  'pages/admin/audit.html': 'admin/audit.js'
};

// Pages are listed as .js; use the .ts file instead once a page has been converted.
const entry = script => {
  const ts = script.replace(/\.js$/, '.ts');
  return existsSync(new URL(`../src/pages/${ts}`, import.meta.url)) ? ts : script;
};

const shell = script => `<!doctype html>
<html lang="el">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>CertiTrack</title>
<meta name="description" content="CertiTrack — πιστοποιητικά και συμμόρφωση μεταξύ συνεργαζόμενων οργανισμών.">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="/src/styles/app.css">
<script>try{var s=localStorage.getItem('theme');document.documentElement.dataset.theme=(s?s==='dark':matchMedia('(prefers-color-scheme: dark)').matches)?'dark':'light'}catch(e){}</script>
<script type="module" src="/src/pages/${entry(script)}"></script>
</head>
<body></body>
</html>
`;

if (import.meta.url === `file://${process.argv[1]}`) build();

function build() {
for (const [file, script] of Object.entries(PAGES)) {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, shell(script));
}
// Old URL kept working for bookmarks and old emails.
writeFileSync('pages/organization/compliance.html', `<!doctype html><meta charset="utf-8"><meta http-equiv="refresh" content="0; url=/pages/organization/requests.html"><title>CertiTrack</title><a href="/pages/organization/requests.html">CertiTrack</a>\n`);
console.log(`wrote ${Object.keys(PAGES).length + 1} pages`);
}
