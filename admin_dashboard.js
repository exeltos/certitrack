import { supabase } from '../js/supabaseClient.js';

// Έλεγχος πρόσβασης διαχειριστή.
// Προτιμά server-controlled app_metadata role και διατηρεί προσωρινά συμβατότητα
// με το υπάρχον legacy admin account μέχρι τη μετάβαση στο νέο role model.
supabase.auth.getUser().then(({ data: { user }, error }) => {
  if (error || !user) {
    window.location.href = '/general_login.html';
    return;
  }

  const appRole = user.app_metadata?.app_role || user.app_metadata?.role;
  const isAdmin = appRole === 'admin' || user.email === 'admin@certitrack.gr';
  if (!isAdmin) {
    alert('Δεν έχετε δικαίωμα πρόσβασης σε αυτή τη σελίδα.');
    window.location.href = '/no-access.html';
  }
});

let allUsersCache = [];

// 📊 Προσθήκη στατιστικών μετρητών πάνω από τον πίνακα
function updateUserStats() {
  const counts = {
    registered: 0,
    pending: 0,
    active: 0,
    inactive: 0,
    blocked: 0,
  };

  for (const user of allUsersCache) {
    const status = user.status === '✅ Εγγεγραμμένος' ? 'registered' : 'pending';
    counts[status]++;
    if (user.timestamp) {
      const signup = new Date(user.timestamp);
      const grace = new Date(signup);
      grace.setDate(grace.getDate() + 7);
      const expiry = new Date(grace);
      expiry.setFullYear(expiry.getFullYear() + 1);
      const now = new Date();
      if (now < expiry && !user.blocked) counts.active++;
      else if (!user.blocked) counts.inactive++;
    } else {
      counts.inactive++;
    }
    if (user.blocked) counts.blocked++;
  }

  const statsContainer = document.getElementById('userStats');
  if (!statsContainer) return;
  statsContainer.innerHTML = `
    <div class="flex flex-wrap gap-2 text-sm justify-center">
      <button data-filter="showAllBtn" class="bg-indigo-100 text-indigo-800 px-3 py-1 rounded hover:bg-indigo-200">👥 Όλοι: ${allUsersCache.length}</button>
      <button data-filter="registered" class="bg-green-100 text-green-800 px-3 py-1 rounded hover:bg-green-200">✅ Εγγεγραμμένοι: ${counts.registered}</button>
      <button data-filter="pending" class="bg-yellow-100 text-yellow-800 px-3 py-1 rounded hover:bg-yellow-200">🕓 Εκκρεμείς: ${counts.pending}</button>
      <button data-filter="active" class="bg-blue-100 text-blue-800 px-3 py-1 rounded hover:bg-blue-200">🟢 Ενεργοί: ${counts.active}</button>
      <button data-filter="inactive" class="bg-gray-100 text-gray-800 px-3 py-1 rounded hover:bg-gray-200">⚪ Ανενεργοί: ${counts.inactive}</button>
      <button data-filter="blocked" class="bg-red-100 text-red-800 px-3 py-1 rounded hover:bg-red-200">🚫 Μπλοκαρισμένοι: ${counts.blocked}</button>
    </div>`;

  statsContainer.querySelectorAll('button[data-filter]')?.forEach(btn => {
    btn.addEventListener('click', () => {
      statsContainer.querySelectorAll('button[data-filter]')?.forEach(b => b.classList.remove('filter-active'));
      btn.classList.add('filter-active');
      const key = btn.dataset.filter;
      const result = (() => {
        switch (key) {
          case 'showAllBtn': return allUsersCache;
          case 'registered': return allUsersCache.filter(u => u.status === '✅ Εγγεγραμμένος');
          case 'pending': return allUsersCache.filter(u => u.status !== '✅ Εγγεγραμμένος');
          case 'active': return allUsersCache.filter(u => {
            const signup = u.timestamp ? new Date(u.timestamp) : null;
            if (!signup) return false;
            const grace = new Date(signup);
            grace.setDate(grace.getDate() + 7);
            const expiry = new Date(grace);
            expiry.setFullYear(expiry.getFullYear() + 1);
            return new Date() < expiry;
          });
          case 'inactive': return allUsersCache.filter(u => {
            const signup = u.timestamp ? new Date(u.timestamp) : null;
            if (!signup) return true;
            const grace = new Date(signup);
            grace.setDate(grace.getDate() + 7);
            const expiry = new Date(grace);
            expiry.setFullYear(expiry.getFullYear() + 1);
            return new Date() >= expiry;
          });
          case 'blocked': return allUsersCache.filter(u => u.blocked);
          default: return allUsersCache;
        }
      })();
      renderUsers(result);
    });
  });
}

