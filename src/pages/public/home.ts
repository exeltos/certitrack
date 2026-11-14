// Public home page.
import { html, mount, type SafeHtml } from '../../lib/html';
import { t } from '../../lib/i18n';
import { icon, avatar } from '../../ui/components';
import { openDialog, UserError } from '../../ui/dialog';
import { fieldValue } from '../../lib/form';
import { publicPage } from './layout';
import { api, DEMO_OPEN } from '../../api/index';
import { DEFAULT_CONTACT } from '../../api/supabase';
import type { SiteContact } from '../../types/domain';

const node = (name: string, sub: string) => html`<div class="preview__node">${avatar(name, { size: 'lg' })}<span>${name}</span><small>${sub}</small></div>`;

const mailto = (c: SiteContact, subject?: string) => `mailto:${c.email}${subject ? `?subject=${encodeURIComponent(subject)}` : ''}`;
// "Request a presentation" opens a short form (requestPresentation below).
const cta = (): SafeHtml => html`<button type="button" class="btn btn--primary btn--lg" data-present>${icon('presentation')}${t('home.ctaPresentation')}</button>
  ${DEMO_OPEN ? html`<a class="btn btn--secondary btn--lg" href="/pages/demo/index.html">${icon('eye')}${t('home.ctaDemo')}</a>` : ''}`;
