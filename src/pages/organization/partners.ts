// Connections: active partners, requests to connect, and our own pending requests.
import { api } from '../../api/index';
import { html, mount, type SafeHtml } from '../../lib/html';
import { t } from '../../lib/i18n';
import { relativeTime, formatDate } from '../../lib/format';
import { field } from '../../lib/form';
import { setNavCount } from '../../app/shell';
import { definePage, type PageContext } from '../../app/page';
import { icon, avatar, emptyState, errorState, friendlyError } from '../../ui/components';
import { openDialog, confirmDialog, toast, toastError } from '../../ui/dialog';
import { splitConnections, visibleTo } from './model';
import type { Certificate, Connection, ConnectionResult, Invitation, PartnerCandidate } from '../../types/domain';

type Tab = 'active' | 'incoming' | 'outgoing';
interface Data { connections: Connection[]; invitations: Invitation[]; partnerCerts: Certificate[]; myCerts: Certificate[] }

export default definePage({
  area: 'organization', nav: 'connections', title: 'conn.title', subtitle: 'conn.subtitle',
  render: page => new PartnersPage(page).start()
});

class PartnersPage {
  private readonly canManage: boolean;
  private readonly canRequest: boolean;
  private q = '';
  private tab: Tab = 'active';
  private data!: Data;

  constructor(private readonly page: PageContext) {
    const role = page.ctx.role;
    this.canManage = role === 'owner' || role === 'admin';
    this.canRequest = this.canManage || role === 'member';
  }

  async start(): Promise<void> {
    const { actions, content } = this.page;
    if (this.canRequest) {
      mount(actions, html`<button class="btn btn--primary" data-new>${icon('user-plus')}${t('conn.new')}</button>`);
      actions.querySelector('[data-new]')!.addEventListener('click', () => { void this.connectDialog(); });
    }
    content.addEventListener('click', e => { void this.onClick(e); });
    await this.refresh();
  }

  private async connectDialog(): Promise<void> {
    const result = await openDialog<ConnectionResult>({
      title: t('conn.newTitle'), description: t('conn.newText'), submitLabel: t('conn.send'),
      body: html`<div class="field"><label for="lookup">${t('conn.lookupLabel')}</label>
        <input class="input" id="lookup" name="lookup" required autocomplete="off" placeholder="${t('conn.lookupPlaceholder')}" autofocus>
        <small>${t('conn.lookupHint')}</small></div>
        <div data-preview></div>`,
      onOpen(form) {
        const preview = form.querySelector<HTMLElement>('[data-preview]')!;
        const lookup = field(form, 'lookup');
        let timer: ReturnType<typeof setTimeout> | undefined;
        lookup.addEventListener('input', () => {
          clearTimeout(timer);
          const v = lookup.value.trim();
          if (v.length < 5) { mount(preview, ''); return; }
          timer = setTimeout(async () => {
            try {
              const found: PartnerCandidate | null = await api.findPartner(v);
              mount(preview, found
                ? html`<div class="callout callout--info">${avatar(found.name)}<div><strong>${found.name}</strong><p>${t('common.vat')} ${found.vat_number}</p></div></div>`
                : v.includes('@') ? html`<div class="callout">${icon('mail')}<div><strong>${t('conn.notRegistered')}</strong><p>${t('conn.inviteByEmail')}</p></div></div>`
                  : html`<p class="hint">${t('conn.notFoundVat')}</p>`);
            } catch (err) { mount(preview, html`<p class="hint">${friendlyError(err)}</p>`); }
          }, 350);
        });
      },
      onSubmit: form => api.requestConnection(field(form, 'lookup').value.trim())
    });
    if (result && result !== true) { toast(result.kind === 'invitation' ? t('conn.invited') : t('conn.requested')); void this.refresh(); }
  }

  private async refresh(): Promise<void> {
    try {
      const [connections, invitations, partnerCerts, myCerts] = await Promise.all([api.connections(), api.invitations(), api.visiblePartnerCertificates(), api.myCertificates()]);
      if (this.page.signal.aborted) return;
      this.data = { connections, invitations, partnerCerts, myCerts };
      this.render();
    } catch (err) { console.error(err); mount(this.page.content, errorState(err)); }
  }

  private row(c: Connection, side: SafeHtml): SafeHtml {
    return html`<li class="row">${avatar(c.partner_name)}
      <div class="row__main"><span class="row__title">${c.partner_name}</span>
        <span class="row__meta"><span>${t('common.vat')} ${c.partner_vat}</span><span>${relativeTime(c.created_at)}</span></span></div>
      <div class="row__side">${side}</div></li>`;
  }

  private renderActive(): void {
    const { active } = splitConnections(this.data.connections);
    const q = this.q.toLowerCase();
    const list = active.filter(c => `${c.partner_name} ${c.partner_vat} ${c.partner_email || ''}`.toLowerCase().includes(q));
    const host = this.page.content.querySelector<HTMLElement>('[data-active]');
    if (!host) return;
    if (!active.length) { mount(host, emptyState({ iconName: 'users', title: t('conn.emptyTitle'), text: t('conn.emptyText') })); return; }
    if (!list.length) { mount(host, emptyState({ iconName: 'search', title: t('common.noResults') })); return; }
    mount(host, html`<ul class="rows">${list.map(c => {
      const theyShow = this.data.partnerCerts.filter(x => x.organization_id === c.partner_id).length;
      const iShow = this.data.myCerts.filter(x => visibleTo(x, c.partner_id)).length;
      return html`<li><a class="row row--link" href="/pages/organization/partner.html?id=${c.id}">
        ${avatar(c.partner_name)}
        <div class="row__main"><span class="row__title">${c.partner_name}</span>
          <span class="row__meta"><span>${t('common.vat')} ${c.partner_vat}</span><span>${t('conn.since', { date: formatDate(c.responded_at || c.created_at) })}</span></span></div>
        <div class="row__side"><span class="row__meta"><span title="${t('conn.theyShowHint')}">${icon('arrow-left', { size: 14 })} ${t('conn.theyShow', { count: theyShow })}</span>
          <span title="${t('conn.iShowHint')}">${icon('arrow-right', { size: 14 })} ${t('conn.iShow', { count: iShow })}</span></span>${icon('chevron-right', { cls: 'chevron' })}</div>
      </a></li>`;
    })}</ul>`);
  }

