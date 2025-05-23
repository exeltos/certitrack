import { supabase } from '../js/supabaseClient.js';
import { showLoading, hideLoading, handleError } from '../js/common.js';

let currentUser;

// Ενεργοποίηση email επιλογής
window.activateEmailMode = function activateEmailMode() {
  const container = document.getElementById('certContainer');
  let selectAllBtn;
let downloadBtn;
selectAllBtn = document.getElementById('selectAllBtn');
downloadBtn = document.getElementById('downloadBtn');
if (!selectAllBtn) console.warn('⛔ Το κουμπί Επιλογή Όλων (selectAllBtn) ΔΕΝ υπάρχει στο HTML.');
  const sendEmailBtn = document.getElementById('sendEmailBtn');
  const isActive = container.getAttribute('data-export-mode') === 'true';

  if (isActive) {
    container.setAttribute('data-export-mode', 'false');
    document.querySelectorAll('.export-checkbox').forEach(cb => cb.remove());
    selectAllBtn.classList.add('hidden');
    sendEmailBtn.classList.add('hidden');
    return;
  }

  container.setAttribute('data-export-mode', 'true');
  selectAllBtn.classList.remove('hidden');
  sendEmailBtn.classList.add('hidden');

  document.querySelectorAll('.cert-card').forEach(card => {
    let checkbox = card.querySelector('.export-checkbox');
    if (!checkbox) {
          checkbox = document.createElement('input');
          checkbox.type = 'checkbox';
          checkbox.className = 'export-checkbox absolute top-2 right-2 w-5 h-5 accent-blue-600';
          card.classList.add('relative');
          checkbox.addEventListener('change', () => {
            const anyChecked = document.querySelectorAll('.export-checkbox:checked').length > 0;
            if (downloadBtn) downloadBtn.classList.toggle('hidden', !anyChecked);
            if (selectAllBtn) selectAllBtn.classList.remove('hidden');
          });
          card.appendChild(checkbox);
        } else {
      checkbox.classList.remove('hidden');
    }
  });

  document.querySelectorAll('.export-checkbox').forEach(cb => {
    cb.addEventListener('change', () => {
      const anyChecked = [...document.querySelectorAll('.export-checkbox')].some(c => c.checked);
      sendEmailBtn.classList.toggle('hidden', !anyChecked);
    });
  });
}

document.getElementById('emailBtn')?.addEventListener('click', activateEmailMode);
document.getElementById('sendEmailBtn')?.addEventListener('click', sendSelectedCertificates);

async function sendSelectedCertificates() {
  console.log('[CertiTrack] sendSelectedCertificates ξεκίνησε');
  const selected = [...document.querySelectorAll('.export-checkbox:checked')];
  if (!selected.length) {
    Swal.fire('Προσοχή', 'Δεν έχεις επιλέξει πιστοποιητικά.', 'info');
    return;
  }

  const certs = selected.map(cb => {
    const card = cb.closest('.cert-card');
    return {
      title: card.querySelector('h3')?.textContent.trim() || '',
      date: card.querySelector('p:nth-of-type(2)')?.textContent.trim() || '',
      url: card.querySelector('a')?.href || ''
    };
  });

  try {
    const { data: sessionData, error } = await supabase.auth.getSession();
    if (error || !sessionData.session) throw new Error('Δεν βρέθηκε session');

    const { value: toEmail } = await Swal.fire({
      title: 'Αποστολή Email',
      input: 'email',
      inputLabel: 'Εισάγετε email παραλήπτη',
      inputPlaceholder: 'example@email.com',
      showCancelButton: true,
      confirmButtonText: 'Αποστολή'
    });

    if (!toEmail) return;

    console.log('[DEBUG] EMAIL:', toEmail);
    console.log('[DEBUG] CERTIFICATES:', certs);

    const endpoint = '/.netlify/functions/send_certificate_email'; // Χρησιμοποιείται σε production hosting, π.χ. Netlify

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: toEmail, certificates: certs })
    });

    if (!response.ok) throw new Error('Αποτυχία αποστολής email');
    if (downloadBtn) downloadBtn.classList.remove('hidden');
    if (selectAllBtn) selectAllBtn.classList.remove('hidden');
    Swal.fire('Εστάλη', 'Το email στάλθηκε επιτυχώς.', 'success');
  } catch (err) {
    console.error(err);
    Swal.fire('Σφάλμα', err.message || 'Αποτυχία αποστολής', 'error');
  }
}

