import { api } from '../../api/index.js';
import { html, mount, raw } from '../../lib/html.js';
import { t } from '../../lib/i18n.js';
import { formatDate, relativeTime } from '../../lib/format.js';
import { startPage } from '../../ui/shell.js';
import { icon, badge, stateBadge, emptyState, errorState, certTypeLabel, typeName, expiryText } from '../../ui/components.js';
import { openDialog, confirmDialog, toast, toastError, showPdf } from '../../ui/dialog.js';
import { visibleTo, requestState } from './model.js';
import { askDialog, respondDialog } from './requestForms.js';

const { ctx, content, actions, setHeading } = await startPage({ area: 'organization', page: 'connections', title: 'partner.title', subtitle: 'partner.subtitle', back: { href: '/pages/organization/partners.html', label: 'partner.back' } });
const me = ctx.organization.id;
const canManage = ['owner', 'admin'].includes(ctx.role);
const canEdit = ['owner', 'admin', 'member'].includes(ctx.role);
const connectionId = new URLSearchParams(location.search).get('id');
let tab = new URLSearchParams(location.search).get('tab') || 'theirs';
let d;

const REQ_KIND = { missing: 'neutral', declined: 'danger', valid: 'success', expiring: 'warning', expired: 'danger' };

function heading(c) {
  setHeading(c.partner_name, html`<span>${t('common.vat')} ${c.partner_vat}</span>${c.partner_email ? html`<span>${c.partner_email}</span>` : ''}
    ${c.status === 'active' ? badge('success', t('partner.connectedSince', { date: formatDate(c.responded_at || c.created_at) }), { iconName: 'link-2' })
      : badge('warning', c.direction === 'incoming' ? t('conn.wantsToConnect') : t('conn.awaiting'))}`);
}

function theirsTab() {
  if (!d.theirs.length) return emptyState({ iconName: 'file-text', title: t('partner.theirsEmpty', { org: d.c.partner_name }), text: t('partner.theirsEmptyText'),
    action: canEdit ? html`<button class="btn btn--secondary" data-ask>${icon('send')}${t('req.askButton')}</button>` : '' });
  return html`<ul class="rows">${d.theirs.map(c => html`<li class="row">
    <span class="row__icon">${icon('file-text')}</span>
    <div class="row__main"><span class="row__title">${c.title}</span><span class="row__meta"><span>${certTypeLabel(c)}</span>${c.issuer ? html`<span>${c.issuer}</span>` : ''}<span>${expiryText(c.expiry_date)}</span></span></div>
    <div class="row__side">${stateBadge(c.expiry_date)}${c.current_file_id ? html`<button class="btn btn--sm btn--secondary" data-open="${c.id}">${icon('eye', { size: 16 })}${t('common.view')}</button>` : ''}</div></li>`)}</ul>`;
}

function mineTab() {
  if (!d.mine.length) return emptyState({ iconName: 'file-plus', title: t('partner.mineEmpty'), text: t('partner.mineEmptyText'),
    action: html`<a class="btn btn--secondary" href="/pages/organization/certificates.html">${t('nav.certificates')}</a>` });
  return html`<div class="callout callout--info" style="margin:16px 18px 0">${icon('info')}<div><p>${t('partner.mineHelp', { org: d.c.partner_name })}</p></div></div>
    <ul class="rows">${d.mine.map(c => {
      const on = visibleTo(c, d.c.partner_id);
      const share = (c.shares || []).find(s => s.grantee_org_id === d.c.partner_id);
      const why = c.sharing === 'all_connections' ? t('partner.viaAll') : c.sharing === 'private' ? t('sharing.private')
        : share?.expires_at ? t('partner.until', { date: formatDate(share.expires_at) }) : on ? t('partner.selectedForThem') : t('partner.notShared');
      return html`<li class="row">
        <span class="row__icon">${icon(on ? 'eye' : 'lock')}</span>
        <div class="row__main"><span class="row__title">${c.title}</span><span class="row__meta"><span>${certTypeLabel(c)}</span><span>${why}</span></span></div>
        <div class="row__side">${stateBadge(c.expiry_date)}
          <label class="switch" title="${on ? t('partner.hide') : t('partner.show')}"><input type="checkbox" data-toggle="${c.id}" ${on ? raw('checked') : ''} ${canEdit ? '' : raw('disabled')} aria-label="${t('partner.visibleTo', { org: d.c.partner_name })}"><i></i></label></div></li>`;
    })}</ul>`;
}

