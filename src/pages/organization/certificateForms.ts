// Certificate create/edit, sharing and "who viewed it" dialogs (used by several pages).
import { api } from '../../api/index';
import { html, raw, mount, type SafeHtml } from '../../lib/html';
import { t } from '../../lib/i18n';
import { formatDate, relativeTime } from '../../lib/format';
import { field, fieldValue } from '../../lib/form';
import { icon, avatar, typeName, emptyState, loading } from '../../ui/components';
import { openDialog, UserError } from '../../ui/dialog';
import type { Certificate, CertificateInput, CertificateType, Connection, ShareInput, Sharing } from '../../types/domain';

const MAX_PDF = 25 * 1024 * 1024;
const SHARING_MODES: readonly [Sharing, string][] = [['private', 'lock'], ['all_connections', 'globe'], ['selected', 'user-check']];

function sharingSection(cert: Certificate | null, partners: readonly Connection[]): SafeHtml {
  const mode: Sharing = cert?.sharing || 'all_connections';
  const shareOf = (id: string) => (cert?.shares || []).find(s => s.grantee_org_id === id);
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  return html`
    <fieldset class="field" style="border:0;padding:0;margin:0">
      <legend class="field-label" style="margin-bottom:6px">${t('sharing.title')}</legend>
      <div class="choices choices--3">${SHARING_MODES.map(([value, ic]) => html`<label class="choice"><input type="radio" name="sharing" value="${value}" ${mode === value ? raw('checked') : ''}>
        ${icon(ic)}<span><strong>${t(`sharing.${value}`)}</strong><small>${t(`sharing.${value}.help`)}</small></span></label>`)}</div>
    </fieldset>
    <div class="field" data-selected-panel ${mode === 'selected' ? '' : raw('hidden')}>
      <span class="field-label">${t('sharing.pickPartners')}</span>
      ${partners.length ? html`<div class="share-list">${partners.map(p => {
        const s = shareOf(p.partner_id);
        return html`<label class="share-row">
          <input type="checkbox" name="share" value="${p.partner_id}" ${s ? raw('checked') : ''}>
          <span class="cell-org">${avatar(p.partner_name, { size: 'sm' })}<span><strong>${p.partner_name}</strong></span></span>
          <input type="date" class="input" name="until-${p.partner_id}" value="${s?.expires_at ? s.expires_at.slice(0, 10) : ''}" min="${tomorrow}" aria-label="${t('sharing.until')}" title="${t('sharing.until')}">
        </label>`;
      })}</div><small>${t('sharing.untilHint')}</small>` : html`<p class="hint">${t('sharing.noPartners')}</p>`}
    </div>`;
}

function bindSharing(form: HTMLFormElement): void {
  const panel = form.querySelector<HTMLElement>('[data-selected-panel]')!;
  form.querySelectorAll('input[name=sharing]').forEach(r => r.addEventListener('change', () => {
    panel.hidden = form.querySelector<HTMLInputElement>('input[name=sharing]:checked')?.value !== 'selected';
  }));
}

function readSharing(form: HTMLFormElement): { mode: Sharing; shares: ShareInput[] } {
  const mode = (form.querySelector<HTMLInputElement>('input[name=sharing]:checked')?.value || 'private') as Sharing;
  const shares: ShareInput[] = mode === 'selected'
    ? [...form.querySelectorAll<HTMLInputElement>('input[name=share]:checked')].map(cb => {
        const until = form.querySelector<HTMLInputElement>(`[name="until-${cb.value}"]`)?.value;
        return { org_id: cb.value, expires_at: until ? new Date(`${until}T23:59:59`).toISOString() : null };
      })
    : [];
  if (mode === 'selected' && !shares.length) throw new UserError(t('sharing.pickAtLeastOne'));
  return { mode, shares };
}

