// Create an organization account.
import { supabaseApi } from '../../api/supabase';
import { endDemo } from '../../api/index';
import { html, mount } from '../../lib/html';
import { t } from '../../lib/i18n';
import { normalizeVat } from '../../lib/format';
import { field, fieldValue } from '../../lib/form';
import { icon, friendlyError } from '../../ui/components';
import { UserError } from '../../ui/dialog';
import { passwordField, bindPasswordFields, checkNewPassword } from '../../ui/password';
import { publicPage, authCard, formError, busy } from '../public/layout';

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

root.querySelector<HTMLFormElement>('[data-register]')!.addEventListener('submit', e => {
  e.preventDefault();
  const form = e.currentTarget as HTMLFormElement;
  formError(form, '');
  void busy(form.querySelector('[type=submit]'), async () => {
    try {
      const name = fieldValue(form, 'name'), email = fieldValue(form, 'email');
      const vat = normalizeVat(fieldValue(form, 'vat'));
      if (!name || !email) throw new UserError(t('auth.fillAll'));
      if (!/^\d{9}$/.test(vat)) throw new UserError(t('auth.vatInvalid'));
      if (!field(form, 'email').checkValidity()) throw new UserError(t('auth.emailInvalid'));
      const password = checkNewPassword(form);
      if (!field(form, 'terms').checked) throw new UserError(t('auth.acceptTerms'));
      endDemo();
      await supabaseApi.signUp({ email: email.toLowerCase(), password, name, vat,
        redirectTo: new URL('/pages/auth/login.html', location.origin).href });
      mount(root.querySelector('.auth-card'), html`<div class="empty"><span class="empty__icon">${icon('mail', { size: 22 })}</span>
        <strong>${t('auth.checkEmail')}</strong><p>${t('auth.checkEmailText', { email })}</p>
        <a class="btn btn--secondary" href="/pages/auth/login.html">${t('auth.signIn')}</a></div>`);
    } catch (err) {
      console.error(err);
      formError(form, err instanceof UserError ? err.userMessage : friendlyError(err));
    }
  });
});
