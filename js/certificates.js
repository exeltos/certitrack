import { supabase } from '../js/supabaseClient.js';
import { showLoading, hideLoading, handleError } from '../js/common.js';

let currentUser;

// Αρχικοποίηση σελίδας
export async function initPage() {
  // Ensure listEl is defined for debug and initial loadCompanies
  const listEl = document.getElementById('myCompaniesList');
  const selectAllBtn = document.getElementById('selectAllBtn');
  if (selectAllBtn) {
    selectAllBtn.addEventListener('click', () => {
      const checkboxes = document.querySelectorAll('.export-checkbox');
      if (!checkboxes.length) {
        console.warn('Δεν υπάρχουν διαθέσιμα checkbox');
        return;
      }
      const allChecked = Array.from(checkboxes).every(cb => cb.checked);
      checkboxes.forEach(cb => {
        cb.checked = !allChecked;
        cb.dispatchEvent(new Event('change'));
      });
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

      // ✅ Συνδέουμε ή επανασυνδέουμε τον listener στο selectAllBtn
      selectAllBtn?.addEventListener('click', () => {
        const checkboxes = document.querySelectorAll('.export-checkbox');
        if (!checkboxes.length) return;
        const allChecked = Array.from(checkboxes).every(cb => cb.checked);
        checkboxes.forEach(cb => {
          cb.checked = !allChecked;
          cb.dispatchEvent(new Event('change'));
        });
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
        title: card.querySelector('h3')?.textContent || '',
        type: card.querySelector('p:nth-of-type(1)')?.textContent || '',
        date: card.querySelector('p:nth-of-type(2)')?.textContent || '',
        supplier: card.querySelector('p:nth-of-type(3)')?.textContent?.replace('Από: ', '') || ''
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
      import('./certificates_download.js').then(module => {
        module.downloadSelectedCertificates(certs);
      });
    }
  });

  try {
    // Fetch session and profile
    const { data: sessionData } = await supabase.auth.getSession();
    currentUser = sessionData?.session?.user;
    if (!currentUser) throw new Error('Μη έγκυρη συνεδρία.');

    const { data: profile, error: profileErr } = await supabase
          .from('suppliers')
          .select('name, afm')
          .eq('user_id', currentUser.id)
          .maybeSingle();
        if (profileErr) throw profileErr;

        if (!profile?.afm || profile.afm.trim() === '') {
          Swal.fire('Σφάλμα', 'Το προφίλ σου δεν έχει δηλωμένο ΑΦΜ. Δεν μπορεί να αποθηκευτεί το πιστοποιητικό.', 'error');
          hideLoading();
          return;
        }

        if (!profile?.afm || profile.afm.trim() === '') {
          Swal.fire('Σφάλμα', 'Το προφίλ σου δεν έχει δηλωμένο ΑΦΜ. Δεν μπορεί να αποθηκευτεί το πιστοποιητικό.', 'error');
          hideLoading();
          return;
        }

        if (!profile?.afm || profile.afm.trim() === '') {
          Swal.fire('Σφάλμα', 'Το προφίλ σου δεν έχει δηλωμένο ΑΦΜ. Δεν μπορεί να αποθηκευτεί το πιστοποιητικό.', 'error');
          hideLoading();
          return;
        }

        if (!profile?.afm || profile.afm.trim() === '') {
          Swal.fire('Σφάλμα', 'Το προφίλ σου δεν έχει δηλωμένο ΑΦΜ. Δεν μπορεί να αποθηκευτεί το πιστοποιητικό.', 'error');
          hideLoading();
          return;
        }
    const displayName = profile?.name || currentUser.email;
    document.getElementById('userGreeting').textContent = `Καλώς ήρθες, ${displayName}`;

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
        await supabase.auth.signOut();
        window.location.href = 'index.html';
      }
    });
    document.getElementById('notifyBtn')?.addEventListener('click', showExpirationPopup);
    document.getElementById('userSettingsBtn')?.addEventListener('click', () => window.location.href = 'supplier_info.html');

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
    await loadCertificates();
  }
  catch (err) {
    handleError(err);
  }
}


