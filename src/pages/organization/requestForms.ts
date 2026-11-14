// Document request dialogs: ask a partner for a document, or answer a partner.
import { api } from '../../api/index';
import { html, raw } from '../../lib/html';
import { t } from '../../lib/i18n';
import { fieldValue } from '../../lib/form';
import { icon, typeName, stateBadge, expiryText } from '../../ui/components';
import { openDialog } from '../../ui/dialog';
import { certificateDialog } from './certificateForms';
import type { Certificate, CertificateType, Connection, DocumentRequest } from '../../types/domain';

/** Resolves true when the request was sent. */
export async function askDialog({ connections, types, connectionId = null }:
  { connections: readonly Connection[]; types: readonly CertificateType[]; connectionId?: string | null }): Promise<boolean> {
  const usable = types.filter(ty => ty.code !== 'OTHER');
  const ok = await openDialog({
    title: t('req.askTitle'), description: t('req.askText'), submitLabel: t('req.send'),
    body: html`
      ${connectionId ? '' : html`<div class="field"><label for="r-conn">${t('req.fieldPartner')} *</label>
        <select class="select" id="r-conn" name="connection" required>${connections.map(c => html`<option value="${c.id}">${c.partner_name}</option>`)}</select></div>`}
      <div class="field"><label for="r-type">${t('req.fieldType')} *</label>
        <select class="select" id="r-type" name="type" required>${usable.map(ty => html`<option value="${ty.id}">${typeName(ty)}</option>`)}</select></div>
      <div class="field"><label for="r-due">${t('req.fieldDue')}</label><input class="input" type="date" id="r-due" name="due" min="${new Date().toISOString().slice(0, 10)}"></div>
      <div class="field"><label for="r-note">${t('req.fieldNote')}</label><textarea class="textarea" id="r-note" name="note" maxlength="1000" rows="2" placeholder="${t('req.notePlaceholder')}"></textarea></div>`,
    async onSubmit(form) {
      await api.requestDocument(connectionId || fieldValue(form, 'connection'), fieldValue(form, 'type'), fieldValue(form, 'note'), fieldValue(form, 'due'));
      return true;
    }
  });
  return ok === true;
}

export type RespondOutcome = 'shared' | 'declined';

/** Answer a request: share an existing certificate of that type, upload a new one, or decline. */
export async function respondDialog({ request, partnerName, myCerts, types, partners }:
  { request: DocumentRequest; partnerName: string; myCerts: readonly Certificate[]; types: readonly CertificateType[]; partners: readonly Connection[] }): Promise<RespondOutcome | null> {
  const matching = myCerts.filter(c => c.certificate_type_id === request.certificate_type_id);
  const choice = await openDialog<'shared' | 'upload' | 'decline'>({
    title: t('req.respondTitle', { type: typeName(request.type) }),
    description: t('req.respondText', { org: partnerName }),
    submitLabel: t('req.shareSelected'),
    hideSubmit: matching.length === 0,
    body: html`
      ${request.note ? html`<div class="callout">${icon('info')}<div><strong>${t('req.theirNote')}</strong><p>${request.note}</p></div></div>` : ''}
      ${matching.length ? html`<fieldset class="field" style="border:0;padding:0;margin:0"><legend class="field-label" style="margin-bottom:6px">${t('req.pickCertificate')}</legend>
        <div class="choices">${matching.map((c, i) => html`<label class="choice"><input type="radio" name="cert" value="${c.id}" ${i === 0 ? raw('checked') : ''}>
          ${icon('file-text')}<span><strong>${c.title}</strong><small>${expiryText(c.expiry_date)}</small></span><span style="margin-left:auto">${stateBadge(c.expiry_date)}</span></label>`)}</div>
        <small class="hint">${t('req.shareHint', { org: partnerName })}</small></fieldset>`
        : html`<p class="muted">${t('req.noMatching')}</p>`}
      <div class="pair">
        <button type="button" class="btn btn--secondary" data-upload>${icon('upload')}${t('req.uploadNew')}</button>
        <button type="button" class="btn btn--danger-ghost" data-decline>${t('req.decline')}</button>
      </div>`,
    onOpen(form, _dlg, finish) {
      form.querySelector('[data-upload]')!.addEventListener('click', () => finish('upload'));
      form.querySelector('[data-decline]')!.addEventListener('click', () => finish('decline'));
    },
    async onSubmit(form) {
      const picked = form.querySelector<HTMLInputElement>('input[name=cert]:checked')?.value;
      if (!picked) return false;
      await api.fulfillRequest(request.id, picked);
      return 'shared';
    }
  });
  if (choice === 'upload') {
    const id = await certificateDialog({ types, partners, presetTypeId: request.certificate_type_id });
    if (!id) return null;
    await api.fulfillRequest(request.id, id);
    return 'shared';
  }
  if (choice === 'decline') {
    const declined = await openDialog<'declined'>({
      title: t('req.declineTitle'), submitLabel: t('req.decline'), danger: true,
      body: html`<div class="field"><label for="d-note">${t('req.declineReason')}</label><textarea class="textarea" id="d-note" name="note" maxlength="500" rows="3" autofocus></textarea></div>`,
      async onSubmit(form) { await api.declineRequest(request.id, fieldValue(form, 'note')); return 'declined' as const; }
    });
    return declined === 'declined' ? 'declined' : null;
  }
  return choice === 'shared' ? 'shared' : null;
}
