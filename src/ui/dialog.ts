// Native <dialog> based modals, confirmations and toasts. No dependencies.
import { html, mount, type Renderable } from '../lib/html';
import { icon, friendlyError } from './components';
import { t } from '../lib/i18n';

// Open a modal. `body` is a template; `onSubmit(form, dialog)` may return false
// (keep open) or throw (error is shown inside the dialog). Resolves with the
// onSubmit result, or null when dismissed.
export interface DialogOptions<R> {
  title: string;
  description?: string;
  body?: Renderable;
  submitLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  wide?: boolean;
  hideSubmit?: boolean;
  /** `finish(value)` closes the dialog and resolves with value (for extra action buttons). */
  onOpen?: (form: HTMLFormElement, dialog: HTMLDialogElement, finish: (value: R) => void) => void;
  /** Return false to keep the dialog open; throw to show the error inside it. */
  onSubmit?: (form: HTMLFormElement, dialog: HTMLDialogElement) => Promise<R | false | void> | R | false | void;
}

/** Errors that already carry a message meant for the user. */
export class UserError extends Error {
  constructor(readonly userMessage: string) { super(userMessage); }
}

export function openDialog<R = true>({ title, description, body = '', submitLabel, cancelLabel = t('common.cancel'),
  danger = false, wide = false, onOpen, onSubmit, hideSubmit = false }: DialogOptions<R>): Promise<R | true | null> {
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
    const form = dlg.querySelector('form') as HTMLFormElement;
    const errorEl = dlg.querySelector('.dialog__error') as HTMLElement;
    let result: R | true | null = null;
    const close = () => { dlg.close(); };
    dlg.addEventListener('close', () => { dlg.remove(); resolve(result); });
    dlg.querySelectorAll<HTMLElement>('[data-close]').forEach(b => b.addEventListener('click', close));
    dlg.addEventListener('click', e => { if (e.target === dlg) close(); });
    form.addEventListener('submit', async e => {
      e.preventDefault();
      if (!form.reportValidity()) return;
      const btn = form.querySelector<HTMLButtonElement>('[type=submit]');
      btn?.setAttribute('aria-busy', 'true'); if (btn) btn.disabled = true;
      errorEl.hidden = true;
      try {
        const out = onSubmit ? await onSubmit(form, dlg) : true;
        if (out === false) return;
        result = out ?? true;
        close();
      } catch (err) {
        console.error(err);
        errorEl.textContent = err instanceof UserError ? err.userMessage : friendlyError(err);
        errorEl.hidden = false;
      } finally {
        btn?.removeAttribute('aria-busy'); if (btn) btn.disabled = false;
      }
    });
    dlg.showModal();
    // finish(value): close and resolve with value (for extra action buttons).
    onOpen?.(form, dlg, value => { result = value; close(); });
    form.querySelector<HTMLElement>('[autofocus]')?.focus();
  });
}

export async function confirmDialog({ title, text, confirmLabel, danger = false }: { title: string; text?: string; confirmLabel?: string; danger?: boolean }): Promise<boolean> {
  const ok = await openDialog({ title, body: text ? html`<p class="muted">${text}</p>` : '', submitLabel: confirmLabel || t('common.confirm'), danger });
  return ok === true;
}

let toastHost: HTMLDivElement | undefined;
export function toast(message: string, kind: 'success' | 'error' | 'info' = 'success'): void {
  toastHost ||= Object.assign(document.body.appendChild(document.createElement('div')), { className: 'toasts' });
  toastHost.setAttribute('role', 'status');
  const el = document.createElement('div');
  el.className = `toast toast--${kind}`;
  mount(el, html`${icon(kind === 'error' ? 'circle-alert' : kind === 'info' ? 'info' : 'circle-check')}<span>${message}</span>`);
  toastHost.appendChild(el);
  setTimeout(() => { el.classList.add('toast--out'); setTimeout(() => el.remove(), 300); }, 3600);
}

export function toastError(err: unknown): void { console.error(err); toast(friendlyError(err), 'error'); }

// Show a PDF in a full-height modal.
export async function showPdf({ url, fileName, title }: { url: string; fileName: string; title?: string }): Promise<void> {
  await openDialog({
    title: title || fileName, wide: true, hideSubmit: true, cancelLabel: t('common.close'),
    body: html`<div class="pdf-frame"><iframe src="${url}" title="${title || fileName}"></iframe></div>
      <p class="pdf-actions"><a class="btn btn--ghost btn--sm" href="${url}" target="_blank" rel="noopener" download="${fileName}">${icon('download')} ${t('common.download')}</a></p>`
  });
}
