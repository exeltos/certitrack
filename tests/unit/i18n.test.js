import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { el } from '../../src/i18n/el.js';
import { en } from '../../src/i18n/en.js';

function files(dir) {
  return readdirSync(dir).flatMap(f => statSync(join(dir, f)).isDirectory() ? files(join(dir, f)) : f.endsWith('.js') ? [join(dir, f)] : []);
}
const source = files('src').map(f => readFileSync(f, 'utf8')).join('\n');

describe('translations', () => {
  it('Greek and English have exactly the same keys', () => {
    expect(Object.keys(en).filter(k => !(k in el))).toEqual([]);
    expect(Object.keys(el).filter(k => !(k in en))).toEqual([]);
  });

  it('every literal key used in the code exists', () => {
    const used = new Set([...source.matchAll(/\bt\('([A-Za-z0-9_.]+)'/g)].map(m => m[1]));
    for (const m of source.matchAll(/\btitle: '([a-z]+\.[A-Za-z]+)'|\bsubtitle: '([a-z]+\.[A-Za-z]+)'|label: '([a-z]+\.[A-Za-z]+)'|titleKey: '([a-z]+\.[A-Za-z]+)'/g)) used.add(m[1] || m[2] || m[3] || m[4]);
    for (const m of source.matchAll(/\['[^']+', '(error\.[A-Za-z]+)'\]/g)) used.add(m[1]);
    expect([...used].filter(k => !(k in el))).toEqual([]);
  });

  it('dynamic key families are complete', () => {
    const families = {
      state: ['valid', 'expiring', 'expired', 'none'],
      sharing: ['private', 'all_connections', 'selected'],
      reqState: ['missing', 'declined', 'valid', 'expiring', 'expired'],
      reqStatus: ['open', 'fulfilled', 'declined', 'cancelled'],
      connStatus: ['active', 'pending', 'declined', 'cancelled', 'ended'],
      orgStatusShort: ['active', 'pending_verification', 'suspended', 'closure_requested', 'closed'],
      nav: ['dashboard', 'certificates', 'connections', 'requests', 'settings', 'adminDashboard', 'organizations', 'network', 'audit'],
      entity: ['organizations', 'organization_members', 'certificates', 'certificate_files', 'certificate_shares', 'connections', 'document_requests'],
      pw: ['length', 'upper', 'lower', 'number', 'symbol']
    };
    const missing = Object.entries(families).flatMap(([prefix, keys]) => keys.map(k => `${prefix}.${k}`)).filter(k => !(k in el));
    for (const s of ['pending_verification', 'suspended', 'closure_requested', 'closed']) for (const part of ['title', 'text']) if (!(`orgStatus.${s}.${part}` in el)) missing.push(`orgStatus.${s}.${part}`);
    for (const k of ['private', 'all_connections', 'selected']) if (!(`sharing.${k}.help` in el)) missing.push(`sharing.${k}.help`);
    expect(missing).toEqual([]);
  });

  it('placeholders match between languages', () => {
    const vars = s => [...String(s).matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort().join(',');
    expect(Object.keys(el).filter(k => vars(el[k]) !== vars(en[k]))).toEqual([]);
  });
});
