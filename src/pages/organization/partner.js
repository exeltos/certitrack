import { getOrganizationContext, bindOrganizationLogout } from './guard.js';
import { organizationService } from '../../services/organizationService.js';
import { mountCertificatePageChrome, renderCertificateCollection, bindCertificateStats } from '../../components/certificateUi.js';
import { openCertificatePreview } from '../../core/certificateStorage.js';
import { escapeHtml, statusBadge } from '../../components/uiPrimitives.js';
import { handleError } from '../../shared/common.js';

let ctx, relation, certificates=[];
function relationLabel(){if(relation.status==='pending')return relation.direction==='incoming'?'Εκκρεμεί η αποδοχή σας':'Αναμονή αποδοχής';if(relation.status==='rejected')return'Απορρίφθηκε';if(relation.status==='ended')return'Ανενεργή σχέση';if(relation.status==='blocked')return'Αποκλεισμένη σχέση';return'Ενεργή συνεργασία';}
function relationKind(){return relation.status==='active'?'success':relation.status==='pending'?'warning':relation.status==='rejected'||relation.status==='blocked'?'danger':'neutral';}
function identity(){const p=relation.partner||{};const initials=String(p.name||'').trim().split(/\s+/).map(x=>x[0]).join('').slice(0,2).toUpperCase()||'—';document.getElementById('partnerIdentity').innerHTML=`<div class="ct-partner-identity__avatar">${escapeHtml(initials)}</div><div class="ct-partner-identity__main"><span>ΣΥΝΕΡΓΑΖΟΜΕΝΟΣ ΟΡΓΑΝΙΣΜΟΣ</span><h2>${escapeHtml(p.name||'Χωρίς επωνυμία')}</h2><p>ΑΦΜ ${escapeHtml(p.afm||'—')}${p.email?` · ${escapeHtml(p.email)}`:''}</p></div>${statusBadge(relationKind(),relationLabel())}`;document.getElementById('partnerMeta').innerHTML=`<dl class="ct-detail-grid"><div><dt>Επωνυμία</dt><dd>${escapeHtml(p.name||'—')}</dd></div><div><dt>ΑΦΜ</dt><dd>${escapeHtml(p.afm||'—')}</dd></div><div><dt>Email</dt><dd>${escapeHtml(p.email||'—')}</dd></div><div><dt>Κατάσταση σχέσης</dt><dd>${escapeHtml(relationLabel())}</dd></div></dl>`;}
function bindActions(){if(relation.status!=='active')return;const bucket=organizationService.partnerCertificateBucket(relation.partner);document.querySelectorAll('.view-btn').forEach(btn=>btn.onclick=()=>openCertificatePreview(bucket,btn.dataset.ref,btn.dataset.title||'Πιστοποιητικό').catch(handleError));}
function render(){const panel=document.getElementById('partnerCertificatesPanel');if(relation.status!=='active'){panel.classList.add('hidden');return;}panel.classList.remove('hidden');const q=(document.getElementById('searchInput')?.value||'').toLowerCase();const filtered=certificates.filter(c=>`${c.title||''} ${c.type||''} ${c.name||''}`.toLowerCase().includes(q));const draw=list=>renderCertificateCollection({certificates:list,container:document.getElementById('certContainer'),onBindActions:bindActions,permissions:{edit:false,delete:false,selectable:false}});bindCertificateStats({certificates:filtered,onRender:draw});draw(filtered);document.getElementById('certContainer')?.classList.remove('hidden');document.getElementById('noCertificatesMessage')?.classList.toggle('hidden',filtered.length>0);}
async function removeRelation(){const ask=await Swal.fire({title:'Κατάργηση συνεργασίας;',text:`Θα διαγραφεί μόνο η σχέση με ${relation.partner?.name||'τον οργανισμό'}. Ο οργανισμός, ο λογαριασμός και τα πιστοποιητικά του παραμένουν στην πλατφόρμα.`,icon:'warning',showCancelButton:true,confirmButtonText:'Κατάργηση σχέσης',cancelButtonText:'Ακύρωση'});if(!ask.isConfirmed)return;await organizationService.deleteRelationship(ctx.organization,relation);await Swal.fire('Η σχέση καταργήθηκε','Δεν διαγράφηκε κανένας οργανισμός ή πιστοποιητικό.','success');location.href='./partners.html';}
async function respond(status){
  await organizationService.respondToRelationship(ctx.organization,relation.id,status);
  if(status==='active'){
    await Swal.fire({
      title:'Η συνεργασία ενεργοποιήθηκε',
      text:`Η συνεργασία με ${relation.partner?.name||'τον οργανισμό'} είναι πλέον ενεργή.`,
      icon:'success',
      confirmButtonText:'Συνέχεια'
    });
    // Reload the canonical relationship row and partner identity from Supabase.
    // This prevents the stale "Χωρίς επωνυμία / Αναμονή αποδοχής" state.
    location.replace(`./partner.html?relation=${encodeURIComponent(relation.id)}`);
    return;
  }
  await Swal.fire('Το αίτημα απορρίφθηκε','','info');
  location.replace('./partners.html');
}
function mountRelationActions(){const host=document.getElementById('relationActions');if(relation.status==='active')host.innerHTML=`<button id="removeRelationBtn" class="ct-btn ct-btn-danger"><i data-lucide="unlink"></i>Κατάργηση συνεργασίας</button>`;else if(relation.status==='pending'&&relation.direction==='incoming')host.innerHTML=`<button id="acceptRelationBtn" class="ct-btn ct-btn-primary"><i data-lucide="check"></i>Αποδοχή</button><button id="rejectRelationBtn" class="ct-btn ct-btn-secondary"><i data-lucide="x"></i>Απόρριψη</button>`;else if(relation.status==='pending')host.innerHTML=`<button id="removeRelationBtn" class="ct-btn ct-btn-danger"><i data-lucide="x"></i>Ακύρωση αιτήματος</button>`;else host.innerHTML=`<button id="removeRelationBtn" class="ct-btn ct-btn-danger"><i data-lucide="unlink"></i>Αφαίρεση σχέσης</button>`;document.getElementById('removeRelationBtn')?.addEventListener('click',removeRelation);document.getElementById('acceptRelationBtn')?.addEventListener('click',()=>respond('active'));document.getElementById('rejectRelationBtn')?.addEventListener('click',()=>respond('declined'));}
async function init(){ctx=await getOrganizationContext();if(!ctx)return;bindOrganizationLogout();const id=new URLSearchParams(location.search).get('relation');const rows=await organizationService.listPartners(ctx.organization);relation=rows.find(r=>String(r.id)===String(id));if(!relation){await Swal.fire('Δεν βρέθηκε','Η σχέση δεν υπάρχει.','warning');location.href='./partners.html';return;}identity();mountRelationActions();mountCertificatePageChrome({allowVisibility:false,allowEmail:false,selectable:false});document.getElementById('addCertFixed')?.remove();document.getElementById('searchInput')?.addEventListener('input',render);if(relation.status==='active')certificates=await organizationService.listSharedCertificates(relation.partner);document.getElementById('loadingCertificates')?.classList.add('hidden');render();window.lucide?.createIcons();}
init().catch(handleError);
