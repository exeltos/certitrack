// Single source of truth for escaping untrusted text before it is placed
// inside an HTML string. Prefer the html`` template (src/lib/html.ts).
const HTML_ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export function escapeHtml(value: unknown = ''): string {
  return String(value ?? '').replace(/[&<>"']/g, ch => HTML_ESCAPES[ch] ?? ch);
}
