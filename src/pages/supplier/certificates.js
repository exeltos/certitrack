import { isDemo, exitDemo } from '../../demo/demoSession.js';
import { renderSupplierCertificatesDemo } from '../../demo/realScreenDemo.js';
import { storageService } from '../../services/storageService.js';
import { authService } from '../../services/authService.js';
import { showLoading, hideLoading, handleError } from '../../shared/common.js';
import { certificateStats, filterCertificatesByStatus, daysUntil, escapeHtml, hasRequiredAfm } from '../../core/certificateCore.js';
import { createCertificateSignedUrl, removeCertificateObject, openCertificatePreview } from '../../core/certificateStorage.js';
import { toggleAllSelection, ensureSelectionCheckbox } from '../../core/selectionMode.js';

import { certificateService } from '../../services/certificateService.js';
import { companyService } from '../../services/companyService.js';
import { relationshipService } from '../../services/relationshipService.js';
import { supplierService } from '../../services/supplierService.js';
let currentUser;

// Αρχικοποίηση σελίδας
export async function initPage() {
  if (isDemo('supplier')) {
    renderSupplierCertificatesDemo();
    document.getElementById('logoutBtn')?.addEventListener('click', exitDemo);
    return;
  }
  // Ensure listEl is defined for debug and initial loadCompanies
  const listEl = document.getElementById('myCompaniesList');
  const selectAllBtn = document.getElementById('selectAllBtn');
  if (selectAllBtn) {
    selectAllBtn.addEventListener('click', () => {
      toggleAllSelection();
    });
  }
  // Export mode buttons setup continues here
  const exportBtn = document.getElementById('exportMenuBtn');
  const downloadBtn = document.getElementById('downloadBtn');
  const certContainer = document.getElementById('certContainer');

  exportBtn?.addEventListener('click', () => {
    const isExporting = certContainer?.getAttribute('data-export-mode') === 'true';

    if (isExporting) {
    if (certContainer) certContainer.setAttribute('data-export-mode', 'false');
    document.querySelectorAll('.export-checkbox').forEach(cb => cb.remove());
    if (selectAllBtn) selectAllBtn.classList.add('hidden');
    if (downloadBtn) downloadBtn.classList.add('hidden');
    exportBtn.classList.remove('bg-blue-200/70', 'dark:bg-blue-800/40');
    exportBtn.classList.remove('rounded-full', 'transition-all');
    return;
  }
    
Swal.fire({
      title: 'Επιλέξτε Τύπο Εξαγωγής',
      input: 'select',
      inputOptions: {
        excel: 'Excel (.xlsx)',
        pdf: 'PDF (.pdf)' // placeholder
      },
      inputPlaceholder: 'Τύπος αρχείου',
      showCancelButton: true,
      confirmButtonText: 'Συνέχεια'
    }).then(result => {
      if (!result.isConfirmed) return;
      const type = result.value;
      if (certContainer) if (certContainer) certContainer.setAttribute('data-export-mode', 'true');
      if (selectAllBtn) selectAllBtn.classList.remove('hidden');
if (downloadBtn) downloadBtn.classList.add('hidden');

      if (exportBtn) exportBtn.setAttribute('data-export-type', type);
exportBtn.classList.add('bg-blue-200/70', 'dark:bg-blue-800/40');
      exportBtn.classList.add('rounded-full', 'transition-all');

      document.querySelectorAll('.cert-card').forEach(card => {
        let checkbox = card.querySelector('.export-checkbox');
        if (!checkbox) {
          checkbox = document.createElement('input');
          checkbox.type = 'checkbox';
          checkbox.className = 'export-checkbox absolute top-2 right-2 w-5 h-5 accent-blue-600';
          card.classList.add('relative');
          checkbox.addEventListener('change', () => {
            const anyChecked = document.querySelectorAll('.export-checkbox:checked').length > 0;
            if (downloadBtn) {
              downloadBtn.classList.toggle('hidden', !anyChecked);
            }
          });
          card.appendChild(checkbox);
        } else {
          checkbox.classList.remove('hidden');
        }
      });

    });
  });

  downloadBtn?.addEventListener('click', () => {
    const type = exportBtn.getAttribute('data-export-type');
    const selected = Array.from(document.querySelectorAll('.export-checkbox:checked'));
    if (!selected.length) return Swal.fire('Προσοχή', 'Δεν επιλέξατε πιστοποιητικά.', 'info');

    const certs = selected.map(cb => {
      const card = cb.closest('.cert-card');
      return {
        title: card.dataset.title || '',
        type: card.dataset.type || '',
        date: card.dataset.date || '',
        supplier: card.dataset.supplier || ''
      };
    });

    if (type === 'excel') {
      import('https://cdn.sheetjs.com/xlsx-latest/package/xlsx.mjs').then(XLSX => {
        const ws = XLSX.utils.json_to_sheet(certs.map(cert => ({
          'ΤΙΤΛΟΣ': cert.title,
          'ΤΥΠΟΣ': cert.type,
          'ΗΜΕΡΟΜΗΝΙΑ ΛΗΞΗΣ': cert.date,
          'ΕΠΩΝΥΜΙΑ ΠΡΟΜΗΘΕΥΤΗ': cert.supplier
        })));
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Πιστοποιητικά');
        XLSX.writeFile(wb, 'certificates_export.xlsx');
      });
    } else if (type === 'pdf') {
      import('../../features/certificates/download.js').then(module => {
        module.downloadSelectedCertificates(certs);
      });
    }
  });

  try {
    // Fetch session and profile
    const { data: sessionData } = await authService.getSession();
    currentUser = sessionData?.session?.user;
    if (!currentUser) throw new Error('Μη έγκυρη συνεδρία.');

    const { data: profile, error: profileErr } = await supplierService.table()
          .select('name, afm')
          .eq('user_id', currentUser.id)
          .maybeSingle();
        if (profileErr) throw profileErr;

        if (!hasRequiredAfm(profile)) {
          Swal.fire('Σφάλμα', 'Το προφίλ σου δεν έχει δηλωμένο ΑΦΜ. Δεν μπορεί να αποθηκευτεί το πιστοποιητικό.', 'error');
          hideLoading();
          return;
        }

    const displayName = profile?.name || currentUser.email;
    const userGreeting = document.getElementById('userGreeting');
    if (userGreeting) userGreeting.textContent = `Καλώς ήρθες, ${displayName}`;

    document.getElementById('addCertFixed').addEventListener('click', showCreateModal);
    document.getElementById('logoutBtn')?.addEventListener('click', async () => {
      const result = await Swal.fire({
        title: 'Αποσύνδεση',
        text: 'Θέλεις σίγουρα να αποσυνδεθείς;',
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Ναι, αποσύνδεση',
        cancelButtonText: 'Ακύρωση'
      });
      if (result.isConfirmed) {
        sessionStorage.removeItem('sawPopupOnce');
        await authService.signOut();
        window.location.href = '/index.html';
      }
    });
    document.getElementById('notifyBtn')?.addEventListener('click', showExpirationPopup);
    document.getElementById('userSettingsBtn')?.addEventListener('click', () => window.location.href = '/pages/supplier/profile.html');

    document.getElementById('filterBlocked')?.addEventListener('click', () => {
  ['filterBlocked', 'filterActive', 'filterAll'].forEach(id => {
    document.getElementById(id)?.classList.remove('underline', 'text-red-600', 'text-green-600', 'text-blue-600');
  });
  const btn = document.getElementById('filterBlocked');
  btn?.classList.add('underline', 'text-red-600');
  loadCompanies();
});;
    document.getElementById('filterActive')?.addEventListener('click', () => {
  ['filterBlocked', 'filterActive', 'filterAll'].forEach(id => {
    document.getElementById(id)?.classList.remove('underline', 'text-red-600', 'text-green-600', 'text-blue-600');
  });
  const btn = document.getElementById('filterActive');
  btn?.classList.add('underline', 'text-green-600');
  loadCompanies();
});;
    document.getElementById('filterAll')?.addEventListener('click', () => {
  ['filterBlocked', 'filterActive', 'filterAll'].forEach(id => {
    document.getElementById(id)?.classList.remove('underline', 'text-red-600', 'text-green-600', 'text-blue-600');
  });
  const btn = document.getElementById('filterAll');
  btn?.classList.add('underline', 'text-blue-600');
  loadCompanies();
});;

    await loadCompanies();
lucide.createIcons();
document.getElementById('searchInput')?.addEventListener('input', () => loadCertificates());
document.getElementById('visibilityFilter')?.addEventListener('change', () => loadCertificates());
    await loadCertificates();
  }
  catch (err) {
    handleError(err);
  }
}


