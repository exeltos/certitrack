import { getOrganizationContext, bindOrganizationLogout } from './guard.js';
import { organizationService } from '../../services/organizationService.js';
import { escapeHtml, statusBadge } from '../../components/uiPrimitives.js';
const safe=escapeHtml;

function initials(name=''){return String(name).trim().split(/\s+/).filter(Boolean).map(x=>x[0]).join('').slice(0,2).toUpperCase()||'—';}
function certState(date){if(!date)return'missing';const d=Math.ceil((new Date(date)-new Date())/86400000);return d<0?'expired':d<=30?'expiring':'valid';}

async function complianceFor(ctx,relation){
  const requirements=await organizationService.listRelationshipRequirements(ctx.organization,relation.id);
  // Requirements relevant to this partner are those the partner is required to provide.
  const required=requirements.filter(x=>String(x.required_from_organization_id)===String(relation.partner?.id));
  if(!required.length)return {required:0,covered:0,missing:0,attention:0,score:null};
  const certs=await organizationService.listSharedCertificates(relation.partner);
  let covered=0,attention=0;
  for(const req of required){
    const matches=certs.filter(c=>String(c.certificate_type_id)===String(req.certificate_type_id));
    if(matches.some(c=>certState(c.date)==='valid'))covered++;
    else if(matches.some(c=>certState(c.date)==='expiring')){covered++;attention++;}
  }
  return {required:required.length,covered,missing:required.length-covered,attention,score:Math.round(covered/required.length*100)};
}

function complianceBadge(c){
  if(c.score===null)return statusBadge('neutral','Χωρίς απαιτήσεις');
  if(c.missing>0)return statusBadge('danger',`${c.missing} ελλείψεις`);
  if(c.attention>0)return statusBadge('warning','Χρειάζεται προσοχή');
  return statusBadge('success','Συμμορφωμένος');
}
function row(r,c){
  const p=r.partner||{};
  const detail=c.score===null?'Δεν έχουν οριστεί ακόμη απαιτήσεις πιστοποιητικών για αυτή τη συνεργασία.':`${c.covered} από ${c.required} απαιτήσεις καλύπτονται`;
  return `<article class="ct-compliance-partner ct-company-row--clickable" data-relation="${safe(r.id)}" tabindex="0" role="link">
    <div class="ct-compliance-partner__avatar">${safe(initials(p.name))}</div>
    <div class="ct-compliance-partner__identity"><strong>${safe(p.name||'Χωρίς επωνυμία')}</strong><span>${p.afm?`ΑΦΜ ${safe(p.afm)}`:'ΑΦΜ —'}${p.email?` · ${safe(p.email)}`:''}</span><small>${safe(detail)}</small></div>
    <div class="ct-compliance-partner__status">${complianceBadge(c)}${c.score!==null?`<span class="ct-compliance-score">${c.score}%</span>`:''}</div>
    <i class="ct-company-row__chevron" data-lucide="chevron-right"></i>
  </article>`;
}
async function init(){
  const ctx=await getOrganizationContext();if(!ctx)return;bindOrganizationLogout();
  const all=await organizationService.listPartners(ctx.organization);
  const partners=all.filter(r=>r.status==='active'&&r.partner?.id);
  const summaries=await Promise.all(partners.map(r=>complianceFor(ctx,r).catch(()=>({required:0,covered:0,missing:0,attention:0,score:null}))));
  document.getElementById('complianceCount').textContent=`${partners.length} ${partners.length===1?'συνεργάτης':'συνεργάτες'}`;
  document.getElementById('complianceList').innerHTML=partners.length?partners.map((r,i)=>row(r,summaries[i])).join(''):`<div class="ct-empty-state"><i data-lucide="shield-check"></i><strong>Δεν υπάρχουν ενεργές συνεργασίες</strong><span>Μόλις ενεργοποιηθεί μια συνεργασία, θα εμφανιστεί εδώ για αξιολόγηση συμμόρφωσης.</span></div>`;
  document.querySelectorAll('[data-relation]').forEach(el=>{const go=()=>location.href=`./partner.html?relation=${encodeURIComponent(el.dataset.relation)}`;el.onclick=go;el.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();go();}};});
  window.lucide?.createIcons();
}
init().catch(e=>Swal.fire('Σφάλμα',e.message||'Αποτυχία φόρτωσης','error'));
