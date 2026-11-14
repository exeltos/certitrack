// Activity log: every change recorded on the platform.
import { api } from '../../api/index';
import { html, mount, raw } from '../../lib/html';
import { t, isMessageKey } from '../../lib/i18n';
import { formatDateTime } from '../../lib/format';
import { definePage } from '../../app/page';
import { icon, badge, emptyState, errorState, type BadgeKind } from '../../ui/components';
import type { AuditEntry } from '../../types/domain';

const ACTION_KIND: Record<string, BadgeKind> = { insert: 'success', update: 'info', delete: 'danger' };

const entityLabel = (entity: string) => { const key = `entity.${entity}`; return isMessageKey(key) ? t(key) : entity; };

type JsonObject = Record<string, unknown>;
const asObject = (v: unknown): JsonObject | null => (v && typeof v === 'object' && !Array.isArray(v) ? v as JsonObject : null);

/** The fields an update changed (a few, for the table). */
function changed(r: AuditEntry): string {
  const before = asObject(r.old_data), after = asObject(r.new_data);
  if (!before || !after) return '';
  return Object.keys(after).filter(k => k !== 'updated_at' && k !== 'updated_by' && JSON.stringify(before[k]) !== JSON.stringify(after[k])).slice(0, 6).join(', ');
}
const reasonOf = (r: AuditEntry): string => { const reason = asObject(r.metadata)?.reason; return typeof reason === 'string' ? reason : ''; };

export default definePage({
  area: 'admin', nav: 'audit', title: 'admin.auditTitle', subtitle: 'admin.auditSubtitle',
  async render({ content, signal }) {
    let q = '';
    let entity = 'all';
    try {
      const [rows, orgs] = await Promise.all([api.adminAudit(), api.adminOrganizations()]);
      if (signal.aborted) return;
      const orgName = new Map(orgs.map(o => [o.id, o.name]));
      const nameOf = (id: string | null | undefined) => (id ? orgName.get(id) : undefined) || '';
      const renderTable = () => {
        const list = rows.filter(r => (entity === 'all' || r.entity_type === entity) &&
          `${r.action} ${r.entity_type} ${nameOf(r.organization_id)} ${changed(r)}`.toLowerCase().includes(q.toLowerCase()));
        mount(content.querySelector('[data-table]'), list.length ? html`<div class="table-wrap"><table class="table">
          <thead><tr><th>${t('admin.colWhen')}</th><th>${t('admin.colOrg')}</th><th>${t('admin.colAction')}</th><th>${t('admin.colEntity')}</th><th>${t('admin.colChanges')}</th></tr></thead>
          <tbody>${list.map(r => html`<tr><td style="white-space:nowrap">${formatDateTime(r.created_at)}</td><td>${nameOf(r.organization_id) || '—'}</td>
            <td>${badge(ACTION_KIND[r.action] ?? 'neutral', r.action)}</td><td>${entityLabel(r.entity_type)}</td><td class="muted">${changed(r) || reasonOf(r) || '—'}</td></tr>`)}</tbody></table></div>`
          : emptyState({ iconName: 'list-checks', title: t('common.noResults') }));
      };
      const entities = [...new Set(rows.map(r => r.entity_type))].sort();
      mount(content, html`<section class="card"><div class="toolbar">
        <label class="search">${icon('search', { size: 16 })}<span class="sr-only">${t('common.search')}</span><input class="input" type="search" data-q placeholder="${t('admin.searchAudit')}"></label>
        <select class="select" data-entity aria-label="${t('admin.colEntity')}"><option value="all">${t('admin.allEntities')}</option>${entities.map(e => html`<option value="${e}" ${e === entity ? raw('selected') : ''}>${entityLabel(e)}</option>`)}</select>
      </div><div data-table></div></section>`);
      content.querySelector('[data-q]')!.addEventListener('input', e => { q = (e.target as HTMLInputElement).value; renderTable(); });
      content.querySelector('[data-entity]')!.addEventListener('change', e => { entity = (e.target as HTMLSelectElement).value; renderTable(); });
      renderTable();
    } catch (err) { console.error(err); mount(content, errorState(err)); }
  }
});
