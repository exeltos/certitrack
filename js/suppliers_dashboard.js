// supplierDasjshboard.js 
import { supabase } from './supabaseClient.js';
import { viewSupplierDetails } from './suppliers_view.js';
import { showLoading, hideLoading, handleError } from './common.js';

export async function showSuppliers(company) {
  document.getElementById('certControls')?.classList.add('hidden');
  document.getElementById('loading')?.classList.remove('hidden');
  await renderSuppliers(company);
  document.getElementById('loading')?.classList.add('hidden');
}

export async function renderSuppliers(company, search = '') {
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
      status: s.user_id ? '✅ Εγγεγραμμένος' : '🕓 Εκκρεμής εγγραφή'
    };
  }).filter(r => r.name.toLowerCase().includes(search.toLowerCase()));

  if (sort === 'name') list.sort((a, b) => a.name.localeCompare(b.name));
  else if (sort === 'afm') list.sort((a, b) => a.afm.localeCompare(b.afm));
  else if (sort === 'registered') list.sort((a, b) => (b.user_id ? 1 : 0) - (a.user_id ? 1 : 0));
  else if (sort === 'pending') list.sort((a, b) => (a.user_id ? 1 : 0) - (b.user_id ? 1 : 0));

  const container = document.getElementById('dataSection');
  container.className = 'flex flex-col gap-4';
  container.innerHTML = '';

  // 🟣 Προσθήκη κουμπιών επιλογών πάνω από τις κάρτες
  const actionsDiv = document.createElement('div');
  actionsDiv.className = 'flex justify-end gap-2 mb-4';
  actionsDiv.innerHTML = `
    <button id="selectAllBtn" class="px-3 py-1 bg-purple-600 text-white rounded hover:bg-purple-700 text-sm">☑️ Επιλογή όλων</button>
    <button id="deselectAllBtn" class="px-3 py-1 bg-gray-300 text-gray-800 rounded hover:bg-gray-400 text-sm">⬜ Αποεπιλογή όλων</button>
    <button id="inviteBtn" class="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm">📧 Πρόσκληση εγγραφής</button>
  `;
  container.appendChild(actionsDiv);

  document.getElementById('selectAllBtn').onclick = () => {
    document.querySelectorAll('.supplier-checkbox').forEach(cb => cb.checked = true);
  };
  document.getElementById('deselectAllBtn').onclick = () => {
    document.querySelectorAll('.supplier-checkbox').forEach(cb => cb.checked = false);
  };
  document.getElementById('inviteBtn').onclick = async () => {
    const selected = [...document.querySelectorAll('.supplier-checkbox:checked')];
    if (!selected.length) return Swal.fire('Καμία επιλογή', 'Επίλεξε τουλάχιστον έναν προμηθευτή.', 'info');
    const ids = selected.map(cb => cb.dataset.id);

    const { data, error } = await supabase
      .from('suppliers')
      .select('email')
      .in('id', ids);

    if (error) return handleError(error);

    for (const s of data) {
      await supabase.functions.invoke('invite_supplier', {
        body: { email: s.email }
      });
    }
    Swal.fire('Εστάλησαν', 'Οι προσκλήσεις εγγραφής εστάλησαν.', 'success');
  };
  document.getElementById('supplierCount').textContent = list.length;

  if (!list.length) {
    container.innerHTML = '<p class="text-center">Δεν βρέθηκαν προμηθευτές.</p>';
    hideLoading();
    return;
  }

  for (const r of list) {
    let certs = [];
    if (r.user_id) {
      const { data } = await supabase
        .from('supplier_certificates')
        .select('date')
        .eq('supplier_user_id', r.user_id);
      certs = data || [];
    }
    
    const now = new Date();
    const stats = { total: certs.length, active: 0, soon: 0, expired: 0 };
    certs.forEach(cert => {
      const days = Math.ceil((new Date(cert.date) - now) / (1000 * 60 * 60 * 24));
      if (days < 0) stats.expired++;
      else if (days <= 30) stats.soon++;
      else stats.active++;
    });
    const card = document.createElement('div');
    card.className = 'bg-white dark:bg-gray-800 px-8 py-6 rounded-2xl shadow hover:shadow-xl transition fade-in flex justify-between items-center w-full max-w-7xl self-center';
    card.innerHTML = `
      <div class="relative">
        
        <h3 class="font-semibold text-lg">${r.name}</h3>
        <p class="text-sm">ΑΦΜ: ${r.afm || '—'}</p>
        <p class="text-sm">Email: ${r.email || '—'}</p>
      </div>
      <div class="text-xs font-medium mt-1 ${r.status === '✅ Εγγεγραμμένος' ? 'text-green-500' : 'text-yellow-500'}">${r.status}</div>
    `;
    card.classList.add('cursor-pointer', 'hover:ring-2', 'hover:ring-blue-400');
    card.onclick = (e) => {
      if (e.target.closest('.supplier-checkbox')) return;
      window.location.href = `supplier_view.html?id=${r.id}`;
    };
    card.querySelector('div.relative').innerHTML += `
      <p class="text-xs mt-2 text-gray-600 dark:text-gray-300">
        Πιστοποιητικά: ${stats.total} (Ενεργά: ${stats.active}, Προς λήξη: ${stats.soon}, Ληγμένα: ${stats.expired})
      </p>
    `;
    if (!r.user_id) {
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.className = 'supplier-checkbox w-5 h-5 absolute top-2 right-2 z-10 rounded-full accent-purple-600 border border-purple-300';
      checkbox.dataset.id = r.id;
      card.appendChild(checkbox);
      card.classList.add('relative');
    }
    container.appendChild(card);
  };

  lucide.createIcons();
  hideLoading();
}

