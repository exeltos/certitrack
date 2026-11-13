import { endDemo } from '../../api/index';
import { supabaseApi } from '../../api/supabase';
import { html } from '../../lib/html';
import { t } from '../../lib/i18n';
import { friendlyError } from '../../ui/components';
import { openDialog } from '../../ui/dialog';
import { passwordField, bindPasswordFields } from '../../ui/password';
import { publicPage, authCard, formError, busy } from '../public/layout';
import { PATHS } from '../../ui/shell';

const root = publicPage({
  titleKey: 'auth.signInTitle',
  body: authCard(html`<h1>${t('auth.signInTitle')}</h1><p>${t('auth.signInText')}</p>
    <form novalidate data-login>
      <div class="field"><label for="email">${t('auth.email')}</label><input class="input" type="email" id="email" name="email" required autocomplete="username" autofocus></div>
      ${passwordField({ name: 'password', label: t('auth.password'), autocomplete: 'current-password' })}
      <button class="btn btn--primary btn--lg btn--block" type="submit">${t('auth.signIn')}</button>
    </form>
    <div class="auth-links"><a href="/pages/auth/forgot.html">${t('auth.forgot')}</a><a href="/pages/auth/register.html">${t('auth.noAccount')}</a></div>`)
});
bindPasswordFields(root);

async function askMfaCode(factorId) {
  return openDialog({
    title: t('auth.mfaTitle'), description: t('auth.mfaText'), submitLabel: t('common.confirm'),
    body: html`<div class="field"><label for="code">${t('settings.mfaCode')}</label><input class="input" id="code" name="code" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" maxlength="6" required autofocus></div>`,
    async onSubmit(form) { await supabaseApi.mfaVerifyLogin(factorId, form.code.value.trim()); return true; }
  });
}

root.querySelector('[data-login]').addEventListener('submit', e => {
  e.preventDefault();
  const form = e.target;
  formError(form, '');
  if (!form.reportValidity()) return;
  busy(form.querySelector('[type=submit]'), async () => {
    try {
      endDemo();
      await supabaseApi.signIn(form.email.value.trim().toLowerCase(), form.password.value);
      const mfa = await supabaseApi.mfaStatus();
      if (mfa.needsCode && mfa.factor && !(await askMfaCode(mfa.factor.id))) { await supabaseApi.signOut(); return; }
      const ctx = await supabaseApi.context({ fresh: true });
      const next = new URLSearchParams(location.search).get('next');
      const safeNext = next && next.startsWith('/pages/') ? next : null;
      location.href = safeNext || (ctx?.organization ? PATHS.orgHome : ctx?.isAdmin ? PATHS.adminHome : PATHS.orgHome);
    } catch (err) {
      console.error(err);
      form.password.value = '';
      formError(form, friendlyError(err));
    }
  });
});
