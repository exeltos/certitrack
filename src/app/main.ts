// Entry point of every signed-in page (organization and platform admin).
// It checks who is signed in, draws the frame and hands over to the router,
// which from then on moves between pages without reloading.
import { api, isDemo, endDemo, DEMO_OPEN } from '../api/index';
import { supabaseApi } from '../api/supabase';
import { html, mount } from '../lib/html';
import { t } from '../lib/i18n';
import { emptyState, friendlyError } from '../ui/components';
import { PATHS, prepareDocument } from '../ui/chrome';
import { drawShell, readSnapshot, writeSnapshot, sameIdentity, type ShellIdentity } from './shell';
import { routeFor, startRouter } from './router';
import type { AppContext } from '../types/domain';
import type { Area } from './page';

prepareDocument();
const route = routeFor(location.pathname);
if (!route) location.replace(PATHS.home);
else void start(route.area, route.nav, route.load);

async function start(area: Area, nav: Parameters<typeof drawShell>[2], load: () => Promise<unknown>): Promise<void> {
  void load();   // start downloading the page while we check the session

  // On the real site the demo is for the platform owner only: confirm it with the server.
  const demoAllowed = !isDemo() || DEMO_OPEN ? Promise.resolve(true)
    : supabaseApi.context().then(c => !!c?.isAdmin, () => false);

  // Draw the frame at once from the last known account; it is confirmed below.
  const snap = readSnapshot();
  const fits = !!snap && (area === 'admin' ? snap.isAdmin : !!snap.org);
  if (fits) drawShell(area, snap, nav);

  let ctx: AppContext | null;
  try {
    ctx = await api.context();
  } catch (err) {
    console.error(err);
    fail('circle-alert', t('common.loadFailed'), friendlyError(err));
    return;
  }
  const leave = (to: string) => { writeSnapshot(null); location.replace(to); };
  if (!await demoAllowed) { endDemo(); leave(PATHS.home); return; }
  if (!ctx) { leave(`${PATHS.login}?next=${encodeURIComponent(location.pathname + location.search)}`); return; }
  if (area === 'admin' && !ctx.isAdmin) { leave(ctx.organization ? PATHS.orgHome : PATHS.login); return; }
  if (area === 'organization' && !ctx.organization) {
    if (ctx.isAdmin) { leave(PATHS.adminHome); return; }
    writeSnapshot(null);
    fail('building', t('shell.noOrganization'), t('shell.noOrganizationText'));
    return;
  }

  const who: ShellIdentity = { email: ctx.user.email, org: ctx.organization?.name ?? null, isAdmin: ctx.isAdmin, status: ctx.organization?.status ?? null };
  if (!fits || !sameIdentity(snap, who)) drawShell(area, who, nav);
  writeSnapshot(who);
  startRouter(ctx, area);
}

function fail(iconName: string, title: string, text: string): void {
  document.body.classList.remove('app');
  mount(document.body, html`<main class="center-page">${emptyState({ iconName, title, text })}</main>`);
}
