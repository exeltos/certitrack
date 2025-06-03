// companyDashboard.js

import { supabase } from './supabaseClient.js';
import { showLoading, hideLoading, handleError } from './common.js';

let company, userId, session;

lucide.createIcons();
dashboardInit();

async function dashboardInit() {
  console.log('🏁 ΕΝΑΡΞΗ dashboardInit');
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
    console.log('🏢 Εταιρεία:', company);
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
  
  document.getElementById('loading')?.classList.add('hidden');
}

async function renderSuppliers(company, search = '') {
  const deleteBtn = document.getElementById('deleteSelectedBtn');
  const sort = document.getElementById('sortSelect')?.value || '';
  showLoading();

  const { data: relations, error: relError } = await supabase
    .from('company_suppliers')
    .select('company_name, supplier_name, supplier_id, access, suppliers(id, name, afm, email, user_id)')
    .eq('company_id', company.id);
  console.log('📋 Suppliers fetched:', relations);
  if (relError) return handleError(relError);

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
});

const searchTerm = search.trim().toLowerCase();
if (searchTerm) {
  list = list.filter(r => r.name.toLowerCase().includes(searchTerm));
}

  if (sort === 'afm') list.sort((a, b) => a.afm.localeCompare(b.afm));
  else if (sort === 'name') list.sort((a, b) => a.name.localeCompare(b.name));
  else if (sort === 'registered') list.sort((a, b) => (b.status === '✅ Εγγεγραμμένος') - (a.status === '✅ Εγγεγραμμένος'));
  else if (sort === 'pending') list.sort((a, b) => (b.status === '🕓 Εκκρεμή εγγραφή') - (a.status === '🕓 Εκκρεμή εγγραφή'));

  const container = document.getElementById('supplierTableBody');
  container.innerHTML = '';

  if (!list.length) {
    container.innerHTML = '<tr><td colspan="6" class="text-center py-4">Δεν βρέθηκαν προμηθευτές.</td></tr>';
    hideLoading();
  // Εμφάνιση κουμπιού διαγραφής αν υπάρχουν επιλεγμένα checkbox
  const checkboxes = document.querySelectorAll('.supplier-checkbox');
  updateDeleteButtonVisibility();
  checkboxes.forEach(cb => cb.addEventListener('change', () => {
    updateDeleteButtonVisibility();
  }));
    return;
  }

  for (const r of list) {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td class="px-4 py-2 text-center align-middle dark:text-white">
        <input type="checkbox" class="supplier-checkbox w-4 h-4" data-id="${r.id}" data-status="${r.status}">
      </td>
      <td class="px-4 py-2 dark:text-white">${r.name}</td>
      <td class="px-4 py-2 dark:text-white">${r.afm}</td>
      <td class="px-4 py-2 dark:text-white">${r.email}</td>
      <td class="px-4 py-2 dark:text-white">${r.status}</td>
      <td class="px-4 py-2 dark:text-white">${r.stats.total} (Ενεργά: ${r.stats.active}, Προς λήξη: ${r.stats.soon}, Ληγμένα: ${r.stats.expired})</td>
    `;
    container.appendChild(row);
  }

  document.getElementById('supplierCount').textContent = list.length;
  hideLoading();
}
  

  



window.filterData = filterData;
document.getElementById('sortSelect')?.addEventListener('change', () => renderSuppliers(company));
window.showAddSupplierForm = showAddSupplierForm;

// Εμφάνιση/Απόκρυψη κουμπιών ανάλογα με επιλεγμένα checkbox
function updateDeleteButtonVisibility() {
  const selected = document.querySelectorAll('.supplier-checkbox:checked');
  const sendBtn = document.getElementById('sendInviteBtn');
  const deleteBtn = document.getElementById('deleteSelectedBtn');
  const downloadBtn = document.getElementById('downloadSelectedBtn');

  const anyPending = Array.from(selected).some(cb => cb.dataset.status?.includes('Εκκρεμή'));

  deleteBtn?.classList.toggle('hidden', selected.length === 0);
  sendBtn?.classList.toggle('hidden', !(anyPending && selected.length > 0));
  downloadBtn?.classList.toggle('hidden', selected.length === 0);
}

document.addEventListener('change', (e) => {
  if (e.target.classList.contains('supplier-checkbox') || e.target.id === 'selectAllSuppliers') {
    updateDeleteButtonVisibility();
  }
});

document.getElementById('selectAllSuppliers')?.addEventListener('change', (e) => {
  const checked = e.target.checked;
  document.querySelectorAll('.supplier-checkbox').forEach(cb => {
    cb.checked = checked;
    cb.dispatchEvent(new Event('change'));
  });

  // Αν έγινε μαζική επιλογή, να φαίνεται μόνο το κουμπί διαγραφής
  const deleteBtn = document.getElementById('deleteSelectedBtn');
  const sendBtn = document.getElementById('sendInviteBtn');
  const selected = document.querySelectorAll('.supplier-checkbox:checked');
  const anyPending = Array.from(selected).some(cb => cb.dataset.status?.includes('Εκκρεμή'));

  deleteBtn?.classList.toggle('hidden', selected.length === 0);
  sendBtn?.classList.add('hidden');
});
;

// 📧 Mail button: εμφάνιση μόνο εκκρεμών & εμφάνιση κουμπιού πρόσκλησης
const mailBtn = document.getElementById('mailBtn');
mailBtn?.addEventListener('click', async () => {
  await showPendingSuppliersOnly();
  document.getElementById('sendInviteBtn')?.classList.remove('hidden');
});
;



async function showPendingSuppliersOnly() {
  showLoading();
  const { data, error } = await supabase
    .from('company_suppliers')
    .select('company_name, supplier_name, supplier_id, suppliers (id, name, afm, email, user_id)')
    .eq('company_id', company.id);

  if (error) return handleError(error);

  const container = document.getElementById('supplierTableBody');
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

  if (!filtered.length) {
    container.innerHTML = '<tr><td colspan="6" class="text-center py-4">Δεν υπάρχουν εκκρεμείς προμηθευτές.</td></tr>';
    hideLoading();
    return;
  }

  for (const r of filtered) {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td class="px-4 py-2 text-center">
        <input type="checkbox" class="supplier-checkbox w-4 h-4" data-id="${r.id}" data-status="${r.status}">
      </td>
      <td class="px-4 py-2">${r.name}</td>
      <td class="px-4 py-2">${r.afm}</td>
      <td class="px-4 py-2 dark:text-white">${r.email}</td>
      <td class="px-4 py-2 dark:text-white">${r.status}</td>
      <td class="px-4 py-2">—</td>`;
    container.appendChild(row);
  }

  document.getElementById('supplierCount').textContent = filtered.length;
  hideLoading();
}

