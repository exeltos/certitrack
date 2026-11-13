// Application shell: access guard, top bar, navigation, notifications,
// theme and language. Every authenticated page starts with startPage().
import { api, isDemo, endDemo, DEMO_OPEN } from '../api/index';
import { supabaseApi } from '../api/supabase';
import { html, mount } from '../lib/html';
import { t, getLanguage, setLanguage } from '../lib/i18n';
import { relativeTime } from '../lib/format';
import { icon, avatar, loading, emptyState, friendlyError } from './components';
import { initMonitoring } from '../shared/monitoring';
import { redirectAuthCallback } from '../lib/authRedirect';

export const PATHS = {
  home: '/index.html',
  login: '/pages/auth/login.html',
  orgHome: '/pages/organization/dashboard.html',
  adminHome: '/pages/admin/dashboard.html'
};

const NAV = {
  organization: [
    ['dashboard', 'layout-dashboard', '/pages/organization/dashboard.html'],
    ['certificates', 'badge-check', '/pages/organization/certificates.html'],
    ['connections', 'users', '/pages/organization/partners.html'],
    ['requests', 'inbox', '/pages/organization/requests.html'],
    ['settings', 'settings', '/pages/organization/profile.html']
  ],
  admin: [
    ['adminDashboard', 'layout-dashboard', '/pages/admin/dashboard.html'],
    ['organizations', 'building', '/pages/admin/organizations.html'],
    ['network', 'network', '/pages/admin/network.html'],
    ['audit', 'list-checks', '/pages/admin/audit.html'],
    ['demo', 'eye', '/pages/demo/index.html?role=organization'],
    ['adminSettings', 'settings', '/pages/admin/settings.html']
  ]
};

// Page-to-page cross-fades (see app.css) are a nicety: a skipped or aborted
// transition must not surface as an error.
for (const type of ['pageswap', 'pagereveal']) {
  window.addEventListener(type, e => {
    const vt = e.viewTransition;
    if (vt) for (const p of [vt.ready, vt.finished, vt.updateCallbackDone]) p?.catch(() => {});
  });
}

// ------------------------------------------------------------------ theme & language
export function applyTheme() {
  let saved = null;
  try { saved = localStorage.getItem('theme'); } catch { /* ignore */ }
  const dark = saved ? saved === 'dark' : window.matchMedia?.('(prefers-color-scheme: dark)').matches;
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
}
function toggleTheme() {
  const dark = document.documentElement.dataset.theme !== 'dark';
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  try { localStorage.setItem('theme', dark ? 'dark' : 'light'); } catch { /* ignore */ }
}
function toggleLanguage() { setLanguage(getLanguage() === 'en' ? 'el' : 'en'); location.reload(); }

export function prepareDocument(titleKey) {
  // A password-recovery link that landed here: go to the reset page instead.
  if (redirectAuthCallback()) throw new Error('redirecting');
  applyTheme();
  initMonitoring();
  document.documentElement.lang = getLanguage();
  if (titleKey) document.title = `${t(titleKey)} · CertiTrack`;
}

export function utilityButtons() {
  return html`
    <button type="button" class="icon-btn" data-action="language" title="${t('shell.language')}" aria-label="${t('shell.language')}">
      <span class="lang-code">${getLanguage() === 'en' ? 'ΕΛ' : 'EN'}</span></button>
    <button type="button" class="icon-btn" data-action="theme" title="${t('shell.theme')}" aria-label="${t('shell.theme')}">
      <span class="only-light">${icon('moon')}</span><span class="only-dark">${icon('sun')}</span></button>`;
}
export function bindUtilityButtons(root = document) {
  root.querySelectorAll('[data-action=language]').forEach(b => b.addEventListener('click', toggleLanguage));
  root.querySelectorAll('[data-action=theme]').forEach(b => b.addEventListener('click', toggleTheme));
}

export const brand = () => html`<a class="brand" href="${PATHS.home}" aria-label="CertiTrack">
  <span class="brand__mark">${icon('shield-check', { size: 18 })}</span><span class="brand__name">CertiTrack</span></a>`;

