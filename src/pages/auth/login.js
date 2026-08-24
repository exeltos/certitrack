import { authService } from '../../services/authService.js';

// Renders a TOTP code prompt and resolves with the 6-digit code, or null if
// the user cancels. Kept dependency-free (no new modal library) by reusing
// the SweetAlert2 instance already loaded on this page.
async function promptForMfaCode() {
  const { value } = await Swal.fire({
    title: 'Κωδικός επαλήθευσης',
    text: 'Εισάγετε τον 6-ψήφιο κωδικό από την εφαρμογή επαλήθευσης.',
    input: 'text',
    inputAttributes: { inputmode: 'numeric', autocomplete: 'one-time-code', maxlength: 6 },
    showCancelButton: true,
    confirmButtonText: 'Επιβεβαίωση',
    cancelButtonText: 'Άκυρο',
    inputValidator: value => (/^\d{6}$/.test(value || '') ? undefined : 'Ο κωδικός πρέπει να έχει 6 ψηφία.')
  });
  return value || null;
}

document.addEventListener('DOMContentLoaded',()=>{
  const pwdToggle=document.getElementById('togglePwd'),pwdInput=document.getElementById('password');
  pwdToggle?.addEventListener('click',()=>{pwdInput.type=pwdInput.type==='password'?'text':'password'});
  document.getElementById('loginForm')?.addEventListener('submit',async e=>{
    e.preventDefault();
    const email=document.getElementById('username').value.trim().toLowerCase(),password=pwdInput.value;
    Swal.fire({title:'Γίνεται σύνδεση...',allowOutsideClick:false,didOpen:()=>Swal.showLoading()});
    try{
      const {data,error}=await authService.signInWithPassword({email,password});
      if(error) throw new Error('Το email ή ο κωδικός είναι λανθασμένος ή το email δεν έχει ακόμη επιβεβαιωθεί.');
      if(!data?.session) throw new Error('Επιβεβαιώστε πρώτα το email σας.');

      // If this account has an MFA factor enrolled, the session above is
      // only AAL1 (password-verified). Require the second factor before
      // handing over the dashboard.
      const { data: aal, error: aalError } = await authService.mfaGetAuthenticatorAssuranceLevel();
      if (!aalError && aal?.nextLevel === 'aal2' && aal.currentLevel !== 'aal2') {
        Swal.close();
        const { data: factorsData } = await authService.mfaListFactors();
        const totpFactor = factorsData?.totp?.[0];
        if (!totpFactor) throw new Error('Απαιτείται δεύτερος παράγοντας ταυτοποίησης, αλλά δεν βρέθηκε καταχωρημένη συσκευή.');

        const { data: challenge, error: challengeError } = await authService.mfaChallenge(totpFactor.id);
        if (challengeError) throw new Error('Δεν ήταν δυνατή η έναρξη επαλήθευσης δύο παραγόντων.');

        let verified = false;
        while (!verified) {
          const code = await promptForMfaCode();
          if (!code) { await authService.signOut(); return; } // user cancelled: don't leave a half-authenticated AAL1 session hanging in the UI
          const { error: verifyError } = await authService.mfaVerify(totpFactor.id, challenge.id, code);
          if (verifyError) {
            await Swal.fire({ icon: 'error', title: 'Λανθασμένος κωδικός', text: 'Δοκιμάστε ξανά.' });
            continue;
          }
          verified = true;
        }
        Swal.fire({title:'Γίνεται σύνδεση...',allowOutsideClick:false,didOpen:()=>Swal.showLoading()});
      }

      localStorage.removeItem('certitrack.demo.role');
      Swal.close(); location.href='../organization/dashboard.html';
    }catch(err){
      Swal.close(); pwdInput.value='';
      Swal.fire({icon:'error',title:'Δεν ήταν δυνατή η σύνδεση',text:err.message||'Ελέγξτε τα στοιχεία σας.'});
    }
  });
});
