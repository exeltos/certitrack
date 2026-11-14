// Layout for public (signed-out) pages.
import { html, mount, type Renderable, type SafeHtml } from '../../lib/html';
import { t, type MessageKey } from '../../lib/i18n';
import { icon } from '../../ui/components';
import { brand, utilityButtons, bindUtilityButtons, prepareDocument } from '../../ui/chrome';

export function publicPage({ titleKey, body, nav = '', brand: brandBand = false }:
  { titleKey: MessageKey; body: Renderable; nav?: Renderable; brand?: boolean }): HTMLElement {
  prepareDocument(titleKey);
  mount(document.body, html`<div class="public ${brandBand ? 'public--brand' : ''}">
    <header class="public-bar">${brand()}<div class="public-bar__actions">${nav}${utilityButtons()}</div></header>
    ${body}
    <footer class="site-foot">© ${new Date().getFullYear()} CertiTrack · ${t('public.footer')}</footer>
  </div>`);
  bindUtilityButtons();
  return document.querySelector<HTMLElement>('.public')!;
}

export const authCard = (inner: Renderable, wide = false): SafeHtml => html`<main class="auth auth--split" id="main">
  <aside class="auth-aside" aria-hidden="true">
    <span class="eyebrow" style="background:rgba(255,255,255,.1);color:#c7d2fe;width:fit-content">${icon('shield-check', { size: 14 })}${t('home.eyebrow')}</span>
    <h2>${t('auth.asideTitle')}</h2>
    <p>${t('auth.asideText')}</p>
    <ul>
      <li>${icon('users')}${t('home.f1Title')}</li>
      <li>${icon('share-2')}${t('home.f2Title')}</li>
      <li>${icon('inbox')}${t('home.f3Title')}</li>
    </ul>
  </aside>
  <section class="card auth-card ${wide ? 'auth-card--wide' : ''}">${inner}</section></main>`;

/** Show (or clear, with '') an error message at the top of a form. */
export function formError(form: HTMLFormElement, message: string): void {
  let el = form.querySelector<HTMLElement>('.dialog__error');
  if (!el) {
    el = document.createElement('p');
    el.className = 'dialog__error';
    el.setAttribute('role', 'alert');
    el.style.margin = '0';
    form.prepend(el);
  }
  el.textContent = message;
  el.hidden = !message;
}

/** Disable the button while fn runs. */
export async function busy<T>(button: HTMLButtonElement | null, fn: () => Promise<T>): Promise<T> {
  if (button) { button.disabled = true; button.setAttribute('aria-busy', 'true'); }
  try { return await fn(); } finally { if (button) { button.disabled = false; button.removeAttribute('aria-busy'); } }
}
