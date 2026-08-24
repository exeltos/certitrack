export const AUTH_PATHS = Object.freeze({
  login: '/pages/auth/login.html',
  register: '/pages/auth/register.html',
  forgot: '/pages/auth/forgot.html',
  reset: '/pages/auth/reset-password.html',
  dashboard: '/pages/organization/dashboard.html'
});

export function absoluteAuthUrl(path) {
  return new URL(path, window.location.origin).toString();
}
