// One partner: what they show us, what we show them, and requests between us.
import { api } from '../../api/index';
import { html, mount, raw, type SafeHtml } from '../../lib/html';
import { t } from '../../lib/i18n';
import { formatDate, relativeTime } from '../../lib/format';
import { fieldValue } from '../../lib/form';
import { definePage, type PageContext } from '../../app/page';
import { icon, badge, stateBadge, emptyState, errorState, certTypeLabel, typeName, expiryText } from '../../ui/components';
import { openDialog, confirmDialog, toast, toastError, showPdf } from '../../ui/dialog';
import { visibleTo, requestState } from './model';
import { REQ_KIND } from './requestStyle';
import { askDialog, respondDialog } from './requestForms';
import type { Certificate, CertificateType, Connection, DocumentRequest, ShareInput, Sharing } from '../../types/domain';

type Tab = 'theirs' | 'mine' | 'requests';
interface Data { c: Connection; types: CertificateType[]; theirs: Certificate[]; mine: Certificate[]; requests: DocumentRequest[]; active: Connection[] }

export default definePage({
  area: 'organization', nav: 'connections', title: 'partner.title', subtitle: 'partner.subtitle',
  back: { href: '/pages/organization/partners.html', label: 'partner.back' },
  render: page => new PartnerPage(page).start()
});

class PartnerPage {
  private readonly me: string;
  private readonly canManage: boolean;
  private readonly canEdit: boolean;
  private readonly connectionId: string;
  private tab: Tab;
  private d!: Data;

  constructor(private readonly page: PageContext) {
    this.me = page.ctx.organization!.id;
    const role = page.ctx.role;
    this.canManage = role === 'owner' || role === 'admin';
    this.canEdit = this.canManage || role === 'member';
    const params = new URLSearchParams(location.search);
    this.connectionId = params.get('id') ?? '';
    const tab = params.get('tab');
    this.tab = tab === 'mine' || tab === 'requests' ? tab : 'theirs';
  }

  async start(): Promise<void> {
    this.page.content.addEventListener('click', e => { void this.onClick(e); });
    this.page.content.addEventListener('change', e => { void this.onToggle(e); });
    this.page.actions.addEventListener('click', e => { void this.onAction(e); });
    await this.refresh();
  }

  private async refresh(): Promise<void> {
    const { content, actions } = this.page;
    try {
      const [connections, types] = await Promise.all([api.connections(), api.certificateTypes()]);
      const c = connections.find(x => x.id === this.connectionId);
      if (this.page.signal.aborted) return;
      if (!c) {
        mount(content, emptyState({ iconName: 'unlink', title: t('partner.notFound'), text: t('partner.notFoundText'),
          action: html`<a class="btn btn--secondary" href="/pages/organization/partners.html">${t('partner.back')}</a>` }));
        mount(actions, '');
        return;
      }
      this.heading(c);
      const [theirs, mine, requests] = c.status === 'active'
        ? await Promise.all([api.partnerCertificates(c.partner_id), api.myCertificates(), api.documentRequests()])
        : [[], [], []];
      if (this.page.signal.aborted) return;
      this.d = { c, types, theirs, mine, requests: requests.filter(r => r.connection_id === c.id), active: connections.filter(x => x.status === 'active') };
      this.renderActions();
      this.render();
    } catch (err) { console.error(err); mount(content, errorState(err)); }
  }

  private heading(c: Connection): void {
    this.page.setHeading(c.partner_name, html`<span>${t('common.vat')} ${c.partner_vat}</span>${c.partner_email ? html`<span>${c.partner_email}</span>` : ''}
      ${c.status === 'active' ? badge('success', t('partner.connectedSince', { date: formatDate(c.responded_at || c.created_at) }), { iconName: 'link-2' })
        : badge('warning', c.direction === 'incoming' ? t('conn.wantsToConnect') : t('conn.awaiting'))}`);
  }

  private theirsTab(): SafeHtml {
    const { d } = this;
    if (!d.theirs.length) return emptyState({ iconName: 'file-text', title: t('partner.theirsEmpty', { org: d.c.partner_name }), text: t('partner.theirsEmptyText'),
      action: this.canEdit ? html`<button class="btn btn--secondary" data-ask>${icon('send')}${t('req.askButton')}</button>` : '' });
    return html`<ul class="rows">${d.theirs.map(c => html`<li class="row">
      <span class="row__icon">${icon('file-text')}</span>
      <div class="row__main"><span class="row__title">${c.title}</span><span class="row__meta"><span>${certTypeLabel(c)}</span>${c.issuer ? html`<span>${c.issuer}</span>` : ''}<span>${expiryText(c.expiry_date)}</span></span></div>
      <div class="row__side">${stateBadge(c.expiry_date)}${c.current_file_id ? html`<button class="btn btn--sm btn--secondary" data-open="${c.id}">${icon('eye', { size: 16 })}${t('common.view')}</button>` : ''}</div></li>`)}</ul>`;
  }