// ------------------------------------------------------------------ notifications
const NOTE_ICON = {
  connection_request: 'user-plus', connection_accepted: 'link-2', connection_declined: 'unlink', connection_ended: 'unlink',
  document_request: 'inbox', document_request_fulfilled: 'circle-check', document_request_declined: 'circle-alert',
  certificate_expiry: 'clock', certificate_expired: 'triangle-alert', partner_certificate_expiring: 'clock',
  partner_certificate_expired: 'triangle-alert', partner_certificate_renewed: 'refresh-cw', system: 'info'
};
function notificationHref(n) {
  if (n.type.startsWith('connection')) return '/pages/organization/partners.html';
  if (n.type.startsWith('document_request') || n.type.startsWith('partner_certificate')) return '/pages/organization/requests.html';
  return '/pages/organization/certificates.html';
}
async function refreshBell() {
  try {
    const rows = await api.notifications();
    const unread = rows.filter(n => !n.read_at).length;
    const count = document.getElementById('bellCount');
    if (count) { count.textContent = unread > 9 ? '9+' : String(unread); count.hidden = unread === 0; }
    return rows;
  } catch { return []; }
}
async function openNotifications(btn) {
  const panel = document.getElementById('notePanel');
  if (!panel.hidden) { panel.hidden = true; btn.setAttribute('aria-expanded', 'false'); return; }
  panel.hidden = false; btn.setAttribute('aria-expanded', 'true');
  mount(panel, loading());
  const rows = await refreshBell();
  mount(panel, html`<div class="popover__head"><strong>${t('shell.notifications')}</strong></div>
    ${rows.length ? html`<ul class="note-list">${rows.map(n => html`
      <li><a class="note ${n.read_at ? '' : 'note--unread'}" href="${notificationHref(n)}">
        <span class="note__icon note__icon--${n.severity}">${icon(NOTE_ICON[n.type] || 'bell', { size: 16 })}</span>
        <span class="note__body"><strong>${n.title}</strong><span>${n.body}</span><small>${relativeTime(n.created_at)}</small></span>
      </a></li>`)}</ul>` : emptyState({ iconName: 'bell', title: t('shell.noNotifications') })}`);
  const unread = rows.filter(n => !n.read_at).map(n => n.id);
  if (unread.length) { await api.markNotificationsRead(unread).catch(() => {}); refreshBell(); }
}

// ------------------------------------------------------------------ layout
let documentListeners = false;
let shellPopovers = [];
function renderShell({ area, page, ctx, title, subtitle, back }) {
  const nav = NAV[area];
  const who = ctx.organization?.name || t('shell.platformOwner');
  document.body.classList.add('app');
  mount(document.body, html`
    <a class="skip-link" href="#main">${t('shell.skip')}</a>
    ${isDemo() ? html`<div class="demo-bar">${icon('info', { size: 16 })}<span>${t('demo.bannerShort')}<span class="demo-bar__long"> ${t('demo.bannerLong')}</span></span>
      <button type="button" class="btn btn--sm btn--ghost-inverse" data-action="exit-demo">${t('demo.exit')}</button></div>` : ''}
    <header class="topbar">
      ${brand()}
      <span class="topbar__context">${area === 'admin' ? html`<span class="badge badge--accent">${t('shell.adminBadge')}</span>` : ''}<span class="topbar__org" title="${who}">${who}</span></span>
      <div class="topbar__actions">
        ${area === 'organization' ? html`<div class="popover-wrap">
          <button type="button" class="icon-btn" id="bellBtn" aria-haspopup="true" aria-expanded="false" aria-label="${t('shell.notifications')}">${icon('bell')}<span class="dot-count" id="bellCount" hidden></span></button>
          <div class="popover popover--notes" id="notePanel" hidden></div></div>` : ''}
        ${utilityButtons()}
        <div class="popover-wrap">
          <button type="button" class="account-btn" id="accountBtn" aria-haspopup="true" aria-expanded="false">${avatar(ctx.user.email, { size: 'sm' })}<span class="sr-only">${t('shell.account')}</span></button>
          <div class="popover popover--menu" id="accountMenu" hidden>
            <div class="popover__head"><small>${t('shell.signedInAs')}</small><strong>${ctx.user.email}</strong></div>
            ${area === 'organization' ? html`<a class="menu-item" href="/pages/organization/profile.html">${icon('settings', { size: 16 })}${t('nav.settings')}</a>` : ''}
            <button type="button" class="menu-item menu-item--danger" data-action="logout">${icon('log-out', { size: 16 })}${t('shell.logout')}</button>
          </div>
        </div>
      </div>
    </header>
    <div class="layout">
      <nav class="sidenav" aria-label="${t('shell.mainNav')}">
        ${nav.map(([key, ic, href]) => html`<a class="sidenav__item${key === page ? ' is-active' : ''}" href="${href}" ${key === page ? html`aria-current="page"` : ''}>
          ${icon(ic)}<span>${t(`nav.${key}`)}</span><span class="sidenav__count" data-count="${key}" hidden></span></a>`)}
      </nav>
      <main class="main" id="main" tabindex="-1">
        ${back ? html`<a class="back-link" href="${back.href}">${icon('arrow-left', { size: 16 })}${t(back.label)}</a>` : ''}
        <div class="page-head">
          <div><h1>${title}</h1>${subtitle ? html`<p>${subtitle}</p>` : ''}</div>
          <div class="page-head__actions" id="pageActions"></div>
        </div>
        <div id="notice"></div>
        <div id="content">${loading()}</div>
      </main>
    </div>`);

  bindUtilityButtons();
  const popovers = [['accountBtn', 'accountMenu']];
  document.getElementById('accountBtn').addEventListener('click', e => {
    const menu = document.getElementById('accountMenu'); menu.hidden = !menu.hidden;
    e.currentTarget.setAttribute('aria-expanded', String(!menu.hidden));
  });
  const bell = document.getElementById('bellBtn');
  if (bell) { popovers.push(['bellBtn', 'notePanel']); bell.addEventListener('click', () => openNotifications(bell)); refreshBell(); }
  shellPopovers = popovers;
  document.querySelector('[data-action=logout]').addEventListener('click', async () => {
    writeSnapshot(null);
    await api.signOut().catch(() => {});
    location.href = PATHS.home;
  });
  document.querySelector('[data-action=exit-demo]')?.addEventListener('click', () => { endDemo(); location.href = DEMO_OPEN ? PATHS.home : PATHS.adminHome; });
  if (documentListeners) return;
  documentListeners = true;
  document.addEventListener('click', e => {
    for (const [b, p] of shellPopovers) {
      const panel = document.getElementById(p);
      if (!panel.hidden && !e.target.closest(`#${b}`) && !e.target.closest(`#${p}`)) { panel.hidden = true; document.getElementById(b).setAttribute('aria-expanded', 'false'); }
    }
  });
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    for (const [b, p] of shellPopovers) { const panel = document.getElementById(p); if (!panel.hidden) { panel.hidden = true; document.getElementById(b).focus(); } }
  });
}

