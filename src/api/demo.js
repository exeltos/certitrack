// Demo backend: an in-browser copy of the CertiTrack network with the same API
// as src/api/supabase.js. Nothing leaves the browser; changes live in
// sessionStorage until the demo is closed. It follows the same sharing rules
// as the database so the demo shows the real product.
import { DEMO_PDF_URL } from './demoAssets.js';

const STORE_KEY = 'certitrack.demo.store.v2';
const ROLE_KEY = 'certitrack.demo';

const day = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
const ago = mins => new Date(Date.now() - mins * 60000).toISOString();
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : `id-${Math.random().toString(16).slice(2)}`);

const TYPES = [
  ['t-iso9001', 'ISO9001', 'ISO 9001', 'ISO 9001'], ['t-iso13485', 'ISO13485', 'ISO 13485', 'ISO 13485'],
  ['t-iso14001', 'ISO14001', 'ISO 14001', 'ISO 14001'], ['t-iso22000', 'ISO22000', 'ISO 22000', 'ISO 22000'],
  ['t-iso27001', 'ISO27001', 'ISO 27001', 'ISO 27001'], ['t-iso45001', 'ISO45001', 'ISO 45001', 'ISO 45001'],
  ['t-ce', 'CE', 'Πιστοποιητικό CE', 'CE certificate'], ['t-license', 'OPERATING_LICENSE', 'Άδεια λειτουργίας', 'Operating license'],
  ['t-insurance', 'INSURANCE', 'Ασφάλιση', 'Insurance'], ['t-efka', 'INSURANCE_CLEARANCE', 'Ασφαλιστική ενημερότητα', 'Social security clearance'],
  ['t-tax', 'TAX_CLEARANCE', 'Φορολογική ενημερότητα', 'Tax clearance'], ['t-other', 'OTHER', 'Άλλο', 'Other']
].map(([id, code, name, name_en]) => ({ id, code, name, name_en, requires_expiry: code !== 'OTHER' }));

