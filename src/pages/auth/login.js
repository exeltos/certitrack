import { authService } from '../../services/authService.js';
import { databaseService } from '../../services/databaseService.js';
import { companyService } from '../../services/companyService.js';
import { supplierService } from '../../services/supplierService.js';
// js/login.js
document.addEventListener('DOMContentLoaded', () => {
  const pwdToggle = document.getElementById('togglePwd');
  const pwdInput = document.getElementById('password');
  if (pwdToggle && pwdInput) {
    pwdToggle.addEventListener('click', () => {
      pwdInput.type = pwdInput.type === 'password' ? 'text' : 'password';
    });
  }

  const loginForm = document.getElementById('loginForm');
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const username = document.getElementById('username').value.trim();
      const password = pwdInput.value;
      let email;
      let redirectTo;

      Swal.fire({
        title: 'Γίνεται σύνδεση...',
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading()
      });

      try {
        if (username.toLowerCase() === 'admin') {
          email = 'admin@certitrack.gr';
          redirectTo = '/pages/admin/dashboard.html';
        } else {
          const { data: comp, error: compErr } = await companyService.table()
            .select('email')
            .eq('afm', username)
            .maybeSingle();

          if (compErr) throw compErr;

          if (comp?.email) {
            email = comp.email;
            redirectTo = '/pages/company/dashboard.html';
          } else {
            const { data: sup, error: supErr } = await supplierService.table()
              .select('email')
              .eq('afm', username)
              .maybeSingle();

            if (supErr) throw supErr;

            if (sup?.email) {
              // Απλός έλεγχος supplier: επιτρέπεται σύνδεση μετά από προσωρινή αποθήκευση
              email = sup.email;
              redirectTo = '/pages/supplier/certificates.html';
            }
          }
        }

        if (!email) {
  Swal.close();
  document.getElementById('username').value = '';
  document.getElementById('password').value = '';
  return Swal.fire({
            icon: 'warning',
            title: 'Σφάλμα',
            text: 'Δεν βρέθηκε χρήστης με αυτά τα στοιχεία.'
          });
        }

        const { data, error } = await authService.signInWithPassword({ email, password });

        if (error) {
  Swal.close();
  document.getElementById('username').value = '';
  document.getElementById('password').value = '';
  return Swal.fire({
            icon: 'error',
            title: 'Λάθος στοιχεία',
            text: 'Ο συνδυασμός Α.Φ.Μ. και κωδικού είναι λανθασμένος.'
          });
        }

        if (data?.user && !data.user.email_confirmed_at) {
  Swal.close();
  document.getElementById('username').value = '';
  document.getElementById('password').value = '';
  return Swal.fire({
            icon: 'info',
            title: 'Ανεπιβεβαίωτο Email',
            text: 'Παρακαλώ επιβεβαιώστε το email σας μέσω του συνδέσμου που σας στείλαμε.'
          });
        }

        if (!data.session) {
  Swal.close();
  document.getElementById('username').value = '';
  document.getElementById('password').value = '';
  return Swal.fire({
            icon: 'error',
            title: 'Αποτυχία',
            text: 'Η σύνδεση απέτυχε. Προσπαθήστε ξανά.'
          });
        }

        // Έλεγχος αν ο χρήστης είναι μπλοκαρισμένος
        const table = redirectTo.includes('company') ? 'companies' : 'suppliers';
        const { data: blockedUser, error: blockedErr } = await databaseService.table(table)
          .select('blocked')
          .eq('email', email)
          .maybeSingle();

        if (blockedErr) {
          console.error('Σφάλμα κατά τον έλεγχο blocked:', blockedErr);
        }

        if (blockedUser?.blocked) {
  await authService.signOut();
  Swal.close();
  document.getElementById('username').value = '';
  document.getElementById('password').value = '';
  return Swal.fire({
            icon: 'warning',
            title: 'Αποκλεισμένος Χρήστης',
            text: 'Η συνδρομή σας έχει λήξει ή έχετε αποκλειστεί από το σύστημα.'
          });
        }

        Swal.fire({
          icon: 'success',
          title: 'Επιτυχία',
          text: 'Συνδεθήκατε με επιτυχία!',
          timer: 1500,
          showConfirmButton: false
        }).then(() => {
          localStorage.removeItem('certitrack.demo.role');
      window.location.href = redirectTo;
        });

      } catch (err) {
        console.error('Login error:', err);
        Swal.close();
        document.getElementById('username').value = '';
document.getElementById('password').value = '';
Swal.fire({
  icon: 'error',
  title: 'Σφάλμα',
  text: 'Κάτι πήγε στραβά κατά τη σύνδεση. Προσπαθήστε ξανά.'
        });
      }
    });
  }
});
