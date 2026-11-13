// Small, reusable pieces of markup. All return SafeHtml (see src/lib/html.js).
import { html, raw } from '../lib/html.js';
import { ICONS } from './icons.js';
import { t, getLanguage } from '../lib/i18n.js';
import { certificateState, daysUntil, formatDate, initials } from '../lib/format.js';

export function icon(name, { size = 18, cls = '' } = {}) {
  const body = ICONS[name] || ICONS.info;
  return raw(`<svg class="icon ${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`);
}

export function badge(kind, text, { iconName } = {}) {
  return html`<span class="badge badge--${kind}">${iconName ? icon(iconName, { size: 14 }) : ''}${text}</span>`;
}

const STATE_KIND = { valid: 'success', expiring: 'warning', expired: 'danger', none: 'neutral' };
export function stateBadge(expiryDate) {
  const state = certificateState(expiryDate);
  return badge(STATE_KIND[state], t(`state.${state}`));
}

export function expiryText(expiryDate) {
  if (!expiryDate) return t('cert.noExpiry');
  const d = daysUntil(expiryDate);
  const when = formatDate(expiryDate);
  if (d < 0) return t('cert.expiredOn', { date: when });
  if (d === 0) return t('cert.expiresToday');
  if (d <= 60) return t('cert.expiresIn', { days: d, date: when });
  return t('cert.validUntil', { date: when });
}

const SHARING_ICON = { private: 'lock', all_connections: 'globe', selected: 'user-check' };
const SHARING_KIND = { private: 'neutral', all_connections: 'info', selected: 'accent' };
export function sharingBadge(cert) {
  const n = cert.shares?.length || 0;
  const text = cert.sharing === 'selected' ? t('sharing.selectedCount', { count: n }) : t(`sharing.${cert.sharing}`);
  return badge(SHARING_KIND[cert.sharing] || 'neutral', text, { iconName: SHARING_ICON[cert.sharing] });
}

export function avatar(name, { size = 'md' } = {}) {
  const hue = [...String(name)].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 360, 7);
  return html`<span class="avatar avatar--${size}" style="--avatar-hue:${hue}" aria-hidden="true">${initials(name)}</span>`;
}

export function emptyState({ iconName = 'inbox', title, text, action }) {
  return html`<div class="empty">
    <span class="empty__icon">${icon(iconName, { size: 22 })}</span>
    <strong>${title}</strong>${text ? html`<p>${text}</p>` : ''}${action || ''}
  </div>`;
}

export function loading(text = t('common.loading')) {
  return html`<div class="loading" role="status"><span class="spinner"></span>${text}</div>`;
}

export function errorState(err) {
  return emptyState({ iconName: 'circle-alert', title: t('common.loadFailed'), text: friendlyError(err) });
}

export function typeName(type) {
  if (!type) return '—';
  return (getLanguage() === 'en' ? type.name_en : type.name) || type.name || type.code;
}

export function certTypeLabel(cert) {
  return cert.custom_type_label || typeName(cert.type);
}

// Map database/business errors to readable messages.
const ERROR_KEYS = [
  ['Connection already exists', 'error.connectionExists'],
  ['own organization', 'error.ownOrganization'],
  ['No registered organization', 'error.noOrganizationUseEmail'],
  ['Too many', 'error.rateLimited'],
  ['already requested', 'error.alreadyRequested'],
  ['does not match', 'error.typeMismatch'],
  ['has no PDF', 'error.noPdf'],
  ['Only organization owners/admins', 'error.ownersOnly'],
  ['Insufficient permission', 'error.permission'],
  ['permission denied', 'error.permission'],
  ['Invalid login', 'error.invalidLogin'],
  ['invalid_credentials', 'error.invalidLogin'],
  ['Email not confirmed', 'error.emailNotConfirmed'],
  ['VAT number already exists', 'error.vatExists'],
  ['already registered', 'error.emailExists'],
  ['wrong_password', 'error.wrongPassword'],
  ['demo_readonly', 'error.demoReadonly'],
  ['Network error', 'error.network'],
  ['Failed to fetch', 'error.network'],
  ['Can only share', 'error.shareNotConnected']
];
export function friendlyError(err) {
  const msg = String(err?.message || err || '');
  const hit = ERROR_KEYS.find(([needle]) => msg.toLowerCase().includes(needle.toLowerCase()) || err?.code === needle);
  return hit ? t(hit[1]) : t('error.generic');
}
