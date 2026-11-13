import { UserError } from './dialog';
// Password input with show/hide and live policy checklist.
import { html, raw } from '../lib/html';
import { t } from '../lib/i18n';
import { icon } from './components';
import { validatePassword } from '../auth/passwordPolicy';

export function passwordField({ name, id = name, label, autocomplete = 'new-password', rules = false, autofocus = false }) {
  return html`<div class="field"><label for="${id}">${label}</label>
    <div class="password-wrap"><input class="input" type="password" id="${id}" name="${name}" required autocomplete="${autocomplete}" ${autofocus ? raw('autofocus') : ''}>
      <button type="button" class="icon-btn" data-reveal="${id}" aria-label="${t('auth.showPassword')}" title="${t('auth.showPassword')}">${icon('eye', { size: 16 })}</button></div>
    ${rules ? html`<ul class="pw-rules" data-rules="${id}">${['length', 'upper', 'lower', 'number', 'symbol'].map(k => html`<li data-rule="${k}">${icon('check', { size: 14 })}${t(`pw.${k}`)}</li>`)}</ul>` : ''}
  </div>`;
}

export function bindPasswordFields(root) {
  root.querySelectorAll('[data-reveal]').forEach(btn => btn.addEventListener('click', () => {
    const input = root.querySelector(`#${btn.dataset.reveal}`);
    input.type = input.type === 'password' ? 'text' : 'password';
  }));
  root.querySelectorAll('[data-rules]').forEach(list => {
    const input = root.querySelector(`#${list.dataset.rules}`);
    const update = () => { const { checks } = validatePassword(input.value); list.querySelectorAll('[data-rule]').forEach(li => li.classList.toggle('ok', !!checks[li.dataset.rule])); };
    input.addEventListener('input', update); update();
  });
}

export function checkNewPassword(form, field = 'password', confirm = 'confirm') {
  const pw = form[field].value;
  if (!validatePassword(pw).valid) throw new UserError(t('pw.weak'));
  if (confirm && pw !== form[confirm].value) throw new UserError(t('pw.mismatch'));
  return pw;
}
