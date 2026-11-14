// Document-level pieces shared by every page, public and signed-in:
// theme, language, title, brand and the language/theme buttons.
import { html, type SafeHtml } from '../lib/html';
import { t, getLanguage, setLanguage, type MessageKey } from '../lib/i18n';
import { icon } from './components';
import { initMonitoring } from '../shared/monitoring';
import { redirectAuthCallback } from '../lib/authRedirect';

export const PATHS = {
  home: '/index.html',
  login: '/pages/auth/login.html',
  orgHome: '/pages/organization/dashboard.html',
  adminHome: '/pages/admin/dashboard.html'
} as const;

export function applyTheme(): void {
  let saved: string | null = null;
  try { saved = localStorage.getItem('theme'); } catch { /* storage unavailable */ }
  const dark = saved ? saved === 'dark' : window.matchMedia?.('(prefers-color-scheme: dark)').matches;
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
}

function toggleTheme(): void {
  const dark = document.documentElement.dataset.theme !== 'dark';
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  try { localStorage.setItem('theme', dark ? 'dark' : 'light'); } catch { /* storage unavailable */ }
}

function toggleLanguage(): void { setLanguage(getLanguage() === 'en' ? 'el' : 'en'); location.reload(); }

export function setTitle(text: string): void { document.title = `${text} · CertiTrack`; }

/** First call of every page. Throws (and navigates away) when a password-recovery link landed here. */
export function prepareDocument(titleKey?: MessageKey): void {
  if (redirectAuthCallback()) throw new Error('redirecting');
  applyTheme();
  void initMonitoring();
  document.documentElement.lang = getLanguage();
  if (titleKey) setTitle(t(titleKey));
}

export function utilityButtons(): SafeHtml {
  return html`
    <button type="button" class="icon-btn" data-action="language" title="${t('shell.language')}" aria-label="${t('shell.language')}">
      <span class="lang-code">${getLanguage() === 'en' ? 'ΕΛ' : 'EN'}</span></button>
    <button type="button" class="icon-btn" data-action="theme" title="${t('shell.theme')}" aria-label="${t('shell.theme')}">
      <span class="only-light">${icon('moon')}</span><span class="only-dark">${icon('sun')}</span></button>`;
}

export function bindUtilityButtons(root: ParentNode = document): void {
  root.querySelectorAll('[data-action=language]').forEach(b => b.addEventListener('click', toggleLanguage));
  root.querySelectorAll('[data-action=theme]').forEach(b => b.addEventListener('click', toggleTheme));
}

export const brand = (): SafeHtml => html`<a class="brand" href="${PATHS.home}" aria-label="CertiTrack">
  <span class="brand__mark">${icon('shield-check', { size: 18 })}</span><span class="brand__name">CertiTrack</span></a>`;
