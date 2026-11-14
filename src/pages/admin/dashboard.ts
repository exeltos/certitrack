// Platform overview for the owner: organizations, connections and what needs a look.
import { api } from '../../api/index';
import { html, mount } from '../../lib/html';
import { t } from '../../lib/i18n';
import { relativeTime } from '../../lib/format';
import { definePage } from '../../app/page';
import { icon, avatar, emptyState, errorState } from '../../ui/components';
import { orgStatusBadge, connStatusBadge } from './data';

export default definePage({
  area: 'admin', nav: 'adminDashboard', title: 'admin.title', subtitle: 'admin.subtitle',
  async render({ content, signal }) {
    try {
      const [orgs, network, certs] = await Promise.all([api.adminOrganizations(), api.adminNetwork(), api.adminCertificates()]);
      if (signal.aborted) return;
      const active = network.filter(c => c.status === 'active');
      const pending = network.filter(c => c.status === 'pending');
      const openReqs = network.reduce((n, c) => n + Number(c.open_requests || 0), 0);
      const waiting = orgs.filter(o => o.status === 'pending_verification' || o.status === 'closure_requested');
      mount(content, html`
        <section class="kpis">
          <a class="kpi" href="/pages/admin/organizations.html"><span class="kpi__label">${icon('building', { size: 16 })}${t('nav.organizations')}</span><span class="kpi__value">${orgs.length}</span>
            <span class="kpi__meta">${t('admin.activeOrgs', { count: orgs.filter(o => o.status === 'active').length })}</span></a>
          <a class="kpi" href="/pages/admin/network.html"><span class="kpi__label">${icon('link-2', { size: 16 })}${t('admin.connections')}</span><span class="kpi__value">${active.length}</span>
            <span class="kpi__meta">${t('admin.pendingConnections', { count: pending.length })}</span></a>
          <div class="kpi"><span class="kpi__label">${icon('badge-check', { size: 16 })}${t('nav.certificates')}</span><span class="kpi__value">${certs.length}</span>
            <span class="kpi__meta">${t('admin.sharedCount', { count: certs.filter(c => c.sharing !== 'private').length })}</span></div>
          <div class="kpi"><span class="kpi__label">${icon('inbox', { size: 16 })}${t('admin.openRequests')}</span><span class="kpi__value">${openReqs}</span>
            <span class="kpi__meta">${t('admin.acrossNetwork')}</span></div>
        </section>
        <div class="grid-2">
          <section class="card"><div class="card__head"><div><h2>${t('admin.needsAttention')}</h2><p>${t('admin.needsAttentionText')}</p></div></div>
            ${waiting.length ? html`<ul class="rows">${waiting.map(o => html`<li><a class="row row--link" href="/pages/admin/organizations.html?id=${o.id}">${avatar(o.name)}
              <div class="row__main"><span class="row__title">${o.name}</span><span class="row__meta"><span>${t('common.vat')} ${o.vat_number}</span><span>${relativeTime(o.created_at)}</span></span></div>
              <div class="row__side">${orgStatusBadge(o.status)}</div></a></li>`)}</ul>` : emptyState({ iconName: 'circle-check', title: t('admin.nothingWaiting') })}</section>
          <section class="card"><div class="card__head"><div><h2>${t('admin.latestConnections')}</h2></div><a class="btn btn--sm btn--ghost" href="/pages/admin/network.html">${t('common.viewAll')}</a></div>
            ${network.length ? html`<ul class="rows">${network.slice(0, 6).map(c => html`<li class="row"><span class="row__icon">${icon('link-2')}</span>
              <div class="row__main"><span class="row__title">${c.requester_name} ↔ ${c.addressee_name}</span><span class="row__meta"><span>${relativeTime(c.created_at)}</span></span></div>
              <div class="row__side">${connStatusBadge(c.status)}</div></li>`)}</ul>` : emptyState({ iconName: 'network', title: t('admin.noConnections') })}</section>
        </div>`);
    } catch (err) { console.error(err); mount(content, errorState(err)); }
  }
});
