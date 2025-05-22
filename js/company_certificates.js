import { supabase } from '../js/supabaseClient.js';
import { showLoading, hideLoading, handleError } from '../js/common.js';

let currentUser;

export async function initCompanyCertificatesPage() {
  const emailBtn = document.getElementById('emailBtn');
  if (emailBtn) emailBtn.addEventListener('click', toggleEmailMode);
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    currentUser = sessionData?.session?.user;
    if (!currentUser) throw new Error('Μη έγκυρη συνεδρία.');

    const { data: company, error: companyErr } = await supabase
      .from('companies')
      .select('name, afm')
      .eq('user_id', currentUser.id)
      .maybeSingle();

    if (companyErr) throw companyErr;
    const displayName = company?.name || currentUser.email;
    document.getElementById('companyName').textContent = displayName;

    document.getElementById('addCertFixed')?.addEventListener('click', showCreateModal);

  // Ενεργοποίηση μενού εξαγωγής όπως στο certificates.js
    // Εμφάνιση μενού εξαγωγής
  document.getElementById('exportMenuBtn')?.addEventListener('click', () => {
  const menu = document.getElementById('certEmailActions');
  const checkboxes = document.querySelectorAll('.cert-card input[type="checkbox"]');
  const selectAll = document.getElementById('selectAllBtn');
  const download = document.getElementById('downloadBtn');
  const send = document.getElementById('sendEmailBtn');

  if (!menu.classList.contains('hidden')) {
    // Αν είναι ήδη ανοιχτό => κλείνει και κρύβει τα πάντα
    menu.classList.add('hidden');
document.getElementById('certContainer')?.setAttribute('data-export-mode', 'false');
    checkboxes.forEach(cb => cb.classList.add('hidden'));
    selectAll?.classList.add('hidden');
    download?.classList.add('hidden');
    send?.classList.add('hidden');
    return;
  }

  Swal.fire({
    title: 'Επιλογή Εξαγωγής',
    showCancelButton: true,
    confirmButtonText: 'Λήψη',
    cancelButtonText: 'Email',
    showDenyButton: true,
    denyButtonText: 'Ακύρωση'
  }).then((result) => {
    if (result.isConfirmed || result.dismiss === Swal.DismissReason.cancel) {
      menu.classList.remove('hidden');
document.getElementById('certContainer')?.setAttribute('data-export-mode', 'true');
      checkboxes.forEach(cb => cb.classList.remove('hidden'));
      selectAll?.classList.remove('hidden');
      if (result.isConfirmed) download?.classList.remove('hidden');
      else send?.classList.remove('hidden');
    }
  });
});

  // Επιλογή Όλων
  document.getElementById('selectAllBtn')?.addEventListener('click', () => {
    const checkboxes = document.querySelectorAll('.cert-card input[type="checkbox"]');
    const allChecked = Array.from(checkboxes).every(cb => cb.checked);
    checkboxes.forEach(cb => cb.checked = !allChecked);
  });
document.getElementById('sendEmailBtn')?.addEventListener('click', async () => {
  const checked = document.querySelectorAll('.cert-card input[type="checkbox"]:checked');
  if (checked.length === 0) return Swal.fire('Ειδοποίηση', 'Δεν επιλέχθηκαν πιστοποιητικά.', 'info');
  const ids = Array.from(checked).map(cb => cb.dataset.id);
  const { data, error } = await supabase
    .from('company_certificates')
    .select('*')
    .in('id', ids);
  if (error) return handleError(error);

  const certList = data.map(c => `<li>${c.title} - ${new Date(c.date).toLocaleDateString('el-GR')}</li>`).join('');
  Swal.fire({
    title: 'Προεπισκόπηση Email',
    html: `<ul style="text-align:left">${certList}</ul>`,
    confirmButtonText: 'Αποστολή',
    showCancelButton: true
  });
});

document.getElementById('downloadBtn')?.addEventListener('click', () => {
  const certs = document.querySelectorAll('.cert-card input[type="checkbox"]:checked');
  if (certs.length === 0) return Swal.fire('Ειδοποίηση', 'Δεν επιλέχθηκαν πιστοποιητικά.', 'info');
  if (certs.length === 0) return Swal.fire('Καμία εγγραφή', 'Δεν υπάρχουν πιστοποιητικά για εξαγωγή.', 'info');

  const rows = [['Τίτλος', 'Τύπος', 'Ημερομηνία', 'Όνομα Αρχείου']];
  certs.forEach(card => {
        const cardEl = card.closest('.cert-card');
    const title = cardEl.querySelector('h3')?.textContent;
    const type = cardEl.querySelectorAll('p')[0]?.textContent;
    const date = cardEl.querySelectorAll('p')[1]?.textContent;
    const name = cardEl.querySelectorAll('p')[2]?.textContent.replace('Αρχείο: ', '');
    rows.push([title, type, date, name]);
  });

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, 'Πιστοποιητικά');
  XLSX.writeFile(wb, 'certificates_export.xlsx');
});
    document.getElementById('logoutBtn')?.addEventListener('click', async () => {
      await supabase.auth.signOut();
      window.location.href = 'index.html';
    });

    await loadCertificates();

    document.getElementById('certContainer')?.addEventListener('change', () => {
      const grid = document.getElementById('certContainer');
// grid?.setAttribute('data-export-mode', 'false'); (αφαιρέθηκε για να μη σπάει export mode)
      const isExportMode = grid?.getAttribute('data-export-mode') === 'true';
      const anyChecked = document.querySelectorAll('.cert-card input[type="checkbox"]:checked').length > 0;
      const downloadBtn = document.getElementById('downloadBtn');
      const sendBtn = document.getElementById('sendEmailBtn');
      if (!isExportMode) return;
      if (anyChecked) {
        downloadBtn?.classList.remove('hidden');
        sendBtn?.classList.remove('hidden');
      } else {
        downloadBtn?.classList.add('hidden');
        sendBtn?.classList.add('hidden');
      }
    });
  } catch (err) {
    handleError(err);
  }
}

