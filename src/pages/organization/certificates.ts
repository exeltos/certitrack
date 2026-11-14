// The organization's own certificates: list, filters and actions.
import { api } from '../../api/index';
import { html, mount, raw } from '../../lib/html';
import { t } from '../../lib/i18n';
import { certificateState, type CertificateState } from '../../lib/format';
import { definePage, type PageContext } from '../../app/page';
import { icon, stateBadge, sharingBadge, emptyState, errorState, certTypeLabel, expiryText } from '../../ui/components';
import { confirmDialog, toast, toastError, showPdf } from '../../ui/dialog';
import { menuButton, openMenu, type MenuItem } from '../../ui/menu';
import { certificateDialog, sharingDialog, viewsDialog } from './certificateForms';
import type { Certificate, CertificateType, Connection, Sharing } from '../../types/domain';

type StateFilter = 'all' | Exclude<CertificateState, 'none'>;
type SharingFilter = 'all' | Sharing;
const STATE_FILTERS: readonly StateFilter[] = ['all', 'valid', 'expiring', 'expired'];
const SHARING_FILTERS: readonly SharingFilter[] = ['all', 'private', 'all_connections', 'selected'];
type SortKey = 'title' | 'expiry' | 'state';
// Most urgent first when sorting by state.
const STATE_ORDER: Record<CertificateState, number> = { expired: 0, expiring: 1, valid: 2, none: 3 };

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
  private sort: { key: SortKey; dir: 1 | -1 } = { key: 'expiry', dir: 1 };

  constructor(private readonly page: PageContext) {
    const role = page.ctx.role;
    this.canEdit = role === 'owner' || role === 'admin' || role === 'member';
    this.canDelete = this.canEdit;   // every Μέλος may delete
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

  private sorted(list: Certificate[]): Certificate[] {
    const { key, dir } = this.sort;
    const value = (c: Certificate): string | number =>
      key === 'title' ? c.title.toLocaleLowerCase()
        : key === 'state' ? STATE_ORDER[certificateState(c.expiry_date)]
          : c.expiry_date || '9999-12-31';   // no expiry last
    return [...list].sort((a, b) => {
      const x = value(a), y = value(b);
      return (x < y ? -1 : x > y ? 1 : a.title.localeCompare(b.title)) * dir;
    });
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
    const list = this.sorted(this.certs.filter(c => this.matches(c)));
    if (!list.length) { mount(host, emptyState({ iconName: 'search', title: t('certs.noMatch'), text: t('certs.noMatchText') })); return; }
    const head = (key: SortKey, label: string) => {
      const on = this.sort.key === key;
      return html`<th aria-sort="${on ? (this.sort.dir === 1 ? 'ascending' : 'descending') : 'none'}"><button type="button" class="th-sort ${on ? 'is-on' : ''}" data-sort="${key}">${label}${icon(on && this.sort.dir === -1 ? 'arrow-up' : 'arrow-down', { size: 13 })}</button></th>`;
    };
    mount(host, html`<table class="table table--certs">
      <thead><tr>${head('title', t('certs.colTitle'))}${head('expiry', t('certs.colExpiry'))}${head('state', t('certs.colState'))}<th>${t('certs.colSharing')}</th><th><span class="sr-only">${t('common.actions')}</span></th></tr></thead>
      <tbody>${list.map(c => html`<tr id="cert-${c.id}">
        <td class="cert-name"><div class="cert-cell"><span class="row__icon">${icon('file-text')}</span><span><strong>${c.title}</strong><small>${certTypeLabel(c)}${c.issuer ? ` · ${c.issuer}` : ''}</small></span></div></td>
        <td class="cert-expiry">${expiryText(c.expiry_date)}</td>
        <td>${stateBadge(c.expiry_date)}</td>
        <td>${sharingBadge(c)}</td>
        <td class="cert-actions">
          ${c.current_file_id ? html`<button type="button" class="btn btn--sm btn--secondary" data-act="view" data-id="${c.id}">${icon('eye', { size: 16 })}${t('common.view')}</button>` : ''}
          ${menuButton(c.id, t('common.moreActions'))}
        </td></tr>`)}</tbody></table>`);
  }

  private menuItems(): MenuItem[] {
    const items: MenuItem[] = [];
    if (this.canEdit) items.push({ action: 'share', label: t('sharing.dialogTitle'), icon: 'share-2' });
    items.push({ action: 'views', label: t('views.title'), icon: 'activity' });
    if (this.canEdit) items.push({ action: 'edit', label: t('common.edit'), icon: 'pencil' });
    if (this.canDelete) items.push({ action: 'delete', label: t('common.delete'), icon: 'trash', danger: true });
    return items;
  }

  private async onAction(e: Event): Promise<void> {
    const target = e.target as Element;
    const sortBtn = target.closest<HTMLElement>('[data-sort]');
    if (sortBtn) {
      const key = sortBtn.dataset.sort as SortKey;
      this.sort = { key, dir: this.sort.key === key ? (this.sort.dir === 1 ? -1 : 1) : 1 };
      this.renderList();
      this.page.content.querySelector<HTMLElement>(`[data-sort="${key}"]`)?.focus();
      return;
    }
    const menuBtn = target.closest<HTMLElement>('[data-menu]');
    if (menuBtn) {
      const cert = this.certs.find(c => c.id === menuBtn.dataset.menu);
      if (cert) openMenu(menuBtn, this.menuItems(), action => { void this.run(action, cert); });
      return;
    }
    const button = target.closest<HTMLElement>('[data-act]');
    const cert = button && this.certs.find(c => c.id === button.dataset.id);
    if (button?.dataset.act && cert) await this.run(button.dataset.act, cert);
  }

  private async run(action: string, cert: Certificate): Promise<void> {
    try {
      switch (action) {
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
