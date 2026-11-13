// Layout for public (signed-out) pages.
import { html, mount } from '../../lib/html.js';
import { t } from '../../lib/i18n.js';
import { brand, utilityButtons, bindUtilityButtons, prepareDocument } from '../../ui/shell.js';

export function publicPage({ titleKey, body, nav = '' }) {
  prepareDocument(titleKey);
  mount(document.body, html`<div class="public">
    <header class="public-bar">${brand()}<div class="public-bar__actions">${nav}${utilityButtons()}</div></header>
    ${body}
    <footer class="site-foot">© ${new Date().getFullYear()} CertiTrack · ${t('public.footer')}</footer>
  </div>`);
  bindUtilityButtons();
  return document.querySelector('.public');
}

export const authCard = (inner, wide = false) => html`<main class="auth" id="main"><section class="card auth-card ${wide ? 'auth-card--wide' : ''}">${inner}</section></main>`;

export function formError(form, message) {
  let el = form.querySelector('.dialog__error');
  if (!el) { el = document.createElement('p'); el.className = 'dialog__error'; el.setAttribute('role', 'alert'); el.style.margin = '0'; form.prepend(el); }
  el.textContent = message; el.hidden = !message;
}

export async function busy(button, fn) {
  button.disabled = true; button.setAttribute('aria-busy', 'true');
  try { return await fn(); } finally { button.disabled = false; button.removeAttribute('aria-busy'); }
}