// Φόρτωση πιστοποιητικών
export async function loadCertificates() {
  const searchTerm = document.getElementById('searchInput')?.value.toLowerCase() || '';
  document.getElementById('loadingCertificates').classList.remove('hidden');
  document.getElementById('noCertificatesMessage').classList.add('hidden');
  document.getElementById('certContainer').classList.add('hidden');

  try {
    const { data, error } = await supabase
      .from('supplier_certificates')
      .select('*')
      .eq('supplier_user_id', currentUser.id)
      
      .order('date', { ascending: false });

    
    if (error) throw error;

    const today = new Date();
    const filtered = data.filter(cert => {
      const match = `${cert.title} ${cert.type} ${cert.supplier_afm}`.toLowerCase();
      return match.includes(searchTerm);
    });

    let total = 0, active = 0, soon = 0, expired = 0;
    filtered.forEach(cert => {
      const days = Math.ceil((new Date(cert.date) - today) / (1000 * 60 * 60 * 24));
      if (days < 0) expired++;
      else if (days <= 30) soon++;
      else active++;
      total++;
    });
    document.getElementById('stat-total').textContent = total;
document.getElementById('stat-total')?.parentElement?.addEventListener('click', () => {
  renderFiltered(filtered);
  highlightStat('stat-total');
});

document.getElementById('stat-active').textContent = active;
document.getElementById('stat-active')?.parentElement?.addEventListener('click', () => {
  renderFiltered(filtered.filter(cert => {
    const days = Math.ceil((new Date(cert.date) - today) / (1000 * 60 * 60 * 24));
    return days > 30;
  }));
  highlightStat('stat-active');
});

document.getElementById('stat-soon').textContent = soon;
document.getElementById('stat-soon')?.parentElement?.addEventListener('click', () => {
  renderFiltered(filtered.filter(cert => {
    const days = Math.ceil((new Date(cert.date) - today) / (1000 * 60 * 60 * 24));
    return days >= 0 && days <= 30;
  }));
  highlightStat('stat-soon');
});

document.getElementById('stat-expired').textContent = expired;

// Προσθήκη cursor-pointer και hover ring στατιστικών
['stat-total', 'stat-active', 'stat-soon', 'stat-expired'].forEach(id => {
  const el = document.getElementById(id)?.parentElement;
  if (el) {
    el.classList.add('cursor-pointer', 'hover:ring', 'hover:ring-offset-1', 'hover:ring-blue-300');
  }
});
document.getElementById('stat-expired')?.parentElement?.addEventListener('click', () => {
  renderFiltered(filtered.filter(cert => {
    const days = Math.ceil((new Date(cert.date) - today) / (1000 * 60 * 60 * 24));
    return days < 0;
  }));
  highlightStat('stat-expired');
});

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
  grid.innerHTML = '';
  list.forEach(cert => {
    const expDate = new Date(cert.date);
    const diffDays = Math.ceil((expDate - today) / (1000 * 60 * 60 * 24));
    const isExpired = diffDays < 0;
    const isExpiringSoon = diffDays >= 0 && diffDays <= 30;
    const borderClass = isExpired ? 'border-[#dc2626]' : isExpiringSoon ? 'border-[#f59e0b]' : 'border-transparent';
    const label = isExpired
      ? '<span class="text-red-500 font-semibold">Ληγμένο</span>'
      : isExpiringSoon
      ? `<span class="text-yellow-600 font-medium">Λήγει σε ${diffDays} ημέρες</span>`
      : '';

    const card = document.createElement('div');
    card.className = `card-transition shadow-sm bg-white dark:bg-gray-800 rounded-2xl p-4 flex flex-col justify-between border-2 ${borderClass} cert-card overflow-hidden`;
    card.innerHTML = `
      <div>
        <h3 class="font-semibold mb-1 text-gray-800 dark:text-white flex items-center gap-2">
  ${cert.title}
  ${cert.is_private ? '<span class="text-blue-500 text-sm italic">🔒 Προσωπικό</span>' : ''}
</h3>
        <p class="text-sm text-gray-700 dark:text-gray-300">${cert.type}</p>
        <p class="text-sm text-gray-700 dark:text-gray-300">${expDate.toLocaleDateString('el-GR')} <span class="ml-2">${label}</span></p>
        <p class="text-sm text-gray-500 dark:text-gray-400 mt-2">Από: ${cert.supplier_name || 'Άγνωστος'}</p>
      </div>
      <div class="mt-4 flex justify-end space-x-2">
        <button class="edit-btn text-gray-500" data-id="${cert.id}" title="Επεξεργασία"><i data-lucide="pencil"></i></button>
        <button class="view-btn text-gray-500" data-url="${cert.file_url}" title="Προβολή"><i data-lucide="eye"></i></button>
        <button class="delete-btn text-gray-500" data-id="${cert.id}" data-url="${cert.file_url}" title="Διαγραφή"><i data-lucide="trash-2"></i></button>
      </div>`;
    grid.appendChild(card);
  });
  bindCertificateActions();
  lucide.createIcons();
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
  document.getElementById('selectAllBtn')?.addEventListener('click', () => {
    const checkboxes = document.querySelectorAll('.export-checkbox');
    const allChecked = Array.from(checkboxes).every(cb => cb.checked);
    checkboxes.forEach(cb => {
      cb.checked = !allChecked;
      cb.dispatchEvent(new Event('change'));
    });
  });

  function handleViewClick(btn) {
    Swal.fire({
      html: `<embed src="${btn.dataset.url}" type="application/pdf" width="100%" height="${window.innerWidth < 600 ? '400' : '700'}px" class="rounded border" />`,
      showCloseButton: true,
      showConfirmButton: false,
      width: '90%'
    });
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
          const fileUrl = btn.dataset.url;
          const path = fileUrl.split('/').slice(-2).join('/');
          await supabase.storage.from('suppliercertificates').remove([path]);
          await supabase.from('supplier_certificates').delete().eq('id', btn.dataset.id);
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
    supabase.from('supplier_certificates').select('*').eq('id', btn.dataset.id).then(async ({ data: certs }) => {
      const cert = certs[0];
      const { value } = await Swal.fire({
        didOpen: () => {
          const checkbox = document.getElementById('swal-private');
          if (checkbox) checkbox.checked = cert.is_private;
        },
        title: 'Επεξεργασία Πιστοποιητικού',
        html: `
          <input id="swal-title" class="swal2-input" value="${cert.title}">
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
<div class="mt-4 text-center text-base font-bold underline text-blue-600 dark:text-blue-300">
  <label>
    <input type="checkbox" id="swal-private" class="mr-2 w-5 h-5">
    Προσωπικό έγγραφο (ορατό μόνο σε εσένα)
  </label>
</div>
        `,
        focusConfirm: false,
        showCancelButton: true,
        preConfirm: () => ({
          id: cert.id,
          title: document.getElementById('swal-title').value,
          type: document.getElementById('swal-type').value === 'Άλλο' ? document.getElementById('custom-type').value : document.getElementById('swal-type').value,
          date: document.getElementById('swal-date').value
        })
      });
      if (value) {
  const updates = { ...value };
  const fileInput = Swal.getPopup().querySelector('#swal-file');
  const file = fileInput?.files[0];
  if (file) {
    const ext = file.name.split('.').pop();
    const uuid = crypto.randomUUID();
    const path = `${currentUser.id}/${uuid}.${ext}`;
    const { error: uploadError } = await supabase.storage.from('suppliercertificates').upload(path, file, { upsert: true });
    if (uploadError) throw uploadError;
    const { data: urlData, error: urlErr } = await supabase.storage.from('suppliercertificates').getPublicUrl(path);
    if (urlErr) throw urlErr;
    updates.file_url = urlData.publicUrl;
    updates.name = file.name;
  }
  await supabase.from('supplier_certificates').update(updates).eq('id', value.id);
        await loadCertificates();
      }
    });
  }

  document.querySelectorAll('.view-btn').forEach(btn => btn.addEventListener('click', () => handleViewClick(btn)));
  document.querySelectorAll('.delete-btn').forEach(btn => btn.addEventListener('click', () => handleDeleteClick(btn)));
  document.querySelectorAll('.edit-btn').forEach(btn => btn.addEventListener('click', () => handleEditClick(btn)));
};
  ;
  document.querySelectorAll('.view-btn').forEach(btn => btn.addEventListener('click', () => {
    Swal.fire({ html: `<embed src="${btn.dataset.url}" type="application/pdf" width="100%" height="700px" class="rounded border" />`, showCloseButton: true, showConfirmButton: false, width: '90%' });
  }));
  document.querySelectorAll('.delete-btn').forEach(btn => btn.addEventListener('click', async () => {
  console.log('📌 ΠΑΤΗΘΗΚΕ ΚΟΥΜΠΙ ΓΙΑ ΕΤΑΙΡΕΙΑ:', btn.dataset.id);
  console.log('➤ current access:', btn.getAttribute('data-access'));
  console.log('➤ icon:', btn.querySelector('i')?.getAttribute('data-lucide'));
    const result = await Swal.fire({ title: 'Διαγραφή Πιστοποιητικού', text: 'Είσαι σίγουρος/η;', icon: 'warning', showCancelButton: true });
    if (result.isConfirmed) {
      try {
        showLoading();
        const fileUrl = btn.dataset.url;
        const path = fileUrl.split('/').slice(-2).join('/');
        await supabase.storage.from('suppliercertificates').remove([path]);
        await supabase.from('supplier_certificates').delete().eq('id', btn.dataset.id);
        await loadCertificates();
        Swal.fire('Διαγραφή', 'Το πιστοποιητικό διαγράφηκε επιτυχώς', 'success');
      } catch (err) {
        handleError(err);
      } finally {
        hideLoading();
      }
    }
  }));
  document.querySelectorAll('.edit-btn').forEach(btn => btn.addEventListener('click', async () => {
    const { data: certs } = await supabase.from('supplier_certificates').select('*').eq('id', btn.dataset.id);
    const cert = certs[0];
    const { value } = await Swal.fire({
      title: 'Επεξεργασία Πιστοποιητικού',
      html: `
        <input id="swal-title" class="swal2-input" value="${cert.title}">
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
      `,
      focusConfirm: false,
      showCancelButton: true,
      preConfirm: () => ({
  id: cert.id,
  title: document.getElementById('swal-title').value,
  type: document.getElementById('swal-type').value === 'Άλλο' ? document.getElementById('custom-type').value : document.getElementById('swal-type').value,
  date: document.getElementById('swal-date').value
})
    });
    if (value) {
      await supabase.from('supplier_certificates').update(value).eq('id', value.id);
      await loadCertificates();
    }
  }));


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
    const diff = Math.ceil((new Date(c.date) - new Date()) / (1000 * 60 * 60 * 24));
    return diff >= 0 && diff <= 30;
  });
  countEl.textContent = soon.length;
  countEl.classList.toggle('hidden', soon.length === 0);
  if (soon.length > 0 && !fromProfile && !sessionStorage.getItem('sawPopupOnce')) {
    sessionStorage.setItem('sawPopupOnce', 'true');
    sessionStorage.setItem('sawPopupOnce', 'true');
    showExpirationPopup();
  }
}

