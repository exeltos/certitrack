import { isDemo, exitDemo, installDemoBanner } from '../../demo/demoSession.js';
import { demoData } from '../../demo/demoData.js';
import { authService } from '../../services/authService.js';
import { companyService } from '../../services/companyService.js';
import { relationshipService } from '../../services/relationshipService.js';
import { supplierService } from '../../services/supplierService.js';
import { complianceService } from '../../services/complianceService.js';
import { daysUntil, escapeHtml } from '../../core/certificateCore.js';

const state = { rows: [], types: [], profiles: [], profileItems: [], requirements: [], company: null };
const $ = id => document.getElementById(id);

const DEMO_PROFILES = [
  { id:'p-medical', name:'Ιατροτεχνολογικός προμηθευτής', types:['ISO 9001','ISO 13485','CE'] },
  { id:'p-services', name:'Υπηρεσίες / Outsourcing', types:['ISO 9001','ISO 14001','ISO 45001'] },
  { id:'p-general', name:'Γενικός προμηθευτής', types:['ISO 9001','Ασφαλιστική ενημερότητα'] }
];

function statusMeta(row){
  if(!row.required) return { key:'unconfigured', label:'Χωρίς απαιτήσεις', cls:'neutral' };
  if(row.expired>0) return { key:'critical', label:'Μη συμμορφωμένος', cls:'danger' };
  if(row.missing>0) return { key:'missing', label:'Με ελλείψεις', cls:'danger' };
  if(row.soon>0) return { key:'soon', label:'Προς λήξη', cls:'warning' };
  return { key:'compliant', label:'Συμμορφωμένος', cls:'success' };
}

function updateKpis(rows){
  const counts={compliant:0,missing:0,soon:0,critical:0,unconfigured:0};
  rows.forEach(r=>counts[statusMeta(r).key]++);
  $('compOk').textContent=counts.compliant;
  $('compMissing').textContent=counts.missing;
  $('compSoon').textContent=counts.soon;
  $('compCritical').textContent=counts.critical;
}

function render(){
  const q=($('complianceSearch')?.value||'').trim().toLowerCase();
  const filter=$('complianceFilter')?.value||'all';
  const rows=state.rows.filter(r=>{
    const hit=`${r.name} ${r.afm||''}`.toLowerCase().includes(q);
    const kind=statusMeta(r).key;
    return hit && (filter==='all'||filter===kind);
  });
  $('complianceCount').textContent=`${rows.length} προμηθευτές`;
  const body=$('complianceRows');
  if(!rows.length){body.innerHTML='<tr><td colspan="7" class="ct-table-empty">Δεν υπάρχουν αποτελέσματα.</td></tr>';return;}
  body.innerHTML=rows.map(r=>{
    const s=statusMeta(r);
    const pct=r.required ? Math.round((r.covered/r.required)*100) : 100;
    return `<tr>
      <td><div class="ct-table-primary"><strong>${escapeHtml(r.name)}</strong><span>ΑΦΜ ${escapeHtml(r.afm||'—')}</span></div></td>
      <td>${escapeHtml(r.profile||'Χωρίς πρότυπο')}</td>
      <td><div class="ct-coverage"><span>${r.covered}/${r.required}</span><div><i style="width:${Math.max(4,pct)}%"></i></div></div></td>
      <td>${r.missing ? `<span class="ct-status ct-status--danger">${r.missing}</span>` : '<span class="ct-muted-dash">—</span>'}</td>
      <td>${r.expired ? `<span class="ct-status ct-status--danger">${r.expired} ληγμένα</span>` : r.soon ? `<span class="ct-status ct-status--warning">${r.soon} προς λήξη</span>` : '<span class="ct-muted-dash">—</span>'}</td>
      <td><span class="ct-status ct-status--${s.cls}">${s.label}</span></td>
      <td class="ct-table-actions"><button class="ct-row-action requirement-edit" data-id="${escapeHtml(r.id)}" title="Απαιτήσεις"><i data-lucide="sliders-horizontal"></i></button><a class="ct-row-action" href="/pages/company/supplier.html?${String(r.id).startsWith('demo')?'demo&demoSupplier='+r.demoIndex:'id='+encodeURIComponent(r.id)}" title="Προβολή"><i data-lucide="chevron-right"></i></a></td>
    </tr>`;
  }).join('');
  body.querySelectorAll('.requirement-edit').forEach(btn=>btn.addEventListener('click',()=>openSupplierRequirements(btn.dataset.id)));
  window.lucide?.createIcons();
}

