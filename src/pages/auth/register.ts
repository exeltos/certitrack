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

// ?join=1&email=… comes from a team invitation email: the colleague only
// chooses a password and joins the organization that invited them.
const params = new URLSearchParams(location.search);
const joining = params.get('join') === '1';
const invitedEmail = params.get('email') ?? '';

const signUpForm = html`<h1>${t('auth.registerTitle')}</h1><p>${t('auth.registerText')}</p>
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
    <div class="auth-links"><span class="muted">${t('auth.haveAccount')}</span><a href="/pages/auth/login.html">${t('auth.signIn')}</a></div>`;

const joinForm = html`<h1>${t('auth.joinTitle')}</h1><p>${t('auth.joinText')}</p>
    <form novalidate data-register>
      <div class="field"><label for="email">${t('auth.email')}</label><input class="input" type="email" id="email" name="email" required autocomplete="email" value="${invitedEmail}"><small>${t('auth.joinEmailHint')}</small></div>
      ${passwordField({ name: 'password', label: t('auth.password'), rules: true, autofocus: true })}
      ${passwordField({ name: 'confirm', label: t('auth.confirmPassword') })}
      <label class="check"><input type="checkbox" name="terms" required><span>${t('auth.terms')}</span></label>
      <button class="btn btn--primary btn--lg btn--block" type="submit">${t('auth.joinButton')}</button>
    </form>
    <div class="auth-links"><span class="muted">${t('auth.haveAccount')}</span><a href="/pages/auth/login.html">${t('auth.signIn')}</a></div>`;

const root = publicPage({
  titleKey: joining ? 'auth.joinTitle' : 'auth.registerTitle',
  body: authCard(joining ? joinForm : signUpForm, !joining)
});
bindPasswordFields(root);

root.querySelector<HTMLFormElement>('[data-register]')!.addEventListener('submit', e => {
  e.preventDefault();
  const form = e.currentTarget as HTMLFormElement;
  formError(form, '');
  void busy(form.querySelector('[type=submit]'), async () => {
    try {
      const email = fieldValue(form, 'email');
      if (!email) throw new UserError(t('auth.fillAll'));
      if (!field(form, 'email').checkValidity()) throw new UserError(t('auth.emailInvalid'));
      const password = checkNewPassword(form);
      if (!field(form, 'terms').checked) throw new UserError(t('auth.acceptTerms'));
      endDemo();
      const redirectTo = new URL('/pages/auth/login.html', location.origin).href;
      if (joining) {
        try {
          await supabaseApi.joinTeam({ email: email.toLowerCase(), password, redirectTo });
        } catch (err) {
          // The sign-up service hides the database's reason; without an
          // invitation for this email it is the only one that applies.
          if (/database error saving new user/i.test(err instanceof Error ? err.message : '')) throw new UserError(t('error.teamNoInvitation'));
          throw err;
        }
      } else {
        const name = fieldValue(form, 'name');
        const vat = normalizeVat(fieldValue(form, 'vat'));
        if (!name) throw new UserError(t('auth.fillAll'));
        if (!/^\d{9}$/.test(vat)) throw new UserError(t('auth.vatInvalid'));
        await supabaseApi.signUp({ email: email.toLowerCase(), password, name, vat, redirectTo });
      }
      mount(root.querySelector('.auth-card'), html`<div class="empty"><span class="empty__icon">${icon('mail', { size: 22 })}</span>
        <strong>${t('auth.checkEmail')}</strong><p>${t('auth.checkEmailText', { email })}</p>
        <a class="btn btn--secondary" href="/pages/auth/login.html">${t('auth.signIn')}</a></div>`);
    } catch (err) {
      console.error(err);
      formError(form, err instanceof UserError ? err.userMessage : friendlyError(err));
    }
  });
});
