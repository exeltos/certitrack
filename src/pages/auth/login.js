import { authService } from '../../services/authService.js';

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
      localStorage.removeItem('certitrack.demo.role');
      Swal.close(); location.href='../organization/dashboard.html';
    }catch(err){
      Swal.close(); pwdInput.value='';
      Swal.fire({icon:'error',title:'Δεν ήταν δυνατή η σύνδεση',text:err.message||'Ελέγξτε τα στοιχεία σας.'});
    }
  });
});