// Αρχικοποίηση σελίδας
export async function initCompanyCertificatesPage() {
  // καταργήθηκε για αποφυγή διπλής δήλωσης
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
if (downloadBtn) downloadBtn.classList.toggle('hidden', !allChecked);
if (selectAllBtn) selectAllBtn.classList.remove('hidden');
  });
};
  }

  const exportBtn = document.getElementById('exportMenuBtn');
const selectAllBtn = document.getElementById('selectAllBtn');
// ✅ αφαιρέθηκε η διπλή δήλωση του downloadBtn
if (!downloadBtn) console.warn('⛔ Το κουμπί Λήψη (downloadBtn) ΔΕΝ υπάρχει στο HTML.');
  // καταργήθηκε για αποφυγή διπλής δήλωσης
  const certContainer = document.getElementById('certContainer');

  exportBtn?.addEventListener('click', () => {
    const isExporting = certContainer.getAttribute('data-export-mode') === 'true';

    if (isExporting) {
      certContainer.setAttribute('data-export-mode', 'false');
      document.querySelectorAll('.export-checkbox').forEach(cb => cb.remove());
      if (selectAllBtn) selectAllBtn.classList.add('hidden');
      if (downloadBtn) downloadBtn.classList.add('hidden');
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
      if (selectAllBtn) selectAllBtn.classList.remove('hidden');
      if (downloadBtn) downloadBtn.classList.add('hidden');
      certContainer.setAttribute('data-export-mode', 'true');
if (selectAllBtn) selectAllBtn.classList.remove('hidden');
if (downloadBtn) downloadBtn.classList.remove('hidden');
      if (selectAllBtn) selectAllBtn.classList.remove('hidden');
if (downloadBtn) downloadBtn.classList.add('hidden');
const certActions = document.getElementById('certEmailActions');
if (certActions) certActions.classList.remove('hidden');

      exportBtn.setAttribute('data-export-type', type);

      document.querySelectorAll('.cert-card').forEach(card => {
        let checkbox = card.querySelector('.export-checkbox');
        if (!checkbox) {
          checkbox = document.createElement('input');
          checkbox.type = 'checkbox';
          checkbox.className = 'export-checkbox absolute top-2 right-2 w-5 h-5 accent-blue-600';
          card.classList.add('relative');
          checkbox.addEventListener('change', () => {
  const anyChecked = document.querySelectorAll('.export-checkbox:checked').length > 0;
  if (downloadBtn) downloadBtn.classList.toggle('hidden', !anyChecked);
  if (selectAllBtn) selectAllBtn.classList.remove('hidden');
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
      Swal.fire('Υπό ανάπτυξη', 'Η εξαγωγή σε PDF δεν είναι ακόμη διαθέσιμη.', 'info');
    }
  });

  try {
    const { data: sessionData } = await supabase.auth.getSession();
    currentUser = sessionData?.session?.user;
    if (!currentUser) throw new Error('Μη έγκυρη συνεδρία.');

    const { data: profile, error: profileErr } = await supabase
      .from('companies')
      .select('name, afm')
      .eq('user_id', currentUser.id)
      .maybeSingle();

    if (profileErr) throw profileErr;
    const displayName = profile?.name || currentUser.email;
    // document.getElementById('userGreeting').textContent = `Καλώς ήρθες, ${displayName}`;
    const companyNameEl = document.getElementById('companyName');
    if (companyNameEl) companyNameEl.textContent = displayName;

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
    // 🔧 Το γρανάζι καταργήθηκε
// document.getElementById('userSettingsBtn')?.addEventListener(...);

    // await loadCompanies(); // καταργήθηκε επειδή δεν υπάρχει πλέον σχετικό στοιχείο στο DOM
    await loadCertificates();

    
    }
   catch (err) {
    handleError(err);
  }

// Φόρτωση πιστοποιητικών
export async function loadCertificates() {
  window.loadCertificates = loadCertificates;
  const searchTerm = document.getElementById('searchInput')?.value.toLowerCase() || '';
  document.getElementById('loadingCertificates').classList.remove('hidden');
  document.getElementById('noCertificatesMessage').classList.add('hidden');
  document.getElementById('certContainer').classList.add('hidden');

  try {
    const { data, error } = await supabase
      .from('company_certificates')
      .select('*')
      .eq('company_user_id', currentUser.id)
      .order('date', { ascending: false });

    if (error) throw error;

    const today = new Date();
    const filtered = data.filter(cert => {
      const match = `${cert.title} ${cert.type} ${cert.company_afm}`.toLowerCase();
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

    const grid = document.getElementById('certContainer');
    grid.innerHTML = '';
    filtered.forEach(cert => {
      const expDate = new Date(cert.date);
      const diffDays = Math.ceil((expDate - today) / (1000 * 60 * 60 * 24));
      const isExpired = diffDays < 0;
      const isExpiringSoon = diffDays >= 0 && diffDays <= 30;
      const borderClass = isExpired ? 'border-[#dc2626]' : isExpiringSoon ? 'border-[#f59e0b]' : 'border-transparent';
      const label = isExpired
        ? '<span class="text-red-600 font-semibold">Έληξε</span>'
        : isExpiringSoon
        ? `<span class="text-orange-500 font-medium">Λήγει σε ${diffDays} ημέρες</span>`
        : '<span class="text-green-600 font-medium">Ισχύει</span>';

      const card = document.createElement('div');
      card.className = `card-transition shadow-sm bg-white dark:bg-gray-800 rounded-2xl p-4 flex flex-col justify-between border-2 ${borderClass} cert-card`;
      card.innerHTML = `
        <div>
          <h3 class="font-semibold mb-1 text-gray-800 dark:text-white">${cert.title}</h3>
          <p class="text-sm text-gray-700 dark:text-gray-300">${cert.type}</p>
          <p class="text-sm text-gray-700 dark:text-gray-300">${expDate.toLocaleDateString('el-GR')} <span class="ml-2">${label}</span></p>
          <p class="text-sm text-gray-500 dark:text-gray-400 mt-2">Αρχείο: ${cert.name}</p>
        </div>
        <div class="mt-4 flex justify-end space-x-2">
          <button class="edit-btn text-gray-500" data-id="${cert.id}" title="Επεξεργασία"><i data-lucide="pencil"></i></button>
          <button class="view-btn text-gray-500" data-url="${cert.file_url}" title="Προβολή"><i data-lucide="eye"></i></button>
          <button class="delete-btn text-gray-500" data-id="${cert.id}" data-url="${cert.file_url}" title="Διαγραφή"><i data-lucide="trash-2"></i></button>
        </div>`;
      const exportMode = grid.getAttribute('data-export-mode') === 'true';
      if (exportMode) {
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'export-checkbox absolute top-2 right-2 w-5 h-5 accent-blue-600';
        checkbox.style.position = 'absolute';
        checkbox.style.top = '0.5rem';
        checkbox.style.right = '0.5rem';
        card.appendChild(checkbox);
      }
      grid.appendChild(card);
    });
    document.getElementById('certContainer').classList.remove('hidden');
    bindCertificateActions();
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
  document.querySelectorAll('.view-btn').forEach(btn => btn.addEventListener('click', () => {
    Swal.fire({ html: `<embed src="${btn.dataset.url}" type="application/pdf" width="100%" height="700px" class="rounded border" />`, showCloseButton: true, showConfirmButton: false, width: '90%' });
  }));
  document.querySelectorAll('.delete-btn').forEach(btn => btn.addEventListener('click', async () => {
    const result = await Swal.fire({ title: 'Διαγραφή Πιστοποιητικού', text: 'Είσαι σίγουρος/η;', icon: 'warning', showCancelButton: true });
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
  }));
  document.querySelectorAll('.edit-btn').forEach(btn => btn.addEventListener('click', async () => {
    const { data: certs } = await supabase.from('company_certificates').select('*').eq('id', btn.dataset.id);
    const cert = certs[0];
    const { value } = await Swal.fire({
      title: 'Επεξεργασία Πιστοποιητικού',
      html: `
        <input id="swal-title" class="swal2-input" value="${cert.title}">
        <select id="swal-type" class="swal2-select mb-2">
          <option value="Πιστοποιητικό"${cert.type==='Πιστοποιητικό'?' selected':''}>Πιστοποιητικό</option>
          <option value="Απόφαση"${cert.type==='Απόφαση'?' selected':''}>Απόφαση</option>
          <option value="Νομιμοποιητικό έγγραφο"${cert.type==='Νομιμοποιητικό έγγραφο'?' selected':''}>Νομιμοποιητικό έγγραφο</option>
          <option value="Ανάλυση"${cert.type==='Ανάλυση'?' selected':''}>Ανάλυση</option>
          <option value="CE"${cert.type==='CE'?' selected':''}>CE</option>
        </select>
        <input id="swal-date" type="date" class="swal2-input" value="${cert.date}">
      `,
      focusConfirm: false,
      showCancelButton: true,
      preConfirm: () => ({ id: cert.id, title: document.getElementById('swal-title').value, type: document.getElementById('swal-type').value, date: document.getElementById('swal-date').value })
    });
    if (value) {
      await supabase.from('company_certificates').update(value).eq('id', value.id);
      await loadCertificates();
    }
  }));
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
  const { data } = await supabase.from('company_certificates').select('*').eq('company_user_id', currentUser.id).order('date', { ascending: false });
  const soon = data.filter(c => {
    const diff = Math.ceil((new Date(c.date) - new Date()) / (1000 * 60 * 60 * 24));
    return diff >= 0 && diff <= 30;
  });
  const html = soon.length
    ? `<ul class='text-left'>${soon.map(c => `<li>• ${c.title}: ${new Date(c.date).toLocaleDateString('el-GR')}</li>`).join('')}</ul>`
    : 'Δεν υπάρχουν επικείμενες λήξεις.';
  Swal.fire({ title: 'Ειδοποιήσεις λήξης', html, icon: soon.length ? 'warning' : 'info' });
}

// Η συνάρτηση loadCompanies() αφαιρέθηκε γιατί δεν χρησιμοποιείται πλέον


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
      <div id="swal-preview" class="mt-4"></div>
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
      const type = document.getElementById('swal-type').value;
      const date = document.getElementById('swal-date').value;
      const file = document.getElementById('swal-file').files[0];
      if (!title || !type || !date || !file) {
        Swal.showValidationMessage('Συμπλήρωσε όλα τα πεδία και ανέβασε PDF');
      }
      return { title, type, date, file };
    }
  }).then(async (res) => {
    if (res.isConfirmed) {
      try {
        showLoading();
        const { title, type, date, file } = res.value;
        const ext = file.name.split('.').pop();
        const uuid = crypto.randomUUID();
        const path = `${currentUser.id}/${uuid}.${ext}`;
        const { error: upErr } = await supabase.storage.from('companycertificates').upload(path, file);
        if (upErr) throw upErr;
        const { data: urlData, error: urlErr } = await supabase.storage.from('companycertificates').getPublicUrl(path);
        if (urlErr) throw urlErr;

        const { data: profile, error: profileErr } = await supabase
          .from('companies')
          .select('name, afm')
          .eq('user_id', currentUser.id)
          .maybeSingle();
        if (profileErr) throw profileErr;

        const { error: insertErr } = await supabase
          .from('company_certificates')
          .insert([{
            company_user_id: currentUser.id,
            title,
            type,
            date,
            file_url: urlData.publicUrl,
            company_email: currentUser.email,
            name: file.name,
            company_name: profile?.name || currentUser.email,
            company_afm: profile?.afm || '',
            timestamp: new Date().toISOString()
          }]);
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




