// Platform owner settings: the contact details shown on the public home page.
import { api } from '../../api/index';
import { html, mount, raw, type SafeHtml } from '../../lib/html';
import { t } from '../../lib/i18n';
import { fieldValue } from '../../lib/form';
import { definePage } from '../../app/page';
import { icon, errorState } from '../../ui/components';
import { openDialog, toast, UserError } from '../../ui/dialog';
import type { SiteContact } from '../../types/domain';

export default definePage({
  area: 'admin', nav: 'adminSettings', title: 'admin.settingsTitle', subtitle: 'admin.settingsSubtitle',
  async render({ content, signal }) {
    try {
      const contact = await api.siteContact();
      if (signal.aborted) return;
      mount(content, html`<section class="card" style="max-width:860px" data-contact-card></section>`);
      showContact(content.querySelector<HTMLElement>('[data-contact-card]')!, contact);
    } catch (err) { console.error(err); mount(content, errorState(err)); }
  }
});

function contactSection(c: SiteContact): SafeHtml {
  const row = (ic: string, label: string, value: string | null) => html`<li class="row"><span class="row__icon">${icon(ic)}</span><div class="row__main"><span class="row__title">${value || '—'}</span><span class="row__meta"><span>${label}</span></span></div></li>`;
  return html`<div class="card__head"><div><h2>${t('admin.contactTitle')}</h2><p>${t('admin.contactText')}</p></div>
      <button type="button" class="btn btn--sm btn--secondary" data-edit-contact>${icon('pencil', { size: 16 })}${t('common.edit')}</button></div>
    <ul class="rows">${row('building', t('admin.contactCompany'), c.company)}${row('mail', t('home.contactEmail'), c.email)}${row('phone', t('home.contactPhone'), c.phone)}${row('globe', t('home.contactWebsite'), c.website)}</ul>`;
}

function showContact(card: HTMLElement, c: SiteContact): void {
  mount(card, contactSection(c));
  card.querySelector('[data-edit-contact]')!.addEventListener('click', async () => {
    const input = (name: keyof SiteContact, label: string, type: string) => html`<div class="field"><label for="c-${name}">${label}</label>
      <input class="input" id="c-${name}" name="${name}" type="${type}" value="${c[name] || ''}" maxlength="200" ${name === 'company' ? raw('required') : ''}></div>`;
    const saved = await openDialog<SiteContact>({
      title: t('admin.contactTitle'), description: t('admin.contactText'),
      body: html`<div class="form-grid">
        ${input('company', t('admin.contactCompany'), 'text')}
        ${input('email', t('home.contactEmail'), 'email')}
        ${input('phone', t('home.contactPhone'), 'tel')}
        ${input('website', t('home.contactWebsite'), 'text')}</div>`,
      async onSubmit(form) {
        const value = (k: string) => fieldValue(form, k) || null;
        try {
          return await api.setSiteContact({ company: fieldValue(form, 'company'), email: value('email'), phone: value('phone'), website: value('website') });
        } catch (err) {
          // The server checks every field; show which one it rejected.
          const bad = /Invalid (email|phone|website|company)/.exec(err instanceof Error ? err.message : '')?.[1] as 'email' | 'phone' | 'website' | 'company' | undefined;
          throw bad ? new UserError(t(`admin.contactInvalid.${bad}`)) : err;
        }
      }
    });
    if (saved && saved !== true) {
      toast(t('admin.contactSaved'));
      showContact(card, saved);
    }
  });
}