  private mineTab(): SafeHtml {
    const { d } = this;
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
            <label class="switch" title="${on ? t('partner.hide') : t('partner.show')}"><input type="checkbox" data-toggle="${c.id}" ${on ? raw('checked') : ''} ${this.canEdit ? '' : raw('disabled')} aria-label="${t('partner.visibleTo', { org: d.c.partner_name })}"><i></i></label></div></li>`;
      })}</ul>`;
  }

  private requestsTab(): SafeHtml {
    const { d } = this;
    const mineAsks = d.requests.filter(r => r.requester_org_id === this.me);
    const theirAsks = d.requests.filter(r => r.responder_org_id === this.me);
    const reqRow = (r: DocumentRequest, mine: boolean) => {
      const state = mine ? requestState(r, d.theirs) : null;
      return html`<li class="row"><span class="row__icon ${mine ? '' : 'row__icon--info'}">${icon(mine ? 'send' : 'inbox')}</span>
        <div class="row__main"><span class="row__title">${typeName(r.type)}</span>
          <span class="row__meta"><span>${relativeTime(r.created_at)}</span>${r.due_date ? html`<span>${t('req.due', { date: formatDate(r.due_date) })}</span>` : ''}${r.note ? html`<span>${r.note}</span>` : ''}</span></div>
        <div class="row__side">
          ${state ? badge(REQ_KIND[state], t(`reqState.${state}`)) : r.status === 'open' ? badge('warning', t('req.awaitingYou')) : badge(r.status === 'declined' ? 'danger' : 'success', t(`reqStatus.${r.status}`))}
          ${mine && this.canEdit ? html`<button class="btn btn--sm btn--ghost" data-cancel-req="${r.id}">${t('req.withdraw')}</button>` : ''}
          ${!mine && r.status === 'open' && this.canEdit ? html`<button class="btn btn--sm btn--primary" data-respond="${r.id}">${t('req.respond')}</button>` : ''}
        </div></li>`;
    };
    return html`
      <div class="section-label">${t('partner.theyAsked', { org: d.c.partner_name })}</div>
      ${theirAsks.length ? html`<ul class="rows">${theirAsks.map(r => reqRow(r, false))}</ul>` : html`<p class="hint" style="padding:0 18px 14px">${t('partner.noTheirAsks')}</p>`}
      <div class="section-label">${t('partner.youAsked')}</div>
      ${mineAsks.length ? html`<ul class="rows">${mineAsks.map(r => reqRow(r, true))}</ul>` : html`<p class="hint" style="padding:0 18px 14px">${t('partner.noMyAsks')}</p>`}`;
  }

  private render(): void {
    const { d } = this;
    const c = d.c;
    if (c.status !== 'active') {
      mount(this.page.content, html`<section class="card">${emptyState({ iconName: 'clock', title: t('partner.pendingTitle'), text: t('partner.pendingText'),
        action: c.direction === 'incoming' && this.canEdit ? html`<div class="pair"><button class="btn btn--secondary" data-respond-conn="0">${t('common.decline')}</button><button class="btn btn--primary" data-respond-conn="1">${t('common.accept')}</button></div>` : '' })}</section>`);
      return;
    }
    const openTheir = d.requests.filter(r => r.responder_org_id === this.me && r.status === 'open').length;
    const tabs: [Tab, string, number][] = [['theirs', t('partner.tabTheirs'), d.theirs.length], ['mine', t('partner.tabMine'), d.mine.filter(x => visibleTo(x, c.partner_id)).length], ['requests', t('partner.tabRequests'), openTheir || d.requests.length]];
    const tab = this.tab;
    mount(this.page.content, html`
      <div class="tabs" role="tablist">${tabs.map(([key, label, n]) => html`<button class="tab" role="tab" data-tab="${key}" aria-selected="${String(tab === key)}">${label}<span class="count">${n}</span></button>`)}</div>
      <section class="card" role="tabpanel">
        <div class="card__head"><div><h2>${tab === 'theirs' ? t('partner.theirsTitle', { org: c.partner_name }) : tab === 'mine' ? t('partner.mineTitle', { org: c.partner_name }) : t('partner.requestsTitle')}</h2>
          <p>${tab === 'theirs' ? t('partner.theirsText') : tab === 'mine' ? t('partner.mineText') : t('partner.requestsText')}</p></div></div>
        ${tab === 'theirs' ? this.theirsTab() : tab === 'mine' ? this.mineTab() : this.requestsTab()}
      </section>`);
  }

  private renderActions(): void {
    const { d } = this;
    if (d.c.status !== 'active') {
      mount(this.page.actions, d.c.direction === 'outgoing' && this.canManage ? html`<button class="btn btn--danger-ghost" data-end>${icon('x')}${t('conn.cancelRequest')}</button>` : '');
    } else {
      mount(this.page.actions, html`${this.canEdit ? html`<button class="btn btn--secondary" data-ask>${icon('send')}${t('req.askButton')}</button>` : ''}
        ${this.canManage ? html`<button class="btn btn--danger-ghost" data-end>${icon('unlink')}${t('partner.end')}</button>` : ''}`);
    }
  }

