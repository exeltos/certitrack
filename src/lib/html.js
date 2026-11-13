// Safe HTML templating.
//
//   html`<p>${userText}</p>`      -> interpolations are escaped automatically
//   html`<ul>${items.map(i => html`<li>${i}</li>`)}</ul>`   -> nested templates are kept as markup
//   raw(trustedMarkup)            -> opt out explicitly (only for markup we generated ourselves)
//
// Rendering untrusted text therefore needs no extra care; forgetting to
// escape is no longer possible by accident.
import { escapeHtml } from '../shared/html.js';

export class SafeHtml {
  constructor(value) { this.value = value; }
  toString() { return this.value; }
}

export const raw = value => new SafeHtml(String(value ?? ''));

function render(value) {
  if (value === null || value === undefined || value === false) return '';
  if (value instanceof SafeHtml) return value.value;
  if (Array.isArray(value)) return value.map(render).join('');
  return escapeHtml(value);
}

export function html(strings, ...values) {
  let out = strings[0];
  values.forEach((value, i) => { out += render(value) + strings[i + 1]; });
  return new SafeHtml(out);
}

// Replace an element's content with a template result.
export function mount(target, content) {
  const el = typeof target === 'string' ? document.querySelector(target) : target;
  if (el) el.innerHTML = render(content);
  return el;
}
