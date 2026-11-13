const { chromium, devices } = require('playwright');
// End-to-end smoke test of the demo (no backend needed).
// Usage: npm run dev  (in another terminal), then:  node tests/e2e/demo-flows.cjs [screenshot-dir]
// Requires Playwright with Chromium. Applies the CSP from netlify.toml to every page.
const fs = require('fs');
const path = require('path');
const out = process.argv[2] || require('os').tmpdir();
const B = process.env.BASE_URL || 'http://127.0.0.1:8888';
const CSP = /Content-Security-Policy = "([^"]+)"/.exec(fs.readFileSync(path.join(__dirname, '../../netlify.toml'), 'utf8'))[1];
const errors = [];
const step = async (name, fn) => { try { await fn(); console.log('ok -', name); } catch (e) { console.log('FAIL -', name, e.message.split('\n')[0]); errors.push(name); } };
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.route(B + '/**', async route => {
    const res = await route.fetch();
    const headers = { ...res.headers() };
    if ((headers['content-type'] || '').includes('text/html')) headers['content-security-policy'] = CSP;
    await route.fulfill({ response: res, headers });
  });
  await ctx.addInitScript(() => localStorage.setItem('certitrack.demo', 'organization'));
  const p = await ctx.newPage();
  p.on('pageerror', e => { console.log('PAGEERROR', e.message); errors.push('pageerror'); });
  p.on('console', m => { if (m.type() === 'error' || /Content Security Policy/.test(m.text())) { console.log('CONSOLE', m.text().slice(0, 200)); if (/Content Security Policy/.test(m.text())) errors.push('csp'); } });

  await step('create certificate with PDF', async () => {
    await p.goto(B + '/pages/organization/certificates.html', { waitUntil: 'networkidle' });
    await p.click('[data-new]');
    await p.fill('#f-title', 'ISO 22000:2018');
    await p.selectOption('#f-type', 't-iso22000');
    await p.fill('#f-expiry', '2028-03-01');
    await p.setInputFiles('input[name=file]', path.join(__dirname, '../../assets/demo-certificates/sample-certificate.pdf'));
    await p.check('input[name=sharing][value=selected]', { force: true });
    await p.check('input[name=share][value=o-med]');
    await p.screenshot({ path: `${out}/dlg-new-cert.png` });
    await p.click('dialog [type=submit]');
    await p.waitForSelector('text=ISO 22000:2018');
  });
  await step('validation: missing PDF is rejected', async () => {
    await p.click('[data-new]');
    await p.fill('#f-title', 'X');
    await p.click('dialog [type=submit]');
    await p.waitForTimeout(200);
    const open = await p.$('dialog[open]');
    if (!open) throw new Error('dialog closed without file');
    await p.click('dialog [data-close]');
  });
  await step('share dialog: make private', async () => {
    const row = p.locator('li.row', { hasText: 'ISO 9001:2015' });
    await row.locator('[data-act=share]').click();
    await p.check('input[name=sharing][value=private]', { force: true });
    await p.click('dialog [type=submit]');
    await row.locator('text=Ιδιωτικό').waitFor();
  });
  await step('view PDF opens viewer', async () => {
    await p.locator('li.row', { hasText: 'Άδεια λειτουργίας' }).locator('[data-act=view]').click();
    await p.waitForSelector('dialog[open] iframe');
    await p.click('dialog [data-close]');
  });
  await step('notifications popover', async () => {
    await p.click('#bellBtn');
    await p.waitForSelector('#notePanel .note');
    await p.screenshot({ path: `${out}/notes.png` });
    await p.click('#bellBtn');
  });
  await step('new connection by VAT shows preview and sends', async () => {
    await p.goto(B + '/pages/organization/partners.html', { waitUntil: 'networkidle' });
    await p.click('[data-new]');
    await p.fill('#lookup', '099999997');
    await p.waitForSelector('dialog .callout--info');
    await p.screenshot({ path: `${out}/dlg-connect.png` });
    await p.click('dialog [type=submit]');
    await p.waitForSelector('text=SterilePro');
  });
  await step('accept incoming connection', async () => {
    await p.click('[data-accept]');
    await p.locator('[data-active]', { hasText: 'SafeWaste' }).waitFor();
  });
  await step('partner page: hide all-connections cert from one partner', async () => {
    await p.goto(B + '/pages/organization/partner.html?id=c-med&tab=mine', { waitUntil: 'networkidle' });
    const row = p.locator('li.row', { hasText: 'Άδεια λειτουργίας' });
    await row.locator('.switch').click();
    await p.click('dialog [type=submit]');
    await p.waitForTimeout(400);
    if (await row.locator('input[data-toggle]').isChecked()) throw new Error('still visible');
    await p.screenshot({ path: `${out}/partner-mine.png` });
  });
  await step('respond to request with existing cert', async () => {
    await p.goto(B + '/pages/organization/requests.html?tab=incoming', { waitUntil: 'networkidle' });
    await p.locator('li.row', { hasText: 'Ασφάλιση' }).locator('[data-respond]').click();
    await p.screenshot({ path: `${out}/dlg-respond.png` });
    await p.click('dialog [type=submit]');
    await p.locator('li.row', { hasText: 'CleanCare Services ζητά Ασφάλιση' }).locator('text=Κοινοποιήθηκε').waitFor();
  });
  await step('ask partner for a document', async () => {
    await p.click('[data-tab=outgoing]');
    await p.click('[data-ask]');
    await p.selectOption('#r-conn', 'c-med');
    await p.selectOption('#r-type', 't-iso14001');
    await p.click('dialog [type=submit]');
    await p.waitForTimeout(300);
    await p.screenshot({ path: `${out}/requests-out.png`, fullPage: true });
  });
  await step('language switch to English', async () => {
    await p.goto(B + '/pages/organization/dashboard.html', { waitUntil: 'networkidle' });
    await p.click('[data-action=language]');
    await p.waitForSelector('text=Overview');
    await p.screenshot({ path: `${out}/dash-en.png` });
    await p.click('[data-action=language]');
  });
  await step('dark theme', async () => {
    await p.click('[data-action=theme]');
    await p.goto(B + '/pages/organization/partners.html', { waitUntil: 'networkidle' });
    await p.screenshot({ path: `${out}/conns-dark.png` });
    await p.click('[data-action=theme]');
  });
  await step('exit demo goes home', async () => {
    await p.click('[data-action=exit-demo]');
    await p.waitForURL(/index\.html/);
  });

  const m = await b.newContext({ ...devices['iPhone 13'] });
  await m.addInitScript(() => localStorage.setItem('certitrack.demo', 'organization'));
  const mp = await m.newPage();
  mp.on('pageerror', e => { console.log('PAGEERROR(mobile)', e.message); errors.push('pageerror'); });
  for (const [n, u] of [['m-dash', '/pages/organization/dashboard.html'], ['m-certs', '/pages/organization/certificates.html'], ['m-partner', '/pages/organization/partner.html?id=c-clean'], ['m-home', '/index.html']]) {
    await mp.goto(B + u, { waitUntil: 'networkidle' });
    const overflow = await mp.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    if (overflow > 0) { console.log('FAIL - horizontal overflow on', n, overflow); errors.push(n); }
    await mp.screenshot({ path: `${out}/${n}.png` });
  }
  await b.close();
  console.log(errors.length ? `FAILED: ${errors.join(', ')}` : 'ALL FLOWS PASSED');
  process.exitCode = errors.length ? 1 : 0;
})();