// --- Προβολή σελίδας supplier_view.html ---

export async function loadSupplierView() {
  console.log('[CertiTrack] loadSupplierView ενεργοποιήθηκε');
  const urlParams = new URLSearchParams(window.location.search);
  const supplierId = urlParams.get('id');
  console.log('[CertiTrack] Supplier ID από URL:', supplierId);
  if (!supplierId) return;

  try {
    showLoading();
    const { data: supplier, error } = await supabase
      .from('suppliers')
      .select('*')
      .eq('id', supplierId)
      .single();
    if (error) throw error;

    // Ανάκτηση εταιρείας βάσει session email
    const { data: sessionData } = await supabase.auth.getSession();
    const email = sessionData?.session?.user?.email;
    let companyName = 'Εταιρεία';
    if (email) {
      const { data: company } = await supabase
        .from('companies')
        .select('name')
        .eq('email', email)
        .single();
      if (company?.name) companyName = company.name;
    }
  console.log('[CertiTrack] Supplier αντικείμενο:', supplier);
    if (error) throw error;

    document.getElementById('input-name').value = supplier.name || '';
    document.getElementById('input-email').value = supplier.email || '';
    document.getElementById('input-afm').value = supplier.afm || '';

    const editable = !supplier.user_id;
    document.getElementById('input-name').readOnly = !editable;
    document.getElementById('input-email').readOnly = !editable;
    document.getElementById('input-afm').readOnly = !editable;
    document.title = `CertiTrack - ${companyName} / ${supplier.name}`;
    const titleEl = document.querySelector('h1');
    if (titleEl) {
      titleEl.innerHTML = `CertiTrack - ${companyName} / <span class='text-base font-normal italic text-blue-500'>${supplier.name}</span>`;
    }
    if (!supplier.user_id) {
      const saveBtn = document.getElementById('saveBtn');
      if (saveBtn) {
        saveBtn.classList.remove('hidden');
        saveBtn.onclick = async () => {
          const updated = {
            name: document.getElementById('input-name').value.trim(),
            email: document.getElementById('input-email').value.trim(),
            afm: document.getElementById('input-afm').value.trim()
          };
          await supabase.from('suppliers').update(updated).eq('id', supplierId);
          Swal.fire('Επιτυχία', 'Τα στοιχεία αποθηκεύτηκαν.', 'success');
        };
      }
    }
    const deleteBtn = document.getElementById('deleteSupplierBtn');
    if (deleteBtn) {
      deleteBtn.classList.remove('hidden');
      deleteBtn.onclick = async () => {
        const result = await Swal.fire({
          title: 'Επιβεβαίωση',
          text: 'Θέλεις σίγουρα να διαγράψεις τον προμηθευτή;',
          icon: 'warning',
          showCancelButton: true,
          confirmButtonText: 'Ναι, διαγραφή'
        });
        if (result.isConfirmed) {
          await supabase.from('suppliers').delete().eq('id', supplierId);
          Swal.fire('Διαγράφηκε', 'Ο προμηθευτής διαγράφηκε.', 'success').then(() => {
            window.location.href = 'company_dashboard.html';
          });
        }
      };
    }

    
      
    let certs = [];
    if (supplier.user_id) {
      const { data, error: certErr } = await supabase
        .from('supplier_certificates')
        .select('*')
        .eq('supplier_user_id', supplier.user_id);
      if (certErr) throw certErr;
      certs = data || [];
    }

    const certContainer = document.getElementById('certificatesContainer');

    // Υπολογισμός μετρικών πιστοποιητικών
    const now = new Date();
    let active = 0, soon = 0, expired = 0;
    certs.forEach(c => {
      const diff = Math.ceil((new Date(c.date) - now) / (1000*60*60*24));
      if (diff < 0) expired++;
      else if (diff <= 30) soon++;
      else active++;
    });
    const summary = document.getElementById('certSummary');
    if (summary) {
      summary.textContent = `Πιστοποιητικά: ${certs.length} (Ενεργά: ${active}, Προς λήξη: ${soon}, Ληγμένα: ${expired})`;
    }

    certs.forEach(cert => {
      const expDate = new Date(cert.date);
      const daysLeft = Math.ceil((expDate - new Date()) / (1000 * 60 * 60 * 24));
      const borderClass = daysLeft < 0 ? 'border-red-500' : daysLeft <= 30 ? 'border-yellow-400' : 'border-transparent';

      const card = document.createElement('div');
      card.className = `bg-white dark:bg-gray-800 rounded-2xl shadow p-4 border-2 ${borderClass} transition hover:shadow-lg hover:scale-105`;
      card.innerHTML = `
        <div class="flex flex-col gap-1">
          <h3 class="font-semibold text-lg">${cert.title}</h3>
          <p class="text-sm">Τύπος: ${cert.type}</p>
          <p class="text-sm">Ημερομηνία λήξης: ${expDate.toLocaleDateString('el-GR')} (${daysLeft} ημέρες)</p>
        </div>
      `;
      card.classList.add('cursor-pointer');
      card.onclick = () => {
        Swal.fire({
          title: cert.title,
          html: `<embed src="${cert.file_url}" type="application/pdf" width="100%" height="800px" />`,
          width: '80%',
          showCloseButton: true,
          showConfirmButton: false
        });
      };
      certContainer.appendChild(card);
    });
  } catch (err) {
    handleError(err);
  } finally {
    hideLoading();
  }
}