// Φόρτωση πιστοποιητικών
export async function loadCertificates() {
  const searchTerm = document.getElementById('searchInput')?.value.toLowerCase() || '';
  const visibility = document.getElementById('visibilityFilter')?.value || 'all';
  document.getElementById('loadingCertificates').classList.remove('hidden');
  document.getElementById('noCertificatesMessage').classList.add('hidden');
  document.getElementById('certContainer').classList.add('hidden');

  try {
    const { data, error } = await certificateService.supplier()
      .select('*')
      .eq('supplier_user_id', currentUser.id)
      
      .order('date', { ascending: false });

    
    if (error) throw error;

    const today = new Date();
    const filtered = data.filter(cert => {
      const match = `${cert.title || ''} ${cert.type || ''} ${cert.supplier_afm || ''}`.toLowerCase();
      const matchesVisibility = visibility === 'all' || (visibility === 'private' ? !!cert.is_private : !cert.is_private);
      return match.includes(searchTerm) && matchesVisibility;
    });

    const { total, active, soon, expired } = certificateStats(filtered, today);
    document.getElementById('stat-total').textContent = total;
{ const el = document.getElementById('stat-total')?.parentElement; if (el) el.onclick = () => { renderFiltered(filtered); highlightStat('stat-total'); }; }

document.getElementById('stat-active').textContent = active;
{ const el = document.getElementById('stat-active')?.parentElement; if (el) el.onclick = () => { renderFiltered(filterCertificatesByStatus(filtered, 'active', today)); highlightStat('stat-active'); }; }

document.getElementById('stat-soon').textContent = soon;
{ const el = document.getElementById('stat-soon')?.parentElement; if (el) el.onclick = () => { renderFiltered(filterCertificatesByStatus(filtered, 'soon', today)); highlightStat('stat-soon'); }; }

document.getElementById('stat-expired').textContent = expired;

// Προσθήκη cursor-pointer και hover ring στατιστικών
['stat-total', 'stat-active', 'stat-soon', 'stat-expired'].forEach(id => {
  const el = document.getElementById(id)?.parentElement;
  if (el) {
    el.classList.add('cursor-pointer', 'hover:ring', 'hover:ring-offset-1', 'hover:ring-blue-300');
  }
});
{ const el = document.getElementById('stat-expired')?.parentElement; if (el) el.onclick = () => { renderFiltered(filterCertificatesByStatus(filtered, 'expired', today)); highlightStat('stat-expired'); }; }

    const grid = document.getElementById('certContainer');
    grid.innerHTML = '';

function highlightStat(activeId) {
  const ids = ['stat-total', 'stat-active', 'stat-soon', 'stat-expired'];
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.remove('ring-2', 'ring-blue-500');
  });
  const active = document.getElementById(activeId);
  if (active) active.classList.add('ring-2', 'ring-blue-500');
}