// 📦 Load all users from companies and suppliers
export async function loadAllUsers() {
  const tableBody = document.getElementById('userTableBody');
  tableBody.innerHTML = '';

  const [companiesRes, suppliersRes] = await Promise.all([
    supabase.from('companies').select('*'),
    supabase.from('suppliers').select('*')
  ]);

  if (companiesRes.error || suppliersRes.error) {
    console.error('❌ Σφάλμα Supabase:', companiesRes.error || suppliersRes.error);
    return;
  }

  const companies = companiesRes.data || [];
  const suppliers = suppliersRes.data || [];

  allUsersCache = [...companies.map(u => ({ ...u, role: 'Εταιρεία', status: '✅ Εγγεγραμμένος' })),
                   ...suppliers.map(u => ({ ...u, role: 'Προμηθευτής' }))];

  renderUsers(allUsersCache);
  updateUserStats();
  const statsContainer = document.getElementById('userStats');
  const defaultBtn = statsContainer?.querySelector('button[data-filter="showAllBtn"]');
  defaultBtn?.classList.add('filter-active');
}

function renderUsers(users) {
  const tableBody = document.getElementById('userTableBody');
  tableBody.innerHTML = '';

  for (const user of users) {
    const checkbox = `<td><input type="checkbox" class="admin-checkbox w-4 h-4" data-afm="${user.afm}" data-role="${user.role}"></td>`;
    const name = user.name || '-';
    const afm = user.afm || '-';
    const email = user.email || '-';
        const role = user.role;
    const status = user.status === '✅ Εγγεγραμμένος' ? 'Εγγεγραμμένος' : 'Εκκρεμής';

    const signupDate = user.timestamp ? new Date(user.timestamp) : null;
    const displayDate = signupDate ? signupDate.toLocaleDateString('el-GR') : '-';

    let renewalDate = '-';
    let expiryDate = '-';

    if (signupDate) {
      const grace = new Date(signupDate);
      grace.setDate(grace.getDate() + 7);

      const expiry = new Date(grace);
      expiry.setFullYear(expiry.getFullYear() + 1);

      renewalDate = grace.toLocaleDateString('el-GR');
      expiryDate = expiry.toLocaleDateString('el-GR');
    }

    const now = new Date();
    const isActive = user.blocked ? 'Μπλοκαρισμένος' : (signupDate && now < new Date(new Date(signupDate).setDate(signupDate.getDate() + 7 + 365)) ? 'Ναι' : 'Όχι');

    const row = document.createElement('tr');
    row.classList.add('transition', 'duration-200', 'hover:bg-blue-50', 'dark:hover:bg-blue-900');
    if (user.blocked) row.classList.add('bg-red-50', 'dark:bg-red-900');
    row.innerHTML = `
    <td class="px-4 py-2 text-center"><input type="checkbox" class="admin-checkbox w-4 h-4" data-afm="${afm}" data-role="${role}"></td>
    <td class="px-4 py-2 whitespace-nowrap text-gray-900 dark:text-white">${name}</td>
    <td class="px-4 py-2 whitespace-nowrap text-gray-900 dark:text-white">${email}</td>
    <td class="px-4 py-2 whitespace-nowrap text-gray-900 dark:text-white">${afm}</td>
    <td class="px-4 py-2 whitespace-nowrap text-gray-900 dark:text-white">${role}</td>
    <td class="px-4 py-2 whitespace-nowrap text-gray-900 dark:text-white">${status}</td>
    <td class="px-4 py-2 whitespace-nowrap text-gray-900 dark:text-white">${displayDate}</td>
    <td class="px-4 py-2 whitespace-nowrap text-gray-900 dark:text-white">${renewalDate}</td>
    <td class="px-4 py-2 whitespace-nowrap text-gray-900 dark:text-white">${expiryDate}</td>
    <td class="px-4 py-2 whitespace-nowrap text-gray-900 dark:text-white">${isActive}</td>
    <td></td>
  `;

    tableBody.appendChild(row);
  }
}

