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
    if (!session) {
      console.warn("⚠️ No session found on dashboardInit");
      return logout();
    }
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
  console.log("📥 User ID for certificate count:", session?.user?.id);
  try {
    const { data: certs, error } = await supabase
      .from('company_certificates')
      .select('id')
      .eq('company_user_id', session.user.id);

    if (error) throw error;

    

const total = certs?.length || 0;
    const certCountSpan = document.getElementById('certificateCount');
    if (certCountSpan) certCountSpan.textContent = total;

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
  toggleSendDownloadButtons();
  document.getElementById('loading')?.classList.add('hidden');
}

async function renderSuppliers(company, search = '') {
  const sort = document.getElementById('sortSelect')?.value || '';
  showLoading();

  // Fetch supplier relations
  const { data: relations, error: relError } = await supabase
    .from('company_suppliers')
    .select('company_name, supplier_name, supplier_id, access, suppliers(id, name, afm, email, user_id)')
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
    access: r.access,
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
  const container = document.getElementById('dataSection');
  const selected = document.querySelectorAll('.supplier-checkbox:checked');
  const isPending = container.getAttribute('data-pending-mode') === 'true';
  const isExporting = container.getAttribute('data-export-mode') === 'true';
  const isDeleting = container.getAttribute('data-delete-mode') === 'true';

  if (selected.length > 0) {
    if (isPending) document.getElementById('sendEmailBtn')?.classList.remove('hidden');
    if (isExporting) document.getElementById('downloadBtn')?.classList.remove('hidden');
    if (isDeleting) document.getElementById('deleteSelectedBtn')?.classList.remove('hidden');
  } else {
    document.getElementById('sendEmailBtn')?.classList.add('hidden');
    document.getElementById('downloadBtn')?.classList.add('hidden');
    document.getElementById('deleteSelectedBtn')?.classList.add('hidden');
  }
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

    // ✅ Προσθέτουμε event listener στο δυναμικό checkbox
    card.querySelector('.supplier-checkbox')?.addEventListener('change', () => {
      const container = document.getElementById('dataSection');
      const selected = document.querySelectorAll('.supplier-checkbox:checked');
      const isPending = container.getAttribute('data-pending-mode') === 'true';
      const isExporting = container.getAttribute('data-export-mode') === 'true';
      const isDeleting = container.getAttribute('data-delete-mode') === 'true';

      if (selected.length > 0) {
        if (isPending) document.getElementById('sendEmailBtn')?.classList.remove('hidden');
        if (isExporting) document.getElementById('downloadBtn')?.classList.remove('hidden');
        if (isDeleting) document.getElementById('deleteSelectedBtn')?.classList.remove('hidden');
      } else {
        document.getElementById('sendEmailBtn')?.classList.add('hidden');
        document.getElementById('downloadBtn')?.classList.add('hidden');
        document.getElementById('deleteSelectedBtn')?.classList.add('hidden');
      }
    });

    if (r.access === 'blocked') {
  card.classList.add('opacity-50');
  const blockedLabel = document.createElement('div');
  blockedLabel.className = 'absolute top-1 left-1 text-red-500 text-xs';
  blockedLabel.textContent = '🚫 Μπλοκαρισμένος';
  card.appendChild(blockedLabel);
} else {
      card.classList.add('cursor-pointer', 'hover:ring-2', 'hover:ring-blue-400');
    }
    card.onclick = (e) => {
      const container = document.getElementById('dataSection');
      const isExporting = container?.getAttribute('data-export-mode') === 'true';
      const isPending = container?.getAttribute('data-pending-mode') === 'true';
      const isDeleting = container?.getAttribute('data-delete-mode') === 'true';
      const isBlocked = r.access === 'blocked';
      if (e.target.closest('.supplier-checkbox')) return;
      if (isBlocked && !isDeleting) {
        Swal.fire('Περιορισμένη Πρόσβαση', `Ο προμηθευτής ${r.name} δεν επιτρέπει την πρόσβασή σας στις πληροφορίες του.`, 'info');
        return;
      }
      if (isExporting || isPending || isDeleting) return;
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
    checkbox.addEventListener('change', () => {
  const container = document.getElementById('dataSection');
  const selected = document.querySelectorAll('.supplier-checkbox:checked');
  const isPending = container.getAttribute('data-pending-mode') === 'true';
  const isExporting = container.getAttribute('data-export-mode') === 'true';
  const isDeleting = container.getAttribute('data-delete-mode') === 'true';

  if (selected.length > 0) {
    if (isPending) document.getElementById('sendEmailBtn')?.classList.remove('hidden');
    if (isExporting) document.getElementById('downloadBtn')?.classList.remove('hidden');
    if (isDeleting) document.getElementById('deleteSelectedBtn')?.classList.remove('hidden');
  } else {
    document.getElementById('sendEmailBtn')?.classList.add('hidden');
    document.getElementById('downloadBtn')?.classList.add('hidden');
    document.getElementById('deleteSelectedBtn')?.classList.add('hidden');
  }
});
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
      const hasVisibleCheckboxes = document.querySelectorAll('.supplier-checkbox:not(.hidden)').length > 0;
      if (hasVisibleCheckboxes || e.target.closest('.supplier-checkbox')) return;
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
// ✅ Καθαρισμός λογικής mailBtn & exportBtn χωρίς επικαλύψεις

function resetExportPendingUI() {
  const container = document.getElementById('dataSection');
  container.removeAttribute('data-delete-mode');
  container.removeAttribute('data-export-mode');
  container.removeAttribute('data-pending-mode');
  document.querySelectorAll('.supplier-checkbox').forEach(cb => {
    cb.classList.add('hidden');
    cb.checked = false;
  });
  document.getElementById('certEmailActions')?.classList.add('hidden');
  document.getElementById('sendEmailBtn')?.classList.add('hidden');
  document.getElementById('downloadBtn')?.classList.add('hidden');
  document.getElementById('selectAllBtn')?.classList.add('hidden');
}

function toggleHighlight(el, active) {
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
}

const mailBtn = document.getElementById('mailBtn');
if (mailBtn && !mailBtn.hasAttribute('data-listener')) {
  mailBtn.setAttribute('data-listener', 'true');
  mailBtn.addEventListener('click', () => {
    const container = document.getElementById('dataSection');
    const isPending = container.getAttribute('data-pending-mode') === 'true';
    toggleHighlight(mailBtn, !isPending);
    toggleHighlight(document.getElementById('exportMenuBtn'), false);

    if (isPending) {
      resetExportPendingUI();
      showSuppliers(company);
    } else {
      container.setAttribute('data-pending-mode', 'true');
      showPendingSuppliersOnly();
    }
  });
}

const exportBtn = document.getElementById('exportMenuBtn');
const deleteModeBtn = document.getElementById('deleteModeBtn');
if (deleteModeBtn && !deleteModeBtn.hasAttribute('data-listener')) {
  deleteModeBtn.setAttribute('data-listener', 'true');
  deleteModeBtn.addEventListener('click', () => {
    const container = document.getElementById('dataSection');
    const isDeleting = container.getAttribute('data-delete-mode') === 'true';
    toggleHighlight(deleteModeBtn, !isDeleting);

    if (isDeleting) {
      resetExportPendingUI();
      showSuppliers(company);
      deleteModeBtn.textContent = '🗑️ Διαγραφή Προμηθευτών';
    } else {
      container.setAttribute('data-delete-mode', 'true');
      container.removeAttribute('data-export-mode');
      container.removeAttribute('data-pending-mode');
      document.getElementById('certEmailActions')?.classList.remove('hidden');
      document.getElementById('selectAllBtn')?.classList.remove('hidden');
      document.querySelectorAll('.supplier-checkbox').forEach(cb => cb.classList.remove('hidden'));
      document.getElementById('downloadBtn')?.classList.add('hidden');
      document.getElementById('sendEmailBtn')?.classList.add('hidden');
      document.getElementById('deleteSelectedBtn')?.classList.add('hidden');
      deleteModeBtn.textContent = '❌ Ακύρωση Διαγραφής';
    }
  });
}
document.getElementById('selectAllBtn')?.addEventListener('click', () => {
  const checkboxes = document.querySelectorAll('.supplier-checkbox');
  const allChecked = Array.from(checkboxes).every(cb => cb.checked);
  checkboxes.forEach(cb => {
    cb.classList.remove('hidden');
    cb.checked = !allChecked;
    cb.dispatchEvent(new Event('change'));
  });

  const container = document.getElementById('dataSection');
  const isPending = container.getAttribute('data-pending-mode') === 'true';
  const isExporting = container.getAttribute('data-export-mode') === 'true';
  const isDeleting = container.getAttribute('data-delete-mode') === 'true';

  document.getElementById('sendEmailBtn')?.classList.toggle('hidden', !(isPending && Array.from(checkboxes).some(cb => cb.checked)));
  document.getElementById('downloadBtn')?.classList.toggle('hidden', !(isExporting && Array.from(checkboxes).some(cb => cb.checked)));
  document.getElementById('deleteSelectedBtn')?.classList.toggle('hidden', !(isDeleting && Array.from(checkboxes).some(cb => cb.checked)));
});

// ✅ Εξαγωγή Excel από επιλεγμένους

// ✅ Διαγραφή επιλεγμένων προμηθευτών
const deleteSelectedBtn = document.getElementById('deleteSelectedBtn');
deleteSelectedBtn?.addEventListener('click', async () => {
  const selected = [...document.querySelectorAll('.supplier-checkbox:checked')];
  if (!selected.length) return;

  const confirm = await Swal.fire({
    title: 'Επιβεβαίωση Διαγραφής',
    html: `<p>Για να επιβεβαιώσεις τη διαγραφή, πληκτρολόγησε το ΑΦΜ της εταιρείας σου και τον κωδικό πρόσβασης.</p>
           <input id="afmConfirm" class="swal2-input" placeholder="ΑΦΜ">
           <input id="passwordConfirm" type="password" class="swal2-input" placeholder="Κωδικός Πρόσβασης">`,
    icon: 'warning',
    focusConfirm: false,
    showCancelButton: true,
    confirmButtonText: 'Διαγραφή',
    cancelButtonText: 'Ακύρωση',
    preConfirm: async () => {
      const afmInput = document.getElementById('afmConfirm').value.trim();
      const passwordInput = document.getElementById('passwordConfirm').value.trim();

      if (!afmInput || !passwordInput) {
        Swal.showValidationMessage('Συμπλήρωσε και τα δύο πεδία.');
        return false;
      }

      if (afmInput !== company.afm) {
        Swal.showValidationMessage('Λανθασμένο ΑΦΜ.');
        return false;
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email: session.user.email,
        password: passwordInput
      });

      if (error) {
        Swal.showValidationMessage('Λανθασμένος κωδικός πρόσβασης.');
        return false;
      }

      return true;
    }
  });

  if (!confirm.isConfirmed) return;

  for (const cb of selected) {
    const supplierId = cb.dataset.id;
    if (!supplierId) continue;
    await supabase
      .from('company_suppliers')
      .delete()
      .eq('company_id', company.id)
      .eq('supplier_id', supplierId);
  }

  Swal.fire('Ολοκληρώθηκε', 'Οι επιλεγμένοι προμηθευτές διαγράφηκαν.', 'success');
  await showSuppliers(company);
});

// ✅ Αποστολή προσκλήσεων εγγραφής σε επιλεγμένους
const sendEmailBtn = document.getElementById('sendEmailBtn');
sendEmailBtn?.addEventListener('click', async () => {
  const selected = [...document.querySelectorAll('.supplier-checkbox:checked')];
  if (!selected.length) return;

  let sentCount = 0;
  for (const cb of selected) {
    const card = cb.closest('div');
    const email = card.querySelector('p:nth-of-type(2)')?.textContent?.replace('Email: ', '').trim();
    const afm = card.querySelector('p:nth-of-type(1)')?.textContent?.replace('ΑΦΜ: ', '').trim();

    if (!email || !email.includes('@') || !afm) continue;

    try {
      const res = await fetch('/.netlify/functions/send_email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          type: 'invite',
          subject: '📨 Πρόσκληση Εγγραφής στο CertiTrack',
          from: { email: 'noreply@certitrack.gr', name: 'CertiTrack' }
        })
      });

      if (res.ok) {
        sentCount++;
        const { data: supplier, error } = await supabase
          .from('suppliers')
          .select('id')
          .eq('afm', afm)
          .maybeSingle();
        if (!error && supplier?.id) {
          await supabase.from('supplier_invitation').insert({
            supplier_id: supplier.id,
            email,
            sent_by: company?.id ?? userId,
            sent_at: new Date().toISOString()
          });
        }
      } else {
        const txt = await res.text();
        console.error('❌ Αποτυχία αποστολής:', res.status, txt);
      }
    } catch (err) {
      console.error('Invite error:', err);
    }
  }

  Swal.fire('Ολοκληρώθηκε', `Στάλθηκαν ${sentCount} προσκλήσεις.`, 'success');
});
const downloadBtn = document.getElementById('downloadBtn');
downloadBtn?.addEventListener('click', () => {
  const selected = document.querySelectorAll('.supplier-checkbox:checked');
  if (!selected.length) return;

  const rows = [['Επωνυμία', 'ΑΦΜ', 'Email']];
  selected.forEach(cb => {
    const card = cb.closest('div');
    const name = card.querySelector('h3')?.textContent || '';
    const afm = card.querySelector('p:nth-of-type(1)')?.textContent.replace('ΑΦΜ: ', '') || '';
    const email = card.querySelector('p:nth-of-type(2)')?.textContent.replace('Email: ', '') || '';
    rows.push([name, afm, email]);
  });

  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Προμηθευτές');
  XLSX.writeFile(wb, 'certitrack_suppliers.xlsx');
});

  const container = document.getElementById('dataSection');
  const isPending = container.getAttribute('data-pending-mode') === 'true';
  const isExporting = container.getAttribute('data-export-mode') === 'true';
  const isDeleting = container.getAttribute('data-delete-mode') === 'true';

  document.getElementById('sendEmailBtn')?.classList.toggle('hidden', !(isPending && Array.from(checkboxes).some(cb => cb.checked)));
  document.getElementById('downloadBtn')?.classList.toggle('hidden', !(isExporting && Array.from(checkboxes).some(cb => cb.checked)));
  document.getElementById('deleteSelectedBtn')?.classList.toggle('hidden', !(isDeleting && Array.from(checkboxes).some(cb => cb.checked)));
