// Real backend: Supabase. Every multi-organization rule is enforced by the
// database (RLS + ct_* functions); this module only shapes data for the UI.
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../config/appConfig.js';

const BUCKET = 'organizationcertificates';
let clientPromise;

// supabase-js is loaded on demand, so public pages and the demo never download it.
export function client() {
  clientPromise ??= import('@supabase/supabase-js')
    .then(({ createClient }) => createClient(SUPABASE_URL, SUPABASE_ANON_KEY));
  return clientPromise;
}

function check({ data, error }) {
  if (error) throw Object.assign(new Error(error.message || 'Error'), { code: error.code, details: error.details });
  return data;
}
async function rpc(name, args) { return check(await (await client()).rpc(name, args)); }
async function from(table) { return (await client()).from(table); }

const CERT_SELECT = `
  id, organization_id, certificate_type_id, custom_type_label, title, certificate_number, issuer,
  issue_date, expiry_date, notes, sharing, current_file_id, created_at, updated_at,
  type:certificate_types(id, code, name, name_en),
  file:certificate_files!certificates_current_file_fk(id, original_file_name, file_size_bytes, version_no, created_at)`;

function orgName(o) { return o?.display_name || o?.legal_name || ''; }
let ctxCache;

export const supabaseApi = {
  mode: 'live',

  // ---------------------------------------------------------------- auth
  async session() { return check(await (await client()).auth.getSession()).session; },
  async signIn(email, password) {
    const sb = await client();
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error) throw Object.assign(new Error(error.message), { code: error.code || 'invalid_credentials' });
    return data.session;
  },
  async mfaStatus() {
    const sb = await client();
    const { data } = await sb.auth.mfa.getAuthenticatorAssuranceLevel();
    const factors = check(await sb.auth.mfa.listFactors());
    return { needsCode: data?.nextLevel === 'aal2' && data?.currentLevel !== 'aal2', factor: factors?.totp?.find(f => f.status === 'verified') || null };
  },
  async mfaVerifyLogin(factorId, code) {
    const sb = await client();
    const challenge = check(await sb.auth.mfa.challenge({ factorId }));
    check(await sb.auth.mfa.verify({ factorId, challengeId: challenge.id, code }));
  },
  async mfaEnroll() { return check(await (await client()).auth.mfa.enroll({ factorType: 'totp', friendlyName: `CertiTrack ${Date.now()}` })); },
  async mfaConfirm(factorId, code) { await this.mfaVerifyLogin(factorId, code); },
  async mfaDisable(factorId) { check(await (await client()).auth.mfa.unenroll({ factorId })); },
  async signUp({ email, password, name, vat, redirectTo }) {
    return check(await (await client()).auth.signUp({
      email, password,
      options: { data: { type: 'organization', country_code: 'GR', afm: vat, name }, emailRedirectTo: redirectTo }
    }));
  },
  async signOut() { ctxCache = null; await (await client()).auth.signOut(); },
  async requestPasswordReset(email, redirectTo) { check(await (await client()).auth.resetPasswordForEmail(email, { redirectTo })); },
  async updatePassword(password) { check(await (await client()).auth.updateUser({ password })); },
  async changePassword(currentPassword, password) {
    const sb = await client();
    const email = (await sb.auth.getUser()).data?.user?.email;
    const { error } = await sb.auth.signInWithPassword({ email, password: currentPassword });
    if (error) throw Object.assign(new Error('wrong_password'), { code: 'wrong_password' });
    check(await sb.auth.updateUser({ password }));
  },

  // Who is signed in: user, their organization (if any) and admin flag.
  async context({ fresh = false } = {}) {
    if (ctxCache && !fresh) return ctxCache;
    const session = await this.session();
    if (!session) return null;
    const user = session.user;
    const isAdmin = await rpc('ct_is_platform_admin', { p_user: user.id });
    const membership = check(await (await from('organization_members'))
      .select('role, organization:organizations(*)').eq('user_id', user.id).eq('status', 'active')
      .order('created_at').limit(1).maybeSingle());
    const organization = membership?.organization ? { ...membership.organization, name: orgName(membership.organization) } : null;
    const factors = (await (await client()).auth.mfa.listFactors()).data;
    ctxCache = { user: { id: user.id, email: user.email }, organization, role: membership?.role || null, isAdmin: !!isAdmin,
                 mfaFactor: factors?.totp?.find(f => f.status === 'verified') || null };
    return ctxCache;
  },

  // ---------------------------------------------------------------- organization
  async updateOrganization(fields) {
    const { organization } = await this.context();
    const allowed = ['legal_name', 'display_name', 'contact_email', 'phone', 'website', 'address_line1', 'city', 'postal_code'];
    const patch = Object.fromEntries(Object.entries(fields).filter(([k]) => allowed.includes(k)));
    check(await (await from('organizations')).update(patch).eq('id', organization.id));
    ctxCache = null;
  },
  async requestClosure(reason) { const { organization } = await this.context(); await rpc('ct_request_organization_closure', { p_org: organization.id, p_reason: reason }); ctxCache = null; },
  async cancelClosure() { const { organization } = await this.context(); await rpc('ct_cancel_organization_closure', { p_org: organization.id }); ctxCache = null; },

  // ---------------------------------------------------------------- certificates
  async certificateTypes() {
    return check(await (await from('certificate_types')).select('id, code, name, name_en, requires_expiry').eq('active', true).order('sort_order'));
  },
  async myCertificates() {
    const { organization } = await this.context();
    const rows = check(await (await from('certificates')).select(CERT_SELECT)
      .eq('organization_id', organization.id).is('deleted_at', null).order('expiry_date', { ascending: true, nullsFirst: false }));
    const shares = check(await (await from('certificate_shares')).select('certificate_id, grantee_org_id, expires_at')
      .in('certificate_id', rows.map(r => r.id).length ? rows.map(r => r.id) : ['00000000-0000-0000-0000-000000000000']));
    return rows.map(r => ({ ...r, shares: shares.filter(s => s.certificate_id === r.id) }));
  },
  async partnerCertificates(partnerId) {
    // RLS returns only what the partner chose to show us.
    return check(await (await from('certificates')).select(CERT_SELECT)
      .eq('organization_id', partnerId).is('deleted_at', null).order('expiry_date', { ascending: true, nullsFirst: false }));
  },
  // Everything partners have chosen to show us (RLS decides), in one query.
  async visiblePartnerCertificates() {
    const { organization } = await this.context();
    return check(await (await from('certificates')).select(CERT_SELECT)
      .neq('organization_id', organization.id).is('deleted_at', null));
  },
  async saveCertificate({ id, file, sharing, shares, ...fields }) {
    const { organization } = await this.context();
    const payload = {
      certificate_type_id: fields.certificate_type_id, custom_type_label: fields.custom_type_label || null,
      title: fields.title, certificate_number: fields.certificate_number || null, issuer: fields.issuer || null,
      issue_date: fields.issue_date || null, expiry_date: fields.expiry_date || null, notes: fields.notes || null
    };
    let cert;
    if (id) {
      cert = check(await (await from('certificates')).update(payload).eq('id', id).select('id').single());
    } else {
      cert = check(await (await from('certificates')).insert({ ...payload, organization_id: organization.id, sharing: 'private' }).select('id').single());
    }
    try {
      if (file) await this.uploadFile(cert.id, file);
    } catch (err) {
      if (!id) await rpc('ct_abort_certificate_draft', { p_certificate: cert.id }).catch(() => {});
      throw err;
    }
    if (sharing) await this.setSharing(cert.id, sharing, shares || []);
    return cert.id;
  },
  async uploadFile(certificateId, file) {
    const { organization } = await this.context();
    const path = `${organization.id}/${certificateId}/${crypto.randomUUID()}.pdf`;
    const sb = await client();
    check(await sb.storage.from(BUCKET).upload(path, file, { contentType: 'application/pdf', upsert: false }));
    await rpc('ct_register_certificate_file', { p_certificate: certificateId, p_storage_path: path,
      p_original_file_name: file.name, p_mime_type: 'application/pdf', p_file_size_bytes: file.size });
  },
  async deleteCertificate(id) { await rpc('ct_soft_delete_certificate', { p_certificate: id }); },
  async setSharing(id, mode, shares = []) {
    await rpc('ct_set_certificate_sharing', { p_certificate: id, p_mode: mode,
      p_shares: shares.map(s => ({ org_id: s.org_id, expires_at: s.expires_at || null })) });
  },
  async certificateViews({ certificateId, limit = 50 } = {}) {
    const { organization } = await this.context();
    let q = (await from('certificate_views')).select('id, certificate_id, viewer_org_name, viewed_at, certificate:certificates(title)')
      .eq('owner_org_id', organization.id).order('viewed_at', { ascending: false }).limit(limit);
    if (certificateId) q = q.eq('certificate_id', certificateId);
    return check(await q);
  },
  // Returns a short-lived URL for the PDF (logs the view for partners).
  async openCertificate(id) {
    const rows = await rpc('ct_open_certificate', { p_certificate: id });
    const row = Array.isArray(rows) ? rows[0] : rows;
    const sb = await client();
    const signed = check(await sb.storage.from(BUCKET).createSignedUrl(row.storage_path, 300));
    return { url: signed.signedUrl, fileName: row.file_name };
  },

  // ---------------------------------------------------------------- connections
  async connections() {
    const { organization } = await this.context();
    return await rpc('ct_list_connections', { p_org: organization.id });
  },
  async invitations() {
    const { organization } = await this.context();
    return check(await (await from('invitations')).select('id, email, status, created_at, expires_at')
      .eq('inviter_org_id', organization.id).eq('status', 'pending').order('created_at', { ascending: false }));
  },
  async findPartner(lookup) {
    const rows = await rpc('ct_find_partner_candidate', { p_lookup: lookup });
    return (Array.isArray(rows) ? rows[0] : rows) || null;
  },
  async requestConnection(lookup) {
    const { organization } = await this.context();
    return await rpc('ct_request_connection', { p_org: organization.id, p_lookup: lookup });
  },
  async respondConnection(id, accept) { await rpc('ct_respond_connection', { p_connection: id, p_accept: accept }); },
  async endConnection(id, reason) { await rpc('ct_end_connection', { p_connection: id, p_reason: reason || null }); },
  async cancelInvitation(id) { await rpc('ct_cancel_invitation', { p_invitation: id }); },

  // ---------------------------------------------------------------- document requests
  async documentRequests() {
    return check(await (await from('document_requests'))
      .select('id, connection_id, requester_org_id, responder_org_id, certificate_type_id, note, due_date, status, response_note, fulfilled_certificate_id, created_at, resolved_at, type:certificate_types(id, code, name, name_en)')
      .in('status', ['open', 'fulfilled', 'declined']).order('created_at', { ascending: false }));
  },
  async requestDocument(connectionId, typeId, note, dueDate) {
    await rpc('ct_request_document', { p_connection: connectionId, p_certificate_type: typeId, p_note: note || null, p_due_date: dueDate || null });
  },
  async cancelRequest(id) { await rpc('ct_cancel_document_request', { p_request: id }); },
  async declineRequest(id, note) { await rpc('ct_decline_document_request', { p_request: id, p_note: note || null }); },
  async fulfillRequest(id, certificateId) { await rpc('ct_fulfill_document_request', { p_request: id, p_certificate: certificateId }); },

  // ---------------------------------------------------------------- notifications
  async notifications(limit = 30) {
    return check(await (await from('notifications')).select('*').order('created_at', { ascending: false }).limit(limit));
  },
  async markNotificationsRead(ids) { if (ids.length) await rpc('ct_mark_notifications_read', { p_notifications: ids }); },
  async notificationPreferences() {
    const { organization, user } = await this.context();
    return check(await (await from('notification_preferences')).select('*').eq('organization_id', organization.id).eq('user_id', user.id).maybeSingle());
  },
  async saveNotificationPreferences(prefs) {
    const { organization, user } = await this.context();
    const keys = ['in_app_enabled', 'email_enabled', 'expiry_in_app_enabled', 'expiry_email_enabled', 'relationship_notifications', 'partner_certificate_notifications'];
    check(await (await from('notification_preferences')).update(Object.fromEntries(keys.map(k => [k, !!prefs[k]])))
      .eq('organization_id', organization.id).eq('user_id', user.id));
  },

  // ---------------------------------------------------------------- platform admin
  async adminOrganizations() {
    return check(await (await from('organizations')).select('*').order('created_at', { ascending: false }))
      .map(o => ({ ...o, name: orgName(o) }));
  },
  async adminNetwork() { return await rpc('ct_admin_network'); },
  async adminCertificates() {
    return check(await (await from('certificates')).select('id, organization_id, title, expiry_date, sharing, deleted_at, created_at, type:certificate_types(name, name_en)').is('deleted_at', null));
  },
  async adminAudit(limit = 200) {
    return check(await (await from('audit_log')).select('*').order('created_at', { ascending: false }).limit(limit));
  },
  async adminSetOrganizationState(id, state, reason) { await rpc('ct_platform_set_organization_state', { p_org: id, p_state: state, p_reason: reason || null }); }
};
