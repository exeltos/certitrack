import { api } from '../../api/index';
import { html, mount } from '../../lib/html';
import { t } from '../../lib/i18n';
import { formatDate, relativeTime, daysUntil } from '../../lib/format';
import { startPage, setNavCount } from '../../ui/shell';
import { icon, avatar, badge, emptyState, errorState, typeName, expiryText } from '../../ui/components';
import { confirmDialog, toast, toastError } from '../../ui/dialog';
import { requestState, bestOfType, coverage } from './model';
import { askDialog, respondDialog } from './requestForms';

const { ctx, content, actions } = await startPage({ area: 'organization', page: 'requests', title: 'req.title', subtitle: 'req.subtitle' });
const me = ctx.organization.id;
const canEdit = ['owner', 'admin', 'member'].includes(ctx.role);
let tab = new URLSearchParams(location.search).get('tab') || null;
let d;

const REQ_KIND = { missing: 'neutral', declined: 'danger', valid: 'success', expiring: 'warning', expired: 'danger' };
const STATE_ICON = { missing: 'clock', declined: 'circle-alert', valid: 'circle-check', expiring: 'clock', expired: 'triangle-alert' };

if (canEdit) {
  mount(actions, html`<button class="btn btn--primary" data-ask>${icon('send')}${t('req.askButton')}</button>`);
  actions.querySelector('[data-ask]').addEventListener('click', async () => {
    if (!d.active.length) { toast(t('req.needConnection'), 'info'); return; }
    try { if (await askDialog({ connections: d.active, types: d.types })) { toast(t('req.sent')); tab = 'outgoing'; refresh(); } } catch (err) { toastError(err); }
  });
}

const partnerName = id => d.connections.find(c => c.partner_id === id)?.partner_name || '—';

function incomingTab() {
  const list = d.requests.filter(r => r.responder_org_id === me);
  if (!list.length) return emptyState({ iconName: 'inbox', title: t('req.incomingEmpty'), text: t('req.incomingEmptyText') });
  const open = list.filter(r => r.status === 'open'), done = list.filter(r => r.status !== 'open');
  const row = r => {
    const due = r.due_date ? daysUntil(r.due_date) : null;
    return html`<li class="row">${avatar(partnerName(r.requester_org_id))}
      <div class="row__main"><span class="row__title">${t('req.asksFor', { org: partnerName(r.requester_org_id), type: typeName(r.type) })}</span>
        <span class="row__meta"><span>${relativeTime(r.created_at)}</span>${r.due_date ? html`<span class="${due !== null && due < 0 ? 'badge badge--danger' : ''}">${t('req.due', { date: formatDate(r.due_date) })}</span>` : ''}${r.note ? html`<span>“${r.note}”</span>` : ''}</span></div>
      <div class="row__side">${r.status === 'open'
        ? (canEdit ? html`<button class="btn btn--sm btn--primary" data-respond="${r.id}">${t('req.respond')}</button>` : badge('warning', t('req.awaitingYou')))
        : badge(r.status === 'declined' ? 'danger' : 'success', t(`reqStatus.${r.status}`))}</div></li>`;
  };
  return html`${open.length ? html`<div class="section-label">${t('req.openSection', { count: open.length })}</div><ul class="rows">${open.map(row)}</ul>` : ''}
    ${done.length ? html`<div class="section-label">${t('req.doneSection')}</div><ul class="rows">${done.map(row)}</ul>` : ''}`;
}

