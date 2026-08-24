import { getOrganizationContext, bindOrganizationLogout } from './guard.js';
import { organizationService } from '../../services/organizationService.js';
import { escapeHtml, emptyState, statusBadge } from '../../components/uiPrimitives.js';
import { appUrl } from '../../shared/paths.js';

const safe=escapeHtml; let rows=[]; let ctx;
function friendlyPartnerError(error){
  const raw=String(error?.message||error||'').trim();
  const msg=raw.toLowerCase();
  if(msg.includes('already')||msg.includes('duplicate')||msg.includes('εκκρεμ')||msg.includes('υπάρχει ήδη')){
    return {title:'Υπάρχει ήδη αίτημα συνεργασίας',text:'Έχει ήδη σταλεί αίτημα ή υπάρχει ενεργή σχέση με αυτόν τον οργανισμό. Δείτε τη λίστα συνεργατών για την τρέχουσα κατάσταση.'};
  }
  if(msg.includes('not found')||msg.includes('δεν βρέθηκε')){
    return {title:'Δεν βρέθηκε οργανισμός',text:'Ελέγξτε το ΑΦΜ ή το email και δοκιμάστε ξανά.'};
  }
  return {title:'Δεν ολοκληρώθηκε',text:'Δεν ήταν δυνατή η δημιουργία του αιτήματος συνεργασίας. Δοκιμάστε ξανά σε λίγο.'};
}
function incomingRequestCard(r){
  const p=r.partner||{};
  return `<button type="button" class="ct-incoming-request" data-incoming-relation="${safe(r.id)}">
    <span class="ct-incoming-request__icon"><i data-lucide="user-plus"></i></span>
    <span class="ct-incoming-request__copy"><strong>${safe(p.name||'Ένας οργανισμός')} σας προσκαλεί σε συνεργασία</strong><span>Δείτε το αίτημα και επιλέξτε Αποδοχή ή Απόρριψη.</span></span>
    <span class="ct-incoming-request__action">Προβολή <i data-lucide="chevron-right"></i></span>
  </button>`;
}
function renderIncomingRequests(){
  const host=document.getElementById('incomingRequests'); if(!host)return;
  const incoming=rows.filter(r=>r.status==='pending'&&r.direction==='incoming');
  host.innerHTML=incoming.length?`<div class="ct-incoming-requests__label">ΝΕΑ ΑΙΤΗΜΑΤΑ ΣΥΝΕΡΓΑΣΙΑΣ</div>${incoming.map(incomingRequestCard).join('')}`:'';
  host.classList.toggle('is-empty',incoming.length===0);
  host.querySelectorAll('[data-incoming-relation]').forEach(el=>el.addEventListener('click',()=>openRelation(el.dataset.incomingRelation)));
}
function label(r){if(r.status==='pending')return r.direction==='incoming'?'Αίτημα προς εσάς':'Αναμονή αποδοχής';if(r.status==='blocked')return'Αποκλεισμένη';if(r.status==='declined')return'Απορρίφθηκε';if(r.status==='ended')return'Ανενεργή';return'Ενεργή';}
function partnerRow(r){
  const p=r.partner||{}; const initials=String(p.name||'').trim().split(/\s+/).map(x=>x[0]).join('').slice(0,2).toUpperCase()||'—';
  const state=statusBadge(r.status==='blocked'||r.status==='declined'?'danger':r.status==='pending'?'warning':r.status==='active'?'success':'neutral',label(r));
  return `<article class="ct-company-row ct-company-row--clickable" data-relation-id="${safe(r.id)}" tabindex="0" role="link" aria-label="Προβολή ${safe(p.name||'συνεργάτη')}"><div class="ct-company-avatar">${safe(initials)}</div><div class="ct-company-row__main"><strong>${safe(p.name||'Χωρίς επωνυμία')}</strong><span>ΑΦΜ ${safe(p.afm||'—')}${p.email?` · ${safe(p.email)}`:''}</span></div><div>${state}</div><i class="ct-company-row__chevron" data-lucide="chevron-right"></i></article>`;
}
function openRelation(id){location.href=appUrl(`pages/organization/partner.html?relation=${encodeURIComponent(id)}`);}
function render(){
  const q=(document.getElementById('partnerSearch')?.value||'').toLowerCase();
  const f=rows.filter(r=>`${r.partner?.name||''} ${r.partner?.afm||''} ${r.partner?.email||''}`.toLowerCase().includes(q));
  renderIncomingRequests();
  document.getElementById('partnerCount').textContent=`${f.length} συνεργάτες`;
  document.getElementById('partnersList').innerHTML=f.length?f.map(partnerRow).join(''):emptyState({icon:'users',title:'Δεν βρέθηκαν συνεργάτες',text:'Συνδέστε έναν οργανισμό για να ανταλλάσσετε κοινόχρηστα πιστοποιητικά.'});
  document.querySelectorAll('[data-relation-id]').forEach(row=>{
    row.onclick=()=>openRelation(row.dataset.relationId);
    row.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();openRelation(row.dataset.relationId);}};
  });
  window.lucide?.createIcons();
}
async function refresh(){rows=await organizationService.listPartners(ctx.organization);render();}
async function addPartner(){
  const res=await Swal.fire({title:'Νέα συνεργασία',input:'text',inputLabel:'ΑΦΜ ή email οργανισμού',inputPlaceholder:'π.χ. 099999999 ή quality@company.gr',showCancelButton:true,confirmButtonText:'Συνέχεια',cancelButtonText:'Ακύρωση',inputValidator:v=>!String(v||'').trim()?'Συμπληρώστε ΑΦΜ ή email.':undefined});
  if(!res.isConfirmed)return;
  const lookup=String(res.value||'').trim();
  try{
    const candidate=await organizationService.findPartnerCandidate(lookup);
    const targetHtml=candidate
      ? `<p class="ct-swal-copy"><strong>${safe(candidate.name||'Οργανισμός')}</strong><br>ΑΦΜ ${safe(candidate.afm||'—')}<br>${safe(candidate.email||'')}</p><p>Θα σταλεί αίτημα μέσα στο CertiTrack και θα απαιτείται αποδοχή.</p>`
      : lookup.includes('@')
        ? `<p class="ct-swal-copy"><strong>${safe(lookup)}</strong></p><p>Δεν υπάρχει ακόμη εγγεγραμμένος οργανισμός με αυτό το email. Θα δημιουργηθεί εκκρεμής πρόσκληση εγγραφής/συνεργασίας.</p>`
        : '';
    if(!candidate&&!lookup.includes('@')) return Swal.fire('Δεν βρέθηκε','Δεν βρέθηκε εγγεγραμμένος οργανισμός με αυτό το ΑΦΜ. Για μη εγγεγραμμένο οργανισμό χρησιμοποίησε email.','info');
    const ask=await Swal.fire({title:'Αποστολή πρόσκλησης συνεργασίας;',html:targetHtml,icon:'question',showCancelButton:true,confirmButtonText:'Αποστολή',cancelButtonText:'Ακύρωση'});
    if(!ask.isConfirmed)return;
    const invitation=await organizationService.requestPartner(ctx.organization,lookup);
    await Swal.fire('Η πρόσκληση καταχωρήθηκε',candidate?'Ο οργανισμός θα τη δει ως εκκρεμές αίτημα και πρέπει να την αποδεχθεί.':'Η πρόσκληση παραμένει εκκρεμής μέχρι να εγγραφεί/συνδεθεί ο οργανισμός.','success');
    await refresh();
  }catch(e){const friendly=friendlyPartnerError(e);Swal.fire({title:friendly.title,text:friendly.text,icon:'info',confirmButtonText:'ΟΚ'});}
}
async function init(){ctx=await getOrganizationContext();if(!ctx)return;bindOrganizationLogout();await refresh();document.getElementById('partnerSearch')?.addEventListener('input',render);document.getElementById('addPartnerBtn')?.addEventListener('click',addPartner);}
init().catch(e=>{console.error(e);Swal.fire('Σφάλμα',e.message||'Αποτυχία φόρτωσης','error')});
