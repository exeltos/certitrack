import { isDemo } from '../../demo/demoSession.js';
import { renderSupplierDetailDemo } from '../../demo/realScreenDemo.js';
import { authService } from '../../services/authService.js';
import { daysUntil } from '../../core/certificateCore.js';
import { openCertificatePreview } from '../../core/certificateStorage.js';
import { escapeHtml } from '../../core/certificateCore.js';

import { certificateService } from '../../services/certificateService.js';
import { companyService } from '../../services/companyService.js';
import { relationshipService } from '../../services/relationshipService.js';
import { supplierService } from '../../services/supplierService.js';
// suppliers_view.js
import { showLoading, hideLoading, handleError } from '../../shared/common.js';

document.addEventListener('DOMContentLoaded', async () => {
  if (isDemo('company')) {
    renderSupplierDetailDemo();
    return;
  }
  document.addEventListener('change', () => {
    const anyChecked = document.querySelectorAll('.export-checkbox:checked').length > 0;
    const downloadBtn = document.getElementById('realDownloadBtn');
    if (downloadBtn) downloadBtn.classList.toggle('hidden', !anyChecked);
  });
  document.getElementById('realDownloadBtn')?.addEventListener('click', async () => {
    const type = window.selectedExportType;
    const selected = [...document.querySelectorAll('.export-checkbox:checked')];
    if (!selected.length) {
      Swal.fire('Προσοχή', 'Δεν επιλέχθηκαν πιστοποιητικά.', 'info');
      return;
    }

    const certs = selected.map(cb => {
      const card = cb.closest('div');
      return {
        title: card.querySelector('.font-semibold')?.textContent.trim() || '',
        type: card.querySelector('.text-sm')?.textContent.trim() || '',
        date: card.querySelectorAll('.text-sm')[1]?.textContent.trim() || '',
        afm: ''
      };
    });

    if (type === 'excel') {
      const XLSX = await import('https://cdn.sheetjs.com/xlsx-latest/package/xlsx.mjs');
      const exportData = certs.map(c => ({
  'Τίτλος': c.title,
  'Τύπος': c.type.replace('Τύπος: ', ''),
  'Ημ. Λήξης': c.date.replace('Ημερομηνία λήξης: ', '')
}));
const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Πιστοποιητικά');
      XLSX.writeFile(wb, 'certificates_export.xlsx');
    } else if (type === 'pdf') {
      const jsPDF = (await import('https://cdn.skypack.dev/jspdf')).default;
      const zip = new (await import('https://cdn.jsdelivr.net/npm/jszip@3.7.1/+esm')).default();

      for (const cert of certs) {
        const doc = new jsPDF();
        doc.setFontSize(14);
        doc.text(`Τίτλος: ${cert.title}`, 10, 20);
        doc.text(`Τύπος: ${cert.type}`, 10, 30);
        doc.text(`Ημερομηνία: ${cert.date}`, 10, 40);
        const blob = doc.output('blob');
        zip.file(`${cert.title}.pdf`, blob);
      }

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'certificates.zip';
      a.click();
      URL.revokeObjectURL(url);
    }
  });
  document.getElementById('selectAllBtn')?.addEventListener('click', () => {
  const checkboxes = document.querySelectorAll('.export-checkbox');
  const allChecked = Array.from(checkboxes).every(cb => cb.checked);
  checkboxes.forEach(cb => {
    cb.checked = !allChecked;
  });

  // έλεγχος μετά την επιλογή
  const anyChecked = document.querySelectorAll('.export-checkbox:checked').length > 0;
  const downloadBtn = document.getElementById('realDownloadBtn');
  if (downloadBtn) downloadBtn.classList.toggle('hidden', !anyChecked);
});
  });
  document.getElementById('downloadBtn')?.addEventListener('click', () => {
  const container = document.getElementById('certificatesContainer');
  const isExportMode = container.getAttribute('data-export-mode') === 'true';

  if (isExportMode) {
    // Ακύρωση εξαγωγής
    container.setAttribute('data-export-mode', 'false');
    document.querySelectorAll('.export-checkbox').forEach(cb => cb.remove());
    document.querySelectorAll('#certGrid > div').forEach(card => {
      card.classList.add('cursor-pointer');
    });
    document.getElementById('selectAllBtn')?.classList.add('hidden');
    document.getElementById('realDownloadBtn')?.classList.add('hidden');
    return;
  }

  window.selectedExportType = null;
  Swal.fire({
      title: 'Επιλέξτε Τύπο Εξαγωγής',
      input: 'select',
      inputOptions: {
        excel: 'Excel (.xlsx)',
        pdf: 'PDF (.pdf)'
      },
      inputPlaceholder: 'Τύπος αρχείου',
      showCancelButton: true,
      confirmButtonText: 'Συνέχεια'
    }).then(result => {
      if (!result.isConfirmed) return;
      const type = result.value;
      const container = document.getElementById('certificatesContainer');
      const grid = document.getElementById('certGrid');
      container.setAttribute('data-export-mode', 'true');

      const actionsRow = document.getElementById('certEmailActions');
      if (actionsRow) actionsRow.classList.remove('hidden');

      const selectAllBtn = document.getElementById('selectAllBtn');
      const realDownloadBtn = document.getElementById('realDownloadBtn');
      if (selectAllBtn) selectAllBtn.classList.remove('hidden');
      if (realDownloadBtn) realDownloadBtn.classList.add('hidden');

      document.querySelectorAll('#certGrid > div').forEach(card => {
  let checkbox = card.querySelector('.export-checkbox');
  card.classList.remove('cursor-pointer');
  card.onclick = null;

  if (!checkbox) {
    checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'export-checkbox absolute top-2 right-2 w-5 h-5 accent-blue-600';
    card.classList.add('relative');
    checkbox.addEventListener('click', (e) => e.stopPropagation());
    card.appendChild(checkbox);
  } else {
    checkbox.classList.remove('hidden');
        checkbox.addEventListener('change', () => {
          const anyChecked = document.querySelectorAll('.export-checkbox:checked').length > 0;
          if (realDownloadBtn) realDownloadBtn.classList.toggle('hidden', !anyChecked);
        });
  }
});

      window.selectedExportType = result.value;

      // ελέγχει αν πρέπει να εμφανιστεί το κουμπί λήψης
      const anyChecked = document.querySelectorAll('.export-checkbox:checked').length > 0;
      if (realDownloadBtn) realDownloadBtn.classList.toggle('hidden', !anyChecked);
    });
  });
  document.getElementById('searchInput')?.addEventListener('input', (e) => {
    const value = e.target.value.trim().toLowerCase();
    const container = document.getElementById('certificatesContainer');
    const certs = JSON.parse(container.getAttribute('data-certificates') || '[]');

    const filtered = certs.filter(cert =>
      cert.title.toLowerCase().includes(value)
    );

    filterCertificates('all'); // επανεμφανίζει με όλα
    if (value) {
      const event = new CustomEvent('filteredCertificates', { detail: filtered });
      window.dispatchEvent(event);
    }
  });
  lucide.createIcons();

  // ➕ Προσθήκη λειτουργίας στο κουμπί "Αποθήκευση"
  const saveBtn = document.getElementById('saveBtn');
