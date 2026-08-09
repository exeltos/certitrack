import { demoData } from './demoData.js';
import { installDemoBanner, protectDemoWrites } from './demoSession.js';
import { openPdfViewer } from '../core/pdfViewer.js';

const labels={active:'Ενεργό',soon:'Προς λήξη',expired:'Ληγμένο',compliant:'Συμμορφωμένος',attention:'Προσοχή',critical:'Ελλείψεις',shared:'Κοινόχρηστο',private:'Ιδιωτικό',granted:'Πρόσβαση',blocked:'Αποκλεισμένος'};
const badge=s=>{const cls={active:'ct-status--success',compliant:'ct-status--success',granted:'ct-status--success',soon:'ct-status--warning',attention:'ct-status--warning',expired:'ct-status--danger',critical:'ct-status--danger',blocked:'ct-status--danger',shared:'ct-status--info',private:'ct-status--neutral'}[s]||'ct-status--neutral';return `<span class="ct-status ${cls}">${labels[s]||s}</span>`;};
const root=()=>document.querySelector('.ct-content-page')||document.querySelector('main');
const stat=(label,value,note,icon)=>`<article class="ct-card demo-real-kpi"><div class="demo-real-kpi__icon"><i data-lucide="${icon}"></i></div><div><strong>${value}</strong><span>${label}</span><small>${note}</small></div></article>`;
const fmt=d=>new Date(d).toLocaleDateString('el-GR');


function openDemoPreview(role, title='Demo certificate'){
  const url = role === 'supplier' ? '/assets/demo-certificates/supplier-demo.pdf' : '/assets/demo-certificates/company-demo.pdf';
  openPdfViewer(url, title).catch(err => Swal.fire('Σφάλμα', err.message || 'Αποτυχία προβολής', 'error'));
}
function bindDemoCertificateActions(role){
  document.querySelectorAll('[data-demo-preview]').forEach(btn=>btn.addEventListener('click',()=>openDemoPreview(role,btn.dataset.title||'Πιστοποιητικό')));
  document.querySelectorAll('[data-demo-edit]').forEach(btn=>btn.addEventListener('click',()=>{
    const title=btn.dataset.title||'';
    Swal.fire({title:'Επεξεργασία demo πιστοποιητικού',html:`<div class="ct-swal-form"><div class="ct-swal-field"><label>Τίτλος</label><input id="demo-edit-title" value="${title.replace(/"/g,'&quot;')}"></div><div class="ct-swal-field"><label>Τύπος</label><select id="demo-edit-type"><option>ISO 9001</option><option>ISO 13485</option><option>CE</option><option>Άλλο</option></select></div><div class="ct-swal-field"><label>Ημερομηνία λήξης</label><input id="demo-edit-date" type="date" value="2027-06-30"></div></div>`,showCancelButton:true,confirmButtonText:'Αποθήκευση',cancelButtonText:'Ακύρωση',preConfirm:()=>{const t=document.getElementById('demo-edit-title').value.trim();const d=document.getElementById('demo-edit-date').value;if(!t||!d){Swal.showValidationMessage('Συμπλήρωσε τα υποχρεωτικά πεδία.');return false;}return true;}}).then(r=>{if(r.isConfirmed)Swal.fire('Demo','Η φόρμα λειτουργεί. Σε demo mode η αλλαγή δεν γράφεται στη βάση.','success');});
  }));
  document.querySelectorAll('[data-demo-delete]').forEach(btn=>btn.addEventListener('click',async()=>{
    const result=await Swal.fire({title:'Διαγραφή πιστοποιητικού',text:`Να αφαιρεθεί το «${btn.dataset.title||'πιστοποιητικό'}»;`,icon:'warning',showCancelButton:true,confirmButtonText:'Διαγραφή',cancelButtonText:'Ακύρωση'});
    if(!result.isConfirmed)return;
    btn.closest('.ct-certificate-row')?.remove();
    await Swal.fire('Demo','Το πιστοποιητικό αφαιρέθηκε από την τρέχουσα demo προβολή. Η αλλαγή δεν αποθηκεύεται.','success');
  }));
  window.lucide?.createIcons();
}