export function setNavCount(key, count) {
  const el = document.querySelector(`[data-count="${key}"]`);
  if (el) { el.textContent = count > 99 ? '99+' : String(count); el.hidden = !count; }
}

// What the shell shows about the account, kept for this tab so the next page can
// draw its frame immediately instead of waiting for the network.
const SNAPSHOT_KEY = 'certitrack.shell';
const snapshotOf = ctx => ({ email: ctx.user.email, org: ctx.organization?.name || null, isAdmin: !!ctx.isAdmin, status: ctx.organization?.status || null });
function readSnapshot() { try { return JSON.parse(sessionStorage.getItem(SNAPSHOT_KEY) || 'null'); } catch { return null; } }
function writeSnapshot(snap) { if (!snap) clearViews(); try { snap ? sessionStorage.setItem(SNAPSHOT_KEY, JSON.stringify(snap)) : sessionStorage.removeItem(SNAPSHOT_KEY); } catch { /* ignore */ } }
const sameSnapshot = (a, b) => !!a && !!b && a.email === b.email && a.org === b.org && a.isAdmin === b.isAdmin && a.status === b.status;
const snapshotFits = (snap, area) => !!snap && (area === 'admin' ? snap.isAdmin : !!snap.org);

// Last view of each page, kept for this tab only. When the user comes back to a
// page (or moves between menu items) its last content is shown at once, frozen,
// and replaced by the fresh content as soon as the page has loaded it. Without
// this every menu click showed a spinner in place of the content for a moment.
const VIEW_PREFIX = 'certitrack.view:';
const viewKey = () => VIEW_PREFIX + location.pathname + location.search;
let viewOwner = null;   // email of the account the visible shell belongs to

function clearViews() {
  try { for (const k of Object.keys(sessionStorage)) if (k.startsWith(VIEW_PREFIX)) sessionStorage.removeItem(k); } catch { /* ignore */ }
}