async function showExpirationPopup() {
  const { data } = await supabase.from('supplier_certificates')
    .select('*')
    .eq('supplier_user_id', currentUser.id)
    .order('date', { ascending: false });

  const soon = data.filter(c => {
    const diff = Math.ceil((new Date(c.date) - new Date()) / (1000 * 60 * 60 * 24));
    return diff >= 0 && diff <= 30;
  });

  const { data: supProfile, error: supErr } = await supabase
    .from('suppliers')
    .select('id')
    .eq('user_id', currentUser.id)
    .maybeSingle();

  if (supErr || !supProfile) return;
  const supplierId = supProfile.id;

  for (const cert of soon) {
    try {
      const { data: existing } = await supabase
        .from('supplier_notifications')
        .select('id')
        .eq('certificate_id', cert.id)
        .eq('supplier_id', supplierId)
        .maybeSingle();

      if (!existing) {
        const { error: insertErr } = await supabase.from('supplier_notifications').insert({
  certificate_id: cert.id,
  supplier_id: supplierId,
  notified_at: new Date().toISOString()
});
if (insertErr) {
  console.error('❌ Σφάλμα insert στην supplier_notifications:', insertErr.message);
} else {
  console.log(`✅ Ειδοποίηση καταγράφηκε για πιστοποιητικό ${cert.id}`);
}
      }
    } catch (err) {
      console.error('❌ Σφάλμα καταγραφής ειδοποίησης:', err.message);
    }
  }

  const html = soon.length
    ? `<ul class='text-left'>${soon.map(c => `<li>• ${c.title}: ${new Date(c.date).toLocaleDateString('el-GR')}</li>`).join('')}</ul>`
    : 'Δεν υπάρχουν επικείμενες λήξεις.';

  Swal.fire({ title: 'Ειδοποιήσεις λήξης', html, icon: soon.length ? 'warning' : 'info' });
}