function bindWrites(){document.querySelectorAll('[data-demo-write]').forEach(el=>el.addEventListener('click',e=>{e.preventDefault();protectDemoWrites();}));window.lucide?.createIcons();}

function supplierRows(list, withActions=false){
  if(!list.length) return `<div class="demo-empty-state"><i data-lucide="search-x"></i><strong>Δεν βρέθηκαν προμηθευτές</strong><p>Δοκιμάστε διαφορετική αναζήτηση ή φίλτρο κατάστασης.</p></div>`;
  return list.map(s=>{const i=demoData.company.suppliers.findIndex(x=>x.name===s.name);return `<a class="demo-real-supplier" href="/pages/company/supplier.html?demoSupplier=${i}">
    <div class="demo-real-company"><span>${s.name.slice(0,2).toUpperCase()}</span><div><strong>${s.name}</strong><small>ΑΦΜ ${s.afm}</small></div></div>
    <div class="demo-real-mobile-label"><strong>${s.certs}</strong> πιστοποιητικά</div>
    <div class="demo-real-score"><span><i style="width:${s.score}%"></i></span><b>${s.score}%</b></div>
    <div>${badge(s.status)}</div>${withActions?`<button type="button" class="ct-row-action ct-row-action--danger demo-supplier-remove" data-demo-supplier="${i}" data-name="${s.name}" title="Αφαίρεση"><i data-lucide="trash-2"></i></button>`:`<i data-lucide="chevron-right" class="demo-real-arrow"></i>`}</a>`}).join('');
}

function companyDashboard(){
  installDemoBanner('company'); const d=demoData.company, el=root(); if(!el)return;
  el.innerHTML=`
    <section class="ct-filterbar">
      <div class="ct-filterbar__search"><i data-lucide="search"></i><input id="demoSupplierSearch" placeholder="Αναζήτηση επωνυμίας ή ΑΦΜ..." /></div>
      <select id="demoSupplierStatus"><option value="">Όλες οι καταστάσεις</option><option value="compliant">Συμμορφωμένοι</option><option value="attention">Προσοχή</option><option value="critical">Με ελλείψεις</option></select>
      <button class="ct-btn ct-btn-primary" data-demo-write><i data-lucide="plus"></i> Νέος προμηθευτής</button>
    </section>
    <section class="demo-real-kpis">${stat('Προμηθευτές',d.stats.suppliers,'Συνδεδεμένοι','users')}${stat('Συμμορφωμένοι',d.stats.compliant,'Χωρίς ελλείψεις','shield-check')}${stat('Προς λήξη',d.stats.expiring,'Εντός 30 ημερών','clock-3')}${stat('Ελλείψεις',d.stats.missing,'Απαιτούν ενέργεια','triangle-alert')}</section>
    <div class="demo-dashboard-grid">
      <section class="ct-card demo-real-panel">
        <div class="demo-real-panel__head"><div><h2>Οι προμηθευτές μου</h2><p>Προτεραιότητα βάσει συμμόρφωσης και λήξεων</p></div><span id="demoSupplierCount">${d.suppliers.length} εγγραφές</span></div>
        <div class="demo-real-table-head"><span>Προμηθευτής</span><span>Έγγραφα</span><span>Compliance</span><span>Κατάσταση</span><span></span></div>
        <div id="demoSupplierRows">${supplierRows(d.suppliers)}</div>
      </section>
      <aside class="ct-card demo-activity-panel">
        <div class="demo-real-panel__head"><div><h2>Πρόσφατη δραστηριότητα</h2><p>Ό,τι χρειάζεται την προσοχή σας</p></div></div>
        <div class="demo-activity-list">${d.activity.map(a=>`<div class="demo-activity-item" data-kind="${a.kind}"><span class="demo-activity-dot"></span><div><strong>${a.text}</strong><small>${a.time}</small></div></div>`).join('')}</div>
      </aside>
    </div>`;
  const search=document.getElementById('demoSupplierSearch'), status=document.getElementById('demoSupplierStatus');
  const filter=()=>{const q=search.value.trim().toLowerCase(),st=status.value;const list=d.suppliers.filter(s=>(!q||s.name.toLowerCase().includes(q)||s.afm.includes(q))&&(!st||s.status===st));document.getElementById('demoSupplierRows').innerHTML=supplierRows(list);document.getElementById('demoSupplierCount').textContent=`${list.length} εγγραφές`;window.lucide?.createIcons();};
  search.addEventListener('input',filter); status.addEventListener('change',filter); bindWrites();
}


