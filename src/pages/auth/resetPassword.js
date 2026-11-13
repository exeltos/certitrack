import { supabaseApi } from '../../api/supabase.js';
import { html, mount } from '../../lib/html.js';
import { t } from '../../lib/i18n.js';
import { icon, friendlyError } from '../../ui/components.js';
import { passwordField, bindPasswordFields, checkNewPassword } from '../../ui/password.js';
import { publicPage, authCard, formError, busy } from '../public/layout.js';

const root = publicPage({ titleKey: 'auth.resetTitle', body: authCard(html`<div class="loading"><span class="spinner"></span></div>`) });
const card = root.querySelector('.auth-card');
const hash = new URLSearchParams(location.hash.slice(1));

const invalid = message => mount(card, html`<div class="empty"><span class="empty__icon">${icon('circle-alert', { size: 22 })}</span>
  <strong>${t('auth.linkInvalid')}</strong><p>${message}</p><a class="btn btn--primary" href="/pages/auth/forgot.html">${t('auth.requestNewLink')}</a></div>`);

(async () => {
  // Rendered as text only: the URL can be crafted by anyone.
  if (hash.get('error_code') || hash.get('error_description')) { invalid(t('auth.linkExpired')); return; }
  let session = await supabaseApi.session().catch(() => null);
  if (!session) { await new Promise(r => setTimeout(r, 500)); session = await supabaseApi.session().catch(() => null); }
  if (!session) { invalid(t('auth.linkExpired')); return; }
  mount(card, html`<h1>${t('auth.resetTitle')}</h1><p>${t('auth.resetText')}</p>
    <form novalidate data-reset>
      ${passwordField({ name: 'password', label: t('settings.newPassword'), rules: true, autofocus: true })}
      ${passwordField({ name: 'confirm', label: t('auth.confirmPassword') })}
      <button class="btn btn--primary btn--lg btn--block" type="submit">${t('auth.savePassword')}</button>
    </form>`);
  bindPasswordFields(card);
  card.querySelector('[data-reset]').addEventListener('submit', e => {
    e.preventDefault();
    const form = e.target;
    busy(form.querySelector('[type=submit]'), async () => {
      try {
        await supabaseApi.updatePassword(checkNewPassword(form));
        await supabaseApi.signOut();
        mount(card, html`<div class="empty"><span class="empty__icon">${icon('circle-check', { size: 22 })}</span>
          <strong>${t('auth.passwordUpdated')}</strong><p>${t('auth.passwordUpdatedText')}</p><a class="btn btn--primary" href="/pages/auth/login.html">${t('auth.signIn')}</a></div>`);
      } catch (err) { formError(form, err.userMessage || friendlyError(err)); }
    });
  });
})();
