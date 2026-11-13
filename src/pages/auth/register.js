import { supabaseApi } from '../../api/supabase.js';
import { endDemo } from '../../api/index.js';
import { html, mount } from '../../lib/html.js';
import { t } from '../../lib/i18n.js';
import { icon, friendlyError } from '../../ui/components.js';
import { passwordField, bindPasswordFields, checkNewPassword } from '../../ui/password.js';
import { publicPage, authCard, formError, busy } from '../public/layout.js';
import { normalizeVat } from '../../lib/format.js';

const root = publicPage({
  titleKey: 'auth.registerTitle',
  body: authCard(html`<h1>${t('auth.registerTitle')}</h1><p>${t('auth.registerText')}</p>
    <form novalidate data-register>
      <div class="form-grid form-grid--2">
        <div class="field span-2"><label for="name">${t('auth.orgName')}</label><input class="input" id="name" name="name" required maxlength="200" autocomplete="organization" autofocus></div>
        <div class="field"><label for="vat">${t('common.vat')}</label><input class="input" id="vat" name="vat" required inputmode="numeric" maxlength="12" placeholder="123456789"><small>${t('auth.vatHint')}</small></div>
        <div class="field"><label for="email">${t('auth.workEmail')}</label><input class="input" type="email" id="email" name="email" required autocomplete="email"></div>
        <div class="span-2">${passwordField({ name: 'password', label: t('auth.password'), rules: true })}</div>
        <div class="span-2">${passwordField({ name: 'confirm', label: t('auth.confirmPassword') })}</div>
        <label class="check span-2"><input type="checkbox" name="terms" required><span>${t('auth.terms')}</span></label>
      </div>
      <button class="btn btn--primary btn--lg btn--block" type="submit">${t('auth.createAccount')}</button>
    </form>
    <div class="auth-links"><span class="muted">${t('auth.haveAccount')}</span><a href="/pages/auth/login.html">${t('auth.signIn')}</a></div>`, true)
});
bindPasswordFields(root);

root.querySelector('[data-register]').addEventListener('submit', e => {
  e.preventDefault();
  const form = e.target;
  formError(form, '');
  busy(form.querySelector('[type=submit]'), async () => {
    try {
      const vat = normalizeVat(form.vat.value);
      if (!form.name.value.trim() || !form.email.value.trim()) throw Object.assign(new Error('x'), { userMessage: t('auth.fillAll') });
      if (!/^\d{9}$/.test(vat)) throw Object.assign(new Error('x'), { userMessage: t('auth.vatInvalid') });
      if (!form.email.checkValidity()) throw Object.assign(new Error('x'), { userMessage: t('auth.emailInvalid') });
      const password = checkNewPassword(form);
      if (!form.terms.checked) throw Object.assign(new Error('x'), { userMessage: t('auth.acceptTerms') });
      endDemo();
      await supabaseApi.signUp({ email: form.email.value.trim().toLowerCase(), password, name: form.name.value.trim(), vat,
        redirectTo: new URL('/pages/auth/login.html', location.origin).href });
      mount(root.querySelector('.auth-card'), html`<div class="empty"><span class="empty__icon">${icon('mail', { size: 22 })}</span>
        <strong>${t('auth.checkEmail')}</strong><p>${t('auth.checkEmailText', { email: form.email.value.trim() })}</p>
        <a class="btn btn--secondary" href="/pages/auth/login.html">${t('auth.signIn')}</a></div>`);
    } catch (err) {
      console.error(err);
      formError(form, err.userMessage || friendlyError(err));
    }
  });
});
