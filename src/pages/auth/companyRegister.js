import { authService } from '../../services/authService.js';
import { companyService } from '../../services/companyService.js';
const MAILERSEND_API_KEY = 'MAILERSEND_API_KEY_REPLACE_ME';
import { handleError } from '../../shared/common.js';

    const form = document.getElementById('registerForm');
    const errorEl = document.getElementById('errorMsg');
    const submitBtn = document.getElementById('submitBtn');
    const spinner = document.getElementById('spinner');

    form.addEventListener('submit', async (e) => {
  e.preventDefault();
  errorEl.classList.add('hidden');
  submitBtn.disabled = true;
  spinner.classList.remove('hidden');

  const name = form.name.value.trim();
  const email = form.email.value.trim();
  const afm = form.afm.value.trim();
  const afmConfirm = form.afmConfirm.value.trim();
  const password = form.password.value;
  const passwordConfirm = form.passwordConfirm.value;

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

  // ✅ Προσθήκη SweetAlert για αποδοχή όρων
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

  if (!result.isConfirmed) {
    spinner.classList.add('hidden');
    submitBtn.disabled = false;
    return;
  }

  try {
        // AFM uniqueness check
        const { data: existingAFM, error: afmErr } = await companyService.table()
          .select('afm')
          .eq('afm', afm)
          .maybeSingle();
        if (afmErr) throw afmErr;
        if (existingAFM) {
          Swal.fire('Προσοχή', 'Υπάρχει ήδη εταιρεία με αυτό το ΑΦΜ.', 'info');
          spinner.classList.add('hidden');
          submitBtn.disabled = false;
          return;
        }

        // Email uniqueness check
        const { data: existingEmail, error: emailErr } = await companyService.table()
          .select('email')
          .eq('email', email)
          .maybeSingle();
        if (emailErr) throw emailErr;
        if (existingEmail) {
          Swal.fire('Προσοχή', 'Υπάρχει ήδη εταιρεία με αυτό το email.', 'info');
          spinner.classList.add('hidden');
          submitBtn.disabled = false;
          return;
        }

        // Sign up user
        const { data: signData, error: signErr } = await authService.signUp({
  email,
  password,
  options: {
    data: { type: 'company', afm, name },
    redirectTo: `${window.location.origin}/general_login.html`
  }
});
        if (signErr) throw signErr;
        const userId = signData.user.id;  // νέο user id για FK


        // Insert company record
        const timestamp = new Date().toISOString();
        const { error: insertErr } = await companyService.table()
          .insert([{ name, email, afm, user_id: userId, timestamp }]);
        if (insertErr) throw insertErr;

        

Swal.fire({
  title: 'Επιτυχία',
  text: 'Η εγγραφή ολοκληρώθηκε. Ένας σύνδεσμος επιβεβαίωσης στάλθηκε στο email σας.',
  icon: 'success',
  timer: 3000,
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