// 📧 Ενεργοποίηση/Απενεργοποίηση λειτουργίας email export
function toggleEmailMode() {
  const container = document.getElementById('certContainer');
  const selectAllBtn = document.getElementById('selectAllBtn');
  const sendEmailBtn = document.getElementById('sendEmailBtn');
  const downloadBtn = document.getElementById('downloadBtn');
  const checkboxes = document.querySelectorAll('.cert-card input[type="checkbox"]');

  const isActive = container.getAttribute('data-export-mode') === 'true';

  if (isActive) {
    container.setAttribute('data-export-mode', 'false');
    checkboxes.forEach(cb => cb.classList.add('hidden'));
    selectAllBtn?.classList.add('hidden');
    sendEmailBtn?.classList.add('hidden');
    downloadBtn?.classList.add('hidden');
  } else {
    container.setAttribute('data-export-mode', 'true');
    selectAllBtn?.classList.remove('hidden');
    sendEmailBtn?.classList.add('hidden');
    checkboxes.forEach(cb => {
      cb.classList.remove('hidden');
      cb.addEventListener('change', () => {
        const anyChecked = Array.from(checkboxes).some(c => c.checked);
        sendEmailBtn?.classList.toggle('hidden', !anyChecked);
      });
    });
  }
}


  async function loadCertificates() {
  const searchTerm = document.getElementById('searchInput')?.value.toLowerCase() || '';
  const loadingEl = document.getElementById('loadingCertificates');
  const emptyEl = document.getElementById('noCertificatesMessage');
  const grid = document.getElementById('certContainer');

  loadingEl.classList.remove('hidden');
  emptyEl.classList.add('hidden');
  grid.classList.add('hidden');

  try {
    const { data, error } = await supabase
      .from('company_certificates')
      .select('*')
      .eq('company_user_id', currentUser.id)
      .order('date', { ascending: false });

    if (error) throw error;

    const today = new Date();
    const filtered = data.filter(cert => {
      const match = `${cert.title} ${cert.type}`.toLowerCase();
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
    document.getElementById('stat-active').textContent = active;
    document.getElementById('stat-soon').textContent = soon;
    document.getElementById('stat-expired').textContent = expired;

    grid.innerHTML = '';
    filtered.forEach(cert => {
      const expDate = new Date(cert.date);
      const diffDays = Math.ceil((expDate - today) / (1000 * 60 * 60 * 24));
      const isExpired = diffDays < 0;
      const isExpiringSoon = diffDays >= 0 && diffDays <= 30;
      const borderClass = isExpired ? 'border-error' : isExpiringSoon ? 'border-warning' : 'border-transparent';
      const label = isExpired ? '(Ληγμένο)' : isExpiringSoon ? `(Λήγει σε ${diffDays} ημέρες)` : '';

      const card = document.createElement('div');
      card.className = `card-transition relative shadow-sm bg-white dark:bg-gray-800 rounded-2xl p-4 flex flex-col justify-between border-2 ${borderClass} cert-card`;
      card.innerHTML = `
        <div class="absolute top-2 right-2">
          <input type="checkbox" data-id="${cert.id}" class="form-checkbox h-4 w-4 text-blue-600 hidden">
        </div>
        <div>
          <h3 class="font-semibold mb-1 text-gray-800 dark:text-white">${cert.title}</h3>
          <p class="text-sm text-gray-700 dark:text-gray-300">${cert.type}</p>
          <p class="text-sm text-gray-700 dark:text-gray-300">${expDate.toLocaleDateString('el-GR')} <span class="ml-2">${label}</span></p>
          <p class="text-sm text-gray-500 dark:text-gray-400 mt-2">Αρχείο: ${cert.name}</p>
        </div>
        <div class="mt-4 flex justify-end space-x-2">
          <button class="edit-btn text-gray-500" data-id="${cert.id}" title="Επεξεργασία">
            <i data-lucide="pencil"></i>
          </button>
          <button class="view-btn text-gray-500" data-url="${cert.file_url}" title="Προβολή">
            <i data-lucide="eye"></i>
          </button>
          <button class="delete-btn text-gray-500" data-id="${cert.id}" data-url="${cert.file_url}" title="Διαγραφή">
            <i data-lucide="trash-2"></i>
          </button>
        </div>`;
      grid.appendChild(card);
    });
    grid.classList.remove('hidden');
    bindActions();
    lucide.createIcons();
  } catch (err) {
    handleError(err);
  } finally {
    loadingEl.classList.add('hidden');
  }
}


function bindActions() {
  document.querySelectorAll('.edit-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const certId = btn.dataset.id;
      const { data, error } = await supabase.from('company_certificates').select('*').eq('id', certId).single();
      if (error) return handleError(error);

      Swal.fire({
        title: 'Επεξεργασία Πιστοποιητικού',
        html: `
          <input id="swal-title" class="swal2-input" placeholder="Τίτλος" value="${data.title}">
          <select id="swal-type" class="swal2-select mb-2">
            <option value="Πιστοποιητικό" ${data.type === 'Πιστοποιητικό' ? 'selected' : ''}>Πιστοποιητικό</option>
            <option value="Απόφαση" ${data.type === 'Απόφαση' ? 'selected' : ''}>Απόφαση</option>
            <option value="Νομιμοποιητικό έγγραφο" ${data.type === 'Νομιμοποιητικό έγγραφο' ? 'selected' : ''}>Νομιμοποιητικό έγγραφο</option>
            <option value="Ανάλυση" ${data.type === 'Ανάλυση' ? 'selected' : ''}>Ανάλυση</option>
            <option value="CE" ${data.type === 'CE' ? 'selected' : ''}>CE</option>
          </select>
          <input id="swal-date" type="date" class="swal2-input" value="${data.date}">
        `,
        showCancelButton: true,
        confirmButtonText: 'Αποθήκευση',
        preConfirm: () => {
          const title = document.getElementById('swal-title').value.trim();
          const type = document.getElementById('swal-type').value;
          const date = document.getElementById('swal-date').value;
          if (!title || !type || !date) {
            Swal.showValidationMessage('Συμπλήρωσε όλα τα πεδία');
            return false;
          }
          return { title, type, date };
        }
      }).then(async (res) => {
        if (!res.isConfirmed || !res.value) return;
        try {
          showLoading();
          const { title, type, date } = res.value;
          const { error: updateErr } = await supabase.from('company_certificates').update({ title, type, date }).eq('id', certId);
          if (updateErr) throw updateErr;
          Swal.fire('Ενημερώθηκε', 'Το πιστοποιητικό ενημερώθηκε επιτυχώς.', 'success');
          await loadCertificates();
        } catch (err) {
          handleError(err);
        } finally {
          hideLoading();
        }
      });
    });
  });
  document.querySelectorAll('.view-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      Swal.fire({
        html: `<embed src="${btn.dataset.url}" type="application/pdf" width="100%" height="700px" class="rounded border" />`,
        showCloseButton: true,
        showConfirmButton: false,
        width: '90%'
      });
    });
  });
  document.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const result = await Swal.fire({
        title: 'Διαγραφή Πιστοποιητικού',
        text: 'Είσαι σίγουρος/η;',
        icon: 'warning',
        showCancelButton: true
      });
      if (result.isConfirmed) {
        try {
          showLoading();
          const fileUrl = btn.dataset.url;
          const path = fileUrl.split('/').slice(-2).join('/');
          await supabase.storage.from('companycertificates').remove([path]);
          await supabase.from('company_certificates').delete().eq('id', btn.dataset.id);
          await loadCertificates();
          Swal.fire('Διαγραφή', 'Το πιστοποιητικό διαγράφηκε επιτυχώς', 'success');
        } catch (err) {
          handleError(err);
        } finally {
          hideLoading();
        }
      }
    });
  });
}

