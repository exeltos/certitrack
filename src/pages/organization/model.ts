// Derived views shared by organization pages (pure functions, unit tested).
import { certificateState } from '../../lib/format';
import type { Certificate, Connection, DocumentRequest } from '../../types/domain';

export type RequestState = 'missing' | 'declined' | 'valid' | 'expiring' | 'expired';
type Visible = Pick<Certificate, 'organization_id' | 'certificate_type_id' | 'expiry_date'>;

// Is my certificate visible to this partner right now?
export function visibleTo(cert: Pick<Certificate, 'sharing' | 'shares'>, partnerId: string, now: Date = new Date()): boolean {
  if (cert.sharing === 'all_connections') return true;
  if (cert.sharing !== 'selected') return false;
  return (cert.shares || []).some(s => s.grantee_org_id === partnerId && (!s.expires_at || new Date(s.expires_at) > now));
}

// Best certificate of a type among the ones I can see (latest expiry wins).
export function bestOfType<T extends Visible>(certs: readonly T[], typeId: string): T | null {
  return certs.filter(c => c.certificate_type_id === typeId)
    .sort((a, b) => String(b.expiry_date || '9999').localeCompare(String(a.expiry_date || '9999')))[0] || null;
}

// State of a document request from the requester's point of view.
// 'missing' | 'declined' | 'valid' | 'expiring' | 'expired'
export function requestState(request: Pick<DocumentRequest, 'status' | 'responder_org_id' | 'certificate_type_id'>, visibleCerts: readonly Visible[]): RequestState {
  if (request.status === 'declined') return 'declined';
  const cert = bestOfType(visibleCerts.filter(c => c.organization_id === request.responder_org_id), request.certificate_type_id);
  if (!cert) return 'missing';
  const s = certificateState(cert.expiry_date);
  return s === 'none' ? 'valid' : s;
}

export function coverage(states: readonly RequestState[]): { total: number; ok: number; pct: number | null; attention: number } {
  const total = states.length;
  const ok = states.filter(s => s === 'valid' || s === 'expiring').length;
  return { total, ok, pct: total ? Math.round((ok / total) * 100) : null, attention: states.filter(s => s !== 'valid').length };
}

export function splitConnections<T extends Pick<Connection, 'status' | 'direction'>>(rows: readonly T[]): { active: T[]; incoming: T[]; outgoing: T[] } {
  return {
    active: rows.filter(c => c.status === 'active'),
    incoming: rows.filter(c => c.status === 'pending' && c.direction === 'incoming'),
    outgoing: rows.filter(c => c.status === 'pending' && c.direction === 'outgoing')
  };
}
