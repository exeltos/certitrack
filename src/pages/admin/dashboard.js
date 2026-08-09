import { demoData } from '../../demo/demoData.js';
import { adminService } from '../../services/adminService.js';
import { requirePlatformAdmin, statusKey, statusLabel, initials } from './adminCommon.js';

function renderStats(stats){
  const items=[['Εταιρείες',stats.companies||0,'building-2'],['Προμηθευτές',stats.suppliers||0,'users'],['Σχέσεις συνεργασίας',stats.relationships||0,'link-2'],['Πιστοποιητικά',stats.certificates||0,'badge-check']];
  document.getElementById('adminStats').innerHTML=items.map(([label,value,icon])=>`<article class="ct-admin-kpi"><div class="ct-admin-kpi__label"><i data-lucide="${icon}" style="width:14px;height:14px;vertical-align:-2px;margin-right:6px"></i>${label}</div><div class="ct-admin-kpi__value">${value}</div><div class="ct-admin-kpi__meta">Στην πλατφόρμα</div></article>`).join('');
}
function renderOrganizations(rows){
  const mount=document.getElementById('recentOrganizations');
  mount.innerHTML=rows.slice(0,7).map(o=>{const key=statusKey(o);return `<div class="ct-admin-list__row"><div class="ct-admin-org"><div class="ct-admin-avatar">${initials(o.name)}</div><div><strong>${o.name||'—'}</strong><small>${o.type==='company'||o.role==='Εταιρεία'?'Εταιρεία':'Προμηθευτής'} · ${o.afm||'—'}</small></div></div><span class="ct-admin-status ct-admin-status--${key}">${statusLabel(key)}</span></div>`}).join('') || '<div class="ct-admin-empty">Δεν υπάρχουν οργανισμοί.</div>';
}
function renderAudit(rows){
  const mount=document.getElementById('recentAudit');
  mount.innerHTML=rows.slice(0,6).map(x=>`<div class="ct-admin-activity__item"><strong>${x.action}</strong><p>${x.organization||x.entity||'Platform'} · ${x.when||'—'}</p></div>`).join('') || '<div class="ct-admin-empty">Δεν υπάρχει πρόσφατη δραστηριότητα.</div>';
}
async function loadReal(){
  const [c,s,r,cc,sc,a]=await Promise.all([adminService.companies().select('*'),adminService.suppliers().select('*'),adminService.relationships().select('id'),adminService.companyCertificates().select('id'),adminService.supplierCertificates().select('id'),adminService.audit().select('*').order('created_at',{ascending:false}).limit(8)]);
  const firstError=[c,s,r,cc,sc,a].find(x=>x.error)?.error;
  if(firstError) throw firstError;
  const organizations=[...(c.data||[]).map(x=>({...x,type:'company'})),...(s.data||[]).map(x=>({...x,type:'supplier'}))].sort((a,b)=>new Date(b.created_at||b.timestamp||0)-new Date(a.created_at||a.timestamp||0));
  const audit=(a.data||[]).map(x=>({action:x.action||'Activity',entity:x.entity_type,organization:x.company_id?'Company':x.supplier_id?'Supplier':'Platform',when:new Date(x.created_at).toLocaleString()}));
  return {stats:{companies:c.data?.length||0,suppliers:s.data?.length||0,relationships:r.data?.length||0,certificates:(cc.data?.length||0)+(sc.data?.length||0)},organizations,audit};
}
async function init(){
  const guard=await requirePlatformAdmin(); if(guard.denied)return;
  try{
    if(guard.demo){
      const d=demoData.admin; const orgs=(d.organizations||[]).map((x,i)=>({...x,type:x.type==='Εταιρεία'?'company':'supplier',afm:`09990${String(i+1).padStart(4,'0')}`}));
      renderStats({companies:d.stats.companies,suppliers:d.stats.suppliers,relationships:87,certificates:438}); renderOrganizations(orgs); renderAudit([{action:'Ανανέωση πιστοποιητικού',organization:'MedSupply A.E.',when:'Πριν 18 λεπτά'},{action:'Νέα σχέση συνεργασίας',organization:'CleanCare Services',when:'Σήμερα'},{action:'Αλλαγή ορατότητας εγγράφου',organization:'BioLab Solutions',when:'Σήμερα'},{action:'Νέος λογαριασμός',organization:'Demo Industrial S.A.',when:'Χθες'}]);
    } else { const data=await loadReal();renderStats(data.stats);renderOrganizations(data.organizations);renderAudit(data.audit); }
  }catch(err){console.error(err);document.getElementById('recentOrganizations').innerHTML='<div class="ct-admin-empty">Η admin πρόσβαση στα tenant δεδομένα δεν είναι ακόμη ενεργοποιημένη από RLS. Θα την ελέγξουμε στο επόμενο στάδιο της βάσης.</div>';renderStats({});renderAudit([]);}
  window.lucide?.createIcons();
}
init();
