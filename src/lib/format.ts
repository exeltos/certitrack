// Dates and certificate status. Pure functions (unit tested).
export type CertificateState = 'valid' | 'expiring' | 'expired' | 'none';
type DateLike = string | Date | null | undefined;
import { getLanguage } from './i18n';

export const SOON_DAYS = 30;
const DAY = 86400000;

function startOfDay(d: string | Date): Date { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
const asDate = (v: string | Date): string | Date => (typeof v === 'string' && v.length === 10 ? `${v}T00:00:00` : v);

export function daysUntil(date: DateLike, now: Date = new Date()): number | null {
  if (!date) return null;
  const target = startOfDay(asDate(date));
  if (Number.isNaN(target.getTime())) return null;
  return Math.round((target.getTime() - startOfDay(now).getTime()) / DAY);
}

// 'none' (no expiry), 'expired', 'expiring' (within soonDays), 'valid'
export function certificateState(expiryDate: DateLike, now: Date = new Date(), soonDays: number = SOON_DAYS): CertificateState {
  const days = daysUntil(expiryDate, now);
  if (days === null) return 'none';
  if (days < 0) return 'expired';
  if (days <= soonDays) return 'expiring';
  return 'valid';
}

export function formatDate(value: DateLike): string {
  if (!value) return '—';
  const d = new Date(asDate(value));
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(getLanguage() === 'en' ? 'en-GB' : 'el-GR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function formatDateTime(value: DateLike): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString(getLanguage() === 'en' ? 'en-GB' : 'el-GR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function relativeTime(value: DateLike, now: Date = new Date()): string {
  if (!value) return '';
  const diff = Math.round((now.getTime() - new Date(value).getTime()) / 60000);
  const en = getLanguage() === 'en';
  if (diff < 1) return en ? 'just now' : 'μόλις τώρα';
  if (diff < 60) return en ? `${diff} min ago` : `πριν ${diff} λεπτά`;
  const h = Math.round(diff / 60);
  if (h < 24) return en ? `${h} h ago` : `πριν ${h} ώρ${h === 1 ? 'α' : 'ες'}`;
  const d = Math.round(h / 24);
  if (d < 30) return en ? `${d} d ago` : `πριν ${d} ημέρ${d === 1 ? 'α' : 'ες'}`;
  return formatDate(value);
}

export function initials(name: string | null | undefined = ''): string {
  return String(name).trim().split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '—';
}

export function normalizeVat(value: string = ''): string {
  return String(value).replace(/[^0-9A-Za-z]/g, '').toUpperCase();
}