if (saveBtn) {
  const supplierStatus = document.getElementById('input-email')?.disabled;
  if (supplierStatus) saveBtn.classList.add('hidden');
  saveBtn.addEventListener('click', async () => {
    const name = document.getElementById('input-name')?.value.trim();
    const email = document.getElementById('input-email')?.value.trim();
    const afm = document.getElementById('input-afm')?.value.trim();

    if (!name || !email || !afm) {
      Swal.fire('Προσοχή', 'Συμπλήρωσε όλα τα πεδία.', 'warning');
      return;
    }

    const confirm = await Swal.fire({
      title: 'Ενημέρωση Προμηθευτή',
      text: 'Θέλεις να αποθηκευτούν οι αλλαγές;',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Ναι, αποθήκευση',
      cancelButtonText: 'Ακύρωση'
    });

    if (!confirm.isConfirmed) return;

    try {
      showLoading();
      const { error } = await supplierService.table()
        .update({ name, email, afm })
        .eq('id', supplierId);
      if (error) throw error;
      Swal.fire('Επιτυχία', 'Τα στοιχεία ενημερώθηκαν.', 'success');
    } catch (err) {
      handleError(err);
    } finally {
      hideLoading();
    }
    });
}

  const urlParams = new URLSearchParams(window.location.search);
  const supplierId = urlParams.get('id');

  const deleteBtn = document.getElementById('deleteSupplierBtn');
  if (deleteBtn && supplierId) {
    deleteBtn.addEventListener('click', () => deleteSupplier(supplierId));
  }

  if (!supplierId) {
  console.warn('Δεν δόθηκε supplierId μέσω URL');
} else {
  (async () => {
    const supplier = await viewSupplierDetails(supplierId);
    if (supplier) await loadSupplierCertificates(supplier);
  })();
}

