// Derived views shared by organization pages (pure functions, unit tested).
import { certificateState } from '../../lib/format.js';

// Is my certificate visible to this partner right now?
export function visibleTo(cert, partnerId, now = new Date()) {
  if (cert.sharing === 'all_connections') return true;
  if (cert.sharing !== 'selected') return false;
  return (cert.shares || []).some(s => s.grantee_org_id === partnerId && (!s.expires_at || new Date(s.expires_at) > now));
}

// Best certificate of a type among the ones I can see (latest expiry wins).
export function bestOfType(certs, typeId) {
  return certs.filter(c => c.certificate_type_id === typeId)
    .sort((a, b) => String(b.expiry_date || '9999').localeCompare(String(a.expiry_date || '9999')))[0] || null;
}

// State of a document request from the requester's point of view.
// 'missing' | 'declined' | 'valid' | 'expiring' | 'expired'
export function requestState(request, visibleCerts) {
  if (request.status === 'declined') return 'declined';
  const cert = bestOfType(visibleCerts.filter(c => c.organization_id === request.responder_org_id), request.certificate_type_id);
  if (!cert) return 'missing';
  const s = certificateState(cert.expiry_date);
  return s === 'none' ? 'valid' : s;
}

export function coverage(states) {
  const total = states.length;
  const ok = states.filter(s => s === 'valid' || s === 'expiring').length;
  return { total, ok, pct: total ? Math.round((ok / total) * 100) : null, attention: states.filter(s => s !== 'valid').length };
}

export function splitConnections(rows) {
  return {
    active: rows.filter(c => c.status === 'active'),
    incoming: rows.filter(c => c.status === 'pending' && c.direction === 'incoming'),
    outgoing: rows.filter(c => c.status === 'pending' && c.direction === 'outgoing')
  };
}
