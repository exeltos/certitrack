import { api } from '../../api/index.js';
import { html, mount, raw } from '../../lib/html.js';
import { t } from '../../lib/i18n.js';
import { formatDate } from '../../lib/format.js';
import { startPage } from '../../ui/shell.js';
import { icon, avatar, emptyState, errorState } from '../../ui/components.js';
import { openDialog, toast } from '../../ui/dialog.js';
import { orgStatusBadge, connStatusBadge } from './data.js';

const { content } = await startPage({ area: 'admin', page: 'organizations', title: 'admin.orgsTitle', subtitle: 'admin.orgsSubtitle' });
let orgs = [], network = [], certs = [], q = '', status = 'all';

function renderTable() {
  const list = orgs.filter(o => (status === 'all' || o.status === status) && `${o.name} ${o.vat_number} ${o.contact_email || ''}`.toLowerCase().includes(q.toLowerCase()));
  mount(content.querySelector('[data-table]'), list.length ? html`<div class="table-wrap"><table class="table">
    <thead><tr><th>${t('admin.colOrg')}</th><th>${t('common.vat')}</th><th>${t('admin.colStatus')}</th><th class="num">${t('admin.connections')}</th><th class="num">${t('nav.certificates')}</th><th>${t('admin.colCreated')}</th><th></th></tr></thead>
    <tbody>${list.map(o => html`<tr>
      <td><span class="cell-org">${avatar(o.name, { size: 'sm' })}<span><strong>${o.name}</strong><small>${o.contact_email || ''}</small></span></span></td>
      <td>${o.vat_number}</td><td>${orgStatusBadge(o.status)}</td>
      <td class="num">${network.filter(c => c.status === 'active' && (c.requester_id === o.id || c.addressee_id === o.id)).length}</td>
      <td class="num">${certs.filter(c => c.organization_id === o.id).length}</td>
      <td>${formatDate(o.created_at)}</td>
      <td><button class="btn btn--sm btn--ghost" data-open="${o.id}">${t('common.details')}</button></td></tr>`)}</tbody></table></div>`
    : emptyState({ iconName: 'building', title: t('common.noResults') }));
}

async function details(o) {
  const conns = network.filter(c => c.requester_id === o.id || c.addressee_id === o.id);
  const theirCerts = certs.filter(c => c.organization_id === o.id);
  const result = await openDialog({
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
        ${conns.length ? html`<ul class="rows">${conns.map(c => { const other = c.requester_id === o.id ? c.addressee_name : c.requester_name;
          return html`<li class="row" style="padding:10px 18px">${avatar(other, { size: 'sm' })}<div class="row__main"><span class="row__title">${other}</span></div><div class="row__side">${connStatusBadge(c.status)}</div></li>`; })}</ul>`
          : html`<p class="hint" style="padding:14px 18px">${t('admin.noConnections')}</p>`}</div>
      <div class="card"><div class="card__head"><h3>${t('admin.certificatesOf', { count: theirCerts.length })}</h3></div>
        ${theirCerts.length ? html`<ul class="rows">${theirCerts.map(c => html`<li class="row" style="padding:10px 18px"><span class="row__icon">${icon('file-text', { size: 16 })}</span><div class="row__main"><span class="row__title">${c.title}</span><span class="row__meta"><span>${formatDate(c.expiry_date)}</span><span>${t(`sharing.${c.sharing}`)}</span></span></div></li>`)}</ul>`
          : html`<p class="hint" style="padding:14px 18px">${t('admin.noCertificates')}</p>`}</div>
      <div class="form-grid form-grid--2">
        <div class="field"><label for="st">${t('admin.changeState')}</label><select class="select" id="st" name="state">
          ${['active', 'suspended', 'closed'].map(s => html`<option value="${s}" ${o.status === s ? raw('selected') : ''}>${t(`orgStatusShort.${s}`)}</option>`)}</select></div>
        <div class="field"><label for="rs">${t('admin.reason')}</label><input class="input" id="rs" name="reason" maxlength="500"></div>
      </div>`,
    async onSubmit(form) {
      if (form.state.value === o.status) return true;
      await api.adminSetOrganizationState(o.id, form.state.value, form.reason.value.trim());
      return 'changed';
    }
  });
  if (result === 'changed') { toast(t('common.saved')); load(); }
}

async function load() {
  try {
    [orgs, network, certs] = await Promise.all([api.adminOrganizations(), api.adminNetwork(), api.adminCertificates()]);
    const count = s => orgs.filter(o => o.status === s).length;
    mount(content, html`<section class="card">
      <div class="toolbar">
        <label class="search">${icon('search', { size: 16 })}<span class="sr-only">${t('common.search')}</span><input class="input" type="search" data-q placeholder="${t('admin.searchOrgFull')}" value="${q}"></label>
        <select class="select" data-status aria-label="${t('admin.colStatus')}">${['all', 'active', 'pending_verification', 'closure_requested', 'suspended', 'closed'].map(s => html`<option value="${s}" ${s === status ? raw('selected') : ''}>${s === 'all' ? t('admin.allStatuses', { count: orgs.length }) : `${t(`orgStatusShort.${s}`)} (${count(s)})`}</option>`)}</select>
      </div><div data-table></div></section>`);
    content.querySelector('[data-q]').addEventListener('input', e => { q = e.target.value; renderTable(); });
    content.querySelector('[data-status]').addEventListener('change', e => { status = e.target.value; renderTable(); });
    renderTable();
    const focus = new URLSearchParams(location.search).get('id');
    if (focus && orgs.find(o => o.id === focus)) { history.replaceState(null, '', location.pathname); details(orgs.find(o => o.id === focus)); }
  } catch (err) { console.error(err); mount(content, errorState(err)); }
}
content.addEventListener('click', e => { const b = e.target.closest('[data-open]'); if (b) details(orgs.find(o => o.id === b.dataset.open)); });
load();