function seed() {
  const ME = 'o-demo';
  const org = (id, name, vat, email, city, status = 'active', created = 400) =>
    ({ id, legal_name: name, display_name: name, name, vat_number: vat, country_code: 'GR', contact_email: email, phone: '210 0000000',
       website: '', address_line1: '', city, postal_code: '', status, created_at: ago(created * 1440) });
  const orgs = [
    org(ME, 'Demo Group Α.Ε.', '099999990', 'quality@demo-group.example', 'Αθήνα', 'active', 420),
    org('o-med', 'MedSupply Α.Ε.', '099999991', 'quality@medsupply.example', 'Αθήνα', 'active', 380),
    org('o-clean', 'CleanCare Services', '099999992', 'docs@cleancare.example', 'Πειραιάς', 'active', 300),
    org('o-bio', 'BioLab Solutions', '099999993', 'compliance@biolab.example', 'Θεσσαλονίκη', 'active', 250),
    org('o-tech', 'TechMed Systems', '099999994', 'certs@techmed.example', 'Πάτρα', 'active', 200),
    org('o-safe', 'SafeWaste ΕΠΕ', '099999995', 'quality@safewaste.example', 'Λάρισα', 'active', 90),
    org('o-pharma', 'PharmaLogistics Α.Ε.', '099999996', 'qa@pharmalog.example', 'Ηράκλειο', 'active', 60),
    org('o-sterile', 'SterilePro ΙΚΕ', '099999997', 'info@sterilepro.example', 'Βόλος', 'active', 20),
    org('o-green', 'GreenFacility Α.Ε.', '099999998', 'iso@greenfacility.example', 'Αθήνα', 'pending_verification', 2)
  ];
  const conn = (id, a, b, status, created, responded) => ({ id, requester_org_id: a, addressee_org_id: b, status, created_at: ago(created * 1440), responded_at: responded ? ago(responded * 1440) : null, ended_at: null });
  const connections = [
    conn('c-med', ME, 'o-med', 'active', 300, 299), conn('c-clean', 'o-clean', ME, 'active', 200, 198),
    conn('c-bio', ME, 'o-bio', 'active', 150, 149), conn('c-tech', 'o-tech', ME, 'active', 100, 99),
    conn('c-safe', 'o-safe', ME, 'pending', 1), conn('c-pharma', ME, 'o-pharma', 'pending', 3),
    // Connections between other organizations: invisible to the demo organization, visible to the platform admin.
    conn('c-x1', 'o-med', 'o-bio', 'active', 120, 118), conn('c-x2', 'o-clean', 'o-tech', 'active', 80, 79),
    conn('c-x3', 'o-sterile', 'o-med', 'pending', 2)
  ];
  const cert = (id, owner, type, title, expiry, sharing, extra = {}) => ({
    id, organization_id: owner, certificate_type_id: type, custom_type_label: null, title, certificate_number: extra.number || `CT-${id.slice(-4).toUpperCase()}`,
    issuer: extra.issuer || 'TÜV Hellas', issue_date: extra.issued || null, expiry_date: expiry, notes: extra.notes || null, sharing,
    current_file_id: `f-${id}`, created_at: ago((extra.age || 120) * 1440), updated_at: ago((extra.age || 120) * 1440),
    file: { id: `f-${id}`, original_file_name: `${title.replace(/[^A-Za-z0-9]+/g, '-')}.pdf`, file_size_bytes: 184000, version_no: 1, created_at: ago((extra.age || 120) * 1440) }
  });
  const certificates = [
    cert('k-d1', ME, 't-iso9001', 'ISO 9001:2015', day(410), 'all_connections', { issued: day(-685) }),
    cert('k-d2', ME, 't-iso14001', 'ISO 14001:2015', day(22), 'all_connections'),
    cert('k-d3', ME, 't-iso27001', 'ISO 27001:2022', day(-9), 'selected'),
    cert('k-d4', ME, 't-iso45001', 'ISO 45001:2018', day(180), 'private'),
    cert('k-d5', ME, 't-efka', 'Ασφαλιστική ενημερότητα', day(12), 'all_connections', { issuer: 'e-ΕΦΚΑ' }),
    cert('k-d6', ME, 't-tax', 'Φορολογική ενημερότητα', day(45), 'selected', { issuer: 'ΑΑΔΕ' }),
    cert('k-d7', ME, 't-license', 'Άδεια λειτουργίας', day(900), 'all_connections', { issuer: 'Περιφέρεια Αττικής' }),
    cert('k-d8', ME, 't-insurance', 'Ασφάλιση αστικής ευθύνης', day(95), 'private', { issuer: 'Ευρωπαϊκή Πίστη' }),
    // Partners' certificates (as the demo organization is allowed to see them)
    cert('k-m1', 'o-med', 't-iso13485', 'ISO 13485:2016', day(320), 'all_connections'),
    cert('k-m2', 'o-med', 't-iso9001', 'ISO 9001:2015', day(18), 'all_connections'),
    cert('k-m3', 'o-med', 't-ce', 'CE — Class IIa', day(540), 'selected'),
    cert('k-m9', 'o-med', 't-iso27001', 'ISO 27001 (εσωτερικό)', day(200), 'private'),
    cert('k-c1', 'o-clean', 't-iso9001', 'ISO 9001:2015', day(-4), 'all_connections'),
    cert('k-c2', 'o-clean', 't-iso14001', 'ISO 14001:2015', day(260), 'all_connections'),
    cert('k-c3', 'o-clean', 't-efka', 'Ασφαλιστική ενημερότητα', day(27), 'all_connections', { issuer: 'e-ΕΦΚΑ' }),
    cert('k-b1', 'o-bio', 't-iso13485', 'ISO 13485:2016', day(150), 'all_connections'),
    cert('k-b2', 'o-bio', 't-iso9001', 'ISO 9001:2015', day(600), 'all_connections'),
    cert('k-t1', 'o-tech', 't-ce', 'CE — Class I', day(75), 'all_connections'),
    cert('k-t2', 'o-tech', 't-iso9001', 'ISO 9001:2015', day(5), 'all_connections')
  ];
  const certificate_shares = [
    { certificate_id: 'k-d3', grantee_org_id: 'o-med', expires_at: null },
    { certificate_id: 'k-d6', grantee_org_id: 'o-clean', expires_at: new Date(Date.now() + 20 * 86400000).toISOString() },
    { certificate_id: 'k-d6', grantee_org_id: 'o-bio', expires_at: null },
    { certificate_id: 'k-m3', grantee_org_id: ME, expires_at: null }
  ];
  const req = (id, connection, from, to, type, status, created, extra = {}) => ({ id, connection_id: connection, requester_org_id: from, responder_org_id: to,
    certificate_type_id: type, note: extra.note || null, due_date: extra.due || null, status, response_note: null, fulfilled_certificate_id: extra.cert || null,
    created_at: ago(created * 1440), resolved_at: status === 'open' ? null : ago((created - 1) * 1440) });
  const document_requests = [
    req('r-1', 'c-med', ME, 'o-med', 't-iso13485', 'fulfilled', 40, { cert: 'k-m1' }),
    req('r-2', 'c-clean', ME, 'o-clean', 't-iso9001', 'fulfilled', 60, { cert: 'k-c1' }),
    req('r-3', 'c-clean', ME, 'o-clean', 't-efka', 'fulfilled', 30, { cert: 'k-c3' }),
    req('r-4', 'c-bio', ME, 'o-bio', 't-iso14001', 'open', 6, { note: 'Απαιτείται για τον ετήσιο έλεγχο προμηθευτών.', due: day(14) }),
    req('r-5', 'c-tech', ME, 'o-tech', 't-iso13485', 'open', 3),
    req('r-6', 'c-med', 'o-med', ME, 't-iso45001', 'open', 2, { note: 'Για τον φάκελο του διαγωνισμού.', due: day(10) }),
    req('r-7', 'c-tech', 'o-tech', ME, 't-iso9001', 'fulfilled', 50, { cert: 'k-d1' }),
    req('r-8', 'c-clean', 'o-clean', ME, 't-insurance', 'open', 1)
  ];
  const certificate_views = [
    { id: 1, certificate_id: 'k-d1', viewer_org_name: 'MedSupply Α.Ε.', viewed_at: ago(18) },
    { id: 2, certificate_id: 'k-d5', viewer_org_name: 'CleanCare Services', viewed_at: ago(140) },
    { id: 3, certificate_id: 'k-d3', viewer_org_name: 'MedSupply Α.Ε.', viewed_at: ago(60 * 26) },
    { id: 4, certificate_id: 'k-d1', viewer_org_name: 'TechMed Systems', viewed_at: ago(60 * 50) },
    { id: 5, certificate_id: 'k-d7', viewer_org_name: 'BioLab Solutions', viewed_at: ago(60 * 24 * 4) }
  ];
  const note = (id, type, severity, title, body, mins, read = false, entity = {}) => ({ id, type, severity, title, body, created_at: ago(mins), read_at: read ? ago(mins - 1) : null, metadata: {}, ...entity });
  const notifications = [
    note('n-1', 'connection_request', 'info', 'Νέο αίτημα σύνδεσης', 'SafeWaste ΕΠΕ θέλει να συνδεθεί μαζί σας στο CertiTrack.', 60 * 24, false, { entity_type: 'connection', entity_id: 'c-safe' }),
    note('n-2', 'document_request', 'info', 'Νέο αίτημα εγγράφου', 'MedSupply Α.Ε. ζητά: ISO 45001.', 60 * 48, false, { entity_type: 'document_request', entity_id: 'r-6' }),
    note('n-3', 'partner_certificate_expiring', 'warning', 'Πιστοποιητικό συνεργάτη προς λήξη', 'CleanCare Services: Ασφαλιστική ενημερότητα λήγει σε 27 ημέρες.', 60 * 5),
    note('n-4', 'certificate_expiry', 'critical', 'Πιστοποιητικό προς λήξη', 'Ασφαλιστική ενημερότητα λήγει σε 12 ημέρες.', 60 * 30),
    note('n-5', 'document_request_fulfilled', 'success', 'Το αίτημα εγγράφου ικανοποιήθηκε', 'MedSupply Α.Ε. κοινοποίησε: ISO 13485:2016.', 60 * 24 * 40, true)
  ];
  const invitations = [{ id: 'i-1', email: 'quality@newpartner.example', status: 'pending', created_at: ago(60 * 24 * 4), expires_at: new Date(Date.now() + 56 * 86400000).toISOString() }];
  const audit = [
    { id: 1, organization_id: 'o-med', action: 'update', entity_type: 'certificates', entity_id: 'k-m2', created_at: ago(18) },
    { id: 2, organization_id: 'o-clean', action: 'insert', entity_type: 'connections', entity_id: 'c-x2', created_at: ago(120) },
    { id: 3, organization_id: ME, action: 'insert', entity_type: 'certificate_shares', entity_id: 'k-d3', created_at: ago(60 * 26) },
    { id: 4, organization_id: 'o-sterile', action: 'insert', entity_type: 'connections', entity_id: 'c-x3', created_at: ago(60 * 48) },
    { id: 5, organization_id: 'o-green', action: 'insert', entity_type: 'organizations', entity_id: 'o-green', created_at: ago(60 * 24 * 2) }
  ];
  const prefs = { in_app_enabled: true, email_enabled: true, expiry_in_app_enabled: true, expiry_email_enabled: true, relationship_notifications: true, partner_certificate_notifications: true };
  return { ME, orgs, connections, certificates, certificate_shares, document_requests, certificate_views, notifications, invitations, audit, prefs };
}

