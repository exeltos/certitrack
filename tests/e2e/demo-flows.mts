import { chromium, devices } from 'playwright';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
// End-to-end smoke test of the demo (no backend needed).
// Usage: VITE_ENABLE_DEMO=true npm run build && npm run preview  (in another terminal), then:  node tests/e2e/demo-flows.mts [screenshot-dir]
// Requires Playwright with Chromium. Applies the CSP from netlify.toml to every page.
const here = path.dirname(fileURLToPath(import.meta.url));
const out = process.argv[2] || os.tmpdir();
const B = process.env.BASE_URL || 'http://127.0.0.1:8888';
const CSP = /Content-Security-Policy = "([^"]+)"/.exec(fs.readFileSync(path.join(here, '../../netlify.toml'), 'utf8'))?.[1] ?? '';
const errors: string[] = [];
const step = async (name: string, fn: () => Promise<unknown>): Promise<void> => {
  try { await fn(); console.log('ok -', name); } catch (e) { console.log('FAIL -', name, String(e instanceof Error ? e.message : e).split('\n')[0]); errors.push(name); }
};
(async () => {
  const b = await chromium.launch(process.env.HTTPS_PROXY ? { proxy: { server: process.env.HTTPS_PROXY, bypass: '127.0.0.1,localhost' } } : {});
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.route(B + '/**', async route => {
    const res = await route.fetch();
    const headers: Record<string, string> = { ...res.headers() };
    if ((headers['content-type'] || '').includes('text/html')) headers['content-security-policy'] = CSP;
    await route.fulfill({ response: res, headers });
  });
  await ctx.addInitScript(() => { if (!localStorage.getItem('certitrack.demo')) localStorage.setItem('certitrack.demo', 'organization'); });
  const p = await ctx.newPage();
  p.on('pageerror', e => { console.log('PAGEERROR', e.message); errors.push('pageerror'); });
  p.on('console', m => { if (m.type() === 'error' || /Content Security Policy/.test(m.text())) { console.log('CONSOLE', m.text().slice(0, 200)); if (/Content Security Policy/.test(m.text())) errors.push('csp'); } });

  await step('create certificate with PDF', async () => {
    await p.goto(B + '/pages/organization/certificates.html', { waitUntil: 'networkidle' });
    await p.click('[data-new]');
    await p.fill('#f-title', 'ISO 22000:2018');
    await p.selectOption('#f-type', 't-iso22000');
    await p.fill('#f-expiry', '2028-03-01');
    await p.setInputFiles('input[name=file]', path.join(here, '../../public/demo/sample-certificate.pdf'));
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
    const row = p.locator('.table--certs tr', { hasText: 'ISO 9001:2015' });
    await row.locator('[data-menu]').click();
    await p.click('.action-menu [data-pick=share]');
    await p.check('input[name=sharing][value=private]', { force: true });
    await p.click('dialog [type=submit]');
    await row.locator('text=Ιδιωτικό').waitFor();
  });
  await step('certificates: sort by title and back by expiry', async () => {
    await p.click('[data-sort=title]');
    const titles = await p.locator('.cert-cell strong').allTextContents();
    if (titles.join() !== [...titles].sort((a, b) => a.localeCompare(b)).join()) throw new Error('not sorted by title: ' + titles.join(', '));
    await p.click('[data-sort=expiry]');
  });
  await step('view PDF opens viewer', async () => {
    await p.locator('.table--certs tr', { hasText: 'Άδεια λειτουργίας' }).locator('[data-act=view]').click();
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
    await p.click('[data-tab="incoming"]');
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
  await step('team: invite a colleague, change a level, remove a member', async () => {
    await p.goto(B + '/pages/organization/profile.html#team', { waitUntil: 'networkidle' });
    await p.waitForSelector('[data-panel=team] .rows');
    const invitations = () => p.locator('[data-panel=team] [data-invite-cancel]').count();
    const before = await invitations();
    await p.click('[data-team-invite]');
    await p.fill('#ti-email', 'new.colleague@demo-group.example');
    await p.click('dialog [type=submit]');
    await p.waitForFunction(n => document.querySelectorAll('[data-panel=team] [data-invite-cancel]').length === n, before + 1);
    await p.locator('[data-team-role]').first().selectOption('admin');
    await p.waitForFunction(() => (document.querySelector('[data-team-role]') as HTMLSelectElement | null)?.value === 'admin');
    const members = await p.locator('[data-team-remove]').count();
    await p.locator('[data-team-remove]').first().click();
    await p.click('dialog [type=submit]');
    await p.waitForFunction(n => document.querySelectorAll('[data-team-remove]').length === n, members - 1);
  });
  await step('invitation link opens the join form', async () => {
    await p.goto(B + '/pages/auth/register.html?join=1&email=colleague%40example.com', { waitUntil: 'networkidle' });
    if (await p.inputValue('#email') !== 'colleague@example.com') throw new Error('email not prefilled');
    if (await p.locator('#vat').count()) throw new Error('join form should not ask for a VAT number');
  });
  // While still in the demo, so nothing reaches the real backend.
  await step('request a presentation from the home page', async () => {
    await p.goto(B + '/index.html', { waitUntil: 'networkidle' });
    await p.click('[data-present]');
    await p.fill('#pr-name', 'E2E Tester'); await p.fill('#pr-company', 'E2E Company'); await p.fill('#pr-email', 'e2e@example.com');
    await p.click('dialog [type=submit]');
    await p.waitForSelector('dialog .empty');
    await p.keyboard.press('Escape');
  });
  await step('owner sees it under Presentations', async () => {
    await p.evaluate(() => localStorage.setItem('certitrack.demo', 'admin'));
    await p.goto(B + '/pages/admin/presentations.html', { waitUntil: 'networkidle' });
    await p.locator('.presentation', { hasText: 'E2E Company' }).waitFor();
    await p.locator('.presentation', { hasText: 'E2E Company' }).locator('[data-status=contacted]').click();
    await p.waitForFunction(() => ![...document.querySelectorAll('.presentation')].some(r => r.textContent.includes('E2E Company')));
  });
  await step('exit demo goes home', async () => {
    await p.click('[data-action=exit-demo]');
    await p.waitForURL(/index\.html/);
  });

  // Desktop screens fit the window: nothing scrolls the page itself.
  const fit = await b.newContext({ viewport: { width: 1366, height: 768 } });
  await fit.addInitScript(() => { if (!localStorage.getItem('certitrack.demo')) localStorage.setItem('certitrack.demo', 'organization'); });
  const fp = await fit.newPage();
  for (const [role, pages] of [['organization', ['dashboard', 'certificates', 'partners', 'requests', 'profile']], ['admin', ['dashboard', 'presentations', 'organizations', 'network', 'audit', 'settings']]] as [string, string[]][]) {
    await fp.evaluate(r => localStorage.setItem('certitrack.demo', r), role).catch(() => {});
    for (const pg of pages) {
      await step(`no page scroll at 1366x768: ${role}/${pg}`, async () => {
        await fp.goto(`${B}/pages/${role}/${pg}.html`, { waitUntil: 'networkidle' });
        await fp.evaluate(r => localStorage.setItem('certitrack.demo', r), role);
        await fp.goto(`${B}/pages/${role}/${pg}.html`, { waitUntil: 'networkidle' });
        await fp.waitForSelector('#content > *');
        const overflow = await fp.evaluate(() => document.documentElement.scrollHeight - innerHeight);
        if (overflow > 0) throw new Error(`page scrolls by ${overflow}px`);
      });
    }
  }
  await fit.close();

  const m = await b.newContext({ ...devices['iPhone 13'] });
  await m.addInitScript(() => localStorage.setItem('certitrack.demo', 'organization'));
  const mp = await m.newPage();
  mp.on('pageerror', e => { console.log('PAGEERROR(mobile)', e.message); errors.push('pageerror'); });
  for (const [n, u] of [['m-dash', '/pages/organization/dashboard.html'], ['m-certs', '/pages/organization/certificates.html'], ['m-partner', '/pages/organization/partner.html?id=c-clean'], ['m-home', '/index.html']] as [string, string][]) {
    await mp.goto(B + u, { waitUntil: 'networkidle' });
    const overflow = await mp.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    if (overflow > 0) { console.log('FAIL - horizontal overflow on', n, overflow); errors.push(n); }
    await mp.screenshot({ path: `${out}/${n}.png` });
  }
  await b.close();
  console.log(errors.length ? `FAILED: ${errors.join(', ')}` : 'ALL FLOWS PASSED');
  process.exitCode = errors.length ? 1 : 0;
})();
