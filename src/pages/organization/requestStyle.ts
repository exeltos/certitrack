// How request states look, shared by the organization pages.
import type { BadgeKind } from '../../ui/components';
import type { RequestState } from './model';

export const REQ_KIND: Record<RequestState, BadgeKind> = { missing: 'neutral', declined: 'danger', valid: 'success', expiring: 'warning', expired: 'danger' };
export const REQ_ICON: Record<RequestState, string> = { missing: 'clock', declined: 'circle-alert', valid: 'circle-check', expiring: 'clock', expired: 'triangle-alert' };
