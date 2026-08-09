import { enterDemo } from './demoSession.js';

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('a[href="/pages/auth/login.html"]').forEach(link => {
    link.addEventListener('click', () => localStorage.removeItem('certitrack.demo.role'));
  });
  document.querySelectorAll('[data-enter-demo]').forEach(btn => {
    btn.addEventListener('click', () => enterDemo(btn.dataset.enterDemo));
  });
});
