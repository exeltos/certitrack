import { html, mount } from '../../lib/html';
import { t } from '../../lib/i18n';
import { icon, avatar } from '../../ui/components';
import { publicPage } from './layout';
import { api, DEMO_OPEN } from '../../api/index';
import { DEFAULT_CONTACT } from '../../api/supabase';

const node = (name, sub) => html`<div class="preview__node">${avatar(name, { size: 'lg' })}<span>${name}</span><small>${sub}</small></div>`;

// "Request a presentation" opens an email to the contact address.
const mailto = (c, subject) => `mailto:${c.email}${subject ? `?subject=${encodeURIComponent(subject)}` : ''}`;
const cta = c => html`${c.email ? html`<a class="btn btn--primary btn--lg" href="${mailto(c, t('home.presentationSubject'))}">${icon('presentation')}${t('home.ctaPresentation')}</a>` : ''}
  ${DEMO_OPEN ? html`<a class="btn btn--secondary btn--lg" href="/pages/demo/index.html">${icon('eye')}${t('home.ctaDemo')}</a>` : ''}`;
const webLink = url => /^https?:\/\//i.test(url || '') ? url : null;
const contactCard = c => html`<address class="contact-card" aria-label="${t('home.contactTitle')}">
  <strong class="contact-card__company">${c.company}</strong>
  <ul>
    ${c.email ? html`<li><a href="${mailto(c)}">${icon('mail', { size: 16 })}<span class="sr-only">${t('home.contactEmail')}: </span>${c.email}</a></li>` : ''}
    ${c.phone ? html`<li><a href="tel:${c.phone.replace(/[^+0-9]/g, '')}">${icon('phone', { size: 16 })}<span class="sr-only">${t('home.contactPhone')}: </span>${c.phone}</a></li>` : ''}
    ${webLink(c.website) ? html`<li><a href="${c.website}" target="_blank" rel="noopener">${icon('globe', { size: 16 })}<span class="sr-only">${t('home.contactWebsite')}: </span>${c.website.replace(/^https?:\/\//i, '').replace(/\/$/, '')}</a></li>` : ''}
  </ul>
</address>`;

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
        <div class="hero__cta" data-cta>${cta(DEFAULT_CONTACT)}</div>
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
      ${[['users', 'f1'], ['share-2', 'f2'], ['inbox', 'f3']].map(([ic, k]) => html`<article class="card feature"><span class="row__icon">${icon(ic)}</span><h2>${t(`home.${k}Title`)}</h2><p>${t(`home.${k}Text`)}</p></article>`)}
    </section>
  </main>`
});

// The details are editable by the platform owner; show the saved ones.
api.siteContact().then(c => {
  mount('[data-cta]', cta(c));
  mount('[data-contact]', contactCard(c));
}).catch(err => console.warn('contact card', err));
