import { isDemo, exitDemo } from '../../demo/demoSession.js';
import { renderCompanySuppliersDemo } from '../../demo/realScreenDemo.js';
import { authService } from '../../services/authService.js';
import { daysUntil, escapeHtml } from '../../core/certificateCore.js';
import { callAuthenticatedFunction } from '../../core/netlifyClient.js';
import { certificateService } from '../../services/certificateService.js';
import { companyService } from '../../services/companyService.js';
import { relationshipService } from '../../services/relationshipService.js';
import { supplierService } from '../../services/supplierService.js';
// companyDashboard.js

import { showLoading, hideLoading, handleError } from '../../shared/common.js';

let company, userId, session;

lucide.createIcons();
dashboardInit();

async function dashboardInit() {
  if (isDemo('company')) {
    renderCompanySuppliersDemo();
    document.getElementById('logoutBtn')?.addEventListener('click', exitDemo);
    return;
  }
  lucide.createIcons();
  try {
    const { data: { session: sess } } = await authService.getSession();
    session = sess;
    if (!session) {
      console.warn("⚠️ No session found on dashboardInit");
      return logout();
    }
    userId = session.user.id;

    const { data: comp, error: compErr } = await companyService.table()
      .select('id, name, afm')
      .eq('email', session.user.email)
      .single();
    if (compErr) return logout();

    company = comp;
    // console.log αφαιρέθηκε γιατί η μεταβλητή δεν είναι ορατή εδώ
await showSuppliers(company);
updateDeleteButtonVisibility();
    await updateRegisteredSuppliers(company.id);
    const nameSpan = document.getElementById('companyName');
    if (nameSpan) nameSpan.textContent = company.name;
    document.getElementById('logoutBtn').onclick = logout;

    const supplierControls = document.getElementById('supplierControls');
    if (supplierControls) supplierControls.classList.remove('hidden');
  } finally {
    document.getElementById('loading')?.classList.add('hidden');
  }
}

