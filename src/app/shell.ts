// The signed-in frame: top bar, side menu, notifications and account menu.
// It is drawn once per visit; moving between pages only swaps the main area
// (see router.ts), so the frame never blinks.
import { api, isDemo, endDemo, DEMO_OPEN } from '../api/index';
import { html, mount } from '../lib/html';
import { t } from '../lib/i18n';
import { relativeTime } from '../lib/format';
import { icon, avatar, loading, emptyState } from '../ui/components';
import { PATHS, brand, utilityButtons, bindUtilityButtons } from '../ui/chrome';
import type { Notification } from '../types/domain';
import type { Area, NavKey } from './page';

export const NAV: Record<Area, readonly (readonly [NavKey, string, string])[]> = {
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

/** What the frame shows about the signed-in account. */
export interface ShellIdentity { email: string; org: string | null; isAdmin: boolean; status: string | null }

// ------------------------------------------------------------------ last known account
// Kept for this tab so a reload can draw the frame before the server answers.
const SNAPSHOT_KEY = 'certitrack.shell';

export function readSnapshot(): ShellIdentity | null {
  try { return JSON.parse(sessionStorage.getItem(SNAPSHOT_KEY) || 'null') as ShellIdentity | null; } catch { return null; }
}
export function writeSnapshot(id: ShellIdentity | null): void {
  try { if (id) sessionStorage.setItem(SNAPSHOT_KEY, JSON.stringify(id)); else sessionStorage.removeItem(SNAPSHOT_KEY); } catch { /* storage unavailable */ }
}
export const sameIdentity = (a: ShellIdentity | null, b: ShellIdentity | null): boolean =>
  !!a && !!b && a.email === b.email && a.org === b.org && a.isAdmin === b.isAdmin && a.status === b.status;

// ------------------------------------------------------------------ notifications
const NOTE_ICON: Record<string, string> = {
  connection_request: 'user-plus', connection_accepted: 'link-2', connection_declined: 'unlink', connection_ended: 'unlink',
  document_request: 'inbox', document_request_fulfilled: 'circle-check', document_request_declined: 'circle-alert',
  certificate_expiry: 'clock', certificate_expired: 'triangle-alert', partner_certificate_expiring: 'clock',
  partner_certificate_expired: 'triangle-alert', partner_certificate_renewed: 'refresh-cw', system: 'info'
};

function notificationHref(n: Notification): string {
  if (n.type.startsWith('connection')) return '/pages/organization/partners.html';
  if (n.type.startsWith('document_request') || n.type.startsWith('partner_certificate')) return '/pages/organization/requests.html';
  return '/pages/organization/certificates.html';
}

async function refreshBell(): Promise<Notification[]> {
  try {
    const rows = await api.notifications();
    const unread = rows.filter(n => !n.read_at).length;
    const count = document.getElementById('bellCount');
    if (count) { count.textContent = unread > 9 ? '9+' : String(unread); count.hidden = unread === 0; }
    return rows;
  } catch { return []; }
}

async function openNotifications(btn: HTMLElement, panel: HTMLElement): Promise<void> {
  if (!panel.hidden) { closePopover(btn, panel); return; }
  panel.hidden = false; btn.setAttribute('aria-expanded', 'true');
  mount(panel, loading());
  const rows = await refreshBell();
  mount(panel, html`<div class="popover__head"><strong>${t('shell.notifications')}</strong></div>
    ${rows.length ? html`<ul class="note-list">${rows.map(n => html`
      <li><a class="note ${n.read_at ? '' : 'note--unread'}" href="${notificationHref(n)}">
        <span class="note__icon note__icon--${n.severity}">${icon(NOTE_ICON[n.type] ?? 'bell', { size: 16 })}</span>
        <span class="note__body"><strong>${n.title}</strong><span>${n.body}</span><small>${relativeTime(n.created_at)}</small></span>
      </a></li>`)}</ul>` : emptyState({ iconName: 'bell', title: t('shell.noNotifications') })}`);
  const unread = rows.filter(n => !n.read_at).map(n => n.id);
  if (unread.length) { await api.markNotificationsRead(unread).catch(() => {}); void refreshBell(); }
}

function closePopover(btn: HTMLElement, panel: HTMLElement): void {
  panel.hidden = true;
  btn.setAttribute('aria-expanded', 'false');
}

// ------------------------------------------------------------------ frame
let popovers: [HTMLElement, HTMLElement][] = [];
let documentListeners = false;

/** Draws the frame with an empty main area (filled by the router). */
export function drawShell(area: Area, who: ShellIdentity, active: NavKey | null): void {
  const label = area === 'admin' ? t('shell.platformOwner') : who.org || '';
  document.body.classList.add('app');
  mount(document.body, html`
    <a class="skip-link" href="#main">${t('shell.skip')}</a>
    ${isDemo() ? html`<div class="demo-bar">${icon('info', { size: 16 })}<span>${t('demo.bannerShort')}<span class="demo-bar__long"> ${t('demo.bannerLong')}</span></span>
      <button type="button" class="btn btn--sm btn--ghost-inverse" data-action="exit-demo">${t('demo.exit')}</button></div>` : ''}
    <header class="topbar">
      ${brand()}
      <span class="topbar__context">${area === 'admin' ? html`<span class="badge badge--accent">${t('shell.adminBadge')}</span>` : ''}<span class="topbar__org" title="${label}">${label}</span></span>
      <div class="topbar__actions">
        ${area === 'organization' ? html`<div class="popover-wrap">
          <button type="button" class="icon-btn" id="bellBtn" aria-haspopup="true" aria-expanded="false" aria-label="${t('shell.notifications')}">${icon('bell')}<span class="dot-count" id="bellCount" hidden></span></button>
          <div class="popover popover--notes" id="notePanel" hidden></div></div>` : ''}
        ${utilityButtons()}
        <div class="popover-wrap">
          <button type="button" class="account-btn" id="accountBtn" aria-haspopup="true" aria-expanded="false">${avatar(who.email, { size: 'sm' })}<span class="sr-only">${t('shell.account')}</span></button>
          <div class="popover popover--menu" id="accountMenu" hidden>
            <div class="popover__head"><small>${t('shell.signedInAs')}</small><strong>${who.email}</strong></div>
            ${area === 'organization' ? html`<a class="menu-item" href="/pages/organization/profile.html">${icon('settings', { size: 16 })}${t('nav.settings')}</a>` : ''}
            <button type="button" class="menu-item menu-item--danger" data-action="logout">${icon('log-out', { size: 16 })}${t('shell.logout')}</button>
          </div>
        </div>
      </div>
    </header>
    <div class="layout">
      <nav class="sidenav" aria-label="${t('shell.mainNav')}">
        ${NAV[area].map(([key, ic, href]) => html`<a class="sidenav__item" href="${href}" data-nav="${key}">
          ${icon(ic)}<span>${t(`nav.${key}`)}</span><span class="sidenav__count" data-count="${key}" hidden></span></a>`)}
      </nav>
      <main class="main" id="main" tabindex="-1"></main>
    </div>`);
  setActiveNav(active);
  bindShell();
}

export function setActiveNav(key: NavKey | null): void {
  document.querySelectorAll<HTMLElement>('.sidenav__item').forEach(a => {
    const on = a.dataset.nav === key;
    a.classList.toggle('is-active', on);
    if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
}

export function setNavCount(key: NavKey, count: number): void {
  const el = document.querySelector<HTMLElement>(`[data-count="${key}"]`);
  if (el) { el.textContent = count > 99 ? '99+' : String(count); el.hidden = !count; }
}

function bindShell(): void {
  bindUtilityButtons();
  const accountBtn = document.getElementById('accountBtn')!;
  const accountMenu = document.getElementById('accountMenu')!;
  popovers = [[accountBtn, accountMenu]];
  accountBtn.addEventListener('click', () => {
    accountMenu.hidden = !accountMenu.hidden;
    accountBtn.setAttribute('aria-expanded', String(!accountMenu.hidden));
  });
  const bell = document.getElementById('bellBtn');
  const notePanel = document.getElementById('notePanel');
  if (bell && notePanel) {
    popovers.push([bell, notePanel]);
    bell.addEventListener('click', () => { void openNotifications(bell, notePanel); });
    void refreshBell();
  }
  document.querySelector('[data-action=logout]')?.addEventListener('click', async () => {
    writeSnapshot(null);
    await api.signOut().catch(() => {});
    location.href = PATHS.home;
  });
  document.querySelector('[data-action=exit-demo]')?.addEventListener('click', () => {
    endDemo();
    location.href = DEMO_OPEN ? PATHS.home : PATHS.adminHome;
  });

  if (documentListeners) return;
  documentListeners = true;
  // Close a popover on an outside click, on Escape, and when the page changes.
  document.addEventListener('click', e => {
    const target = e.target as Element;
    for (const [btn, panel] of popovers) {
      if (!panel.hidden && !btn.contains(target) && !(panel.contains(target) && !target.closest('a'))) closePopover(btn, panel);
    }
  });
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    for (const [btn, panel] of popovers) if (!panel.hidden) { closePopover(btn, panel); btn.focus(); }
  });
}
