import { getLanguage, locale } from '../shared/i18n.js';
/** CertiTrack shared markup primitives.
 * Keep recurring UI structures here so semantic/markup changes propagate globally.
 */
export function escapeHtml(value='') {
  return String(value ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
}

export function statusBadge(kind='neutral', text='') {
  return `<span class="ct-status ct-status--${escapeHtml(kind)}">${escapeHtml(text)}</span>`;
}

export function emptyState({ icon='', title='', text='' }={}) {
  return `<div class="ct-empty-state">${icon ? `<i data-lucide="${escapeHtml(icon)}"></i>` : ''}${title ? `<strong>${escapeHtml(title)}</strong>` : ''}${text ? `<span>${escapeHtml(text)}</span>` : ''}</div>`;
}

export function adminStatus(kind='neutral', text='') {
  const map={success:'active',warning:'pending',danger:'blocked',neutral:'neutral'};
  const suffix=map[kind] || kind;
  return `<span class="ct-admin-status${suffix !== 'neutral' ? ` ct-admin-status--${escapeHtml(suffix)}` : ''}">${escapeHtml(text)}</span>`;
}

export function kpiCard({ label='', value='—', meta='', icon='' }={}) {
  return `<article class="ct-kpi-card">${icon ? `<div class="ct-kpi-card__icon"><i data-lucide="${escapeHtml(icon)}"></i></div>` : ''}<div><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong>${meta ? `<small>${escapeHtml(meta)}</small>` : ''}</div></article>`;
}

export function tableEmpty({ colspan=1, text='Δεν υπάρχουν δεδομένα.' }={}) {
  return `<tr><td colspan="${Number(colspan)||1}" class="ct-table-empty">${escapeHtml(text)}</td></tr>`;
}

export function rowAction({ icon='eye', label='Προβολή', className='', attrs={} }={}) {
  const attributes = Object.entries(attrs).map(([key,value]) => ` data-${escapeHtml(key)}="${escapeHtml(value)}"`).join('');
  return `<button type="button" class="ct-row-action${className ? ` ${escapeHtml(className)}` : ''}"${attributes} title="${escapeHtml(label)}" aria-label="${escapeHtml(label)}"><i data-lucide="${escapeHtml(icon)}"></i></button>`;
}

export function actionRail(actions = []) {
  return `<div class="ct-row-actions">${actions.filter(Boolean).join('')}</div>`;
}

export function certificateStatus(date, now=new Date()) {
  const target = new Date(date);
  const base = new Date(now);
  target.setHours(0,0,0,0); base.setHours(0,0,0,0);
  const days = Math.ceil((target-base)/86400000);
  if (days < 0) return { key:'expired', kind:'danger', label:getLanguage()==='en'?'Expired':'Ληγμένο', days };
  if (days <= 30) return { key:'soon', kind:'warning', label:getLanguage()==='en'?`In ${days} days`:`Σε ${days} ημέρες`, days };
  return { key:'active', kind:'success', label:getLanguage()==='en'?'Active':'Ενεργό', days };
}

export function certificateListHeader({ selectable = false } = {}) {
  const select = selectable ? '<span class="ct-cert-select-head"><input id="certSelectAllHeader" type="checkbox" aria-label="Επιλογή όλων"></span>' : '';
  return `<div class="ct-certificate-head${selectable ? ' ct-certificate-head--selectable' : ''}">${select}<span class="ct-cert-head-title">Πιστοποιητικό</span><span class="ct-cert-head-type">Τύπος</span><span class="ct-cert-head-date">Λήξη</span><span class="ct-cert-head-status">Κατάσταση</span><span class="ct-cert-head-actions">Ενέργειες</span></div>`;
}

export function certificateRowMarkup(cert, { privacyLabel='', canEdit=true, canDelete=true }={}) {
  const status = certificateStatus(cert.date);
  const date = cert.date ? new Date(cert.date).toLocaleDateString(locale()) : '—';
  const privacy = privacyLabel ? ` ${privacyLabel}` : '';
  const en = getLanguage() === 'en';
  const common={ref:cert.file_url||'',title:cert.title||'',name:cert.name||'certificate.pdf'};
  const actions = actionRail([
    rowAction({icon:'eye',label:en?'View':'Προβολή',className:'view-btn',attrs:common}),
    canEdit ? rowAction({icon:'pencil',label:en?'Edit / replace PDF':'Επεξεργασία / αντικατάσταση PDF',className:'edit-btn',attrs:{id:cert.id||''}}) : '',
    canDelete ? rowAction({icon:'trash-2',label:en?'Delete':'Διαγραφή',className:'ct-row-action--danger delete-btn',attrs:{id:cert.id||'',ref:cert.file_url||''}}) : ''
  ]);
  return `<div class="ct-certificate-main"><div class="ct-certificate-icon"><i data-lucide="file-text"></i></div><div class="ct-certificate-title"><strong>${escapeHtml(cert.title || (en?'Untitled':'Χωρίς τίτλο'))}</strong><span>${escapeHtml(cert.name || 'PDF')}${privacy}</span></div></div><div class="ct-certificate-cell ct-certificate-type">${escapeHtml(cert.type || '—')}</div><div class="ct-certificate-cell ct-certificate-date">${escapeHtml(date)}</div><div class="ct-certificate-status">${statusBadge(status.kind,status.label)}</div><div class="ct-certificate-actions">${actions}</div>`;
}

export function companyAccessRow({ id='', name='', afm='', access='granted' }={}) {
  const blocked=access==='blocked';
  const initials=String(name||'').trim().split(/\s+/).map(x=>x[0]).join('').slice(0,2).toUpperCase() || '—';
  return `<article class="ct-company-row"><div class="ct-company-avatar">${escapeHtml(initials)}</div><div class="ct-company-row__main"><strong>${escapeHtml(name)}</strong><span>ΑΦΜ ${escapeHtml(afm||'—')}</span></div>${statusBadge(blocked?'danger':'success',blocked?'Αποκλεισμένη':'Πρόσβαση ενεργή')}<button class="ct-btn ${blocked?'ct-btn-secondary':'ct-btn-danger'} ct-btn-sm" data-company="${escapeHtml(id)}" data-access="${escapeHtml(access)}">${blocked?'Επαναφορά':'Αποκλεισμός'}</button></article>`;
}

export function coverageMeter({ covered=0, required=0 }={}) {
  const pct = required ? Math.round((covered/required)*100) : 100;
  return `<div class="ct-coverage" style="--ct-coverage:${Math.max(4,Math.min(100,pct))}%"><span>${escapeHtml(covered)}/${escapeHtml(required)}</span><div><i></i></div></div>`;
}
