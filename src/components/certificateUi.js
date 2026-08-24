import { certificateListHeader, certificateRowMarkup, certificateStatus, statusBadge, escapeHtml } from './uiPrimitives.js';
import { certificateStats, filterCertificatesByStatus } from '../core/certificateCore.js';

const STAT_IDS = ['stat-total', 'stat-active', 'stat-soon', 'stat-expired'];

export function mountCertificatePageChrome({ allowVisibility = false, allowEmail = false, selectable = true } = {}) {
  const host = document.getElementById('certificatePageChrome');
  if (!host) return;
  host.innerHTML = `
    <section class="ct-toolbar">
      <div class="ct-toolbar__search"><i data-lucide="search" aria-hidden="true"></i><input id="searchInput" placeholder="Αναζήτηση τίτλου, τύπου ή αρχείου..." type="text" autocomplete="off" aria-label="Αναζήτηση πιστοποιητικών"></div>
      ${allowVisibility ? `<select aria-label="Φίλτρο ορατότητας" id="visibilityFilter"><option value="all">Όλη η ορατότητα</option><option value="shared">Διαθέσιμα σε συνεργάτες</option><option value="private">Ιδιωτικά</option></select>` : ''}
      <div class="ct-toolbar__actions">
        ${allowEmail ? `<button class="ct-btn ct-btn-secondary" id="emailBtn"><i data-lucide="mail"></i>Αποστολή</button>` : ''}
        <button class="ct-btn ct-btn-primary" id="addCertFixed"><i data-lucide="plus"></i>Νέο πιστοποιητικό</button>
      </div>
    </section>
    <section class="ct-stat-strip" id="certStats">
      <button class="ct-stat-button" data-stat="total"><span>Σύνολο</span><strong id="stat-total">0</strong></button>
      <button class="ct-stat-button" data-stat="active"><span>Ενεργά</span><strong id="stat-active">0</strong></button>
      <button class="ct-stat-button" data-stat="soon"><span>Προς λήξη</span><strong id="stat-soon">0</strong></button>
      <button class="ct-stat-button" data-stat="expired"><span>Ληγμένα</span><strong id="stat-expired">0</strong></button>
    </section>
    ${selectable ? `<section class="ct-bulkbar" id="certBulkActions">
      <div class="ct-bulkbar__summary"><strong id="selectedCertCount">0</strong><span>επιλεγμένα</span></div>
      <button class="ct-btn ct-btn-secondary ct-btn-sm" id="selectAllBtn"><i data-lucide="check-square"></i>Επιλογή όλων</button>
      <button class="ct-btn ct-btn-secondary ct-btn-sm" id="printSelectedBtn" disabled><i data-lucide="printer"></i>Εκτύπωση</button>
      <button class="ct-btn ct-btn-secondary ct-btn-sm" id="exportSelectedBtn" disabled><i data-lucide="file-down"></i>Export CSV</button>
    </section>` : ''}`;
  window.lucide?.createIcons();
}

export function renderCertificateCollection({
  certificates = [],
  container,
  onBindActions = () => {},
  onSelectionChange = () => {},
  now = new Date(),
  permissions = { edit:true, delete:true, selectable:true }
} = {}) {
  if (!container) return;
  const selectable = permissions.selectable !== false;
  if (!certificates.length) {
    container.innerHTML = `<div class="ct-certificate-empty"><i data-lucide="file-text"></i><strong>Δεν υπάρχουν πιστοποιητικά</strong><span>Προσθέστε νέο πιστοποιητικό ή αλλάξτε τα φίλτρα αναζήτησης.</span></div>`;
    onBindActions();
    window.lucide?.createIcons();
    return;
  }
  container.innerHTML = certificateListHeader({ selectable });
  certificates.forEach(cert => {
    const status = certificateStatus(cert.date, now);
    const row = document.createElement('article');
    row.className = `ct-certificate-row cert-card ct-certificate-row--${status.key}${cert.is_private === true ? ' ct-certificate-row--private' : ''}${selectable ? ' ct-certificate-row--selectable' : ''}`;
    Object.assign(row.dataset, { id: cert.id || '', title: cert.title || '', type: cert.type || '', date: cert.date || '' });
    const privacyLabel = cert.is_private === true ? statusBadge('neutral', 'Ιδιωτικό') : cert.is_private === false ? statusBadge('info', 'Σε συνεργάτες') : '';
    const checkbox = selectable ? `<div class="ct-cert-select"><input class="cert-bulk-checkbox" type="checkbox" value="${escapeHtml(cert.id || '')}" aria-label="Επιλογή ${escapeHtml(cert.title || 'πιστοποιητικού')}"></div>` : '';
    row.innerHTML = `${checkbox}${certificateRowMarkup(cert, { privacyLabel, canEdit:permissions.edit !== false, canDelete:permissions.delete !== false })}`;
    container.appendChild(row);
  });
  if (selectable) {
    const header = container.querySelector('#certSelectAllHeader');
    header?.addEventListener('change', () => {
      container.querySelectorAll('.cert-bulk-checkbox').forEach(cb => { cb.checked = header.checked; });
      onSelectionChange();
    });
    container.querySelectorAll('.cert-bulk-checkbox').forEach(cb => cb.addEventListener('change', () => {
      const boxes = [...container.querySelectorAll('.cert-bulk-checkbox')];
      if (header) { header.checked = boxes.length > 0 && boxes.every(x => x.checked); header.indeterminate = boxes.some(x => x.checked) && !boxes.every(x => x.checked); }
      onSelectionChange();
    }));
  }
  onBindActions();
  window.lucide?.createIcons();
}