// 🔍 Αναζήτηση
const searchInput = document.getElementById('searchInput');
searchInput?.addEventListener('input', () => {
  const query = searchInput.value.toLowerCase();
  const filtered = allUsersCache.filter(u =>
    (u.name || '').toLowerCase().includes(query) ||
    (u.afm || '').toLowerCase().includes(query) ||
    (u.role || '').toLowerCase().includes(query)
  );
  renderUsers(filtered);
});

// ⬇️ Ταξινόμηση
const sortSelect = document.getElementById('sortSelect');
sortSelect?.addEventListener('change', () => {
  const key = sortSelect.value;
  const sorted = [...allUsersCache];

  switch (key) {
    case 'name':
      sorted.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      break;
    case 'afm':
      sorted.sort((a, b) => (a.afm || '').localeCompare(b.afm || ''));
      break;
    case 'active':
      sorted.sort((a, b) => b.isActive - a.isActive);
      break;
    case 'blocked':
      sorted.sort((a, b) => (a.blocked ? 1 : 0) - (b.blocked ? 1 : 0));
      break;
    case 'timestamp':
      sorted.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      break;
    case 'registered':
      sorted.sort((a, b) => (b.status === '✅ Εγγεγραμμένος') - (a.status === '✅ Εγγεγραμμένος'));
      break;
    case 'pending':
      sorted.sort((a, b) => (b.status !== '✅ Εγγεγραμμένος') - (a.status !== '✅ Εγγεγραμμένος'));
      break;
    case 'type_company':
      sorted.sort((a, b) => (a.role === 'Εταιρεία' ? -1 : 1));
      break;
    case 'type_supplier':
      sorted.sort((a, b) => (a.role === 'Προμηθευτής' ? -1 : 1));
      break;
  }

  renderUsers(sorted);
});

// 🔁 Αποσύνδεση με επιβεβαίωση
const logoutBtn = document.getElementById('logoutBtn');
logoutBtn?.addEventListener('click', async () => {
  const result = await Swal.fire({
    title: 'Αποσύνδεση',
    text: 'Είστε σίγουροι ότι θέλετε να αποσυνδεθείτε;',
    icon: 'question',
    showCancelButton: true,
    confirmButtonText: 'Ναι',
    cancelButtonText: 'Όχι'
  });
  if (result.isConfirmed) {
    await supabase.auth.signOut();
    window.location.href = 'index.html';
  }
});

// ♻️ Επαναφορά πρόσβασης χρήστη με επιβεβαίωση

document.addEventListener('click', async (e) => {
  if (e.target.closest('.unblock-user-btn')) {
    const btn = e.target.closest('.unblock-user-btn');
    const afm = btn.dataset.afm;
    const role = btn.dataset.role;
    const table = role === 'Εταιρεία' ? 'companies' : 'suppliers';

    const result = await Swal.fire({
      title: 'Επαναφορά Πρόσβασης',
      text: `Να επανενεργοποιηθεί η πρόσβαση του χρήστη με ΑΦΜ ${afm};`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Ναι, επαναφορά',
      cancelButtonText: 'Άκυρο'
    });

    if (!result.isConfirmed) return;

    const { error } = await supabase.from(table).update({ blocked: false }).eq('afm', afm);

    if (error) {
      Swal.fire('Σφάλμα', 'Η επαναφορά απέτυχε.', 'error');
      return;
    }

    Swal.fire('Επιτυχία', 'Η πρόσβαση του χρήστη επανήλθε.', 'success');
    loadAllUsers();
  }
});

