import { demoData } from '../../demo/demoData.js';
import { adminService } from '../../services/adminService.js';
import { requirePlatformAdmin, safeDate, initials } from './adminCommon.js';

let rows=[],guard;
const safe=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function key(o){
  if(o.status==='closed')return'closed';
  if(o.status==='closure_requested')return'closure_requested';
  if(o.status==='suspended'||o.blocked)return'blocked';
  if(o.status==='pending_verification'||o.status==='pending')return'pending';
  return'active';
}
function label(k){return({active:'Ενεργός',pending:'Εκκρεμής',blocked:'Σε αναστολή',closure_requested:'Αίτημα αποχώρησης',closed:'Κλειστός'})[k]||k;}
function canonical(o){return {id:o.id,name:o.display_name||o.legal_name||o.name||'—',afm:o.vat_number||o.afm||'—',email:o.contact_email||o.email||'—',status:o.status,blocked:o.blocked,created_at:o.created_at,closure_reason:o.closure_reason||''};}

function rowHtml(raw){
  const o=canonical(raw),k=key(o);
  const stateAction=k==='blocked'
    ? `<button class="ct-icon-btn" type="button" data-state="active" data-id="${safe(o.id)}" title="Επαναφορά"><i data-lucide="rotate-ccw"></i></button>`
    : k==='closed'?''
    : `<button class="ct-icon-btn" type="button" data-state="suspended" data-id="${safe(o.id)}" title="Αναστολή"><i data-lucide="ban"></i></button>`;
  const closeAction=k==='closure_requested'
    ? `<button class="ct-icon-btn ct-icon-btn--danger" type="button" data-state="closed" data-id="${safe(o.id)}" title="Ολοκλήρωση αποχώρησης"><i data-lucide="door-closed"></i></button>`
    :'';
  return `<tr><td><div class="ct-admin-org"><div class="ct-admin-avatar">${initials(o.name)}</div><div><strong>${safe(o.name)}</strong><small>${safe(o.email)}</small></div></div></td><td>${safe(o.afm)}</td><td>${safe(o.email)}</td><td><span class="ct-admin-status ct-admin-status--${k}">${label(k)}</span></td><td>${safeDate(o.created_at)}</td><td><div class="ct-admin-actions"><button class="ct-icon-btn" type="button" data-view="${safe(o.id)}" title="Προβολή"><i data-lucide="eye"></i></button>${stateAction}${closeAction}</div></td></tr>`;
}
function render(){
  const q=(document.getElementById('orgSearch').value||'').toLowerCase(),status=document.getElementById('orgStatus').value;
  const out=rows.filter(raw=>{const o=canonical(raw);return(status==='all'||key(o)===status)&&[o.name,o.afm,o.email].some(v=>String(v||'').toLowerCase().includes(q));});
  document.getElementById('organizationsBody').innerHTML=out.map(rowHtml).join('')||'<tr><td colspan="6" class="ct-admin-empty">Δεν βρέθηκαν οργανισμοί.</td></tr>';
  window.lucide?.createIcons();
}
async function changeState(id,state){
  if(guard.demo)return Swal.fire('Demo','Η αλλαγή κατάστασης είναι απενεργοποιημένη στο demo.','info');
  const raw=rows.find(x=>String(x.id)===String(id));const o=canonical(raw||{});
  const isClose=state==='closed',isSuspend=state==='suspended';
  const ask=await Swal.fire({
    title:isClose?'Ολοκλήρωση αποχώρησης;':isSuspend?'Αναστολή οργανισμού;':'Επαναφορά οργανισμού;',
    text:isClose?'Ο οργανισμός θα κλείσει, οι ενεργές σχέσεις θα λήξουν και τα δεδομένα θα διατηρηθούν για audit.':isSuspend?'Η πρόσβαση του οργανισμού πρέπει να θεωρείται προσωρινά ανασταλμένη.':'Ο οργανισμός θα επανέλθει σε ενεργή κατάσταση.',
    input:(isClose||isSuspend)?'textarea':undefined,inputLabel:(isClose||isSuspend)?'Αιτιολογία':undefined,
    icon:isClose||isSuspend?'warning':'question',showCancelButton:true,confirmButtonText:'Επιβεβαίωση',cancelButtonText:'Ακύρωση'
  });
  if(!ask.isConfirmed)return;
  const r=await adminService.setOrganizationState(id,state,String(ask.value||'').trim());
  if(r.error)return Swal.fire('Σφάλμα',r.error.message||'Η αλλαγή απέτυχε.','error');
  await load();
  Swal.fire('Ολοκληρώθηκε',`${o.name}: ${label(state==='suspended'?'blocked':state)}`,'success');
}
async function load(){const res=await adminService.listOrganizations();if(res.error)throw res.error;rows=res.data||[];render();}
async function init(){
  guard=await requirePlatformAdmin();if(guard.denied)return;
  try{
    if(guard.demo)rows=demoData.admin.organizations.map((x,i)=>({id:`demo-${i}`,name:x.name,afm:`09990${String(i+1).padStart(4,'0')}`,email:`demo${i+1}@certitrack.gr`,status:x.status,blocked:x.status==='blocked',created_at:new Date(Date.now()-i*86400000*9).toISOString()}));
    else await load();
    render();
  }catch(err){console.error(err);document.getElementById('organizationsBody').innerHTML='<tr><td colspan="6" class="ct-admin-empty">Δεν ήταν δυνατή η φόρτωση οργανισμών.</td></tr>';}
  ['orgSearch','orgStatus'].forEach(id=>document.getElementById(id)?.addEventListener(id==='orgSearch'?'input':'change',render));
  document.addEventListener('click',async e=>{
    const state=e.target.closest('[data-state]');if(state)return changeState(state.dataset.id,state.dataset.state);
    const view=e.target.closest('[data-view]');if(view){const o=canonical(rows.find(x=>String(x.id)===String(view.dataset.view))||{});Swal.fire({title:o.name,html:`<div class="ct-swal-copy"><p><strong>ΑΦΜ:</strong> ${safe(o.afm)}</p><p><strong>Email:</strong> ${safe(o.email)}</p><p><strong>Κατάσταση:</strong> ${safe(label(key(o)))}</p>${o.closure_reason?`<p><strong>Λόγος αποχώρησης:</strong> ${safe(o.closure_reason)}</p>`:''}</div>`,confirmButtonText:'Κλείσιμο'});}
  });
}
init();
