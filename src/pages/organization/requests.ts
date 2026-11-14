// Document requests: what partners asked of us, and what we asked of them.
import { api } from '../../api/index';
import { html, mount, type SafeHtml } from '../../lib/html';
import { t } from '../../lib/i18n';
import { formatDate, relativeTime, daysUntil } from '../../lib/format';
import { setNavCount } from '../../app/shell';
import { definePage, type PageContext } from '../../app/page';
import { icon, avatar, badge, emptyState, errorState, typeName, expiryText } from '../../ui/components';
import { confirmDialog, toast, toastError } from '../../ui/dialog';
import { requestState, bestOfType, coverage, type RequestState } from './model';
import { REQ_KIND, REQ_ICON } from './requestStyle';
import { askDialog, respondDialog } from './requestForms';
import type { Certificate, CertificateType, Connection, DocumentRequest } from '../../types/domain';

type Tab = 'incoming' | 'outgoing';
interface Data { connections: Connection[]; requests: DocumentRequest[]; partnerCerts: Certificate[]; myCerts: Certificate[]; types: CertificateType[]; active: Connection[] }

export default definePage({
  area: 'organization', nav: 'requests', title: 'req.title', subtitle: 'req.subtitle',
  render: page => new RequestsPage(page).start()
});

class RequestsPage {
  private readonly me: string;
  private readonly canEdit: boolean;
  private tab: Tab | null;
  private d!: Data;

  constructor(private readonly page: PageContext) {
    this.me = page.ctx.organization!.id;
    const role = page.ctx.role;
    this.canEdit = role === 'owner' || role === 'admin' || role === 'member';
    const tab = new URLSearchParams(location.search).get('tab');
    this.tab = tab === 'incoming' || tab === 'outgoing' ? tab : null;
  }

  async start(): Promise<void> {
    const { actions, content } = this.page;
    if (this.canEdit) {
      mount(actions, html`<button class="btn btn--primary" data-ask>${icon('send')}${t('req.askButton')}</button>`);
      actions.querySelector('[data-ask]')!.addEventListener('click', () => { void this.ask(); });
    }
    content.addEventListener('click', e => { void this.onClick(e); });
    await this.refresh();
  }

  private partnerName(id: string): string { return this.d.connections.find(c => c.partner_id === id)?.partner_name || '—'; }

  private async ask(): Promise<void> {
    if (!this.d.active.length) { toast(t('req.needConnection'), 'info'); return; }
    try { if (await askDialog({ connections: this.d.active, types: this.d.types })) { toast(t('req.sent')); this.tab = 'outgoing'; void this.refresh(); } } catch (err) { toastError(err); }
  }

  private async refresh(): Promise<void> {
    try {
      const [connections, requests, partnerCerts, myCerts, types] = await Promise.all([
        api.connections(), api.documentRequests(), api.visiblePartnerCertificates(), api.myCertificates(), api.certificateTypes()]);
      if (this.page.signal.aborted) return;
      this.d = { connections, requests, partnerCerts, myCerts, types, active: connections.filter(c => c.status === 'active') };
      this.render();
    } catch (err) { console.error(err); mount(this.page.content, errorState(err)); }
  }

  private incomingTab(): SafeHtml {
    const list = this.d.requests.filter(r => r.responder_org_id === this.me);
    if (!list.length) return emptyState({ iconName: 'inbox', title: t('req.incomingEmpty'), text: t('req.incomingEmptyText') });
    const open = list.filter(r => r.status === 'open'), done = list.filter(r => r.status !== 'open');
    const row = (r: DocumentRequest) => {
      const due = r.due_date ? daysUntil(r.due_date) : null;
      const from = this.partnerName(r.requester_org_id);
      return html`<li class="row">${avatar(from)}
        <div class="row__main"><span class="row__title">${t('req.asksFor', { org: from, type: typeName(r.type) })}</span>
          <span class="row__meta"><span>${relativeTime(r.created_at)}</span>${r.due_date ? html`<span class="${due !== null && due < 0 ? 'badge badge--danger' : ''}">${t('req.due', { date: formatDate(r.due_date) })}</span>` : ''}${r.note ? html`<span>“${r.note}”</span>` : ''}</span></div>
        <div class="row__side">${r.status === 'open'
          ? (this.canEdit ? html`<button class="btn btn--sm btn--primary" data-respond="${r.id}">${t('req.respond')}</button>` : badge('warning', t('req.awaitingYou')))
          : badge(r.status === 'declined' ? 'danger' : 'success', t(`reqStatus.${r.status}`))}</div></li>`;
    };
    return html`${open.length ? html`<div class="section-label">${t('req.openSection', { count: open.length })}</div><ul class="rows">${open.map(row)}</ul>` : ''}
      ${done.length ? html`<div class="section-label">${t('req.doneSection')}</div><ul class="rows">${done.map(row)}</ul>` : ''}`;
  }

