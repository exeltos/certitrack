// What a signed-in page is: a definition the router loads and renders inside
// the app shell. Pages never reload the shell; moving between them only swaps
// the main area.
import type { MessageKey } from '../lib/i18n';
import type { Renderable } from '../lib/html';
import type { AppContext } from '../types/domain';

export type Area = 'organization' | 'admin';

export type NavKey =
  | 'dashboard' | 'certificates' | 'connections' | 'requests' | 'settings'
  | 'adminDashboard' | 'organizations' | 'network' | 'audit' | 'demo' | 'adminSettings';

export interface PageContext {
  ctx: AppContext;
  /** The page's main area. A fresh element on every visit. */
  content: HTMLElement;
  /** Buttons next to the page title. */
  actions: HTMLElement;
  /** Replace the title (and optionally the line under it) once data is known. */
  setHeading(heading: string, meta?: Renderable): void;
  /** Aborted when the user leaves the page: stop late work with it. */
  signal: AbortSignal;
  /** Go to another page of the app without reloading. */
  navigate(url: string, options?: { replace?: boolean }): void;
}

export interface PageDef {
  area: Area;
  /** Menu item highlighted while this page is shown. */
  nav: NavKey;
  title: MessageKey;
  subtitle?: MessageKey;
  back?: { href: string; label: MessageKey };
  render(page: PageContext): void | Promise<void>;
}

export const definePage = (def: PageDef): PageDef => def;
