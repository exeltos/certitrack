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
    const nameSpan = document.getElementById('companyName');
    if (nameSpan) nameSpan.textContent = company.name;
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
    const { data: certs, error } = await supabase
      .from('company_certificates')
      .select('id')
      .eq('company_user_id', session.user.id);

    if (error) throw error;

    

const total = certs?.length || 0;
    const certBtn = document.querySelector('a[href="company_certificates.html"]');
    if (certBtn) {
      certBtn.textContent = `📦 Τα Πιστοποιητικά μου ${total}`;
    }
  } catch (err) {
    console.warn('Σφάλμα στον υπολογισμό πιστοποιητικών:', err);
  }
}

function logout() {
  Swal.fire({
    title: 'Αποσύνδεση',
    text: 'Θέλεις σίγουρα να αποσυνδεθείς;',
    icon: 'question',
    showCancelButton: true,
    confirmButtonText: 'Ναι, αποσύνδεση',
    cancelButtonText: 'Ακύρωση'
  }).then(async (result) => {
    if (result.isConfirmed) {
      await supabase.auth.signOut();
      window.location.href = 'general_login.html';
    }
  });
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

  // Fetch supplier relations
  const { data: relations, error: relError } = await supabase
    .from('company_suppliers')
    .select('company_name, supplier_name, supplier_id, suppliers(id, name, afm, email, user_id)')
    .eq('company_id', company.id);
  if (relError) return handleError(relError);

  // Batch fetch certificates for all suppliers
  const userIds = relations.map(r => r.suppliers?.user_id).filter(Boolean);
  let certsBySupplier = {};
  if (userIds.length) {
    const { data: allCerts, error: certErr } = await supabase
      .from('supplier_certificates')
      .select('supplier_user_id, date')
      .in('supplier_user_id', userIds);

    if (!certErr && allCerts) {
      allCerts.forEach(cert => {
        const sid = cert.supplier_user_id;
        certsBySupplier[sid] = certsBySupplier[sid] || [];
        certsBySupplier[sid].push(cert);
      });
    }
  }

  // Build list with stats
  let list = relations.map(r => {
    const s = r.suppliers || { name: r.supplier_name, afm: '', email: '', user_id: null }; 
    const certs = certsBySupplier[s.user_id] || [];
    const now = new Date();
    const stats = { total: certs.length, active: 0, soon: 0, expired: 0 };
    certs.forEach(cert => {
      const days = Math.ceil((new Date(cert.date) - now) / (1000 * 60 * 60 * 24));
      if (days < 0) stats.expired++;
      else if (days <= 30) stats.soon++;
      else stats.active++;
    });
    return {
      id: r.supplier_id,
      user_id: s.user_id,
      name: s.name,
      afm: s.afm,
      email: s.email,
      status: s.user_id ? '✅ Εγγεγραμμένος' : '🕓 Εκκρεμή εγγραφή',
      stats
    };
  }).filter(r => r.name.toLowerCase().includes(search.toLowerCase()));

  if (sort === 'afm') {
    list.sort((a, b) => a.afm.localeCompare(b.afm));
  } else if (sort === 'name') {
    list.sort((a, b) => a.name.localeCompare(b.name));
  } else if (sort === 'registered') {
    list.sort((a, b) => (b.status === '✅ Εγγεγραμμένος') - (a.status === '✅ Εγγεγραμμένος'));
  } else if (sort === 'pending') {
    list.sort((a, b) => (b.status === '🕓 Εκκρεμή εγγραφή') - (a.status === '🕓 Εκκρεμή εγγραφή'));
  }

  // Continue with stats-rendered list
  const container = document.getElementById('dataSection');
  container.className = 'grid gap-4 grid-cols-1 sm:grid-cols-2';
  container.innerHTML = '';

  if (!list.length) {
    container.innerHTML = '<p class="text-center">Δεν βρέθηκαν προμηθευτές.</p>';
    hideLoading();
    return;
  }

  for (const r of list) {
    // Use precomputed stats
    const stats = r.stats;

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
    // μεταφέρεται το checkbox μέσα στο innerHTML

    const isExporting = container.getAttribute('data-export-mode') === 'true';
    if (isExporting) {
      checkbox.classList.remove('hidden');
    }

      card.innerHTML = `
      <input type="checkbox" class="supplier-checkbox w-5 h-5 absolute top-2 right-2 z-10 rounded-full accent-purple-600 border border-purple-300 ${isExporting ? '' : 'hidden'}" data-id="${r.id}" data-status="${r.status}" />
      <div>
        <h3 class="font-semibold text-lg">${r.name}</h3>
        <p class="text-sm">ΑΦΜ: ${r.afm || '—'}</p>
        <p class="text-sm">Email: ${r.email || '—'}</p>
        <p class="text-xs mt-2 text-gray-600">
          Πιστοποιητικά: ${r.stats.total} (Ενεργά: ${r.stats.active}, Προς λήξη: ${r.stats.soon}, Ληγμένα: ${r.stats.expired})
        </p>
      </div>
      <div class="text-xs font-medium mt-1 ${r.status === '✅ Εγγεγραμμένος' ? 'text-green-500' : 'text-yellow-500'}">${r.status}</div>`;

    card.classList.add('cursor-pointer', 'hover:ring-2', 'hover:ring-blue-400');
    card.onclick = (e) => {
      const container = document.getElementById('dataSection');
      const isExporting = container?.getAttribute('data-export-mode') === 'true';
      const isPending = container?.getAttribute('data-pending-mode') === 'true';
      if (isExporting || isPending || e.target.closest('.supplier-checkbox')) return;
      window.location.href = `supplier_view.html?id=${r.id}`;
    };

    container.appendChild(card);
  }

  document.getElementById('supplierCount').textContent = list.length;
  lucide.createIcons();
  hideLoading();
}


