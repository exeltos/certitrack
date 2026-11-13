// Live end-to-end test against a real Supabase project, with throwaway accounts.
//
// Needs: `npm run dev` running, Playwright with Chromium, and three confirmed
// throwaway users whose credentials come from the environment (never commit them):
//   E2E_A_EMAIL / E2E_A_PASSWORD   organization "E2E Alpha"  (VAT 900000001)
//   E2E_B_EMAIL / E2E_B_PASSWORD   organization "E2E Beta"   (VAT 900000002)
//   E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD   a platform admin
// Turn their email notifications off and delete the users and organizations afterwards.
// Usage: node tests/e2e/live-flows.cjs [screenshot-dir]
const { chromium } = require('playwright');
const path = require('path');
const env = k => { if (!process.env[k]) throw new Error(`missing ${k}`); return process.env[k]; };
const pw = { a: env('E2E_A_PASSWORD'), b: env('E2E_B_PASSWORD'), adm: env('E2E_ADMIN_PASSWORD') };
const B = process.env.BASE_URL || 'http://127.0.0.1:8888';
const PDF = path.join(__dirname, '../../assets/demo-certificates/sample-certificate.pdf');
const OUT = process.argv[2] || require('os').tmpdir();
const errors = [];
const step = async (name, fn) => { try { await fn(); console.log('ok -', name); } catch (e) { console.log('FAIL -', name, '::', e.message.split('\n')[0]); errors.push(name); } };