// Ενέργειες για το κουμπί Εξαγωγή
// ✅ Καθαρισμός λογικής mailBtn & exportBtn χωρίς επικαλύψεις



// ✅ Εξαγωγή Excel από επιλεγμένους

document.getElementById('downloadSelectedBtn')?.addEventListener('click', () => {
  const selected = document.querySelectorAll('.supplier-checkbox:checked');
  if (!selected.length) return;

  const rows = Array.from(selected).map(cb => {
    const row = cb.closest('tr');
    const cells = row.querySelectorAll('td');
    return {
      Επωνυμία: cells[1].innerText.trim(),
      ΑΦΜ: cells[2].innerText.trim(),
      Email: cells[3].innerText.trim(),
      Κατάσταση: cells[4].innerText.trim(),
      Πιστοποιητικά: cells[5].innerText.trim(),
    };
  });

  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Προμηθευτές');

  const now = new Date().toISOString().split('T')[0];
  XLSX.writeFile(workbook, `suppliers_export_${now}.xlsx`);
});

// ✅ Διαγραφή επιλεγμένων προμηθευτών

document.getElementById('deleteSelectedBtn')?.addEventListener('click', async () => {
  const selectedCheckboxes = document.querySelectorAll('.supplier-checkbox:checked');
  if (selectedCheckboxes.length === 0) return;

  const { value: formValues } = await Swal.fire({
    title: 'Επιβεβαίωση Διαγραφής',
    html:
      '<input id="swal-username" class="swal2-input" placeholder="ΑΦΜ">' +
      '<input id="swal-password" type="password" class="swal2-input" placeholder="Κωδικός">',
    focusConfirm: false,
    preConfirm: () => {
      const username = document.getElementById('swal-username').value.trim();
      const password = document.getElementById('swal-password').value.trim();
      if (!username || !password) {
        Swal.showValidationMessage('Συμπλήρωσε και τα δύο πεδία.');
        return false;
      }
      return { username, password };
    },
    showCancelButton: true,
    confirmButtonText: 'Επιβεβαίωση',
    cancelButtonText: 'Άκυρο'
  });

  if (!formValues) return;

  try {
    showLoading();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: `${company.afm}@confirm.local`,
      password: formValues.password
    });

    if (error || data.user.id !== session.user.id) {
      throw new Error('Μη έγκυρα στοιχεία επιβεβαίωσης.');
    }

    const idsToDelete = Array.from(selectedCheckboxes).map(cb => cb.dataset.id);
    const { error: delErr } = await supabase
      .from('company_suppliers')
      .delete()
      .in('supplier_id', idsToDelete)
      .eq('company_id', company.id);

    if (delErr) throw delErr;

    Swal.fire('Ολοκληρώθηκε', 'Οι προμηθευτές αφαιρέθηκαν από τη λίστα σας.', 'success');
    await showSuppliers(company);
  } catch (err) {
    handleError(err);
  } finally {
    hideLoading();
  }
});

