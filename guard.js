import { authService } from '../../services/authService.js';
import { organizationService } from '../../services/organizationService.js';
import { setOrganizationShellContext } from '../../components/appShell.js';

export async function getOrganizationContext() {
  const { data, error } = await authService.getSession();
  const user = data?.session?.user;
  if (error || !user) { location.href = '../auth/login.html'; return null; }
  const organization = await organizationService.getByUserId(user.id);
  if (!organization) { await authService.signOut(); location.href = '../auth/login.html'; return null; }
  if (organization.blocked) { await authService.signOut(); throw new Error('Ο οργανισμός είναι αποκλεισμένος.'); }
  setOrganizationShellContext(organization);
  return { user, organization };
}

export function bindOrganizationLogout() {
  document.getElementById('logoutBtn')?.addEventListener('click', async () => {
    const result = await Swal.fire({ title:'Αποσύνδεση', text:'Θέλετε να αποσυνδεθείτε;', icon:'question', showCancelButton:true, confirmButtonText:'Αποσύνδεση', cancelButtonText:'Ακύρωση' });
    if (!result.isConfirmed) return;
    await authService.signOut();
    location.href = '../../index.html';
  });
}
