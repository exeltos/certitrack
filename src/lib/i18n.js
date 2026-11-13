// Tiny i18n: t(key, vars) with Greek as the source language.
import { el } from '../i18n/el.js';
import { en } from '../i18n/en.js';

const KEY = 'certitrack-language';
const DICTS = { el, en };

export function getLanguage() {
  try { return localStorage.getItem(KEY) === 'en' ? 'en' : 'el'; } catch { return 'el'; }
}

export function setLanguage(lang) {
  try { localStorage.setItem(KEY, lang === 'en' ? 'en' : 'el'); } catch { /* storage unavailable */ }
}

export function t(key, vars) {
  const lang = getLanguage();
  let text = DICTS[lang][key] ?? el[key] ?? key;
  if (vars) text = text.replace(/\{(\w+)\}/g, (_, name) => (vars[name] ?? ''));
  return text;
}

// Plural helper: keys ending in .one / .other
export function tn(key, count, vars = {}) {
  return t(`${key}.${count === 1 ? 'one' : 'other'}`, { count, ...vars });
}
