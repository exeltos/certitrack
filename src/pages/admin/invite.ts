// Sign-up is by invitation only: the platform owner invites organizations here
// (from Organizations, or straight from a presentation request).
import { api } from '../../api/index';
import { html, mount } from '../../lib/html';
import { t } from '../../lib/i18n';
import { formatDate } from '../../lib/format';
import { fieldValue } from '../../lib/form';
import { icon, emptyState } from '../../ui/components';
import { openDialog, confirmDialog, toast, toastError } from '../../ui/dialog';
import type { OrganizationInvitation } from '../../types/domain';

/** Asks for the email (and optionally the name) and sends the invitation. Resolves true once sent. */
export async function inviteOrganizationDialog(prefill: { email?: string; name?: string } = {}): Promise<boolean> {
  let sentTo = '';
  const ok = await openDialog({
    title: t('orgInvite.button'), description: t('orgInvite.text'), submitLabel: t('orgInvite.send'),
    body: html`<div class="field"><label for="oi-email">${t('orgInvite.email')}</label><input class="input" id="oi-email" name="email" type="email" required maxlength="254" autocomplete="off" value="${prefill.email ?? ''}" autofocus></div>
      <div class="field"><label for="oi-name">${t('orgInvite.name')}</label><input class="input" id="oi-name" name="name" maxlength="200" autocomplete="off" value="${prefill.name ?? ''}"></div>`,
    async onSubmit(form) {
      sentTo = fieldValue(form, 'email').toLowerCase();
      await api.inviteOrganization(sentTo, fieldValue(form, 'name') || undefined);
      return true;
    }
  });
  if (ok) toast(t('orgInvite.sent', { email: sentTo }));
  return ok === true;
}

/** Pending invitations, with resend and cancel. Resolves once closed. */
export async function pendingInvitationsDialog(): Promise<void> {
  let rows: OrganizationInvitation[] = [];
  const list = (): ReturnType<typeof html> => rows.length ? html`<ul class="rows">${rows.map(i => html`<li class="row" style="padding:10px 0">
      <span class="row__icon">${icon('mail', { size: 16 })}</span>
      <div class="row__main"><span class="row__title">${i.organization_name || i.email}</span>
        <span class="row__meta">${i.organization_name ? html`<span>${i.email}</span>` : ''}<span>${t('team.invitedOn', { date: formatDate(i.created_at), expires: formatDate(i.expires_at) })}</span></span></div>
      <div class="row__side">
        <button type="button" class="btn btn--sm btn--secondary" data-resend="${i.id}">${t('team.resend')}</button>
        <button type="button" class="icon-btn icon-btn--sm" data-cancel="${i.id}" title="${t('team.cancelInvite')}" aria-label="${t('team.cancelInvite')}: ${i.email}">${icon('x')}</button>
      </div></li>`)}</ul>`
    : emptyState({ iconName: 'mail', title: t('orgInvite.pendingEmpty') });

  rows = await api.organizationInvitations();
  await openDialog({
    title: t('orgInvite.pendingTitle'), wide: true, hideSubmit: true, cancelLabel: t('common.close'),
    body: html`<div data-invites>${list()}</div>`,
    onOpen(form) {
      const box = form.querySelector<HTMLElement>('[data-invites]')!;
      box.addEventListener('click', e => {
        const el = (e.target as Element).closest<HTMLButtonElement>('[data-resend],[data-cancel]');
        const inv = el && rows.find(i => i.id === (el.dataset.resend ?? el.dataset.cancel));
        if (!el || !inv) return;
        void (async () => {
          el.disabled = true;
          try {
            if (el.dataset.resend) {
              await api.inviteOrganization(inv.email, inv.organization_name ?? undefined);
              toast(t('orgInvite.sent', { email: inv.email }));
            } else {
              if (!await confirmDialog({ title: t('team.cancelInvite'), text: inv.email, confirmLabel: t('team.cancelInvite'), danger: true })) { el.disabled = false; return; }
              await api.cancelOrganizationInvitation(inv.id);
              toast(t('team.inviteCancelled'));
            }
            rows = await api.organizationInvitations();
            mount(box, list());
          } catch (err) { el.disabled = false; toastError(err); }
        })();
      });
    }
  });
}