function renderFiltered(list) {
  grid.innerHTML = `<div class="ct-certificate-head"><span>Πιστοποιητικό</span><span>Τύπος</span><span>Λήξη</span><span>Κατάσταση</span><span>Ενέργειες</span></div>`;
  list.forEach(cert => {
    const expDate = new Date(cert.date);
    const diffDays = daysUntil(cert.date, today);
    const status = diffDays < 0 ? ['expired','Ληγμένο','ct-status--danger'] : diffDays <= 30 ? ['soon',`Σε ${diffDays} ημέρες`,'ct-status--warning'] : ['active','Ενεργό','ct-status--success'];
    const privacy = cert.is_private ? '<span class="ct-status ct-status--neutral">Ιδιωτικό</span>' : '<span class="ct-status ct-status--info">Σε συνεργάτες</span>';
    const row = document.createElement('article');
    row.className = `ct-certificate-row cert-card border-${status[0]}`;
    row.dataset.id = cert.id;
    row.dataset.title = cert.title || '';
    row.dataset.type = cert.type || '';
    row.dataset.date = cert.date || '';
    row.dataset.supplier = cert.supplier_name || cert.company_name || '';
    row.innerHTML = `<div class="ct-certificate-main"><div class="ct-certificate-icon"><i data-lucide="file-text"></i></div><div class="ct-certificate-title"><strong>${escapeHtml(cert.title || 'Χωρίς τίτλο')}</strong><span>${escapeHtml(cert.name || 'PDF')} ${privacy}</span></div></div><div class="ct-certificate-cell">${escapeHtml(cert.type || '—')}</div><div class="ct-certificate-cell">${expDate.toLocaleDateString('el-GR')}</div><div><span class="ct-status ${status[2]}">${status[1]}</span></div><div class="ct-certificate-actions"><button class="ct-row-action view-btn" data-ref="${escapeHtml(cert.file_url || '')}" data-title="${escapeHtml(cert.title || '')}" title="Προβολή"><i data-lucide="eye"></i></button><button class="ct-row-action edit-btn" data-id="${cert.id}" title="Επεξεργασία"><i data-lucide="pencil"></i></button><button class="ct-row-action ct-row-action--danger delete-btn" data-id="${cert.id}" data-ref="${escapeHtml(cert.file_url || '')}" title="Διαγραφή"><i data-lucide="trash-2"></i></button></div>`;
    if (grid.getAttribute('data-export-mode') === 'true') ensureSelectionCheckbox(row, () => { const anyChecked = document.querySelectorAll('.export-checkbox:checked').length > 0; document.getElementById('downloadBtn')?.classList.toggle('hidden', !anyChecked); });
    grid.appendChild(row);
  });
  bindCertificateActions();
  window.lucide?.createIcons();
}

