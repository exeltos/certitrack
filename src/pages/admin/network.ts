// Every connection on the platform (the owner sees the whole network).
import { api } from '../../api/index';
import { html, mount, raw } from '../../lib/html';
import { t } from '../../lib/i18n';
import { formatDate } from '../../lib/format';
import { definePage } from '../../app/page';
import { icon, avatar, emptyState, errorState } from '../../ui/components';
import { connStatusBadge } from './data';
import type { ConnectionStatus } from '../../types/domain';

type StatusFilter = 'all' | ConnectionStatus;
const STATUS_FILTERS: readonly StatusFilter[] = ['active', 'pending', 'ended', 'declined', 'cancelled', 'all'];

export default definePage({
  area: 'admin', nav: 'network', title: 'admin.networkTitle', subtitle: 'admin.networkSubtitle',
  async render({ content, signal }) {
    let q = '';
    let status: StatusFilter = 'active';
    try {
      const rows = await api.adminNetwork();
      if (signal.aborted) return;
      const renderTable = () => {
        const list = rows.filter(c => (status === 'all' || c.status === status) && `${c.requester_name} ${c.addressee_name}`.toLowerCase().includes(q.toLowerCase()));
        mount(content.querySelector('[data-table]'), list.length ? html`<div class="table-wrap"><table class="table">
          <thead><tr><th>${t('admin.colRequester')}</th><th></th><th>${t('admin.colAddressee')}</th><th>${t('admin.colStatus')}</th>
            <th class="num" title="${t('admin.sharedHint')}">${t('admin.colShared')}</th><th class="num">${t('admin.colOpenReqs')}</th><th>${t('admin.colSince')}</th></tr></thead>
          <tbody>${list.map(c => html`<tr>
            <td><span class="cell-org">${avatar(c.requester_name, { size: 'sm' })}<strong>${c.requester_name}</strong></span></td>
            <td>${icon('link-2', { size: 16, cls: 'chevron' })}</td>
            <td><span class="cell-org">${avatar(c.addressee_name, { size: 'sm' })}<strong>${c.addressee_name}</strong></span></td>
            <td>${connStatusBadge(c.status)}</td>
            <td class="num">${c.status === 'active' ? `${c.shared_by_requester} ⇄ ${c.shared_by_addressee}` : '—'}</td>
            <td class="num">${c.open_requests}</td>
            <td>${formatDate(c.responded_at || c.created_at)}</td></tr>`)}</tbody></table></div>`
          : emptyState({ iconName: 'network', title: t('common.noResults') }));
      };
      const count = (s: ConnectionStatus) => rows.filter(c => c.status === s).length;
      mount(content, html`<section class="card">
        <div class="toolbar">
          <label class="search">${icon('search', { size: 16 })}<span class="sr-only">${t('common.search')}</span><input class="input" type="search" data-q placeholder="${t('admin.searchOrg')}"></label>
          <select class="select" data-status aria-label="${t('admin.colStatus')}">${STATUS_FILTERS.map(s => html`<option value="${s}" ${s === status ? raw('selected') : ''}>${s === 'all' ? t('admin.allStatuses', { count: rows.length }) : `${t(`connStatus.${s}`)} (${count(s)})`}</option>`)}</select>
        </div><div data-table></div></section>`);
      content.querySelector('[data-q]')!.addEventListener('input', e => { q = (e.target as HTMLInputElement).value; renderTable(); });
      content.querySelector('[data-status]')!.addEventListener('change', e => { status = (e.target as HTMLSelectElement).value as StatusFilter; renderTable(); });
      renderTable();
    } catch (err) { console.error(err); mount(content, errorState(err)); }
  }
});
