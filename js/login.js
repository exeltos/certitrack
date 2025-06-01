// js/login.js
import { supabase } from './supabaseClient.js';

document.addEventListener('DOMContentLoaded', () => {
  // Dark Mode Toggle
  const darkToggle = document.getElementById('theme-toggle');
  const moonIcon = document.getElementById('icon-moon');
  const sunIcon = document.getElementById('icon-sun');

  function updateIcons() {
    const isDark = document.documentElement.classList.contains('dark');
    if (moonIcon && sunIcon) {
      moonIcon.classList.toggle('hidden', isDark);
      sunIcon.classList.toggle('hidden', !isDark);
    }
  }

  function toggleDarkMode() {
    document.documentElement.classList.toggle('dark');
    localStorage.theme = document.documentElement.classList.contains('dark') ? 'dark' : 'light';
    updateIcons();
  }

  // Initialize theme on page load
  if (
    localStorage.theme === 'dark' ||
    (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)
  ) {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
  updateIcons();

  if (darkToggle) darkToggle.addEventListener('click', toggleDarkMode);

  // Password Visibility Toggle
  const pwdToggle = document.getElementById('togglePwd');
  const pwdInput = document.getElementById('password');
  if (pwdToggle && pwdInput) {
    pwdToggle.addEventListener('click', () => {
      pwdInput.type = pwdInput.type === 'password' ? 'text' : 'password';
    });
  }

  // Login Form Submission
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
          redirectTo = 'admin_dashboard.html';
        } else {
          // Check in companies
          const { data: comp, error: compErr } = await supabase
            .from('companies')
            .select('email')
            .eq('afm', username)
            .maybeSingle();
          if (compErr) throw compErr;
          if (comp?.email) {
            email = comp.email;
            redirectTo = 'company_dashboard.html';
          } else {
            // Check in suppliers
            const { data: sup, error: supErr } = await supabase
              .from('suppliers')
              .select('email')
              .eq('afm', username)
              .maybeSingle();
            if (supErr) throw supErr;
            if (sup?.email) {
              email = sup.email;
              redirectTo = 'certificates.html';
            }
          }
        }

        if (!email) {
          Swal.close();
          return Swal.fire({
            icon: 'warning',
            title: 'Σφάλμα',
            text: 'Δεν βρέθηκε χρήστης με αυτά τα στοιχεία.'
          });
        }

        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        console.log('🧪 Login response:', data);
        if (error) {
          Swal.close();
          return Swal.fire({
            icon: 'error',
            title: 'Λάθος στοιχεία',
            text: 'Ο συνδυασμός email και κωδικού είναι λανθασμένος.'
          });
        }

        if (data?.user && !data.user.email_confirmed_at) {
          Swal.close();
          return Swal.fire({
            icon: 'info',
            title: 'Ανεπιβεβαίωτο Email',
            text: 'Παρακαλώ επιβεβαιώστε το email σας μέσω του συνδέσμου που σας στείλαμε.'
          });
        }

        if (!data.session) {
          Swal.close();
          return Swal.fire({
            icon: 'error',
            title: 'Αποτυχία',
            text: 'Η σύνδεση απέτυχε. Προσπαθήστε ξανά.'
          });
        }

        Swal.fire({
          icon: 'success',
          title: 'Επιτυχία',
          text: 'Συνδεθήκατε με επιτυχία!',
          timer: 1500,
          showConfirmButton: false
        }).then(() => window.location.href = redirectTo);
      } catch (err) {
        console.error('Login error:', err);
        Swal.close();
        Swal.fire({
          icon: 'error',
          title: 'Σφάλμα',
          text: 'Κάτι πήγε στραβά κατά τη σύνδεση. Προσπαθήστε ξανά.'
        });
      }
    });
  }
});