function demoRows(){
  const suppliers=demoData.company.suppliers;
  return suppliers.map((s,index)=>{
    const profile=index%3===0?DEMO_PROFILES[0]:index%3===1?DEMO_PROFILES[1]:DEMO_PROFILES[2];
    const required=profile.types.length;
    const missing=Math.min(s.missing||0,required);
    const expired=Math.min(s.expired||0,Math.max(0,required-missing));
    const soon=Math.min(s.expiring||0,Math.max(0,required-missing-expired));
    const covered=Math.max(0,required-missing);
    return {id:`demo-${index}`,demoIndex:index,name:s.name,afm:s.afm,profile:profile.name,profileId:profile.id,required,covered,missing,expired,soon,requiredTypes:profile.types};
  });
}

async function openSupplierRequirements(id){
  const row=state.rows.find(r=>r.id===id);
  if(!row) return;
  if(isDemo('company')){
    await Swal.fire({title:'Απαιτήσεις προμηθευτή',html:`<div class="ct-swal-list"><strong>${escapeHtml(row.name)}</strong><span>${escapeHtml(row.profile)}</span>${row.requiredTypes.map(x=>`<label><input type="checkbox" checked disabled> ${escapeHtml(x)}</label>`).join('')}<small>Στο demo οι αλλαγές δεν αποθηκεύονται.</small></div>`,confirmButtonText:'Κλείσιμο'});
    return;
  }
  if(!state.profiles.length){ await Swal.fire('Δεν υπάρχουν πρότυπα','Δημιουργήστε πρώτα ένα πρότυπο απαιτήσεων.','info'); return; }
  const options=state.profiles.map(p=>`<option value="${p.id}" ${p.id===row.profileId?'selected':''}>${escapeHtml(p.name)}</option>`).join('');
  const result=await Swal.fire({title:`Απαιτήσεις · ${escapeHtml(row.name)}`,html:`<select id="ct-profile-select" class="swal2-select"><option value="">Χωρίς πρότυπο</option>${options}</select>`,showCancelButton:true,confirmButtonText:'Αποθήκευση',cancelButtonText:'Ακύρωση',preConfirm:()=>document.getElementById('ct-profile-select').value});
  if(!result.isConfirmed) return;
  const profileId=result.value||null;
  const typeIds=profileId?state.profileItems.filter(x=>x.profile_id===profileId&&x.required).map(x=>x.certificate_type_id):[];
  const {error}=await complianceService.assignProfile(state.company.id,row.id,profileId,typeIds);
  if(error) return Swal.fire('Σφάλμα',error.message,'error');
  await loadReal();
  Swal.fire('Αποθηκεύτηκε','Οι απαιτήσεις ενημερώθηκαν.','success');
}

async function openProfiles(){
  if(isDemo('company')){
    await Swal.fire({title:'Πρότυπα απαιτήσεων',width:620,html:`<div class="ct-profile-demo">${DEMO_PROFILES.map(p=>`<article><strong>${escapeHtml(p.name)}</strong><span>${p.types.map(escapeHtml).join(' · ')}</span></article>`).join('')}</div>`,confirmButtonText:'Κλείσιμο'});return;
  }
  const types=state.types;
  if(!types.length){ Swal.fire('Δεν υπάρχουν τύποι πιστοποιητικών','','info');return; }
  const {value}=await Swal.fire({title:'Νέο πρότυπο απαιτήσεων',width:680,html:`<input id="profile-name" class="swal2-input" placeholder="π.χ. Ιατροτεχνολογικός προμηθευτής"><div class="ct-swal-checkgrid">${types.map(t=>`<label><input type="checkbox" value="${t.id}"> ${escapeHtml(t.name)}</label>`).join('')}</div>`,showCancelButton:true,confirmButtonText:'Δημιουργία',cancelButtonText:'Ακύρωση',preConfirm:()=>{const name=document.getElementById('profile-name').value.trim();const ids=[...document.querySelectorAll('.ct-swal-checkgrid input:checked')].map(x=>x.value);if(!name||!ids.length){Swal.showValidationMessage('Συμπληρώστε όνομα και τουλάχιστον μία απαίτηση.');return false;}return{name,ids};}});
  if(!value) return;
  const created=await complianceService.createProfile(state.company.id,value.name);
  if(created.error) return Swal.fire('Σφάλμα',created.error.message,'error');
  const items=await complianceService.replaceProfileItems(created.data.id,value.ids);
  if(items.error) return Swal.fire('Σφάλμα',items.error.message,'error');
  await loadReal();
  Swal.fire('Έτοιμο','Το πρότυπο απαιτήσεων δημιουργήθηκε.','success');
}