async function viewCertificate(fileRef, title) {
  try {
    await openCertificatePreview('suppliercertificates', fileRef, title || 'Προβολή πιστοποιητικού');
  } catch (err) {
    handleError(err);
  }
}

window.viewCertificate = viewCertificate;

function confirmDelete(event, certificateId) {
  event.stopPropagation();
  Swal.fire({
    title: 'Επιβεβαίωση διαγραφής',
    text: 'Είστε σίγουρος ότι θέλετε να διαγράψετε αυτό το πιστοποιητικό;',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'Ναι, διαγραφή',
    cancelButtonText: 'Ακύρωση'
  }).then(async (result) => {
    if (result.isConfirmed) {
      const { error } = await certificateService.supplier()
        .delete()
        .eq('id', certificateId);
      if (error) return handleError(error);
      location.reload();
    }
  });
}

function deleteSupplier(supplierId) {
  Swal.fire({
    title: 'Επιβεβαίωση διαγραφής',
    text: 'Θέλετε να αφαιρέσετε τον προμηθευτή από τη λίστα της εταιρείας;',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'Ναι, διαγραφή',
    cancelButtonText: 'Ακύρωση'
  }).then(async (result) => {
    if (!result.isConfirmed) return;
    try {
      showLoading();
      // Παίρνουμε το session για το τρέχον χρήστη
      const { data: { session } } = await authService.getSession();
      const userEmail = session?.user?.email;
      if (!userEmail) throw new Error('Δεν βρέθηκε συνδεδεμένος χρήστης');

      const { data: company, error: companyErr } = await companyService.table()
        .select('id')
        .eq('email', userEmail)
        .single();
      if (companyErr || !company) throw companyErr;

      const { error } = await relationshipService.table()
        .delete()
        .eq('supplier_id', supplierId)
        .eq('company_id', company.id);
      if (error) throw error;

      await Swal.fire('Αφαιρέθηκε!', 'Ο προμηθευτής αφαιρέθηκε από τη λίστα σας.', 'success');
      location.href = '/pages/company/suppliers.html';
    } catch (err) {
      handleError(err);
    } finally {
      hideLoading();
    }
  });
}

window.deleteSupplier = deleteSupplier;


async function viewSupplierDetails(supplierId) {
  try {
    showLoading();

    const { data: supplier, error } = await supplierService.table()
      .select('*')
      .eq('id', supplierId)
      .single();
    if (error) throw error;

    const header = document.getElementById('supplierHeader');
    if (header) header.textContent = `Επωνυμία Προμηθευτή: ${supplier.name || 'Προμηθευτής'}`;
    const titleEl = document.getElementById('pageTitle');
    if (titleEl) titleEl.textContent = `CertiTrack – Επωνυμία Προμηθευτή: ${supplier.name || 'Προμηθευτής'}`;
document.title = `CertiTrack – Επωνυμία Προμηθευτή: ${supplier.name || 'Προμηθευτής'}`;
    const nameField = document.getElementById('input-name');
    const emailField = document.getElementById('input-email');
    const afmField = document.getElementById('input-afm');
    if (nameField) {
      nameField.value = supplier.name || '';
      nameField.disabled = supplier.status === '✅ Εγγεγραμμένος';
    }
    if (emailField) {
      emailField.value = supplier.email || '';
      emailField.disabled = supplier.status === '✅ Εγγεγραμμένος';
    }
    if (afmField) {
      afmField.value = supplier.afm || '';
      afmField.disabled = supplier.status === '✅ Εγγεγραμμένος';
    }
    const saveBtn = document.getElementById('saveBtn');
    if (supplier.status === '✅ Εγγεγραμμένος') saveBtn?.classList.add('hidden');
        return supplier;
  } catch (err) {
    handleError(err);
  } finally {
    hideLoading();
  }
}

function certificateStatus(cert, now = new Date()) {
  const days = daysUntil(cert.date, now);
  if (days < 0) return { key: 'expired', label: 'Ληγμένο', cls: 'ct-status--danger', days };
  if (days <= 30) return { key: 'soon', label: `Σε ${days} ημέρες`, cls: 'ct-status--warning', days };
  return { key: 'active', label: 'Ενεργό', cls: 'ct-status--success', days };
}

