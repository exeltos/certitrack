// Small, reusable pieces of markup. All return SafeHtml (see src/lib/html.js).
import { html, raw, type SafeHtml, type Renderable } from '../lib/html';
import { ICONS } from './icons';
import { t, getLanguage, type MessageKey } from '../lib/i18n';
import { certificateState, daysUntil, formatDate, initials, type CertificateState } from '../lib/format';
import type { Certificate, CertificateType, Sharing } from '../types/domain';

export type BadgeKind = 'success' | 'warning' | 'danger' | 'info' | 'accent' | 'neutral';

export function icon(name: string, { size = 18, cls = '' }: { size?: number; cls?: string } = {}): SafeHtml {
  const body = ICONS[name] || ICONS.info;
  return raw(`<svg class="icon ${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`);
}

export function badge(kind: BadgeKind, text: string, { iconName }: { iconName?: string } = {}): SafeHtml {
  return html`<span class="badge badge--${kind}">${iconName ? icon(iconName, { size: 14 }) : ''}${text}</span>`;
}

const STATE_KIND: Record<CertificateState, BadgeKind> = { valid: 'success', expiring: 'warning', expired: 'danger', none: 'neutral' };
export function stateBadge(expiryDate: string | null | undefined): SafeHtml {
  const state = certificateState(expiryDate);
  return badge(STATE_KIND[state], t(`state.${state}`));
}

export function expiryText(expiryDate: string | null | undefined): string {
  if (!expiryDate) return t('cert.noExpiry');
  const d = daysUntil(expiryDate) ?? 0;
  const when = formatDate(expiryDate);
  if (d < 0) return t('cert.expiredOn', { date: when });
  if (d === 0) return t('cert.expiresToday');
  if (d <= 60) return t('cert.expiresIn', { days: d, date: when });
  return t('cert.validUntil', { date: when });
}

const SHARING_ICON: Record<Sharing, string> = { private: 'lock', all_connections: 'globe', selected: 'user-check' };
const SHARING_KIND: Record<Sharing, BadgeKind> = { private: 'neutral', all_connections: 'info', selected: 'accent' };
export function sharingBadge(cert: Pick<Certificate, 'sharing' | 'shares'>): SafeHtml {
  const n = cert.shares?.length || 0;
  const text = cert.sharing === 'selected' ? t('sharing.selectedCount', { count: n }) : t(`sharing.${cert.sharing}`);
  return badge(SHARING_KIND[cert.sharing], text, { iconName: SHARING_ICON[cert.sharing] });
}

export function avatar(name: string, { size = 'md' }: { size?: 'sm' | 'md' | 'lg' } = {}): SafeHtml {
  const hue = [...String(name)].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 360, 7);
  return html`<span class="avatar avatar--${size}" style="--avatar-hue:${hue}" aria-hidden="true">${initials(name)}</span>`;
}

export function emptyState({ iconName = 'inbox', title, text, action }: { iconName?: string; title: string; text?: string; action?: Renderable }): SafeHtml {
  return html`<div class="empty">
    <span class="empty__icon">${icon(iconName, { size: 22 })}</span>
    <strong>${title}</strong>${text ? html`<p>${text}</p>` : ''}${action || ''}
  </div>`;
}

export function loading(text: string = t('common.loading')): SafeHtml {
  return html`<div class="loading" role="status"><span class="spinner"></span>${text}</div>`;
}

export function errorState(err: unknown): SafeHtml {
  return emptyState({ iconName: 'circle-alert', title: t('common.loadFailed'), text: friendlyError(err) });
}

export function typeName(type: Pick<CertificateType, 'name' | 'name_en' | 'code'> | Pick<CertificateType, 'name' | 'name_en'> | null | undefined): string {
  if (!type) return '—';
  return (getLanguage() === 'en' ? type.name_en : type.name) || type.name || ('code' in type ? type.code : '—');
}

export function certTypeLabel(cert: Pick<Certificate, 'custom_type_label' | 'type'>): string {
  return cert.custom_type_label || typeName(cert.type);
}

// Map database/business errors to readable messages.
const ERROR_KEYS: [needle: string, key: MessageKey][] = [
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
export function friendlyError(err: unknown): string {
  const e = (err ?? {}) as { message?: string; code?: string };
  const msg = String(e.message || err || '');
  const hit = ERROR_KEYS.find(([needle]) => msg.toLowerCase().includes(needle.toLowerCase()) || e.code === needle);
  return hit ? t(hit[1]) : t('error.generic');
}
