import { api } from '../../api/index.js';
import { html, mount } from '../../lib/html.js';
import { t } from '../../lib/i18n.js';
import { relativeTime, formatDate } from '../../lib/format.js';
import { startPage, setNavCount } from '../../ui/shell.js';
import { icon, avatar, emptyState, errorState, friendlyError } from '../../ui/components.js';
import { openDialog, confirmDialog, toast, toastError } from '../../ui/dialog.js';
import { splitConnections, visibleTo } from './model.js';

const { ctx, content, actions } = await startPage({ area: 'organization', page: 'connections', title: 'conn.title', subtitle: 'conn.subtitle' });
const canManage = ['owner', 'admin'].includes(ctx.role);
const canRequest = ['owner', 'admin', 'member'].includes(ctx.role);
let q = '';
let data;

if (canRequest) {
  mount(actions, html`<button class="btn btn--primary" data-new>${icon('user-plus')}${t('conn.new')}</button>`);
  actions.querySelector('[data-new]').addEventListener('click', connectDialog);
}

async function connectDialog() {
  let found = null;
  const result = await openDialog({
    title: t('conn.newTitle'), description: t('conn.newText'), submitLabel: t('conn.send'),
    body: html`<div class="field"><label for="lookup">${t('conn.lookupLabel')}</label>
      <input class="input" id="lookup" name="lookup" required autocomplete="off" placeholder="${t('conn.lookupPlaceholder')}" autofocus>
      <small>${t('conn.lookupHint')}</small></div>
      <div data-preview></div>`,
    onOpen(form) {
      const preview = form.querySelector('[data-preview]');
      let timer;
      form.lookup.addEventListener('input', () => {
        clearTimeout(timer); found = null;
        const v = form.lookup.value.trim();
        if (v.length < 5) { mount(preview, ''); return; }
        timer = setTimeout(async () => {
          try {
            found = await api.findPartner(v);
            mount(preview, found
              ? html`<div class="callout callout--info">${avatar(found.name)}<div><strong>${found.name}</strong><p>${t('common.vat')} ${found.vat_number}</p></div></div>`
              : v.includes('@') ? html`<div class="callout">${icon('mail')}<div><strong>${t('conn.notRegistered')}</strong><p>${t('conn.inviteByEmail')}</p></div></div>`
                : html`<p class="hint">${t('conn.notFoundVat')}</p>`);
          } catch (err) { mount(preview, html`<p class="hint">${friendlyError(err)}</p>`); }
        }, 350);
      });
    },
    async onSubmit(form) { return api.requestConnection(form.lookup.value.trim()); }
  });
  if (result) { toast(result.kind === 'invitation' ? t('conn.invited') : t('conn.requested')); refresh(); }
}

const row = (c, side) => html`<li class="row">${avatar(c.partner_name)}
  <div class="row__main"><span class="row__title">${c.partner_name}</span>
    <span class="row__meta"><span>${t('common.vat')} ${c.partner_vat}</span><span>${relativeTime(c.created_at)}</span></span></div>
  <div class="row__side">${side}</div></li>`;

function renderActive() {
  const { active } = splitConnections(data.connections);
  const list = active.filter(c => `${c.partner_name} ${c.partner_vat} ${c.partner_email || ''}`.toLowerCase().includes(q.toLowerCase()));
  const host = content.querySelector('[data-active]');
  if (!active.length) { mount(host, emptyState({ iconName: 'users', title: t('conn.emptyTitle'), text: t('conn.emptyText') })); return; }
  if (!list.length) { mount(host, emptyState({ iconName: 'search', title: t('common.noResults') })); return; }
  mount(host, html`<ul class="rows">${list.map(c => {
    const theyShow = data.partnerCerts.filter(x => x.organization_id === c.partner_id).length;
    const iShow = data.myCerts.filter(x => visibleTo(x, c.partner_id)).length;
    return html`<li><a class="row row--link" href="/pages/organization/partner.html?id=${c.id}">
      ${avatar(c.partner_name)}
      <div class="row__main"><span class="row__title">${c.partner_name}</span>
        <span class="row__meta"><span>${t('common.vat')} ${c.partner_vat}</span><span>${t('conn.since', { date: formatDate(c.responded_at || c.created_at) })}</span></span></div>
      <div class="row__side"><span class="row__meta"><span title="${t('conn.theyShowHint')}">${icon('arrow-left', { size: 14 })} ${t('conn.theyShow', { count: theyShow })}</span>
        <span title="${t('conn.iShowHint')}">${icon('arrow-right', { size: 14 })} ${t('conn.iShow', { count: iShow })}</span></span>${icon('chevron-right', { cls: 'chevron' })}</div>
    </a></li>`;
  })}</ul>`);
}