function companySuppliers(){
  installDemoBanner('company');
  const d=demoData.company, el=root(); if(!el)return;
  let working=d.suppliers.map(s=>({...s}));
  const renderRows=list=>{
    document.getElementById('demoSupplierRows').innerHTML=supplierRows(list,true);
    document.getElementById('demoSupplierCount').textContent=`${list.length} εγγραφές`;
    document.querySelectorAll('.demo-supplier-remove').forEach(btn=>btn.addEventListener('click',async e=>{
      e.preventDefault();e.stopPropagation();
      const result=await Swal.fire({title:'Αφαίρεση προμηθευτή',text:`Να αφαιρεθεί ο ${btn.dataset.name};`,icon:'warning',showCancelButton:true,confirmButtonText:'Αφαίρεση',cancelButtonText:'Ακύρωση'});
      if(!result.isConfirmed)return;
      working=working.filter(item=>item.name!==btn.dataset.name);
      applyFilter();
      Swal.fire('Demo','Ο προμηθευτής αφαιρέθηκε από την τρέχουσα demo προβολή.','success');
    }));
    window.lucide?.createIcons();
  };
  el.innerHTML=`<section class="ct-filterbar"><div class="ct-filterbar__search"><i data-lucide="search"></i><input id="demoSupplierSearch" placeholder="Αναζήτηση επωνυμίας, ΑΦΜ ή email..." /></div><select id="demoSupplierStatus"><option value="">Όλες οι καταστάσεις</option><option value="compliant">Συμμορφωμένοι</option><option value="attention">Προσοχή</option><option value="critical">Με ελλείψεις</option></select><button id="demoBulkImport" class="ct-btn ct-btn-secondary"><i data-lucide="file-up"></i> Μαζική εισαγωγή</button><button class="ct-btn ct-btn-primary" data-demo-write><i data-lucide="plus"></i> Προσθήκη προμηθευτή</button></section><section class="ct-card demo-real-panel"><div class="demo-real-panel__head"><div><h2>Προμηθευτές</h2><p>Κατάσταση εγγραφής, πιστοποιητικά και συμμόρφωση.</p></div><span id="demoSupplierCount">${working.length} εγγραφές</span></div><div class="demo-real-table-head demo-real-table-head--actions"><span>Προμηθευτής</span><span>Έγγραφα</span><span>Compliance</span><span>Κατάσταση</span><span>Ενέργειες</span></div><div id="demoSupplierRows" class="ct-scroll-list"></div></section>`;
  const search=document.getElementById('demoSupplierSearch'), status=document.getElementById('demoSupplierStatus');
  function applyFilter(){const q=search.value.trim().toLowerCase(),st=status.value;const list=working.filter(s=>(!q||`${s.name} ${s.afm} ${s.email||''}`.toLowerCase().includes(q))&&(!st||s.status===st));renderRows(list);}
  search.addEventListener('input',applyFilter); status.addEventListener('change',applyFilter);
  document.getElementById('demoBulkImport').addEventListener('click',()=>{
    Swal.fire({title:'Μαζική εισαγωγή προμηθευτών',html:`<div class="ct-swal-form"><div class="ct-import-dropzone"><i data-lucide="file-spreadsheet"></i><strong>Επίλεξε αρχείο Excel</strong><span>Στήλες: ΕΠΩΝΥΜΙΑ, ΑΦΜ, Email</span><input id="demoExcelUpload" type="file" accept=".xlsx"></div><a class="ct-btn ct-btn-secondary ct-btn-sm" href="/assets/templates/prototype_suppliers.xlsx" download><i data-lucide="file-down"></i> Λήψη προτύπου</a></div>`,showCancelButton:true,confirmButtonText:'Έλεγχος αρχείου',cancelButtonText:'Ακύρωση',didOpen:()=>window.lucide?.createIcons(),preConfirm:()=>{const f=document.getElementById('demoExcelUpload').files?.[0];if(!f){Swal.showValidationMessage('Επίλεξε αρχείο Excel.');return false;}return f.name;}}).then(r=>{if(r.isConfirmed)Swal.fire('Demo έλεγχος ολοκληρώθηκε',`Το αρχείο ${r.value} είναι έτοιμο για εισαγωγή. Σε demo mode δεν αποθηκεύονται αλλαγές.`,'success');});
  });
  bindWrites();applyFilter();
}