async function updateRegisteredSuppliers(companyId) {
  try {
    const { data: links, error: linksErr } = await relationshipService.table()
      .select('id, supplier_id')
      .eq('company_id', companyId);

    if (linksErr) throw linksErr;

    for (const link of links) {
      if (!link.supplier_id) continue;
      const { data: supplier, error: sErr } = await supplierService.table()
        .select('user_id')
        .eq('id', link.supplier_id)
        .maybeSingle();

      if (sErr || !supplier?.user_id) continue;

      await relationshipService.table()
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
  Swal.fire({
    showLoaderOnConfirm: true,
    allowOutsideClick: () => !Swal.isLoading(),
    title: 'Αποσύνδεση',
    text: 'Θέλεις σίγουρα να αποσυνδεθείς;',
    icon: 'question',
    showCancelButton: true,
    confirmButtonText: 'Ναι, αποσύνδεση',
    cancelButtonText: 'Ακύρωση'
  }).then(async (result) => {
    if (result.isConfirmed) {
      await authService.signOut();
      window.location.href = '/pages/auth/login.html';
    }
  });
}

function filterData() {
  const term = document.getElementById('searchInputSuppliers')?.value.toLowerCase() || '';
  renderSuppliers(company, term);
}

async function showSuppliers(company) {
  // Εμφάνιση loader κατά τη φόρτωση της λίστας
  showLoading();

  document.getElementById('certControls')?.classList.add('hidden');
  document.getElementById('loading')?.classList.remove('hidden');
  document.getElementById('supplierControls')?.classList.remove('hidden');

  await renderSuppliers(company);

  // Απόκρυψη loader μετά τη φόρτωση
  hideLoading();
  document.getElementById('loading')?.classList.add('hidden');
}

async function renderSuppliers(company, search = '') {
  const deleteBtn = document.getElementById('deleteSelectedBtn');
  const sort = document.getElementById('sortSelect')?.value || '';
  showLoading();

  const { data: relations, error: relError } = await relationshipService.table()
    .select('company_name, supplier_name, supplier_id, access, suppliers(id, name, afm, email, user_id)')
    .eq('company_id', company.id);
  if (relError) return handleError(relError);

  const userIds = relations.map(r => r.suppliers?.user_id).filter(Boolean);
  let certsBySupplier = {};
  if (userIds.length) {
    const { data: allCerts, error: certErr } = await certificateService.supplier()
      .select('supplier_id, supplier_user_id, date, is_private')
      .in('supplier_user_id', userIds);

    if (!certErr && allCerts) {
      allCerts.forEach(cert => {
        if (cert.is_private) return;
        const sid = cert.supplier_id || cert.supplier_user_id;
        certsBySupplier[sid] = certsBySupplier[sid] || [];
        certsBySupplier[sid].push(cert);
      });
    }
  }

  let list = relations.map(r => {
  const s = r.suppliers || { name: r.supplier_name, afm: '', email: '', user_id: null };
  const certs = certsBySupplier[r.supplier_id] || certsBySupplier[s.user_id] || [];
  const now = new Date();
  const stats = { total: certs.length, active: 0, soon: 0, expired: 0 };
  certs.forEach(cert => {
    const days = daysUntil(cert.date, now);
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
  list = list.filter(r => `${r.name} ${r.afm || ''} ${r.email || ''}`.toLowerCase().includes(searchTerm));
}

  if (sort === 'afm') list.sort((a, b) => a.afm.localeCompare(b.afm));
  else if (sort === 'name') list.sort((a, b) => a.name.localeCompare(b.name));
  else if (sort === 'registered') list.sort((a, b) => (b.status === '✅ Εγγεγραμμένος') - (a.status === '✅ Εγγεγραμμένος'));
  else if (sort === 'pending') list.sort((a, b) => (b.status === '🕓 Εκκρεμή εγγραφή') - (a.status === '🕓 Εκκρεμή εγγραφή'));

  const container = document.getElementById('supplierTableBody');
  container.replaceChildren();

  if (!list.length) {
    container.innerHTML = '<tr><td colspan="7" class="ct-table-empty">Δεν βρέθηκαν προμηθευτές.</td></tr>';
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
    row.innerHTML = r.user_id
      ? `
        <td class="px-4 py-2 text-center align-middle dark:text-white">
          <input type="checkbox" class="supplier-checkbox w-4 h-4" data-id="${r.id}" data-status="${r.status}">
        </td>
        <td class="px-4 py-2 dark:text-white">${r.name}</td>
        <td class="px-4 py-2 dark:text-white">${r.afm}</td>
        <td class="px-4 py-2 dark:text-white">${r.email}</td>
        <td class="px-4 py-2 dark:text-white">${r.user_id ? '<span class="ct-status ct-status--success">Εγγεγραμμένος</span>' : '<span class="ct-status ct-status--warning">Εκκρεμής εγγραφή</span>'}</td>
        <td class="px-4 py-2 dark:text-white">${r.stats.total} (Ενεργά: ${r.stats.active}, Προς λήξη: ${r.stats.soon}, Ληγμένα: ${r.stats.expired})</td>
        <td class="ct-table-actions"><button type="button" class="ct-row-action ct-row-action--danger supplier-remove-btn" data-id="${r.id}" data-name="${escapeHtml(r.name)}" title="Αφαίρεση προμηθευτή" aria-label="Αφαίρεση προμηθευτή"><i data-lucide="trash-2"></i></button></td>`
      : `
        <td class="px-4 py-2 text-center align-middle dark:text-white">
          <input type="checkbox" class="supplier-checkbox w-4 h-4" data-id="${r.id}" data-status="${r.status}">
        </td>
        <td class="px-4 py-2 dark:text-white">${r.name}</td>
        <td class="px-4 py-2 dark:text-white">${r.afm}</td>
        <td class="px-4 py-2 dark:text-white">${r.email}</td>
        <td class="px-4 py-2 dark:text-white">${r.user_id ? '<span class="ct-status ct-status--success">Εγγεγραμμένος</span>' : '<span class="ct-status ct-status--warning">Εκκρεμής εγγραφή</span>'}</td>
        <td class="px-4 py-2">—</td>
        <td class="ct-table-actions"><button type="button" class="ct-row-action ct-row-action--danger supplier-remove-btn" data-id="${r.id}" data-name="${escapeHtml(r.name)}" title="Αφαίρεση προμηθευτή" aria-label="Αφαίρεση προμηθευτή"><i data-lucide="trash-2"></i></button></td>`;

    if (r.access !== 'blocked') {
    row.classList.add('hover:bg-blue-50', 'dark:hover:bg-gray-800');
    row.classList.add('cursor-pointer');
    row.addEventListener('click', (e) => {
      const anyChecked = document.querySelectorAll('.supplier-checkbox:checked').length > 0;
      const isCheckbox = e.target.closest('input[type="checkbox"]');
      if (anyChecked || isCheckbox) return;
      window.location.href = `/pages/company/supplier.html?id=${r.id}`;
    });
  } else {
    row.classList.add('opacity-50');
    row.classList.add('cursor-pointer');
    row.addEventListener('click', () => {
      Swal.fire({
        icon: 'error',
        title: 'Πρόσβαση Απορρίφθηκε',
        text: 'Ο συγκεκριμένος προμηθευτής δεν επιτρέπει την πρόσβασή σας στα αρχεία του.'
      });
    });
    const cells = row.querySelectorAll('td');
    if (cells[1]) cells[1].innerHTML += ' <span class="text-red-500 ml-1">(Blocked)</span>';
  }
    container.appendChild(row);
  }

  container.querySelectorAll('.supplier-remove-btn').forEach(btn => {
    btn.addEventListener('click', async (event) => {
      event.stopPropagation();
      await removeSupplierFromCompany(btn.dataset.id, btn.dataset.name || 'τον προμηθευτή');
    });
  });
  document.getElementById('supplierCount').textContent = list.length;
  window.lucide?.createIcons();
  hideLoading();
}
  

  



window.filterData = filterData;
document.getElementById('sortSelect')?.addEventListener('change', () => renderSuppliers(company));
window.showAddSupplierForm = showAddSupplierForm;

async function removeSupplierFromCompany(supplierId, supplierName) {
  const result = await Swal.fire({
    title: 'Αφαίρεση προμηθευτή',
    html: `Ο <strong>${escapeHtml(supplierName)}</strong> θα αφαιρεθεί από τη λίστα της εταιρείας σας.<br><small>Δεν διαγράφεται ο λογαριασμός του προμηθευτή ή τα δικά του πιστοποιητικά.</small>`,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'Αφαίρεση',
    cancelButtonText: 'Ακύρωση',
    confirmButtonColor: '#dc2626'
  });
  if (!result.isConfirmed) return;
  try {
    showLoading();
    const { error } = await relationshipService.table().delete().eq('company_id', company.id).eq('supplier_id', supplierId);
    if (error) throw error;
    await showSuppliers(company);
    await Swal.fire('Ολοκληρώθηκε', 'Ο προμηθευτής αφαιρέθηκε από τη λίστα σας.', 'success');
  } catch (err) {
    handleError(err);
  } finally {
    hideLoading();
  }
}

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
  const { data, error } = await relationshipService.table()
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
      <td class="px-4 py-2 dark:text-white">${r.user_id ? '<span class="ct-status ct-status--success">Εγγεγραμμένος</span>' : '<span class="ct-status ct-status--warning">Εκκρεμής εγγραφή</span>'}</td>
      <td class="px-4 py-2">—</td>
        <td class="ct-table-actions"><button type="button" class="ct-row-action ct-row-action--danger supplier-remove-btn" data-id="${r.id}" data-name="${escapeHtml(r.name)}" title="Αφαίρεση προμηθευτή" aria-label="Αφαίρεση προμηθευτή"><i data-lucide="trash-2"></i></button></td>`;
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
    // Έλεγχος ΑΦΜ επιβεβαίωσης
if (formValues.username !== company.afm) {
  throw new Error('Μη έγκυρο ΑΦΜ επιβεβαίωσης.');
}
const { data: authData, error: authError } = await authService.signInWithPassword({
  email: session.user.email,
  password: formValues.password
});

    if (authError || authData.user.id !== session.user.id) {
      throw new Error('Μη έγκυρα στοιχεία επιβεβαίωσης.');
    }

    const idsToDelete = Array.from(selectedCheckboxes).map(cb => cb.dataset.id);
    const { error: delErr } = await relationshipService.table()
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
        await callAuthenticatedFunction('send_email', {
          email: p.email,
          type: 'invite',
          subject: '📨 Πρόσκληση Εγγραφής στο CertiTrack',
          companyName: company.name
        });
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



async function connectSupplier({ name, email, afm }) {
  let supplierId;
  const { data: existing, error: existingErr } = await supplierService.table().select('id').eq('afm', afm).maybeSingle();
  if (existingErr) throw existingErr;

  if (existing) supplierId = existing.id;
  else {
    const { data: created, error: insertErr } = await supplierService.table()
      .insert([{ name, email, afm, status: '🕓 Μη Εγγεγραμμένος' }]).select();
    if (insertErr) throw insertErr;
    supplierId = created[0].id;
  }

  const { data: existingLink, error: linkErr } = await relationshipService.table()
    .select('id').eq('company_id', company.id).eq('supplier_id', supplierId).maybeSingle();
  if (linkErr) throw linkErr;
  if (!existingLink) {
    const { error } = await relationshipService.table().insert([{
      company_id: company.id,
      supplier_id: supplierId,
      status: '🕓 Μη Εγγεγραμμένος',
      timestamp: new Date().toISOString(),
      company_name: company.name,
      supplier_name: name
    }]);
    if (error) throw error;
    return 'added';
  }
  return 'existing';
}

function showAddSupplierForm() {
  Swal.fire({
    title: 'Προσθήκη προμηθευτή',
    html: `<div class="ct-swal-form">
      <div class="ct-swal-field"><label>Επωνυμία</label><input id="supplierName" placeholder="Επωνυμία εταιρείας"></div>
      <div class="ct-swal-field"><label>ΑΦΜ</label><input id="supplierAfm" inputmode="numeric" placeholder="ΑΦΜ"></div>
      <div class="ct-swal-field"><label>Email</label><input id="supplierEmail" type="email" placeholder="email@example.gr"></div>
    </div>`,
    confirmButtonText: 'Προσθήκη',
    cancelButtonText: 'Ακύρωση',
    showCancelButton: true,
    focusConfirm: false,
    preConfirm: () => {
      const name = document.getElementById('supplierName').value.trim();
      const email = document.getElementById('supplierEmail').value.trim();
      const afm = document.getElementById('supplierAfm').value.trim();
      if (!name || !email || !afm) {
        Swal.showValidationMessage('Συμπλήρωσε επωνυμία, ΑΦΜ και email.');
        return false;
      }
      return { name, email, afm };
    }
  }).then(async result => {
    if (!result.isConfirmed || !result.value) return;
    try {
      showLoading();
      const status = await connectSupplier(result.value);
      await showSuppliers(company);
      await Swal.fire('Ολοκληρώθηκε', status === 'added' ? 'Ο προμηθευτής προστέθηκε στη λίστα σας.' : 'Ο προμηθευτής υπάρχει ήδη στη λίστα σας.', 'success');
    } catch (err) { handleError(err); }
    finally { hideLoading(); }
  });
}

function showBulkSupplierImport() {
  Swal.fire({
    title: 'Μαζική εισαγωγή προμηθευτών',
    width: 640,
    html: `<div class="ct-swal-form">
      <div class="ct-import-dropzone">
        <i data-lucide="file-spreadsheet"></i>
        <strong>Επίλεξε αρχείο Excel</strong>
        <span>Υποστηρίζεται .xlsx με στήλες ΕΠΩΝΥΜΙΑ, ΑΦΜ και Email.</span>
        <input id="excelUpload" type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet">
      </div>
      <a class="ct-btn ct-btn-secondary ct-btn-sm ct-template-download" href="/assets/templates/prototype_suppliers.xlsx" download><i data-lucide="file-down"></i> Λήψη προτύπου Excel</a>
      <div id="importPreview" class="ct-import-preview">Δεν έχει επιλεγεί αρχείο.</div>
    </div>`,
    confirmButtonText: 'Εισαγωγή',
    cancelButtonText: 'Ακύρωση',
    showCancelButton: true,
    didOpen: () => {
      window.lucide?.createIcons();
      const input = document.getElementById('excelUpload');
      input.addEventListener('change', () => {
        const file = input.files?.[0];
        document.getElementById('importPreview').textContent = file ? `Επιλέχθηκε: ${file.name}` : 'Δεν έχει επιλεγεί αρχείο.';
      });
    },
    preConfirm: () => {
      const file = document.getElementById('excelUpload').files?.[0];
      if (!file) { Swal.showValidationMessage('Επίλεξε αρχείο Excel.'); return false; }
      return file;
    }
  }).then(async result => {
    if (!result.isConfirmed || !result.value) return;
    try {
      showLoading();
      const buffer = await result.value.arrayBuffer();
      const workbook = XLSX.read(new Uint8Array(buffer), { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
      let added = 0, existing = 0, skipped = 0;
      const errors = [];
      for (const [index, row] of rows.entries()) {
        const name = String(row['Επωνυμία'] || row['ΕΠΩΝΥΜΙΑ'] || row.name || '').trim();
        const email = String(row['Email'] || row['EMAIL'] || row.email || '').trim();
        const afm = String(row['ΑΦΜ'] || row['Αφμ'] || row.afm || '').trim();
        if (!name || !email || !afm) { skipped++; continue; }
        try {
          const status = await connectSupplier({ name, email, afm });
          if (status === 'added') added++; else existing++;
        } catch (err) { errors.push(`Γραμμή ${index + 2}: ${name || afm} — ${err.message || 'σφάλμα'}`); }
      }
      await showSuppliers(company);
      const message = `<div class="ct-import-result"><strong>${added}</strong> νέοι · <strong>${existing}</strong> ήδη συνδεδεμένοι · <strong>${skipped}</strong> παραλείφθηκαν${errors.length ? `<br><small>${errors.slice(0,5).map(escapeHtml).join('<br>')}</small>` : ''}</div>`;
      await Swal.fire({ icon: errors.length ? 'warning' : 'success', title: 'Η εισαγωγή ολοκληρώθηκε', html: message });
    } catch (err) { handleError(err); }
    finally { hideLoading(); }
  });
}

window.filterData = filterData;
window.showAddSupplierForm = showAddSupplierForm;
document.getElementById('searchInputSuppliers')?.addEventListener('input', filterData);
document.getElementById('addSupplierBtn')?.addEventListener('click', showAddSupplierForm);
document.getElementById('bulkImportSuppliersBtn')?.addEventListener('click', showBulkSupplierImport);

