// Shared helpers for the platform admin pages.
import { t } from '../../lib/i18n';
import { badge, type BadgeKind } from '../../ui/components';
import type { ConnectionStatus, OrganizationStatus } from '../../types/domain';

const ORG_KIND: Record<OrganizationStatus, BadgeKind> = { active: 'success', pending_verification: 'warning', suspended: 'danger', closure_requested: 'warning', closed: 'neutral' };
export const orgStatusBadge = (status: OrganizationStatus) => badge(ORG_KIND[status] ?? 'neutral', t(`orgStatusShort.${status}`));

const CONN_KIND: Record<ConnectionStatus, BadgeKind> = { active: 'success', pending: 'warning', declined: 'danger', cancelled: 'neutral', ended: 'neutral' };
export const connStatusBadge = (status: ConnectionStatus) => badge(CONN_KIND[status] ?? 'neutral', t(`connStatus.${status}`));
