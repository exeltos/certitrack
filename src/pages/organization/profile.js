import { api } from '../../api/index';
import { html, mount, raw } from '../../lib/html';
import { t } from '../../lib/i18n';
import { startPage } from '../../ui/shell';
import { icon, badge, errorState, friendlyError } from '../../ui/components';
import { openDialog, confirmDialog, toast, toastError } from '../../ui/dialog';
import { passwordField, bindPasswordFields, checkNewPassword } from '../../ui/password';

const { ctx, content } = await startPage({ area: 'organization', page: 'settings', title: 'settings.title', subtitle: 'settings.subtitle' });
const canEditOrg = ['owner', 'admin'].includes(ctx.role);
const isOwner = ctx.role === 'owner';
const PREFS = ['in_app_enabled', 'email_enabled', 'expiry_in_app_enabled', 'expiry_email_enabled', 'relationship_notifications', 'partner_certificate_notifications'];

function render(org, prefs) {
  const field = (name, type = 'text', span = false) => html`<div class="field ${span ? 'span-2' : ''}"><label for="o-${name}">${t(`org.${name}`)}</label>
    <input class="input" id="o-${name}" name="${name}" type="${type}" value="${org[name] || ''}" ${canEditOrg ? '' : raw('readonly')}></div>`;
  const tabs = [['org', t('settings.orgTitle')], ['notif', t('settings.notifTitle')], ['security', t('settings.securityTitle')],
    ...(isOwner ? [['closure', t('settings.closureTitle')]] : [])];
  if (!tabs.some(([k]) => k === tab)) tab = 'org';
  // One section at a time, so the page fits the screen.
  mount(content, html`<div class="tabs" role="tablist">${tabs.map(([key, label]) => html`<button type="button" class="tab" role="tab" data-tab="${key}" aria-selected="${tab === key}">${label}</button>`)}</div>
  <div class="settings-panels" style="max-width:1100px">
    <section class="card" data-panel="org">
      <div class="card__head"><div><h2>${t('settings.orgTitle')}</h2><p>${t('settings.orgText')}</p></div></div>
      <form class="card__body" data-org-form>
        <div class="form-grid form-grid--2 form-grid--wide-3">
          ${field('legal_name')}${field('display_name')}
          <div class="field"><label for="o-vat">${t('common.vat')}</label><input class="input" id="o-vat" value="${org.vat_number}" readonly><small>${t('settings.vatLocked')}</small></div>
          ${field('contact_email', 'email')}${field('phone', 'tel')}${field('website', 'url')}
          ${field('address_line1')}${field('city')}${field('postal_code')}
        </div>
        ${canEditOrg ? html`<div style="margin-top:18px"><button class="btn btn--primary" type="submit">${t('common.save')}</button></div>` : ''}
      </form>
    </section>

    <section class="card" data-panel="notif">
      <div class="card__head"><div><h2>${t('settings.notifTitle')}</h2><p>${t('settings.notifText')}</p></div></div>
      <div class="card__body" style="padding-top:4px;padding-bottom:4px" data-prefs>
        ${PREFS.map(k => html`<label class="switch-row"><span><strong>${t(`prefs.${k}`)}</strong><small>${t(`prefs.${k}.help`)}</small></span>
          <span class="switch"><input type="checkbox" data-pref="${k}" ${prefs?.[k] ? raw('checked') : ''}><i></i></span></label>`)}
      </div>
    </section>

    <section class="card" data-panel="security">
      <div class="card__head"><div><h2>${t('settings.securityTitle')}</h2><p>${ctx.user.email}</p></div></div>
      <div class="card__body" style="padding-top:4px;padding-bottom:4px">
        <div class="switch-row"><span><strong>${t('settings.password')}</strong><small>${t('settings.passwordHelp')}</small></span>
          <button class="btn btn--secondary btn--sm" data-password>${icon('key-round', { size: 16 })}${t('settings.changePassword')}</button></div>
        <div class="switch-row"><span><strong>${t('settings.mfa')} ${ctx.mfaFactor ? badge('success', t('settings.mfaOn')) : ''}</strong><small>${t('settings.mfaHelp')}</small></span>
          ${ctx.mfaFactor ? html`<button class="btn btn--danger-ghost btn--sm" data-mfa-off>${t('settings.mfaDisable')}</button>`
            : html`<button class="btn btn--secondary btn--sm" data-mfa-on>${icon('shield-check', { size: 16 })}${t('settings.mfaEnable')}</button>`}</div>
      </div>
    </section>

    ${isOwner ? html`<section class="card" data-panel="closure">
      <div class="card__head"><div><h2>${t('settings.closureTitle')}</h2><p>${t('settings.closureText')}</p></div></div>
      <div class="card__body">${org.status === 'closure_requested'
        ? html`<div class="pair"><span class="badge badge--warning">${t('settings.closurePending')}</span><button class="btn btn--secondary btn--sm" data-closure-cancel>${t('settings.closureCancel')}</button></div>`
        : html`<button class="btn btn--danger-ghost" data-closure>${t('settings.closureRequest')}</button>`}</div>
    </section>` : ''}
  </div>`);
  showTab(tab);
}