export function bindCertificateStats({ certificates = [], onRender, now = new Date() } = {}) {
  const stats = certificateStats(certificates, now);
  const values = { 'stat-total': stats.total, 'stat-active': stats.active, 'stat-soon': stats.soon, 'stat-expired': stats.expired };
  const filters = {
    'stat-total': () => certificates,
    'stat-active': () => filterCertificatesByStatus(certificates, 'active', now),
    'stat-soon': () => filterCertificatesByStatus(certificates, 'soon', now),
    'stat-expired': () => filterCertificatesByStatus(certificates, 'expired', now)
  };
  const activate = activeId => { STAT_IDS.forEach(id => document.getElementById(id)?.parentElement?.classList.remove('is-active')); document.getElementById(activeId)?.parentElement?.classList.add('is-active'); };
  STAT_IDS.forEach(id => { const valueEl = document.getElementById(id); const button = valueEl?.parentElement; if (valueEl) valueEl.textContent = values[id]; if (!button) return; button.classList.add('ct-interactive-card'); button.onclick = () => { activate(id); onRender?.(filters[id]()); }; });
  activate('stat-total');
  return stats;
}

export function bindPdfPreview(popup) {
  const fileInput = popup?.querySelector('#swal-file');
  const previewBox = popup?.querySelector('#swal-preview');
  const typeSelect = popup?.querySelector('#swal-type');
  const customType = popup?.querySelector('#custom-type');
  typeSelect?.addEventListener('change', () => customType?.classList.toggle('hidden', typeSelect.value !== 'Άλλο'));
  fileInput?.addEventListener('change', () => {
    const file = fileInput.files?.[0];
    if (file?.type === 'application/pdf') {
      const url = URL.createObjectURL(file);
      previewBox.innerHTML = `<iframe src="${url}#toolbar=0&navpanes=0" class="ct-preview-frame" title="Προεπισκόπηση νέου πιστοποιητικού"></iframe>`;
    } else if (previewBox) previewBox.innerHTML = '';
  });
}

