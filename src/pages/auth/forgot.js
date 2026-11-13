import { supabaseApi } from '../../api/supabase.js';
import { html, mount } from '../../lib/html.js';
import { t } from '../../lib/i18n.js';
import { icon } from '../../ui/components.js';
import { publicPage, authCard, formError, busy } from '../public/layout.js';

const root = publicPage({
  titleKey: 'auth.forgotTitle',
  body: authCard(html`<h1>${t('auth.forgotTitle')}</h1><p>${t('auth.forgotText')}</p>
    <form novalidate data-forgot>
      <div class="field"><label for="email">${t('auth.email')}</label><input class="input" type="email" id="email" name="email" required autocomplete="email" autofocus></div>
      <button class="btn btn--primary btn--lg btn--block" type="submit">${t('auth.sendLink')}</button>
    </form>
    <div class="auth-links"><a href="/pages/auth/login.html">${icon('arrow-left', { size: 14 })} ${t('auth.backToLogin')}</a></div>`)
});

root.querySelector('[data-forgot]').addEventListener('submit', e => {
  e.preventDefault();
  const form = e.target;
  if (!form.reportValidity()) return;
  busy(form.querySelector('[type=submit]'), async () => {
    try {
      await supabaseApi.requestPasswordReset(form.email.value.trim().toLowerCase(), new URL('/pages/auth/reset-password.html', location.origin).href);
      // Same answer whether or not the account exists (no account enumeration).
      mount(root.querySelector('.auth-card'), html`<div class="empty"><span class="empty__icon">${icon('mail', { size: 22 })}</span>
        <strong>${t('auth.checkEmail')}</strong><p>${t('auth.resetSent')}</p><a class="btn btn--secondary" href="/pages/auth/login.html">${t('auth.backToLogin')}</a></div>`);
    } catch (err) { console.error(err); formError(form, t('error.generic')); }
  });
});
