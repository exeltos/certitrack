import { authService } from '../../services/authService.js';
import { relationshipService } from '../../services/relationshipService.js';
import { supplierService } from '../../services/supplierService.js';
    const form = document.getElementById('supplierForm');
    const errorEl = document.getElementById('errorMsg');
    const submitBtn = document.getElementById('submitBtn');
    const spinner = document.getElementById('spinner');

    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      // ✅ SweetAlert αποδοχής όρων χρήσης
      const result = await Swal.fire({
        title: 'Όροι Χρήσης',
        html: `<p class='text-sm text-left'>Για να συνεχίσετε, πρέπει να αποδεχθείτε τους όρους χρήσης.</p>
               <label class='flex items-center mt-3'><input type='checkbox' id='termsCheckbox' class='mr-2'>Αποδέχομαι τους όρους</label>`,
        icon: 'info',
        confirmButtonText: 'Συνέχεια',
        preConfirm: () => {
          const checked = document.getElementById('termsCheckbox')?.checked;
          if (!checked) {
            Swal.showValidationMessage('Πρέπει να αποδεχτείτε τους όρους.');
            return false;
          }
          return true;
        },
        allowOutsideClick: () => !Swal.isLoading()
      });

      if (!result.isConfirmed) return;
      errorEl.classList.add('hidden');
      submitBtn.disabled = true;
      spinner.classList.remove('hidden');

      const name = form.name.value.trim();
      const email = form.email.value.trim();
      const afm = form.afm.value.trim();
      const afmConfirm = form.afmConfirm.value.trim();
      const password = form.password.value;
      const passwordConfirm = form.passwordConfirm.value;

      // Basic validations
      if (!name || !email || !afm || !afmConfirm || !password || !passwordConfirm) {
        errorEl.textContent = 'Παρακαλώ συμπληρώστε όλα τα πεδία.';
        spinner.classList.add('hidden');
        submitBtn.disabled = false;
        return errorEl.classList.remove('hidden');
      }
      if (afm !== afmConfirm) {
        errorEl.textContent = 'Τα ΑΦΜ δεν ταιριάζουν.';
        spinner.classList.add('hidden');
        submitBtn.disabled = false;
        return errorEl.classList.remove('hidden');
      }
      if (password !== passwordConfirm) {
        errorEl.textContent = 'Οι κωδικοί δεν ταιριάζουν.';
        spinner.classList.add('hidden');
        submitBtn.disabled = false;
        return errorEl.classList.remove('hidden');
      }

      try {
        // Check existing supplier by AFM or Email
        const { data: existingSupplierData, error: existsErr } = await supplierService.table()
          .select('id, user_id, company_id')
          .or(`afm.eq.${afm},email.eq.${email}`)
          .limit(1);
        const existingSupplier = existingSupplierData?.[0];

        // 🔍 Αν δεν υπάρχει company_id, πάρε το από τον πίνακα company_suppliers
        if (existingSupplier && !existingSupplier.company_id) {
          const { data: companyLinkData, error: companyFetchErr } = await relationshipService.table()
            .select('company_id')
            .eq('supplier_id', existingSupplier.id)
            .maybeSingle();
          if (!companyFetchErr && companyLinkData?.company_id) {
            existingSupplier.company_id = companyLinkData.company_id;
          }
        }

        // 🔍 Επέκταση αντικειμένου supplier ώστε να περιλαμβάνει και το company_id για ενημέρωση status
        if (existingSupplier?.id) {
          const { data: supplierFull, error: loadErr } = await supplierService.table()
            .select('company_id')
            .eq('id', existingSupplier.id)
            .maybeSingle();
          if (!loadErr && supplierFull?.company_id) {
            existingSupplier.company_id = supplierFull.company_id;
          }
        }

        if (existsErr) throw existsErr;
        if (existingSupplier && existingSupplier.user_id) {
          Swal.fire('Προσοχή', 'Αυτός ο προμηθευτής είναι ήδη εγγεγραμμένος. Παρακαλώ κάνε σύνδεση.', 'info');
          spinner.classList.add('hidden');
          submitBtn.disabled = false;
          return;
        }

        const { data: emailExists, error: emailErr } = await supplierService.table().select('email, user_id').eq('email', email).maybeSingle();
        if (emailErr) throw emailErr;
        if (emailExists && emailExists.user_id) {
          Swal.fire('Προσοχή', 'Αυτό το email είναι ήδη συνδεδεμένο με λογαριασμό.', 'info');
          spinner.classList.add('hidden');
          submitBtn.disabled = false;
          return;
        }


        // Αντί για έλεγχο μέσω auth.admin (δεν υποστηρίζεται στο frontend), ελέγχουμε το σφάλμα μετά το signUp.


        // Sign up user
        const { data: signData, error: signErr } = await authService.signUp({
  email,
  password,
  options: {
    data: { type: 'supplier', afm, name },
    redirectTo: `${window.location.origin}/general_login.html`
  }
});
        if (signErr) {
          if (signErr.message === 'User already registered') {
            Swal.fire('Προσοχή', 'Αυτός ο χρήστης είναι ήδη εγγεγραμμένος. Παρακαλώ κάνε σύνδεση.', 'info');
            spinner.classList.add('hidden');
            submitBtn.disabled = false;
            return;
          }
          throw signErr;
        }

        // Ενημέρωση υπάρχοντος supplier αν υπάρχει χωρίς user_id
        if (existingSupplier) {
          const { error: updateErr } = await supplierService.table()
  .update({
    user_id: signData.user.id,
    status: '✅ Εγγεγραμμένος',
    timestamp: new Date().toISOString(),
    afm,
    name
  })
  .eq('id', existingSupplier.id);
          if (updateErr) throw updateErr;

          // ✅ Ενημέρωση ή εισαγωγή εγγραφής στον πίνακα company_suppliers ΜΟΝΟ αν υπάρχει company_id
          // και αλλάζουμε το status σε ✅ Εγγεγραμμένος όταν γίνεται εγγραφή
          if (existingSupplier.company_id) {
            const { data: companyLink, error: linkErr } = await relationshipService.table()
              .select('id')
              .eq('supplier_id', existingSupplier.id)
              .eq('company_id', existingSupplier.company_id)
              .maybeSingle();

            if (linkErr) throw linkErr;

            if (!companyLink) {
} else {
}
            if (companyLink) {
  const { error: updateErr } = await relationshipService.table()
    .update({
      status: '✅ Εγγεγραμμένος',
      timestamp: new Date().toISOString()
    })
    .eq('id', companyLink.id);
  if (updateErr) throw updateErr;
} else {
  const { error: insertErr } = await relationshipService.table()
    .insert([{
      supplier_id: existingSupplier.id,
      company_id: existingSupplier.company_id,
      status: '✅ Εγγεγραμμένος',
      timestamp: new Date().toISOString()
    }]);
  if (insertErr) throw insertErr;
}
          }
        } else {
          // Εισαγωγή νέου supplier
          const timestamp = new Date().toISOString();
          const { error: insertErr } = await supplierService.table()
            .insert([{ name, email, afm, user_id: signData.user.id, timestamp, status: '✅ Εγγεγραμμένος' }]);
          if (insertErr) throw insertErr;
        }
        Swal.fire({
          title: 'Επιτυχία',
          text: 'Η εγγραφή ολοκληρώθηκε. Ένας σύνδεσμος επιβεβαίωσης στάλθηκε στο email σας.',
          icon: 'success',
          timer: 2000,
          showConfirmButton: false
        }).then(() => {
          window.location.href = '/pages/auth/login.html';
        });
      } catch (err) {
        console.error('Registration error:', err);
        errorEl.textContent = err.message || 'Σφάλμα εγγραφής.';
        errorEl.classList.remove('hidden');
        spinner.classList.add('hidden');
        submitBtn.disabled = false;
      }
    });