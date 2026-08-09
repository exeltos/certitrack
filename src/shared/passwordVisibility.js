export function togglePassword(id, button = null) {
  const input = document.getElementById(id);
  if (!input) return;
  const show = input.type === 'password';
  input.type = show ? 'text' : 'password';
  if (button) {
    button.setAttribute('aria-label', show ? 'Απόκρυψη κωδικού' : 'Προβολή κωδικού');
    button.setAttribute('title', show ? 'Απόκρυψη κωδικού' : 'Προβολή κωδικού');
    const icon = button.querySelector('[data-lucide]');
    if (icon) icon.setAttribute('data-lucide', show ? 'eye-off' : 'eye');
    window.lucide?.createIcons?.();
  }
}

export function initPasswordVisibility(root = document) {
  root.querySelectorAll('[data-password-toggle]').forEach(button => {
    if (button.dataset.ctReady === '1') return;
    button.dataset.ctReady = '1';
    button.addEventListener('click', () => togglePassword(button.dataset.target, button));
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => initPasswordVisibility(), { once:true });
} else {
  initPasswordVisibility();
}
