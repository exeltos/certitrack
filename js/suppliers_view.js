// suppliers_view.js
import { supabase } from './supabaseClient.js';
import { showLoading, hideLoading, handleError } from './common.js';

export async function viewSupplierDetails(supplierId) {
  loadSupplierCertificates(supplierId);
  try {
    showLoading();

    // Ανάκτηση προμηθευτή
    const { data: supplier, error } = await supabase
      .from('suppliers')
      .select('*')
      .eq('id', supplierId)
      .single();
    if (error) throw error;

    const isPending = !supplier.user_id;

    let html = `
      <div class="space-y-4 text-left">
        <div>
          <label class="block text-sm font-medium">Επωνυμία</label>
          <input type="text" id="view-name" value="${supplier.name || ''}" class="swal2-input" ${isPending ? '' : 'readonly'}>
        </div>
        <div>
          <label class="block text-sm font-medium">Email</label>
          <input type="email" id="view-email" value="${supplier.email || ''}" class="swal2-input" ${isPending ? '' : 'readonly'}>
        </div>
        <div>
          <label class="block text-sm font-medium">ΑΦΜ</label>
          <input type="text" id="view-afm" value="${supplier.afm || ''}" class="swal2-input" ${isPending ? '' : 'readonly'}>
        </div>
      </div>
    `;

    const result = await Swal.fire({
      title: 'Προβολή Προμηθευτή',
      html,
      width: 600,
      showCancelButton: isPending,
      confirmButtonText: isPending ? 'Αποθήκευση' : 'Κλείσιμο',
      didClose: () => {
        const certsContainer = document.getElementById('certificatesContainer');
        if (certsContainer) loadSupplierCertificates(supplierId);
      }
    });

    if (result.isConfirmed && isPending) {
      const updated = {
        name: document.getElementById('view-name').value.trim(),
        email: document.getElementById('view-email').value.trim(),
        afm: document.getElementById('view-afm').value.trim()
      };

      await supabase.from('suppliers').update(updated).eq('id', supplierId);
      Swal.fire('Επιτυχία', 'Τα στοιχεία ενημερώθηκαν.', 'success');
    }
  } catch (err) {
    handleError(err);
  } finally {
    hideLoading();
  }
}

async function loadSupplierCertificates(supplierId) {
  try {
    const { data, error } = await supabase
      .from('supplier_certificates')
      .select('*')
      .eq('supplier_id', supplierId);
    if (error) throw error;

    if (!data.length) {
      Swal.fire('Πιστοποιητικά', 'Δεν υπάρχουν πιστοποιητικά για αυτόν τον προμηθευτή.', 'info');
      return;
    }

    const html = data.map(cert => {
      const expDate = new Date(cert.date);
      const days = Math.ceil((expDate - new Date()) / (1000 * 60 * 60 * 24));
      return `
        <div class="border rounded p-3 mb-2 bg-white dark:bg-gray-800">
          <div class="font-semibold text-blue-700 dark:text-teal-300">${cert.title}</div>
          <div class="text-sm">Τύπος: ${cert.type}</div>
          <div class="text-sm">Ημερομηνία λήξης: ${expDate.toLocaleDateString('el-GR')} (${days} ημέρες)</div>
        </div>
      `;
    }).join('');

    document.getElementById('certificatesContainer').innerHTML = `<div class="grid gap-4">${html}</div>`;
  } catch (err) {
    handleError(err);
  }
}

