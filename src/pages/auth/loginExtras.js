import { authService } from '../../services/authService.js';
import { companyService } from '../../services/companyService.js';
import { supplierService } from '../../services/supplierService.js';
    const resendBtn = document.getElementById('resend-confirmation');
    resendBtn?.addEventListener('click', async (e) => {
      e.preventDefault();
      const { value: afm } = await Swal.fire({
        title: 'Εισάγετε το ΑΦΜ',
        input: 'text',
        inputLabel: 'Θα σας στείλουμε νέο σύνδεσμο επιβεβαίωσης.',
        inputPlaceholder: 'ΑΦΜ',
        confirmButtonText: 'Αποστολή',
        showCancelButton: true
      });

      if (!afm) return;

      try {
        // Προσπάθεια σε companies
const { data: compData, error: compError } = await companyService.table()
  .select('email')
  .eq('afm', afm)
  .maybeSingle();

let email;
if (compError || !compData?.email) {
  // Αν δεν βρέθηκε σε companies, ψάχνουμε suppliers
  const { data: supData, error: supError } = await supplierService.table()
    .select('email')
    .eq('afm', afm)
    .maybeSingle();
  if (supError || !supData?.email) {
    return Swal.fire('Σφάλμα', 'Δεν βρέθηκε email για αυτό το ΑΦΜ.', 'error');
  }
  email = supData.email;
} else {
  email = compData.email;
}

        if (error || !data?.email) {
          return Swal.fire('Σφάλμα', 'Δεν βρέθηκε email για αυτό το ΑΦΜ.', 'error');
        }

        const { error: resendErr } = await authService.resend({ type: 'signup', email });
        if (resendErr) throw resendErr;

        Swal.fire('Έτοιμο', 'Σας στείλαμε νέο σύνδεσμο επιβεβαίωσης.', 'success');
      } catch (err) {
        console.error(err);
        Swal.fire('Σφάλμα', 'Αποτυχία αποστολής email. Προσπαθήστε ξανά.', 'error');
      }
    });
  if (window.lucide) lucide.createIcons();