renderFiltered(filtered);
    document.getElementById('certContainer').classList.remove('hidden');
    /* bindCertificateActions(); */
    updateNotifications(data);
    lucide.createIcons();

    // Ενεργοποίηση checkbox εάν είμαστε σε λειτουργία εξαγωγής
    if (document.getElementById('certContainer')?.getAttribute('data-export-mode') === 'true') {
      document.querySelectorAll('.export-checkbox').forEach(cb => cb.classList.remove('hidden'));
    }
  } catch (err) {
    handleError(err);
  } finally {
    document.getElementById('loadingCertificates').classList.add('hidden');
  }
}

function bindCertificateActions() {
  async function handleViewClick(btn) {
    try {
      await openCertificatePreview('suppliercertificates', btn.dataset.ref, btn.dataset.title || 'Προβολή πιστοποιητικού');
    } catch (err) {
      handleError(err);
    }
  }

  function handleDeleteClick(btn) {
    Swal.fire({
      title: 'Διαγραφή Πιστοποιητικού',
      text: 'Είσαι σίγουρος/η;',
      icon: 'warning',
      showCancelButton: true
    }).then(async result => {
      if (result.isConfirmed) {
        try {
          showLoading();
          const fileRef = btn.dataset.ref;
          await removeCertificateObject('suppliercertificates', fileRef);
          await certificateService.supplier().delete().eq('id', btn.dataset.id);
          await loadCertificates();
          Swal.fire('Διαγραφή', 'Το πιστοποιητικό διαγράφηκε επιτυχώς', 'success');
        } catch (err) {
          handleError(err);
        } finally {
          hideLoading();
        }
      }
    });
  }

  function handleEditClick(btn) {
    certificateService.supplier().select('*').eq('id', btn.dataset.id).then(async ({ data: certs }) => {
      const cert = certs[0];
      const { value } = await Swal.fire({
        didOpen: () => {
          const popup = Swal.getPopup();
          const visibility = popup.querySelector('#swal-visibility');
          const select = popup.querySelector('#swal-type');
          const custom = popup.querySelector('#custom-type');
          if (visibility) visibility.value = cert.is_private ? 'private' : 'shared';
          const known = [...select.options].some(o => o.value === cert.type && o.value !== 'Άλλο');
          select.value = known ? cert.type : 'Άλλο';
          custom.classList.toggle('hidden', known);
          if (!known) custom.value = cert.type || '';
          select.addEventListener('change', () => custom.classList.toggle('hidden', select.value !== 'Άλλο'));
        },
        title: 'Επεξεργασία Πιστοποιητικού',
        html: `
          <input id="swal-title" class="swal2-input" value="${escapeHtml(cert.title)}">
          <select id="swal-type" class="swal2-select mb-2" onchange="document.getElementById('custom-type')?.classList.toggle('hidden', this.value !== 'Άλλο')">
            <option value="Πιστοποιητικό">Πιστοποιητικό</option>
            <option value="Απόφαση">Απόφαση</option>
            <option value="Νομιμοποιητικό έγγραφο">Νομιμοποιητικό έγγραφο</option>
            <option value="Ανάλυση">Ανάλυση</option>
            <option value="CE">CE</option>
            <option value="Στοιχεία προϊόντος">Στοιχεία προϊόντος</option>
            <option value="Άλλο">Άλλο</option>
          </select>
          <input id="custom-type" class="swal2-input hidden" placeholder="Καταχώρησε την κατηγορία σου">
          <input id="swal-date" type="date" class="swal2-input" value="${cert.date}">
<input id="swal-file" type="file" accept="application/pdf" class="swal2-file mt-2" />
<div class="ct-swal-field">
  <label for="swal-visibility">Ορατότητα</label>
  <select id="swal-visibility" class="swal2-select">
    <option value="shared">Διαθέσιμο στις συνεργαζόμενες εταιρείες</option>
    <option value="private">Ιδιωτικό — μόνο στη δική μου λίστα</option>
  </select>
</div>
<div class="ct-visibility-help"><strong>Ιδιωτικό έγγραφο</strong><span>Παραμένει στη λίστα σου, αλλά δεν εμφανίζεται σε καμία συνεργαζόμενη εταιρεία και δεν υπολογίζεται ως διαθέσιμο για εκείνη.</span></div>
        `,
        focusConfirm: false,
        showCancelButton: true,
        preConfirm: () => {
          const title = document.getElementById('swal-title').value.trim();
          const rawType = document.getElementById('swal-type').value;
          const type = rawType === 'Άλλο' ? document.getElementById('custom-type').value.trim() : rawType;
          const date = document.getElementById('swal-date').value;
          const is_private = document.getElementById('swal-visibility')?.value === 'private';
          const file = document.getElementById('swal-file')?.files?.[0] || null;
          if (!title || !type || !date) { Swal.showValidationMessage('Συμπλήρωσε τίτλο, τύπο και ημερομηνία λήξης.'); return false; }
          return { id: cert.id, title, type, date, is_private, file };
        }
      });
      if (value) {
  const { file, ...updates } = value;
  if (file) {
    const ext = file.name.split('.').pop();
    const uuid = crypto.randomUUID();
    const path = `${currentUser.id}/${uuid}.${ext}`;
    const { error: uploadError } = await storageService.upload('suppliercertificates', path, file, { upsert: true });
    if (uploadError) throw uploadError;
    updates.file_url = path;
    updates.name = file.name;
  }
updates.is_private = value.is_private;
const { error: updateErr } = await certificateService.supplier().update(updates).eq('id', value.id);
if (updateErr) throw updateErr;

// 🧹 Διαγραφή ειδοποιήσεων για το ενημερωμένο πιστοποιητικό
const { error: delErr } = await notificationService.supplier().delete().eq('certificate_id', value.id);
if (delErr) console.error('Σφάλμα διαγραφής ειδοποίησης:', delErr);
        await loadCertificates();
      }
    });
  }

  document.querySelectorAll('.view-btn').forEach(btn => btn.addEventListener('click', () => handleViewClick(btn)));
  document.querySelectorAll('.delete-btn').forEach(btn => btn.addEventListener('click', () => handleDeleteClick(btn)));
  document.querySelectorAll('.edit-btn').forEach(btn => btn.addEventListener('click', () => handleEditClick(btn)));
}