function render() {
  const { active, incoming, outgoing } = splitConnections(data.connections);
  setNavCount('connections', incoming.length);
  mount(content, html`<div class="stack">
    ${incoming.length ? html`<section class="card">
      <div class="card__head"><div><h2>${t('conn.incomingTitle')}</h2><p>${t('conn.incomingText')}</p></div></div>
      <ul class="rows">${incoming.map(c => row(c, canManage
        ? html`<button class="btn btn--sm btn--secondary" data-decline="${c.id}">${t('common.decline')}</button><button class="btn btn--sm btn--primary" data-accept="${c.id}">${t('common.accept')}</button>`
        : html`<span class="hint">${t('conn.ownersRespond')}</span>`))}</ul></section>` : ''}

    <section class="card">
      <div class="card__head"><div><h2>${t('conn.activeTitle', { count: active.length })}</h2><p>${t('conn.activeText')}</p></div>
        <label class="search">${icon('search', { size: 16 })}<span class="sr-only">${t('common.search')}</span>
          <input class="input" type="search" data-q placeholder="${t('conn.searchPlaceholder')}" value="${q}"></label></div>
      <div data-active></div>
    </section>

    ${outgoing.length || data.invitations.length ? html`<section class="card">
      <div class="card__head"><div><h2>${t('conn.outgoingTitle')}</h2><p>${t('conn.outgoingText')}</p></div></div>
      <ul class="rows">
        ${outgoing.map(c => row(c, html`<span class="badge badge--warning">${t('conn.awaiting')}</span>${canManage ? html`<button class="btn btn--sm btn--ghost" data-cancel="${c.id}">${t('common.cancel')}</button>` : ''}`))}
        ${data.invitations.map(i => html`<li class="row"><span class="row__icon">${icon('mail')}</span>
          <div class="row__main"><span class="row__title">${i.email}</span><span class="row__meta"><span>${t('conn.invitationSent')}</span><span>${relativeTime(i.created_at)}</span></span></div>
          <div class="row__side"><span class="badge badge--neutral">${t('conn.invitation')}</span><button class="btn btn--sm btn--ghost" data-cancel-invite="${i.id}">${t('common.cancel')}</button></div></li>`)}
      </ul></section>` : ''}

    <div class="callout callout--info">${icon('shield-check')}<div><strong>${t('conn.privacyTitle')}</strong><p>${t('conn.privacyText')}</p></div></div>
  </div>`);
  content.querySelector('[data-q]').addEventListener('input', e => { q = e.target.value; renderActive(); });
  renderActive();
}

content.addEventListener('click', async e => {
  const b = e.target.closest('[data-accept],[data-decline],[data-cancel],[data-cancel-invite]');
  if (!b) return;
  try {
    if (b.dataset.accept || b.dataset.decline) {
      b.disabled = true;
      await api.respondConnection(b.dataset.accept || b.dataset.decline, !!b.dataset.accept);
      toast(b.dataset.accept ? t('conn.accepted') : t('conn.declined'));
    } else if (b.dataset.cancel) {
      if (!await confirmDialog({ title: t('conn.cancelTitle'), confirmLabel: t('conn.cancelRequest'), danger: true })) return;
      await api.endConnection(b.dataset.cancel); toast(t('conn.cancelled'));
    } else {
      await api.cancelInvitation(b.dataset.cancelInvite); toast(t('conn.invitationCancelled'));
    }
    refresh();
  } catch (err) { b.disabled = false; toastError(err); }
});

async function refresh() {
  try {
    const [connections, invitations, partnerCerts, myCerts] = await Promise.all([api.connections(), api.invitations(), api.visiblePartnerCertificates(), api.myCertificates()]);
    data = { connections, invitations, partnerCerts, myCerts };
    render();
  } catch (err) { console.error(err); mount(content, errorState(err)); }
}
refresh();
