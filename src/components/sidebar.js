import { appUrl } from '../shared/paths.js';

const NAV = {
  organization: [
    { key: 'dashboard', label: 'Επισκόπηση', href: 'pages/organization/dashboard.html', icon: 'layout-dashboard' },
    { key: 'certificates', label: 'Πιστοποιητικά', href: 'pages/organization/certificates.html', icon: 'badge-check' },
    { key: 'partners', label: 'Συνεργάτες', href: 'pages/organization/partners.html', icon: 'users' },
    { key: 'compliance', label: 'Συμμόρφωση', href: 'pages/organization/compliance.html', icon: 'shield-check' },
    { key: 'profile', label: 'Ρυθμίσεις', href: 'pages/organization/profile.html', icon: 'settings' }
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
        <div class="ct-sidebar__label">${role === 'organization' ? 'ΟΡΓΑΝΙΣΜΟΣ' : 'ΔΙΑΧΕΙΡΙΣΗ'}</div>
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
