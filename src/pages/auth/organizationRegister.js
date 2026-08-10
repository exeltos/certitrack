import { authService } from '../../services/authService.js';
import { validatePassword, passwordPolicyMessage } from '../../auth/passwordPolicy.js';
import { absoluteAuthUrl, AUTH_PATHS } from '../../auth/authConfig.js';

const form=document.getElementById('registerForm'),errorEl=document.getElementById('errorMsg'),btn=document.getElementById('submitBtn'),spinner=document.getElementById('spinner');

function fail(message){ throw new Error(message); }

form?.addEventListener('submit',async e=>{
  e.preventDefault(); errorEl.classList.add('hidden'); btn.disabled=true; spinner.classList.remove('hidden');
  const name=form.name.value.trim(), email=form.email.value.trim().toLowerCase(), afm=form.afm.value.replace(/\D/g,''), afm2=form.afmConfirm.value.replace(/\D/g,''), password=form.password.value, password2=form.passwordConfirm.value;
  try{
    if(!name||!email||!afm||!password) fail('Συμπληρώστε όλα τα υποχρεωτικά πεδία.');
    if(!/^\d{9}$/.test(afm)) fail('Το ελληνικό ΑΦΜ πρέπει να αποτελείται από 9 ψηφία.');
    if(afm!==afm2) fail('Τα ΑΦΜ δεν ταιριάζουν.');
    if(password!==password2) fail('Οι κωδικοί δεν ταιριάζουν.');
    if(!validatePassword(password).valid) fail(passwordPolicyMessage('el'));

    const terms=await Swal.fire({
      title:'Όροι χρήσης',
      html:'<label class="ct-swal-consent"><input type="checkbox" id="termsCheckbox"> Αποδέχομαι τους όρους χρήσης και την πολιτική απορρήτου</label>',
      showCancelButton:true,confirmButtonText:'Δημιουργία λογαριασμού',cancelButtonText:'Ακύρωση',
      preConfirm:()=>document.getElementById('termsCheckbox')?.checked||Swal.showValidationMessage('Απαιτείται αποδοχή των όρων.')
    });
    if(!terms.isConfirmed)return;

    // The Phase33 database trigger creates the organization + owner membership atomically.
    const {data,error}=await authService.signUp({
      email,password,
      options:{data:{type:'organization',country_code:'GR',afm,name},emailRedirectTo:absoluteAuthUrl(AUTH_PATHS.login)}
    });
    if(error) throw error;
    if(!data?.user) fail('Δεν ήταν δυνατή η δημιουργία του λογαριασμού.');

    await Swal.fire({
      icon:'success',title:'Ελέγξτε το email σας',
      text:'Στείλαμε σύνδεσμο επιβεβαίωσης. Η πρόσβαση ενεργοποιείται μετά την επιβεβαίωση του email.',
      confirmButtonText:'Εντάξει'
    });
    location.href='./login.html';
  }catch(err){
    errorEl.textContent=err.message||'Σφάλμα εγγραφής.'; errorEl.classList.remove('hidden');
  }finally{btn.disabled=false;spinner.classList.add('hidden');}
});