let tab = location.hash.slice(1) || 'org';
function showTab(key) {
  tab = key;
  content.querySelectorAll('[data-panel]').forEach(p => { p.hidden = p.dataset.panel !== key; });
  content.querySelectorAll('[data-tab]').forEach(b => b.setAttribute('aria-selected', String(b.dataset.tab === key)));
  history.replaceState(null, '', key === 'org' ? location.pathname : `#${key}`);
}

async function load() {
  try {
    const [prefs] = await Promise.all([api.notificationPreferences()]);
    const fresh = await api.context({ fresh: true });
    render(fresh.organization, prefs);
  } catch (err) { console.error(err); mount(content, errorState(err)); }
}

content.addEventListener('submit', async e => {
  if (!e.target.matches('[data-org-form]')) return;
  e.preventDefault();
  const form = e.target, btn = form.querySelector('[type=submit]');
  btn.disabled = true;
  try {
    await api.updateOrganization(Object.fromEntries(['legal_name', 'display_name', 'contact_email', 'phone', 'website', 'address_line1', 'city', 'postal_code'].map(k => [k, form[k].value.trim()])));
    toast(t('common.saved'));
  } catch (err) { toastError(err); } finally { btn.disabled = false; }
});

content.addEventListener('change', async e => {
  const sw = e.target.closest('[data-pref]');
  if (!sw) return;
  const prefs = Object.fromEntries([...content.querySelectorAll('[data-pref]')].map(x => [x.dataset.pref, x.checked]));
  try { await api.saveNotificationPreferences(prefs); toast(t('common.saved')); } catch (err) { sw.checked = !sw.checked; toastError(err); }
});

content.addEventListener('click', async e => {
  const tabBtn = e.target.closest('[data-tab]');
  if (tabBtn) { showTab(tabBtn.dataset.tab); return; }
  const el = e.target.closest('[data-password],[data-mfa-on],[data-mfa-off],[data-closure],[data-closure-cancel]');
  if (!el) return;
  try {
    if ('password' in el.dataset) {
      const ok = await openDialog({
        title: t('settings.changePassword'), submitLabel: t('common.save'),
        body: html`${passwordField({ name: 'current', label: t('settings.currentPassword'), autocomplete: 'current-password', autofocus: true })}
          ${passwordField({ name: 'password', label: t('settings.newPassword'), rules: true })}
          ${passwordField({ name: 'confirm', label: t('auth.confirmPassword') })}`,
        onOpen: form => bindPasswordFields(form),
        async onSubmit(form) { await api.changePassword(form.current.value, checkNewPassword(form)); return true; }
      });
      if (ok) toast(t('settings.passwordChanged'));
    } else if ('mfaOn' in el.dataset) {
      const enrolled = await api.mfaEnroll();
      const ok = await openDialog({
        title: t('settings.mfaEnable'), description: t('settings.mfaScan'), submitLabel: t('settings.mfaConfirm'),
        body: html`<div class="pair" style="align-items:flex-start"><img class="qr" src="${enrolled.totp.qr_code}" alt="QR">
          <div class="field" style="flex:1;min-width:200px"><span class="field-label">${t('settings.mfaManual')}</span><code class="secret">${enrolled.totp.secret}</code>
          <label for="mfa-code" style="margin-top:12px" class="field-label">${t('settings.mfaCode')}</label>
          <input class="input" id="mfa-code" name="code" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" maxlength="6" required autofocus></div></div>`,
        async onSubmit(form) { await api.mfaConfirm(enrolled.id, form.code.value.trim()); return true; }
      });
      if (!ok) await api.mfaDisable(enrolled.id).catch(() => {});
      else { toast(t('settings.mfaEnabled')); setTimeout(() => location.reload(), 600); }
    } else if ('mfaOff' in el.dataset) {
      if (await confirmDialog({ title: t('settings.mfaDisable'), text: t('settings.mfaDisableText'), confirmLabel: t('settings.mfaDisable'), danger: true })) {
        await api.mfaDisable(ctx.mfaFactor.id); toast(t('settings.mfaDisabled')); setTimeout(() => location.reload(), 600);
      }
    } else if ('closure' in el.dataset) {
      const ok = await openDialog({
        title: t('settings.closureRequest'), submitLabel: t('settings.closureRequest'), danger: true,
        body: html`<p class="muted">${t('settings.closureConfirm')}</p><div class="field"><label for="reason">${t('settings.closureReason')}</label><textarea class="textarea" id="reason" name="reason" rows="3" maxlength="1000"></textarea></div>`,
        async onSubmit(form) { await api.requestClosure(form.reason.value.trim()); return true; }
      });
      if (ok) { toast(t('settings.closureRequested')); load(); }
    } else if ('closureCancel' in el.dataset) {
      await api.cancelClosure(); toast(t('settings.closureCancelled')); load();
    }
  } catch (err) { toast(friendlyError(err), 'error'); }
});

load();
