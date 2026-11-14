// Organization settings: details, notifications, security and leaving CertiTrack.
// One section at a time (tabs), so the page fits the screen.
import { api } from '../../api/index';
import { html, mount, raw } from '../../lib/html';
import { t } from '../../lib/i18n';
import { field, fieldValue } from '../../lib/form';
import { definePage, type PageContext } from '../../app/page';
import { icon, badge, avatar, errorState, friendlyError } from '../../ui/components';
import { formatDate } from '../../lib/format';
import { openDialog, confirmDialog, toast, toastError } from '../../ui/dialog';
import { passwordField, bindPasswordFields, checkNewPassword } from '../../ui/password';
import { isTeamAdmin, type MemberRole, type NotificationPreferences, type Organization, type OrganizationUpdate, type Team, type TeamRole } from '../../types/domain';

type Tab = 'org' | 'team' | 'notif' | 'security' | 'closure';
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
  private readonly isAdmin: boolean;
  private org!: Organization;
  private team: Team = { members: [], invitations: [] };
  private tab: Tab;

  constructor(private readonly page: PageContext) {
    this.canEditOrg = page.ctx.role === 'owner' || page.ctx.role === 'admin';
    this.isAdmin = isTeamAdmin(page.ctx.role);
    const hash = location.hash.slice(1);
    this.tab = hash === 'team' || hash === 'notif' || hash === 'security' || hash === 'closure' ? hash : 'org';
  }

  async start(): Promise<void> {
    const { content } = this.page;
    content.addEventListener('submit', e => { void this.saveOrganization(e); });
    content.addEventListener('change', e => { void this.savePreference(e); void this.changeRole(e); });
    content.addEventListener('click', e => { void this.onClick(e); });
    await this.load();
  }

  private async load(): Promise<void> {
    try {
      const [prefs, fresh, team] = await Promise.all([api.notificationPreferences(), api.context({ fresh: true }), api.team()]);
      this.team = team;
      if (this.page.signal.aborted || !fresh?.organization) return;
      this.render(fresh.organization, prefs);
    } catch (err) { console.error(err); mount(this.page.content, errorState(err)); }
  }

  private render(org: Organization, prefs: NotificationPreferences | null): void {
    const { ctx } = this.page;
    const input = (name: OrgField, type = 'text') => html`<div class="field"><label for="o-${name}">${t(`org.${name}`)}</label>
      <input class="input" id="o-${name}" name="${name}" type="${type}" value="${org[name] || ''}" ${this.canEditOrg ? '' : raw('readonly')}></div>`;
    this.org = org;
    const tabs: [Tab, string][] = [['org', t('settings.orgTitle')], ['team', t('team.tab')], ['notif', t('settings.notifTitle')], ['security', t('settings.securityTitle')]];
    if (this.isAdmin) tabs.push(['closure', t('settings.closureTitle')]);
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

      <section class="card" data-panel="team"></section>

      ${this.isAdmin ? html`<section class="card" data-panel="closure">
        <div class="card__head"><div><h2>${t('settings.closureTitle')}</h2><p>${t('settings.closureText')}</p></div></div>
        <div class="card__body">${org.status === 'closure_requested'
          ? html`<div class="pair"><span class="badge badge--warning">${t('settings.closurePending')}</span><button class="btn btn--secondary btn--sm" data-closure-cancel>${t('settings.closureCancel')}</button></div>`
          : html`<button class="btn btn--danger-ghost" data-closure>${t('settings.closureRequest')}</button>`}</div>
      </section>` : ''}
    </div>`);
    this.renderTeam();
    this.showTab(this.tab);
  }

  // ---------------------------------------------------------------- team
  private renderTeam(): void {
    const panel = this.page.content.querySelector<HTMLElement>('[data-panel="team"]');
    if (!panel) return;
    const { members, invitations } = this.team;
    const levelOf = (role: MemberRole): TeamRole => (isTeamAdmin(role) ? 'admin' : 'member');
    mount(panel, html`
      <div class="card__head"><div><h2>${t('team.title')}</h2><p>${t('team.text', { org: this.org.name })}</p></div>
        ${this.isAdmin ? html`<button type="button" class="btn btn--primary btn--sm" data-team-invite>${icon('user-plus', { size: 16 })}${t('team.invite')}</button>` : ''}</div>
      <div class="card__body team-body">
        <div class="team-roles">
          ${(['admin', 'member'] as const).map(r => html`<div><strong>${icon(r === 'admin' ? 'shield-check' : 'users', { size: 16 })}${t(`team.role.${r}`)}</strong><small>${t(`team.role.${r}.help`)}</small></div>`)}
        </div>
        <ul class="rows">${members.map(m => html`<li class="row">
          ${avatar(m.email)}
          <div class="row__main"><span class="row__title">${m.email}${m.is_me ? html` <span class="badge badge--neutral">${t('team.you')}</span>` : ''}</span>
            <span class="row__meta"><span>${m.status === 'pending_verification' ? t('team.pendingEmail') : t('team.since', { date: formatDate(m.joined_at) })}</span></span></div>
          <div class="row__side">${this.isAdmin && !m.is_me
            ? html`<select class="select select--sm" data-team-role="${m.user_id}" aria-label="${t('team.levelOf', { email: m.email })}">
                ${(['admin', 'member'] as const).map(r => html`<option value="${r}" ${levelOf(m.role) === r ? raw('selected') : ''}>${t(`team.role.${r}`)}</option>`)}</select>
                <button type="button" class="icon-btn icon-btn--sm" data-team-remove="${m.user_id}" data-email="${m.email}" title="${t('team.remove')}" aria-label="${t('team.remove')}: ${m.email}">${icon('trash')}</button>`
            : badge(levelOf(m.role) === 'admin' ? 'accent' : 'neutral', t(`team.role.${levelOf(m.role)}`))}</div></li>`)}</ul>
        ${invitations.length ? html`<div class="section-label">${t('team.invitations')}</div>
          <ul class="rows">${invitations.map(i => html`<li class="row"><span class="row__icon">${icon('mail')}</span>
            <div class="row__main"><span class="row__title">${i.email}</span>
              <span class="row__meta"><span>${t('team.invitedOn', { date: formatDate(i.created_at), expires: formatDate(i.expires_at) })}</span></span></div>
            <div class="row__side">${badge('neutral', t(`team.role.${i.role}`))}
              ${this.isAdmin ? html`<button type="button" class="btn btn--sm btn--ghost" data-invite-resend="${i.email}" data-role="${i.role}">${t('team.resend')}</button>
                <button type="button" class="icon-btn icon-btn--sm" data-invite-cancel="${i.id}" title="${t('team.cancelInvite')}" aria-label="${t('team.cancelInvite')}: ${i.email}">${icon('x')}</button>` : ''}</div></li>`)}</ul>` : ''}
        ${this.isAdmin ? '' : html`<p class="hint">${t('team.onlyAdmins')}</p>`}
      </div>`);
  }

  private async reloadTeam(): Promise<void> {
    this.team = await api.team();
    if (!this.page.signal.aborted) this.renderTeam();
  }

  private async invite(): Promise<void> {
    let sentTo = '';
    const ok = await openDialog({
      title: t('team.inviteTitle'), description: t('team.inviteText'), submitLabel: t('team.invite'),
      body: html`<div class="field"><label for="ti-email">${t('team.email')}</label><input class="input" id="ti-email" name="email" type="email" required maxlength="254" autocomplete="off" autofocus></div>
        <fieldset class="field" style="border:0;padding:0;margin:0"><legend class="field-label" style="margin-bottom:6px">${t('team.level')}</legend>
          <div class="choices">${(['member', 'admin'] as const).map(r => html`<label class="choice"><input type="radio" name="role" value="${r}" ${r === 'member' ? raw('checked') : ''}>
            ${icon(r === 'admin' ? 'shield-check' : 'users')}<span><strong>${t(`team.role.${r}`)}</strong><small>${t(`team.role.${r}.help`)}</small></span></label>`)}</div></fieldset>`,
      async onSubmit(form) {
        sentTo = fieldValue(form, 'email').toLowerCase();
        const role = (form.querySelector<HTMLInputElement>('input[name=role]:checked')?.value === 'admin' ? 'admin' : 'member') as TeamRole;
        await api.inviteTeamMember(sentTo, role);
        return true;
      }
    });
    if (ok) { toast(t('team.invited', { email: sentTo })); await this.reloadTeam(); }
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

  private async changeRole(e: Event): Promise<void> {
    const sel = (e.target as Element).closest<HTMLSelectElement>('[data-team-role]');
    if (!sel?.dataset.teamRole) return;
    sel.disabled = true;
    try { await api.setTeamRole(sel.dataset.teamRole, sel.value === 'admin' ? 'admin' : 'member'); toast(t('team.roleChanged')); }
    catch (err) { toastError(err); }
    await this.reloadTeam().catch(toastError);
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
    const teamEl = target.closest<HTMLElement>('[data-team-invite],[data-team-remove],[data-invite-cancel],[data-invite-resend]');
    if (teamEl) {
      const ds = teamEl.dataset;
      try {
        if ('teamInvite' in ds) await this.invite();
        else if (ds.teamRemove) {
          if (await confirmDialog({ title: t('team.removeTitle', { email: ds.email ?? '' }), text: t('team.removeText'), confirmLabel: t('team.remove'), danger: true })) {
            await api.removeTeamMember(ds.teamRemove); toast(t('team.removed')); await this.reloadTeam();
          }
        } else if (ds.inviteCancel) { await api.cancelTeamInvitation(ds.inviteCancel); toast(t('team.inviteCancelled')); await this.reloadTeam(); }
        else if (ds.inviteResend) { await api.inviteTeamMember(ds.inviteResend, ds.role === 'admin' ? 'admin' : 'member'); toast(t('team.invited', { email: ds.inviteResend })); await this.reloadTeam(); }
      } catch (err) { toastError(err); }
      return;
    }
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
