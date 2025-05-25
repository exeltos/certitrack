// companyDashboard.js

import { supabase } from './supabaseClient.js';
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
    await updateCertificateCount();
    setActiveTab('btnSuppliers');
    await showSuppliers(company);
    await updateRegisteredSuppliers(company.id);
    document.getElementById('companyName').textContent = company.name;
    document.getElementById('logoutBtn').onclick = logout;

    document.getElementById('btnSuppliers')?.addEventListener('click', () => {
      setActiveTab('btnSuppliers');
      showSuppliers(company);
    });

    const supplierControls = document.getElementById('supplierControls');
    if (supplierControls) supplierControls.classList.remove('hidden');
  } finally {
    document.getElementById('loading')?.classList.add('hidden');
  }
}

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

async function updateCertificateCount() {
  try {
    const { data: suppliers, error: sError } = await supabase
      .from('company_suppliers')
      .select('suppliers(user_id)')
      .eq('company_id', company?.id || '');

    if (sError) throw sError;

    const userIds = suppliers
      .map(r => r.suppliers?.user_id)
      .filter(Boolean);

    if (!userIds.length) return;

    const { data, error } = await supabase
      .from('supplier_certificates')
      .select('id')
      .in('supplier_user_id', userIds);

const total = data?.length || 0;
    const certBtn = document.querySelector('a[href="company_certificates.html"]');
    if (certBtn) {
      certBtn.innerHTML = `📦 Τα Πιστοποιητικά μου <span class="ml-1 text-sm text-gray-500">(${total})</span>`;
    }
  } catch (err) {
    console.warn('Σφάλμα στον υπολογισμό πιστοποιητικών:', err);
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
  const inviteBtn = document.getElementById('inviteBtn');

  if (activeId === 'btnSuppliers') {
    supplierControls?.classList.remove('hidden');
    inviteBtn?.classList.remove('hidden');
  } else if (activeId === 'btnCertificates') {
    inviteBtn?.classList.add('hidden');
    supplierControls?.classList.add('hidden');
  }
}

function filterData() {
  const isCertTab = document.getElementById('btnCertificates')?.classList.contains('ring-2');
  const term = isCertTab
    ? document.getElementById('searchInputCertificates')?.value.toLowerCase() || ''
    : document.getElementById('searchInputSuppliers')?.value.toLowerCase() || '';

  if (!isCertTab) {
    renderSuppliers(company, term);
  }
}

async function showSuppliers(company) {
  document.getElementById('certControls')?.classList.add('hidden');
  document.getElementById('loading')?.classList.remove('hidden');
  document.getElementById('supplierControls')?.classList.remove('hidden');
  await renderSuppliers(company);
  setupBulkInviteButtons();
  document.getElementById('loading')?.classList.add('hidden');
}

async function renderSuppliers(company, search = '') {
  const sort = document.getElementById('sortSelect')?.value || '';
  showLoading();
  const { data, error } = await supabase
    .from('company_suppliers')
    .select('company_name, supplier_name, supplier_id, suppliers (id, name, afm, email, user_id)')
    .eq('company_id', company.id);

  if (error) return handleError(error);

  let list = data.map(r => {
    const s = r.suppliers || { name: r.supplier_name, afm: '', email: '', user_id: null };
    return {
      id: r.supplier_id,
      user_id: s.user_id,
      name: s.name,
      afm: s.afm,
      email: s.email,
      status: s.user_id ? '✅ Εγγεγραμμένος' : '🕓 Εκκρεμή εγγραφή'
    };
  }).filter(r => r.name.toLowerCase().includes(search.toLowerCase()));

  if (sort === 'name') list.sort((a, b) => a.name.localeCompare(b.name));
  else if (sort === 'afm') list.sort((a, b) => a.afm.localeCompare(b.afm));
  else if (sort === 'registered') list.sort((a, b) => (b.user_id ? 1 : 0) - (a.user_id ? 1 : 0));
  else if (sort === 'pending') list.sort((a, b) => (a.user_id ? 1 : 0) - (b.user_id ? 1 : 0));

  const container = document.getElementById('dataSection');
  container.className = 'grid gap-4 grid-cols-1 sm:grid-cols-2';
  container.innerHTML = '';

  if (!list.length) {
    container.innerHTML = '<p class="text-center">Δεν βρέθηκαν προμηθευτές.</p>';
    hideLoading();
    return;
  }

  for (const r of list) {
    let certs = [];
    

    const now = new Date();
    const stats = { total: certs.length, active: 0, soon: 0, expired: 0 };
    certs.forEach(cert => {
      const days = Math.ceil((new Date(cert.date) - now) / (1000 * 60 * 60 * 24));
      if (days < 0) stats.expired++;
      else if (days <= 30) stats.soon++;
      else stats.active++;
    });

    const card = document.createElement('div');
    card.className = 'bg-white bg-gray-100 px-8 py-6 rounded-2xl shadow hover:shadow-xl transition fade-in flex justify-between items-center w-full max-w-7xl self-center relative';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'supplier-checkbox w-5 h-5 absolute top-2 right-2 z-10 rounded-full accent-purple-600 border border-purple-300 hidden';
    checkbox.dataset.id = r.id;
    checkbox.dataset.status = r.status;
    checkbox.addEventListener('change', () => {
      const selected = document.querySelectorAll('.supplier-checkbox:checked');
      document.getElementById('downloadBtn')?.classList.toggle('hidden', selected.length === 0);
    });
    card.appendChild(checkbox);

      card.innerHTML += `
      <div>
        <h3 class="font-semibold text-lg">${r.name}</h3>
        <p class="text-sm">ΑΦΜ: ${r.afm || '—'}</p>
        <p class="text-sm">Email: ${r.email || '—'}</p>
        <p class="text-xs mt-2 text-gray-600 text-gray-700">
          Πιστοποιητικά: ${stats.total} (Ενεργά: ${stats.active}, Προς λήξη: ${stats.soon}, Ληγμένα: ${stats.expired})
        </p>
      </div>
      <div class="text-xs font-medium mt-1 ${r.status === '✅ Εγγεγραμμένος' ? 'text-green-500' : 'text-yellow-500'}">${r.status}</div>
    `;

    card.classList.add('cursor-pointer', 'hover:ring-2', 'hover:ring-blue-400');
    card.onclick = (e) => {
      if (e.target.closest('.supplier-checkbox')) return;
      window.location.href = `supplier_view.html?id=${r.id}`;
    };

    container.appendChild(card);
  }

  document.getElementById('supplierCount').textContent = list.length;
  lucide.createIcons();
  hideLoading();
}


window.filterData = filterData;
window.showAddSupplierForm = showAddSupplierForm;

// Ενέργειες για το κουμπί Εξαγωγή
setTimeout(() => {
  const exportBtn = document.getElementById('exportMenuBtn');
  const certEmailActions = document.getElementById('certEmailActions');

  if (exportBtn) {
    exportBtn.addEventListener('click', () => {
      const exportContainer = document.getElementById('dataSection');
      const isExporting = exportContainer.getAttribute('data-export-mode') === 'true';

      if (isExporting) {
        exportContainer.setAttribute('data-export-mode', 'false');
        document.querySelectorAll('.supplier-checkbox').forEach(cb => {
          cb.classList.add('hidden');
          cb.checked = false;
        });
        certEmailActions?.classList.add('hidden');
        document.getElementById('selectAllBtn')?.classList.add('hidden');
        document.getElementById('downloadBtn')?.classList.add('hidden');
        return;
      }

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
        exportContainer.setAttribute('data-export-mode', 'true');
        certEmailActions?.classList.remove('hidden');
        document.getElementById('selectAllBtn')?.classList.remove('hidden');
        document.querySelectorAll('.supplier-checkbox').forEach(cb => cb.classList.remove('hidden'));
        document.getElementById('downloadBtn')?.classList.add('hidden');
      });
    });
  }

  // Ενημέρωση κουμπιού λήψης ανάλογα με την επιλογή
  document.addEventListener('change', () => {
    const selected = document.querySelectorAll('.supplier-checkbox:checked');
    document.getElementById('downloadBtn')?.classList.toggle('hidden', selected.length === 0);
  });

  // Επιλογή όλων toggle
  document.getElementById('selectAllBtn')?.addEventListener('click', () => {
    const checkboxes = document.querySelectorAll('.supplier-checkbox');
    const allChecked = Array.from(checkboxes).every(cb => cb.checked);
    checkboxes.forEach(cb => {
      cb.checked = !allChecked;
      cb.dispatchEvent(new Event('change'));
    });
  });

  // Excel export listener
  const downloadBtn = document.getElementById('downloadBtn');
  if (downloadBtn && !downloadBtn.hasAttribute('data-listener')) {
    downloadBtn.setAttribute('data-listener', 'true');
    downloadBtn.addEventListener('click', () => {
      const selected = Array.from(document.querySelectorAll('.supplier-checkbox:checked'));
      if (!selected.length) return;

      const rows = [['Επωνυμία', 'Email', 'ΑΦΜ', 'Κατάσταση']];

      selected.forEach(cb => {
        const card = cb.closest('div');
        const name = card.querySelector('h3')?.textContent?.trim() || '';
        const allPs = Array.from(card.querySelectorAll('p'));
        const afm = allPs.find(p => p.textContent.trim().startsWith('ΑΦΜ:'))?.textContent.replace('ΑΦΜ:', '').trim() || '';
        const email = allPs.find(p => p.textContent.trim().startsWith('Email:'))?.textContent.replace('Email:', '').trim() || '';
        const status = card.querySelector('div.text-xs.font-medium')?.textContent?.trim() || '';
        rows.push([name, email, afm, status]);
      });

      const ws = XLSX.utils.aoa_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Προμηθευτές');
      XLSX.writeFile(wb, 'suppliers_export.xlsx');
    });
  }
}, 0);

