import { authService } from '../../services/authService.js';
import { validatePassword, passwordPolicyMessage } from '../../auth/passwordPolicy.js';

document.addEventListener('DOMContentLoaded',async()=>{
  const form=document.getElementById('resetForm');
  const {data}=await authService.getSession();
  if(!data?.session){
    await new Promise(r=>setTimeout(r,350));
  }
  const after=await authService.getSession();
  if(!after.data?.session){
    await Swal.fire('Μη έγκυρος σύνδεσμος','Ο σύνδεσμος επαναφοράς έχει λήξει ή δεν είναι έγκυρος. Ζητήστε νέο σύνδεσμο.','error');
    location.href='./forgot.html'; return;
  }

  form?.addEventListener('submit',async e=>{
    e.preventDefault();
    const password=document.getElementById('newPassword').value;
    const confirm=document.getElementById('confirmPassword').value;
    if(password!==confirm) return Swal.fire('Σφάλμα','Οι κωδικοί δεν ταιριάζουν.','error');
    if(!validatePassword(password).valid) return Swal.fire('Ο κωδικός δεν είναι αρκετά ισχυρός',passwordPolicyMessage('el'),'error');
    const btn=form.querySelector('button[type="submit"]'); btn.disabled=true;
    const {error}=await authService.updateUser({password});
    btn.disabled=false;
    if(error) return Swal.fire('Σφάλμα',error.message||'Δεν ήταν δυνατή η αλλαγή κωδικού.','error');
    await authService.signOut();
    await Swal.fire('Ο κωδικός άλλαξε','Συνδεθείτε ξανά με τον νέο κωδικό.','success');
    location.href='./login.html';
  });
});