(async () => {
  const browser = await chromium.launch(process.env.HTTPS_PROXY ? { proxy: { server: process.env.HTTPS_PROXY, bypass: '127.0.0.1,localhost' } } : {});
  async function session(label, email, password) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, ignoreHTTPSErrors: false });
    const p = await ctx.newPage();
    p.on('pageerror', e => { console.log(`[${label}] PAGEERROR`, e.message); errors.push(`${label}:pageerror`); });
    p.on('console', m => { if (m.type() === 'error' && !/favicon/.test(m.text())) console.log(`[${label}] CONSOLE`, m.text().slice(0, 220)); });
    await p.goto(B + '/pages/auth/login.html', { waitUntil: 'networkidle' });
    await p.fill('#email', email); await p.fill('#password', password);
    await p.click('[data-login] [type=submit]');
    await p.waitForURL(/\/pages\/(organization|admin)\//, { timeout: 20000 });
    return p;
  }
  let A, Bp, adm;
  await step('A: login lands on organization dashboard', async () => {
    A = await session('A', env('E2E_A_EMAIL'), pw.a);
    await A.waitForSelector('text=E2E Alpha'); await A.waitForSelector('.kpi');
  });
  await step('A: create private certificate with PDF (upload to storage)', async () => {
    await A.goto(B + '/pages/organization/certificates.html', { waitUntil: 'networkidle' });
    await A.click('[data-new]');
    await A.fill('#f-title', 'E2E ISO 9001:2015');
    await A.selectOption('#f-type', { label: 'ISO 9001' });
    await A.fill('#f-expiry', '2027-06-30');
    await A.setInputFiles('input[name=file]', PDF);
    await A.check('input[name=sharing][value=private]', { force: true });
    await A.click('dialog [type=submit]');
    await A.waitForSelector('li.row:has-text("E2E ISO 9001:2015")', { timeout: 20000 });
  });
  await step('A: open own PDF through signed URL', async () => {
    await A.locator('li.row', { hasText: 'E2E ISO 9001:2015' }).locator('[data-act=view]').click();
    const src = await (await A.waitForSelector('dialog[open] iframe')).getAttribute('src');
    if (!/supabase\.co\/storage\/v1\/object\/sign\//.test(src)) throw new Error('not a signed URL: ' + src);
    const r = await A.request.get(src); if (r.status() !== 200) throw new Error('PDF fetch ' + r.status());
    await A.click('dialog [data-close]');
  });
  await step('A: request connection to B by VAT', async () => {
    await A.goto(B + '/pages/organization/partners.html', { waitUntil: 'networkidle' });
    await A.click('[data-new]'); await A.fill('#lookup', '900000002');
    await A.waitForSelector('dialog .callout--info:has-text("E2E Beta")');
    await A.click('dialog [type=submit]');
    await A.waitForSelector('text=Αναμονή αποδοχής');
  });
  await step('B: sees request with A name and accepts', async () => {
    Bp = await session('B', env('E2E_B_EMAIL'), pw.b);
    await Bp.goto(B + '/pages/organization/partners.html', { waitUntil: 'networkidle' });
    await Bp.waitForSelector('li.row:has-text("E2E Alpha") [data-accept]');
    await Bp.click('[data-accept]');
    await Bp.waitForSelector('[data-active] :text("E2E Alpha")');
  });
  let connUrl;
  await step('B: private certificate of A is NOT visible', async () => {
    await Bp.click('[data-active] a.row');
    await Bp.waitForURL(/partner\.html/); connUrl = Bp.url();
    await Bp.waitForSelector('.empty');
    if (await Bp.$('text=E2E ISO 9001:2015')) throw new Error('private certificate leaked');
  });
  await step('B: asks A for ISO 9001', async () => {
    await Bp.click('#pageActions [data-ask]');
    await Bp.selectOption('#r-type', { label: 'ISO 9001' });
    await Bp.fill('#r-note', 'E2E test');
    await Bp.click('dialog [type=submit]');
    await Bp.waitForSelector('[data-tab=requests][aria-selected=true]');
  });
  await step('A: notification + responds by sharing the certificate', async () => {
    await A.goto(B + '/pages/organization/requests.html?tab=incoming', { waitUntil: 'networkidle' });
    await A.waitForSelector('#bellCount:not([hidden])');
    await A.locator('li.row', { hasText: 'E2E Beta' }).locator('[data-respond]').click();
    await A.click('dialog [type=submit]');
    await A.waitForSelector('li.row:has-text("E2E Beta") >> text=Κοινοποιήθηκε');
  });
  await step('B: now sees the certificate, opens PDF (view logged, storage allows)', async () => {
    await Bp.goto(connUrl.replace(/&tab=\w+/, '') + '&tab=theirs', { waitUntil: 'networkidle' });
    await Bp.waitForSelector('li.row:has-text("E2E ISO 9001:2015")');
    await Bp.locator('li.row', { hasText: 'E2E ISO 9001:2015' }).locator('[data-open]').click();
    const src = await (await Bp.waitForSelector('dialog[open] iframe')).getAttribute('src');
    const r = await Bp.request.get(src); if (r.status() !== 200) throw new Error('partner PDF fetch ' + r.status());
    await Bp.click('dialog [data-close]');
  });
  await step('B: request shows as valid', async () => {
    await Bp.goto(B + '/pages/organization/requests.html?tab=outgoing', { waitUntil: 'networkidle' });
    await Bp.waitForSelector('li.row:has-text("ISO 9001") >> text=Σε ισχύ');
  });
  await step('A: sees that E2E Beta viewed the certificate', async () => {
    await A.goto(B + '/pages/organization/dashboard.html', { waitUntil: 'networkidle' });
    await A.waitForSelector('li.row:has-text("E2E Beta"):has-text("E2E ISO 9001:2015")');
    await A.screenshot({ path: `${OUT}/live-dash-a.png` });
  });
  await step('A: hide from B via partner toggle -> B loses access', async () => {
    await A.goto(B + '/pages/organization/partners.html', { waitUntil: 'networkidle' });
    await A.click('[data-active] a.row'); await A.waitForURL(/partner\.html/);
    await A.click('[data-tab=mine]');
    await A.locator('li.row', { hasText: 'E2E ISO 9001:2015' }).locator('.switch').click();
    await A.waitForTimeout(1500);
    await Bp.goto(connUrl.replace(/&tab=\w+/, '') + '&tab=theirs', { waitUntil: 'networkidle' });
    await Bp.waitForSelector('.empty');
    if (await Bp.$('li.row:has-text("E2E ISO 9001:2015")')) throw new Error('still visible after hiding');
  });
  await step('settings: save profile + notification preference', async () => {
    await A.goto(B + '/pages/organization/profile.html', { waitUntil: 'networkidle' });
    await A.fill('#o-city', 'Αθήνα'); await A.click('[data-org-form] [type=submit]');
    await A.waitForSelector('.toast--success');
  });
  await step('admin: login lands on admin, sees orgs and network', async () => {
    adm = await session('ADMIN', env('E2E_ADMIN_EMAIL'), pw.adm);
    if (!/\/pages\/admin\//.test(adm.url())) throw new Error('admin went to ' + adm.url());
    await adm.goto(B + '/pages/admin/network.html', { waitUntil: 'networkidle' });
    await adm.waitForSelector('tr:has-text("E2E Alpha"):has-text("E2E Beta")');
    await adm.goto(B + '/pages/admin/organizations.html', { waitUntil: 'networkidle' });
    await adm.waitForSelector('tr:has-text("E2E Alpha")');
    await adm.goto(B + '/pages/admin/audit.html', { waitUntil: 'networkidle' });
    await adm.waitForSelector('table tbody tr');
    await adm.screenshot({ path: `${OUT}/live-admin-audit.png` });
  });
  await step('org user cannot open admin pages', async () => {
    await A.goto(B + '/pages/admin/dashboard.html');
    await A.waitForURL(/organization\/dashboard/, { timeout: 15000 });
  });
  await step('B: end connection', async () => {
    await Bp.goto(connUrl, { waitUntil: 'networkidle' });
    await Bp.click('#pageActions [data-end]');
    await Bp.click('dialog [type=submit]');
    await Bp.waitForURL(/partners\.html/);
  });
  await step('logout returns home', async () => {
    await A.click('#accountBtn'); await A.click('[data-action=logout]');
    await A.waitForURL(/index\.html/);
  });
  await browser.close();
  console.log(errors.length ? `FAILED: ${errors.join(', ')}` : 'ALL LIVE FLOWS PASSED');
  process.exitCode = errors.length ? 1 : 0;
})();