window.filterData = filterData;
document.getElementById('sortSelect')?.addEventListener('change', () => renderSuppliers(company));
window.showAddSupplierForm = showAddSupplierForm;

function toggleSendDownloadButtons() {
  const selected = document.querySelectorAll('.supplier-checkbox:checked');
  document.getElementById('sendEmailBtn')?.classList.toggle('hidden', selected.length === 0);
}

async function showPendingSuppliersOnly() {
  document.getElementById('certControls')?.classList.add('hidden');
  document.getElementById('supplierControls')?.classList.remove('hidden');
  showLoading();
  const { data, error } = await supabase
    .from('company_suppliers')
    .select('company_name, supplier_name, supplier_id, suppliers (id, name, afm, email, user_id)')
    .eq('company_id', company.id);

  if (error) return handleError(error);

  const container = document.getElementById('dataSection');
  container.innerHTML = '';

  const filtered = data
    .map(r => {
      const s = r.suppliers || { name: r.supplier_name, afm: '', email: '', user_id: null };
      return {
        id: r.supplier_id,
        user_id: s.user_id,
        name: s.name,
        afm: s.afm,
        email: s.email,
        status: s.user_id ? '✅ Εγγεγραμμένος' : '🕓 Εκκρεμή εγγραφή'
      };
    })
    .filter(r => !r.user_id);

  for (const r of filtered) {
    const card = document.createElement('div');
    card.className = 'bg-white bg-gray-100 px-8 py-6 rounded-2xl shadow hover:shadow-xl transition fade-in flex justify-between items-center w-full max-w-7xl self-center relative';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'supplier-checkbox w-5 h-5 absolute top-2 right-2 rounded-full accent-purple-600 border border-purple-300';
    checkbox.dataset.id = r.id;
    checkbox.dataset.status = r.status;
    checkbox.addEventListener('change', toggleSendDownloadButtons);
    card.appendChild(checkbox);

    card.innerHTML += `
      <div>
        <h3 class="font-semibold text-lg">${r.name}</h3>
        <p class="text-sm">ΑΦΜ: ${r.afm || '—'}</p>
        <p class="text-sm">Email: ${r.email || '—'}</p>
      </div>
      <div class="text-xs font-medium mt-1 text-yellow-500">${r.status}</div>
    `;

    card.onclick = (e) => {
      if (e.target.closest('.supplier-checkbox')) return;
      window.location.href = `supplier_view.html?id=${r.id}`;
    };

    container.appendChild(card);
  }

  document.getElementById('certEmailActions')?.classList.remove('hidden');
  document.getElementById('sendEmailBtn')?.classList.add('hidden');
  document.getElementById('selectAllBtn')?.classList.remove('hidden');
  document.getElementById('downloadBtn')?.classList.add('hidden');
  document.getElementById('supplierCount').textContent = filtered.length;
  hideLoading();
}