// ✅ Αποστολή προσκλήσεων εγγραφής σε επιλεγμένους

document.getElementById('sendInviteBtn')?.addEventListener('click', async () => {
  const selected = document.querySelectorAll('.supplier-checkbox:checked');
  if (!selected.length) return;

  const pending = [], registered = [];

  selected.forEach(cb => {
    const row = cb.closest('tr');
    const status = cb.dataset.status || '';
    const name = row?.querySelectorAll('td')[1]?.innerText || '—';
    const email = row?.querySelectorAll('td')[3]?.innerText || '—';
    if (status.includes('Εγγεγραμμένος')) {
      registered.push(`${name} (${email})`);
    } else {
      pending.push({ id: cb.dataset.id, name, email });
    }
  });

  if (registered.length) {
    const result = await Swal.fire({
      icon: 'warning',
      title: 'Προσοχή',
      html: `Έχεις επιλέξει ${registered.length} ήδη εγγεγραμμένο(ους):<br><ul style="text-align:left;margin-top:6px">` +
        registered.map(r => `<li>• ${r}</li>`).join('') +
        '</ul><br>Μόνο οι εκκρεμείς θα λάβουν πρόσκληση.',
      showCancelButton: true,
      confirmButtonText: 'Συνέχεια',
      cancelButtonText: 'Ακύρωση'
    });
    if (!result.isConfirmed) return;
  }

  if (!pending.length) {
    await Swal.fire('Δεν υπάρχουν εκκρεμείς', 'Δεν επιλέχθηκαν προμηθευτές με εκκρεμή εγγραφή.', 'info');
    return;
  }

  showLoading();
  try {
    const failed = [];
    for (const p of pending) {
      try {
        const res = await fetch('/.netlify/functions/send_email-express', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: p.email, type: 'invite', subject: '📨 Πρόσκληση Εγγραφής στο CertiTrack' })
        });
        if (!res.ok) {
          const errText = await res.text();
          console.warn(`⚠️ Σφάλμα για ${p.email}: ${errText}`);
          failed.push(`${p.name} (${p.email})`);
        }
      } catch (err) {
        console.error(`❌ Αποτυχία αποστολής για ${p.email}`, err);
        failed.push(`${p.name} (${p.email})`);
      }
    }

    if (failed.length) {
      await Swal.fire({
        icon: 'warning',
        title: 'Ολοκληρώθηκε μερικώς',
        html: `Απεστάλησαν ${pending.length - failed.length} προσκλήσεις.<br><br>Απέτυχαν:<ul style="text-align:left">` +
          failed.map(e => `<li>• ${e}</li>`).join('') + '</ul>',
        confirmButtonText: 'OK'
      });
    } else {
      await Swal.fire({
      icon: 'success',
      title: '✅ Εστάλησαν',
      text: `Απεστάλησαν ${pending.length} προσκλήσεις.`,
      confirmButtonText: 'OK'
    });
  }
  } catch (err) {
    handleError(err);
  } finally {
    hideLoading();
  }
});

// ✅ Η μεταβλητή checkboxes δεν είναι ορατή εδώ — μεταφέρθηκε εντός block ή δηλώθηκε εκτός
// Γι' αυτό, αφαιρούμε αυτό το block γιατί η λογική υπάρχει ήδη νωρίτερα μέσα στον ίδιο listener
;

    
  ;



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
          const { data: newSupplierData, error: insertErr } = await supabase
            .from('suppliers')
            .insert([{ name, email, afm, status: '🕓 Μη Εγγεγραμμένος' }])
            .select();

          if (insertErr) throw insertErr;
          supplierId = newSupplierData[0].id;
        }

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
      }
    } catch (err) {
      handleError(err);
    } finally {
    hideLoading();
  }
});
}

