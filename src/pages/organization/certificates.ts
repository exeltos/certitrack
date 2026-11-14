// The organization's own certificates: list, filters and actions.
import { api } from '../../api/index';
import { html, mount, raw } from '../../lib/html';
import { t } from '../../lib/i18n';
import { certificateState, type CertificateState } from '../../lib/format';
import { definePage, type PageContext } from '../../app/page';
import { icon, stateBadge, sharingBadge, emptyState, errorState, certTypeLabel, expiryText } from '../../ui/components';
import { confirmDialog, toast, toastError, showPdf } from '../../ui/dialog';
import { certificateDialog, sharingDialog, viewsDialog } from './certificateForms';
import type { Certificate, CertificateType, Connection, Sharing } from '../../types/domain';

type StateFilter = 'all' | Exclude<CertificateState, 'none'>;
type SharingFilter = 'all' | Sharing;
const STATE_FILTERS: readonly StateFilter[] = ['all', 'valid', 'expiring', 'expired'];
const SHARING_FILTERS: readonly SharingFilter[] = ['all', 'private', 'all_connections', 'selected'];

export default definePage({
  area: 'organization', nav: 'certificates', title: 'certs.title', subtitle: 'certs.subtitle',
  render: page => new CertificatesPage(page).start()
});

class CertificatesPage {
  private readonly canEdit: boolean;
  private readonly canDelete: boolean;
  private readonly params = new URLSearchParams(location.search);
  private readonly filters: { q: string; state: StateFilter; sharing: SharingFilter };
  private certs: Certificate[] = [];
  private types: CertificateType[] = [];
  private partners: Connection[] = [];

  constructor(private readonly page: PageContext) {
    const role = page.ctx.role;
    this.canEdit = role === 'owner' || role === 'admin' || role === 'member';
    this.canDelete = role === 'owner' || role === 'admin';
    const state = this.params.get('state');
    this.filters = { q: '', state: STATE_FILTERS.includes(state as StateFilter) ? state as StateFilter : 'all', sharing: 'all' };
  }

  async start(): Promise<void> {
    const { actions, content } = this.page;
    if (this.canEdit) {
      mount(actions, html`<button class="btn btn--primary" data-new>${icon('plus')}${t('certs.new')}</button>`);
      actions.querySelector('[data-new]')!.addEventListener('click', () => { void this.create(); });
    }
    content.addEventListener('click', e => { void this.onAction(e); });
    await this.refresh();
  }

  private async create(): Promise<void> {
    if (await certificateDialog({ types: this.types, partners: this.partners })) { toast(t('certs.created')); void this.refresh(); }
  }

  private async refresh(): Promise<void> {
    try {
      const [certs, types, connections] = await Promise.all([api.myCertificates(), api.certificateTypes(), api.connections()]);
      if (this.page.signal.aborted) return;
      this.certs = certs; this.types = types; this.partners = connections.filter(c => c.status === 'active');
      this.render();
    } catch (err) { console.error(err); mount(this.page.content, errorState(err)); }
  }

  private matches(c: Certificate): boolean {
    const q = this.filters.q.toLowerCase();
    if (q && !`${c.title} ${certTypeLabel(c)} ${c.certificate_number || ''} ${c.issuer || ''}`.toLowerCase().includes(q)) return false;
    if (this.filters.state !== 'all' && certificateState(c.expiry_date) !== this.filters.state) return false;
    if (this.filters.sharing !== 'all' && c.sharing !== this.filters.sharing) return false;
    return true;
  }

