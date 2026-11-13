import { api } from '../../api/index.js';
import { html, mount, raw } from '../../lib/html.js';
import { t } from '../../lib/i18n.js';
import { certificateState } from '../../lib/format.js';
import { startPage } from '../../ui/shell.js';
import { icon, stateBadge, sharingBadge, emptyState, errorState, certTypeLabel, expiryText } from '../../ui/components.js';
import { confirmDialog, toast, toastError, showPdf } from '../../ui/dialog.js';
import { certificateDialog, sharingDialog, viewsDialog } from './certificateForms.js';

const { ctx, content, actions } = await startPage({ area: 'organization', page: 'certificates', title: 'certs.title', subtitle: 'certs.subtitle' });
const canEdit = ['owner', 'admin', 'member'].includes(ctx.role);
const canDelete = ['owner', 'admin'].includes(ctx.role);
const params = new URLSearchParams(location.search);
const filters = { q: '', state: params.get('state') || 'all', sharing: 'all' };
let state = { certs: [], types: [], partners: [] };

if (canEdit) {
  mount(actions, html`<button class="btn btn--primary" data-new>${icon('plus')}${t('certs.new')}</button>`);
  actions.querySelector('[data-new]').addEventListener('click', async () => {
    if (await certificateDialog({ types: state.types, partners: state.partners })) { toast(t('certs.created')); refresh(); }
  });
}

function matches(c) {
  const q = filters.q.toLowerCase();
  if (q && !`${c.title} ${certTypeLabel(c)} ${c.certificate_number || ''} ${c.issuer || ''}`.toLowerCase().includes(q)) return false;
  if (filters.state !== 'all' && certificateState(c.expiry_date) !== filters.state) return false;
  if (filters.sharing !== 'all' && c.sharing !== filters.sharing) return false;
  return true;
}

function renderList() {
  const list = state.certs.filter(matches);
  const host = content.querySelector('[data-list]');
  if (!state.certs.length) {
    mount(host, emptyState({ iconName: 'file-plus', title: t('certs.emptyTitle'), text: t('certs.emptyText'),
      action: canEdit ? html`<button class="btn btn--primary" data-empty-new>${icon('plus')}${t('certs.new')}</button>` : '' }));
    host.querySelector('[data-empty-new]')?.addEventListener('click', () => actions.querySelector('[data-new]').click());
    return;
  }
  if (!list.length) { mount(host, emptyState({ iconName: 'search', title: t('certs.noMatch'), text: t('certs.noMatchText') })); return; }
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
        ${c.current_file_id ? html`<button class="icon-btn icon-btn--sm" data-act="view" data-id="${c.id}" title="${t('common.view')}" aria-label="${t('common.view')}">${icon('eye')}</button>` : ''}
        ${canEdit ? html`<button class="icon-btn icon-btn--sm" data-act="share" data-id="${c.id}" title="${t('sharing.dialogTitle')}" aria-label="${t('sharing.dialogTitle')}">${icon('share-2')}</button>` : ''}
        <button class="icon-btn icon-btn--sm" data-act="views" data-id="${c.id}" title="${t('views.title')}" aria-label="${t('views.title')}">${icon('activity')}</button>
        ${canEdit ? html`<button class="icon-btn icon-btn--sm" data-act="edit" data-id="${c.id}" title="${t('common.edit')}" aria-label="${t('common.edit')}">${icon('pencil')}</button>` : ''}
        ${canDelete ? html`<button class="icon-btn icon-btn--sm" data-act="delete" data-id="${c.id}" title="${t('common.delete')}" aria-label="${t('common.delete')}">${icon('trash')}</button>` : ''}
      </span>
    </div></li>`)}</ul>`);
}

function render() {
  const count = s => state.certs.filter(c => certificateState(c.expiry_date) === s).length;
  mount(content, html`<section class="card">
    <div class="toolbar">
      <label class="search">${icon('search', { size: 16 })}<span class="sr-only">${t('common.search')}</span>
        <input class="input" type="search" data-q placeholder="${t('certs.searchPlaceholder')}" value="${filters.q}"></label>
      <select class="select" data-state aria-label="${t('certs.filterState')}">
        ${['all', 'valid', 'expiring', 'expired'].map(s => html`<option value="${s}" ${filters.state === s ? raw('selected') : ''}>${s === 'all' ? t('certs.allStates', { count: state.certs.length }) : `${t(`state.${s}`)} (${count(s)})`}</option>`)}
      </select>
      <select class="select" data-sharing aria-label="${t('sharing.title')}">
        ${['all', 'private', 'all_connections', 'selected'].map(s => html`<option value="${s}" ${filters.sharing === s ? raw('selected') : ''}>${s === 'all' ? t('certs.allSharing') : t(`sharing.${s}`)}</option>`)}
      </select>
    </div>
    <div data-list></div>
  </section>`);
  content.querySelector('[data-q]').addEventListener('input', e => { filters.q = e.target.value; renderList(); });
  content.querySelector('[data-state]').addEventListener('change', e => { filters.state = e.target.value; renderList(); });
  content.querySelector('[data-sharing]').addEventListener('change', e => { filters.sharing = e.target.value; renderList(); });
  renderList();
  const focus = params.get('focus');
  if (focus) { const el = document.getElementById(`cert-${focus}`); el?.scrollIntoView({ block: 'center' }); el?.classList.add('is-focus'); }
}

content.addEventListener('click', async e => {
  const btn = e.target.closest('[data-act]');
  if (!btn) return;
  const cert = state.certs.find(c => c.id === btn.dataset.id);
  try {
    switch (btn.dataset.act) {
      case 'view': { const f = await api.openCertificate(cert.id); await showPdf({ ...f, title: cert.title }); break; }
      case 'share': if (await sharingDialog({ cert, partners: state.partners })) { toast(t('sharing.saved')); refresh(); } break;
      case 'views': await viewsDialog(cert); break;
      case 'edit': if (await certificateDialog({ cert, types: state.types, partners: state.partners })) { toast(t('common.saved')); refresh(); } break;
      case 'delete':
        if (await confirmDialog({ title: t('certs.deleteTitle'), text: t('certs.deleteText', { title: cert.title }), confirmLabel: t('common.delete'), danger: true })) {
          await api.deleteCertificate(cert.id); toast(t('certs.deleted')); refresh();
        }
        break;
    }
  } catch (err) { toastError(err); }
});

async function refresh() {
  try {
    const [certs, types, connections] = await Promise.all([api.myCertificates(), api.certificateTypes(), api.connections()]);
    state = { certs, types, partners: connections.filter(c => c.status === 'active') };
    render();
  } catch (err) { console.error(err); mount(content, errorState(err)); }
}
refresh();
