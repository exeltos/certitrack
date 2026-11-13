// Starts the in-browser demo (development and tests only).
import { startDemo, DEMO_ENABLED } from '../../api/index';
const role = new URLSearchParams(location.search).get('role') === 'admin' ? 'admin' : 'organization';
if (DEMO_ENABLED) startDemo(role);
location.replace(!DEMO_ENABLED ? '/' : role === 'admin' ? '/pages/admin/dashboard.html' : '/pages/organization/dashboard.html');
