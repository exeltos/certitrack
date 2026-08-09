const urlParams = new URLSearchParams(window.location.hash.substring(1));
      const errorCode = urlParams.get('error_code');
      const errorDesc = urlParams.get('error_description');
      if (errorCode === 'otp_expired') {
        Swal.fire('Το link έληξε', 'Το link επαναφοράς έχει λήξει ή είναι άκυρο. Παρακαλώ δοκιμάστε ξανά.', 'error');
      } else if (errorCode || errorDesc) {
        Swal.fire('Σφάλμα επαναφοράς', decodeURIComponent(errorDesc || 'Μη αναγνωρίσιμο σφάλμα.'), 'error');
      }
