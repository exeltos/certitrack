import { describe, it, expect } from 'vitest';
import { html, raw } from '../../src/lib/html';
import { escapeHtml } from '../../src/shared/html';

describe('escapeHtml', () => {
  it('escapes the five HTML-significant characters', () => {
    expect(escapeHtml(`<script>alert('x')&"y"</script>`)).toBe('&lt;script&gt;alert(&#39;x&#39;)&amp;&quot;y&quot;&lt;/script&gt;');
  });
  it('treats null/undefined as empty', () => { expect(escapeHtml(null)).toBe(''); expect(escapeHtml(undefined)).toBe(''); });
});

describe('html template', () => {
  it('escapes interpolated values by default', () => {
    const name = '<img src=x onerror=alert(1)>';
    expect(String(html`<b>${name}</b>`)).toBe('<b>&lt;img src=x onerror=alert(1)&gt;</b>');
  });
  it('keeps nested templates and arrays as markup', () => {
    expect(String(html`<ul>${['a', '<b>'].map(x => html`<li>${x}</li>`)}</ul>`)).toBe('<ul><li>a</li><li>&lt;b&gt;</li></ul>');
  });
  it('drops null, undefined and false', () => {
    expect(String(html`${null}${undefined}${false}${0}`)).toBe('0');
  });
  it('raw() opts out explicitly', () => expect(String(html`${raw('<i></i>')}`)).toBe('<i></i>'));
  it('escapes attribute breakouts', () => {
    expect(String(html`<a title="${'" onmouseover="x'}">`)).toBe('<a title="&quot; onmouseover=&quot;x">');
  });
});
