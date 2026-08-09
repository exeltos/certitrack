const KEY = 'certitrack.demo.role';

export function getDemoRole() {
  const role = localStorage.getItem(KEY);
  return ['company','supplier','admin'].includes(role) ? role : null;
}

export function isDemo(role = null) {
  const current = getDemoRole();
  return Boolean(current && (!role || current === role));
}

export function enterDemo(role) {
  if (!['company','supplier','admin'].includes(role)) return;
  localStorage.setItem(KEY, role);
  const routes = {
    company: '/pages/company/dashboard.html',
    supplier: '/pages/supplier/certificates.html',
    admin: '/pages/admin/dashboard.html'
  };
  window.location.href = routes[role];
}

export function exitDemo() {
  localStorage.removeItem(KEY);
  window.location.href = '/index.html';
}

export function protectDemoWrites() {
  return Swal.fire({
    icon: 'info',
    title: 'Demo mode',
    text: 'Η ενέργεια είναι απενεργοποιημένη στο demo και δεν αλλάζει πραγματικά δεδομένα.',
    confirmButtonText: 'ΟΚ'
  });
}

export function installDemoBanner(role) {
  if (!isDemo(role) || document.getElementById('ct-demo-banner')) return;
  const banner = document.createElement('div');
  banner.id = 'ct-demo-banner';
  banner.className = 'ct-demo-banner';
  banner.innerHTML = `
    <div>
      <strong>DEMO MODE</strong>
      <span>Ενδεικτικά δεδομένα · καμία αλλαγή δεν αποθηκεύεται</span>
    </div>
    <div class="ct-demo-banner__actions">
      ${role !== 'company' ? '<button data-switch-demo="company">Εταιρεία</button>' : ''}
      ${role !== 'supplier' ? '<button data-switch-demo="supplier">Προμηθευτής</button>' : ''}
      <button id="ct-exit-demo">Έξοδος demo</button>
    </div>`;
  const header = document.getElementById('app-header');
  header?.insertAdjacentElement('afterend', banner);

  banner.querySelector('#ct-exit-demo')?.addEventListener('click', exitDemo);
  banner.querySelectorAll('[data-switch-demo]').forEach(btn => {
    btn.addEventListener('click', () => enterDemo(btn.dataset.switchDemo));
  });
}
