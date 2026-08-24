import { getOrganizationContext, bindOrganizationLogout } from './guard.js';
import { organizationService } from '../../services/organizationService.js';
import { mountCertificatePageChrome, renderCertificateCollection, bindCertificateStats } from '../../components/certificateUi.js';
import { openCertificatePreview } from '../../core/certificateStorage.js';
import { escapeHtml, statusBadge, certificateStatus } from '../../components/uiPrimitives.js';
import { handleError } from '../../shared/common.js';

let ctx, relation, certificates=[];
function relationLabel(){if(relation.status==='pending')return relation.direction==='incoming'?'Εκκρεμεί η αποδοχή σας':'Αναμονή αποδοχής';if(relation.status==='rejected')return'Απορρίφθηκε';if(relation.status==='ended')return'Ανενεργή σχέση';if(relation.status==='blocked')return'Αποκλεισμένη σχέση';return'Ενεργή συνεργασία';}
function relationKind(){return relation.status==='active'?'success':relation.status==='pending'?'warning':relation.status==='rejected'||relation.status==='blocked'?'danger':'neutral';}
function identity(){
  const p=relation.partner||{};
  const initials=String(p.name||'').trim().split(/\s+/).map(x=>x[0]).join('').slice(0,2).toUpperCase()||'—';
  document.getElementById('partnerIdentity').innerHTML=`
    <div class="ct-partner-identity__avatar">${escapeHtml(initials)}</div>
    <div class="ct-partner-identity__main">
      <span>ΣΥΝΕΡΓΑΖΟΜΕΝΟΣ ΟΡΓΑΝΙΣΜΟΣ</span>
      <h2>${escapeHtml(p.name||'Χωρίς επωνυμία')}</h2>
      <p>${p.afm?`ΑΦΜ ${escapeHtml(p.afm)}`:'ΑΦΜ —'}${p.email?` · ${escapeHtml(p.email)}`:''}</p>
    </div>
    ${statusBadge(relationKind(),relationLabel())}`;
  document.getElementById('partnerMeta').innerHTML=`
    <div class="ct-partner-meta-item"><span>Επωνυμία</span><strong>${escapeHtml(p.name||'—')}</strong></div>
    <div class="ct-partner-meta-item"><span>ΑΦΜ</span><strong>${escapeHtml(p.afm||'—')}</strong></div>
    <div class="ct-partner-meta-item ct-partner-meta-item--email"><span>Email</span><strong>${escapeHtml(p.email||'—')}</strong></div>
    <div class="ct-partner-meta-item"><span>Σχέση</span><strong>${escapeHtml(relationLabel())}</strong></div>`;
}
function bindActions(){
  if(relation.status!=='active')return;
  const bucket=organizationService.partnerCertificateBucket(relation.partner);
  document.querySelectorAll('.ct-partner-cert-view').forEach(btn=>{
    btn.onclick=()=>openCertificatePreview(
      bucket,
      btn.dataset.ref,
      btn.dataset.title||'Πιστοποιητικό'
    ).catch(handleError);
  });
}

function partnerCertificateRow(c){
  const st=certificateStatus(c.date);
  const date=c.date?new Date(c.date).toLocaleDateString('el-GR'):'—';
  return `<article class="ct-partner-cert-row">
    <div class="ct-partner-cert-file">
      <span class="ct-partner-cert-icon"><i data-lucide="file-text"></i></span>
      <span class="ct-partner-cert-copy">
        <strong title="${escapeHtml(c.title||'Πιστοποιητικό')}">${escapeHtml(c.title||'Πιστοποιητικό')}</strong>
        <small title="${escapeHtml(c.name||'PDF')}">${escapeHtml(c.name||'PDF')}</small>
      </span>
    </div>
    <div class="ct-partner-cert-type" title="${escapeHtml(c.type||'—')}">${escapeHtml(c.type||'—')}</div>
    <div class="ct-partner-cert-date">${escapeHtml(date)}</div>
    <div class="ct-partner-cert-status">${statusBadge(st.kind,st.label)}</div>
    <button type="button" class="ct-row-action ct-partner-cert-view"
      data-ref="${escapeHtml(c.file_url||'')}"
      data-title="${escapeHtml(c.title||'Πιστοποιητικό')}"
      aria-label="Προβολή ${escapeHtml(c.title||'πιστοποιητικού')}"
      title="Προβολή"><i data-lucide="eye"></i></button>
  </article>`;
}

function drawPartnerCertificates(list){
  const host=document.getElementById('certContainer');
  const empty=document.getElementById('noCertificatesMessage');
  if(!host)return;
  if(!list.length){
    host.innerHTML='';
    host.classList.add('hidden');
    empty?.classList.remove('hidden');
    return;
  }
  empty?.classList.add('hidden');
  host.classList.remove('hidden');
  host.innerHTML=`<div class="ct-partner-cert-head">
      <span>Πιστοποιητικό</span><span>Τύπος</span><span>Λήξη</span><span>Κατάσταση</span><span></span>
    </div>${list.map(partnerCertificateRow).join('')}`;
  bindActions();
  window.lucide?.createIcons();
}