let db;
function load() {
  if (db) return db;
  try { db = JSON.parse(sessionStorage.getItem(STORE_KEY) || 'null'); } catch { db = null; }
  db ||= seed();
  return db;
}
function save() { try { sessionStorage.setItem(STORE_KEY, JSON.stringify(db)); } catch { /* demo only */ } }
const wait = (ms = 120) => new Promise(r => setTimeout(r, ms));
const fail = message => { throw Object.assign(new Error(message), { code: 'demo' }); };

export function demoRole() { try { return localStorage.getItem(ROLE_KEY); } catch { return null; } }
export function startDemo(role) {
  try { localStorage.setItem(ROLE_KEY, role === 'admin' ? 'admin' : 'organization'); sessionStorage.removeItem(STORE_KEY); } catch { /* ignore */ }
}
export function endDemo() { try { localStorage.removeItem(ROLE_KEY); sessionStorage.removeItem(STORE_KEY); } catch { /* ignore */ } }

// --- the same visibility rule as ct_org_can_view_certificate --------------------
function connected(a, b) {
  return load().connections.some(c => c.status === 'active' &&
    ((c.requester_org_id === a && c.addressee_org_id === b) || (c.requester_org_id === b && c.addressee_org_id === a)));
}
function canView(viewer, cert) {
  if (cert.deleted_at || cert.organization_id === viewer || cert.sharing === 'private') return false;
  if (!connected(viewer, cert.organization_id)) return false;
  if (cert.sharing === 'all_connections') return true;
  return load().certificate_shares.some(s => s.certificate_id === cert.id && s.grantee_org_id === viewer &&
    (!s.expires_at || new Date(s.expires_at) > new Date()));
}
const typeOf = id => TYPES.find(t => t.id === id);
const withType = c => ({ ...c, type: typeOf(c.certificate_type_id) });
const orgById = id => load().orgs.find(o => o.id === id);

