// Requests for a presentation sent from the public home page.
// Each new one also arrives by email (template presentation_request).
import { api } from '../../api/index';
import { html, mount, type SafeHtml } from '../../lib/html';
import { t } from '../../lib/i18n';
import { formatDateTime, relativeTime } from '../../lib/format';
import { setNavCount } from '../../app/shell';
import { definePage, type PageContext } from '../../app/page';
import { icon, avatar, badge, emptyState, errorState, type BadgeKind } from '../../ui/components';
import { toast, toastError } from '../../ui/dialog';
import type { PresentationRequest, PresentationStatus } from '../../types/domain';

type Tab = 'new' | 'all';
const STATUS_KIND: Record<PresentationStatus, BadgeKind> = { new: 'accent', contacted: 'warning', done: 'success' };

export default definePage({
  area: 'admin', nav: 'presentations', title: 'pres.title', subtitle: 'pres.subtitle',
  render: page => new PresentationsPage(page).start()
});

class PresentationsPage {
  private rows: PresentationRequest[] = [];
  private tab: Tab = 'new';

  constructor(private readonly page: PageContext) {}

  async start(): Promise<void> {
    this.page.content.addEventListener('click', e => { void this.onClick(e); });
    await this.load();
  }

  private async load(): Promise<void> {
    try {
      const rows = await api.presentationRequests();
      if (this.page.signal.aborted) return;
      this.rows = rows;
      this.render();
    } catch (err) { console.error(err); mount(this.page.content, errorState(err)); }
  }

  private row(r: PresentationRequest): SafeHtml {
    const action = (status: PresentationStatus, label: string, kind = 'btn--secondary') =>
      html`<button type="button" class="btn btn--sm ${kind}" data-status="${status}" data-id="${r.id}">${label}</button>`;
    const subject = encodeURIComponent(t('home.presentationSubject'));
    return html`<li class="row presentation">
      ${avatar(r.company)}
      <div class="row__main">
        <span class="row__title">${r.company}</span>
        <span class="row__meta"><span>${r.name}</span>
          <a href="mailto:${r.email}?subject=${subject}">${r.email}</a>
          ${r.phone ? html`<a href="tel:${r.phone.replace(/[^+0-9]/g, '')}">${r.phone}</a>` : ''}
          <span title="${formatDateTime(r.created_at)}">${relativeTime(r.created_at)}</span></span>
        ${r.message ? html`<p class="presentation__message">“${r.message}”</p>` : ''}
      </div>
      <div class="row__side">
        ${badge(STATUS_KIND[r.status], t(`pres.status.${r.status}`))}
        <a class="icon-btn icon-btn--sm" href="mailto:${r.email}?subject=${subject}" title="${t('pres.reply')}" aria-label="${t('pres.reply')}">${icon('mail')}</a>
        ${r.status === 'new' ? action('contacted', t('pres.markContacted')) : ''}
        ${r.status !== 'done' ? action('done', t('pres.markDone'), r.status === 'new' ? 'btn--ghost' : 'btn--secondary') : action('new', t('pres.reopen'), 'btn--ghost')}
      </div></li>`;
  }

  private render(): void {
    const fresh = this.rows.filter(r => r.status === 'new');
    setNavCount('presentations', fresh.length);
    const list = this.tab === 'new' ? fresh : this.rows;
    const tabs: [Tab, string, number][] = [['new', t('pres.tabNew'), fresh.length], ['all', t('pres.tabAll'), this.rows.length]];
    mount(this.page.content, html`
      <div class="tabs" role="tablist">${tabs.map(([key, label, n]) => html`<button type="button" class="tab" role="tab" data-tab="${key}" aria-selected="${String(this.tab === key)}">${label}<span class="count">${n}</span></button>`)}</div>
      <section class="card" role="tabpanel">
        ${list.length ? html`<ul class="rows">${list.map(r => this.row(r))}</ul>`
          : this.tab === 'new' ? emptyState({ iconName: 'presentation', title: t('pres.emptyNew'), text: t('pres.emptyNewText') })
            : emptyState({ iconName: 'presentation', title: t('pres.empty'), text: t('pres.emptyNewText') })}
      </section>`);
  }

  private async onClick(e: Event): Promise<void> {
    const target = e.target as Element;
    const tabBtn = target.closest<HTMLElement>('[data-tab]');
    if (tabBtn) { this.tab = tabBtn.dataset.tab === 'all' ? 'all' : 'new'; this.render(); return; }
    const btn = target.closest<HTMLButtonElement>('[data-status]');
    if (!btn?.dataset.id) return;
    btn.disabled = true;
    try {
      await api.setPresentationRequestStatus(btn.dataset.id, btn.dataset.status as PresentationStatus);
      toast(t('pres.updated'));
      await this.load();
    } catch (err) { btn.disabled = false; toastError(err); }
  }
}
