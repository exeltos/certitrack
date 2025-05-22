// companyDashboard.js

import { supabase } from './supabaseClient.js';
import { showSuppliers, renderSuppliers } from './suppliers_dashboard.js';
import { showLoading, hideLoading, handleError } from './common.js';

let company, userId, session;

lucide.createIcons();
    
dashboardInit();

async function dashboardInit() {
  lucide.createIcons();

  try {
    const { data: { session: sess } } = await supabase.auth.getSession();
    session = sess;
    if (!session) return logout();
    userId = session.user.id;

    const { data: comp, error: compErr } = await supabase
      .from('companies')
      .select('id, name, afm')
      .eq('email', session.user.email)
      .single();
    if (compErr) return logout();

    company = comp;
    await updateRegisteredSuppliers(company.id);
    document.getElementById('companyName').textContent = company.name;
    document.getElementById('logoutBtn').onclick = logout;

    document.getElementById('btnSuppliers')?.addEventListener('click', () => {
      setActiveTab('btnSuppliers');
      showSuppliers(company);
    });

    const supplierControls = document.getElementById('supplierControls');
    if (supplierControls) supplierControls.classList.remove('hidden');
    // handleError(err); (διορθώθηκε σφάλμα: err δεν υπήρχε εδώ)
  } finally {
    document.getElementById('loading')?.classList.add('hidden');
  }
}

// preloadCertificateCount καταργήθηκε (πλέον δεν χρησιμοποιείται)

async function updateRegisteredSuppliers(companyId) {
  try {
    const { data: links, error: linksErr } = await supabase
      .from('company_suppliers')
      .select('id, supplier_id')
      .eq('company_id', companyId);

    if (linksErr) throw linksErr;

    for (const link of links) {
      if (!link.supplier_id) continue;
      const { data: supplier, error: sErr } = await supabase
        .from('suppliers')
        .select('user_id')
        .eq('id', link.supplier_id)
        .maybeSingle();

      if (sErr || !supplier?.user_id) continue;

      await supabase
        .from('company_suppliers')
        .update({
          status: '✅ Εγγεγραμμένος',
          timestamp: new Date().toISOString()
        })
        .eq('id', link.id);
    }
  } catch (err) {
    console.warn('updateRegisteredSuppliers error:', err);
  }
}

function logout() {
  supabase.auth.signOut();
  window.location.href = 'general_login.html';
}

function setActiveTab(activeId) {
  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('ring-2', 'ring-blue-500'));
  document.getElementById(activeId)?.classList.add('ring-2', 'ring-blue-500');

  const supplierControls = document.getElementById('supplierControls');
  // const certControls = document.getElementById('certControls'); (καταργήθηκε γιατί δεν χρησιμοποιείται πια)
  const inviteBtn = document.getElementById('inviteBtn');

  if (activeId === 'btnSuppliers') {
    supplierControls?.classList.remove('hidden');
    
    inviteBtn?.classList.remove('hidden');
  
} else if (activeId === 'btnCertificates') {
    inviteBtn?.classList.add('hidden');
    certControls?.classList.remove('hidden');
    supplierControls?.classList.add('hidden');
  }
}

function filterData() {
  const isCertTab = document.getElementById('btnCertificates')?.classList.contains('ring-2');
  const term = isCertTab
    ? document.getElementById('searchInputCertificates')?.value.toLowerCase() || ''
    : document.getElementById('searchInputSuppliers')?.value.toLowerCase() || '';
  if (isCertTab) {
    renderCertificates(term);
  } else {
    renderSuppliers(company, term);
  }
  }

