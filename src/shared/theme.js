const root = document.documentElement;
const media = window.matchMedia?.('(prefers-color-scheme: dark)');

function syncThemeIcons() {
  const dark = root.classList.contains('dark');
  document.querySelectorAll('#icon-moon').forEach(el => el.classList.toggle('hidden', dark));
  document.querySelectorAll('#icon-sun').forEach(el => el.classList.toggle('hidden', !dark));
  document.querySelectorAll('#theme-toggle').forEach(btn => {
    btn.setAttribute('aria-pressed', String(dark));
    btn.setAttribute('aria-label', dark ? 'Εναλλαγή σε φωτεινό θέμα' : 'Εναλλαγή σε σκούρο θέμα');
    btn.setAttribute('title', dark ? 'Φωτεινό θέμα' : 'Σκούρο θέμα');
  });
  root.style.colorScheme = dark ? 'dark' : 'light';
}

export function applySavedTheme() {
  const saved = localStorage.getItem('theme');
  const useDark = saved === 'dark' || (saved !== 'light' && media?.matches);
  root.classList.toggle('dark', useDark);
  syncThemeIcons();
}

export function toggleTheme() {
  const dark = !root.classList.contains('dark');
  root.classList.add('ct-theme-changing');
  root.classList.toggle('dark', dark);
  localStorage.setItem('theme', dark ? 'dark' : 'light');
  syncThemeIcons();
  window.setTimeout(() => root.classList.remove('ct-theme-changing'), 220);
}

export function initTheme() {
  applySavedTheme();
  document.querySelectorAll('#theme-toggle').forEach(btn => {
    if (btn.dataset.ctThemeBound === '1') return;
    btn.dataset.ctThemeBound = '1';
    btn.addEventListener('click', toggleTheme);
  });
  if (media && !media.__ctBound) {
    media.__ctBound = true;
    media.addEventListener?.('change', () => {
      if (!localStorage.getItem('theme')) applySavedTheme();
    });
  }
  syncThemeIcons();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initTheme, { once: true });
} else {
  initTheme();
}
