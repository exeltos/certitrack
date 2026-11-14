// Organization settings: details, notifications, security and leaving CertiTrack.
// One section at a time (tabs), so the page fits the screen.
import { api } from '../../api/index';
import { html, mount, raw } from '../../lib/html';
import { t } from '../../lib/i18n';
import { field, fieldValue } from '../../lib/form';
import { definePage, type PageContext } from '../../app/page';
import { icon, badge, errorState, friendlyError } from '../../ui/components';
import { openDialog, confirmDialog, toast, toastError } from '../../ui/dialog';
import { passwordField, bindPasswordFields, checkNewPassword } from '../../ui/password';
import type { NotificationPreferences, Organization, OrganizationUpdate } from '../../types/domain';

type Tab = 'org' | 'notif' | 'security' | 'closure';
type PrefKey = keyof NotificationPreferences;
type OrgField = keyof OrganizationUpdate;

const PREFS: readonly PrefKey[] = ['in_app_enabled', 'email_enabled', 'expiry_in_app_enabled', 'expiry_email_enabled', 'relationship_notifications', 'partner_certificate_notifications'];
const ORG_FIELDS: readonly OrgField[] = ['legal_name', 'display_name', 'contact_email', 'phone', 'website', 'address_line1', 'city', 'postal_code'];

export default definePage({
  area: 'organization', nav: 'settings', title: 'settings.title', subtitle: 'settings.subtitle',
  render: page => new SettingsPage(page).start()
});

class SettingsPage {
  private readonly canEditOrg: boolean;
  private readonly isOwner: boolean;
  private tab: Tab;

  constructor(private readonly page: PageContext) {
    this.canEditOrg = page.ctx.role === 'owner' || page.ctx.role === 'admin';
    this.isOwner = page.ctx.role === 'owner';
    const hash = location.hash.slice(1);
    this.tab = hash === 'notif' || hash === 'security' || hash === 'closure' ? hash : 'org';
  }

  async start(): Promise<void> {
    const { content } = this.page;
    content.addEventListener('submit', e => { void this.saveOrganization(e); });
    content.addEventListener('change', e => { void this.savePreference(e); });
    content.addEventListener('click', e => { void this.onClick(e); });
    await this.load();
  }

  private async load(): Promise<void> {
    try {
      const [prefs, fresh] = await Promise.all([api.notificationPreferences(), api.context({ fresh: true })]);
      if (this.page.signal.aborted || !fresh?.organization) return;
      this.render(fresh.organization, prefs);
    } catch (err) { console.error(err); mount(this.page.content, errorState(err)); }
  }

  private render(org: Organization, prefs: NotificationPreferences | null): void {
    const { ctx } = this.page;
    const input = (name: OrgField, type = 'text') => html`<div class="field"><label for="o-${name}">${t(`org.${name}`)}</label>
      <input class="input" id="o-${name}" name="${name}" type="${type}" value="${org[name] || ''}" ${this.canEditOrg ? '' : raw('readonly')}></div>`;
    const tabs: [Tab, string][] = [['org', t('settings.orgTitle')], ['notif', t('settings.notifTitle')], ['security', t('settings.securityTitle')]];
    if (this.isOwner) tabs.push(['closure', t('settings.closureTitle')]);
    if (!tabs.some(([k]) => k === this.tab)) this.tab = 'org';
    mount(this.page.content, html`<div class="tabs" role="tablist">${tabs.map(([key, label]) => html`<button type="button" class="tab" role="tab" data-tab="${key}" aria-selected="${String(this.tab === key)}">${label}</button>`)}</div>
    <div class="settings-panels" style="max-width:1100px">
      <section class="card" data-panel="org">
        <div class="card__head"><div><h2>${t('settings.orgTitle')}</h2><p>${t('settings.orgText')}</p></div></div>
        <form class="card__body" data-org-form>
          <div class="form-grid form-grid--2 form-grid--wide-3">
            ${input('legal_name')}${input('display_name')}
            <div class="field"><label for="o-vat">${t('common.vat')}</label><input class="input" id="o-vat" value="${org.vat_number}" readonly><small>${t('settings.vatLocked')}</small></div>
            ${input('contact_email', 'email')}${input('phone', 'tel')}${input('website', 'url')}
            ${input('address_line1')}${input('city')}${input('postal_code')}
          </div>
          ${this.canEditOrg ? html`<div style="margin-top:18px"><button class="btn btn--primary" type="submit">${t('common.save')}</button></div>` : ''}
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

      ${this.isOwner ? html`<section class="card" data-panel="closure">
        <div class="card__head"><div><h2>${t('settings.closureTitle')}</h2><p>${t('settings.closureText')}</p></div></div>
        <div class="card__body">${org.status === 'closure_requested'
          ? html`<div class="pair"><span class="badge badge--warning">${t('settings.closurePending')}</span><button class="btn btn--secondary btn--sm" data-closure-cancel>${t('settings.closureCancel')}</button></div>`
          : html`<button class="btn btn--danger-ghost" data-closure>${t('settings.closureRequest')}</button>`}</div>
      </section>` : ''}
    </div>`);
    this.showTab(this.tab);
  }

