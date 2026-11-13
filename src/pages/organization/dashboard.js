import { api } from '../../api/index.js';
import { html, mount } from '../../lib/html.js';
import { t } from '../../lib/i18n.js';
import { certificateState, relativeTime, formatDate } from '../../lib/format.js';
import { startPage, setNavCount } from '../../ui/shell.js';
import { icon, avatar, badge, emptyState, errorState, typeName, expiryText } from '../../ui/components.js';
import { toast, toastError } from '../../ui/dialog.js';
import { requestState, splitConnections } from './model.js';

const { ctx, content } = await startPage({ area: 'organization', page: 'dashboard', title: 'dash.title', subtitle: 'dash.subtitle' });
const me = ctx.organization.id;

async function load() {
  const [certs, connections, requests, partnerCerts, views] = await Promise.all([
    api.myCertificates(), api.connections(), api.documentRequests(), api.visiblePartnerCertificates(), api.certificateViews({ limit: 6 })
  ]);
  return { certs, connections, requests, partnerCerts, views };
}

const REQ_KIND = { missing: 'neutral', declined: 'danger', valid: 'success', expiring: 'warning', expired: 'danger' };

function render({ certs, connections, requests, partnerCerts, views }) {
  const states = certs.map(c => certificateState(c.expiry_date));
  const expiring = certs.filter(c => certificateState(c.expiry_date) === 'expiring');
  const expired = certs.filter(c => certificateState(c.expiry_date) === 'expired');
  const { active, incoming } = splitConnections(connections);
  const nameOf = id => connections.find(c => c.partner_id === id)?.partner_name || '—';
  const askedOfMe = requests.filter(r => r.responder_org_id === me && r.status === 'open');
  const myAsks = requests.filter(r => r.requester_org_id === me).map(r => ({ ...r, state: requestState(r, partnerCerts) }));
  const partnerIssues = myAsks.filter(r => r.state !== 'valid');

  setNavCount('requests', askedOfMe.length);
  setNavCount('connections', incoming.length);

  const todo = [
    ...incoming.map(c => html`<li class="row">
      ${avatar(c.partner_name)}
      <div class="row__main"><span class="row__title">${c.partner_name}</span><span class="row__meta"><span>${t('dash.wantsToConnect')}</span><span>${relativeTime(c.created_at)}</span></span></div>
      <div class="row__side"><button class="btn btn--sm btn--secondary" data-decline="${c.id}">${t('common.decline')}</button><button class="btn btn--sm btn--primary" data-accept="${c.id}">${t('common.accept')}</button></div>
    </li>`),
    ...askedOfMe.map(r => html`<li><a class="row row--link" href="/pages/organization/requests.html?tab=incoming">
      <span class="row__icon row__icon--info">${icon('inbox')}</span>
      <div class="row__main"><span class="row__title">${t('dash.requestFrom', { org: nameOf(r.requester_org_id) })}</span>
        <span class="row__meta"><span>${typeName(r.type)}</span>${r.due_date ? html`<span>${t('req.due', { date: formatDate(r.due_date) })}</span>` : ''}</span></div>
      <div class="row__side"><span class="btn btn--sm btn--secondary">${t('req.respond')}</span></div></a></li>`),
    ...[...expired, ...expiring].map(c => html`<li><a class="row row--link" href="/pages/organization/certificates.html?focus=${c.id}">
      <span class="row__icon row__icon--${certificateState(c.expiry_date) === 'expired' ? 'danger' : 'warning'}">${icon(certificateState(c.expiry_date) === 'expired' ? 'triangle-alert' : 'clock')}</span>
      <div class="row__main"><span class="row__title">${c.title}</span><span class="row__meta"><span>${expiryText(c.expiry_date)}</span></span></div>
      <div class="row__side">${icon('chevron-right', { cls: 'chevron' })}</div></a></li>`)
  ];

  mount(content, html`
    <section class="kpis">
      <a class="kpi" href="/pages/organization/certificates.html"><span class="kpi__label">${icon('badge-check', { size: 16 })}${t('dash.kpiCertificates')}</span>
        <span class="kpi__value">${certs.length}</span><span class="kpi__meta">${t('dash.kpiValid', { count: states.filter(s => s === 'valid' || s === 'none').length })}</span></a>
      <a class="kpi ${expiring.length ? 'kpi--warning' : ''}" href="/pages/organization/certificates.html?state=expiring"><span class="kpi__label">${icon('clock', { size: 16 })}${t('dash.kpiExpiring')}</span>
        <span class="kpi__value">${expiring.length}</span><span class="kpi__meta">${t('dash.within30')}</span></a>
      <a class="kpi ${expired.length ? 'kpi--danger' : ''}" href="/pages/organization/certificates.html?state=expired"><span class="kpi__label">${icon('triangle-alert', { size: 16 })}${t('dash.kpiExpired')}</span>
        <span class="kpi__value">${expired.length}</span><span class="kpi__meta">${t('dash.needRenewal')}</span></a>
      <a class="kpi" href="/pages/organization/partners.html"><span class="kpi__label">${icon('users', { size: 16 })}${t('nav.connections')}</span>
        <span class="kpi__value">${active.length}</span><span class="kpi__meta">${incoming.length ? t('dash.pendingIncoming', { count: incoming.length }) : t('dash.activeConnections')}</span></a>
    </section>

    <div class="grid-2 grid-2--wide-left">
      <section class="card">
        <div class="card__head"><div><h2>${t('dash.todoTitle')}</h2><p>${t('dash.todoText')}</p></div></div>
        ${todo.length ? html`<ul class="rows">${todo}</ul>` : emptyState({ iconName: 'circle-check', title: t('dash.allClear'), text: t('dash.allClearText') })}
      </section>

      <div class="stack">
        <section class="card">
          <div class="card__head"><div><h2>${t('dash.partnersTitle')}</h2><p>${t('dash.partnersText')}</p></div>
            <a class="btn btn--sm btn--ghost" href="/pages/organization/requests.html">${t('common.viewAll')}</a></div>
          ${myAsks.length === 0
            ? emptyState({ iconName: 'inbox', title: t('dash.noAsks'), text: t('dash.noAsksText') })
            : partnerIssues.length === 0
              ? emptyState({ iconName: 'circle-check', title: t('dash.partnersOk'), text: t('dash.partnersOkText', { count: myAsks.length }) })
              : html`<ul class="rows">${partnerIssues.slice(0, 6).map(r => html`<li class="row">
                  ${avatar(nameOf(r.responder_org_id), { size: 'md' })}
                  <div class="row__main"><span class="row__title">${nameOf(r.responder_org_id)}</span><span class="row__meta"><span>${typeName(r.type)}</span></span></div>
                  <div class="row__side">${badge(REQ_KIND[r.state], t(`reqState.${r.state}`))}</div></li>`)}</ul>`}
        </section>

        <section class="card">
          <div class="card__head"><div><h2>${t('dash.viewsTitle')}</h2><p>${t('dash.viewsText')}</p></div></div>
          ${views.length ? html`<ul class="rows">${views.map(v => html`<li class="row">
              <span class="row__icon">${icon('eye')}</span>
              <div class="row__main"><span class="row__title">${v.viewer_org_name}</span><span class="row__meta"><span>${v.certificate?.title || '—'}</span><span>${relativeTime(v.viewed_at)}</span></span></div></li>`)}</ul>`
            : emptyState({ iconName: 'eye', title: t('dash.noViews'), text: t('dash.noViewsText') })}
        </section>
      </div>
    </div>`);

  content.querySelectorAll('[data-accept],[data-decline]').forEach(btn => btn.addEventListener('click', async () => {
    const accept = !!btn.dataset.accept;
    btn.disabled = true;
    try {
      await api.respondConnection(btn.dataset.accept || btn.dataset.decline, accept);
      toast(accept ? t('conn.accepted') : t('conn.declined'));
      refresh();
    } catch (err) { btn.disabled = false; toastError(err); }
  }));
}

async function refresh() {
  try { render(await load()); } catch (err) { console.error(err); mount(content, errorState(err)); }
}
refresh();
