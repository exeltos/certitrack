// Starts the in-browser demo and opens the matching workspace.
import { startDemo } from '../../api/index';
const role = new URLSearchParams(location.search).get('role') === 'admin' ? 'admin' : 'organization';
startDemo(role);
location.replace(role === 'admin' ? '/pages/admin/dashboard.html' : '/pages/organization/dashboard.html');