function showCertificateForm() {
  Swal.fire({
    title: 'Προσθήκη Πιστοποιητικού',
    html: `
      <input id="certTitle" class="swal2-input" placeholder="Τίτλος">
      <select id="certType" class="swal2-input">
        <option value="Πιστοποιητικό">Πιστοποιητικό</option>
        <option value="Απόφαση">Απόφαση</option>
        <option value="Νομιμοποιητικό έγγραφο">Νομιμοποιητικό έγγραφο</option>
        <option value="Ανάλυση">Ανάλυση</option>
        <option value="CE">CE</option>
      </select>
      <input id="certDate" type="date" class="swal2-input">
      <input id="certFile" type="file" accept="application/pdf" class="swal2-file">
    `,
    showCancelButton: true,
    confirmButtonText: 'Αποθήκευση',
    preConfirm: () => {
      const title = document.getElementById('certTitle').value.trim();
      const type = document.getElementById('certType').value;
      const date = document.getElementById('certDate').value;
      const file = document.getElementById('certFile').files[0];

      if (!title || !type || !date || !file) {
        Swal.showValidationMessage('Συμπλήρωσε όλα τα πεδία.');
        return false;
      }
      return { title, type, date, file };
    }
  }).then(async (result) => {
    if (!result.isConfirmed || !result.value) return;

    if (result.value.excelFile) {
      import('https://cdn.sheetjs.com/xlsx-latest/package/xlsx.mjs').then(XLSX => {
        const reader = new FileReader();
        reader.onload = async (e) => {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          const sheet = workbook.Sheets[workbook.SheetNames[0]];
          const rows = XLSX.utils.sheet_to_json(sheet);
          for (const row of rows) {
  const name = row['Επωνυμία']?.toString().trim();
  const email = row['Email']?.toString().trim();
  const afm = row['ΑΦΜ']?.toString().trim();

  // ✅ Αγνόησε γραμμές χωρίς afm (ή όλα τα πεδία κενά)
  if (!afm || (!name && !email)) continue;
            const { data, error } = await supabase.from('suppliers').insert([{ name, email, afm, status: '🕓 Μη Εγγεγραμμένος', company_id: company.id }]).select();
            if (!error) {
              await supabase.from('company_suppliers').insert([
                {
                  company_id: company.id,
                  supplier_id: data[0].id,
                  company_name: company.name,
                  supplier_name: name
                }
              ]);
            }
          }
          Swal.fire('Επιτυχία', 'Οι προμηθευτές εισήχθησαν από το αρχείο.', 'success');
          await showSuppliers(company);
        };
        reader.readAsArrayBuffer(result.value.excelFile);
      });
      return;
    }

    try {
      showLoading();
      const safeName = result.value.file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
      const path = `private/${userId}/${safeName}`;

      const { error: uploadErr } = await supabase.storage
        .from('companycertificates')
        .upload(path, result.value.file, { upsert: true });
      if (uploadErr) throw uploadErr;

      const { data: urlData, error: urlErr } = await supabase.storage
        .from('companycertificates')
        .getPublicUrl(path);
      if (urlErr) throw urlErr;

      const newCert = {
        title: result.value.title,
        type: result.value.type,
        date: result.value.date,
        file_url: urlData.publicUrl,
        company_user_id: userId,
        company_name: company.name,
        company_afm: company.afm,
        company_email: session.user.email,
        name: result.value.file.name
      };

      const { error: dbErr } = await supabase
        .from('company_certificates')
        .insert([newCert]);

      if (dbErr) throw dbErr;

      Swal.fire('Επιτυχία', 'Το πιστοποιητικό προστέθηκε.', 'success');
      await showCertificates();
    } catch (err) {
      handleError(err);
    } finally {
      hideLoading();
    }
  });
}

window.filterData = filterData;
window.showAddSupplierForm = showAddSupplierForm;
window.showCertificateForm = showCertificateForm;

function showAddSupplierForm() {
  Swal.fire({
    title: 'Προσθήκη Προμηθευτή',
    html: `
      <input id="supplierName" class="swal2-input" placeholder="Επωνυμία">
      <input id="supplierEmail" type="email" class="swal2-input" placeholder="Email">
      <input id="supplierAfm" class="swal2-input" placeholder="ΑΦΜ">
      <input id="supplierExcel" type="file" accept=".xlsx,.xls" class="swal2-file" title="Μαζική προσθήκη από Excel (προαιρετικό)">
    `,
    showCancelButton: true,
    confirmButtonText: 'Αποθήκευση',
    preConfirm: () => {
      const excelFile = document.getElementById('supplierExcel').files[0];

      if (excelFile) {
        return { excelFile };
      }

      const name = document.getElementById('supplierName').value.trim();
      const email = document.getElementById('supplierEmail').value.trim();
      const afm = document.getElementById('supplierAfm').value.trim();

      if (!name || !email || !afm) {
        Swal.showValidationMessage('Συμπλήρωσε όλα τα πεδία ή επισύναψε αρχείο Excel.');
        return false;
      }

      return { name, email, afm };
    }
  }).then(async (result) => {
    if (!result.isConfirmed || !result.value) return;
    try {
      showLoading();
      const newSupplier = {
        name: result.value.name,
        email: result.value.email,
        afm: result.value.afm,
        status: '🕓 Μη Εγγεγραμμένος',
        company_id: company.id
      };
      const { data, error } = await supabase.from('suppliers').insert([newSupplier]).select();
      if (error) throw error;

      const supplierId = data[0].id;
      await supabase.from('company_suppliers').insert([
        {
          company_id: company.id,
          supplier_id: supplierId,
          status: '🕓 Μη Εγγεγραμμένος',
          timestamp: new Date().toISOString(),
          status: '🕓 Μη Εγγεγραμμένος',
          company_name: company.name,
          supplier_name: result.value.name
        }
      ]);
      Swal.fire('Επιτυχία', 'Ο προμηθευτής προστέθηκε.', 'success');
      await showSuppliers(company);
    } catch (err) {
      handleError(err);
    } finally {
      hideLoading();
    }
  });
}

