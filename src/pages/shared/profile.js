import { isDemo, exitDemo } from '../../demo/demoSession.js';
import { renderProfileDemo } from '../../demo/realScreenDemo.js';
import { authService } from '../../services/authService.js';
import { companyService } from '../../services/companyService.js';
import { supplierService } from '../../services/supplierService.js';
import { handleError } from '../../shared/common.js';
document.addEventListener('DOMContentLoaded', async () => {
  document.querySelectorAll('.password-toggle').forEach(btn => btn.addEventListener('click', () => {
    const input = document.getElementById(btn.dataset.target);
    if (!input) return;
    input.type = input.type === 'password' ? 'text' : 'password';
    const icon = btn.querySelector('[data-lucide]');
    if (icon) icon.setAttribute('data-lucide', input.type === 'password' ? 'eye' : 'eye-off');
    window.lucide?.createIcons();
  }));
  const demoRole = isDemo('company') ? 'company' : (isDemo('supplier') ? 'supplier' : null);
  if (demoRole) {
    renderProfileDemo(demoRole);
    document.getElementById('logoutBtn')?.addEventListener('click', exitDemo);
    return;
  }
      // Toggle εμφάνισης πεδίων αλλαγής κωδικού
      const togglePwdBtn = document.getElementById('togglePasswordFields');
      const pwdSection = document.getElementById('passwordFields');
      const pass = document.getElementById('profilePassword');
      const confirm = document.getElementById('profilePasswordConfirm');
      const msg = document.getElementById('passwordMatchMsg');

      togglePwdBtn?.addEventListener('click', () => {
        pwdSection.classList.toggle('hidden');
      });

      [pass, confirm].forEach(el => el?.addEventListener('input', () => {
        if (!pass.value && !confirm.value) {
          msg.textContent = '';
          return;
        }
        if (pass.value === confirm.value) {
          msg.textContent = 'Οι κωδικοί ταιριάζουν';
          msg.className = 'text-green-600 text-sm';
        } else {
          msg.textContent = 'Οι κωδικοί δεν ταιριάζουν';
          msg.className = 'text-red-600 text-sm';
        }
      }));
      const { data: sessionData } = await authService.getSession();
      const user = sessionData?.session?.user;
      if (!user) return location.href = '/index.html';

      let name = '', afm = '';
const userType = user?.user_metadata?.type || '';
// αφαιρέθηκε η μεταβλητή type - χρησιμοποιείται απευθείας userType

if (userType === 'company') {
  const { data: company } = await companyService.table().select('*').eq('user_id', user.id).maybeSingle();
  name = company?.name || '';
  afm = company?.afm || '';
} else {
  const { data: supplier } = await supplierService.table().select('*').eq('user_id', user.id).maybeSingle();
  name = supplier?.name || '';
  afm = supplier?.afm || '';
}

document.getElementById('profileName').value = name;
document.getElementById('profileEmail').value = user.email || '';
const supplierHeader = document.getElementById('supplierHeader');
if (supplierHeader) supplierHeader.textContent = name || 'Χρήστης';
const userTypeLabel = document.getElementById('userTypeLabel');
if (userTypeLabel) userTypeLabel.textContent = userType === 'company' ? '(Εταιρεία)' : '(Προμηθευτής)';
document.getElementById('profileAfm').value = afm;
      // Αφαιρέθηκε η επανάληψη που έγραφε πάντα supplier.afm
// Η τιμή έχει ήδη οριστεί νωρίτερα δυναμικά


      document.getElementById('profileForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('profileName').value.trim();
        const email = document.getElementById('profileEmail').value.trim();
        if (!name || !email) return Swal.fire('Σφάλμα', 'Συμπληρώστε όλα τα πεδία.', 'error');

        if (userType === 'company') {
  await companyService.table().update({ name }).eq('user_id', user.id);
} else {
  await supplierService.table().update({ name }).eq('user_id', user.id);
}
        const { error: emailErr } = await authService.updateUser({ email });
        if (emailErr) return Swal.fire('Σφάλμα', emailErr.message, 'error');

        if (pass.value && pass.value === confirm.value) {
          const { error: passErr } = await authService.updateUser({ password: pass.value });
          if (passErr) return Swal.fire('Σφάλμα', passErr.message, 'error');
        }
        document.getElementById('saveSpinner').classList.remove('hidden');
        document.getElementById('saveBtn').disabled = true;
        setTimeout(() => {
          document.getElementById('saveSpinner').classList.add('hidden');
          document.getElementById('saveBtn').disabled = false;
          Swal.fire('Επιτυχία', 'Τα στοιχεία αποθηκεύτηκαν.', 'success').then(() => {
            sessionStorage.setItem('fromProfile', 'true');
          window.location.href = userType === 'company' ? '/pages/company/dashboard.html' : '/pages/supplier/certificates.html';
          });
        }, 1000);
      });

      document.getElementById('deleteAccountBtn')?.addEventListener('click', async () => {
        const { value: formValues } = await Swal.fire({
          title: 'Επιβεβαίωση Διαγραφής',
          html:
            '<input id="swal-afm" class="swal2-input" placeholder="ΑΦΜ">' +
            '<input id="swal-password" type="password" class="swal2-input" placeholder="Κωδικός">',
          focusConfirm: false,
          showCancelButton: true,
          confirmButtonText: 'Διαγραφή',
          preConfirm: () => {
            const afm = document.getElementById('swal-afm').value.trim();
            const pwd = document.getElementById('swal-password').value;
            if (!afm || !pwd) {
              Swal.showValidationMessage('Συμπλήρωσε ΑΦΜ και Κωδικό');
            }
            return { afm, pwd };
          }
        });

        if (formValues) {
          const { afm, pwd } = formValues;
          let check = null;
if (userType === 'company') {
  const { data } = await companyService.table().select('*').eq('user_id', user.id).maybeSingle();
  check = data;
} else {
  const { data } = await supplierService.table().select('*').eq('user_id', user.id).maybeSingle();
  check = data;
}
if (check?.afm !== afm) {
            return Swal.fire('Λάθος ΑΦΜ', 'Το ΑΦΜ δεν αντιστοιχεί στον λογαριασμό σου.', 'error');
          }
          const { error: signInErr } = await authService.signInWithPassword({ email: user.email, password: pwd });
          if (signInErr) return Swal.fire('Λάθος Κωδικός', 'Ο κωδικός που έδωσες είναι λάθος.', 'error');

          if (userType === 'company') {
  await companyService.table().delete().eq('user_id', user.id);
} else {
  await supplierService.table().delete().eq('user_id', user.id);
}
          await authService.signOut();
          Swal.fire('Διαγραφή', 'Ο λογαριασμός διαγράφηκε.', 'success').then(() => {
            location.href = '/index.html';
          });
        }
      });
        

      document.getElementById('logoutBtn')?.addEventListener('click', async () => {
  await authService.signOut();
  location.href = '/index.html';
});

// 🔄 Ενεργοποίηση lucide icons μετά το φόρτωμα της σελίδας
if (window.lucide) lucide.createIcons();
    });