/** Only plain web addresses become links (the value is editable by the owner). */
const webLink = (url: string | null): string | null => (url && /^https?:\/\//i.test(url) ? url : null);
const contactCard = (c: SiteContact): SafeHtml => {
  const site = webLink(c.website);
  return html`<address class="contact-card" aria-label="${t('home.contactTitle')}">
  <strong class="contact-card__company">${c.company}</strong>
  <ul>
    ${c.email ? html`<li><a href="${mailto(c)}">${icon('mail', { size: 16 })}<span class="sr-only">${t('home.contactEmail')}: </span>${c.email}</a></li>` : ''}
    ${c.phone ? html`<li><a href="tel:${c.phone.replace(/[^+0-9]/g, '')}">${icon('phone', { size: 16 })}<span class="sr-only">${t('home.contactPhone')}: </span>${c.phone}</a></li>` : ''}
    ${site ? html`<li><a href="${site}" target="_blank" rel="noopener">${icon('globe', { size: 16 })}<span class="sr-only">${t('home.contactWebsite')}: </span>${site.replace(/^https?:\/\//i, '').replace(/\/$/, '')}</a></li>` : ''}
  </ul>
</address>`;
};

const FEATURES = [['users', 'f1'], ['share-2', 'f2'], ['inbox', 'f3']] as const;

publicPage({
  titleKey: 'public.homeTitle',
  brand: true,
  nav: html`<a class="btn btn--ghost btn--sm" href="/pages/auth/login.html">${t('auth.signIn')}</a>`,
  body: html`<main id="main">
    <section class="hero">
      <div>
        <span class="eyebrow">${icon('shield-check', { size: 14 })}${t('home.eyebrow')}</span>
        <h1>${t('home.headline')} <em>${t('home.headlineAccent')}</em></h1>
        <p class="hero__lead">${t('home.lead')}</p>
        <div class="hero__cta">${cta()}</div>
        <div data-contact>${contactCard(DEFAULT_CONTACT)}</div>
      </div>
      <div class="card preview" aria-label="${t('home.previewLabel')}">
        <div class="preview__net">
          ${node('Alpha Α.Ε.', t('home.you'))}
          <div class="preview__link">${icon('link-2')}<span>${t('home.connected')}</span></div>
          ${node('Beta ΕΠΕ', t('home.partner'))}
          <div class="preview__link preview__link--off">${icon('lock')}<span>${t('home.notVisible')}</span></div>
          ${node('Gamma ΙΚΕ', t('home.theirPartner'))}
        </div>
        <ul class="rows">
          <li class="row"><span class="row__icon row__icon--success">${icon('globe')}</span><div class="row__main"><span class="row__title">ISO 9001:2015</span><span class="row__meta"><span>${t('home.sampleAll')}</span></span></div><span class="badge badge--success">${t('state.valid')}</span></li>
          <li class="row"><span class="row__icon row__icon--info">${icon('user-check')}</span><div class="row__main"><span class="row__title">ISO 13485:2016</span><span class="row__meta"><span>${t('home.sampleSelected')}</span></span></div><span class="badge badge--warning">${t('state.expiring')}</span></li>
          <li class="row"><span class="row__icon">${icon('lock')}</span><div class="row__main"><span class="row__title">${t('home.sampleInternal')}</span><span class="row__meta"><span>${t('sharing.private')}</span></span></div><span class="badge badge--neutral">${t('sharing.private')}</span></li>
        </ul>
      </div>
    </section>
    <section class="features">
      ${FEATURES.map(([ic, k]) => html`<article class="card feature"><span class="row__icon">${icon(ic)}</span><h2>${t(`home.${k}Title`)}</h2><p>${t(`home.${k}Text`)}</p></article>`)}
    </section>
  </main>`
});

// The details are editable by the platform owner; show the saved ones.
api.siteContact().then(c => { mount('[data-contact]', contactCard(c)); })
  .catch(err => console.warn('contact card', err));

document.querySelector('[data-present]')?.addEventListener('click', () => { void requestPresentation(); });

/** The form; the request is stored for the owner and emailed to the contact address. */
async function requestPresentation(): Promise<void> {
  let sentTo = '';
  const input = (name: string, label: string, type: string, extra: SafeHtml | '' = '') => html`<div class="field"><label for="pr-${name}">${label}</label>
    <input class="input" id="pr-${name}" name="${name}" type="${type}" ${extra}></div>`;
  const sent = await openDialog({
    title: t('pres.formTitle'), description: t('pres.formText'), submitLabel: t('pres.send'),
    body: html`<div class="form-grid form-grid--2">
        ${input('name', t('pres.name') + ' *', 'text', html`required maxlength="120" autocomplete="name" autofocus`)}
        ${input('company', t('pres.company') + ' *', 'text', html`required maxlength="160" autocomplete="organization"`)}
        ${input('email', t('pres.email') + ' *', 'email', html`required maxlength="254" autocomplete="email"`)}
        ${input('phone', t('pres.phone'), 'tel', html`maxlength="40" autocomplete="tel" pattern="\\+?[0-9 \\.\\-\\(\\)]{5,}"`)}
        <div class="field span-2"><label for="pr-message">${t('pres.message')}</label>
          <textarea class="textarea" id="pr-message" name="message" rows="3" maxlength="2000" placeholder="${t('pres.messagePlaceholder')}"></textarea></div>
      </div>
      <div class="hp-field" aria-hidden="true"><label for="pr-website">Website</label><input id="pr-website" name="website" tabindex="-1" autocomplete="off"></div>
      <small class="hint">${t('pres.privacy')}</small>`,
    async onSubmit(form) {
      const email = fieldValue(form, 'email');
      try {
        await api.submitPresentationRequest({ name: fieldValue(form, 'name'), company: fieldValue(form, 'company'), email,
          phone: fieldValue(form, 'phone'), message: fieldValue(form, 'message'), trap: fieldValue(form, 'website') });
      } catch (err) {
        const message = err instanceof Error ? err.message : '';
        if (/Too many requests/.test(message)) throw new UserError(t('pres.tooMany'));
        const bad = /Invalid (name|company|email|phone|message)/.exec(message)?.[1] as 'name' | 'company' | 'email' | 'phone' | 'message' | undefined;
        throw bad ? new UserError(t(`pres.invalid.${bad}`)) : err;
      }
      sentTo = email;
      return true;
    }
  });
  if (sent !== true) return;
  await openDialog({
    title: t('pres.thanksTitle'), hideSubmit: true, cancelLabel: t('common.close'),
    body: html`<div class="empty" style="padding:8px 0"><span class="empty__icon">${icon('circle-check', { size: 22 })}</span><p>${t('pres.thanksText', { email: sentTo })}</p></div>`
  });
}