function certificateGrid(certs, role='company'){
  if(!certs.length)return `<div class="demo-empty-state"><i data-lucide="file-x-2"></i><strong>Δεν βρέθηκαν πιστοποιητικά</strong><p>Αλλάξτε την αναζήτηση ή το φίλτρο κατάστασης.</p></div>`;
  const rows=certs.map(c=>`<article class="ct-certificate-row"><div class="ct-certificate-main"><div class="ct-certificate-icon"><i data-lucide="file-text"></i></div><div class="ct-certificate-title"><strong>${c.title}</strong><span>${role==='supplier'?(c.visibility==='private'?'Ιδιωτικό έγγραφο':'Διαθέσιμο σε συνεργάτες'):'Demo PDF'}</span></div></div><div class="ct-certificate-cell">${c.type}</div><div class="ct-certificate-cell">${fmt(c.expires)}</div><div>${badge(c.status)}</div><div class="ct-certificate-actions"><button class="ct-row-action" data-demo-preview data-title="${c.title}" title="Προβολή"><i data-lucide="eye"></i></button><button class="ct-row-action" data-demo-edit data-title="${c.title}" title="Επεξεργασία"><i data-lucide="pencil"></i></button><button class="ct-row-action ct-row-action--danger" data-demo-delete data-title="${c.title}" title="Διαγραφή"><i data-lucide="trash-2"></i></button></div></article>`).join('');
  return `<div class="ct-certificate-head"><span>Πιστοποιητικό</span><span>Τύπος</span><span>Λήξη</span><span>Κατάσταση</span><span>Ενέργειες</span></div>${rows}`;
}

function companyCertificates(){
  installDemoBanner('company');const d=demoData.company,el=root();if(!el)return;
  el.innerHTML=`<section class="ct-filterbar"><div class="ct-filterbar__search"><i data-lucide="search"></i><input id="demoCertSearch" placeholder="Αναζήτηση πιστοποιητικού..." /></div><select id="demoCertStatus"><option value="">Όλες οι καταστάσεις</option><option value="active">Ενεργά</option><option value="soon">Προς λήξη</option><option value="expired">Ληγμένα</option></select><button class="ct-btn ct-btn-primary" data-demo-write><i data-lucide="plus"></i> Νέο πιστοποιητικό</button></section><section class="demo-real-kpis demo-real-kpis--compact">${stat('Σύνολο',d.certificates.length,'Πιστοποιητικά','files')}${stat('Ενεργά',d.certificates.filter(c=>c.status==='active').length,'Σε ισχύ','circle-check')}${stat('Προς λήξη',d.certificates.filter(c=>c.status==='soon').length,'Εντός 30 ημερών','clock-3')}${stat('Ληγμένα',d.certificates.filter(c=>c.status==='expired').length,'Χρειάζονται ενέργεια','circle-x')}</section><section id="demoCertGrid" class="ct-certificate-list">${certificateGrid(d.certificates,'company')}</section>`;
  const q=document.getElementById('demoCertSearch'),st=document.getElementById('demoCertStatus');const filter=()=>{const t=q.value.toLowerCase(),s=st.value;const list=d.certificates.filter(c=>(!t||c.title.toLowerCase().includes(t)||c.type.toLowerCase().includes(t))&&(!s||c.status===s));document.getElementById('demoCertGrid').innerHTML=certificateGrid(list,'company');bindWrites();bindDemoCertificateActions('company');};q.addEventListener('input',filter);st.addEventListener('change',filter);bindWrites();bindDemoCertificateActions('company');
}

