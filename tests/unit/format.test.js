import { describe, it, expect, beforeAll } from 'vitest';

beforeAll(() => { globalThis.localStorage = { getItem: () => null, setItem: () => {} }; });
const load = () => import('../../src/lib/format');
const NOW = new Date('2026-11-13T10:00:00');

describe('daysUntil', () => {
  it('counts calendar days, ignoring the time of day', async () => {
    const { daysUntil } = await load();
    expect(daysUntil('2026-11-13', NOW)).toBe(0);
    expect(daysUntil('2026-11-14', NOW)).toBe(1);
    expect(daysUntil('2026-11-12', NOW)).toBe(-1);
  });
  it('returns null for missing or invalid dates', async () => {
    const { daysUntil } = await load();
    expect(daysUntil(null, NOW)).toBeNull();
    expect(daysUntil('not-a-date', NOW)).toBeNull();
  });
});

describe('certificateState', () => {
  it('classifies by days left', async () => {
    const { certificateState } = await load();
    expect(certificateState('2026-11-12', NOW)).toBe('expired');
    expect(certificateState('2026-11-13', NOW)).toBe('expiring');
    expect(certificateState('2026-12-13', NOW)).toBe('expiring');
    expect(certificateState('2026-12-14', NOW)).toBe('valid');
    expect(certificateState(null, NOW)).toBe('none');
  });
});

describe('initials / normalizeVat', () => {
  it('builds initials from up to two words', async () => {
    const { initials } = await load();
    expect(initials('MedSupply Α.Ε.')).toBe('MΑ');
    expect(initials('')).toBe('—');
  });
  it('normalizes VAT numbers', async () => {
    const { normalizeVat } = await load();
    expect(normalizeVat(' el 123-456-789 ')).toBe('EL123456789');
  });
});