function showAddSupplierForm() {
  Swal.fire({
    title: 'Προσθήκη Προμηθευτή',
    html: `
      <input id="supplierName" class="swal2-input" placeholder="Επωνυμία">
      <input id="supplierEmail" type="email" class="swal2-input" placeholder="Email">
      <input id="supplierAfm" class="swal2-input" placeholder="ΑΦΜ">
    `,
    confirmButtonText: 'Αποθήκευση',
    showCancelButton: true,
    preConfirm: () => {
      const name = document.getElementById('supplierName').value.trim();
      const email = document.getElementById('supplierEmail').value.trim();
      const afm = document.getElementById('supplierAfm').value.trim();
      if (!name || !email || !afm) {
        Swal.showValidationMessage('Συμπλήρωσε όλα τα πεδία.');
        return false;
      }
      return { name, email, afm };
    }
  }).then(async (result) => {
    if (!result.isConfirmed || !result.value) return;
    try {
      showLoading();
      const { name, email, afm } = result.value;

      let supplierId;
      const { data: existing, error: existingErr } = await supabase
        .from('suppliers')
        .select('id')
        .eq('afm', afm)
        .maybeSingle();

      if (existingErr) throw existingErr;

      if (existing) {
        supplierId = existing.id;
      } else {
        const { data: newSupplierData, error: insertErr } = await supabase.from('suppliers').insert([{
          name,
          email,
          afm,
          status: '🕓 Μη Εγγεγραμμένος',
          company_id: company.id
        }]).select();

        if (insertErr) throw insertErr;
        supplierId = newSupplierData[0].id;
      }

      // check if company_suppliers entry exists
      const { data: existingLink, error: linkErr } = await supabase
        .from('company_suppliers')
        .select('id')
        .eq('company_id', company.id)
        .eq('supplier_id', supplierId)
        .maybeSingle();

      if (linkErr) throw linkErr;

      if (!existingLink) {
        await supabase.from('company_suppliers').insert([{
          company_id: company.id,
          supplier_id: supplierId,
          status: '🕓 Μη Εγγεγραμμένος',
          timestamp: new Date().toISOString(),
          company_name: company.name,
          supplier_name: name
        }]);
      }

      Swal.fire('Επιτυχία', 'Ο προμηθευτής προστέθηκε ή συνδέθηκε.', 'success');
      await showSuppliers(company);
    } catch (err) {
      handleError(err);
    } finally {
      hideLoading();
    }
  });

}

