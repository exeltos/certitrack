import { isDemo, exitDemo } from '../../demo/demoSession.js';
import { authService } from '../../services/authService.js';
import { companyService } from '../../services/companyService.js';
import { relationshipService } from '../../services/relationshipService.js';
import { certificateService } from '../../services/certificateService.js';
import { daysUntil } from '../../core/certificateCore.js';
import { demoData } from '../../demo/demoData.js';
import { installDemoBanner } from '../../demo/demoSession.js';

const $ = id => document.getElementById(id);
const safe = value => String(value ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));

function statusBadge(kind, text){ return `<span class="ct-status ct-status--${kind}">${text}</span>`; }
function setKpis({suppliers=0, compliant=0, soon=0, expired=0}){
  $('kpiSuppliers').textContent=suppliers; $('kpiCompliant').textContent=compliant; $('kpiSoon').textContent=soon; $('kpiExpired').textContent=expired;
  const score=suppliers ? Math.round((compliant/suppliers)*100) : 100;
  if($('healthScore')) $('healthScore').textContent=score;
  if($('healthLabel')) $('healthLabel').textContent=score>=85?'Πολύ καλή εικόνα':score>=65?'Χρειάζεται παρακολούθηση':'Χρειάζεται ενέργεια';
  if($('healthHint')) $('healthHint').textContent=suppliers?`${compliant} από ${suppliers} προμηθευτές χωρίς άμεση εκκρεμότητα`:'Δεν υπάρχουν ενεργοί προμηθευτές';
}
function renderAttention(rows){
  const el=$('attentionList');
  if(!rows.length){el.innerHTML='<div class="ct-empty-state"><i data-lucide="circle-check-big"></i><strong>Δεν υπάρχουν επείγουσες εκκρεμότητες</strong><span>Οι προμηθευτές σας δεν έχουν ληγμένα ή άμεσα λήγοντα πιστοποιητικά.</span></div>'; return;}
  el.innerHTML=rows.slice(0,6).map(r=>`<a class="ct-attention-row" href="${String(r.id).startsWith('demo&demoSupplier=') ? '/pages/company/supplier.html?' + r.id : '/pages/company/supplier.html?id=' + encodeURIComponent(r.id)}"><div class="ct-attention-row__main"><strong>${safe(r.name)}</strong><span>ΑΦΜ ${safe(r.afm||'—')} · ${r.total} πιστοποιητικά</span></div><div class="ct-attention-row__status">${r.expired?statusBadge('danger',`${r.expired} ληγμένα`):statusBadge('warning',`${r.soon} προς λήξη`)}<i data-lucide="chevron-right"></i></div></a>`).join('');
}

function renderActivity(items=[]){
  const el=$('activityList'); if(!el) return;
  if(!items.length){el.innerHTML='<div class="ct-empty-state">Δεν υπάρχει πρόσφατη δραστηριότητα.</div>';return;}
  const icon={success:'circle-check',warning:'clock-3',danger:'triangle-alert',info:'file-up'};
  el.innerHTML=items.slice(0,8).map(x=>`<article class="ct-activity-row"><div class="ct-activity-row__icon ct-activity-row__icon--${safe(x.kind||'info')}"><i data-lucide="${icon[x.kind]||icon.info}"></i></div><div><strong>${safe(x.text)}</strong><span>${safe(x.time||'')}</span></div></article>`).join('');
}

function demo(){
  installDemoBanner('company');
  const d=demoData.company;
  setKpis({suppliers:d.stats.suppliers,compliant:d.stats.compliant,soon:d.stats.expiring,expired:d.stats.expired});
  renderAttention(d.suppliers.map((s,index)=>({s,index})).filter(x=>x.s.expired||x.s.expiring).map(({s,index})=>({id:`demo&demoSupplier=${index}`,name:s.name,afm:s.afm,total:s.certs,expired:s.expired,soon:s.expiring})));
  renderActivity(d.activity||[]);
  $('logoutBtn')?.addEventListener('click', exitDemo);
  window.lucide?.createIcons();
}
async function init(){
  if(isDemo('company')) return demo();
  const {data:{session}}=await authService.getSession();
  if(!session){location.href='/pages/auth/login.html';return;}
  const {data:company,error}=await companyService.table().select('id').eq('email',session.user.email).single();
  if(error||!company){location.href='/pages/auth/login.html';return;}
  const {data:links}=await relationshipService.table().select('supplier_id, suppliers(id,name,afm,user_id)').eq('company_id',company.id);
  const rows=[]; let soonTotal=0, expiredTotal=0, compliant=0;
  for(const link of links||[]){
    const s=link.suppliers; if(!s) continue;
    let certs=[];
    if(s.user_id){ const res=await certificateService.supplier().select('date').eq('supplier_user_id',s.user_id); certs=res.data||[]; }
    let soon=0,expired=0;
    for(const c of certs){const d=daysUntil(c.date,new Date()); if(d<0)expired++; else if(d<=30)soon++;}
    soonTotal+=soon; expiredTotal+=expired; if(expired===0&&soon===0)compliant++;
    rows.push({id:s.id,name:s.name,afm:s.afm,total:certs.length,soon,expired});
  }
  rows.sort((a,b)=>(b.expired-a.expired)||(b.soon-a.soon));
  setKpis({suppliers:rows.length,compliant,soon:soonTotal,expired:expiredTotal});
  renderAttention(rows.filter(r=>r.expired||r.soon));
  renderActivity(rows.filter(r=>r.expired||r.soon).slice(0,6).map(r=>({text:r.expired?`${r.name} έχει ${r.expired} ληγμένα πιστοποιητικά`:`${r.name} έχει ${r.soon} πιστοποιητικά προς λήξη`,time:'Τρέχουσα κατάσταση',kind:r.expired?'danger':'warning'})));
  $('logoutBtn')?.addEventListener('click', async()=>{await authService.signOut();location.href='/index.html';});
  window.lucide?.createIcons();
}
init().catch(err=>{console.error(err);$('attentionList').innerHTML='<div class="ct-empty-state">Δεν ήταν δυνατή η φόρτωση της επισκόπησης.</div>';});
