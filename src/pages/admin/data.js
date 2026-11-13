// Shared helpers for platform admin pages.
import { t } from '../../lib/i18n.js';
import { badge } from '../../ui/components.js';

const ORG_KIND = { active: 'success', pending_verification: 'warning', suspended: 'danger', closure_requested: 'warning', closed: 'neutral' };
export const orgStatusBadge = status => badge(ORG_KIND[status] || 'neutral', t(`orgStatusShort.${status}`));
const CONN_KIND = { active: 'success', pending: 'warning', declined: 'danger', cancelled: 'neutral', ended: 'neutral' };
export const connStatusBadge = status => badge(CONN_KIND[status] || 'neutral', t(`connStatus.${status}`));