function outgoingTab() {
  const mine = d.requests.filter(r => r.requester_org_id === me);
  if (!mine.length) return emptyState({ iconName: 'send', title: t('req.outgoingEmpty'), text: t('req.outgoingEmptyText'),
    action: canEdit && d.active.length ? html`<button class="btn btn--primary" data-ask-empty>${icon('send')}${t('req.askButton')}</button>` : '' });
  const byPartner = new Map();
  for (const r of mine) {
    const list = byPartner.get(r.responder_org_id) || [];
    list.push({ ...r, state: requestState(r, d.partnerCerts) });
    byPartner.set(r.responder_org_id, list);
  }
  return html`${[...byPartner.entries()].map(([pid, reqs]) => {
    const cov = coverage(reqs.map(r => r.state));
    const level = cov.pct === 100 && !reqs.some(r => r.state === 'expiring') ? '' : cov.pct >= 50 ? 'meter--warning' : 'meter--danger';
    const conn = d.connections.find(c => c.partner_id === pid);
    return html`<div class="row" style="background:var(--surface-2)">${avatar(partnerName(pid), { size: 'sm' })}
        <div class="row__main"><a class="row__title" href="/pages/organization/partner.html?id=${conn?.id}&tab=requests">${partnerName(pid)}</a></div>
        <div class="row__side"><div class="meter ${level}" title="${t('req.coverageHint')}"><div class="meter__track"><div class="meter__fill" style="width:${cov.pct}%"></div></div><span>${cov.ok}/${cov.total}</span></div></div></div>
      <ul class="rows">${reqs.map(r => {
        const cert = bestOfType(d.partnerCerts.filter(c => c.organization_id === pid), r.certificate_type_id);
        return html`<li class="row"><span class="row__icon row__icon--${REQ_KIND[r.state] === 'neutral' ? '' : REQ_KIND[r.state]}">${icon(STATE_ICON[r.state])}</span>
          <div class="row__main"><span class="row__title">${typeName(r.type)}</span>
            <span class="row__meta">${cert ? html`<span>${cert.title}</span><span>${expiryText(cert.expiry_date)}</span>` : html`<span>${t('req.askedOn', { date: formatDate(r.created_at) })}</span>`}${r.due_date && r.state === 'missing' ? html`<span>${t('req.due', { date: formatDate(r.due_date) })}</span>` : ''}${r.response_note ? html`<span>“${r.response_note}”</span>` : ''}</span></div>
          <div class="row__side">${badge(REQ_KIND[r.state], t(`reqState.${r.state}`))}${canEdit ? html`<button class="icon-btn icon-btn--sm" data-cancel="${r.id}" title="${t('req.withdraw')}" aria-label="${t('req.withdraw')}">${icon('x')}</button>` : ''}</div></li>`;
      })}</ul>`;
  })}`;
}

function render() {
  const openIncoming = d.requests.filter(r => r.responder_org_id === me && r.status === 'open').length;
  const outgoing = d.requests.filter(r => r.requester_org_id === me);
  const issues = outgoing.filter(r => requestState(r, d.partnerCerts) !== 'valid').length;
  setNavCount('requests', openIncoming);
  tab ||= openIncoming ? 'incoming' : 'outgoing';
  mount(content, html`
    <div class="tabs" role="tablist">
      <button class="tab" role="tab" data-tab="incoming" aria-selected="${tab === 'incoming'}">${icon('inbox', { size: 16 })}${t('req.tabIncoming')}<span class="count">${openIncoming}</span></button>
      <button class="tab" role="tab" data-tab="outgoing" aria-selected="${tab === 'outgoing'}">${icon('send', { size: 16 })}${t('req.tabOutgoing')}<span class="count">${issues || outgoing.length}</span></button>
    </div>
    <section class="card" role="tabpanel">
      <div class="card__head"><div><h2>${tab === 'incoming' ? t('req.incomingTitle') : t('req.outgoingTitle')}</h2><p>${tab === 'incoming' ? t('req.incomingText') : t('req.outgoingText')}</p></div></div>
      ${tab === 'incoming' ? incomingTab() : outgoingTab()}
    </section>`);
}

content.addEventListener('click', async e => {
  const el = e.target.closest('[data-tab],[data-respond],[data-cancel],[data-ask-empty]');
  if (!el) return;
  try {
    if (el.dataset.tab) { tab = el.dataset.tab; history.replaceState(null, '', `?tab=${tab}`); render(); return; }
    if ('askEmpty' in el.dataset) { actions.querySelector('[data-ask]')?.click(); return; }
    if (el.dataset.cancel) {
      if (await confirmDialog({ title: t('req.withdrawTitle'), confirmLabel: t('req.withdraw') })) { await api.cancelRequest(el.dataset.cancel); toast(t('req.withdrawn')); refresh(); }
      return;
    }
    const r = d.requests.find(x => x.id === el.dataset.respond);
    const out = await respondDialog({ request: r, partnerName: partnerName(r.requester_org_id), myCerts: d.myCerts, types: d.types, partners: d.active });
    if (out) { toast(out === 'declined' ? t('req.declined') : t('req.fulfilled', { org: partnerName(r.requester_org_id) })); refresh(); }
  } catch (err) { toastError(err); }
});

async function refresh() {
  try {
    const [connections, requests, partnerCerts, myCerts, types] = await Promise.all([
      api.connections(), api.documentRequests(), api.visiblePartnerCertificates(), api.myCertificates(), api.certificateTypes()]);
    d = { connections, requests, partnerCerts, myCerts, types, active: connections.filter(c => c.status === 'active') };
    render();
  } catch (err) { console.error(err); mount(content, errorState(err)); }
}
refresh();
