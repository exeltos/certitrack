import { appUrl } from '../shared/paths.js';

const NAV = {
  company: [
    { key: 'dashboard', label: 'Επισκόπηση', href: 'pages/company/dashboard.html', icon: 'layout-dashboard' },
    { key: 'suppliers', label: 'Προμηθευτές', href: 'pages/company/suppliers.html', icon: 'users' },
    { key: 'certificates', label: 'Πιστοποιητικά', href: 'pages/company/certificates.html', icon: 'badge-check' },
    { key: 'compliance', label: 'Συμμόρφωση', href: 'pages/company/compliance.html', icon: 'shield-check' },
    { key: 'profile', label: 'Ρυθμίσεις', href: 'pages/company/profile.html', icon: 'settings' }
  ],
  supplier: [
    { key: 'certificates', label: 'Πιστοποιητικά', href: 'pages/supplier/certificates.html', icon: 'badge-check' },
    { key: 'companies', label: 'Οι εταιρείες μου', href: 'pages/supplier/companies.html', icon: 'building-2' },
    { key: 'profile', label: 'Ρυθμίσεις', href: 'pages/supplier/profile.html', icon: 'settings' }
  ],
  admin: [
    { key: 'dashboard', label: 'Επισκόπηση', href: 'pages/admin/dashboard.html', icon: 'layout-dashboard' },
    { key: 'organizations', label: 'Οργανισμοί', href: 'pages/admin/organizations.html', icon: 'building-2' },
    { key: 'audit', label: 'Audit log', href: 'pages/admin/audit.html', icon: 'shield-check' }
  ]
};

export function renderSidebar(role, active = '') {
  const items = NAV[role] || [];
  if (!items.length) return '';

  return `
    <aside class="ct-sidebar" aria-label="Κύρια πλοήγηση" data-nav-count="${Math.min(items.length, 5)}">
      <div class="ct-sidebar__inner">
        <div class="ct-sidebar__label">${role === 'company' ? 'ΕΤΑΙΡΕΙΑ' : role === 'supplier' ? 'ΠΡΟΜΗΘΕΥΤΗΣ' : 'ΔΙΑΧΕΙΡΙΣΗ'}</div>
        <nav class="ct-sidebar__nav">
          ${items.map(item => `
            <a href="${appUrl(item.href)}" class="ct-nav-item ${item.key === active ? 'is-active' : ''}" ${item.key === active ? 'aria-current="page"' : ''}>
              <i data-lucide="${item.icon}" class="ct-nav-item__icon"></i>
              <span>${item.label}</span>
            </a>`).join('')}
        </nav>
      </div>
    </aside>`;
}
