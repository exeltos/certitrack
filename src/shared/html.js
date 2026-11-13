// Single source of truth for escaping untrusted text before it is placed
// inside an HTML string (innerHTML, template literals, SweetAlert `html`).
// Prefer textContent / Swal `text` where possible; use this when markup
// has to be built as a string.
const HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export function escapeHtml(value = '') {
  return String(value ?? '').replace(/[&<>"']/g, ch => HTML_ESCAPES[ch]);
}