function updateNotifications(data) {
  const fromProfile = sessionStorage.getItem('fromProfile');
const hasSeenPopup = sessionStorage.getItem('sawPopupOnce');
if (fromProfile) {
  sessionStorage.removeItem('fromProfile');
  return;
}
if (hasSeenPopup) return;
  const countEl = document.getElementById('notifyCount');
  const soon = data.filter(c => {
    const diff = daysUntil(c.date);
    return diff >= 0 && diff <= 30;
  });
  countEl.textContent = soon.length;
  countEl.classList.toggle('hidden', soon.length === 0);
  if (soon.length > 0 && !fromProfile && !sessionStorage.getItem('sawPopupOnce')) {
    sessionStorage.setItem('sawPopupOnce', 'true');
    showExpirationPopup();
  }
}

async function showExpirationPopup() {
  const { data } = await certificateService.supplier()
    .select('*')
    .eq('supplier_user_id', currentUser.id)
    .order('date', { ascending: false });

  const soon = data.filter(c => {
    const diff = daysUntil(c.date);
    return diff >= 0 && diff <= 30;
  });

  const { data: supProfile, error: supErr } = await supplierService.table()
    .select('id')
    .eq('user_id', currentUser.id)
    .maybeSingle();

  if (supErr || !supProfile) return;
  const supplierId = supProfile.id;

  Swal.fire({
    title: 'Ειδοποιήσεις λήξης',
    html: soon.length
      ? `<p>Έχεις ${soon.length} πιστοποιητικά που λήγουν εντός 30 ημερών:</p><ul style='text-align: left;'>${soon.map(c => `<li>• <b>${c.title}</b> (${new Date(c.date).toLocaleDateString('el-GR')})</li>`).join('')}</ul>`
      : 'Δεν υπάρχουν πιστοποιητικά προς λήξη.',
    icon: soon.length ? 'warning' : 'info'
  });
}

