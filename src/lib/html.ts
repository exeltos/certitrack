// Safe HTML templating.
//
//   html`<p>${userText}</p>`      -> interpolations are escaped automatically
//   html`<ul>${items.map(i => html`<li>${i}</li>`)}</ul>`   -> nested templates are kept as markup
//   raw(trustedMarkup)            -> opt out explicitly (only for markup we generated ourselves)
import { escapeHtml } from '../shared/html';

export class SafeHtml {
  constructor(readonly value: string) {}
  toString(): string { return this.value; }
}

/** Anything that can be interpolated into html``. */
export type Renderable = SafeHtml | string | number | null | undefined | false | readonly Renderable[];

export const raw = (value: unknown): SafeHtml => new SafeHtml(String(value ?? ''));

function render(value: Renderable): string {
  if (value === null || value === undefined || value === false) return '';
  if (value instanceof SafeHtml) return value.value;
  if (Array.isArray(value)) return value.map(render).join('');
  return escapeHtml(value);
}

export function html(strings: TemplateStringsArray, ...values: Renderable[]): SafeHtml {
  let out = strings[0] ?? '';
  values.forEach((value, i) => { out += render(value) + (strings[i + 1] ?? ''); });
  return new SafeHtml(out);
}

/** Replace an element's content with a template result. */
export function mount<T extends Element>(target: T | string | null, content: Renderable): T | null {
  const el = typeof target === 'string' ? document.querySelector<T>(target) : target;
  if (el) el.innerHTML = render(content);
  return el;
}