/** Resolves with the certificate id when saved, null when cancelled. */
export async function certificateDialog({ cert = null, types, partners, presetTypeId = null }:
  { cert?: Certificate | null; types: readonly CertificateType[]; partners: readonly Connection[]; presetTypeId?: string | null }): Promise<string | null> {
  const isEdit = !!cert;
  const typeId = cert?.certificate_type_id || presetTypeId || types[0]?.id;
  const other = types.find(x => x.code === 'OTHER');
  const result = await openDialog<string>({
    title: isEdit ? t('cert.editTitle') : t('cert.newTitle'),
    description: isEdit ? '' : t('cert.newText'),
    submitLabel: isEdit ? t('common.save') : t('cert.create'),
    body: html`
      <div class="form-grid form-grid--2">
        <div class="field span-2"><label for="f-title">${t('cert.fieldTitle')} *</label>
          <input class="input" id="f-title" name="title" required maxlength="200" value="${cert?.title || ''}" placeholder="${t('cert.titlePlaceholder')}" autofocus></div>
        <div class="field"><label for="f-type">${t('cert.fieldType')} *</label>
          <select class="select" id="f-type" name="certificate_type_id" required>${types.map(ty => html`<option value="${ty.id}" ${ty.id === typeId ? raw('selected') : ''}>${typeName(ty)}</option>`)}</select></div>
        <div class="field" data-custom ${typeId === other?.id ? '' : raw('hidden')}><label for="f-custom">${t('cert.fieldCustomType')}</label>
          <input class="input" id="f-custom" name="custom_type_label" maxlength="120" value="${cert?.custom_type_label || ''}"></div>
        <div class="field"><label for="f-number">${t('cert.fieldNumber')}</label>
          <input class="input" id="f-number" name="certificate_number" maxlength="120" value="${cert?.certificate_number || ''}"></div>
        <div class="field"><label for="f-issuer">${t('cert.fieldIssuer')}</label>
          <input class="input" id="f-issuer" name="issuer" maxlength="200" value="${cert?.issuer || ''}"></div>
        <div class="field"><label for="f-issued">${t('cert.fieldIssued')}</label>
          <input class="input" type="date" id="f-issued" name="issue_date" value="${cert?.issue_date || ''}"></div>
        <div class="field"><label for="f-expiry">${t('cert.fieldExpiry')}</label>
          <input class="input" type="date" id="f-expiry" name="expiry_date" value="${cert?.expiry_date || ''}"><small>${t('cert.expiryHint')}</small></div>
        <div class="field span-2"><label for="f-notes">${t('cert.fieldNotes')}</label>
          <textarea class="textarea" id="f-notes" name="notes" maxlength="2000" rows="2">${cert?.notes || ''}</textarea></div>
        <div class="field span-2"><span class="field-label">${t('cert.fieldFile')}${isEdit ? '' : ' *'}</span>
          <label class="file-drop">${icon('upload')}<span><strong data-file-name>${isEdit ? t('cert.replaceFile') : t('cert.chooseFile')}</strong>
            <small>${isEdit && cert.file ? t('cert.currentFile', { name: cert.file.original_file_name }) : t('cert.fileHint')}</small></span>
            <input type="file" name="file" accept="application/pdf,.pdf" ${isEdit ? '' : raw('required')}></label></div>
      </div>
      ${isEdit ? '' : sharingSection(null, partners)}`,
    onOpen(form) {
      const sel = field<HTMLSelectElement>(form, 'certificate_type_id');
      const custom = form.querySelector<HTMLElement>('[data-custom]')!;
      sel.addEventListener('change', () => { custom.hidden = sel.value !== other?.id; });
      const fileInput = field(form, 'file');
      fileInput.addEventListener('change', () => {
        form.querySelector('[data-file-name]')!.textContent = fileInput.files?.[0]?.name || t('cert.chooseFile');
      });
      if (!isEdit) bindSharing(form);
    },
    async onSubmit(form) {
      const file = field(form, 'file').files?.[0] ?? null;
      if (file && ((file.type && file.type !== 'application/pdf') || !/\.pdf$/i.test(file.name))) throw new UserError(t('cert.pdfOnly'));
      if (file && file.size > MAX_PDF) throw new UserError(t('cert.tooLarge'));
      const issue = fieldValue(form, 'issue_date'), expiry = fieldValue(form, 'expiry_date');
      if (issue && expiry && expiry < issue) throw new UserError(t('cert.datesOrder'));
      const typeIdValue = fieldValue(form, 'certificate_type_id');
      const sharing = isEdit ? null : readSharing(form);
      const input: CertificateInput = {
        id: cert?.id,
        file,
        title: fieldValue(form, 'title'),
        certificate_type_id: typeIdValue,
        custom_type_label: typeIdValue === other?.id ? fieldValue(form, 'custom_type_label') : '',
        certificate_number: fieldValue(form, 'certificate_number'),
        issuer: fieldValue(form, 'issuer'),
        issue_date: issue,
        expiry_date: expiry,
        notes: fieldValue(form, 'notes'),
        sharing: sharing?.mode,
        shares: sharing?.shares
      };
      return api.saveCertificate(input);
    }
  });
  return typeof result === 'string' ? result : null;
}

export async function sharingDialog({ cert, partners }: { cert: Certificate; partners: readonly Connection[] }): Promise<boolean> {
  const ok = await openDialog({
    title: t('sharing.dialogTitle'), description: cert.title, submitLabel: t('common.save'),
    body: sharingSection(cert, partners),
    onOpen: bindSharing,
    async onSubmit(form) {
      const { mode, shares } = readSharing(form);
      await api.setSharing(cert.id, mode, shares);
      return true;
    }
  });
  return ok === true;
}

export async function viewsDialog(cert: Certificate): Promise<void> {
  await openDialog({
    title: t('views.title'), description: cert.title, hideSubmit: true, cancelLabel: t('common.close'),
    body: html`<div data-views>${loading()}</div>`,
    onOpen(form) {
      const host = form.querySelector<HTMLElement>('[data-views]')!;
      api.certificateViews({ certificateId: cert.id, limit: 100 }).then(rows => {
        mount(host, rows.length ? html`<ul class="rows">${rows.map(v => html`<li class="row" style="padding:10px 0">
          ${avatar(v.viewer_org_name, { size: 'sm' })}<div class="row__main"><span class="row__title">${v.viewer_org_name}</span>
          <span class="row__meta"><span>${formatDate(v.viewed_at)}</span><span>${relativeTime(v.viewed_at)}</span></span></div></li>`)}</ul>`
          : emptyState({ iconName: 'eye', title: t('views.none'), text: t('views.noneText') }));
      }, () => { mount(host, emptyState({ iconName: 'circle-alert', title: t('common.loadFailed') })); });
    }
  });
}
