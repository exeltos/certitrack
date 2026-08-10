document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('a[href*="/auth/login.html"]').forEach(link => link.addEventListener('click', () => localStorage.removeItem('certitrack.demo.role')));
});
