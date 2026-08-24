import { authService } from '../services/authService.js';
// common.js – Κοινές λειτουργίες CertiTrack (τελική μορφή με βάση δικό σου αρχείο)

export function showLoading() {
  let loader = document.getElementById('global-loader');
  if (!loader) {
    loader = document.createElement('div');
    loader.id = 'global-loader';
    loader.className = 'ct-global-loader';
    loader.innerHTML = `
      <div class="ct-global-loader__spinner" aria-label="Φόρτωση"></div>
    `;
    document.body.appendChild(loader);
  }
  loader.classList.remove('hidden');
}

export function hideLoading() {
  const loader = document.getElementById('global-loader');
  if (loader) loader.classList.add('hidden');
}

export function handleError(error) {
  console.error('[CertiTrack Error]', error);
  Swal.fire('Σφάλμα', error.message || 'Παρουσιάστηκε σφάλμα.', 'error');
}

export function toggleDarkMode() {
  const html = document.documentElement;
  html.classList.toggle('dark');
  localStorage.theme = html.classList.contains('dark') ? 'dark' : 'light';
  updateIcons();
}

export function updateIcons() {
  const isDark = document.documentElement.classList.contains('dark');
  document.getElementById('icon-moon')?.classList.toggle('hidden', isDark);
  document.getElementById('icon-sun')?.classList.toggle('hidden', !isDark);
}

export function togglePassword(id) {
  const input = document.getElementById(id);
  if (input) input.type = input.type === 'password' ? 'text' : 'password';
}

export async function getSessionOrRedirect(path = '/index.html') {
  const { data, error } = await authService.getSession();
  const user = data?.session?.user;
  if (error || !user) window.location.href = path;
  return user;
}
