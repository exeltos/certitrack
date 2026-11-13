import { api } from '../../api/index.js';
import { html, mount, raw } from '../../lib/html.js';
import { t } from '../../lib/i18n.js';
import { formatDateTime } from '../../lib/format.js';
import { startPage } from '../../ui/shell.js';
import { icon, badge, emptyState, errorState } from '../../ui/components.js';

const { content } = await startPage({ area: 'admin', page: 'audit', title: 'admin.auditTitle', subtitle: 'admin.auditSubtitle' });
let rows = [], orgName = new Map(), q = '', entity = 'all';
const ACTION_KIND = { insert: 'success', update: 'info', delete: 'danger' };

function changed(r) {
  if (!r.old_data || !r.new_data) return '';
  return Object.keys(r.new_data).filter(k => !['updated_at', 'updated_by'].includes(k) && JSON.stringify(r.old_data[k]) !== JSON.stringify(r.new_data[k])).slice(0, 6).join(', ');
}

function renderTable() {
  const list = rows.filter(r => (entity === 'all' || r.entity_type === entity) &&
    `${r.action} ${r.entity_type} ${orgName.get(r.organization_id) || ''} ${changed(r)}`.toLowerCase().includes(q.toLowerCase()));
  mount(content.querySelector('[data-table]'), list.length ? html`<div class="table-wrap"><table class="table">
    <thead><tr><th>${t('admin.colWhen')}</th><th>${t('admin.colOrg')}</th><th>${t('admin.colAction')}</th><th>${t('admin.colEntity')}</th><th>${t('admin.colChanges')}</th></tr></thead>
    <tbody>${list.map(r => html`<tr><td style="white-space:nowrap">${formatDateTime(r.created_at)}</td><td>${orgName.get(r.organization_id) || '—'}</td>
      <td>${badge(ACTION_KIND[r.action] || 'neutral', r.action)}</td><td>${t(`entity.${r.entity_type}`)}</td><td class="muted">${changed(r) || r.metadata?.reason || '—'}</td></tr>`)}</tbody></table></div>`
    : emptyState({ iconName: 'list-checks', title: t('common.noResults') }));
}

try {
  const [audit, orgs] = await Promise.all([api.adminAudit(), api.adminOrganizations()]);
  rows = audit; orgName = new Map(orgs.map(o => [o.id, o.name]));
  const entities = [...new Set(rows.map(r => r.entity_type))].sort();
  mount(content, html`<section class="card"><div class="toolbar">
    <label class="search">${icon('search', { size: 16 })}<span class="sr-only">${t('common.search')}</span><input class="input" type="search" data-q placeholder="${t('admin.searchAudit')}"></label>
    <select class="select" data-entity aria-label="${t('admin.colEntity')}"><option value="all">${t('admin.allEntities')}</option>${entities.map(e => html`<option value="${e}" ${e === entity ? raw('selected') : ''}>${t(`entity.${e}`)}</option>`)}</select>
  </div><div data-table></div></section>`);
  content.querySelector('[data-q]').addEventListener('input', e => { q = e.target.value; renderTable(); });
  content.querySelector('[data-entity]').addEventListener('change', e => { entity = e.target.value; renderTable(); });
  renderTable();
} catch (err) { console.error(err); mount(content, errorState(err)); }