  // Tabs instead of stacked lists, so the screen fits without scrolling.
  private render(): void {
    const { active, incoming, outgoing } = splitConnections(this.data.connections);
    setNavCount('connections', incoming.length);
    const waiting = outgoing.length + this.data.invitations.length;
    const tabs: [Tab, string, number][] = [['active', t('conn.tabActive'), active.length]];
    if (incoming.length) tabs.push(['incoming', t('conn.incomingTitle'), incoming.length]);
    if (waiting) tabs.push(['outgoing', t('conn.outgoingTitle'), waiting]);
    if (!tabs.some(([k]) => k === this.tab)) this.tab = 'active';
    const tab = this.tab;
    const panel = tab === 'incoming' ? html`<section class="card" role="tabpanel">
        <div class="card__head"><div><h2>${t('conn.incomingTitle')}</h2><p>${t('conn.incomingText')}</p></div></div>
        <ul class="rows">${incoming.map(c => this.row(c, this.canRequest
          ? html`<button class="btn btn--sm btn--secondary" data-decline="${c.id}">${t('common.decline')}</button><button class="btn btn--sm btn--primary" data-accept="${c.id}">${t('common.accept')}</button>`
          : html`<span class="hint">${t('conn.ownersRespond')}</span>`))}</ul></section>`
      : tab === 'outgoing' ? html`<section class="card" role="tabpanel">
        <div class="card__head"><div><h2>${t('conn.outgoingTitle')}</h2><p>${t('conn.outgoingText')}</p></div></div>
        <ul class="rows">
          ${outgoing.map(c => this.row(c, html`<span class="badge badge--warning">${t('conn.awaiting')}</span>${this.canManage ? html`<button class="btn btn--sm btn--ghost" data-cancel="${c.id}">${t('common.cancel')}</button>` : ''}`))}
          ${this.data.invitations.map(i => html`<li class="row"><span class="row__icon">${icon('mail')}</span>
            <div class="row__main"><span class="row__title">${i.email}</span><span class="row__meta"><span>${t('conn.invitationSent')}</span><span>${relativeTime(i.created_at)}</span></span></div>
            <div class="row__side"><span class="badge badge--neutral">${t('conn.invitation')}</span><button class="btn btn--sm btn--ghost" data-cancel-invite="${i.id}">${t('common.cancel')}</button></div></li>`)}
        </ul></section>`
      : html`<section class="card" role="tabpanel">
        <div class="card__head"><div><h2>${t('conn.activeTitle', { count: active.length })}</h2><p>${t('conn.activeText')}</p></div>
          <label class="search">${icon('search', { size: 16 })}<span class="sr-only">${t('common.search')}</span>
            <input class="input" type="search" data-q placeholder="${t('conn.searchPlaceholder')}" value="${this.q}"></label></div>
        <div data-active></div>
      </section>`;
    mount(this.page.content, html`<div class="tabs" role="tablist">${tabs.map(([key, label, n]) => html`<button type="button" class="tab" role="tab" data-tab="${key}" aria-selected="${String(tab === key)}">${label}<span class="count">${n}</span></button>`)}</div>
      ${panel}
      <div class="callout callout--info" style="margin-top:16px">${icon('shield-check')}<div><strong>${t('conn.privacyTitle')}</strong><p>${t('conn.privacyText')}</p></div></div>`);
    if (tab === 'active') {
      this.page.content.querySelector('[data-q]')!.addEventListener('input', e => { this.q = (e.target as HTMLInputElement).value; this.renderActive(); });
      this.renderActive();
    }
  }

  private async onClick(e: Event): Promise<void> {
    const target = e.target as Element;
    const tabBtn = target.closest<HTMLElement>('[data-tab]');
    if (tabBtn) { this.tab = tabBtn.dataset.tab as Tab; this.render(); return; }
    const b = target.closest<HTMLButtonElement>('[data-accept],[data-decline],[data-cancel],[data-cancel-invite]');
    if (!b) return;
    try {
      const { accept, decline, cancel, cancelInvite } = b.dataset;
      if (accept || decline) {
        b.disabled = true;
        await api.respondConnection((accept || decline)!, !!accept);
        toast(accept ? t('conn.accepted') : t('conn.declined'));
      } else if (cancel) {
        if (!await confirmDialog({ title: t('conn.cancelTitle'), confirmLabel: t('conn.cancelRequest'), danger: true })) return;
        await api.endConnection(cancel); toast(t('conn.cancelled'));
      } else if (cancelInvite) {
        await api.cancelInvitation(cancelInvite); toast(t('conn.invitationCancelled'));
      }
      void this.refresh();
    } catch (err) { b.disabled = false; toastError(err); }
  }
}
