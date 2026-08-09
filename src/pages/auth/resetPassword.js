import { authService } from '../../services/authService.js';
    // Toggle functions from common.js
        window.togglePassword = window.togglePassword || function(id) { const i = document.getElementById(id); i.type = i.type === 'password' ? 'text' : 'password'; };

    document.addEventListener('DOMContentLoaded', async () => {
      // Apply persisted theme
      if (localStorage.getItem('theme') === 'dark') document.documentElement.classList.add('dark');

      // Parse and store session from URL (reset link)
      let data, error;
      try {
        const result = await authService.exchangeCodeForSession();
        data = result.data;
        error = result.error;
        if (data?.session) {
          console.log('✅ Έγινε setSession:', data.session);
          await authService.setSession(data.session);
        }
      } catch (err) {
        console.error('Session exchange failed:', err);
        Swal.fire('Σφάλμα', 'Η σύνδεση επαναφοράς είναι μη έγκυρη ή έχει λήξει.', 'error');
        return;
      }
      if (error) console.error('Session parsing error:', error.message);
      // Now authenticated session exists for updateUser

      // Handle form submission
      document.getElementById('resetForm').addEventListener('submit', async e => {
        e.preventDefault();
        const newPw = document.getElementById('newPassword').value;
        const confirmPw = document.getElementById('confirmPassword').value;
        if (newPw !== confirmPw) {
          return Swal.fire('Σφάλμα', 'Οι κωδικοί δεν ταιριάζουν.', 'error');
        }
        const { error: updateErr } = await authService.updateUser({ password: newPw });
        console.log('🔐 Αλλαγή κωδικού προσπάθεια...');
        if (updateErr) {
        console.error('❌ updateUser error:', updateErr);
          Swal.fire('Σφάλμα', updateErr.message, 'error');
        } else {
          Swal.fire('Επιτυχία', 'Ο κωδικός άλλαξε. Συνδέσου ξανά.', 'success')
            .then(() => window.location.href = '/pages/auth/login.html');
        }
      });
    });
