// Layout for public (signed-out) pages.
import { html, mount } from '../../lib/html';
import { icon } from '../../ui/components';
import { t } from '../../lib/i18n';
import { brand, utilityButtons, bindUtilityButtons, prepareDocument } from '../../ui/shell';

export function publicPage({ titleKey, body, nav = '', brand: brandBand = false }) {
  prepareDocument(titleKey);
  mount(document.body, html`<div class="public ${brandBand ? 'public--brand' : ''}">
    <header class="public-bar">${brand()}<div class="public-bar__actions">${nav}${utilityButtons()}</div></header>
    ${body}
    <footer class="site-foot">© ${new Date().getFullYear()} CertiTrack · ${t('public.footer')}</footer>
  </div>`);
  bindUtilityButtons();
  return document.querySelector('.public');
}

export const authCard = (inner, wide = false) => html`<main class="auth auth--split" id="main">
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

export function formError(form, message) {
  let el = form.querySelector('.dialog__error');
  if (!el) { el = document.createElement('p'); el.className = 'dialog__error'; el.setAttribute('role', 'alert'); el.style.margin = '0'; form.prepend(el); }
  el.textContent = message; el.hidden = !message;
}

export async function busy(button, fn) {
  button.disabled = true; button.setAttribute('aria-busy', 'true');
  try { return await fn(); } finally { button.disabled = false; button.removeAttribute('aria-busy'); }
}