function render(){
  const panel=document.getElementById('partnerCertificatesPanel');
  if(relation.status!=='active'){
    panel.classList.add('hidden');
    return;
  }
  panel.classList.remove('hidden');
  const q=(document.getElementById('searchInput')?.value||'').toLowerCase();
  const filtered=certificates.filter(c=>`${c.title||''} ${c.type||''} ${c.name||''}`.toLowerCase().includes(q));
  bindCertificateStats({certificates:filtered,onRender:drawPartnerCertificates});
  drawPartnerCertificates(filtered);
}
async function removeRelation(){const ask=await Swal.fire({title:'Κατάργηση συνεργασίας;',text:`Θα διαγραφεί μόνο η σχέση με ${relation.partner?.name||'τον οργανισμό'}. Ο οργανισμός, ο λογαριασμός και τα πιστοποιητικά του παραμένουν στην πλατφόρμα.`,icon:'warning',showCancelButton:true,confirmButtonText:'Κατάργηση σχέσης',cancelButtonText:'Ακύρωση'});if(!ask.isConfirmed)return;await organizationService.deleteRelationship(ctx.organization,relation);await Swal.fire('Η σχέση καταργήθηκε','Δεν διαγράφηκε κανένας οργανισμός ή πιστοποιητικό.','success');location.href='./partners.html';}

async function reloadCanonicalRelation(){
  for(let attempt=0;attempt<3;attempt++){
    const fresh=await organizationService.listPartners(ctx.organization);
    const found=fresh.find(r=>String(r.id)===String(relation.id));
    if(found?.partner?.name){
      relation=found;
      return true;
    }
    if(found)relation=found;
    await new Promise(resolve=>setTimeout(resolve,250));
  }
  return !!relation;
}

async function refreshActiveRelationView(){
  await reloadCanonicalRelation();
  identity();
  mountRelationActions();
  certificates=relation.status==='active'
    ? await organizationService.listSharedCertificates(relation.partner)
    : [];
  document.getElementById('loadingCertificates')?.classList.add('hidden');
  render();
  window.lucide?.createIcons();
}

async function respond(status){
  const acceptBtn=document.getElementById('acceptRelationBtn');
  const rejectBtn=document.getElementById('rejectRelationBtn');
  if(acceptBtn)acceptBtn.disabled=true;
  if(rejectBtn)rejectBtn.disabled=true;

  try{
    await organizationService.respondToRelationship(ctx.organization,relation.id,status);

    if(status==='active'){
      await refreshActiveRelationView();
      await Swal.fire({
        title:'Η συνεργασία ενεργοποιήθηκε',
        text:`Η συνεργασία με ${relation.partner?.name||'τον οργανισμό'} είναι πλέον ενεργή.`,
        icon:'success',
        timer:1400,
        showConfirmButton:false
      });
      return;
    }

    await Swal.fire('Το αίτημα απορρίφθηκε','','info');
    location.replace('./partners.html');
  }catch(error){
    if(acceptBtn)acceptBtn.disabled=false;
    if(rejectBtn)rejectBtn.disabled=false;
    throw error;
  }
}
function mountRelationActions(){const host=document.getElementById('relationActions');if(relation.status==='active')host.innerHTML=`<button id="removeRelationBtn" class="ct-btn ct-btn-danger"><i data-lucide="unlink"></i>Κατάργηση συνεργασίας</button>`;else if(relation.status==='pending'&&relation.direction==='incoming')host.innerHTML=`<button id="acceptRelationBtn" class="ct-btn ct-btn-primary"><i data-lucide="check"></i>Αποδοχή</button><button id="rejectRelationBtn" class="ct-btn ct-btn-secondary"><i data-lucide="x"></i>Απόρριψη</button>`;else if(relation.status==='pending')host.innerHTML=`<button id="removeRelationBtn" class="ct-btn ct-btn-danger"><i data-lucide="x"></i>Ακύρωση αιτήματος</button>`;else host.innerHTML=`<button id="removeRelationBtn" class="ct-btn ct-btn-danger"><i data-lucide="unlink"></i>Αφαίρεση σχέσης</button>`;document.getElementById('removeRelationBtn')?.addEventListener('click',removeRelation);document.getElementById('acceptRelationBtn')?.addEventListener('click',()=>respond('active'));document.getElementById('rejectRelationBtn')?.addEventListener('click',()=>respond('declined'));}
async function init(){ctx=await getOrganizationContext();if(!ctx)return;bindOrganizationLogout();const id=new URLSearchParams(location.search).get('relation');const rows=await organizationService.listPartners(ctx.organization);relation=rows.find(r=>String(r.id)===String(id));if(!relation){await Swal.fire('Δεν βρέθηκε','Η σχέση δεν υπάρχει.','warning');location.href='./partners.html';return;}identity();mountRelationActions();mountCertificatePageChrome({allowVisibility:false,allowEmail:false,selectable:false});document.getElementById('addCertFixed')?.remove();document.getElementById('searchInput')?.addEventListener('input',render);if(relation.status==='active')certificates=await organizationService.listSharedCertificates(relation.partner);document.getElementById('loadingCertificates')?.classList.add('hidden');render();window.lucide?.createIcons();}
init().catch(handleError);