  private showTab(key: Tab): void {
    this.tab = key;
    const { content } = this.page;
    content.querySelectorAll<HTMLElement>('[data-panel]').forEach(p => { p.hidden = p.dataset.panel !== key; });
    content.querySelectorAll<HTMLElement>('[data-tab]').forEach(b => b.setAttribute('aria-selected', String(b.dataset.tab === key)));
    history.replaceState(null, '', key === 'org' ? location.pathname : `#${key}`);
  }

  private async saveOrganization(e: SubmitEvent): Promise<void> {
    const form = e.target as HTMLFormElement;
    if (!form.matches('[data-org-form]')) return;
    e.preventDefault();
    const btn = form.querySelector<HTMLButtonElement>('[type=submit]');
    if (btn) btn.disabled = true;
    try {
      const update: OrganizationUpdate = {};
      for (const k of ORG_FIELDS) update[k] = fieldValue(form, k) as never;
      await api.updateOrganization(update);
      toast(t('common.saved'));
    } catch (err) { toastError(err); } finally { if (btn) btn.disabled = false; }
  }

  private async savePreference(e: Event): Promise<void> {
    const sw = (e.target as Element).closest<HTMLInputElement>('[data-pref]');
    if (!sw) return;
    const prefs = Object.fromEntries([...this.page.content.querySelectorAll<HTMLInputElement>('[data-pref]')].map(x => [x.dataset.pref, x.checked])) as NotificationPreferences;
    try { await api.saveNotificationPreferences(prefs); toast(t('common.saved')); } catch (err) { sw.checked = !sw.checked; toastError(err); }
  }

  private async onClick(e: Event): Promise<void> {
    const target = e.target as Element;
    const tabBtn = target.closest<HTMLElement>('[data-tab]');
    if (tabBtn) { this.showTab(tabBtn.dataset.tab as Tab); return; }
    const el = target.closest<HTMLElement>('[data-password],[data-mfa-on],[data-mfa-off],[data-closure],[data-closure-cancel]');
    if (!el) return;
    const { ctx } = this.page;
    try {
      if ('password' in el.dataset) {
        const ok = await openDialog({
          title: t('settings.changePassword'), submitLabel: t('common.save'),
          body: html`${passwordField({ name: 'current', label: t('settings.currentPassword'), autocomplete: 'current-password', autofocus: true })}
            ${passwordField({ name: 'password', label: t('settings.newPassword'), rules: true })}
            ${passwordField({ name: 'confirm', label: t('auth.confirmPassword') })}`,
          onOpen: form => bindPasswordFields(form),
          async onSubmit(form) { await api.changePassword(field(form, 'current').value, checkNewPassword(form)); return true; }
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
          async onSubmit(form) { await api.mfaConfirm(enrolled.id, fieldValue(form, 'code')); return true; }
        });
        if (!ok) await api.mfaDisable(enrolled.id).catch(() => {});
        else { toast(t('settings.mfaEnabled')); setTimeout(() => location.reload(), 600); }
      } else if ('mfaOff' in el.dataset) {
        if (ctx.mfaFactor && await confirmDialog({ title: t('settings.mfaDisable'), text: t('settings.mfaDisableText'), confirmLabel: t('settings.mfaDisable'), danger: true })) {
          await api.mfaDisable(ctx.mfaFactor.id); toast(t('settings.mfaDisabled')); setTimeout(() => location.reload(), 600);
        }
      } else if ('closure' in el.dataset) {
        const ok = await openDialog({
          title: t('settings.closureRequest'), submitLabel: t('settings.closureRequest'), danger: true,
          body: html`<p class="muted">${t('settings.closureConfirm')}</p><div class="field"><label for="reason">${t('settings.closureReason')}</label><textarea class="textarea" id="reason" name="reason" rows="3" maxlength="1000"></textarea></div>`,
          async onSubmit(form) { await api.requestClosure(fieldValue(form, 'reason')); return true; }
        });
        if (ok) { toast(t('settings.closureRequested')); void this.load(); }
      } else if ('closureCancel' in el.dataset) {
        await api.cancelClosure(); toast(t('settings.closureCancelled')); void this.load();
      }
    } catch (err) { toast(friendlyError(err), 'error'); }
  }
}
