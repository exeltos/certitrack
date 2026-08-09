import { initTheme } from '../shared/theme.js';
import { initLanguage } from '../shared/i18n.js';
import { renderSidebar } from './sidebar.js';
import { renderPageHeader } from './pageHeader.js';
import { appUrl } from '../shared/paths.js';


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
  'auth-company-register': { public: true },
  'auth-supplier-register': { public: true },
  'auth-forgot': { public: true },
  'auth-reset': { public: true },
  'company-dashboard': { role: 'company', label: 'Εταιρεία' },
  'company-suppliers': { role: 'company', label: 'Εταιρεία' },
  'company-certificates': { role: 'company', label: 'Εταιρεία' },
  'company-compliance': { role: 'company', label: 'Εταιρεία' },
  'company-profile': { role: 'company', label: 'Εταιρεία' },
  'company-supplier': { role: 'company', label: 'Εταιρεία' },
  'supplier-certificates': { role: 'supplier', label: 'Προμηθευτής' },
  'supplier-companies': { role: 'supplier', label: 'Προμηθευτής' },
  'supplier-profile': { role: 'supplier', label: 'Προμηθευτής' },
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
    <a class="ct-btn ct-btn-ghost ct-btn-sm" href="${appUrl('pages/auth/company-register.html')}">Εγγραφή Εταιρείας</a>
    <a class="ct-btn ct-btn-ghost ct-btn-sm" href="${appUrl('pages/auth/supplier-register.html')}">Εγγραφή Προμηθευτή</a>
    <a class="ct-btn ct-btn-primary ct-btn-sm" href="${appUrl('pages/auth/login.html')}">Είσοδος</a>`;
  if (page === 'demo') return `
    <a class="ct-btn ct-btn-ghost ct-btn-sm" href="${appUrl('index.html')}">Αρχική</a>
    <a class="ct-btn ct-btn-primary ct-btn-sm" href="${appUrl('pages/auth/login.html')}">Είσοδος</a>`;
  if (page === 'auth-login') return `
    <a class="ct-btn ct-btn-ghost ct-btn-sm" href="${appUrl('index.html')}">Αρχική</a>
    <a class="ct-btn ct-btn-secondary ct-btn-sm" href="${appUrl('pages/auth/company-register.html')}">Εγγραφή</a>`;
  return `<a class="ct-btn ct-btn-ghost ct-btn-sm" href="${appUrl('index.html')}">Αρχική</a>`;
}

function privateActions(page, role) {
  const bits = [];
  if (page === 'company-certificates' || page === 'supplier-certificates') {
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
  return `<header class="ct-header">
    <div class="ct-header__inner">
      ${brand()}
      <div class="ct-header__context">
        ${!isPublic ? `<span class="ct-header__divider"></span><span class="ct-header__role">${meta.label || ''}</span>` : ''}
        <span id="companyHeader" class="hidden"></span>
        <span id="supplierHeader" class="hidden"></span>
        <span id="pageHeader" class="hidden"></span>
        <span id="companyName" class="hidden"></span>
        <span id="supplierCount" class="hidden"></span>
        <span id="userGreeting" class="hidden"></span>
        <span id="userTypeLabel" class="hidden"></span>
      </div>
      <nav class="ct-header__actions">
        ${isPublic ? publicActions(page) + languageButton() + themeButton() : privateActions(page, meta.role)}
      </nav>
    </div>
  </header>`;
}


const PAGE_NAV = {
  'company-dashboard': ['company', 'dashboard'],
  'company-suppliers': ['company', 'suppliers'],
  'company-certificates': ['company', 'certificates'],
  'company-compliance': ['company', 'compliance'],
  'company-profile': ['company', 'profile'],
  'company-supplier': ['company', 'suppliers'],
  'supplier-certificates': ['supplier', 'certificates'],
  'supplier-companies': ['supplier', 'companies'],
  'supplier-profile': ['supplier', 'profile'],
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
  document.body.classList.add('ct-auth-page');
}

export function renderFooter() {
  return `<footer class="ct-footer">
    <div class="ct-footer__inner">
      <div class="ct-footer__brand"><strong>CertiTrack</strong><span>Certificate & Supplier Compliance</span></div>
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
  if (window.lucide?.createIcons) window.lucide.createIcons();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAppShell, { once: true });
} else {
  initAppShell();
}