function showCreateModal() {
  Swal.fire({
    title: 'Νέο Πιστοποιητικό',
    html: `
      <input id="swal-title" class="swal2-input" placeholder="Τίτλος">
      <select id="swal-type" class="swal2-select mb-2">
        <option value="Πιστοποιητικό">Πιστοποιητικό</option>
        <option value="Απόφαση">Απόφαση</option>
        <option value="Νομιμοποιητικό έγγραφο">Νομιμοποιητικό έγγραφο</option>
        <option value="Ανάλυση">Ανάλυση</option>
        <option value="CE">CE</option>
      </select>
      <input id="swal-date" type="date" class="swal2-input">
      <input id="swal-file" type="file" accept="application/pdf" class="swal2-file mt-2" />
    `,
    showCancelButton: true,
    confirmButtonText: 'Αποθήκευση',
    preConfirm: () => {
      const title = document.getElementById('swal-title').value.trim();
      const type = document.getElementById('swal-type').value;
      const date = document.getElementById('swal-date').value;
      const file = document.getElementById('swal-file').files[0];
      if (!title || !type || !date || !file) {
        Swal.showValidationMessage('Συμπλήρωσε όλα τα πεδία και ανέβασε PDF');
        return false;
      }
      return { title, type, date, file };
    }
  }).then(async (res) => {
    if (!res.isConfirmed || !res.value) return;
    try {
      showLoading();
      const { title, type, date, file } = res.value;
      const ext = file.name.split('.').pop();
      const uuid = crypto.randomUUID();
      const path = `${currentUser.id}/${uuid}.${ext}`;

      const { error: uploadErr } = await supabase.storage.from('companycertificates').upload(path, file);
      if (uploadErr) throw uploadErr;

      const { data: urlData, error: urlErr } = await supabase.storage.from('companycertificates').getPublicUrl(path);
      if (urlErr) throw urlErr;

      const { data: company } = await supabase
        .from('companies')
        .select('name, afm, email')
        .eq('user_id', currentUser.id)
        .maybeSingle();

      const newCert = {
        title,
        type,
        date,
        name: file.name,
        file_url: urlData.publicUrl,
        company_user_id: currentUser.id,
        company_name: company?.name || '',
        company_afm: company?.afm || '',
        company_email: company?.email || '',
              };

      const { error: dbErr } = await supabase.from('company_certificates').insert([newCert]);
      if (dbErr) throw dbErr;

      Swal.fire('Επιτυχία', 'Το πιστοποιητικό αποθηκεύτηκε επιτυχώς', 'success');
      await loadCertificates();
    } catch (err) {
      handleError(err);
    } finally {
      hideLoading();
    }
  });
}
