import { describe, it, expect } from 'vitest';
import {
  daysUntil,
  certificateStatus,
  certificateStats,
  filterCertificatesByStatus,
  escapeHtml,
  storageObjectPath,
  hasRequiredAfm
} from '../../src/core/certificateCore.js';

const NOW = new Date('2026-08-24T00:00:00Z');

describe('daysUntil', () => {
  it('returns +Infinity when no date is given', () => {
    expect(daysUntil(null, NOW)).toBe(Number.POSITIVE_INFINITY);
    expect(daysUntil(undefined, NOW)).toBe(Number.POSITIVE_INFINITY);
  });

  it('returns +Infinity for an unparseable date', () => {
    expect(daysUntil('not-a-date', NOW)).toBe(Number.POSITIVE_INFINITY);
  });

  it('returns a positive count for a future date', () => {
    expect(daysUntil('2026-09-03T00:00:00Z', NOW)).toBe(10);
  });

  it('returns a negative count for a past date', () => {
    expect(daysUntil('2026-08-14T00:00:00Z', NOW)).toBe(-10);
  });

  it('returns 0 for today', () => {
    expect(daysUntil('2026-08-24T00:00:00Z', NOW)).toBe(0);
  });
});

describe('certificateStatus', () => {
  it('is "expired" once the date has passed', () => {
    expect(certificateStatus('2026-08-01T00:00:00Z', NOW)).toBe('expired');
  });

  it('is "soon" within the soonDays window', () => {
    expect(certificateStatus('2026-09-01T00:00:00Z', NOW, 30)).toBe('soon');
  });

  it('is "active" outside the soonDays window', () => {
    expect(certificateStatus('2026-12-01T00:00:00Z', NOW, 30)).toBe('active');
  });

  it('respects a custom soonDays threshold', () => {
    // 10 days out: "soon" under a 15-day window, "active" under a 5-day window
    expect(certificateStatus('2026-09-03T00:00:00Z', NOW, 15)).toBe('soon');
    expect(certificateStatus('2026-09-03T00:00:00Z', NOW, 5)).toBe('active');
  });

  it('treats a missing date as far in the future ("active")', () => {
    expect(certificateStatus(null, NOW)).toBe('active');
  });
});

describe('certificateStats', () => {
  it('returns zeroed stats for an empty list', () => {
    expect(certificateStats([], NOW)).toEqual({ total: 0, active: 0, soon: 0, expired: 0 });
  });

  it('tallies a mixed list correctly', () => {
    const certs = [
      { date: '2026-08-01T00:00:00Z' }, // expired
      { date: '2026-09-01T00:00:00Z' }, // soon
      { date: '2026-12-01T00:00:00Z' }, // active
      { date: '2026-12-15T00:00:00Z' }  // active
    ];
    expect(certificateStats(certs, NOW)).toEqual({ total: 4, active: 2, soon: 1, expired: 1 });
  });

  it('does not throw on malformed entries (missing/null certificate)', () => {
    const certs = [null, undefined, { date: '2026-08-01T00:00:00Z' }];
    expect(() => certificateStats(certs, NOW)).not.toThrow();
    expect(certificateStats(certs, NOW).total).toBe(3);
  });
});

describe('filterCertificatesByStatus', () => {
  const certs = [
    { id: 1, date: '2026-08-01T00:00:00Z' }, // expired
    { id: 2, date: '2026-09-01T00:00:00Z' }, // soon
    { id: 3, date: '2026-12-01T00:00:00Z' }  // active
  ];

  it('returns everything for "all"', () => {
    expect(filterCertificatesByStatus(certs, 'all', NOW)).toHaveLength(3);
  });

  it('filters to a single status', () => {
    expect(filterCertificatesByStatus(certs, 'expired', NOW).map(c => c.id)).toEqual([1]);
    expect(filterCertificatesByStatus(certs, 'soon', NOW).map(c => c.id)).toEqual([2]);
    expect(filterCertificatesByStatus(certs, 'active', NOW).map(c => c.id)).toEqual([3]);
  });
});

describe('escapeHtml', () => {
  it('escapes the five HTML-significant characters', () => {
    expect(escapeHtml(`<script>alert('x')&"y"</script>`)).toBe(
      '&lt;script&gt;alert(&#039;x&#039;)&amp;&quot;y&quot;&lt;/script&gt;'
    );
  });

  it('handles non-string input by coercing to string', () => {
    expect(escapeHtml(123)).toBe('123');
    expect(escapeHtml(undefined)).toBe('');
  });

  it('is idempotent-safe for plain text with no special characters', () => {
    expect(escapeHtml('Acme AE')).toBe('Acme AE');
  });
});

describe('storageObjectPath', () => {
  it('extracts the object path from a canonical Supabase public URL', () => {
    const url = 'https://klutmusrabsizqjnzwpu.supabase.co/storage/v1/object/public/organizationcertificates/org-1/cert-1/file.pdf';
    expect(storageObjectPath(url, 'organizationcertificates')).toBe('org-1/cert-1/file.pdf');
  });

  it('falls back to the last two path segments for a non-matching URL shape', () => {
    expect(storageObjectPath('https://example.com/foo/bar/baz.pdf', 'organizationcertificates')).toBe('bar/baz.pdf');
  });

  it('returns an empty string when no URL is given', () => {
    expect(storageObjectPath('', 'organizationcertificates')).toBe('');
    expect(storageObjectPath(null, 'organizationcertificates')).toBe('');
  });
});

describe('hasRequiredAfm', () => {
  it('is false when the profile or afm is missing/blank', () => {
    expect(hasRequiredAfm(undefined)).toBe(false);
    expect(hasRequiredAfm({})).toBe(false);
    expect(hasRequiredAfm({ afm: '   ' })).toBe(false);
  });

  it('is true for a non-blank afm', () => {
    expect(hasRequiredAfm({ afm: '123456789' })).toBe(true);
  });
});