function requestsTab() {
  const mineAsks = d.requests.filter(r => r.requester_org_id === me);
  const theirAsks = d.requests.filter(r => r.responder_org_id === me);
  const reqRow = (r, mine) => {
    const state = mine ? requestState(r, d.theirs) : null;
    return html`<li class="row"><span class="row__icon ${mine ? '' : 'row__icon--info'}">${icon(mine ? 'send' : 'inbox')}</span>
      <div class="row__main"><span class="row__title">${typeName(r.type)}</span>
        <span class="row__meta"><span>${relativeTime(r.created_at)}</span>${r.due_date ? html`<span>${t('req.due', { date: formatDate(r.due_date) })}</span>` : ''}${r.note ? html`<span>${r.note}</span>` : ''}</span></div>
      <div class="row__side">
        ${mine ? badge(REQ_KIND[state], t(`reqState.${state}`)) : r.status === 'open' ? badge('warning', t('req.awaitingYou')) : badge(r.status === 'declined' ? 'danger' : 'success', t(`reqStatus.${r.status}`))}
        ${mine && canEdit ? html`<button class="btn btn--sm btn--ghost" data-cancel-req="${r.id}">${t('req.withdraw')}</button>` : ''}
        ${!mine && r.status === 'open' && canEdit ? html`<button class="btn btn--sm btn--primary" data-respond="${r.id}">${t('req.respond')}</button>` : ''}
      </div></li>`;
  };
  return html`
    <div class="section-label">${t('partner.theyAsked', { org: d.c.partner_name })}</div>
    ${theirAsks.length ? html`<ul class="rows">${theirAsks.map(r => reqRow(r, false))}</ul>` : html`<p class="hint" style="padding:0 18px 14px">${t('partner.noTheirAsks')}</p>`}
    <div class="section-label">${t('partner.youAsked')}</div>
    ${mineAsks.length ? html`<ul class="rows">${mineAsks.map(r => reqRow(r, true))}</ul>` : html`<p class="hint" style="padding:0 18px 14px">${t('partner.noMyAsks')}</p>`}`;
}

function render() {
  const c = d.c;
  if (c.status !== 'active') {
    mount(content, html`<section class="card">${emptyState({ iconName: 'clock', title: t('partner.pendingTitle'), text: t('partner.pendingText'),
      action: c.direction === 'incoming' && canManage ? html`<div class="pair"><button class="btn btn--secondary" data-respond-conn="0">${t('common.decline')}</button><button class="btn btn--primary" data-respond-conn="1">${t('common.accept')}</button></div>` : '' })}</section>`);
    return;
  }
  const openTheir = d.requests.filter(r => r.responder_org_id === me && r.status === 'open').length;
  const tabs = [['theirs', t('partner.tabTheirs'), d.theirs.length], ['mine', t('partner.tabMine'), d.mine.filter(x => visibleTo(x, c.partner_id)).length], ['requests', t('partner.tabRequests'), openTheir || d.requests.length]];
  mount(content, html`
    <div class="tabs" role="tablist">${tabs.map(([key, label, n]) => html`<button class="tab" role="tab" data-tab="${key}" aria-selected="${tab === key}">${label}<span class="count">${n}</span></button>`)}</div>
    <section class="card" role="tabpanel">
      <div class="card__head"><div><h2>${tab === 'theirs' ? t('partner.theirsTitle', { org: c.partner_name }) : tab === 'mine' ? t('partner.mineTitle', { org: c.partner_name }) : t('partner.requestsTitle')}</h2>
        <p>${tab === 'theirs' ? t('partner.theirsText') : tab === 'mine' ? t('partner.mineText') : t('partner.requestsText')}</p></div></div>
      ${tab === 'theirs' ? theirsTab() : tab === 'mine' ? mineTab() : requestsTab()}
    </section>`);
}

function renderActions() {
  if (d.c.status !== 'active') {
    mount(actions, d.c.direction === 'outgoing' && canManage ? html`<button class="btn btn--danger-ghost" data-end>${icon('x')}${t('conn.cancelRequest')}</button>` : '');
  } else {
    mount(actions, html`${canEdit ? html`<button class="btn btn--secondary" data-ask>${icon('send')}${t('req.askButton')}</button>` : ''}
      ${canManage ? html`<button class="btn btn--danger-ghost" data-end>${icon('unlink')}${t('partner.end')}</button>` : ''}`);
  }
}

async function toggleShare(cert, on) {
  const partner = d.c.partner_id;
  const others = d.active.map(x => x.partner_id).filter(id => id !== partner);
  let mode = cert.sharing, shares = (cert.shares || []).map(s => ({ org_id: s.grantee_org_id, expires_at: s.expires_at }));
  if (on) {
    if (mode === 'private') { mode = 'selected'; shares = [{ org_id: partner }]; }
    else if (mode === 'selected') shares = [...shares.filter(s => s.org_id !== partner), { org_id: partner }];
  } else if (mode === 'all_connections') {
    // Hide from this partner only: keep everyone else.
    if (!await confirmDialog({ title: t('partner.hideFromOneTitle'), text: t('partner.hideFromOneText', { org: d.c.partner_name, count: others.length }), confirmLabel: t('partner.hide') })) return false;
    mode = others.length ? 'selected' : 'private'; shares = others.map(id => ({ org_id: id }));
  } else {
    shares = shares.filter(s => s.org_id !== partner);
    if (!shares.length) mode = 'private';
  }
  await api.setSharing(cert.id, mode, shares);
  return true;
}

