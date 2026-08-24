import { initTheme } from '../shared/theme.js';
import { initLanguage } from '../shared/i18n.js';
import { renderSidebar } from './sidebar.js';
import { renderPageHeader } from './pageHeader.js';
import { appUrl } from '../shared/paths.js';
import { initNotificationCenter } from './notificationCenter.js';
import { initMonitoring } from '../shared/monitoring.js';

initMonitoring();


function iconButton({ id = '', icon, label, danger = false, hidden = false }) {
  return `<button ${id ? `id="${id}"` : ''} type="button"
    class="ct-icon-btn${danger ? ' ct-icon-btn--danger' : ''}${hidden ? ' hidden' : ''}"
    aria-label="${label}" title="${label}">
    <i data-lucide="${icon}"></i>
  </button>`;
}

function languageButton() {
  return `<button id="language-toggle" type="button" class="ct-language-toggle" aria-label="Switch to English" title="Switch to English">
    <i data-lucide="languages"></i><span class="ct-language-code">EN</span>
  </button>`;
}

function themeButton() {
  return `<button id="theme-toggle" type="button" class="ct-icon-btn ct-theme-toggle" aria-label="Εναλλαγή σε σκούρο θέμα" title="Σκούρο θέμα" aria-pressed="false">
    <i id="icon-moon" data-lucide="moon"></i>
    <i id="icon-sun" data-lucide="sun" class="hidden"></i>
  </button>`;
}


const META = {
  home: { public: true },
  demo: { public: true },
  'auth-login': { public: true },
  'auth-register': { public: true },
  'auth-forgot': { public: true },
  'auth-reset': { public: true },
  'organization-dashboard': { role: 'organization', label: 'Οργανισμός' },
  'organization-certificates': { role: 'organization', label: 'Οργανισμός' },
  'organization-partners': { role: 'organization', label: 'Οργανισμός' },
  'organization-partner': { role: 'organization', label: 'Οργανισμός' },
  'organization-compliance': { role: 'organization', label: 'Οργανισμός' },
  'organization-profile': { role: 'organization', label: 'Οργανισμός' },
  'admin-dashboard': { role: 'admin', label: 'Platform Admin' },
  'admin-organizations': { role: 'admin', label: 'Platform Admin' },
  'admin-audit': { role: 'admin', label: 'Platform Admin' }
};

function brand() {
  return `<a href="${appUrl('index.html')}" class="ct-shell-brand" aria-label="CertiTrack αρχική">
    <span class="ct-shell-brand__mark" aria-hidden="true">CertiTrack</span>
  </a>`;
}

function publicActions(page) {
  if (page === 'home') return `
    <a class="ct-btn ct-btn-ghost ct-btn-sm" href="${appUrl('pages/auth/register.html')}">Εγγραφή Οργανισμού</a>
    <a class="ct-btn ct-btn-primary ct-btn-sm" href="${appUrl('pages/auth/login.html')}">Είσοδος</a>`;
  if (page === 'demo') return `
    <a class="ct-btn ct-btn-ghost ct-btn-sm" href="${appUrl('index.html')}">Αρχική</a>
    <a class="ct-btn ct-btn-primary ct-btn-sm" href="${appUrl('pages/auth/login.html')}">Είσοδος</a>`;
  if (page === 'auth-login') return `
    <a class="ct-btn ct-btn-ghost ct-btn-sm" href="${appUrl('index.html')}">Αρχική</a>
    <a class="ct-btn ct-btn-secondary ct-btn-sm" href="${appUrl('pages/auth/register.html')}">Εγγραφή</a>`;
  return `<a class="ct-btn ct-btn-ghost ct-btn-sm" href="${appUrl('index.html')}">Αρχική</a>`;
}

function privateActions(page, role) {
  const bits = [];
  if (role === 'organization') {
    bits.push(iconButton({ id: 'notifyBtn', icon: 'bell', label: 'Ειδοποιήσεις' }).replace('</button>', '<span id="notifyCount" class="ct-notify-count hidden"></span></button>'));
  }
  bits.push(languageButton());
  bits.push(themeButton());
  bits.push(iconButton({ id: 'logoutBtn', icon: 'log-out', label: 'Αποσύνδεση', danger: true }));
  return bits.join('');
}


function resolveHeader(page) {
  const meta = META[page] || { public: true };
  const isPublic = !!meta.public;
  const organizationContext = meta.role === 'organization'
    ? `<span class="ct-header__divider"></span><span class="ct-header__organization"><i data-lucide="building-2"></i><strong id="ctHeaderOrganizationName">Οργανισμός</strong></span>`
    : (!isPublic ? `<span class="ct-header__divider"></span><span class="ct-header__role">${meta.label || ''}</span>` : '');
  return `<header class="ct-header">
    <div class="ct-header__inner">
      ${brand()}
      <div class="ct-header__context">
        ${organizationContext}
        <span id="pageHeader" class="hidden"></span>
        <span id="userGreeting" class="hidden"></span>
      </div>
      <nav class="ct-header__actions">
        ${isPublic ? publicActions(page) + languageButton() + themeButton() : privateActions(page, meta.role)}
      </nav>
    </div>
  </header>`;
}


const PAGE_NAV = {
  'organization-dashboard': ['organization', 'dashboard'],
  'organization-certificates': ['organization', 'certificates'],
  'organization-partners': ['organization', 'partners'],
  'organization-partner': ['organization', 'partners'],
  'organization-compliance': ['organization', 'compliance'],
  'organization-profile': ['organization', 'profile'],
  'admin-dashboard': ['admin', 'dashboard'],
  'admin-organizations': ['admin', 'organizations'],
  'admin-audit': ['admin', 'audit']
};

function mountAuthenticatedLayout(page) {
  const nav = PAGE_NAV[page];
  const sidebarMount = document.getElementById('app-sidebar');
  if (!nav || !sidebarMount) return;
  sidebarMount.innerHTML = renderSidebar(nav[0], nav[1]);
  const pageHeaderMount = document.getElementById('app-page-header');
  if (pageHeaderMount) pageHeaderMount.innerHTML = renderPageHeader(page);
  document.body.classList.add('ct-auth-page', 'ct-app-body');
}


export function setOrganizationShellContext(organization = {}) {
  const name = organization.display_name || organization.legal_name || organization.name || 'Οργανισμός';
  const el = document.getElementById('ctHeaderOrganizationName');
  if (el) {
    el.textContent = name;
    el.title = name;
  }
}

export function renderFooter() {
  return `<footer class="ct-footer">
    <div class="ct-footer__inner">
      <div class="ct-footer__brand"><strong>CertiTrack</strong><span>Certificate & Partner Compliance</span></div>
      <div class="ct-footer__meta"><span>© ${new Date().getFullYear()} CertiTrack</span><span class="ct-footer__dot">•</span><span>Secure document management</span></div>
    </div>
  </footer>`;
}

export function initAppShell() {
  const page = document.body.dataset.page || 'home';
  const headerMount = document.getElementById('app-header');
  const footerMount = document.getElementById('app-footer');

  if (headerMount) headerMount.innerHTML = resolveHeader(page);
  if (footerMount) footerMount.innerHTML = renderFooter();
  mountAuthenticatedLayout(page);

  initTheme();
  initLanguage();
  if ((META[page] || {}).role === 'organization') initNotificationCenter();
  if (window.lucide?.createIcons) window.lucide.createIcons();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAppShell, { once: true });
} else {
  initAppShell();
}