function toggleSendButton() {
  const sendBtn = document.getElementById('sendInviteBtn');
  const checkboxes = document.querySelectorAll('.supplier-checkbox:checked');
  if (sendBtn) {
    sendBtn.classList.toggle('hidden', checkboxes.length === 0);
  }
}

function setupBulkInviteButtons() {
  const controls = document.getElementById('supplierControls');
  if (!controls) return;

  const existing = document.getElementById('selectAllBtn');
  if (existing) existing.remove(); // ανανέωση κουμπιών

  const actions = document.createElement('div');
  actions.className = 'flex justify-end gap-2 mb-4';
  actions.innerHTML = `
    <button id="selectAllBtn" class="px-3 py-1 bg-purple-600 text-white rounded hover:bg-purple-700 text-sm hidden">☑️ Επιλογή όλων</button>
    <button id="sendInviteBtn" class="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 text-sm hidden">📨 Αποστολή Πρόσκλησης</button>
  `;
  controls.appendChild(actions);

  document.getElementById('selectAllBtn')?.addEventListener('click', () => {
  const checkboxes = document.querySelectorAll('.supplier-checkbox');
  const allChecked = Array.from(checkboxes).every(cb => cb.checked);
  checkboxes.forEach(cb => cb.checked = !allChecked);

  // Ενημέρωση του κουμπιού λήψης
  const anyChecked = Array.from(checkboxes).some(cb => cb.checked);
  document.getElementById('downloadBtn')?.classList.toggle('hidden', !anyChecked);
});

  document.getElementById('sendInviteBtn')?.addEventListener('click', async () => {
    const selected = Array.from(document.querySelectorAll('.supplier-checkbox:checked'));
    if (!selected.length) return;

    const ids = selected.map(cb => cb.dataset.id);
    const { data: suppliers } = await supabase
      .from('suppliers')
      .select('email, name')
      .in('id', ids);

    for (const s of suppliers) {
      // αποστολή email μπορεί να γίνει με edge function, placeholder εδώ
      console.log(`Sending invite to: ${s.email}`);
    }
    Swal.fire('Επιτυχία', 'Οι προσκλήσεις στάλθηκαν.', 'success');
  });
}