async function loadCompanies() {
  const listEl = document.getElementById('myCompaniesList');
  listEl.innerHTML = '<li class="text-center text-gray-500">Φόρτωση...</li>';
  try {
    // Ανάκτηση supplier.id
    const { data: supRec, error: supErr } = await supabase
      .from('suppliers')
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
    const { data: rels, error: relsErr } = await supabase
      .from('company_suppliers')
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
    const { data: companies, error: compsErr } = await supabase
      .from('companies')
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
      const { data: supRec, error: supErr } = await supabase
        .from('suppliers')
        .select('id')
        .eq('user_id', currentUser.id)
        .maybeSingle();
      if (supErr || !supRec?.id) throw supErr || new Error('Προμηθευτής δεν βρέθηκε.');

      const { error } = await supabase
        .from('company_suppliers')
        .update({ access: newAccess })
        .eq('company_id', companyId)
        .eq('supplier_id', supRec.id);

      if (error) throw error;

      Swal.fire('Ολοκληρώθηκε', successMessage, 'success');
console.log('✅ Νέο access:', newAccess);

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
<div class="mt-4 text-center text-base font-bold underline text-blue-600 dark:text-blue-300">
  <label>
    <input type="checkbox" id="swal-private" class="mr-2 w-5 h-5">
    Προσωπικό έγγραφο (ορατό μόνο σε εσένα)
  </label>
</div>
      <div id="swal-preview" class="mt-4 overflow-auto max-h-[300px] border rounded"></div>
    `,
    focusConfirm: false,
    showCancelButton: true,
    didOpen: () => {
      const fileInput = Swal.getPopup().querySelector('#swal-file');
      const previewBox = Swal.getPopup().querySelector('#swal-preview');
      fileInput.addEventListener('change', () => {
        const file = fileInput.files[0];
        if (file && file.type === 'application/pdf') {
          const url = URL.createObjectURL(file);
          previewBox.innerHTML = `<embed src="${url}" type="application/pdf" width="100%" height="300px" class="rounded border" />`;
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
      }
      if (type === 'Άλλο' && !document.getElementById('custom-type').value.trim()) {
  Swal.showValidationMessage('Συμπλήρωσε την προσαρμοσμένη κατηγορία σου.');
  return false;
}
const is_private = document.getElementById('swal-private').checked;
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
        const { error: upErr } = await supabase.storage.from('suppliercertificates').upload(path, file);
        if (upErr) throw upErr;
        const { data: urlData, error: urlErr } = await supabase.storage.from('suppliercertificates').getPublicUrl(path);
        if (urlErr) throw urlErr;

        const { data: profile, error: profileErr } = await supabase
          .from('suppliers')
          .select('name, afm')
          .eq('user_id', currentUser.id)
          .maybeSingle();
        if (profileErr) throw profileErr;

        const { error: insertErr } = await supabase
          .from('supplier_certificates')
          .insert([{ supplier_user_id: currentUser.id, title, type, date, file_url: urlData.publicUrl, supplier_email: currentUser.email, name: file.name, supplier_name: profile?.name || currentUser.email, supplier_afm: profile?.afm || '', created_at: new Date().toISOString(), is_private: is_private }]);
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


