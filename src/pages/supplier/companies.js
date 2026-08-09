import { isDemo, exitDemo } from '../../demo/demoSession.js';
import { authService } from '../../services/authService.js';
import { supplierService } from '../../services/supplierService.js';
import { relationshipService } from '../../services/relationshipService.js';
import { companyService } from '../../services/companyService.js';
import { demoData } from '../../demo/demoData.js';
import { installDemoBanner, protectDemoWrites } from '../../demo/demoSession.js';

const state={companies:[]}; const $=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function render(){
  const q=$('companySearch').value.trim().toLowerCase(), filter=$('companyAccessFilter').value;
  const rows=state.companies.filter(c=>(!q||c.name.toLowerCase().includes(q)||String(c.afm||'').includes(q))&&(filter==='all'||c.access===filter));
  $('companyCount').textContent=`${rows.length} εταιρείες`;
  $('companiesList').innerHTML=rows.length?rows.map(c=>`<article class="ct-company-row"><div class="ct-company-avatar">${esc(c.name.slice(0,2).toUpperCase())}</div><div class="ct-company-row__main"><strong>${esc(c.name)}</strong><span>ΑΦΜ ${esc(c.afm||'—')}</span></div><span class="ct-status ct-status--${c.access==='blocked'?'danger':'success'}">${c.access==='blocked'?'Αποκλεισμένη':'Πρόσβαση ενεργή'}</span><button class="ct-btn ${c.access==='blocked'?'ct-btn-secondary':'ct-btn-danger'} ct-btn-sm" data-company="${c.id}" data-access="${c.access}">${c.access==='blocked'?'Επαναφορά':'Αποκλεισμός'}</button></article>`).join(''):'<div class="ct-empty-state"><i data-lucide="building-2"></i><strong>Δεν βρέθηκαν εταιρείες</strong></div>';
  $('companiesList').querySelectorAll('[data-company]').forEach(btn=>btn.addEventListener('click',()=>toggleAccess(btn)));
  window.lucide?.createIcons();
}
async function toggleAccess(btn){
  if(isDemo('supplier')) return protectDemoWrites();
  const blocked=btn.dataset.access==='blocked', next=blocked?'granted':'blocked';
  const result=await Swal.fire({title:blocked?'Επαναφορά πρόσβασης':'Αποκλεισμός εταιρείας',text:blocked?'Η εταιρεία θα μπορεί ξανά να βλέπει τα κοινόχρηστα πιστοποιητικά σας.':'Η εταιρεία δεν θα μπορεί να βλέπει τα κοινόχρηστα πιστοποιητικά σας.',icon:'warning',showCancelButton:true,confirmButtonText:blocked?'Επαναφορά':'Αποκλεισμός',cancelButtonText:'Ακύρωση'});
  if(!result.isConfirmed)return;
  const item=state.companies.find(c=>String(c.id)===String(btn.dataset.company)); if(!item)return;
  const {error}=await relationshipService.table().update({access:next}).eq('company_id',item.id).eq('supplier_id',item.supplierId);
  if(error)return Swal.fire('Σφάλμα','Η αλλαγή δεν αποθηκεύτηκε.','error'); item.access=next; render();
}
async function init(){
  $('companySearch').addEventListener('input',render); $('companyAccessFilter').addEventListener('change',render);
  if(isDemo('supplier')){installDemoBanner('supplier');state.companies=demoData.supplier.companies.map(c=>({...c,supplierId:'demo-supplier'}));$('logoutBtn')?.addEventListener('click',exitDemo);render();return;}
  const {data:{session}}=await authService.getSession(); if(!session){location.href='/pages/auth/login.html';return;}
  const {data:supplier}=await supplierService.table().select('id').eq('user_id',session.user.id).maybeSingle(); if(!supplier){render();return;}
  const {data:rels,error}=await relationshipService.table().select('company_id,access').eq('supplier_id',supplier.id); if(error)throw error;
  const ids=(rels||[]).map(r=>r.company_id); if(ids.length){const {data:companies,error:e}=await companyService.table().select('id,name,afm').in('id',ids);if(e)throw e;state.companies=(companies||[]).map(c=>({...c,supplierId:supplier.id,access:rels.find(r=>r.company_id===c.id)?.access||'granted'}));}
  $('logoutBtn')?.addEventListener('click',async()=>{await authService.signOut();location.href='/index.html';}); render();
}
init().catch(err=>{console.error(err);$('companiesList').innerHTML='<div class="ct-empty-state">Δεν ήταν δυνατή η φόρτωση των εταιρειών.</div>';});