async function loadReal(){
  const {data:{session}}=await authService.getSession();
  if(!session){location.href='/pages/auth/login.html';return;}
  let comp=await companyService.getByUserId(session.user.id,'id,name,afm,user_id,email');
  if(!comp.data) comp=await companyService.getByEmail(session.user.email,'id,name,afm,user_id,email');
  if(comp.error||!comp.data){location.href='/pages/auth/login.html';return;}
  state.company=comp.data;

  const [typesRes,profilesRes,linksRes,reqRes]=await Promise.all([
    complianceService.listCertificateTypes(),
    complianceService.listProfiles(comp.data.id),
    relationshipService.listForCompany(comp.data.id,'supplier_id,suppliers(id,name,afm,user_id)'),
    complianceService.listSupplierRequirements(comp.data.id)
  ]);
  state.types=typesRes.data||[]; state.profiles=profilesRes.data||[]; state.requirements=reqRes.data||[];
  const itemsRes=await complianceService.listProfileItems(state.profiles.map(x=>x.id)); state.profileItems=itemsRes.data||[];
  const profileMap=new Map(state.profiles.map(p=>[p.id,p]));
  const typeMap=new Map(state.types.map(t=>[t.id,t]));
  const rows=[];
  for(const link of linksRes.data||[]){
    const s=link.suppliers;if(!s)continue;
    const reqs=state.requirements.filter(r=>r.supplier_id===s.id&&r.required);
    const profileId=reqs.find(x=>x.profile_id)?.profile_id||null;
    let certs=[];
    if(s.user_id){const c=await supplierService.listCertificatesByUser(s.user_id,'id,date,certificate_type_id,type,is_private');certs=(c.data||[]).filter(x=>x.is_private!==true);}
    let covered=0,missing=0,expired=0,soon=0;
    for(const req of reqs){
      const t=typeMap.get(req.certificate_type_id);
      const matches=certs.filter(c=>c.certificate_type_id===req.certificate_type_id || (!c.certificate_type_id&&t&&String(c.type||'').toLowerCase().includes(String(t.name).toLowerCase())));
      if(!matches.length){missing++;continue;}
      const best=matches.sort((a,b)=>new Date(b.date||0)-new Date(a.date||0))[0]; covered++;
      if(best.date){const d=daysUntil(best.date,new Date());if(d<0)expired++;else if(d<=30)soon++;}
    }
    rows.push({id:s.id,name:s.name,afm:s.afm,profileId,profile:profileMap.get(profileId)?.name||'Χωρίς πρότυπο',required:reqs.length,covered,missing,expired,soon});
  }
  state.rows=rows;
  updateKpis(rows);render();
}

function init(){
  $('complianceSearch')?.addEventListener('input',render);
  $('complianceFilter')?.addEventListener('change',render);
  $('profilesBtn')?.addEventListener('click',openProfiles);
  if(isDemo('company')){
    installDemoBanner('company');
    state.rows=demoRows();updateKpis(state.rows);render();
    $('logoutBtn')?.addEventListener('click',exitDemo);
    return;
  }
  loadReal().catch(err=>{console.error(err);$('complianceRows').innerHTML='<tr><td colspan="7" class="ct-table-empty">Δεν ήταν δυνατή η φόρτωση της συμμόρφωσης.</td></tr>';});
}

init();
