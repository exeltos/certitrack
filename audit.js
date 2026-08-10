import { adminService } from '../../services/adminService.js';
import { requirePlatformAdmin, safeDate } from './adminCommon.js';
let rows=[];
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const demoRows=[
 {created_at:new Date().toISOString(),action:'update',entity_type:'certificates',organization:'MedSupply A.E.',details:'ISO 13485 renewed'},
 {created_at:new Date(Date.now()-3600000).toISOString(),action:'insert',entity_type:'organization_relationships',organization:'DEMO COMPANY S.A.',details:'Partner relationship created'},
 {created_at:new Date(Date.now()-7200000).toISOString(),action:'closure_requested',entity_type:'organization',organization:'CleanCare Services',details:'Organization closure requested'}
];
function details(x){
  if(typeof x.details==='string')return x.details;
  const meta=x.metadata||{},oldData=x.old_data||{},newData=x.new_data||{};
  const changed=Object.keys({...oldData,...newData}).filter(k=>JSON.stringify(oldData[k])!==JSON.stringify(newData[k])).filter(k=>!['updated_at'].includes(k));
  return changed.length?`Αλλαγές: ${changed.slice(0,8).join(', ')}`:(meta.reason?`Αιτιολογία: ${meta.reason}`:'—');
}
function render(){
  const q=(document.getElementById('auditSearch').value||'').toLowerCase(),type=document.getElementById('auditType').value;
  const out=rows.filter(x=>(type==='all'||String(x.entity_type||'').includes(type))&&[x.action,x.entity_type,x.organization,details(x)].some(v=>String(v||'').toLowerCase().includes(q)));
  document.getElementById('auditBody').innerHTML=out.map(x=>`<tr><td>${safeDate(x.created_at)}</td><td><strong>${esc(x.action||'—')}</strong></td><td>${esc(x.entity_type||'—')}</td><td>${esc(x.organization||'Platform')}</td><td><div class="ct-admin-audit-details">${esc(details(x))}</div></td></tr>`).join('')||'<tr><td colspan="5" class="ct-admin-empty">Δεν υπάρχουν audit records.</td></tr>';
}
async function init(){
  const guard=await requirePlatformAdmin();if(guard.denied)return;
  try{
    if(guard.demo)rows=demoRows;
    else{
      const [a,o]=await Promise.all([adminService.audit().select('*').order('created_at',{ascending:false}).limit(500),adminService.listOrganizations()]);
      if(a.error)throw a.error;
      const names=new Map((o.data||[]).map(x=>[x.id,x.display_name||x.legal_name||x.name||'Οργανισμός']));
      rows=(a.data||[]).map(x=>({...x,organization:x.organization_id?(names.get(x.organization_id)||'Οργανισμός'):'Platform'}));
    }
    render();
  }catch(err){console.error(err);document.getElementById('auditBody').innerHTML='<tr><td colspan="5" class="ct-admin-empty">Δεν ήταν δυνατή η φόρτωση του audit trail.</td></tr>';}
  document.getElementById('auditSearch')?.addEventListener('input',render);
  document.getElementById('auditType')?.addEventListener('change',render);
}
init();
