// Real backend: Supabase. Every multi-organization rule is enforced by the
// database (RLS + ct_* functions); this module only shapes data for the UI.
import type { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../config/appConfig';
import type { Database, Json } from '../types/database';
import type {
  AdminCertificate, Api, AppContext, AuditEntry, Certificate, CertificateInput, CertificateType, CertificateView,
  Connection, ConnectionResult, ConnectionStatus, DocumentRequest, Invitation, MemberRole, MfaFactor, NetworkEdge,
  Notification, NotificationPreferences, Organization, OrganizationStatus, OrganizationUpdate, OpenedFile,
  PartnerCandidate, RequestStatus, Sharing, ShareInput, SiteContact
} from '../types/domain';

type Client = SupabaseClient<Database>;
type Rpc = Database['public']['Functions'];

const BUCKET = 'organizationcertificates';
let clientPromise: Promise<Client> | undefined;

/** supabase-js is loaded on demand, so public pages and the demo never download it. */
export function client(): Promise<Client> {
  clientPromise ??= import('@supabase/supabase-js')
    .then(({ createClient }) => createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY));
  return clientPromise;
}

export class ApiError extends Error {
  constructor(message: string, readonly code?: string, readonly details?: string) { super(message); }
}

type ErrorLike = { message?: string; code?: string; details?: string } | null;
interface Result<T> { data: T; error: ErrorLike }

/** Throws on error; for queries that always return data (lists, single(), RPCs). */
function check<R extends Result<unknown>>({ data, error }: R): NonNullable<R['data']> {
  if (error) throw new ApiError(error.message || 'Error', error.code, error.details);
  return data as NonNullable<R['data']>;
}

/** Throws on error; for queries that may legitimately return nothing (maybeSingle()). */
function checkMaybe<R extends Result<unknown>>({ data, error }: R): R['data'] {
  if (error) throw new ApiError(error.message || 'Error', error.code, error.details);
  return data;
}

async function rpc<K extends keyof Rpc>(name: K, args: Rpc[K]['Args']): Promise<Rpc[K]['Returns']> {
  const sb = await client();
  // The generic rpc signature is too clever for a mapped key; the call itself is still typed by name/args above.
  return checkMaybe(await (sb.rpc as (n: string, a: unknown) => PromiseLike<Result<Rpc[K]['Returns']>>)(name, args));
}

const CERT_SELECT = `
  id, organization_id, certificate_type_id, custom_type_label, title, certificate_number, issuer,
  issue_date, expiry_date, notes, sharing, current_file_id, created_at, updated_at,
  type:certificate_types(id, code, name, name_en, requires_expiry),
  file:certificate_files!certificates_current_file_fk(id, original_file_name, file_size_bytes, version_no, created_at)` as const;

/** A certificate row as returned by CERT_SELECT, before narrowing `sharing`. */
type CertRow = Omit<Certificate, 'sharing' | 'shares'> & { sharing: string };
const toCertificate = (row: CertRow): Certificate => ({ ...row, sharing: row.sharing as Sharing });

const orgName = (o: { display_name: string | null; legal_name: string } | null): string => o?.display_name || o?.legal_name || '';
const toOrganization = (o: Database['public']['Tables']['organizations']['Row']): Organization =>
  ({ ...o, status: o.status as OrganizationStatus, name: orgName(o) });

let ctxCache: AppContext | null = null;

async function currentOrganization(): Promise<Organization> {
  const ctx = await supabaseApi.context();
  if (!ctx?.organization) throw new ApiError('Insufficient permission');
  return ctx.organization;
}

async function verifiedFactor(sb: Client): Promise<MfaFactor | null> {
  const { data } = await sb.auth.mfa.listFactors();
  const factor = data?.totp?.find(f => f.status === 'verified');
  return factor ? { id: factor.id, status: factor.status } : null;
}