const typeOptions = `<option value="ISO 9001">ISO 9001</option><option value="ISO 13485">ISO 13485</option><option value="ISO 14001">ISO 14001</option><option value="ISO 27001">ISO 27001</option><option value="ISO 45001">ISO 45001</option><option value="CE">CE</option><option value="Άδεια λειτουργίας">Άδεια λειτουργίας</option><option value="Πιστοποιητικό">Πιστοποιητικό</option><option value="Απόφαση">Απόφαση</option><option value="Άλλο">Άλλο</option>`;
function escAttr(value=''){ return String(value ?? '').replace(/[&<>\"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c])); }
function formHtml(cert={}, {allowVisibility=false,allowFile=true,isEdit=false}={}) {
  const visibility = allowVisibility ? `<div class="ct-swal-field"><label for="swal-visibility">Ορατότητα</label><select id="swal-visibility" class="swal2-select"><option value="shared">Διαθέσιμο στους συνεργάτες</option><option value="private">Ιδιωτικό — κρυφό από συνεργάτες</option></select></div>` : '';
  const fileLabel = isEdit ? 'Αντικατάσταση PDF (προαιρετικά)' : 'Αρχείο PDF';
  return `<div class="ct-swal-form ct-swal-form--certificate">
    <div class="ct-swal-field ct-swal-field--wide"><label>Τίτλος *</label><input id="swal-title" class="swal2-input" value="${escAttr(cert.title||'')}" placeholder="π.χ. ISO 9001:2015"></div>
    <div class="ct-swal-grid"><div class="ct-swal-field"><label>Τύπος *</label><select id="swal-type" class="swal2-select">${typeOptions}</select><input id="custom-type" class="swal2-input hidden" placeholder="Άλλος τύπος"></div><div class="ct-swal-field"><label>Αριθμός πιστοποιητικού</label><input id="swal-number" class="swal2-input" value="${escAttr(cert.certificate_number||'')}" placeholder="Certificate No."></div></div>
    <div class="ct-swal-grid"><div class="ct-swal-field"><label>Ημερομηνία έκδοσης</label><input id="swal-issued" type="date" class="swal2-input" value="${escAttr(cert.issue_date||'')}"></div><div class="ct-swal-field"><label>Ημερομηνία λήξης *</label><input id="swal-date" type="date" class="swal2-input" value="${escAttr(cert.date||'')}"></div></div>
    <div class="ct-swal-field ct-swal-field--wide"><label>Φορέας έκδοσης</label><input id="swal-issuer" class="swal2-input" value="${escAttr(cert.issuer||'')}" placeholder="Φορέας / οργανισμός πιστοποίησης"></div>
    <div class="ct-swal-field ct-swal-field--wide"><label>Σημειώσεις</label><textarea id="swal-notes" class="swal2-textarea" rows="3" placeholder="Προαιρετικές σημειώσεις">${escapeHtml(cert.notes||'')}</textarea></div>
    ${allowFile ? `<div class="ct-swal-field ct-swal-field--wide"><label>${fileLabel}${isEdit?'':' *'}</label><input id="swal-file" type="file" accept="application/pdf" class="swal2-file"><small>${isEdit?'Επίλεξε αρχείο μόνο αν θέλεις να αντικαταστήσεις το υπάρχον PDF.':'Αποδεκτό αρχείο: PDF.'}</small></div><div id="swal-preview" class="ct-swal-preview"></div>`:''}
    ${visibility}
  </div>`;
}
function collectForm({allowVisibility=false,allowFile=true,isEdit=false}={}) {
  const title=document.getElementById('swal-title')?.value.trim(); const rawType=document.getElementById('swal-type')?.value; const type=rawType==='Άλλο'?document.getElementById('custom-type')?.value.trim():rawType; const date=document.getElementById('swal-date')?.value; const file=allowFile?document.getElementById('swal-file')?.files?.[0]||null:null;
  if(!title||!type||!date||(!isEdit&&allowFile&&!file)){Swal.showValidationMessage('Συμπλήρωσε τίτλο, τύπο, ημερομηνία λήξης και PDF.');return false;}
  return {title,type,date,issue_date:document.getElementById('swal-issued')?.value||null,certificate_number:document.getElementById('swal-number')?.value.trim()||null,issuer:document.getElementById('swal-issuer')?.value.trim()||null,notes:document.getElementById('swal-notes')?.value.trim()||null,file,is_private:allowVisibility?document.getElementById('swal-visibility')?.value==='private':undefined};
}
function initForm(cert={}, {allowVisibility=false,allowFile=true}={}) { const popup=Swal.getPopup(); const select=popup.querySelector('#swal-type'); const custom=popup.querySelector('#custom-type'); const known=[...select.options].some(o=>o.value===cert.type&&o.value!=='Άλλο'); select.value=cert.type?(known?cert.type:'Άλλο'):'Πιστοποιητικό'; custom.classList.toggle('hidden',select.value!=='Άλλο'); if(cert.type&&!known)custom.value=cert.type; select.addEventListener('change',()=>custom.classList.toggle('hidden',select.value!=='Άλλο')); const vis=popup.querySelector('#swal-visibility'); if(vis)vis.value=cert.is_private?'private':'shared'; if(allowFile)bindPdfPreview(popup); }

export async function openCertificateCreateDialog({ allowVisibility = false } = {}) { return Swal.fire({title:'Νέο Πιστοποιητικό',html:formHtml({}, {allowVisibility,allowFile:true,isEdit:false}),width:'min(760px,96vw)',focusConfirm:false,showCancelButton:true,confirmButtonText:'Αποθήκευση',cancelButtonText:'Ακύρωση',didOpen:()=>initForm({}, {allowVisibility,allowFile:true}),preConfirm:()=>collectForm({allowVisibility,allowFile:true,isEdit:false})}); }
export async function openCertificateEditDialog(cert, { allowVisibility = false, allowFile = false } = {}) { return Swal.fire({title:'Επεξεργασία Πιστοποιητικού',html:formHtml(cert,{allowVisibility,allowFile,isEdit:true}),width:'min(760px,96vw)',focusConfirm:false,showCancelButton:true,confirmButtonText:'Αποθήκευση',cancelButtonText:'Ακύρωση',didOpen:()=>initForm(cert,{allowVisibility,allowFile}),preConfirm:()=>collectForm({allowVisibility,allowFile,isEdit:true})}); }