;

  // ✅ Η μεταβλητή checkboxes δεν είναι ορατή εδώ — μεταφέρθηκε εντός block ή δηλώθηκε εκτός
// Γι' αυτό, αφαιρούμε αυτό το block γιατί η λογική υπάρχει ήδη νωρίτερα μέσα στον ίδιο listener
;
if (exportBtn && !exportBtn.hasAttribute('data-listener')) {
  exportBtn.setAttribute('data-listener', 'true');
  exportBtn.addEventListener('click', () => {
    const container = document.getElementById('dataSection');
    const isExporting = container.getAttribute('data-export-mode') === 'true';
    toggleHighlight(exportBtn, !isExporting);
    toggleHighlight(document.getElementById('mailBtn'), false);

    if (isExporting) {
      resetExportPendingUI();
      showSuppliers(company);
    } else {
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
        container.setAttribute('data-export-mode', 'true');
        container.removeAttribute('data-pending-mode');
        document.getElementById('certEmailActions')?.classList.remove('hidden');
        document.getElementById('selectAllBtn')?.classList.remove('hidden');
        document.querySelectorAll('.supplier-checkbox').forEach(cb => cb.classList.remove('hidden'));
        document.getElementById('downloadBtn')?.classList.add('hidden');
        showSuppliers(company);
      });
    }
  });
}


