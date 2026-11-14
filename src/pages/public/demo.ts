// Starts the in-browser demo. On the real site only a signed-in platform
// administrator may start it (the owner's menu links here).
import { startDemo, DEMO_OPEN } from '../../api/index';
import { supabaseApi } from '../../api/supabase';

const role = new URLSearchParams(location.search).get('role') === 'admin' ? 'admin' : 'organization';
const allowed = DEMO_OPEN || await supabaseApi.context().then(c => !!c?.isAdmin, () => false);
if (allowed) startDemo(role);
location.replace(!allowed ? '/' : role === 'admin' ? '/pages/admin/dashboard.html' : '/pages/organization/dashboard.html');
