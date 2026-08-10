import { getOrganizationContext, bindOrganizationLogout } from './guard.js';
import { organizationService } from '../../services/organizationService.js';
import { storageService } from '../../services/storageService.js';
import { renderCertificateCollection, bindCertificateStats, openCertificateCreateDialog, openCertificateEditDialog, mountCertificatePageChrome } from '../../components/certificateUi.js';
import { openCertificatePreview } from '../../core/certificateStorage.js';
import { showLoading, hideLoading, handleError } from '../../shared/common.js';
import { certificateStatus, escapeHtml } from '../../components/uiPrimitives.js';
import { locale } from '../../shared/i18n.js';

const MAX_PDF_BYTES = 25 * 1024 * 1024;
let ctx; let all=[]; let visible=[];

const container=()=>document.getElementById('certContainer');
const selectedIds=()=>[...document.querySelectorAll('.cert-bulk-checkbox:checked')].map(x=>String(x.value));
const role=()=>ctx?.organization?.member_role || 'owner';
const canEdit=()=>['owner','admin','member'].includes(role());
const canDelete=()=>['owner','admin'].includes(role());
const isModern=()=>ctx?.organization?.source==='organizations';

function assertPdf(file){
  if(!file) throw new Error('Επιλέξτε αρχείο PDF.');
  if(file.type!=='application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) throw new Error('Επιτρέπονται μόνο αρχεία PDF.');
  if(file.size<=0 || file.size>MAX_PDF_BYTES) throw new Error('Το PDF πρέπει να είναι μικρότερο από 25 MB.');
}

function updateBulk(){
  const ids=selectedIds();
  const count=document.getElementById('selectedCertCount'); if(count) count.textContent=String(ids.length);
  for(const id of ['printSelectedBtn','exportSelectedBtn']){const b=document.getElementById(id);if(b)b.disabled=!ids.length;}
  const allBtn=document.getElementById('selectAllBtn');
  if(allBtn)allBtn.textContent=ids.length&&ids.length===visible.length?'Καμία επιλογή':'Επιλογή όλων';
}
function selectAll(){
  const boxes=[...document.querySelectorAll('.cert-bulk-checkbox')];
  const next=boxes.length>0&&!boxes.every(x=>x.checked);
  boxes.forEach(x=>x.checked=next);
  const h=document.getElementById('certSelectAllHeader');if(h){h.checked=next;h.indeterminate=false;}
  updateBulk();
}
function selectedCertificates(){const set=new Set(selectedIds());return all.filter(c=>set.has(String(c.id)));}
function printSelected(){
  const rows=selectedCertificates();if(!rows.length)return;
  const w=window.open('','_blank','noopener,noreferrer');
  if(!w)return Swal.fire('Δεν άνοιξε η εκτύπωση','Επιτρέψτε τα pop-ups για το CertiTrack.','warning');
  const body=rows.map(c=>`<tr><td>${escapeHtml(c.title||'')}</td><td>${escapeHtml(c.type||'')}</td><td>${escapeHtml(c.certificate_number||'—')}</td><td>${escapeHtml(c.date?new Date(c.date).toLocaleDateString(locale()):'—')}</td><td>${c.is_private?'Ιδιωτικό':'Σε συνεργάτες'}</td></tr>`).join('');
  w.document.write(`<html><head><title>CertiTrack</title><style>body{font-family:Arial;padding:24px}h1{font-size:20px}table{width:100%;border-collapse:collapse}th,td{padding:9px;border-bottom:1px solid #ddd;text-align:left;font-size:12px}th{background:#f5f5f5}</style></head><body><h1>CertiTrack · Επιλεγμένα πιστοποιητικά</h1><table><thead><tr><th>Τίτλος</th><th>Τύπος</th><th>Αριθμός</th><th>Λήξη</th><th>Ορατότητα</th></tr></thead><tbody>${body}</tbody></table><script>onload=()=>print()<\/script></body></html>`);
  w.document.close();
}
function exportSelected(){
  const rows=selectedCertificates();if(!rows.length)return;
  const cols=['title','type','certificate_number','issue_date','date','issuer','is_private','name'];
  const csv='\uFEFF'+[cols.join(';'),...rows.map(c=>cols.map(k=>`"${String(c[k]??'').replaceAll('"','""')}"`).join(';'))].join('\r\n');
  const blob=new Blob([csv],{type:'text/csv;charset=utf-8'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='certitrack-certificates.csv';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
}

async function load(){
  const loading=document.getElementById('loadingCertificates');loading?.classList.remove('hidden');
  try{
    all=await organizationService.listOwnCertificates(ctx.organization,ctx.user.id);
    const search=(document.getElementById('searchInput')?.value||'').toLowerCase();
    const vf=document.getElementById('visibilityFilter')?.value||'all';
    visible=all
      .filter(c=>`${c.title||''} ${c.type||''} ${c.name||''} ${c.certificate_number||''} ${c.issuer||''}`.toLowerCase().includes(search))
      .filter(c=>vf==='all'||(vf==='private'?c.is_private===true:c.is_private!==true));

    const render=list=>renderCertificateCollection({
      certificates:list,container:container(),onBindActions:bindActions,onSelectionChange:updateBulk,
      permissions:{edit:canEdit(),delete:canDelete(),selectable:true}
    });
    bindCertificateStats({certificates:visible,onRender:render});
    render(visible);
    container()?.classList.remove('hidden');
    updateBulk();
  }catch(err){handleError(err);}
  finally{loading?.classList.add('hidden');}
}

async function uploadVersion(cert,file){
  assertPdf(file);
  const bucket=organizationService.certificateBucket(ctx.organization);
  const path=isModern()
    ? `${ctx.organization.id}/${cert.id}/${crypto.randomUUID()}.pdf`
    : `${ctx.user.id}/${crypto.randomUUID()}.pdf`;
  const up=await storageService.upload(bucket,path,file,{contentType:'application/pdf',upsert:false,cacheControl:'3600'});
  if(up.error) throw up.error;
  if(isModern()) await organizationService.registerCertificateFile(ctx.organization,cert.id,{path,file});
  return path;
}

function bindActions(){
  document.querySelectorAll('.view-btn').forEach(btn=>btn.onclick=()=>{
    if(!btn.dataset.ref) return Swal.fire('Δεν υπάρχει PDF','Δεν έχει συνδεθεί αρχείο με αυτό το πιστοποιητικό.','warning');
    openCertificatePreview(organizationService.certificateBucket(ctx.organization),btn.dataset.ref,btn.dataset.title||'Πιστοποιητικό').catch(handleError);
  });

  document.querySelectorAll('.delete-btn').forEach(btn=>btn.onclick=async()=>{
    const ok=await Swal.fire({
      title:'Διαγραφή πιστοποιητικού;',
      text:isModern()
        ?'Το πιστοποιητικό θα αφαιρεθεί από την ενεργή λίστα, αλλά το ιστορικό και οι εκδόσεις του PDF θα διατηρηθούν για audit.'
        :'Θα διαγραφεί η συγκεκριμένη εγγραφή.',
      icon:'warning',showCancelButton:true,confirmButtonText:'Διαγραφή',cancelButtonText:'Ακύρωση'
    });
    if(!ok.isConfirmed)return;
    try{showLoading();await organizationService.deleteCertificate(ctx.organization,btn.dataset.id);await load();}
    catch(e){handleError(e)}finally{hideLoading();}
  });

  document.querySelectorAll('.edit-btn').forEach(btn=>btn.onclick=async()=>{
    const cert=all.find(c=>String(c.id)===String(btn.dataset.id));if(!cert)return;
    const res=await openCertificateEditDialog(cert,{allowVisibility:true,allowFile:true});if(!res.isConfirmed)return;
    try{
      showLoading();
      const {file,...updates}=res.value;
      if(file) assertPdf(file);

      // Metadata and visibility are edited here. Visibility has no separate list action.
      await organizationService.updateCertificate(ctx.organization,cert.id,updates);

      if(file){
        if(isModern()){
          await uploadVersion(cert,file); // old versions remain immutable for audit/history
        }else{
          const path=await uploadVersion(cert,file);
          await organizationService.updateCertificate(ctx.organization,cert.id,{file_url:path,name:file.name});
        }
      }
      await load();
      await Swal.fire('Αποθηκεύτηκε',file?'Τα στοιχεία αποθηκεύτηκαν και δημιουργήθηκε νέα έκδοση PDF.':'Οι αλλαγές αποθηκεύτηκαν.','success');
    }catch(e){handleError(e)}finally{hideLoading();}
  });
}

async function create(){
  if(!canEdit()) return;
  const res=await openCertificateCreateDialog({allowVisibility:true});if(!res.isConfirmed)return;
  let draft=null;
  try{
    showLoading();
    const {file,...record}=res.value;assertPdf(file);

    if(isModern()){
      // Create metadata first so Storage RLS can validate <org>/<certificate>/ path.
      draft=await organizationService.insertCertificate(ctx.organization,ctx.user,record);
      await uploadVersion(draft,file);
    }else{
      const path=`${ctx.user.id}/${crypto.randomUUID()}.pdf`;
      const bucket=organizationService.certificateBucket(ctx.organization);
      const up=await storageService.upload(bucket,path,file,{contentType:'application/pdf',upsert:false});
      if(up.error)throw up.error;
      await organizationService.insertCertificate(ctx.organization,ctx.user,{...record,file_url:path,name:file.name,timestamp:new Date().toISOString()});
    }
    await load();
    await Swal.fire('Αποθηκεύτηκε','Το πιστοποιητικό καταχωρήθηκε.','success');
  }catch(e){
    if(draft&&isModern()) await organizationService.abortCertificateDraft(ctx.organization,draft.id).catch(()=>{});
    handleError(e);
  }finally{hideLoading();}
}

async function init(){
  mountCertificatePageChrome({allowVisibility:true,allowEmail:false,selectable:true});
  ctx=await getOrganizationContext();if(!ctx)return;
  bindOrganizationLogout();

  const add=document.getElementById('addCertFixed');
  if(add){add.hidden=!canEdit();if(canEdit())add.addEventListener('click',create);}
  document.getElementById('searchInput')?.addEventListener('input',load);
  document.getElementById('visibilityFilter')?.addEventListener('change',load);
  document.getElementById('selectAllBtn')?.addEventListener('click',selectAll);
  document.getElementById('printSelectedBtn')?.addEventListener('click',printSelected);
  document.getElementById('exportSelectedBtn')?.addEventListener('click',exportSelected);
  await load();
}
init().catch(handleError);
