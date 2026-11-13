// Platform owner settings: the contact details shown on the public home page.
import { api } from '../../api/index';
import { html, mount, raw } from '../../lib/html';
import { t } from '../../lib/i18n';
import { startPage } from '../../ui/shell';
import { icon, errorState } from '../../ui/components';
import { openDialog, toast, UserError } from '../../ui/dialog';

const { content } = await startPage({ area: 'admin', page: 'adminSettings', title: 'admin.settingsTitle', subtitle: 'admin.settingsSubtitle' });

try {
  const contact = await api.siteContact();
  mount(content, html`<section class="card" style="max-width:860px" data-contact-card>${contactSection(contact)}</section>`);
  bindContact(contact);
} catch (err) { console.error(err); mount(content, errorState(err)); }

// ---------------------------------------------------------------- home page contact card
function contactSection(c) {
  const row = (ic, label, value) => html`<li class="row"><span class="row__icon">${icon(ic)}</span><div class="row__main"><span class="row__title">${value || '—'}</span><span class="row__meta"><span>${label}</span></span></div></li>`;
  return html`<div class="card__head"><div><h2>${t('admin.contactTitle')}</h2><p>${t('admin.contactText')}</p></div>
      <button type="button" class="btn btn--sm btn--secondary" data-edit-contact>${icon('pencil', { size: 16 })}${t('common.edit')}</button></div>
    <ul class="rows">${row('building', t('admin.contactCompany'), c.company)}${row('mail', t('home.contactEmail'), c.email)}${row('phone', t('home.contactPhone'), c.phone)}${row('globe', t('home.contactWebsite'), c.website)}</ul>`;
}

function bindContact(c) {
  document.querySelector('[data-edit-contact]').addEventListener('click', async () => {
    const field = (name, label, type, value) => html`<div class="field"><label for="c-${name}">${label}</label>
      <input class="input" id="c-${name}" name="${name}" type="${type}" value="${value || ''}" maxlength="200" ${name === 'company' ? raw('required') : ''}></div>`;
    const saved = await openDialog({
      title: t('admin.contactTitle'), description: t('admin.contactText'),
      body: html`<div class="form-grid">
        ${field('company', t('admin.contactCompany'), 'text', c.company)}
        ${field('email', t('home.contactEmail'), 'email', c.email)}
        ${field('phone', t('home.contactPhone'), 'tel', c.phone)}
        ${field('website', t('home.contactWebsite'), 'text', c.website)}</div>`,
      onSubmit: async form => {
        const f = new FormData(form);
        const value = k => String(f.get(k) || '').trim();
        try {
          return await api.setSiteContact({ company: value('company'), email: value('email') || null, phone: value('phone') || null, website: value('website') || null });
        } catch (err) {
          const bad = /Invalid (email|phone|website|company)/.exec(err?.message || '')?.[1];
          throw bad ? new UserError(t(`admin.contactInvalid.${bad}`)) : err;
        }
      }
    });
    if (saved && saved !== true) {
      toast(t('admin.contactSaved'));
      mount('[data-contact-card]', contactSection(saved));
      bindContact(saved);
    }
  });
}