content.addEventListener('click', async e => {
  const el = e.target.closest('[data-tab],[data-open],[data-ask],[data-cancel-req],[data-respond],[data-respond-conn]');
  if (!el) return;
  try {
    if (el.dataset.tab) { tab = el.dataset.tab; history.replaceState(null, '', `?id=${connectionId}&tab=${tab}`); render(); return; }
    if (el.dataset.open) { const c = d.theirs.find(x => x.id === el.dataset.open); const f = await api.openCertificate(c.id); await showPdf({ ...f, title: c.title }); return; }
    if ('ask' in el.dataset) { if (await askDialog({ connections: d.active, types: d.types, connectionId })) { toast(t('req.sent')); tab = 'requests'; refresh(); } return; }
    if (el.dataset.cancelReq) { if (await confirmDialog({ title: t('req.withdrawTitle'), confirmLabel: t('req.withdraw') })) { await api.cancelRequest(el.dataset.cancelReq); toast(t('req.withdrawn')); refresh(); } return; }
    if (el.dataset.respond) {
      const r = d.requests.find(x => x.id === el.dataset.respond);
      const out = await respondDialog({ request: r, partnerName: d.c.partner_name, myCerts: d.mine, types: d.types, partners: d.active });
      if (out) { toast(out === 'declined' ? t('req.declined') : t('req.fulfilled', { org: d.c.partner_name })); refresh(); }
      return;
    }
    if (el.dataset.respondConn) { await api.respondConnection(connectionId, el.dataset.respondConn === '1'); toast(t(el.dataset.respondConn === '1' ? 'conn.accepted' : 'conn.declined')); refresh(); }
  } catch (err) { toastError(err); }
});
content.addEventListener('change', async e => {
  const sw = e.target.closest('[data-toggle]');
  if (!sw) return;
  const cert = d.mine.find(c => c.id === sw.dataset.toggle);
  sw.disabled = true;
  try {
    if (await toggleShare(cert, sw.checked)) toast(sw.checked ? t('partner.nowVisible', { org: d.c.partner_name }) : t('partner.nowHidden', { org: d.c.partner_name }));
    await refresh();
  } catch (err) { toastError(err); sw.checked = !sw.checked; sw.disabled = false; }
});
actions.addEventListener('click', async e => {
  if (e.target.closest('[data-ask]')) { try { if (await askDialog({ connections: d.active, types: d.types, connectionId })) { toast(t('req.sent')); tab = 'requests'; refresh(); } } catch (err) { toastError(err); } return; }
  if (!e.target.closest('[data-end]')) return;
  const pending = d.c.status !== 'active';
  const ok = pending
    ? await confirmDialog({ title: t('conn.cancelTitle'), confirmLabel: t('conn.cancelRequest'), danger: true })
    : await openDialog({
        title: t('partner.endTitle', { org: d.c.partner_name }), submitLabel: t('partner.end'), danger: true,
        body: html`<p class="muted">${t('partner.endText')}</p><div class="field"><label for="reason">${t('partner.endReason')}</label><textarea class="textarea" id="reason" name="reason" rows="2" maxlength="500"></textarea></div>`,
        async onSubmit(form) { await api.endConnection(connectionId, form.reason.value.trim()); return true; }
      });
  if (!ok) return;
  try {
    if (pending) await api.endConnection(connectionId);
    toast(pending ? t('conn.cancelled') : t('partner.ended'));
    location.href = '/pages/organization/partners.html';
  } catch (err) { toastError(err); }
});

async function refresh() {
  try {
    const [connections, types] = await Promise.all([api.connections(), api.certificateTypes()]);
    const c = connections.find(x => x.id === connectionId);
    if (!c) { mount(content, emptyState({ iconName: 'unlink', title: t('partner.notFound'), text: t('partner.notFoundText'), action: html`<a class="btn btn--secondary" href="/pages/organization/partners.html">${t('partner.back')}</a>` })); mount(actions, ''); return; }
    document.title = `${c.partner_name} · CertiTrack`;
    heading(c);
    const [theirs, mine, requests] = c.status === 'active'
      ? await Promise.all([api.partnerCertificates(c.partner_id), api.myCertificates(), api.documentRequests()])
      : [[], [], []];
    d = { c, types, theirs, mine, requests: requests.filter(r => r.connection_id === c.id), active: connections.filter(x => x.status === 'active') };
    render(); renderActions();
  } catch (err) { console.error(err); mount(content, errorState(err)); }
}
refresh();
