import { findAccountEmailByAfm } from '../../services/accountRecoveryService.js';
import { authService } from '../../services/authService.js';
    // Handle Forgot Password form submission
    const form = document.getElementById('forgotForm');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const afm = document.getElementById('afm').value.trim();
      const emailInput = document.getElementById('email').value.trim();

      // Verify AFM/email match existing user through the recovery service.
      let registeredEmail = null;
      try {
        registeredEmail = await findAccountEmailByAfm(afm);
      } catch (error) {
        return Swal.fire('Σφάλμα', error.message || 'Αποτυχία αναζήτησης λογαριασμού.', 'error');
      }
      if (!registeredEmail || registeredEmail.toLowerCase() !== emailInput.toLowerCase()) {
        return Swal.fire('Σφάλμα', 'Το ΑΦΜ και το Email δεν ταιριάζουν με εγγεγραμμένο χρήστη.', 'error');
      }


      // Netlify Function-based password reset
      try {
        const response = await fetch('https://www.certitrack.gr/.netlify/functions/reset_password_link', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: emailInput })
        });

        console.log('RESPONSE STATUS:', response.status);
        const text = await response.text();
        console.log('RESPONSE BODY:', text);

        if (!response.ok) {
          throw new Error(text);
        } else {
          Swal.fire('Έλεγχος Email', 'Έστειλα link επαναφοράς στο email σου.', 'success')
            .then(() => window.location.href = '/pages/auth/login.html');
        }
      } catch (err) {
        return Swal.fire('Σφάλμα', err.message, 'error');
      }

      // Fallback reset flow
      /*
      const { data, error } = await authService.resetPasswordForEmail(emailInput, {
        redirectTo: window.location.origin + '/reset-password.html'
      });
      console.log('Reset password email send result:', data, error);
      if (error) {
        return Swal.fire('Σφάλμα', error.message, 'error');
      }
      */
    });