async function loadCompanies() {
  const listEl = document.getElementById('myCompaniesList');
  if (!listEl) return;
  listEl.innerHTML = '<li class="text-center text-gray-500">Φόρτωση...</li>';
  try {
    // Ανάκτηση supplier.id
    const { data: supRec, error: supErr } = await supplierService.table()
      .select('id')
      .eq('user_id', currentUser.id)
      .maybeSingle();
    if (supErr) throw supErr;
    const supplierId = supRec?.id;
    if (!supplierId) {
      listEl.innerHTML = '<li class="text-center text-gray-500">Δεν υπάρχει καταχωρημένος προμηθευτής.</li>';
      return;
    }
    // Ανάκτηση company_ids
    const { data: rels, error: relsErr } = await relationshipService.table()
      .select('company_id, access')
      .eq('supplier_id', supplierId)
      ;
    if (relsErr) throw relsErr;
    const companyIds = rels.map(r => r.company_id);
    if (!companyIds.length) {
      listEl.innerHTML = '<li class="text-center text-gray-500">Δεν βρέθηκαν εταιρείες για αυτόν τον προμηθευτή.</li>';
      return;
    }
    // Ανάκτηση στοιχείων εταιρειών
    const { data: companies, error: compsErr } = await companyService.table()
      .select('id, name, afm')
      .in('id', companyIds);
    if (compsErr) throw compsErr;
    // Render list
    const isBlockedView = document.getElementById('filterBlocked')?.classList.contains('underline');
const isActiveView = document.getElementById('filterActive')?.classList.contains('underline');
const isAllView = document.getElementById('filterAll')?.classList.contains('underline');
 // ✅ deduplicated
    
listEl.innerHTML = companies.map(c => {
  const rel = rels.find(r => r.company_id === c.id);
  const isBlocked = rel?.access === 'blocked';
  if (!isAllView) {
    if (isBlockedView && !isBlocked) return '';
    if (isActiveView && isBlocked) return '';
  }
  return `
    <li class="flex justify-between items-center py-1">
      <span class="${isBlocked ? 'text-red-500' : ''}">• ${c.name} (${c.afm})</span>
      <button data-id="${c.id}" data-access="${rel?.access}" class="block-btn text-xs ${isBlocked ? 'text-green-600' : 'text-red-500'} hover:opacity-80" title="${isBlocked ? 'Επαναφορά Πρόσβασης' : 'Αποκλεισμός Εταιρείας'}">
        <i data-lucide="${isBlocked ? 'rotate-ccw' : 'user-x'}" class="w-4 h-4"></i>
      </button>
    </li>
  `;
}).join('');
lucide.createIcons();

  document.querySelectorAll('.block-btn').forEach(btn => {
  btn.addEventListener('click', async () => {
    const companyId = btn.dataset.id;
    const iconEl = btn.querySelector('i');
const currentAccess = btn.getAttribute('data-access');
const isBlocked = currentAccess === 'blocked';
const newAccess = isBlocked ? 'granted' : 'blocked';
const title = isBlocked ? 'Επαναφορά Πρόσβασης' : 'Αποκλεισμός Εταιρείας';
const text = isBlocked
  ? 'Θέλεις να επαναφέρεις την πρόσβαση αυτής της εταιρείας στα πιστοποιητικά σου;'
  : 'Θέλεις να αποκλείσεις αυτή την εταιρεία από την πρόσβαση στα πιστοποιητικά σου;';
const confirmButtonText = isBlocked ? 'Ναι, επαναφορά' : 'Αποκλεισμός';
const successMessage = isBlocked
  ? 'Η εταιρεία έχει πλέον πρόσβαση στα πιστοποιητικά σου.'
  : 'Η εταιρεία αποκλείστηκε από την πρόσβαση στα πιστοποιητικά σου.';

    const { isConfirmed } = await Swal.fire({
      title,
      text,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText
    });

    if (!isConfirmed) return;

    try {
      const { data: supRec, error: supErr } = await supplierService.table()
        .select('id')
        .eq('user_id', currentUser.id)
        .maybeSingle();
      if (supErr || !supRec?.id) throw supErr || new Error('Προμηθευτής δεν βρέθηκε.');

      const { error } = await relationshipService.table()
        .update({ access: newAccess })
        .eq('company_id', companyId)
        .eq('supplier_id', supRec.id);

      if (error) throw error;

      Swal.fire('Ολοκληρώθηκε', successMessage, 'success');

// Ενημέρωση κουμπιού χωρίς reload
btn.setAttribute('data-access', newAccess);
btn.setAttribute('data-access', newAccess);
const parentLi = btn.closest('li');
const nameSpan = parentLi?.querySelector('span');
if (nameSpan) {
  nameSpan.classList.remove('text-red-500');
  if (newAccess === 'blocked') nameSpan.classList.add('text-red-500');
}
btn.innerHTML = `<i data-lucide="${newAccess === 'granted' ? 'user-x' : 'rotate-ccw'}" class="w-4 h-4"></i>`;
btn.classList.remove('text-red-500', 'text-green-600');
btn.classList.add(newAccess === 'granted' ? 'text-red-500' : 'text-green-600');
btn.classList.toggle('text-red-500', newAccess === 'granted');
btn.classList.toggle('text-green-600', newAccess === 'blocked');
lucide.createIcons();
btn.classList.toggle('text-red-500', newAccess === 'granted');
btn.classList.toggle('text-green-600', newAccess === 'blocked');
lucide.createIcons();
    } catch (err) {
      console.error('❌ Σφάλμα:', err);
      Swal.fire('Σφάλμα', 'Κάτι πήγε στραβά. Προσπάθησε ξανά.', 'error');
    }
  });
});
} catch (err) {
    console.error('loadCompanies error:', err);
    listEl.innerHTML = '<li class="text-red-500">Σφάλμα φόρτωσης εταιρειών.</li>';
  }
}

    // Φόρτωση εταιρειών μέσω join έχει πλέον αφαιρεθεί, καθώς χρησιμοποιείται η απλή loadCompanies

