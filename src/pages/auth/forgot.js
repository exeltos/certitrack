import { authService } from '../../services/authService.js';
import { absoluteAuthUrl, AUTH_PATHS } from '../../auth/authConfig.js';

const form=document.getElementById('forgotForm');
form?.addEventListener('submit',async e=>{
  e.preventDefault();
  const email=document.getElementById('email').value.trim().toLowerCase();
  const btn=form.querySelector('button[type="submit"]'); btn.disabled=true;
  try{
    const {error}=await authService.resetPasswordForEmail(email,{redirectTo:absoluteAuthUrl(AUTH_PATHS.reset)});
    if(error) throw error;
    // Generic response prevents account enumeration.
    await Swal.fire('Ελέγξτε το email σας','Αν υπάρχει λογαριασμός με αυτό το email, θα λάβετε σύνδεσμο επαναφοράς κωδικού.','success');
    location.href='./login.html';
  }catch(err){
    await Swal.fire('Δεν ήταν δυνατή η αποστολή','Δοκιμάστε ξανά σε λίγο.','error');
  }finally{btn.disabled=false;}
});