// 🚫 Μπλοκάρισμα χρήστη με επιβεβαίωση

document.addEventListener('click', async (e) => {
  if (e.target.closest('.block-user-btn')) {
    const btn = e.target.closest('.block-user-btn');
    const afm = btn.dataset.afm;
    const role = btn.dataset.role;
    const table = role === 'Εταιρεία' ? 'companies' : 'suppliers';

    const result = await Swal.fire({
      title: 'Μπλοκάρισμα Χρήστη',
      text: `Να απενεργοποιηθεί η πρόσβαση του χρήστη με ΑΦΜ ${afm};`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Ναι, μπλοκάρισμα',
      cancelButtonText: 'Άκυρο'
    });

    if (!result.isConfirmed) return;

    const { error } = await supabase.from(table).update({ blocked: true }).eq('afm', afm);

    if (error) {
      Swal.fire('Σφάλμα', 'Το μπλοκάρισμα απέτυχε.', 'error');
      return;
    }

    Swal.fire('Μπλοκαρίστηκε', 'Ο χρήστης δεν έχει πλέον πρόσβαση.', 'success');
    loadAllUsers();
  }
});

// 🗑️ Διαγραφή χρήστη με επιβεβαίωση

document.addEventListener('click', async (e) => {
  if (e.target.closest('.delete-user-btn')) {
    const btn = e.target.closest('.delete-user-btn');
    const afm = btn.dataset.afm;
    const role = btn.dataset.role;

    const result = await Swal.fire({
      title: 'Διαγραφή Χρήστη',
      text: `Θέλεις σίγουρα να διαγράψεις τον χρήστη με ΑΦΜ ${afm};`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Ναι, διαγραφή',
      cancelButtonText: 'Άκυρο'
    });

    if (!result.isConfirmed) return;

    const table = role === 'Εταιρεία' ? 'companies' : 'suppliers';
    try {
      // Cascade delete related records
      if (role === 'Προμηθευτής') {
        const { data: supRec, error: supErr } = await supabase
          .from('suppliers')
          .select('id, user_id')
          .eq('afm', afm)
          .single();
        if (!supErr && supRec) {
          await supabase.from('company_suppliers').delete().eq('supplier_id', supRec.id);
          await supabase.from('supplier_certificates').delete().eq('supplier_user_id', supRec.user_id);
          await supabase.from('supplier_notifications').delete().eq('supplier_id', supRec.id);
        }
      } else {
        const { data: compRec, error: compErr } = await supabase
          .from('companies')
          .select('id')
          .eq('afm', afm)
          .single();
        if (!compErr && compRec) {
          await supabase.from('company_suppliers').delete().eq('company_id', compRec.id);
          await supabase.from('company_certificates').delete().eq('company_id', compRec.id);
          await supabase.from('company_notifications').delete().eq('company_id', compRec.id);
        }
      }
      // Main delete
      const { error: mainErr } = await supabase
        .from(table)
        .delete()
        .eq('afm', afm);
      if (mainErr) throw mainErr;
      Swal.fire('Διαγράφηκε', 'Ο χρήστης διαγράφηκε από παντού.', 'success');
      loadAllUsers();
    } catch (err) {
      Swal.fire('Σφάλμα', 'Η διαγραφή απέτυχε.', 'error');
    }
  }
});

// ⚙️ Εμφάνιση και απόκρυψη popup αλλαγής κωδικού
const userSettingsBtn = document.getElementById('userSettingsBtn');
const passwordSettingsPanel = document.getElementById('passwordSettingsPanel');
const closePasswordPanel = document.getElementById('closePasswordPanel');