function supplierCertificates(){
  installDemoBanner('supplier');const d=demoData.supplier,el=root();if(!el)return;
  el.innerHTML=`<section class="ct-filterbar"><div class="ct-filterbar__search"><i data-lucide="search"></i><input id="demoSupplierCertSearch" placeholder="Αναζήτηση πιστοποιητικού..." /></div><select id="demoVisibility"><option value="">Όλη η ορατότητα</option><option value="shared">Διαθέσιμα σε συνεργάτες</option><option value="private">Ιδιωτικά</option></select><button class="ct-btn ct-btn-primary" data-demo-write><i data-lucide="plus"></i> Νέο πιστοποιητικό</button></section><section class="demo-real-kpis demo-real-kpis--compact">${stat('Πιστοποιητικά',d.stats.certificates,'Σύνολο','files')}${stat('Ενεργά',d.stats.active,'Σε ισχύ','circle-check')}${stat('Προς λήξη',d.stats.expiring,'Εντός 30 ημερών','clock-3')}${stat('Ληγμένα',d.stats.expired,'Χρειάζονται ενέργεια','circle-x')}</section><section><div class="demo-section-heading"><div><h2>Πιστοποιητικά</h2><p>Ισχύς και ορατότητα</p></div></div><div id="demoSupplierCertGrid" class="ct-certificate-list">${certificateGrid(d.certificates,'supplier')}</div></section>`;
  const q=document.getElementById('demoSupplierCertSearch'),vis=document.getElementById('demoVisibility');const filter=()=>{const t=q.value.toLowerCase(),v=vis.value;const list=d.certificates.filter(c=>(!t||c.title.toLowerCase().includes(t)||c.type.toLowerCase().includes(t))&&(!v||c.visibility===v));document.getElementById('demoSupplierCertGrid').innerHTML=certificateGrid(list,'supplier');bindDemoCertificateActions('supplier');};q.addEventListener('input',filter);vis.addEventListener('change',filter);bindWrites();bindDemoCertificateActions('supplier');
}
function supplierCertRows(certs){if(!certs.length)return `<div class="demo-empty-state"><i data-lucide="file-x-2"></i><strong>Δεν βρέθηκαν πιστοποιητικά</strong></div>`;return certs.map(c=>`<article class="ct-card demo-certificate-row"><div class="demo-file-icon"><i data-lucide="file-check-2"></i></div><div><h3>${c.title}</h3><small>${c.type} · λήξη ${fmt(c.expires)}</small></div><div class="demo-certificate-row__badges">${badge(c.visibility)}${badge(c.status)}</div><div class="demo-certificate-row__actions"><button data-demo-preview data-title="${c.title}"><i data-lucide="eye"></i> Προβολή</button><button data-demo-edit data-title="${c.title}" title="Επεξεργασία"><i data-lucide="pencil"></i></button></div></article>`).join('');}

