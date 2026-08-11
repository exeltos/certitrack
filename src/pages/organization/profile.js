import { getOrganizationContext, bindOrganizationLogout } from './guard.js';
import { organizationService } from '../../services/organizationService.js';
import { authService } from '../../services/authService.js';
import { notificationService } from '../../services/notificationService.js';
import { validatePassword, passwordPolicyMessage } from '../../auth/passwordPolicy.js';

let ctx;

function setChecked(id,value){const el=document.getElementById(id);if(el)el.checked=value!==false;}
function warningDays(){return [...document.querySelectorAll('#warningDays input:checked')].map(x=>Number(x.value)).sort((a,b)=>b-a);}

async function loadPreferences(){
  const p=await notificationService.preferences(ctx.organization.id).catch(()=>null);
  if(!p)return;
  setChecked('prefInApp',p.in_app_enabled);
  setChecked('prefEmail',p.email_enabled);
  setChecked('prefExpiryInApp',p.expiry_notifications);
  setChecked('prefExpiryEmail',p.expiry_notifications);
  setChecked('prefRelationships',p.relationship_notifications);
  setChecked('prefCertificateChanges',p.certificate_change_notifications);
  const selected=new Set((p.warning_days||[60,30,15,7,1]).map(Number));
  document.querySelectorAll('#warningDays input').forEach(x=>x.checked=selected.has(Number(x.value)));
}

async function init(){
  ctx=await getOrganizationContext();if(!ctx)return;
  bindOrganizationLogout();
  const {organization}=ctx;
  document.getElementById('profileName').value=organization.display_name||organization.legal_name||organization.name||'';
  document.getElementById('profileEmail').value=organization.contact_email||organization.email||ctx.user.email||'';
  document.getElementById('profileAfm').value=organization.vat_number||organization.afm||'';
  document.getElementById('profileForm').addEventListener('submit',save);
  document.getElementById('togglePasswordFields')?.addEventListener('click',()=>document.getElementById('passwordFields')?.classList.toggle('hidden'));
  document.querySelectorAll('.password-toggle').forEach(b=>b.onclick=()=>{const i=document.getElementById(b.dataset.target);if(i)i.type=i.type==='password'?'text':'password'});
  await loadPreferences();
  const closureBtn=document.getElementById('requestClosureBtn');
  const closureStatus=document.getElementById('closureStatus');
  if(organization.status==='closure_requested'){
    if(closureStatus)closureStatus.textContent='Υπάρχει ενεργό αίτημα αποχώρησης. Ο λογαριασμός παραμένει διαθέσιμος μέχρι την ολοκλήρωση.';
    if(closureBtn){closureBtn.innerHTML='<i data-lucide="rotate-ccw"></i> Ακύρωση αιτήματος';closureBtn.dataset.mode='cancel';}
  }
  closureBtn?.addEventListener('click',handleClosure);
  window.lucide?.createIcons();
}

async function handleClosure(){
  const btn=document.getElementById('requestClosureBtn');
  if(btn?.dataset.mode==='cancel'){
    const ask=await Swal.fire({title:'Ακύρωση αιτήματος αποχώρησης;',text:'Ο οργανισμός θα παραμείνει ενεργός στο CertiTrack.',icon:'question',showCancelButton:true,confirmButtonText:'Ναι, ακύρωση',cancelButtonText:'Πίσω'});
    if(!ask.isConfirmed)return;
    try{await organizationService.cancelClosure(ctx.organization);await Swal.fire('Ακυρώθηκε','Το αίτημα αποχώρησης ακυρώθηκε.','success');location.reload();}catch(err){Swal.fire('Σφάλμα',err.message||'Η ενέργεια απέτυχε.','error');}
    return;
  }
  const ask=await Swal.fire({
    title:'Αίτημα αποχώρησης από το CertiTrack',
    html:'<p>Δεν θα γίνει άμεση διαγραφή δεδομένων. Οι συνεργασίες, τα πιστοποιητικά και το audit history θα διατηρηθούν μέχρι την ασφαλή ολοκλήρωση του κλεισίματος.</p>',
    input:'textarea',inputLabel:'Λόγος αποχώρησης (προαιρετικά)',inputPlaceholder:'Προαιρετική σημείωση...',
    icon:'warning',showCancelButton:true,confirmButtonText:'Υποβολή αιτήματος',cancelButtonText:'Ακύρωση',confirmButtonColor:'#b42318'
  });
  if(!ask.isConfirmed)return;
  try{await organizationService.requestClosure(ctx.organization,String(ask.value||'').trim());await Swal.fire('Το αίτημα καταχωρήθηκε','Ο οργανισμός δεν διαγράφεται άμεσα. Το αίτημα θα ολοκληρωθεί με ελεγχόμενη διαδικασία.','success');location.reload();}catch(err){Swal.fire('Σφάλμα',err.message||'Η ενέργεια απέτυχε.','error');}
}

async function save(e){
  e.preventDefault();
  const name=document.getElementById('profileName').value.trim();
  const email=document.getElementById('profileEmail').value.trim().toLowerCase();
  const password=document.getElementById('profilePassword').value;
  const confirm=document.getElementById('profilePasswordConfirm').value;
  if(password&&password!==confirm)return Swal.fire('Προσοχή','Οι κωδικοί δεν ταιριάζουν.','warning');
  if(password&&!validatePassword(password).valid)return Swal.fire('Ο κωδικός δεν είναι αρκετά ισχυρός',passwordPolicyMessage('el'),'warning');
  const days=warningDays();
  if(!days.length)return Swal.fire('Προσοχή','Επιλέξτε τουλάχιστον ένα χρονικό όριο ειδοποίησης λήξης.','warning');

  try{
    const orgUpdates=ctx.organization.source==='organizations'
      ? {display_name:name,contact_email:email}
      : {name,email};
    await organizationService.update(ctx.organization,orgUpdates);

    if(email!==ctx.user.email||password){
      const payload={};if(email!==ctx.user.email)payload.email=email;if(password)payload.password=password;
      const r=await authService.updateUser(payload);if(r.error)throw r.error;
    }

    await notificationService.savePreferences(ctx.organization.id,{
      in_app_enabled:document.getElementById('prefInApp').checked,
      email_enabled:document.getElementById('prefEmail').checked,
      expiry_notifications:document.getElementById('prefExpiryInApp').checked || document.getElementById('prefExpiryEmail').checked,
      warning_days:days,
      relationship_notifications:document.getElementById('prefRelationships').checked,
      certificate_change_notifications:document.getElementById('prefCertificateChanges').checked
    });

    await Swal.fire('Αποθηκεύτηκε','Οι ρυθμίσεις ενημερώθηκαν.','success');
  }catch(err){
    Swal.fire('Σφάλμα',err.message||'Η αποθήκευση απέτυχε.','error');
  }
}
init().catch(err=>Swal.fire('Σφάλμα',err.message||'Αποτυχία φόρτωσης','error'));