userSettingsBtn?.addEventListener('click', () => {
  if (passwordSettingsPanel?.classList.contains('hidden')) {
    passwordSettingsPanel.classList.remove('hidden');
  } else {
    passwordSettingsPanel.classList.add('hidden');
  }
});

closePasswordPanel?.addEventListener('click', () => {
  passwordSettingsPanel?.classList.add('hidden');
});
;

// 👁️ Εναλλαγή εμφάνισης/απόκρυψης κωδικών
const toggleButtons = document.querySelectorAll('.toggle-password');
toggleButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    const targetId = btn.dataset.target;
    const input = document.getElementById(targetId);
    if (input) {
      input.type = input.type === 'password' ? 'text' : 'password';
    }
  });
});

// 🔒 Αλλαγή κωδικού με έλεγχο
const submitPasswordChange = document.getElementById('submitPasswordChange');
submitPasswordChange?.addEventListener('click', async () => {
  const currentInput = document.getElementById('currentPassword');
  const current = currentInput?.value?.trim();
  const pwd = document.getElementById('newPassword')?.value;
  const confirm = document.getElementById('confirmPassword')?.value;

  if (!current || current.length < 1) {
    currentInput?.focus();
    Swal.fire('Σφάλμα', 'Συμπλήρωσε τον τρέχοντα κωδικό.', 'warning');
    return;
  }
  if (!pwd || pwd.length < 6) {
    Swal.fire('Σφάλμα', 'Ο νέος κωδικός πρέπει να έχει τουλάχιστον 6 χαρακτήρες.', 'warning');
    return;
  }
  if (pwd !== confirm) {
    Swal.fire('Σφάλμα', 'Οι νέοι κωδικοί δεν ταιριάζουν.', 'warning');
    return;
  }

  const { data: userData, error: userError } = await supabase.auth.getUser();
  const signedInEmail = userData?.user?.email;
  if (userError || !signedInEmail) {
    Swal.fire('Σφάλμα', 'Δεν βρέθηκε ενεργή σύνδεση.', 'error');
    return;
  }

  const { data: sessionData, error: signInError } = await supabase.auth.signInWithPassword({ email: signedInEmail, password: current });
if (signInError || !sessionData || !sessionData.user) {
    Swal.fire('Σφάλμα', 'Ο τρέχων κωδικός δεν είναι σωστός.', 'error');
    return;
  }

  const { error: updateError } = await supabase.auth.updateUser({ password: pwd });
  if (updateError) {
    Swal.fire('Σφάλμα', 'Η αλλαγή κωδικού απέτυχε.', 'error');
  } else {
    Swal.fire('Επιτυχία', 'Ο κωδικός άλλαξε με επιτυχία.', 'success');
    passwordSettingsPanel?.classList.add('hidden');
  }
});



// ✅ Ανανέωση εγγραφής με καθορισμένη ημερομηνία

document.getElementById('renewSelectedBtn')?.addEventListener('click', async () => {
  const selected = [...document.querySelectorAll('.admin-checkbox:checked')];
  if (!selected.length) {
    Swal.fire('Καμία Επιλογή', 'Επίλεξε πρώτα χρήστες με checkbox.', 'info');
    return;
  }

  const { value: inputDate } = await Swal.fire({
    title: 'Ημερομηνία Εγγραφής',
    html: '<input type="date" id="renewDate" class="swal2-input">',
    focusConfirm: false,
    preConfirm: () => {
      const date = document.getElementById('renewDate').value;
      if (!date) {
        Swal.showValidationMessage('Συμπλήρωσε ημερομηνία.');
        return false;
      }
      return date;
    },
    showCancelButton: true,
    confirmButtonText: 'Ενημέρωση',
    cancelButtonText: 'Άκυρο'
  });

  if (!inputDate) return;

  const isoDate = new Date(inputDate).toISOString();

  for (const cb of selected) {
    const afm = cb.dataset.afm;
    const role = cb.dataset.role;
    const table = role === 'Εταιρεία' ? 'companies' : 'suppliers';
    await supabase.from(table).update({ timestamp: isoDate }).eq('afm', afm);
  }

  Swal.fire('✅ Ολοκληρώθηκε', 'Η εγγραφή ενημερώθηκε.', 'success');
  loadAllUsers();
});