// Ενέργειες για το κουμπί Εξαγωγή
setTimeout(() => {
  // 🔧 Οπτική ένδειξη ενεργών λειτουργιών
  const toggleHighlight = (el, active) => {
  if (!el) return;
  el.classList.toggle('bg-blue-100', active);
  el.classList.toggle('text-blue-800', active);
  el.classList.toggle('dark:bg-blue-800', active);
  el.classList.toggle('dark:text-white', active);
  el.classList.toggle('rounded-full', active);
  el.classList.toggle('shadow-sm', active);

  const icon = el.querySelector('i');
  if (icon) {
    icon.classList.toggle('stroke-[3]', active);
    icon.classList.toggle('scale-110', active);
  }
};;
  // Προσθήκη λειτουργίας στο κουμπί mailBtn (φακέλου)
  const mailBtn = document.getElementById('mailBtn');
if (mailBtn && !mailBtn.hasAttribute('data-listener')) {
  mailBtn.setAttribute('data-listener', 'true');
  mailBtn.addEventListener('click', () => {
    const exportBtn = document.getElementById('exportMenuBtn');
    exportBtn?.classList.remove('ring-2', 'ring-blue-500', 'rounded-lg');
    const wasPending = exportContainer.getAttribute('data-pending-mode') === 'true';
    if (wasPending) {
      toggleHighlight(mailBtn, false);
      exportContainer.removeAttribute('data-pending-mode');
      document.getElementById('certEmailActions')?.classList.add('hidden');
      document.querySelectorAll('.supplier-checkbox').forEach(cb => {
        cb.classList.add('hidden');
        cb.checked = false;
      });
      document.getElementById('sendEmailBtn')?.classList.add('hidden');
      showSuppliers(company);
      return;
      return;
    } else {
      const isPendingNow = !exportContainer.getAttribute('data-pending-mode');
toggleHighlight(mailBtn, isPendingNow);
toggleHighlight(document.getElementById('exportMenuBtn'), false);
    }
    const exportContainer = document.getElementById('dataSection');
    const isPendingMode = exportContainer.getAttribute('data-pending-mode') === 'true';

    if (isPendingMode) {
      toggleHighlight(mailBtn, false);
      exportContainer.removeAttribute('data-pending-mode');
      document.getElementById('certEmailActions')?.classList.add('hidden');
      document.querySelectorAll('.supplier-checkbox').forEach(cb => {
        cb.classList.add('hidden');
        cb.checked = false;
      });
      document.getElementById('sendEmailBtn')?.classList.add('hidden');
      showSuppliers(company);
    } else {
      toggleHighlight(mailBtn, true);
      exportContainer.setAttribute('data-pending-mode', 'true');
      setActiveTab('btnSuppliers');
      showPendingSuppliersOnly();

// Override selectAll behavior for sendEmailBtn visibility
document.getElementById('selectAllBtn')?.addEventListener('click', () => {
  const checkboxes = document.querySelectorAll('.supplier-checkbox');
  const allChecked = Array.from(checkboxes).every(cb => cb.checked);
  checkboxes.forEach(cb => {
    cb.checked = !allChecked;
    cb.dispatchEvent(new Event('change'));
  });
  // Ensure export row is visible
  document.getElementById('certEmailActions')?.classList.remove('hidden');
  // Toggle send button
  const anyChecked = Array.from(checkboxes).some(cb => cb.checked);
  document.getElementById('sendEmailBtn')?.classList.toggle('hidden', !anyChecked);
});
      document.getElementById('downloadBtn')?.classList.add('hidden');
      // εμφανίζεται μόνο όταν επιλεγεί κάποιο checkbox
      toggleSendDownloadButtons();
    }
  });
} else if (!mailBtn) {
  const mailBtnEl = document.createElement('button');
  mailBtnEl.id = 'mailBtn';
  mailBtnEl.title = 'Εναλλαγή λειτουργίας αποστολής πρόσκλησης';
  mailBtnEl.className = 'text-gray-600 dark:text-gray-300 hover:text-blue-600 rounded-lg';
  mailBtnEl.innerHTML = '<i data-lucide="mail" class="w-5 h-5"></i>';
  document.getElementById('exportMenuBtn')?.insertAdjacentElement('afterend', mailBtnEl);
  lucide.createIcons();
  mailBtnEl.setAttribute('data-listener', 'true');
  mailBtnEl.addEventListener('click', () => {
    const exportContainer = document.getElementById('dataSection');
    const isPendingMode = exportContainer.getAttribute('data-pending-mode') === 'true';

    if (isPendingMode) {
      exportContainer.removeAttribute('data-pending-mode');
      document.getElementById('certEmailActions')?.classList.add('hidden');
      document.querySelectorAll('.supplier-checkbox').forEach(cb => {
        cb.classList.add('hidden');
        cb.checked = false;
      });
      showSuppliers(company);
    } else {
      exportContainer.setAttribute('data-pending-mode', 'true');
      setActiveTab('btnSuppliers');
      showPendingSuppliersOnly();
    }
  });
  }
  
  
  const exportBtn = document.getElementById('exportMenuBtn');
// Η μεταβλητή exportBtn έχει ήδη δηλωθεί — αφαιρείται η επανάληψη
  const certEmailActions = document.getElementById('certEmailActions');

  if (exportBtn) {
    exportBtn.setAttribute('title', 'Εναλλαγή λειτουργίας εξαγωγής');
    exportBtn.addEventListener('click', () => {
      const mailBtn = document.getElementById('mailBtn');
      mailBtn?.classList.remove('ring-2', 'ring-blue-500', 'rounded-lg');
      const isExportingNow = document.getElementById('dataSection').getAttribute('data-export-mode') !== 'true';
toggleHighlight(exportBtn, isExportingNow);
toggleHighlight(document.getElementById('mailBtn'), false);
      const exportContainer = document.getElementById('dataSection');
      const isExporting = exportContainer.getAttribute('data-export-mode') === 'true';

      if (isExporting) {
  toggleHighlight(exportBtn, false);
  exportContainer.setAttribute('data-export-mode', 'false');
  exportContainer.removeAttribute('data-pending-mode');
  document.querySelectorAll('.supplier-checkbox').forEach(cb => {
    cb.classList.add('hidden');
    cb.checked = false;
  });
  certEmailActions?.classList.add('hidden');
  document.getElementById('selectAllBtn')?.classList.add('hidden');
  document.getElementById('downloadBtn')?.classList.add('hidden');
  showSuppliers(company);
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
        const wasActive = exportContainer.getAttribute('data-export-mode') === 'true';
        if (wasActive) {
          toggleHighlight(exportBtn, false);
          exportContainer.setAttribute('data-export-mode', 'false');
          document.querySelectorAll('.supplier-checkbox').forEach(cb => {
            cb.classList.add('hidden');
            cb.checked = false;
          });
          certEmailActions?.classList.add('hidden');
          document.getElementById('selectAllBtn')?.classList.add('hidden');
          document.getElementById('downloadBtn')?.classList.add('hidden');
          showSuppliers(company);
          return;
        } else {
          toggleHighlight(exportBtn, true);
          exportContainer.setAttribute('data-export-mode', 'true');
        }
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
    const isPending = document.getElementById('dataSection')?.getAttribute('data-pending-mode') === 'true';
    if (isPending) {
      document.getElementById('sendEmailBtn')?.classList.toggle('hidden', selected.length === 0);
    } else {
      document.getElementById('downloadBtn')?.classList.toggle('hidden', selected.length === 0);
    }
  });

  // Επιλογή όλων toggle
  document.getElementById('selectAllBtn')?.addEventListener('click', () => {
    const checkboxes = document.querySelectorAll('.supplier-checkbox');
    const allChecked = Array.from(checkboxes).every(cb => cb.checked);
    checkboxes.forEach(cb => {
      cb.checked = !allChecked;
      cb.dispatchEvent(new Event('change'));
    });

    const anyChecked = Array.from(checkboxes).some(cb => cb.checked);
    const isPending = document.getElementById('dataSection')?.getAttribute('data-pending-mode') === 'true';

    if (isPending) {
      document.getElementById('sendEmailBtn')?.classList.toggle('hidden', !anyChecked);
      document.getElementById('downloadBtn')?.classList.add('hidden');
    } else {
      document.getElementById('downloadBtn')?.classList.toggle('hidden', !anyChecked);
      document.getElementById('sendEmailBtn')?.classList.add('hidden');
    }
  });

  // Alias for setupBulkInviteButtons for backwards compatibility
  const setupBulkInviteButtons = toggleSendDownloadButtons;
  window.setupBulkInviteButtons = setupBulkInviteButtons;

// Close setTimeout block for Export button actions
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
        const { data: newSupplierData, error: insertErr } = await supabase.from('suppliers').insert([{ name, email, afm, status: '🕓 Μη Εγγεγραμμένος' }]).select();

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
        await supabase.from('company_suppliers').insert([{ company_id: company.id, supplier_id: supplierId, status: '🕓 Μη Εγγεγραμμένος', timestamp: new Date().toISOString(), company_name: company.name, supplier_name: name }]);
        
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


