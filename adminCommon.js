import { authService } from '../../services/authService.js';
import { isDemo, installDemoBanner, exitDemo } from '../../demo/demoSession.js';

export async function requirePlatformAdmin() {
  if (isDemo('admin')) {
    installDemoBanner('admin');
    document.getElementById('logoutBtn')?.addEventListener('click', exitDemo);
    return { demo: true, user: null };
  }
  const { data, error } = await authService.getUser();
  const user = data?.user;
  const role = user?.app_metadata?.app_role || user?.app_metadata?.role;
  if (error || !user || role !== 'admin') {
    window.location.href = '/pages/auth/login.html';
    return { demo:false, user:null, denied:true };
  }
  document.getElementById('logoutBtn')?.addEventListener('click', async () => { await authService.signOut(); window.location.href='/index.html'; });
  return { demo:false, user };
}

export function statusKey(row={}) {
  if (row.blocked) return 'blocked';
  const raw=String(row.status||'').toLowerCase();
  if (raw.includes('pending') || raw.includes('εκκρ')) return 'pending';
  return 'active';
}

export function statusLabel(key) {
  return ({ active:'Ενεργός', pending:'Εκκρεμής', blocked:'Αποκλεισμένος' })[key] || '—';
}

export function safeDate(value) {
  if (!value) return '—';
  const date=new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString(document.documentElement.lang==='en'?'en-GB':'el-GR');
}

export function initials(name='') {
  return name.split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]).join('').toUpperCase() || 'CT';
}