// ✅ Μαζικές ενέργειες admin
function updateBulkActionVisibility() {
  const selected = document.querySelectorAll('.admin-checkbox:checked');
  document.getElementById('adminBulkActions')?.classList.toggle('hidden', selected.length === 0);
}

document.addEventListener('change', e => {
  if (e.target.classList.contains('admin-checkbox')) updateBulkActionVisibility();
});

document.getElementById('selectAllAdmin')?.addEventListener('change', (e) => {
  const checked = e.target.checked;
  document.querySelectorAll('.admin-checkbox').forEach(cb => { cb.checked = checked; });
  updateBulkActionVisibility();
});

document.getElementById('blockSelectedBtn')?.addEventListener('click', async () => {
  const selected = [...document.querySelectorAll('.admin-checkbox:checked')];
  for (const cb of selected) {
    const afm = cb.dataset.afm;
    const role = cb.dataset.role;
    const table = role === 'Εταιρεία' ? 'companies' : 'suppliers';
    await supabase.from(table).update({ blocked: true }).eq('afm', afm);
  }
  Swal.fire('Έγινε', 'Οι χρήστες μπλοκαρίστηκαν.', 'success');
  loadAllUsers();
});

document.getElementById('unblockSelectedBtn')?.addEventListener('click', async () => {
  const selected = [...document.querySelectorAll('.admin-checkbox:checked')];
  for (const cb of selected) {
    const afm = cb.dataset.afm;
    const role = cb.dataset.role;
    const table = role === 'Εταιρεία' ? 'companies' : 'suppliers';
    await supabase.from(table).update({ blocked: false }).eq('afm', afm);
  }
  Swal.fire('Έγινε', 'Η πρόσβαση επανήλθε.', 'success');
  loadAllUsers();
});

document.getElementById('deleteSelectedBtn')?.addEventListener('click', async () => {
  const selected = [...document.querySelectorAll('.admin-checkbox:checked')];
  const confirm = await Swal.fire({
    title: 'Διαγραφή',
    text: `Θα διαγραφούν ${selected.length} χρήστες. Συνέχεια;`,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'Ναι',
    cancelButtonText: 'Όχι'
  });
  if (!confirm.isConfirmed) return;

  for (const cb of selected) {
    const afm = cb.dataset.afm;
    const role = cb.dataset.role;
    const table = role === 'Εταιρεία' ? 'companies' : 'suppliers';
    await supabase.from(table).delete().eq('afm', afm);
  }
  Swal.fire('Ολοκληρώθηκε', 'Οι χρήστες διαγράφηκαν.', 'success');
  loadAllUsers();
});

// 📤 Εξαγωγή μόνο επιλεγμένων σε Excel
const exportBtn = document.getElementById('exportBtn');
exportBtn?.addEventListener('click', () => {
  const selected = document.querySelectorAll('.admin-checkbox:checked');
  if (!selected.length) {
    Swal.fire('Καμία Επιλογή', 'Επίλεξε πρώτα χρήστες με checkbox.', 'info');
    return;
  }

  const headers = ["Επωνυμία", "Email", "ΑΦΜ", "Ρόλος", "Κατάσταση", "Ημ/νία Εγγραφής", "Ανανέωση", "Λήξη", "Ενεργός"];
 let csv = headers.map(h => `"${h}"`).join(';') + '\n';


  for (const cb of selected) {
    const row = cb.closest('tr');
    if (!row) continue;
    const cols = [...row.querySelectorAll('td')].slice(1, 10).map(td => td.textContent.trim());
   csv += cols.map(val => `"${val}"`).join(';') + '\n';

  }

  const blob = new Blob(["﻿" + csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'users_export.csv';
  link.click();
});
;