function showCreateModal() {
  Swal.fire({
    title: 'Νέο Πιστοποιητικό',
    html: `
      <input id="swal-title" class="swal2-input" placeholder="Τίτλος">
      <select id="swal-type" class="swal2-select mb-2" onchange="document.getElementById('custom-type')?.classList.toggle('hidden', this.value !== 'Άλλο')">
        <option value="Πιστοποιητικό">Πιστοποιητικό</option>
        <option value="Απόφαση">Απόφαση</option>
        <option value="Νομιμοποιητικό έγγραφο">Νομιμοποιητικό έγγραφο</option>
        <option value="Ανάλυση">Ανάλυση</option>
        <option value="CE">CE</option>
        <option value="Στοιχεία προϊόντος">Στοιχεία προϊόντος</option>
        <option value="Άλλο">Άλλο</option>
      </select>
      <input id="custom-type" class="swal2-input hidden" placeholder="Καταχώρησε την κατηγορία σου">
      <input id="swal-date" type="date" class="swal2-input">

      <input id="swal-file" type="file" accept="application/pdf" class="swal2-file mt-2" />
<div class="ct-swal-field">
  <label for="swal-visibility">Ορατότητα</label>
  <select id="swal-visibility" class="swal2-select">
    <option value="shared">Διαθέσιμο στις συνεργαζόμενες εταιρείες</option>
    <option value="private">Ιδιωτικό — μόνο στη δική μου λίστα</option>
  </select>
</div>
<div class="ct-visibility-help"><strong>Ιδιωτικό έγγραφο</strong><span>Παραμένει στη λίστα σου, αλλά δεν εμφανίζεται σε καμία συνεργαζόμενη εταιρεία και δεν υπολογίζεται ως διαθέσιμο για εκείνη.</span></div>
      <div id="swal-preview" class="mt-4 overflow-auto max-h-[300px] border rounded"></div>
    `,
    focusConfirm: false,
    showCancelButton: true,
    didOpen: () => {
      const popup = Swal.getPopup();
      const fileInput = popup.querySelector('#swal-file');
      const previewBox = popup.querySelector('#swal-preview');
      const typeSelect = popup.querySelector('#swal-type');
      const customType = popup.querySelector('#custom-type');
      typeSelect?.addEventListener('change', () => customType?.classList.toggle('hidden', typeSelect.value !== 'Άλλο'));
      fileInput.addEventListener('change', () => {
        const file = fileInput.files[0];
        if (file && file.type === 'application/pdf') {
          const url = URL.createObjectURL(file);
          previewBox.innerHTML = `<iframe src="${url}#toolbar=0&navpanes=0" class="ct-preview-frame" title="Προεπισκόπηση νέου πιστοποιητικού"></iframe>`;
        } else {
          previewBox.innerHTML = '';
        }
      });
    },
    preConfirm: () => {
      const title = document.getElementById('swal-title').value;
      const rawType = document.getElementById('swal-type').value;
      const type = rawType === 'Άλλο' ? document.getElementById('custom-type').value : rawType;
      const date = document.getElementById('swal-date').value;
      const file = document.getElementById('swal-file').files[0];
      if (!title || !type || !date || !file) {
        Swal.showValidationMessage('Συμπλήρωσε όλα τα πεδία και ανέβασε PDF');
        return false;
      }
      if (type === 'Άλλο' && !document.getElementById('custom-type').value.trim()) {
  Swal.showValidationMessage('Συμπλήρωσε την προσαρμοσμένη κατηγορία σου.');
  return false;
}
const is_private = document.getElementById('swal-visibility')?.value === 'private';
return { title, type, date, file, is_private };
    }
  }).then(async (res) => {
    if (res.isConfirmed) {
      try {
        showLoading();
        const { title, type, date, file, is_private } = res.value;
        const ext = file.name.split('.').pop();
        const uuid = crypto.randomUUID();
        const path = `${currentUser.id}/${uuid}.${ext}`;
        const { error: upErr } = await storageService.upload('suppliercertificates', path, file);
        if (upErr) throw upErr;

        const { data: profile, error: profileErr } = await supplierService.table()
          .select('id, name, afm')
          .eq('user_id', currentUser.id)
          .maybeSingle();
        if (profileErr) throw profileErr;

        const { error: insertErr } = await certificateService.supplier()
          .insert([{ supplier_user_id: currentUser.id, supplier_id: profile?.id || null, title, type, date, file_url: path, supplier_email: currentUser.email, name: file.name, supplier_name: profile?.name || currentUser.email, supplier_afm: profile?.afm || '', created_at: new Date().toISOString(), is_private: is_private }]);
        if (insertErr) throw insertErr;
        await loadCertificates();
        Swal.fire('Επιτυχία', 'Το πιστοποιητικό αποθηκεύτηκε επιτυχώς', 'success');
      } catch (err) {
        handleError(err);
      } finally {
        hideLoading();
      }
    }
  });
}


