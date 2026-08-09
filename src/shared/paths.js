const APP_ROOT = new URL('../../', import.meta.url);

export function appUrl(path = '') {
  const clean = String(path || '').replace(/^\/+/, '');
  return new URL(clean, APP_ROOT).href;
}

export function navigateTo(path) {
  window.location.href = appUrl(path);
}