function saveView() {
  const main = document.getElementById('main');
  if (!viewOwner || !main || main.hasAttribute('data-stale') || main.querySelector('.loading, .spinner')) return;
  const counts = {};
  document.querySelectorAll('[data-count]').forEach(el => { if (!el.hidden) counts[el.dataset.count] = el.textContent; });
  const view = { email: viewOwner, main: main.innerHTML, counts };
  try {
    const text = JSON.stringify(view);
    if (text.length < 400_000) sessionStorage.setItem(viewKey(), text);
  } catch { /* storage full or blocked: just skip */ }
}
window.addEventListener('pagehide', saveView);

function restoreView(email) {
  let view = null;
  try { view = JSON.parse(sessionStorage.getItem(viewKey()) || 'null'); } catch { /* ignore */ }
  const main = document.getElementById('main');
  const content = document.getElementById('content');
  if (!view || view.email !== email || !main || !content) return;
  main.innerHTML = view.main;
  // Frozen until the page puts its own content in: no clicks on stale buttons.
  main.inert = true;
  main.setAttribute('data-stale', '');
  for (const [key, text] of Object.entries(view.counts || {})) {
    const el = document.querySelector(`[data-count="${key}"]`);
    if (el) { el.textContent = text; el.hidden = false; }
  }
  const fresh = document.getElementById('content');
  new MutationObserver((_, obs) => {
    obs.disconnect();
    main.inert = false;
    main.removeAttribute('data-stale');
  }).observe(fresh, { childList: true });
}

// Guard + shell. Returns { ctx, content, actions } or never resolves when redirecting.
export async function startPage({ area, page, title, subtitle, back }) {
  prepareDocument(`nav.${page}`);
  // On the real site the demo is for the platform owner only: confirm it with
  // the server (in parallel with drawing the page) before showing anything.
  const demoAllowed = !isDemo() || DEMO_OPEN ? Promise.resolve(true)
    : supabaseApi.context().then(c => !!c?.isAdmin, () => false);
  const shellArgs = ctx => ({ area, page, ctx, title: t(title), subtitle: subtitle ? t(subtitle) : '', back });
  // Draw the frame right away from the last known account; it is confirmed below.
  const snap = readSnapshot();
  let drawn = null;
  if (snapshotFits(snap, area)) {
    renderShell(shellArgs({ user: { email: snap.email }, organization: snap.org ? { name: snap.org } : null, isAdmin: snap.isAdmin }));
    drawn = snap;
    viewOwner = snap.email;
    restoreView(snap.email);
  }
  let ctx;
  try {
    ctx = await api.context();
  } catch (err) {
    console.error(err);
    mount(document.body, html`<main class="center-page">${emptyState({ iconName: 'circle-alert', title: t('common.loadFailed'), text: friendlyError(err) })}</main>`);
    return new Promise(() => {});
  }
  const redirect = to => { writeSnapshot(null); location.replace(to); return new Promise(() => {}); };
  if (!await demoAllowed) { endDemo(); return redirect(PATHS.home); }
  if (!ctx) return redirect(`${PATHS.login}?next=${encodeURIComponent(location.pathname + location.search)}`);
  if (area === 'admin' && !ctx.isAdmin) return redirect(ctx.organization ? PATHS.orgHome : PATHS.login);
  if (area === 'organization' && !ctx.organization) {
    if (ctx.isAdmin) return redirect(PATHS.adminHome);
    writeSnapshot(null);
    mount(document.body, html`<main class="center-page">${emptyState({ iconName: 'building', title: t('shell.noOrganization'), text: t('shell.noOrganizationText') })}</main>`);
    return new Promise(() => {});
  }
  const fresh = snapshotOf(ctx);
  writeSnapshot(fresh);
  if (!sameSnapshot(drawn, fresh)) {
    if (drawn && drawn.email !== fresh.email) clearViews();
    renderShell(shellArgs(ctx));
    viewOwner = fresh.email;
    restoreView(fresh.email);
  }

  const status = ctx.organization?.status;
  if (status && status !== 'active') {
    mount('#notice', html`<div class="callout callout--warning">${icon('triangle-alert')}<div><strong>${t(`orgStatus.${status}.title`)}</strong><p>${t(`orgStatus.${status}.text`)}</p></div></div>`);
  }
  const setHeading = (heading, meta) => {
    document.querySelector('.page-head h1').textContent = heading;
    const sub = document.querySelector('.page-head p') || document.querySelector('.page-head > div').appendChild(document.createElement('p'));
    if (meta) { sub.className = 'page-head__meta'; mount(sub, meta); }
  };
  return { ctx, content: document.getElementById('content'), actions: document.getElementById('pageActions'), setHeading };
}