function refreshRequests(cert) {
  const d = load();
  for (const r of d.document_requests) {
    if (r.status === 'open' && r.responder_org_id === cert.organization_id && r.certificate_type_id === cert.certificate_type_id && canView(r.requester_org_id, cert)) {
      Object.assign(r, { status: 'fulfilled', fulfilled_certificate_id: cert.id, resolved_at: new Date().toISOString() });
    }
  }
}

export const demoApi = {
  mode: 'demo',

  async session() { return demoRole() ? { demo: true } : null; },
  async signOut() { endDemo(); },
  async context() {
    const role = demoRole();
    if (!role) return null;
    const d = load();
    if (role === 'admin') return { user: { id: 'u-admin', email: 'owner@certitrack.example' }, organization: null, role: null, isAdmin: true, mfaFactor: null, demo: true };
    return { user: { id: 'u-demo', email: 'quality@demo-group.example' }, organization: orgById(d.ME), role: 'owner', isAdmin: false, mfaFactor: null, demo: true };
  },
  async updateOrganization(fields) { await wait(); Object.assign(orgById(load().ME), fields, { name: fields.display_name || fields.legal_name || orgById(load().ME).name }); save(); },
  async requestClosure() { fail('demo_readonly'); },
  async cancelClosure() { fail('demo_readonly'); },
  async changePassword() { fail('demo_readonly'); },
  async mfaEnroll() { fail('demo_readonly'); },

  async certificateTypes() { return TYPES; },
  async myCertificates() {
    await wait(); const d = load();
    return d.certificates.filter(c => c.organization_id === d.ME && !c.deleted_at).map(c => ({ ...withType(c),
      shares: d.certificate_shares.filter(s => s.certificate_id === c.id) }))
      .sort((a, b) => String(a.expiry_date || '9').localeCompare(String(b.expiry_date || '9')));
  },
  async partnerCertificates(partnerId) {
    await wait(); const d = load();
    return d.certificates.filter(c => c.organization_id === partnerId && canView(d.ME, c)).map(withType)
      .sort((a, b) => String(a.expiry_date || '9').localeCompare(String(b.expiry_date || '9')));
  },
  async visiblePartnerCertificates() {
    await wait(); const d = load();
    return d.certificates.filter(c => canView(d.ME, c)).map(withType);
  },
  async saveCertificate({ id, file, sharing, shares, ...fields }) {
    await wait(250); const d = load();
    let cert = id && d.certificates.find(c => c.id === id && c.organization_id === d.ME);
    if (!cert) {
      cert = { id: uid(), organization_id: d.ME, sharing: 'private', created_at: new Date().toISOString(), file: null, current_file_id: null };
      d.certificates.push(cert);
    }
    Object.assign(cert, {
      certificate_type_id: fields.certificate_type_id, custom_type_label: fields.custom_type_label || null, title: fields.title,
      certificate_number: fields.certificate_number || null, issuer: fields.issuer || null, issue_date: fields.issue_date || null,
      expiry_date: fields.expiry_date || null, notes: fields.notes || null, updated_at: new Date().toISOString()
    });
    if (file) {
      cert.current_file_id = uid();
      cert.file = { id: cert.current_file_id, original_file_name: file.name, file_size_bytes: file.size, version_no: (cert.file?.version_no || 0) + 1, created_at: new Date().toISOString(), blob: URL.createObjectURL(file) };
    }
    if (sharing) await this.setSharing(cert.id, sharing, shares || []);
    refreshRequests(cert); save();
    return cert.id;
  },
  async deleteCertificate(id) {
    await wait(); const d = load();
    const c = d.certificates.find(x => x.id === id && x.organization_id === d.ME);
    if (c) { c.deleted_at = new Date().toISOString(); d.certificate_shares = d.certificate_shares.filter(s => s.certificate_id !== id); }
    save();
  },
  async setSharing(id, mode, shares = []) {
    const d = load();
    const c = d.certificates.find(x => x.id === id && x.organization_id === d.ME);
    if (!c) fail('not_found');
    for (const s of shares) if (!connected(d.ME, s.org_id)) fail('Can only share with organizations you are connected to');
    d.certificate_shares = d.certificate_shares.filter(s => s.certificate_id !== id);
    if (mode === 'selected') shares.forEach(s => d.certificate_shares.push({ certificate_id: id, grantee_org_id: s.org_id, expires_at: s.expires_at || null }));
    c.sharing = mode; refreshRequests(c); save();
  },
  async certificateViews({ certificateId, limit = 50 } = {}) {
    await wait(); const d = load();
    return d.certificate_views.filter(v => !certificateId || v.certificate_id === certificateId).slice(0, limit)
      .map(v => ({ ...v, certificate: { title: d.certificates.find(c => c.id === v.certificate_id)?.title } }));
  },
  async openCertificate(id) {
    const d = load(); const c = d.certificates.find(x => x.id === id);
    if (!c || !(c.organization_id === d.ME || canView(d.ME, c) || demoRole() === 'admin')) fail('Certificate not found');
    return { url: c.file?.blob || DEMO_PDF_URL, fileName: c.file?.original_file_name || 'certificate.pdf' };
  },

  async connections() {
    await wait(); const d = load();
    return d.connections.filter(c => ['pending', 'active'].includes(c.status) && [c.requester_org_id, c.addressee_org_id].includes(d.ME)).map(c => {
      const partner = orgById(c.requester_org_id === d.ME ? c.addressee_org_id : c.requester_org_id);
      return { id: c.id, status: c.status, direction: c.requester_org_id === d.ME ? 'outgoing' : 'incoming', created_at: c.created_at,
        responded_at: c.responded_at, ended_at: c.ended_at, partner_id: partner.id, partner_name: partner.name,
        partner_vat: partner.vat_number, partner_country: 'GR', partner_email: partner.contact_email };
    });
  },
  async invitations() { await wait(); return load().invitations.filter(i => i.status === 'pending'); },
  async findPartner(lookup) {
    const v = String(lookup).trim().toLowerCase();
    const o = load().orgs.find(x => x.status === 'active' && (x.contact_email === v || x.vat_number === v.replace(/\D/g, '')));
    return o ? { id: o.id, name: o.name, vat_number: o.vat_number, country_code: 'GR' } : null;
  },
  async requestConnection(lookup) {
    await wait(250); const d = load();
    const target = await this.findPartner(lookup);
    if (target) {
      if (target.id === d.ME) fail('Cannot connect with your own organization');
      if (d.connections.some(c => ['pending', 'active'].includes(c.status) && [c.requester_org_id, c.addressee_org_id].includes(target.id) && [c.requester_org_id, c.addressee_org_id].includes(d.ME))) fail('Connection already exists or is pending');
      const id = uid();
      d.connections.push({ id, requester_org_id: d.ME, addressee_org_id: target.id, status: 'pending', created_at: new Date().toISOString() });
      save(); return { kind: 'connection', id };
    }
    if (!lookup.includes('@')) fail('No registered organization was found. Use an email address to invite an unregistered organization');
    const id = uid();
    d.invitations.unshift({ id, email: lookup.trim().toLowerCase(), status: 'pending', created_at: new Date().toISOString(), expires_at: new Date(Date.now() + 60 * 86400000).toISOString() });
    save(); return { kind: 'invitation', id };
  },
  async respondConnection(id, accept) {
    await wait(); const c = load().connections.find(x => x.id === id);
    Object.assign(c, { status: accept ? 'active' : 'declined', responded_at: new Date().toISOString() }); save();
  },
  async endConnection(id) {
    await wait(); const d = load(); const c = d.connections.find(x => x.id === id);
    const other = c.requester_org_id === d.ME ? c.addressee_org_id : c.requester_org_id;
    c.status = c.status === 'pending' ? 'cancelled' : 'ended'; c.ended_at = new Date().toISOString();
    const mine = new Set(d.certificates.filter(x => x.organization_id === d.ME).map(x => x.id));
    const theirs = new Set(d.certificates.filter(x => x.organization_id === other).map(x => x.id));
    d.certificate_shares = d.certificate_shares.filter(s => !((mine.has(s.certificate_id) && s.grantee_org_id === other) || (theirs.has(s.certificate_id) && s.grantee_org_id === d.ME)));
    d.document_requests.forEach(r => { if (r.connection_id === id && ['open', 'fulfilled'].includes(r.status)) r.status = 'cancelled'; });
    save();
  },
  async cancelInvitation(id) { await wait(); const i = load().invitations.find(x => x.id === id); if (i) i.status = 'cancelled'; save(); },

  async documentRequests() {
    await wait(); const d = load();
    return d.document_requests.filter(r => ['open', 'fulfilled', 'declined'].includes(r.status) && [r.requester_org_id, r.responder_org_id].includes(d.ME))
      .map(r => ({ ...r, type: typeOf(r.certificate_type_id) })).sort((a, b) => b.created_at.localeCompare(a.created_at));
  },
  async requestDocument(connectionId, typeId, note, dueDate) {
    await wait(250); const d = load(); const c = d.connections.find(x => x.id === connectionId && x.status === 'active');
    if (!c) fail('Connection is not active');
    const other = c.requester_org_id === d.ME ? c.addressee_org_id : c.requester_org_id;
    if (d.document_requests.some(r => r.connection_id === connectionId && r.requester_org_id === d.ME && r.certificate_type_id === typeId && ['open', 'fulfilled'].includes(r.status)))
      fail('You have already requested this type of certificate from this organization');
    const r = { id: uid(), connection_id: connectionId, requester_org_id: d.ME, responder_org_id: other, certificate_type_id: typeId, note: note || null,
      due_date: dueDate || null, status: 'open', created_at: new Date().toISOString() };
    d.document_requests.push(r);
    d.certificates.filter(x => x.organization_id === other).forEach(refreshRequests);
    save();
  },
  async cancelRequest(id) { await wait(); const r = load().document_requests.find(x => x.id === id); r.status = 'cancelled'; save(); },
  async declineRequest(id, note) { await wait(); const r = load().document_requests.find(x => x.id === id); Object.assign(r, { status: 'declined', response_note: note || null }); save(); },
  async fulfillRequest(id, certificateId) {
    await wait(250); const d = load(); const r = d.document_requests.find(x => x.id === id);
    const c = d.certificates.find(x => x.id === certificateId && x.organization_id === d.ME);
    if (!c) fail('Certificate not found');
    if (c.certificate_type_id !== r.certificate_type_id) fail('Certificate type does not match the request');
    if (!canView(r.requester_org_id, c)) {
      if (c.sharing === 'private') c.sharing = 'selected';
      if (!d.certificate_shares.some(s => s.certificate_id === c.id && s.grantee_org_id === r.requester_org_id))
        d.certificate_shares.push({ certificate_id: c.id, grantee_org_id: r.requester_org_id, expires_at: null });
    }
    refreshRequests(c); save();
  },

  async notifications() { await wait(); return load().notifications; },
  async markNotificationsRead(ids) { load().notifications.forEach(n => { if (ids.includes(n.id)) n.read_at ||= new Date().toISOString(); }); save(); },
  async notificationPreferences() { return { ...load().prefs }; },
  async saveNotificationPreferences(prefs) { await wait(); Object.assign(load().prefs, prefs); save(); },

  async adminOrganizations() { await wait(); return load().orgs; },
  async adminNetwork() {
    await wait(); const d = load();
    return d.connections.map(c => {
      const count = (owner, viewer) => c.status === 'active' ? d.certificates.filter(x => x.organization_id === owner && canView(viewer, x)).length : 0;
      return { connection_id: c.id, status: c.status, created_at: c.created_at, responded_at: c.responded_at, ended_at: c.ended_at,
        requester_id: c.requester_org_id, requester_name: orgById(c.requester_org_id).name, addressee_id: c.addressee_org_id, addressee_name: orgById(c.addressee_org_id).name,
        shared_by_requester: count(c.requester_org_id, c.addressee_org_id), shared_by_addressee: count(c.addressee_org_id, c.requester_org_id),
        open_requests: d.document_requests.filter(r => r.connection_id === c.id && r.status === 'open').length };
    });
  },
  async adminCertificates() { await wait(); return load().certificates.filter(c => !c.deleted_at).map(withType); },
  async adminAudit() { await wait(); return load().audit; },
  async adminSetOrganizationState(id, state) { await wait(); orgById(id).status = state; save(); }
};