  /** Show or hide one certificate for this partner, keeping everyone else as they were. */
  private async toggleShare(cert: Certificate, on: boolean): Promise<boolean> {
    const { d } = this;
    const partner = d.c.partner_id;
    const others = d.active.map(x => x.partner_id).filter(id => id !== partner);
    let mode: Sharing = cert.sharing;
    let shares: ShareInput[] = (cert.shares || []).map(s => ({ org_id: s.grantee_org_id, expires_at: s.expires_at }));
    if (on) {
      if (mode === 'private') { mode = 'selected'; shares = [{ org_id: partner }]; }
      else if (mode === 'selected') shares = [...shares.filter(s => s.org_id !== partner), { org_id: partner }];
    } else if (mode === 'all_connections') {
      if (!await confirmDialog({ title: t('partner.hideFromOneTitle'), text: t('partner.hideFromOneText', { org: d.c.partner_name, count: others.length }), confirmLabel: t('partner.hide') })) return false;
      mode = others.length ? 'selected' : 'private';
      shares = others.map(id => ({ org_id: id }));
    } else {
      shares = shares.filter(s => s.org_id !== partner);
      if (!shares.length) mode = 'private';
    }
    await api.setSharing(cert.id, mode, shares);
    return true;
  }

  private async ask(): Promise<void> {
    if (await askDialog({ connections: this.d.active, types: this.d.types, connectionId: this.connectionId })) {
      toast(t('req.sent')); this.tab = 'requests'; void this.refresh();
    }
  }

  private async onClick(e: Event): Promise<void> {
    const el = (e.target as Element).closest<HTMLElement>('[data-tab],[data-open],[data-ask],[data-cancel-req],[data-respond],[data-respond-conn]');
    if (!el) return;
    const { d } = this;
    const ds = el.dataset;
    try {
      if (ds.tab) {
        this.tab = ds.tab as Tab;
        history.replaceState(null, '', `?id=${encodeURIComponent(this.connectionId)}&tab=${this.tab}`);
        this.render();
      } else if (ds.open) {
        const c = d.theirs.find(x => x.id === ds.open);
        if (c) { const f = await api.openCertificate(c.id); await showPdf({ ...f, title: c.title }); }
      } else if ('ask' in ds) {
        await this.ask();
      } else if (ds.cancelReq) {
        if (await confirmDialog({ title: t('req.withdrawTitle'), confirmLabel: t('req.withdraw') })) { await api.cancelRequest(ds.cancelReq); toast(t('req.withdrawn')); void this.refresh(); }
      } else if (ds.respond) {
        const r = d.requests.find(x => x.id === ds.respond);
        if (!r) return;
        const out = await respondDialog({ request: r, partnerName: d.c.partner_name, myCerts: d.mine, types: d.types, partners: d.active });
        if (out) { toast(out === 'declined' ? t('req.declined') : t('req.fulfilled', { org: d.c.partner_name })); void this.refresh(); }
      } else if (ds.respondConn) {
        const accept = ds.respondConn === '1';
        await api.respondConnection(this.connectionId, accept);
        toast(accept ? t('conn.accepted') : t('conn.declined'));
        void this.refresh();
      }
    } catch (err) { toastError(err); }
  }

  private async onToggle(e: Event): Promise<void> {
    const sw = (e.target as Element).closest<HTMLInputElement>('[data-toggle]');
    const cert = sw && this.d.mine.find(c => c.id === sw.dataset.toggle);
    if (!sw || !cert) return;
    sw.disabled = true;
    try {
      if (await this.toggleShare(cert, sw.checked)) toast(sw.checked ? t('partner.nowVisible', { org: this.d.c.partner_name }) : t('partner.nowHidden', { org: this.d.c.partner_name }));
      await this.refresh();
    } catch (err) { toastError(err); sw.checked = !sw.checked; sw.disabled = false; }
  }

  private async onAction(e: Event): Promise<void> {
    const target = e.target as Element;
    if (target.closest('[data-ask]')) { try { await this.ask(); } catch (err) { toastError(err); } return; }
    if (!target.closest('[data-end]')) return;
    const pending = this.d.c.status !== 'active';
    const ok = pending
      ? await confirmDialog({ title: t('conn.cancelTitle'), confirmLabel: t('conn.cancelRequest'), danger: true })
      : await openDialog({
          title: t('partner.endTitle', { org: this.d.c.partner_name }), submitLabel: t('partner.end'), danger: true,
          body: html`<p class="muted">${t('partner.endText')}</p><div class="field"><label for="reason">${t('partner.endReason')}</label><textarea class="textarea" id="reason" name="reason" rows="2" maxlength="500"></textarea></div>`,
          onSubmit: async form => { await api.endConnection(this.connectionId, fieldValue(form, 'reason')); return true; }
        });
    if (!ok) return;
    try {
      if (pending) await api.endConnection(this.connectionId);
      toast(pending ? t('conn.cancelled') : t('partner.ended'));
      this.page.navigate('/pages/organization/partners.html');
    } catch (err) { toastError(err); }
  }
}
