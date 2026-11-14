import { describe, it, expect } from 'vitest';
import { visibleTo, bestOfType, requestState, coverage, splitConnections } from '../../src/pages/organization/model';

const NOW = new Date('2026-11-13T10:00:00');
const day = (n: number) => new Date(NOW.getTime() + n * 86400000).toISOString().slice(0, 10);

describe('visibleTo (mirrors ct_org_can_view_certificate for my own certificates)', () => {
  it('private is never visible', () => expect(visibleTo({ sharing: 'private' as const }, 'b', NOW)).toBe(false));
  it('all_connections is visible to any partner', () => expect(visibleTo({ sharing: 'all_connections' as const }, 'b', NOW)).toBe(true));
  it('selected is visible only to listed partners whose share has not expired', () => {
    const cert = { sharing: 'selected' as const, shares: [
      { grantee_org_id: 'b', expires_at: null },
      { grantee_org_id: 'c', expires_at: '2026-11-01T00:00:00Z' }] };
    expect(visibleTo(cert, 'b', NOW)).toBe(true);
    expect(visibleTo(cert, 'c', NOW)).toBe(false);
    expect(visibleTo(cert, 'd', NOW)).toBe(false);
  });
});

describe('requestState', () => {
  const req = { responder_org_id: 'b', certificate_type_id: 'iso', status: 'open' as const };
  it('is missing when nothing of that type is visible', () => expect(requestState(req, [])).toBe('missing'));
  it('uses the latest-expiring visible certificate', () => {
    const certs = [
      { organization_id: 'b', certificate_type_id: 'iso', expiry_date: day(-5) },
      { organization_id: 'b', certificate_type_id: 'iso', expiry_date: day(300) }];
    expect(requestState(req, certs)).toBe('valid');
    expect(bestOfType(certs, 'iso')?.expiry_date).toBe(day(300));
  });
  it('ignores certificates of other organizations', () => {
    expect(requestState(req, [{ organization_id: 'c', certificate_type_id: 'iso', expiry_date: day(300) }])).toBe('missing');
  });
  it('reports declined requests', () => expect(requestState({ ...req, status: 'declined' as const }, [])).toBe('declined'));
});

describe('coverage / splitConnections', () => {
  it('counts valid and expiring as covered', () => {
    expect(coverage(['valid', 'expiring', 'expired', 'missing'])).toEqual({ total: 4, ok: 2, pct: 50, attention: 3 });
    expect(coverage([]).pct).toBeNull();
  });
  it('splits connections by status and direction', () => {
    const s = splitConnections([{ status: 'active' as const, direction: 'outgoing' as const }, { status: 'pending' as const, direction: 'incoming' as const }, { status: 'pending' as const, direction: 'outgoing' as const }]);
    expect([s.active.length, s.incoming.length, s.outgoing.length]).toEqual([1, 1, 1]);
  });
});