function renderSupplierCertificateRows(list) {
  const grid = document.getElementById('certGrid');
  if (!grid) return;
  if (!list.length) {
    grid.innerHTML = '<div class="ct-empty-block">Δεν βρέθηκαν διαθέσιμα πιστοποιητικά.</div>';
    return;
  }
  grid.innerHTML = `<div class="ct-certificate-head"><span>Πιστοποιητικό</span><span>Τύπος</span><span>Λήξη</span><span>Κατάσταση</span><span>Ενέργειες</span></div>${list.map(cert => {
    const status = certificateStatus(cert);
    return `<article class="ct-certificate-row cert-card" data-id="${escapeHtml(cert.id || '')}" data-title="${escapeHtml(cert.title || '')}" data-type="${escapeHtml(cert.type || '')}" data-date="${escapeHtml(cert.date || '')}">
      <div class="ct-certificate-main"><div class="ct-certificate-icon"><i data-lucide="file-text"></i></div><div class="ct-certificate-title"><strong>${escapeHtml(cert.title || 'Χωρίς τίτλο')}</strong><span>${escapeHtml(cert.name || 'PDF')}</span></div></div>
      <div class="ct-certificate-cell">${escapeHtml(cert.type || '—')}</div>
      <div class="ct-certificate-cell">${new Date(cert.date).toLocaleDateString('el-GR')}</div>
      <div><span class="ct-status ${status.cls}">${status.label}</span></div>
      <div class="ct-certificate-actions"><button type="button" class="ct-row-action supplier-view-btn" data-ref="${escapeHtml(cert.file_url || '')}" data-title="${escapeHtml(cert.title || '')}" title="Προβολή"><i data-lucide="eye"></i></button></div>
    </article>`;
  }).join('')}`;
  grid.querySelectorAll('.supplier-view-btn').forEach(btn => btn.addEventListener('click', () => viewCertificate(btn.dataset.ref, btn.dataset.title)));
  window.lucide?.createIcons();
}

function filterCertificates(type = 'all') {
  const container = document.getElementById('certificatesContainer');
  const certs = JSON.parse(container?.getAttribute('data-certificates') || '[]');
  const query = document.getElementById('searchInput')?.value.trim().toLowerCase() || '';
  const filtered = certs.filter(cert => {
    const status = certificateStatus(cert).key;
    const matchesStatus = type === 'all' || status === type;
    const haystack = `${cert.title || ''} ${cert.type || ''} ${cert.name || ''}`.toLowerCase();
    return matchesStatus && (!query || haystack.includes(query));
  }).sort((a,b) => certificateStatus(a).days - certificateStatus(b).days);
  renderSupplierCertificateRows(filtered);
}
window.filterCertificates = filterCertificates;

window.addEventListener('filteredCertificates', e => renderSupplierCertificateRows(e.detail || []));

async function loadSupplierCertificates(supplier) {
  if (!supplier.user_id) {
    document.getElementById('noCertificatesMessage')?.classList.remove('hidden');
    return;
  }
  try {
    const { data = [], error } = await certificateService.supplier()
      .select('*')
      .eq('supplier_user_id', supplier.user_id)
      .or('is_private.eq.false,is_private.is.null');
    if (error) throw error;

    const container = document.getElementById('certificatesContainer');
    const empty = document.getElementById('noCertificatesMessage');
    container?.setAttribute('data-certificates', JSON.stringify(data));
    empty?.classList.toggle('hidden', data.length > 0);

    const now = new Date();
    const summary = { total: data.length, active: 0, soon: 0, expired: 0 };
    data.forEach(cert => summary[certificateStatus(cert, now).key]++);
    const summaryEl = document.getElementById('certSummary');
    if (summaryEl) summaryEl.innerHTML = `<span class="ct-status ct-status--neutral">${summary.total} διαθέσιμα</span><span class="ct-status ct-status--success">${summary.active} ενεργά</span><span class="ct-status ct-status--warning">${summary.soon} προς λήξη</span><span class="ct-status ct-status--danger">${summary.expired} ληγμένα</span>`;

    if (container) container.innerHTML = '<div id="certGrid" class="ct-certificate-list"></div>';
    renderSupplierCertificateRows(data.slice().sort((a,b) => certificateStatus(a).days - certificateStatus(b).days));
  } catch (err) {
    handleError(err);
  }
}
