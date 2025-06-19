
// suppliers_view.js
import { supabase } from './supabaseClient.js';
import { showLoading, hideLoading, handleError } from './common.js';

document.addEventListener('DOMContentLoaded', async () => {
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
      const { error } = await supabase
        .from('suppliers')
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

const toggleBtn = document.getElementById('theme-toggle');
  const moonIcon = document.getElementById('icon-moon');
  const sunIcon = document.getElementById('icon-sun');
  function updateIcons() {
    const isDark = document.documentElement.classList.contains('dark');
    if (moonIcon && sunIcon) {
      moonIcon.classList.toggle('hidden', isDark);
      sunIcon.classList.toggle('hidden', !isDark);
    }
  }
  toggleBtn?.addEventListener('click', () => {
    document.documentElement.classList.toggle('dark');
    localStorage.setItem('theme', document.documentElement.classList.contains('dark') ? 'dark' : 'light');
    updateIcons();
  });

  if (
    localStorage.getItem('theme') === 'dark' ||
    (!localStorage.getItem('theme') && window.matchMedia('(prefers-color-scheme: dark)').matches)
  ) {
    document.documentElement.classList.add('dark');
  }
  updateIcons();

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

function viewCertificate(url, title) {
  Swal.fire({
    title: title,
    html: `<iframe src="${url}" class="w-full h-[80vh]" frameborder="0"></iframe>`,
    width: '90%',
    padding: '1em',
    showConfirmButton: true,
    confirmButtonText: 'Κλείσιμο'
  });
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
      const { error } = await supabase
        .from('supplier_certificates')
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
      const { data: { session } } = await supabase.auth.getSession();
      const userEmail = session?.user?.email;
      if (!userEmail) throw new Error('Δεν βρέθηκε συνδεδεμένος χρήστης');

      const { data: company, error: companyErr } = await supabase
        .from('companies')
        .select('id')
        .eq('email', userEmail)
        .single();
      if (companyErr || !company) throw companyErr;

      const { error } = await supabase
        .from('company_suppliers')
        .delete()
        .eq('supplier_id', supplierId)
        .eq('company_id', company.id);
      if (error) throw error;

      await Swal.fire('Αφαιρέθηκε!', 'Ο προμηθευτής αφαιρέθηκε από τη λίστα σας.', 'success');
      location.href = 'company_dashboard.html';
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

    const { data: supplier, error } = await supabase
      .from('suppliers')
      .select('*')
      .eq('id', supplierId)
      .single();
    if (error) throw error;

    const header = document.getElementById('supplierHeader');
    if (header) header.textContent = `Επωνυμία Προμηθευτή: ${supplier.name || 'Προμηθευτής'}`;
    const titleEl = document.getElementById('pageTitle');
    if (titleEl) titleEl.textContent = `CertiTrack – Επωνυμία Προμηθευτή: ${supplier.name || 'Προμηθευτής'}`;
document.title = `CertiTrack – Επωνυμία Προμηθευτή: ${supplier.name || 'Προμηθευτής'}`;
console.log("DEBUG: Τίτλος σελίδας =>", document.title);
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

function filterCertificates(type) {
  console.log('Φίλτρο:', type);
  const container = document.getElementById('certificatesContainer');
  const certs = JSON.parse(container.getAttribute('data-certificates'));
  const now = new Date();

  const filtered = certs.map(cert => {
    const days = Math.ceil((new Date(cert.date) - now) / (1000 * 60 * 60 * 24));
    let status = 'active';
    if (days < 0) status = 'expired';
    else if (days <= 30) status = 'soon';
    return { ...cert, _days: days, _status: status };
  }).filter(cert => type === 'all' || cert._status === type)
    .sort((a, b) => a._days - b._days);

  const html = filtered.map(cert => {
    const expDate = new Date(cert.date);
    const days = cert._days;
    let borderColor = 'border-gray-300';
    let statusText = '';
    if (days < 0) {
      borderColor = 'border-red-400';
      statusText = '<div class="text-xs font-semibold text-red-600 dark:text-red-400">ΛΗΓΜΕΝΟ</div>';
    } else if (days <= 30) {
      borderColor = 'border-yellow-500';
      statusText = '<div class="text-xs font-semibold text-yellow-700 dark:text-yellow-400">ΠΡΟΣ ΛΗΞΗ</div>';
    } else {
      statusText = '<div class="text-xs font-semibold text-green-700 dark:text-green-400">ΕΝΕΡΓΟ</div>';
    }
    return `
      <div class="w-full max-w-md border ${borderColor} rounded p-6 shadow bg-white dark:bg-gray-800 cursor-pointer" onclick="viewCertificate('${cert.file_url}', '${cert.title}')">
        <div class="font-semibold text-blue-700 dark:text-teal-300">${cert.title}</div>
        <div class="text-sm">Τύπος: ${cert.type}</div>
        <div class="text-sm">Ημερομηνία λήξης: ${expDate.toLocaleDateString('el-GR')} (${days} ημέρες)</div>
        ${statusText}
      </div>
    `;
  }).join('');

  document.getElementById('certGrid').innerHTML = html;
}

window.filterCertificates = filterCertificates;

// Ενσωμάτωση υποστήριξης αναζήτησης
window.addEventListener('filteredCertificates', (e) => {
  const filtered = e.detail;
  const html = filtered.map(cert => {
    const expDate = new Date(cert.date);
    const days = Math.ceil((expDate - new Date()) / (1000 * 60 * 60 * 24));
    let borderColor = 'border-gray-300';
    let statusText = '';
    if (days < 0) {
      borderColor = 'border-red-400';
      statusText = '<div class="text-xs font-semibold text-red-600 dark:text-red-400">ΛΗΓΜΕΝΟ</div>';
    } else if (days <= 30) {
      borderColor = 'border-yellow-500';
      statusText = '<div class="text-xs font-semibold text-yellow-700 dark:text-yellow-400">ΠΡΟΣ ΛΗΞΗ</div>';
    } else {
      statusText = '<div class="text-xs font-semibold text-green-700 dark:text-green-400">ΕΝΕΡΓΟ</div>';
    }
    return `
      <div class="w-full max-w-md border ${borderColor} rounded p-6 shadow bg-white dark:bg-gray-800 cursor-pointer" onclick="viewCertificate('${cert.file_url}', '${cert.title}')">
        <div class="font-semibold text-blue-700 dark:text-teal-300">${cert.title}</div>
        <div class="text-sm">Τύπος: ${cert.type}</div>
        <div class="text-sm">Ημερομηνία λήξης: ${expDate.toLocaleDateString('el-GR')} (${days} ημέρες)</div>
        ${statusText}
      </div>
    `;
  }).join('');
  document.getElementById('certGrid').innerHTML = html;
});

async function loadSupplierCertificates(supplier) {
  if (!supplier.user_id) {
    document.getElementById('noCertificatesMessage')?.classList.remove('hidden');
    return;
  }
  try {
    const { data, error } = await supabase
      .from('supplier_certificates')
      .select('*')
      .eq('supplier_user_id', supplier.user_id)
      .eq('is_private', false);
    if (error) throw error;

    if (!data.length) {
  document.getElementById('noCertificatesMessage')?.classList.remove('hidden');
  return;
}

    // ταξινόμηση: ληγμένα → προς λήξη → ενεργά
    data.sort((a, b) => {
      const now = new Date();
      const daysA = Math.ceil((new Date(a.date) - now) / (1000 * 60 * 60 * 24));
      const daysB = Math.ceil((new Date(b.date) - now) / (1000 * 60 * 60 * 24));

      const priority = (days) => {
        if (days < 0) return 0;
        if (days <= 30) return 1;
        return 2;
      };

      return priority(daysA) - priority(daysB);
    });

    console.log('Πιστοποιητικά:', data);

    const html = data
      .map((cert) => {
        const expDate = new Date(cert.date);
        const days = Math.ceil(
          (expDate - new Date()) / (1000 * 60 * 60 * 24)
        );
        let borderColor = 'border-gray-300';
        let statusText = '';
        if (days < 0) {
          borderColor = 'border-red-400';
          statusText =
            '<div class="text-xs font-semibold text-red-600 dark:text-red-400">ΛΗΓΜΕΝΟ</div>';
        } else if (days <= 30) {
          borderColor = 'border-yellow-500';
          statusText =
            '<div class="text-xs font-semibold text-yellow-700 dark:text-yellow-400">ΠΡΟΣ ΛΗΞΗ</div>';
        } else {
          statusText =
            '<div class="text-xs font-semibold text-green-700 dark:text-green-400">ΕΝΕΡΓΟ</div>';
        }
        return `
        <div class="w-full max-w-md border ${borderColor} rounded p-6 shadow bg-white dark:bg-gray-800 cursor-pointer group relative transition-transform duration-200 hover:scale-[1.02] hover:shadow-lg" onclick="viewCertificate('${cert.file_url}', '${cert.title}')">
          
          <div class="font-semibold text-blue-700 dark:text-teal-300">${cert.title}</div>
          <div class="text-sm">Τύπος: ${cert.type}</div>
          <div class="text-sm">Ημερομηνία λήξης: ${expDate.toLocaleDateString('el-GR')} (${days} ημέρες)</div>
          ${statusText}
        </div>
      `;
      })
      .join('');

    const container = document.getElementById('certificatesContainer');
    container.setAttribute('data-certificates', JSON.stringify(data));
    container.innerHTML = `
  <div class="w-full flex justify-center px-4">
    <div id="certGrid" class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 justify-items-center max-w-7xl">
      ${html}
    </div>
  </div>`;

    const summary = { total: data.length, active: 0, soon: 0, expired: 0 };
    const now = new Date();
    data.forEach((cert) => {
      const days = Math.ceil(
        (new Date(cert.date) - now) / (1000 * 60 * 60 * 24)
      );
      if (days < 0) summary.expired++;
      else if (days <= 30) summary.soon++;
      else summary.active++;
    });
    document.getElementById('certSummary').innerHTML = `
    <button onclick="filterCertificates('all')" class="px-3 py-1 rounded-full bg-blue-200 text-blue-900 text-sm hover:brightness-95">Σύνολο: ${summary.total}</button>
    <button onclick="filterCertificates('active')" class="px-3 py-1 rounded-full bg-green-100 text-green-800 text-sm hover:brightness-95">Ενεργά: ${summary.active}</button>
    <button onclick="filterCertificates('soon')" class="px-3 py-1 rounded-full bg-yellow-100 text-yellow-800 text-sm hover:brightness-95">Προς λήξη: ${summary.soon}</button>
    <button onclick="filterCertificates('expired')" class="px-3 py-1 rounded-full bg-red-100 text-red-800 text-sm hover:brightness-95">Ληγμένα: ${summary.expired}</button>
  </div>`;
  } catch (err) {
    handleError(err);
  }
}

