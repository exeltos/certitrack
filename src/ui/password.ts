// Password input with show/hide and a live checklist of the password policy.
import { html, raw, type SafeHtml } from '../lib/html';
import { t } from '../lib/i18n';
import { icon } from './components';
import { UserError } from './dialog';
import { validatePassword, PASSWORD_RULES, type PasswordRule } from '../auth/passwordPolicy';

export function passwordField({ name, id = name, label, autocomplete = 'new-password', rules = false, autofocus = false }:
  { name: string; id?: string; label: string; autocomplete?: string; rules?: boolean; autofocus?: boolean }): SafeHtml {
  return html`<div class="field"><label for="${id}">${label}</label>
    <div class="password-wrap"><input class="input" type="password" id="${id}" name="${name}" required autocomplete="${autocomplete}" ${autofocus ? raw('autofocus') : ''}>
      <button type="button" class="icon-btn" data-reveal="${id}" aria-label="${t('auth.showPassword')}" title="${t('auth.showPassword')}">${icon('eye', { size: 16 })}</button></div>
    ${rules ? html`<ul class="pw-rules" data-rules="${id}">${PASSWORD_RULES.map(k => html`<li data-rule="${k}">${icon('check', { size: 14 })}${t(`pw.${k}`)}</li>`)}</ul>` : ''}
  </div>`;
}

export function bindPasswordFields(root: ParentNode): void {
  root.querySelectorAll<HTMLElement>('[data-reveal]').forEach(btn => btn.addEventListener('click', () => {
    const input = root.querySelector<HTMLInputElement>(`#${btn.dataset.reveal}`);
    if (input) input.type = input.type === 'password' ? 'text' : 'password';
  }));
  root.querySelectorAll<HTMLElement>('[data-rules]').forEach(list => {
    const input = root.querySelector<HTMLInputElement>(`#${list.dataset.rules}`);
    if (!input) return;
    const update = () => {
      const { checks } = validatePassword(input.value);
      list.querySelectorAll<HTMLElement>('[data-rule]').forEach(li => li.classList.toggle('ok', !!checks[li.dataset.rule as PasswordRule]));
    };
    input.addEventListener('input', update); update();
  });
}

/** Returns the new password from the form, or throws a UserError explaining what is wrong. */
export function checkNewPassword(form: HTMLFormElement, field = 'password', confirm: string | null = 'confirm'): string {
  const value = (name: string) => (form.elements.namedItem(name) as HTMLInputElement | null)?.value ?? '';
  const pw = value(field);
  if (!validatePassword(pw).valid) throw new UserError(t('pw.weak'));
  if (confirm && pw !== value(confirm)) throw new UserError(t('pw.mismatch'));
  return pw;
}