// renderCertificates καταργήθηκε - πλέον δεν χρησιμοποιείται γιατί τα πιστοποιητικά εμφανίζονται σε ξεχωριστή σελίδα

// showExpiringCertificatesPopup καταργήθηκε - πλέον δεν χρησιμοποιείται γιατί τα πιστοποιητικά εμφανίζονται σε ξεχωριστή σελίδα

function bindCertificateActions() {
  document.querySelectorAll('.view-btn').forEach(btn => {
    btn.onclick = () => {
      const url = btn.dataset.url;
      Swal.fire({
        html: `<embed src="${url}" type="application/pdf" width="100%" height="800px" />`,
        showCloseButton: true,
        showConfirmButton: false,
        width: '80%'
      });
    };
  });

  document.querySelectorAll('.delete-btn').forEach(btn => {
    btn.onclick = async () => {
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
          await showCertificates();
          Swal.fire('Διαγραφή', 'Το πιστοποιητικό διαγράφηκε επιτυχώς', 'success');
        } catch (err) {
          handleError(err);
        } finally {
          hideLoading();
        }
      }
    };
  });

  document.querySelectorAll('.edit-btn').forEach(btn => {
    btn.onclick = async () => {
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
        preConfirm: () => ({
          id: cert.id,
          title: document.getElementById('swal-title').value,
          type: document.getElementById('swal-type').value,
          date: document.getElementById('swal-date').value
        })
      });
      if (value) {
        await supabase.from('company_certificates').update(value).eq('id', value.id);
        await showCertificates();
      }
    };
  });
}

async function showCertificates(search = '') {
  const container = document.getElementById('dataSection');
  container.innerHTML = '';
  
  document.getElementById('loading')?.classList.remove('hidden');

  try {
    const { data, error } = await supabase
      .from('company_certificates')
      .select('*')
      .eq('company_user_id', userId)
      .order('date', { ascending: false });

    if (error) throw error;
    // document.getElementById('certificateCount').textContent = data.length; (πλέον δεν χρησιμοποιείται εδώ)

    const today = new Date();
    const grid = document.createElement('div');
    grid.className = 'grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3';

    data.filter(cert => {
      const expDate = new Date(cert.date).toLocaleDateString('el-GR');
      return (
        cert.title.toLowerCase().includes(search) ||
        cert.type.toLowerCase().includes(search) ||
        expDate.includes(search)
      );
    }).forEach(cert => {
      const expDate = new Date(cert.date);
      const diffDays = Math.ceil((expDate - today) / (1000 * 60 * 60 * 24));
      const isExpired = diffDays < 0;
      const isExpiringSoon = diffDays >= 0 && diffDays <= 30;
      const borderClass = isExpired ? 'border-[#dc2626]' : isExpiringSoon ? 'border-[#f59e0b]' : 'border-transparent';
      const label = isExpired
        ? '<span class="text-[#dc2626] font-bold ml-2">(Ληγμένο)</span>'
        : isExpiringSoon
          ? `<span class="text-[#f59e0b] font-bold ml-2">(Λήγει σε ${diffDays} ημέρες)</span>`
          : '';

      const card = document.createElement('div');
      card.className = `card-transition shadow-sm bg-white dark:bg-gray-800 rounded-2xl p-4 flex flex-col justify-between border-2 ${borderClass} cert-card`;
      card.innerHTML = `
        <div>
          <h3 class="font-semibold mb-1">${cert.title}</h3>
          <p class="text-sm">${cert.type}</p>
          <p class="text-sm">${expDate.toLocaleDateString('el-GR')} ${label}</p>
          <p class="text-sm text-gray-500 mt-2">Αρχείο: ${cert.name}</p>
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
</div>
      `;
      grid.appendChild(card);
    });

    container.appendChild(grid);
    bindCertificateActions();
    lucide.createIcons();
  } catch (err) {
    handleError(err);
  } finally {
    document.getElementById('loading')?.classList.add('hidden');
  }
}