  private outgoingTab(): SafeHtml {
    const mine = this.d.requests.filter(r => r.requester_org_id === this.me);
    if (!mine.length) return emptyState({ iconName: 'send', title: t('req.outgoingEmpty'), text: t('req.outgoingEmptyText'),
      action: this.canEdit && this.d.active.length ? html`<button class="btn btn--primary" data-ask-empty>${icon('send')}${t('req.askButton')}</button>` : '' });
    const byPartner = new Map<string, (DocumentRequest & { state: RequestState })[]>();
    for (const r of mine) {
      const list = byPartner.get(r.responder_org_id) ?? [];
      list.push({ ...r, state: requestState(r, this.d.partnerCerts) });
      byPartner.set(r.responder_org_id, list);
    }
    return html`${[...byPartner.entries()].map(([pid, reqs]) => {
      const cov = coverage(reqs.map(r => r.state));
      const pct = cov.pct ?? 0;
      const level = pct === 100 && !reqs.some(r => r.state === 'expiring') ? '' : pct >= 50 ? 'meter--warning' : 'meter--danger';
      const conn = this.d.connections.find(c => c.partner_id === pid);
      return html`<div class="row" style="background:var(--surface-2)">${avatar(this.partnerName(pid), { size: 'sm' })}
          <div class="row__main"><a class="row__title" href="/pages/organization/partner.html?id=${conn?.id ?? ''}&tab=requests">${this.partnerName(pid)}</a></div>
          <div class="row__side"><div class="meter ${level}" title="${t('req.coverageHint')}"><div class="meter__track"><div class="meter__fill" style="width:${pct}%"></div></div><span>${cov.ok}/${cov.total}</span></div></div></div>
        <ul class="rows">${reqs.map(r => {
          const cert = bestOfType(this.d.partnerCerts.filter(c => c.organization_id === pid), r.certificate_type_id);
          const kind = REQ_KIND[r.state];
          return html`<li class="row"><span class="row__icon row__icon--${kind === 'neutral' ? '' : kind}">${icon(REQ_ICON[r.state])}</span>
            <div class="row__main"><span class="row__title">${typeName(r.type)}</span>
              <span class="row__meta">${cert ? html`<span>${cert.title}</span><span>${expiryText(cert.expiry_date)}</span>` : html`<span>${t('req.askedOn', { date: formatDate(r.created_at) })}</span>`}${r.due_date && r.state === 'missing' ? html`<span>${t('req.due', { date: formatDate(r.due_date) })}</span>` : ''}${r.response_note ? html`<span>“${r.response_note}”</span>` : ''}</span></div>
            <div class="row__side">${badge(kind, t(`reqState.${r.state}`))}${this.canEdit ? html`<button class="icon-btn icon-btn--sm" data-cancel="${r.id}" title="${t('req.withdraw')}" aria-label="${t('req.withdraw')}">${icon('x')}</button>` : ''}</div></li>`;
        })}</ul>`;
    })}`;
  }

  private render(): void {
    const openIncoming = this.d.requests.filter(r => r.responder_org_id === this.me && r.status === 'open').length;
    const outgoing = this.d.requests.filter(r => r.requester_org_id === this.me);
    const issues = outgoing.filter(r => requestState(r, this.d.partnerCerts) !== 'valid').length;
    setNavCount('requests', openIncoming);
    const tab: Tab = this.tab ??= openIncoming ? 'incoming' : 'outgoing';
    mount(this.page.content, html`
      <div class="tabs" role="tablist">
        <button class="tab" role="tab" data-tab="incoming" aria-selected="${String(tab === 'incoming')}">${icon('inbox', { size: 16 })}${t('req.tabIncoming')}<span class="count">${openIncoming}</span></button>
        <button class="tab" role="tab" data-tab="outgoing" aria-selected="${String(tab === 'outgoing')}">${icon('send', { size: 16 })}${t('req.tabOutgoing')}<span class="count">${issues || outgoing.length}</span></button>
      </div>
      <section class="card" role="tabpanel">
        <div class="card__head"><div><h2>${tab === 'incoming' ? t('req.incomingTitle') : t('req.outgoingTitle')}</h2><p>${tab === 'incoming' ? t('req.incomingText') : t('req.outgoingText')}</p></div></div>
        ${tab === 'incoming' ? this.incomingTab() : this.outgoingTab()}
      </section>`);
  }

  private async onClick(e: Event): Promise<void> {
    const el = (e.target as Element).closest<HTMLElement>('[data-tab],[data-respond],[data-cancel],[data-ask-empty]');
    if (!el) return;
    try {
      if (el.dataset.tab) {
        this.tab = el.dataset.tab === 'incoming' ? 'incoming' : 'outgoing';
        history.replaceState(null, '', `?tab=${this.tab}`);
        this.render();
        return;
      }
      if ('askEmpty' in el.dataset) { void this.ask(); return; }
      if (el.dataset.cancel) {
        if (await confirmDialog({ title: t('req.withdrawTitle'), confirmLabel: t('req.withdraw') })) { await api.cancelRequest(el.dataset.cancel); toast(t('req.withdrawn')); void this.refresh(); }
        return;
      }
      const r = this.d.requests.find(x => x.id === el.dataset.respond);
      if (!r) return;
      const from = this.partnerName(r.requester_org_id);
      const out = await respondDialog({ request: r, partnerName: from, myCerts: this.d.myCerts, types: this.d.types, partners: this.d.active });
      if (out) { toast(out === 'declined' ? t('req.declined') : t('req.fulfilled', { org: from })); void this.refresh(); }
    } catch (err) { toastError(err); }
  }
}
