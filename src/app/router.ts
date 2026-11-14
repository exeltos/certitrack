// Moves between the signed-in pages without reloading: a menu click (or any
// link to another page of the same area) loads that page's module, lets it
// build its content off-screen, and swaps the main area in one step. The old
// page stays on screen until the new one has something to show, so nothing
// blinks; a thin bar at the top shows that the next page is on its way. Only a
// page that takes longer than SLOW_PAGE replaces the old one with a spinner.
import { html, mount, type Renderable } from '../lib/html';
import { t } from '../lib/i18n';
import { icon, loading, errorState } from '../ui/components';
import { setTitle } from '../ui/chrome';
import { setActiveNav } from './shell';
import type { AppContext, OrganizationStatus } from '../types/domain';
import type { Area, NavKey, PageContext, PageDef } from './page';

type Loader = () => Promise<{ default: PageDef }>;
interface Route { area: Area; nav: NavKey; load: Loader }

export const ROUTES: Record<string, Route> = {
  '/pages/organization/dashboard.html': { area: 'organization', nav: 'dashboard', load: () => import('../pages/organization/dashboard') },
  '/pages/organization/certificates.html': { area: 'organization', nav: 'certificates', load: () => import('../pages/organization/certificates') },
  '/pages/organization/partners.html': { area: 'organization', nav: 'connections', load: () => import('../pages/organization/partners') },
  '/pages/organization/partner.html': { area: 'organization', nav: 'connections', load: () => import('../pages/organization/partner') },
  '/pages/organization/requests.html': { area: 'organization', nav: 'requests', load: () => import('../pages/organization/requests') },
  '/pages/organization/profile.html': { area: 'organization', nav: 'settings', load: () => import('../pages/organization/profile') },
  '/pages/admin/dashboard.html': { area: 'admin', nav: 'adminDashboard', load: () => import('../pages/admin/dashboard') },
  '/pages/admin/organizations.html': { area: 'admin', nav: 'organizations', load: () => import('../pages/admin/organizations') },
  '/pages/admin/network.html': { area: 'admin', nav: 'network', load: () => import('../pages/admin/network') },
  '/pages/admin/audit.html': { area: 'admin', nav: 'audit', load: () => import('../pages/admin/audit') },
  '/pages/admin/presentations.html': { area: 'admin', nav: 'presentations', load: () => import('../pages/admin/presentations') },
  '/pages/admin/settings.html': { area: 'admin', nav: 'adminSettings', load: () => import('../pages/admin/settings') }
};

export const routeFor = (path: string): Route | undefined => ROUTES[path];

const SLOW_PAGE = 1500;        // ms before a slow page is shown with a spinner
const FIRST_PAGE = 150;        // the same on the first load, when nothing is on screen yet
const PROGRESS_DELAY = 120;    // fast moves do not show the progress bar at all

let appCtx: AppContext;
let appArea: Area;
let current: AbortController | null = null;
let seq = 0;

/** Starts routing inside an already drawn shell and shows the current page. */
export function startRouter(ctx: AppContext, area: Area): void {
  appCtx = ctx;
  appArea = area;
  document.addEventListener('click', onLinkClick);
  window.addEventListener('popstate', () => { void show(new URL(location.href), { focus: false }); });
  void show(new URL(location.href), { focus: false });
}

/** Go to a page of the app; pages of the other area (or outside the app) load normally. */
export function navigate(href: string, { replace = false } = {}): void {
  const url = new URL(href, location.href);
  const route = url.origin === location.origin ? routeFor(url.pathname) : undefined;
  if (!route || route.area !== appArea) { if (replace) location.replace(url.href); else location.assign(url.href); return; }
  if (replace) history.replaceState(null, '', url.href); else history.pushState(null, '', url.href);
  void show(url, { focus: true });
}

function onLinkClick(e: MouseEvent): void {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  const a = (e.target as Element).closest?.('a[href]') as HTMLAnchorElement | null;
  if (!a || (a.target && a.target !== '_self') || a.hasAttribute('download')) return;
  const url = new URL(a.href, location.href);
  if (url.origin !== location.origin || url.hash && url.pathname === location.pathname && url.search === location.search) return;
  const route = routeFor(url.pathname);
  if (!route || route.area !== appArea) return;
  e.preventDefault();
  navigate(url.href);
}

async function show(url: URL, { focus }: { focus: boolean }): Promise<void> {
  const route = routeFor(url.pathname);
  if (!route) { location.assign(url.href); return; }
  const token = ++seq;
  current?.abort();
  const controller = new AbortController();
  current = controller;
  setActiveNav(route.nav);

  let def: PageDef;
  try {
    def = (await route.load()).default;
  } catch (err) {
    // A new version of the site was deployed meanwhile: load the page normally.
    console.error(err);
    location.assign(url.href);
    return;
  }
  if (token !== seq) return;

  const next = buildMain(def);
  const content = next.querySelector<HTMLElement>('#content')!;
  const actions = next.querySelector<HTMLElement>('#pageActions')!;
  const onScreen = document.getElementById('main');
  let shown = false;
  const swap = () => {
    if (shown || token !== seq) return;
    shown = true;
    observer.disconnect();
    clearTimeout(timer);
    clearTimeout(progress);
    document.body.classList.remove('is-navigating');
    document.getElementById('main')?.replaceWith(next);
    if (focus) { next.focus({ preventScroll: true }); window.scrollTo(0, 0); }
  };
  // Show the new page as soon as it puts something in its content area.
  const observer = new MutationObserver(swap);
  observer.observe(content, { childList: true });
  const timer = setTimeout(() => { if (!content.firstChild) mount(content, loading()); swap(); },
    onScreen?.firstChild ? SLOW_PAGE : FIRST_PAGE);
  const progress = setTimeout(() => { if (token === seq && !shown) document.body.classList.add('is-navigating'); }, PROGRESS_DELAY);

  setTitle(t(def.title));
  const page: PageContext = {
    ctx: appCtx,
    content,
    actions,
    signal: controller.signal,
    navigate,
    setHeading(heading: string, meta?: Renderable) {
      const h1 = next.querySelector('.page-head h1');
      if (h1) h1.textContent = heading;
      setTitle(heading);
      if (meta) {
        const head = next.querySelector('.page-head > div')!;
        const sub = head.querySelector('p') ?? head.appendChild(document.createElement('p'));
        sub.className = 'page-head__meta';
        mount(sub, meta);
      }
    }
  };
  try {
    await def.render(page);
  } catch (err) {
    console.error(err);
    if (token === seq) mount(content, errorState(err));
  }
}

function buildMain(def: PageDef): HTMLElement {
  const main = document.createElement('main');
  main.className = 'main';
  main.id = 'main';
  main.tabIndex = -1;
  const status = appCtx.organization?.status as OrganizationStatus | undefined;
  mount(main, html`
    ${def.back ? html`<a class="back-link" href="${def.back.href}">${icon('arrow-left', { size: 16 })}${t(def.back.label)}</a>` : ''}
    <div class="page-head">
      <div><h1>${t(def.title)}</h1>${def.subtitle ? html`<p>${t(def.subtitle)}</p>` : ''}</div>
      <div class="page-head__actions" id="pageActions"></div>
    </div>
    <div id="notice">${status && status !== 'active'
      ? html`<div class="callout callout--warning">${icon('triangle-alert')}<div><strong>${t(`orgStatus.${status}.title`)}</strong><p>${t(`orgStatus.${status}.text`)}</p></div></div>` : ''}</div>
    <div id="content"></div>`);
  return main;
}
