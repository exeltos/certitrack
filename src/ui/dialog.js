// Native <dialog> based modals, confirmations and toasts. No dependencies.
import { html, mount } from '../lib/html.js';
import { icon, friendlyError } from './components.js';
import { t } from '../lib/i18n.js';

// Open a modal. `body` is a template; `onSubmit(form, dialog)` may return false
// (keep open) or throw (error is shown inside the dialog). Resolves with the
// onSubmit result, or null when dismissed.
export function openDialog({ title, description, body = '', submitLabel, cancelLabel = t('common.cancel'),
  danger = false, wide = false, onOpen, onSubmit, hideSubmit = false }) {
  return new Promise(resolve => {
    const dlg = document.createElement('dialog');
    dlg.className = `dialog${wide ? ' dialog--wide' : ''}`;
    mount(dlg, html`
      <form method="dialog" class="dialog__form" novalidate>
        <header class="dialog__head">
          <div><h2>${title}</h2>${description ? html`<p>${description}</p>` : ''}</div>
          <button type="button" class="icon-btn" data-close aria-label="${t('common.close')}">${icon('x')}</button>
        </header>
        <div class="dialog__body">${body}</div>
        <p class="dialog__error" role="alert" hidden></p>
        <footer class="dialog__foot">
          <button type="button" class="btn btn--ghost" data-close>${cancelLabel}</button>
          ${hideSubmit ? '' : html`<button type="submit" class="btn ${danger ? 'btn--danger' : 'btn--primary'}">${submitLabel || t('common.save')}</button>`}
        </footer>
      </form>`);
    document.body.appendChild(dlg);
    const form = dlg.querySelector('form');
    const errorEl = dlg.querySelector('.dialog__error');
    let result = null;
    const close = () => { dlg.close(); };
    dlg.addEventListener('close', () => { dlg.remove(); resolve(result); });
    dlg.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', close));
    dlg.addEventListener('click', e => { if (e.target === dlg) close(); });
    form.addEventListener('submit', async e => {
      e.preventDefault();
      if (!form.reportValidity()) return;
      const btn = form.querySelector('[type=submit]');
      btn?.setAttribute('aria-busy', 'true'); if (btn) btn.disabled = true;
      errorEl.hidden = true;
      try {
        const out = onSubmit ? await onSubmit(form, dlg) : true;
        if (out === false) return;
        result = out ?? true;
        close();
      } catch (err) {
        console.error(err);
        errorEl.textContent = err?.userMessage || friendlyError(err);
        errorEl.hidden = false;
      } finally {
        btn?.removeAttribute('aria-busy'); if (btn) btn.disabled = false;
      }
    });
    dlg.showModal();
    // finish(value): close and resolve with value (for extra action buttons).
    onOpen?.(form, dlg, value => { result = value; close(); });
    form.querySelector('[autofocus]')?.focus();
  });
}

export async function confirmDialog({ title, text, confirmLabel, danger = false }) {
  const ok = await openDialog({ title, body: text ? html`<p class="muted">${text}</p>` : '', submitLabel: confirmLabel || t('common.confirm'), danger });
  return ok === true;
}

let toastHost;
export function toast(message, kind = 'success') {
  toastHost ||= Object.assign(document.body.appendChild(document.createElement('div')), { className: 'toasts' });
  toastHost.setAttribute('role', 'status');
  const el = document.createElement('div');
  el.className = `toast toast--${kind}`;
  mount(el, html`${icon(kind === 'error' ? 'circle-alert' : kind === 'info' ? 'info' : 'circle-check')}<span>${message}</span>`);
  toastHost.appendChild(el);
  setTimeout(() => { el.classList.add('toast--out'); setTimeout(() => el.remove(), 300); }, 3600);
}

export function toastError(err) { console.error(err); toast(friendlyError(err), 'error'); }

// Show a PDF in a full-height modal.
export async function showPdf({ url, fileName, title }) {
  await openDialog({
    title: title || fileName, wide: true, hideSubmit: true, cancelLabel: t('common.close'),
    body: html`<div class="pdf-frame"><iframe src="${url}" title="${title || fileName}"></iframe></div>
      <p class="pdf-actions"><a class="btn btn--ghost btn--sm" href="${url}" target="_blank" rel="noopener" download="${fileName}">${icon('download')} ${t('common.download')}</a></p>`
  });
}
