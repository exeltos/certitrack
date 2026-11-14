// All organizations on the platform, with details and status changes.
import { api } from '../../api/index';
import { html, mount, raw } from '../../lib/html';
import { t } from '../../lib/i18n';
import { formatDate } from '../../lib/format';
import { fieldValue } from '../../lib/form';
import { definePage, type PageContext } from '../../app/page';
import { icon, avatar, emptyState, errorState } from '../../ui/components';
import { openDialog, toast } from '../../ui/dialog';
import { orgStatusBadge, connStatusBadge } from './data';
import type { AdminCertificate, NetworkEdge, Organization, OrganizationStatus } from '../../types/domain';

type StatusFilter = 'all' | OrganizationStatus;
const STATUS_FILTERS: readonly StatusFilter[] = ['all', 'active', 'pending_verification', 'closure_requested', 'suspended', 'closed'];
const SETTABLE = ['active', 'suspended', 'closed'] as const;
type SettableState = typeof SETTABLE[number];

export default definePage({
  area: 'admin', nav: 'organizations', title: 'admin.orgsTitle', subtitle: 'admin.orgsSubtitle',
  render: page => new OrganizationsPage(page).load()
});

class OrganizationsPage {
  private orgs: Organization[] = [];
  private network: NetworkEdge[] = [];
  private certs: AdminCertificate[] = [];
  private q = '';
  private status: StatusFilter = 'all';

  constructor(private readonly page: PageContext) {
    page.content.addEventListener('click', e => {
      const b = (e.target as Element).closest<HTMLElement>('[data-open]');
      const org = b && this.orgs.find(o => o.id === b.dataset.open);
      if (org) void this.details(org);
    });
  }

  async load(): Promise<void> {
    const { content, signal } = this.page;
    try {
      [this.orgs, this.network, this.certs] = await Promise.all([api.adminOrganizations(), api.adminNetwork(), api.adminCertificates()]);
      if (signal.aborted) return;
      const count = (s: OrganizationStatus) => this.orgs.filter(o => o.status === s).length;
      mount(content, html`<section class="card">
        <div class="toolbar">
          <label class="search">${icon('search', { size: 16 })}<span class="sr-only">${t('common.search')}</span><input class="input" type="search" data-q placeholder="${t('admin.searchOrgFull')}" value="${this.q}"></label>
          <select class="select" data-status aria-label="${t('admin.colStatus')}">${STATUS_FILTERS.map(s => html`<option value="${s}" ${s === this.status ? raw('selected') : ''}>${s === 'all' ? t('admin.allStatuses', { count: this.orgs.length }) : `${t(`orgStatusShort.${s}`)} (${count(s)})`}</option>`)}</select>
        </div><div data-table></div></section>`);
      content.querySelector('[data-q]')!.addEventListener('input', e => { this.q = (e.target as HTMLInputElement).value; this.renderTable(); });
      content.querySelector('[data-status]')!.addEventListener('change', e => { this.status = (e.target as HTMLSelectElement).value as StatusFilter; this.renderTable(); });
      this.renderTable();
      const focus = new URLSearchParams(location.search).get('id');
      const org = focus ? this.orgs.find(o => o.id === focus) : undefined;
      if (org) { history.replaceState(null, '', location.pathname); void this.details(org); }
    } catch (err) { console.error(err); mount(content, errorState(err)); }
  }

