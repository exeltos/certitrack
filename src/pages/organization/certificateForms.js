// Certificate create/edit and sharing dialogs (used by several pages).
import { api } from '../../api/index.js';
import { html, raw } from '../../lib/html.js';
import { t } from '../../lib/i18n.js';
import { formatDate, relativeTime } from '../../lib/format.js';
import { icon, avatar, typeName, emptyState, loading } from '../../ui/components.js';
import { openDialog } from '../../ui/dialog.js';
import { mount } from '../../lib/html.js';

const MAX_PDF = 25 * 1024 * 1024;

function sharingSection(cert, partners) {
  const mode = cert?.sharing || 'all_connections';
  const shareOf = id => (cert?.shares || []).find(s => s.grantee_org_id === id);
  const choice = (value, ic) => html`<label class="choice"><input type="radio" name="sharing" value="${value}" ${mode === value ? raw('checked') : ''}>
    ${icon(ic)}<span><strong>${t(`sharing.${value}`)}</strong><small>${t(`sharing.${value}.help`)}</small></span></label>`;
  return html`
    <fieldset class="field" style="border:0;padding:0;margin:0">
      <legend class="field-label" style="margin-bottom:6px">${t('sharing.title')}</legend>
      <div class="choices choices--3">${choice('private', 'lock')}${choice('all_connections', 'globe')}${choice('selected', 'user-check')}</div>
    </fieldset>
    <div class="field" data-selected-panel ${mode === 'selected' ? '' : raw('hidden')}>
      <span class="field-label">${t('sharing.pickPartners')}</span>
      ${partners.length ? html`<div class="share-list">${partners.map(p => {
        const s = shareOf(p.partner_id);
        return html`<label class="share-row">
          <input type="checkbox" name="share" value="${p.partner_id}" ${s ? raw('checked') : ''}>
          <span class="cell-org">${avatar(p.partner_name, { size: 'sm' })}<span><strong>${p.partner_name}</strong></span></span>
          <input type="date" class="input" name="until-${p.partner_id}" value="${s?.expires_at ? s.expires_at.slice(0, 10) : ''}" min="${new Date(Date.now() + 86400000).toISOString().slice(0, 10)}" aria-label="${t('sharing.until')}" title="${t('sharing.until')}">
        </label>`;
      })}</div><small>${t('sharing.untilHint')}</small>` : html`<p class="hint">${t('sharing.noPartners')}</p>`}
    </div>`;
}

function bindSharing(form) {
  const panel = form.querySelector('[data-selected-panel]');
  form.querySelectorAll('input[name=sharing]').forEach(r => r.addEventListener('change', () => { panel.hidden = form.sharing.value !== 'selected'; }));
}

function readSharing(form) {
  const mode = form.querySelector('input[name=sharing]:checked')?.value || 'private';
  const shares = mode === 'selected'
    ? [...form.querySelectorAll('input[name=share]:checked')].map(cb => {
        const until = form.querySelector(`[name="until-${cb.value}"]`)?.value;
        return { org_id: cb.value, expires_at: until ? new Date(`${until}T23:59:59`).toISOString() : null };
      })
    : [];
  if (mode === 'selected' && !shares.length) throw Object.assign(new Error('pick'), { userMessage: t('sharing.pickAtLeastOne') });
  return { mode, shares };
}

export async function certificateDialog({ cert = null, types, partners, presetTypeId = null }) {
  const isEdit = !!cert;
  const typeId = cert?.certificate_type_id || presetTypeId || types[0]?.id;
  const other = types.find(x => x.code === 'OTHER');
  return openDialog({
    title: isEdit ? t('cert.editTitle') : t('cert.newTitle'),
    description: isEdit ? '' : t('cert.newText'),
    submitLabel: isEdit ? t('common.save') : t('cert.create'),
    wide: false,
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
      const sel = form.certificate_type_id, custom = form.querySelector('[data-custom]');
      sel.addEventListener('change', () => { custom.hidden = sel.value !== other?.id; });
      form.file.addEventListener('change', () => { form.querySelector('[data-file-name]').textContent = form.file.files[0]?.name || t('cert.chooseFile'); });
      if (!isEdit) bindSharing(form);
    },
    async onSubmit(form) {
      const file = form.file.files[0] || null;
      if (file && (file.type && file.type !== 'application/pdf' || !/\.pdf$/i.test(file.name))) throw Object.assign(new Error('pdf'), { userMessage: t('cert.pdfOnly') });
      if (file && file.size > MAX_PDF) throw Object.assign(new Error('size'), { userMessage: t('cert.tooLarge') });
      const issue = form.issue_date.value, expiry = form.expiry_date.value;
      if (issue && expiry && expiry < issue) throw Object.assign(new Error('dates'), { userMessage: t('cert.datesOrder') });
      const fields = Object.fromEntries(['title', 'certificate_type_id', 'custom_type_label', 'certificate_number', 'issuer', 'issue_date', 'expiry_date', 'notes']
        .map(k => [k, form[k].value.trim()]));
      if (fields.certificate_type_id !== other?.id) fields.custom_type_label = '';
      const sharing = isEdit ? null : readSharing(form);
      return api.saveCertificate({ id: cert?.id, file, ...fields, sharing: sharing?.mode, shares: sharing?.shares });
    }
  });
}

export async function sharingDialog({ cert, partners }) {
  return openDialog({
    title: t('sharing.dialogTitle'), description: cert.title, submitLabel: t('common.save'),
    body: sharingSection(cert, partners),
    onOpen: bindSharing,
    async onSubmit(form) {
      const { mode, shares } = readSharing(form);
      await api.setSharing(cert.id, mode, shares);
      return true;
    }
  });
}

export async function viewsDialog(cert) {
  return openDialog({
    title: t('views.title'), description: cert.title, hideSubmit: true, cancelLabel: t('common.close'),
    body: html`<div data-views>${loading()}</div>`,
    async onOpen(form) {
      const host = form.querySelector('[data-views]');
      try {
        const rows = await api.certificateViews({ certificateId: cert.id, limit: 100 });
        mount(host, rows.length ? html`<ul class="rows">${rows.map(v => html`<li class="row" style="padding:10px 0">
          ${avatar(v.viewer_org_name, { size: 'sm' })}<div class="row__main"><span class="row__title">${v.viewer_org_name}</span>
          <span class="row__meta"><span>${formatDate(v.viewed_at)}</span><span>${relativeTime(v.viewed_at)}</span></span></div></li>`)}</ul>`
          : emptyState({ iconName: 'eye', title: t('views.none'), text: t('views.noneText') }));
      } catch (err) { mount(host, emptyState({ iconName: 'circle-alert', title: t('common.loadFailed') })); }
    }
  });
}