  private render(): void {
    const { content } = this.page;
    const count = (s: CertificateState) => this.certs.filter(c => certificateState(c.expiry_date) === s).length;
    mount(content, html`<section class="card">
      <div class="toolbar">
        <label class="search">${icon('search', { size: 16 })}<span class="sr-only">${t('common.search')}</span>
          <input class="input" type="search" data-q placeholder="${t('certs.searchPlaceholder')}" value="${this.filters.q}"></label>
        <select class="select" data-state aria-label="${t('certs.filterState')}">
          ${STATE_FILTERS.map(s => html`<option value="${s}" ${this.filters.state === s ? raw('selected') : ''}>${s === 'all' ? t('certs.allStates', { count: this.certs.length }) : `${t(`state.${s}`)} (${count(s)})`}</option>`)}
        </select>
        <select class="select" data-sharing aria-label="${t('sharing.title')}">
          ${SHARING_FILTERS.map(s => html`<option value="${s}" ${this.filters.sharing === s ? raw('selected') : ''}>${s === 'all' ? t('certs.allSharing') : t(`sharing.${s}`)}</option>`)}
        </select>
      </div>
      <div data-list></div>
    </section>`);
    content.querySelector<HTMLInputElement>('[data-q]')!.addEventListener('input', e => { this.filters.q = (e.target as HTMLInputElement).value; this.renderList(); });
    content.querySelector<HTMLSelectElement>('[data-state]')!.addEventListener('change', e => { this.filters.state = (e.target as HTMLSelectElement).value as StateFilter; this.renderList(); });
    content.querySelector<HTMLSelectElement>('[data-sharing]')!.addEventListener('change', e => { this.filters.sharing = (e.target as HTMLSelectElement).value as SharingFilter; this.renderList(); });
    this.renderList();
    const focus = this.params.get('focus');
    if (focus) {
      const el = content.querySelector<HTMLElement>(`#cert-${CSS.escape(focus)}`);
      el?.classList.add('is-focus');
      requestAnimationFrame(() => el?.scrollIntoView({ block: 'center' }));
    }
  }

  private renderList(): void {
    const { content, actions } = this.page;
    const host = content.querySelector<HTMLElement>('[data-list]')!;
    if (!this.certs.length) {
      mount(host, emptyState({ iconName: 'file-plus', title: t('certs.emptyTitle'), text: t('certs.emptyText'),
        action: this.canEdit ? html`<button class="btn btn--primary" data-empty-new>${icon('plus')}${t('certs.new')}</button>` : '' }));
      host.querySelector('[data-empty-new]')?.addEventListener('click', () => actions.querySelector<HTMLElement>('[data-new]')?.click());
      return;
    }
    const list = this.certs.filter(c => this.matches(c));
    if (!list.length) { mount(host, emptyState({ iconName: 'search', title: t('certs.noMatch'), text: t('certs.noMatchText') })); return; }
    const btn = (act: string, id: string, ic: string, label: string) =>
      html`<button class="icon-btn icon-btn--sm" data-act="${act}" data-id="${id}" title="${label}" aria-label="${label}">${icon(ic)}</button>`;
    mount(host, html`<ul class="rows">${list.map(c => html`<li class="row" id="cert-${c.id}">
      <span class="row__icon">${icon('file-text')}</span>
      <div class="row__main">
        <span class="row__title">${c.title}</span>
        <span class="row__meta"><span>${certTypeLabel(c)}</span>${c.issuer ? html`<span>${c.issuer}</span>` : ''}<span>${expiryText(c.expiry_date)}</span></span>
      </div>
      <div class="row__side">
        ${stateBadge(c.expiry_date)}
        ${sharingBadge(c)}
        <span class="row__actions">
          ${c.current_file_id ? btn('view', c.id, 'eye', t('common.view')) : ''}
          ${this.canEdit ? btn('share', c.id, 'share-2', t('sharing.dialogTitle')) : ''}
          ${btn('views', c.id, 'activity', t('views.title'))}
          ${this.canEdit ? btn('edit', c.id, 'pencil', t('common.edit')) : ''}
          ${this.canDelete ? btn('delete', c.id, 'trash', t('common.delete')) : ''}
        </span>
      </div></li>`)}</ul>`);
  }

  private async onAction(e: Event): Promise<void> {
    const button = (e.target as Element).closest<HTMLElement>('[data-act]');
    const cert = button && this.certs.find(c => c.id === button.dataset.id);
    if (!button || !cert) return;
    try {
      switch (button.dataset.act) {
        case 'view': { const f = await api.openCertificate(cert.id); await showPdf({ ...f, title: cert.title }); break; }
        case 'share': if (await sharingDialog({ cert, partners: this.partners })) { toast(t('sharing.saved')); void this.refresh(); } break;
        case 'views': await viewsDialog(cert); break;
        case 'edit': if (await certificateDialog({ cert, types: this.types, partners: this.partners })) { toast(t('common.saved')); void this.refresh(); } break;
        case 'delete':
          if (await confirmDialog({ title: t('certs.deleteTitle'), text: t('certs.deleteText', { title: cert.title }), confirmLabel: t('common.delete'), danger: true })) {
            await api.deleteCertificate(cert.id); toast(t('certs.deleted')); void this.refresh();
          }
          break;
      }
    } catch (err) { toastError(err); }
  }
}