  private renderTable(): void {
    const q = this.q.toLowerCase();
    const list = this.orgs.filter(o => (this.status === 'all' || o.status === this.status) && `${o.name} ${o.vat_number} ${o.contact_email || ''}`.toLowerCase().includes(q));
    mount(this.page.content.querySelector('[data-table]'), list.length ? html`<div class="table-wrap"><table class="table">
      <thead><tr><th>${t('admin.colOrg')}</th><th>${t('common.vat')}</th><th>${t('admin.colStatus')}</th><th class="num">${t('admin.connections')}</th><th class="num">${t('nav.certificates')}</th><th>${t('admin.colCreated')}</th><th></th></tr></thead>
      <tbody>${list.map(o => html`<tr>
        <td><span class="cell-org">${avatar(o.name, { size: 'sm' })}<span><strong>${o.name}</strong><small>${o.contact_email || ''}</small></span></span></td>
        <td>${o.vat_number}</td><td>${orgStatusBadge(o.status)}</td>
        <td class="num">${this.network.filter(c => c.status === 'active' && (c.requester_id === o.id || c.addressee_id === o.id)).length}</td>
        <td class="num">${this.certs.filter(c => c.organization_id === o.id).length}</td>
        <td>${formatDate(o.created_at)}</td>
        <td><button class="btn btn--sm btn--ghost" data-open="${o.id}">${t('common.details')}</button></td></tr>`)}</tbody></table></div>`
      : emptyState({ iconName: 'building', title: t('common.noResults') }));
  }

  private async details(o: Organization): Promise<void> {
    const conns = this.network.filter(c => c.requester_id === o.id || c.addressee_id === o.id);
    const theirCerts = this.certs.filter(c => c.organization_id === o.id);
    const result = await openDialog<'changed'>({
      title: o.name, description: `${t('common.vat')} ${o.vat_number}`, wide: true, submitLabel: t('admin.applyState'),
      body: html`
        <dl class="facts facts--4">
          <div><dt>${t('admin.colStatus')}</dt><dd>${orgStatusBadge(o.status)}</dd></div>
          <div><dt>${t('org.contact_email')}</dt><dd>${o.contact_email || '—'}</dd></div>
          <div><dt>${t('org.city')}</dt><dd>${o.city || '—'}</dd></div>
          <div><dt>${t('admin.colCreated')}</dt><dd>${formatDate(o.created_at)}</dd></div>
        </dl>
        ${o.closure_reason ? html`<div class="callout callout--warning">${icon('triangle-alert')}<div><strong>${t('admin.closureReason')}</strong><p>${o.closure_reason}</p></div></div>` : ''}
        <div class="card"><div class="card__head"><h3>${t('admin.connectionsOf', { count: conns.length })}</h3></div>
          ${conns.length ? html`<ul class="rows">${conns.map(c => {
            const other = c.requester_id === o.id ? c.addressee_name : c.requester_name;
            return html`<li class="row" style="padding:10px 18px">${avatar(other, { size: 'sm' })}<div class="row__main"><span class="row__title">${other}</span></div><div class="row__side">${connStatusBadge(c.status)}</div></li>`;
          })}</ul>` : html`<p class="hint" style="padding:14px 18px">${t('admin.noConnections')}</p>`}</div>
        <div class="card"><div class="card__head"><h3>${t('admin.certificatesOf', { count: theirCerts.length })}</h3></div>
          ${theirCerts.length ? html`<ul class="rows">${theirCerts.map(c => html`<li class="row" style="padding:10px 18px"><span class="row__icon">${icon('file-text', { size: 16 })}</span><div class="row__main"><span class="row__title">${c.title}</span><span class="row__meta"><span>${formatDate(c.expiry_date)}</span><span>${t(`sharing.${c.sharing}`)}</span></span></div></li>`)}</ul>`
            : html`<p class="hint" style="padding:14px 18px">${t('admin.noCertificates')}</p>`}</div>
        <div class="form-grid form-grid--2">
          <div class="field"><label for="st">${t('admin.changeState')}</label><select class="select" id="st" name="state">
            ${SETTABLE.map(s => html`<option value="${s}" ${o.status === s ? raw('selected') : ''}>${t(`orgStatusShort.${s}`)}</option>`)}</select></div>
          <div class="field"><label for="rs">${t('admin.reason')}</label><input class="input" id="rs" name="reason" maxlength="500"></div>
        </div>`,
      async onSubmit(form) {
        const state = fieldValue(form, 'state') as SettableState;
        if (state === o.status) return;   // nothing to change: just close
        await api.adminSetOrganizationState(o.id, state, fieldValue(form, 'reason'));
        return 'changed' as const;
      }
    });
    if (result === 'changed') { toast(t('common.saved')); void this.load(); }
  }
}
