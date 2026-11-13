// Tiny i18n: t(key, vars) with Greek as the source language.
import { el } from '../i18n/el';
import { en } from '../i18n/en';

const KEY = 'certitrack-language';
export type MessageKey = keyof typeof el;
export type Language = 'el' | 'en';
const DICTS: Record<Language, Partial<Record<MessageKey, string>>> = { el, en };

export function getLanguage(): Language {
  try { return localStorage.getItem(KEY) === 'en' ? 'en' : 'el'; } catch { return 'el'; }
}

export function setLanguage(lang: Language): void {
  try { localStorage.setItem(KEY, lang === 'en' ? 'en' : 'el'); } catch { /* storage unavailable */ }
}

type Vars = Record<string, string | number | null | undefined>;

export function t(key: MessageKey, vars?: Vars): string {
  let text: string = DICTS[getLanguage()][key] ?? el[key] ?? key;
  if (vars) text = text.replace(/\{(\w+)\}/g, (_, name: string) => String(vars[name] ?? ''));
  return text;
}