function showAddSupplierForm() {
  Swal.fire({
    title: 'Προσθήκη Προμηθευτή',
    html: `
      <style>
        .template-link {
          display: inline-block;
          margin-top: 6px;
          font-size: 0.8rem;
          color: #2563eb;
          text-decoration: underline;
          cursor: pointer;
        }
      </style>
      <p class="text-sm text-left mb-1">Προσθήκη μεμονωμένου προμηθευτή:</p>
      <input id="supplierName" class="swal2-input" placeholder="Επωνυμία">
      <input id="supplierEmail" type="email" class="swal2-input" placeholder="Email">
      <input id="supplierAfm" class="swal2-input" placeholder="ΑΦΜ">
      <hr class="my-2">
      <p class="text-sm text-left mb-1">ή επισύναψε Excel (.xlsx):</p>
      <input id="excelUpload" type="file" accept=".xlsx" class="swal2-file">
      <a class="template-link" href="/templates/prototype_suppliers.xlsx" download>📥 Κατέβασε πρότυπο Excel</a>
      <p class="text-xs text-gray-600 mt-1">Το αρχείο πρέπει να περιέχει τις στήλες: <strong>ΕΠΩΝΥΜΙΑ</strong>, <strong>ΑΦΜ</strong>, <strong>Email</strong>.</p>
    `,
    confirmButtonText: 'Αποθήκευση',
    showCancelButton: true,
    preConfirm: () => {
      const file = document.getElementById('excelUpload').files[0];
      if (file) {
        return { file };
      }
      const name = document.getElementById('supplierName').value.trim();
      const email = document.getElementById('supplierEmail').value.trim();
      const afm = document.getElementById('supplierAfm').value.trim();
      if (!name || !email || !afm) {
        Swal.showValidationMessage('Συμπλήρωσε όλα τα πεδία ή ανέβασε Excel.');
        return false;
      }
      return { name, email, afm };
    }
  }).then(async (result) => {
    if (!result.isConfirmed || !result.value) return;
    try {
      showLoading();
      if (result.value.file) {
        const reader = new FileReader();
        reader.onload = async (e) => {
          try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            const rows = XLSX.utils.sheet_to_json(sheet);
            let count = 0;
            for (const row of rows) {
              const name = row['Επωνυμία'] || row['ΕΠΩΝΥΜΙΑ'] || row.name;
              const email = row['Email'] || row['EMAIL'] || row.email;
              const afm = row['ΑΦΜ'] || row['Αφμ'] || row.afm;
              if (!name || !email || !afm) continue;
              const { data: existing, error: existingErr } = await supabase
                .from('suppliers').select('id').eq('afm', afm).maybeSingle();
              let supplierId = existing?.id;
              if (!supplierId && !existingErr) {
                const { data: newSupplierData, error: insertErr } = await supabase
                  .from('suppliers')
                  .insert([{ name, email, afm, status: '🕓 Μη Εγγεγραμμένος' }])
                  .select();
                if (!insertErr) supplierId = newSupplierData[0].id;
              }
              if (supplierId) {
                const { data: link, error: linkErr } = await supabase
                  .from('company_suppliers')
                  .select('id')
                  .eq('company_id', company.id)
                  .eq('supplier_id', supplierId)
                  .maybeSingle();
                if (!link && !linkErr) {
                  await supabase.from('company_suppliers').insert([{
                    company_id: company.id,
                    supplier_id: supplierId,
                    status: '🕓 Μη Εγγεγραμμένος',
                    timestamp: new Date().toISOString(),
                    company_name: company.name,
                    supplier_name: name
                  }]);
                }
                count++;
              }
            }
            Swal.fire('Ολοκληρώθηκε', `Προστέθηκαν ${count} προμηθευτές.`, 'success');
            await showSuppliers(company);
          } catch (err) {
            handleError(err);
          } finally {
            hideLoading();
          }
        };
        reader.readAsArrayBuffer(result.value.file);
        return;
      } else {
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
        return;
      }

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

