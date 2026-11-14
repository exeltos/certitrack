// Sign in (with the second factor when the account has one).
import { endDemo } from '../../api/index';
import { supabaseApi } from '../../api/supabase';
import { html } from '../../lib/html';
import { t } from '../../lib/i18n';
import { field, fieldValue } from '../../lib/form';
import { friendlyError } from '../../ui/components';
import { openDialog } from '../../ui/dialog';
import { PATHS } from '../../ui/chrome';
import { passwordField, bindPasswordFields } from '../../ui/password';
import { publicPage, authCard, formError, busy } from '../public/layout';

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

async function askMfaCode(factorId: string): Promise<boolean> {
  const ok = await openDialog({
    title: t('auth.mfaTitle'), description: t('auth.mfaText'), submitLabel: t('common.confirm'),
    body: html`<div class="field"><label for="code">${t('settings.mfaCode')}</label><input class="input" id="code" name="code" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" maxlength="6" required autofocus></div>`,
    async onSubmit(form) { await supabaseApi.mfaVerifyLogin(factorId, fieldValue(form, 'code')); return true; }
  });
  return ok === true;
}

/** Only our own app pages are allowed as the place to go after signing in. */
function nextPage(): string | null {
  const next = new URLSearchParams(location.search).get('next');
  return next && next.startsWith('/pages/') && !next.startsWith('//') ? next : null;
}

root.querySelector<HTMLFormElement>('[data-login]')!.addEventListener('submit', e => {
  e.preventDefault();
  const form = e.currentTarget as HTMLFormElement;
  formError(form, '');
  if (!form.reportValidity()) return;
  void busy(form.querySelector('[type=submit]'), async () => {
    try {
      endDemo();
      await supabaseApi.signIn(fieldValue(form, 'email').toLowerCase(), field(form, 'password').value);
      const mfa = await supabaseApi.mfaStatus();
      if (mfa.needsCode && mfa.factor && !(await askMfaCode(mfa.factor.id))) { await supabaseApi.signOut(); return; }
      const ctx = await supabaseApi.context({ fresh: true });
      location.href = nextPage() || (ctx?.organization ? PATHS.orgHome : ctx?.isAdmin ? PATHS.adminHome : PATHS.orgHome);
    } catch (err) {
      console.error(err);
      field(form, 'password').value = '';
      formError(form, friendlyError(err));
    }
  });
});