function supplierDetail(){
  installDemoBanner('company');
  const index=Number(new URLSearchParams(location.search).get('demoSupplier')||0),s=demoData.company.suppliers[index]||demoData.company.suppliers[0],el=root();if(!el)return;
  const sample=[
    {title:'ISO 9001',type:'ISO 9001',status:'active',date:'2027-06-30'},
    {title:'ISO 13485',type:'ISO 13485',status:s.missing?'soon':'active',date:'2026-09-12'},
    {title:'Ασφάλιση αστικής ευθύνης',type:'Ασφάλιση',status:s.status==='critical'?'expired':'active',date:'2027-01-20'}
  ];
  const requirements=[
    {title:'ISO 9001',note:'Υποχρεωτικό',status:'active'},
    {title:'Ασφαλιστική ενημερότητα',note:'Υποχρεωτικό',status:s.missing?'critical':'active'},
    {title:'CE',note:'Όπου εφαρμόζεται',status:'active'}
  ];
  el.innerHTML=`
    <section class="ct-card ct-supplier-summary">
      <div class="ct-supplier-summary__head"><div class="demo-real-company"><span>${s.name.slice(0,2).toUpperCase()}</span><div><h2>${s.name}</h2><small>ΑΦΜ ${s.afm}</small></div></div>${badge(s.status)}</div>
      <div class="ct-supplier-summary__stats"><div><small>Compliance</small><strong>${s.score}%</strong></div><div><small>Πιστοποιητικά</small><strong>${s.certs}</strong></div><div><small>Προς λήξη</small><strong>${s.expiring}</strong></div><div><small>Ελλείψεις</small><strong>${s.missing}</strong></div></div>
    </section>
    <div class="ct-supplier-detail-grid">
      <section class="ct-card ct-supplier-panel"><div class="ct-panel-heading"><div><h2>Πιστοποιητικά προμηθευτή</h2><p>Μόνο τα έγγραφα που ο προμηθευτής έχει διαθέσει στην εταιρεία σας.</p></div></div>
        <div class="ct-compact-list">${sample.map(c=>`<article class="ct-compact-row"><div class="ct-certificate-main"><div class="ct-certificate-icon"><i data-lucide="file-text"></i></div><div class="ct-certificate-title"><strong>${c.title}</strong><span>${c.type} · Λήξη ${fmt(c.date)}</span></div></div><div>${badge(c.status)}</div><button class="ct-row-action" data-demo-preview data-title="${c.title}" title="Προβολή"><i data-lucide="eye"></i></button></article>`).join('')}</div>
      </section>
      <aside class="ct-card ct-supplier-panel"><div class="ct-panel-heading"><div><h2>Απαιτήσεις</h2><p>Τι χρειάζεται για πλήρη συμμόρφωση.</p></div></div>
        <div class="ct-compact-list">${requirements.map(r=>`<article class="ct-compact-row ct-compact-row--requirement"><div><strong>${r.title}</strong><span>${r.note}</span></div>${badge(r.status)}</article>`).join('')}</div>
      </aside>
    </div>`;
  bindDemoCertificateActions('supplier');window.lucide?.createIcons();
}

function profile(role){
  installDemoBanner(role);const el=root(),d=role==='company'?demoData.company:demoData.supplier;if(!el)return;
  el.innerHTML=`<section class="ct-card ct-profile-card demo-profile-card-v2"><div class="ct-panel-heading"><div><h2>Στοιχεία λογαριασμού</h2><p>Demo mode · μόνο για προβολή</p></div><span class="ct-status ct-status--neutral">Demo</span></div><div class="ct-profile-demo-grid"><label class="ct-field">Επωνυμία<input value="${d.name}" disabled></label><label class="ct-field">Email<input value="demo@certitrack.gr" disabled></label><label class="ct-field">ΑΦΜ<input value="${role==='company'?d.afm:'099999991'}" disabled></label></div><div class="ct-form-actions ct-form-actions--left"><button class="ct-btn ct-btn-secondary" data-demo-write><i data-lucide="key-round"></i> Αλλαγή κωδικού</button></div></section>`;bindWrites();
}

export function renderCompanyDashboardDemo(){companyDashboard();}
export function renderCompanySuppliersDemo(){companySuppliers();}
export function renderCompanyCertificatesDemo(){companyCertificates();}
export function renderSupplierCertificatesDemo(){supplierCertificates();}
export function renderSupplierDetailDemo(){supplierDetail();}
export function renderProfileDemo(role){profile(role);}
