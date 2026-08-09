import { demoData } from './demoData.js';

const $ = (selector) => document.querySelector(selector);

function statusBadge(status) {
  const labels = {
    active: 'Ενεργό',
    soon: 'Προς λήξη',
    expired: 'Ληγμένο',
    compliant: 'Συμμορφωμένος',
    attention: 'Προσοχή',
    critical: 'Ελλείψεις',
    pending: 'Εκκρεμεί',
    blocked: 'Αποκλεισμένος',
    granted: 'Πρόσβαση',
    private: 'Προσωπικό',
    shared: 'Κοινόχρηστο'
  };
  return `<span class="demo-badge demo-badge--${status}">${labels[status] || status}</span>`;
}

function kpi(label, value, note, icon) {
  return `<article class="demo-kpi ct-card">
    <div class="demo-kpi__icon"><i data-lucide="${icon}"></i></div>
    <div>
      <div class="demo-kpi__value">${value}</div>
      <div class="demo-kpi__label">${label}</div>
      <div class="demo-kpi__note">${note}</div>
    </div>
  </article>`;
}

function renderCompany() {
  const d=demoData.company;
  $('#demoTitle').textContent=`Εταιρεία · ${d.name}`;
  $('#demoSubtitle').textContent='Προμηθευτές, πιστοποιητικά και συμμόρφωση σε μία εικόνα.';
  $('#demoKpis').innerHTML=[
    kpi('Προμηθευτές',d.stats.suppliers,'Συνδεδεμένοι συνεργάτες','users'),
    kpi('Συμμορφωμένοι',d.stats.compliant,'Χωρίς ενεργές ελλείψεις','shield-check'),
    kpi('Προς λήξη',d.stats.expiring,'Εντός 30 ημερών','clock-3'),
    kpi('Ελλείψεις',d.stats.missing,'Απαιτούν ενέργεια','triangle-alert')
  ].join('');

  $('#demoPrimaryTitle').textContent='Προμηθευτές που χρειάζονται προσοχή';
  $('#demoPrimary').innerHTML=d.suppliers.map(s=>`
    <div class="demo-list-row">
      <div class="demo-list-row__main">
        <div class="demo-avatar">${s.name.slice(0,2).toUpperCase()}</div>
        <div><strong>${s.name}</strong><small>ΑΦΜ ${s.afm} · ${s.certs} πιστοποιητικά</small></div>
      </div>
      <div class="demo-list-row__meta">
        <div class="demo-score"><span style="width:${s.score}%"></span></div>
        <strong>${s.score}%</strong>
        ${statusBadge(s.status)}
      </div>
    </div>`).join('');

  $('#demoSecondaryTitle').textContent='Πρόσφατη δραστηριότητα';
  $('#demoSecondary').innerHTML=d.activity.map(a=>`
    <div class="demo-activity">
      <span class="demo-activity__dot demo-activity__dot--${a.kind}"></span>
      <div><strong>${a.text}</strong><small>${a.time}</small></div>
    </div>`).join('');
}

function renderSupplier() {
  const d=demoData.supplier;
  $('#demoTitle').textContent=`Προμηθευτής · ${d.name}`;
  $('#demoSubtitle').textContent='Έλεγχος ισχύος, ορατότητας και εταιρειών που σας έχουν αποθηκευμένο.';
  $('#demoKpis').innerHTML=[
    kpi('Πιστοποιητικά',d.stats.certificates,'Σύνολο αρχείων','badge-check'),
    kpi('Ενεργά',d.stats.active,'Σε ισχύ','circle-check'),
    kpi('Προς λήξη',d.stats.expiring,'Εντός 30 ημερών','clock-3'),
    kpi('Εταιρείες',d.stats.companies,'Σας έχουν αποθηκευμένο','building-2')
  ].join('');

  $('#demoPrimaryTitle').textContent='Πιστοποιητικά';
  $('#demoPrimary').innerHTML=d.certificates.map(c=>`
    <div class="demo-list-row">
      <div class="demo-list-row__main">
        <div class="demo-file-icon"><i data-lucide="file-check-2"></i></div>
        <div><strong>${c.title}</strong><small>${c.type} · Λήξη ${new Date(c.expires).toLocaleDateString('el-GR')}</small></div>
      </div>
      <div class="demo-list-row__meta">${statusBadge(c.visibility)}${statusBadge(c.status)}</div>
    </div>`).join('');

  $('#demoSecondaryTitle').textContent='Οι εταιρείες μου';
  $('#demoSecondary').innerHTML=d.companies.map(c=>`
    <div class="demo-company-row">
      <div><strong>${c.name}</strong><small>ΑΦΜ ${c.afm}</small></div>
      ${statusBadge(c.access)}
    </div>`).join('');
}

function renderAdmin() {
  const d=demoData.admin;
  $('#demoTitle').textContent='Διαχείριση πλατφόρμας';
  $('#demoSubtitle').textContent='Συνολική εικόνα εταιρειών, προμηθευτών και λογαριασμών.';
  $('#demoKpis').innerHTML=[
    kpi('Εταιρείες',d.stats.companies,'Ενεργοί οργανισμοί','building'),
    kpi('Προμηθευτές',d.stats.suppliers,'Καταχωρημένοι','truck'),
    kpi('Χρήστες',d.stats.users,'Σύνολο λογαριασμών','users'),
    kpi('Λήξεις',d.stats.expiring,'Επόμενες 30 ημέρες','clock-3')
  ].join('');

  $('#demoPrimaryTitle').textContent='Οργανισμοί';
  $('#demoPrimary').innerHTML=d.organizations.map(o=>`
    <div class="demo-list-row">
      <div class="demo-list-row__main">
        <div class="demo-avatar">${o.name.slice(0,2).toUpperCase()}</div>
        <div><strong>${o.name}</strong><small>${o.type} · ${o.users} χρήστες</small></div>
      </div>
      <div class="demo-list-row__meta">${statusBadge(o.status)}</div>
    </div>`).join('');

  $('#demoSecondaryTitle').textContent='System health';
  $('#demoSecondary').innerHTML=`
    <div class="demo-health"><span>Authentication</span><strong>Operational</strong></div>
    <div class="demo-health"><span>Database / RLS</span><strong>Protected</strong></div>
    <div class="demo-health"><span>Storage</span><strong>Ready for private mode</strong></div>
    <div class="demo-health"><span>Email functions</span><strong>Configured</strong></div>`;
}

function render(role) {
  document.querySelectorAll('[data-demo-role]').forEach(btn=>btn.classList.toggle('is-active',btn.dataset.demoRole===role));
  if (role==='supplier') renderSupplier();
  else if (role==='admin') renderAdmin();
  else renderCompany();
  window.lucide?.createIcons();
}

document.addEventListener('DOMContentLoaded',()=>{
  document.querySelectorAll('[data-demo-role]').forEach(btn=>btn.addEventListener('click',()=>render(btn.dataset.demoRole)));
  render('company');
});
