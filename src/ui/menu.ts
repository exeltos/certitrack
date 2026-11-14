// "⋯" action menu for a row. It opens in a layer above the page (fixed
// position), so a list that scrolls inside its card cannot cut it off.
// Keyboard: arrows move, Enter picks, Escape closes and returns focus.
import { html, mount, type SafeHtml } from '../lib/html';
import { icon } from './components';

export interface MenuItem { action: string; label: string; icon: string; danger?: boolean }

/** The button that opens a row's menu; data-menu carries the row id. */
export const menuButton = (id: string, label: string): SafeHtml =>
  html`<button type="button" class="icon-btn icon-btn--sm" data-menu="${id}" aria-haspopup="menu" aria-expanded="false" title="${label}" aria-label="${label}">${icon('ellipsis')}</button>`;

let close: (() => void) | null = null;

export function openMenu(anchor: HTMLElement, items: readonly MenuItem[], onPick: (action: string) => void): void {
  const wasOpen = anchor.getAttribute('aria-expanded') === 'true';
  close?.();
  if (wasOpen) return;   // a second click on the same button closes it

  const menu = document.createElement('div');
  menu.className = 'action-menu';
  menu.setAttribute('role', 'menu');
  mount(menu, html`${items.map(it => html`<button type="button" role="menuitem" class="menu-item ${it.danger ? 'menu-item--danger' : ''}" data-pick="${it.action}">${icon(it.icon, { size: 16 })}${it.label}</button>`)}`);
  document.body.appendChild(menu);

  // Below the button, right-aligned; above it when there is no room below.
  const r = anchor.getBoundingClientRect();
  const { width, height } = menu.getBoundingClientRect();
  const left = Math.max(8, Math.min(r.right - width, innerWidth - width - 8));
  const top = r.bottom + 4 + height > innerHeight - 8 ? Math.max(8, r.top - 4 - height) : r.bottom + 4;
  menu.style.left = `${left}px`;
  menu.style.top = `${top}px`;
  anchor.setAttribute('aria-expanded', 'true');

  const buttons = [...menu.querySelectorAll<HTMLButtonElement>('[data-pick]')];
  const done = (refocus: boolean) => {
    menu.remove();
    anchor.setAttribute('aria-expanded', 'false');
    document.removeEventListener('pointerdown', outside, true);
    document.removeEventListener('keydown', keys, true);
    window.removeEventListener('scroll', dismiss, true);
    window.removeEventListener('resize', dismiss);
    close = null;
    if (refocus) anchor.focus();
  };
  const outside = (e: Event) => { if (!menu.contains(e.target as Node) && !anchor.contains(e.target as Node)) done(false); };
  const dismiss = () => done(false);
  const keys = (e: KeyboardEvent) => {
    const i = buttons.indexOf(document.activeElement as HTMLButtonElement);
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); done(true); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); buttons[(i + 1) % buttons.length]?.focus(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); buttons[(i - 1 + buttons.length) % buttons.length]?.focus(); }
    else if (e.key === 'Tab') done(false);
  };
  menu.addEventListener('click', e => {
    const pick = (e.target as Element).closest<HTMLElement>('[data-pick]')?.dataset.pick;
    if (!pick) return;
    done(false);
    onPick(pick);
  });
  document.addEventListener('pointerdown', outside, true);
  document.addEventListener('keydown', keys, true);
  window.addEventListener('scroll', dismiss, true);
  window.addEventListener('resize', dismiss);
  close = () => done(false);
  buttons[0]?.focus();
}