export const DEFAULT_CONTACT: SiteContact = { company: 'Exeltos', email: 'info@exeltos.com', phone: '6942471022', website: 'https://exeltos.com' };
function toSiteContact(v: Partial<SiteContact> | null | undefined): SiteContact {
  if (!v?.company) return DEFAULT_CONTACT;
  return { company: v.company, email: v.email || null, phone: v.phone || null, website: v.website || null };
}

export const supabaseApi = {
  mode: 'live' as const,

  // ---------------------------------------------------------------- auth
  async session() { return check(await (await client()).auth.getSession()).session; },

  async signIn(email: string, password: string) {
    const { data, error } = await (await client()).auth.signInWithPassword({ email, password });
    if (error) throw new ApiError(error.message, error.code || 'invalid_credentials');
    return data.session;
  },

  async mfaStatus(): Promise<{ needsCode: boolean; factor: MfaFactor | null }> {
    const sb = await client();
    const { data } = await sb.auth.mfa.getAuthenticatorAssuranceLevel();
    return { needsCode: data?.nextLevel === 'aal2' && data?.currentLevel !== 'aal2', factor: await verifiedFactor(sb) };
  },

  async mfaVerifyLogin(factorId: string, code: string) {
    const sb = await client();
    const challenge = check(await sb.auth.mfa.challenge({ factorId }));
    check(await sb.auth.mfa.verify({ factorId, challengeId: challenge.id, code }));
  },

  async mfaEnroll() {
    const data = check(await (await client()).auth.mfa.enroll({ factorType: 'totp', friendlyName: `CertiTrack ${Date.now()}` }));
    return { id: data.id, totp: { qr_code: data.totp.qr_code, secret: data.totp.secret } };
  },
  async mfaConfirm(factorId: string, code: string) { await supabaseApi.mfaVerifyLogin(factorId, code); },
  async mfaDisable(factorId: string) { check(await (await client()).auth.mfa.unenroll({ factorId })); },

  async signUp({ email, password, name, vat, redirectTo }: { email: string; password: string; name: string; vat: string; redirectTo: string }) {
    return check(await (await client()).auth.signUp({
      email, password,
      options: { data: { type: 'organization', country_code: 'GR', afm: vat, name }, emailRedirectTo: redirectTo }
    }));
  },

  async signOut() { ctxCache = null; await (await client()).auth.signOut(); },
  async requestPasswordReset(email: string, redirectTo: string) { check(await (await client()).auth.resetPasswordForEmail(email, { redirectTo })); },
  async updatePassword(password: string) { check(await (await client()).auth.updateUser({ password })); },

  async changePassword(currentPassword: string, password: string) {
    const sb = await client();
    const email = (await sb.auth.getUser()).data.user?.email;
    if (!email) throw new ApiError('Authentication required');
    const { error } = await sb.auth.signInWithPassword({ email, password: currentPassword });
    if (error) throw new ApiError('wrong_password', 'wrong_password');
    check(await sb.auth.updateUser({ password }));
  },

  /** Who is signed in: user, their organization (if any) and the admin flag. */
  async context({ fresh = false }: { fresh?: boolean } = {}): Promise<AppContext | null> {
    if (ctxCache && !fresh) return ctxCache;
    const sb = await client();
    const session = check(await sb.auth.getSession()).session;
    if (!session) return null;
    const user = session.user;
    const [isAdmin, membership, mfaFactor] = await Promise.all([
      rpc('ct_is_platform_admin', { p_user: user.id }),
      sb.from('organization_members').select('role, organization:organizations(*)')
        .eq('user_id', user.id).eq('status', 'active').order('created_at').limit(1).maybeSingle().then(checkMaybe),
      verifiedFactor(sb)
    ]);
    ctxCache = {
      user: { id: user.id, email: user.email ?? '' },
      organization: membership?.organization ? toOrganization(membership.organization) : null,
      role: (membership?.role as MemberRole | undefined) ?? null,
      isAdmin: !!isAdmin,
      mfaFactor
    };
    return ctxCache;
  },

  // ---------------------------------------------------------------- organization
  async updateOrganization(fields: OrganizationUpdate) {
    const org = await currentOrganization();
    const allowed = ['legal_name', 'display_name', 'contact_email', 'phone', 'website', 'address_line1', 'city', 'postal_code'] as const;
    const patch: OrganizationUpdate = {};
    for (const k of allowed) if (k in fields) patch[k] = fields[k] as never;
    check(await (await client()).from('organizations').update(patch).eq('id', org.id));
    ctxCache = null;
  },
  async requestClosure(reason: string) {
    await rpc('ct_request_organization_closure', { p_org: (await currentOrganization()).id, p_reason: reason });
    ctxCache = null;
  },
  async cancelClosure() {
    await rpc('ct_cancel_organization_closure', { p_org: (await currentOrganization()).id });
    ctxCache = null;
  },

  // ---------------------------------------------------------------- certificates
  async certificateTypes(): Promise<CertificateType[]> {
    return check(await (await client()).from('certificate_types')
      .select('id, code, name, name_en, requires_expiry').eq('active', true).order('sort_order'));
  },

  async myCertificates(): Promise<Certificate[]> {
    const org = await currentOrganization();
    const sb = await client();
    const rows = check(await sb.from('certificates').select(CERT_SELECT)
      .eq('organization_id', org.id).is('deleted_at', null)
      .order('expiry_date', { ascending: true, nullsFirst: false })) as unknown as CertRow[];
    if (!rows.length) return [];
    const shares = check(await sb.from('certificate_shares').select('certificate_id, grantee_org_id, expires_at')
      .in('certificate_id', rows.map(r => r.id)));
    return rows.map(r => ({ ...toCertificate(r), shares: shares.filter(s => s.certificate_id === r.id) }));
  },

  /** What one partner shows us (RLS returns only what they chose to share). */
  async partnerCertificates(partnerId: string): Promise<Certificate[]> {
    const rows = check(await (await client()).from('certificates').select(CERT_SELECT)
      .eq('organization_id', partnerId).is('deleted_at', null)
      .order('expiry_date', { ascending: true, nullsFirst: false })) as unknown as CertRow[];
    return rows.map(toCertificate);
  },

  /** Everything partners have chosen to show us, in one query. */
  async visiblePartnerCertificates(): Promise<Certificate[]> {
    const org = await currentOrganization();
    const rows = check(await (await client()).from('certificates').select(CERT_SELECT)
      .neq('organization_id', org.id).is('deleted_at', null)) as unknown as CertRow[];
    return rows.map(toCertificate);
  },

  async saveCertificate({ id, file, sharing, shares, ...fields }: CertificateInput): Promise<string> {
    const org = await currentOrganization();
    const sb = await client();
    const payload = {
      certificate_type_id: fields.certificate_type_id, custom_type_label: fields.custom_type_label || null,
      title: fields.title, certificate_number: fields.certificate_number || null, issuer: fields.issuer || null,
      issue_date: fields.issue_date || null, expiry_date: fields.expiry_date || null, notes: fields.notes || null
    };
    const cert = id
      ? check(await sb.from('certificates').update(payload).eq('id', id).select('id').single())
      : check(await sb.from('certificates').insert({ ...payload, organization_id: org.id, sharing: 'private' }).select('id').single());
    try {
      if (file) await supabaseApi.uploadFile(cert.id, file);
    } catch (err) {
      if (!id) await rpc('ct_abort_certificate_draft', { p_certificate: cert.id }).catch(() => undefined);
      throw err;
    }
    if (sharing) await supabaseApi.setSharing(cert.id, sharing, shares ?? []);
    return cert.id;
  },

  async uploadFile(certificateId: string, file: File) {
    const org = await currentOrganization();
    const path = `${org.id}/${certificateId}/${crypto.randomUUID()}.pdf`;
    check(await (await client()).storage.from(BUCKET).upload(path, file, { contentType: 'application/pdf', upsert: false }));
    await rpc('ct_register_certificate_file', {
      p_certificate: certificateId, p_storage_path: path, p_original_file_name: file.name,
      p_mime_type: 'application/pdf', p_file_size_bytes: file.size
    });
  },

  async deleteCertificate(id: string) { await rpc('ct_soft_delete_certificate', { p_certificate: id }); },

  async setSharing(id: string, mode: Sharing, shares: ShareInput[] = []) {
    const p_shares: Json = shares.map(s => ({ org_id: s.org_id, expires_at: s.expires_at ?? null }));
    await rpc('ct_set_certificate_sharing', { p_certificate: id, p_mode: mode, p_shares });
  },

  async certificateViews({ certificateId, limit = 50 }: { certificateId?: string; limit?: number } = {}): Promise<CertificateView[]> {
    const org = await currentOrganization();
    let q = (await client()).from('certificate_views')
      .select('id, certificate_id, viewer_org_name, viewed_at, certificate:certificates(title)')
      .eq('owner_org_id', org.id).order('viewed_at', { ascending: false }).limit(limit);
    if (certificateId) q = q.eq('certificate_id', certificateId);
    return check(await q);
  },

  /** A short-lived URL for the PDF. For partners the database logs the view first. */
  async openCertificate(id: string): Promise<OpenedFile> {
    const [row] = await rpc('ct_open_certificate', { p_certificate: id });
    if (!row) throw new ApiError('Certificate not found');
    const signed = check(await (await client()).storage.from(BUCKET).createSignedUrl(row.storage_path, 300));
    return { url: signed.signedUrl, fileName: row.file_name };
  },

  // ---------------------------------------------------------------- connections
  async connections(): Promise<Connection[]> {
    const rows = await rpc('ct_list_connections', { p_org: (await currentOrganization()).id });
    return rows.map(r => ({ ...r, status: r.status as ConnectionStatus, direction: r.direction as Connection['direction'] }));
  },

  async invitations(): Promise<Invitation[]> {
    const org = await currentOrganization();
    return check(await (await client()).from('invitations').select('id, email, status, created_at, expires_at')
      .eq('inviter_org_id', org.id).eq('status', 'pending').order('created_at', { ascending: false }));
  },

  async findPartner(lookup: string): Promise<PartnerCandidate | null> {
    return (await rpc('ct_find_partner_candidate', { p_lookup: lookup }))[0] ?? null;
  },

  async requestConnection(lookup: string): Promise<ConnectionResult> {
    const result = await rpc('ct_request_connection', { p_org: (await currentOrganization()).id, p_lookup: lookup });
    return result as unknown as ConnectionResult;
  },

  async respondConnection(id: string, accept: boolean) { await rpc('ct_respond_connection', { p_connection: id, p_accept: accept }); },
  async endConnection(id: string, reason?: string) { await rpc('ct_end_connection', { p_connection: id, ...(reason ? { p_reason: reason } : {}) }); },
  async cancelInvitation(id: string) { await rpc('ct_cancel_invitation', { p_invitation: id }); },

  // ---------------------------------------------------------------- document requests
  async documentRequests(): Promise<DocumentRequest[]> {
    const rows = check(await (await client()).from('document_requests')
      .select('id, connection_id, requester_org_id, responder_org_id, certificate_type_id, note, due_date, status, response_note, fulfilled_certificate_id, created_at, resolved_at, type:certificate_types(id, code, name, name_en, requires_expiry)')
      .in('status', ['open', 'fulfilled', 'declined']).order('created_at', { ascending: false }));
    return rows.map(r => ({ ...r, status: r.status as RequestStatus }));
  },

  async requestDocument(connectionId: string, typeId: string, note?: string, dueDate?: string) {
    await rpc('ct_request_document', {
      p_connection: connectionId, p_certificate_type: typeId,
      ...(note ? { p_note: note } : {}), ...(dueDate ? { p_due_date: dueDate } : {})
    });
  },
  async cancelRequest(id: string) { await rpc('ct_cancel_document_request', { p_request: id }); },
  async declineRequest(id: string, note?: string) { await rpc('ct_decline_document_request', { p_request: id, ...(note ? { p_note: note } : {}) }); },
  async fulfillRequest(id: string, certificateId: string) { await rpc('ct_fulfill_document_request', { p_request: id, p_certificate: certificateId }); },

  // ---------------------------------------------------------------- notifications
  async notifications(limit = 30): Promise<Notification[]> {
    return check(await (await client()).from('notifications').select('*').order('created_at', { ascending: false }).limit(limit));
  },
  async markNotificationsRead(ids: string[]) { if (ids.length) await rpc('ct_mark_notifications_read', { p_notifications: ids }); },

  async notificationPreferences(): Promise<NotificationPreferences | null> {
    const ctx = await supabaseApi.context();
    if (!ctx?.organization) return null;
    return checkMaybe(await (await client()).from('notification_preferences').select('*')
      .eq('organization_id', ctx.organization.id).eq('user_id', ctx.user.id).maybeSingle());
  },

  async saveNotificationPreferences(prefs: NotificationPreferences) {
    const ctx = await supabaseApi.context();
    if (!ctx?.organization) throw new ApiError('Insufficient permission');
    const patch: NotificationPreferences = {
      in_app_enabled: !!prefs.in_app_enabled, email_enabled: !!prefs.email_enabled,
      expiry_in_app_enabled: !!prefs.expiry_in_app_enabled, expiry_email_enabled: !!prefs.expiry_email_enabled,
      relationship_notifications: !!prefs.relationship_notifications,
      partner_certificate_notifications: !!prefs.partner_certificate_notifications
    };
    check(await (await client()).from('notification_preferences').update(patch)
      .eq('organization_id', ctx.organization.id).eq('user_id', ctx.user.id));
  },

  // ---------------------------------------------------------------- platform admin
  async adminOrganizations(): Promise<Organization[]> {
    return check(await (await client()).from('organizations').select('*').order('created_at', { ascending: false })).map(toOrganization);
  },
  async adminNetwork(): Promise<NetworkEdge[]> {
    return (await rpc('ct_admin_network', undefined as never)).map(r => ({ ...r, status: r.status as ConnectionStatus }));
  },
  async adminCertificates(): Promise<AdminCertificate[]> {
    const rows = check(await (await client()).from('certificates')
      .select('id, organization_id, title, expiry_date, sharing, type:certificate_types(name, name_en)').is('deleted_at', null));
    return rows.map(r => ({ ...r, sharing: r.sharing as Sharing }));
  },
  async adminAudit(limit = 200): Promise<AuditEntry[]> {
    return check(await (await client()).from('audit_log').select('*').order('created_at', { ascending: false }).limit(limit));
  },
  async adminSetOrganizationState(id: string, state: 'active' | 'suspended' | 'closed', reason?: string) {
    await rpc('ct_platform_set_organization_state', { p_org: id, p_state: state, ...(reason ? { p_reason: reason } : {}) });
  },

  // ---------------------------------------------------------------- public contact card
  // Read with a plain request so the home page does not have to load supabase-js.
  async siteContact(): Promise<SiteContact> {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/site_settings?key=eq.contact&select=value`,
      { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` } });
    if (!res.ok) throw new ApiError(`contact card: HTTP ${res.status}`);
    const rows = await res.json() as { value: Partial<SiteContact> }[];
    return toSiteContact(rows[0]?.value);
  },
  async setSiteContact(c: SiteContact) {
    return toSiteContact(await rpc('ct_set_site_contact', { p_company: c.company, p_email: c.email || null, p_phone: c.phone || null, p_website: c.website || null }) as Partial<SiteContact>);
  }
} satisfies Api & Record<string, unknown>;
