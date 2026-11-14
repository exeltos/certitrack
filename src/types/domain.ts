// Shapes the pages work with. Both API implementations (Supabase and demo)
// return exactly these types, so TypeScript keeps them in sync.
import type {
  CertificateRow, CertificateShareRow, CertificateTypeRow, DocumentRequestRow, NotificationPreferencesRow,
  NotificationRow, OrganizationRow, AuditLogRow
} from './database';

export type Sharing = 'private' | 'all_connections' | 'selected';
export type MemberRole = 'owner' | 'admin' | 'member' | 'viewer';
export type OrganizationStatus = 'pending_verification' | 'active' | 'suspended' | 'closure_requested' | 'closed';
export type ConnectionStatus = 'pending' | 'active' | 'declined' | 'cancelled' | 'ended';
export type RequestStatus = 'open' | 'fulfilled' | 'declined' | 'cancelled';

export type Organization = Omit<OrganizationRow, 'status'> & { status: OrganizationStatus; name: string };

export interface SessionUser { id: string; email: string }
export interface MfaFactor { id: string; status?: string }

export interface AppContext {
  user: SessionUser;
  organization: Organization | null;
  role: MemberRole | null;
  isAdmin: boolean;
  mfaFactor: MfaFactor | null;
  demo?: boolean;
}

export type CertificateType = Pick<CertificateTypeRow, 'id' | 'code' | 'name' | 'name_en' | 'requires_expiry'>;

export interface CertificateFile {
  id: string;
  original_file_name: string;
  file_size_bytes: number;
  version_no: number;
  created_at: string;
  /** Demo only: object URL of a file chosen in the browser. */
  blob?: string;
}

export type CertificateShare = Pick<CertificateShareRow, 'grantee_org_id' | 'expires_at'> & { certificate_id?: string };

export type Certificate = Pick<CertificateRow,
  'id' | 'organization_id' | 'certificate_type_id' | 'custom_type_label' | 'title' | 'certificate_number' | 'issuer' |
  'issue_date' | 'expiry_date' | 'notes' | 'current_file_id' | 'created_at' | 'updated_at'> & {
  sharing: Sharing;
  type: CertificateType | null;
  file: CertificateFile | null;
  /** Present on the organization's own certificates. */
  shares?: CertificateShare[];
  deleted_at?: string | null;
};

export interface CertificateInput {
  id?: string;
  certificate_type_id: string;
  custom_type_label?: string;
  title: string;
  certificate_number?: string;
  issuer?: string;
  issue_date?: string;
  expiry_date?: string;
  notes?: string;
  file?: File | null;
  sharing?: Sharing;
  shares?: ShareInput[];
}

export interface ShareInput { org_id: string; expires_at?: string | null }

export interface Connection {
  id: string;
  status: ConnectionStatus;
  direction: 'incoming' | 'outgoing';
  created_at: string;
  responded_at: string | null;
  ended_at: string | null;
  partner_id: string;
  partner_name: string;
  partner_vat: string;
  partner_country: string;
  partner_email: string | null;
}

export interface Invitation { id: string; email: string; status: string; created_at: string; expires_at: string }

export interface PartnerCandidate { id: string; name: string; vat_number: string; country_code: string }

export interface ConnectionResult { kind: 'connection' | 'invitation'; id: string }

export type DocumentRequest = Pick<DocumentRequestRow,
  'id' | 'connection_id' | 'requester_org_id' | 'responder_org_id' | 'certificate_type_id' | 'note' | 'due_date' |
  'response_note' | 'fulfilled_certificate_id' | 'created_at' | 'resolved_at'> & {
  status: RequestStatus;
  type: CertificateType | null;
};

export interface CertificateView {
  id: number;
  certificate_id: string;
  viewer_org_name: string;
  viewed_at: string;
  certificate: { title: string | undefined } | null;
}

export type Notification = Pick<NotificationRow, 'id' | 'type' | 'severity' | 'title' | 'body' | 'created_at' | 'read_at'> &
  Partial<Pick<NotificationRow, 'entity_type' | 'entity_id' | 'metadata'>>;

export type NotificationPreferences = Pick<NotificationPreferencesRow,
  'in_app_enabled' | 'email_enabled' | 'expiry_in_app_enabled' | 'expiry_email_enabled' |
  'relationship_notifications' | 'partner_certificate_notifications'>;

export type OrganizationUpdate = Partial<Pick<OrganizationRow,
  'legal_name' | 'display_name' | 'contact_email' | 'phone' | 'website' | 'address_line1' | 'city' | 'postal_code'>>;

export interface OpenedFile { url: string; fileName: string }

export type PresentationStatus = 'new' | 'contacted' | 'done';

/** Levels inside one organization: Διαχειριστής (owner/admin) and Μέλος (member). */
export type TeamRole = 'admin' | 'member';
export const isTeamAdmin = (role: MemberRole | null | undefined): boolean => role === 'owner' || role === 'admin';
export interface TeamMember { user_id: string; email: string; role: MemberRole; status: 'active' | 'pending_verification'; joined_at: string; is_me: boolean }
export interface TeamInvitation { id: string; email: string; role: TeamRole; created_at: string; expires_at: string }
export interface Team { members: TeamMember[]; invitations: TeamInvitation[] }
/** A "request a presentation" sent from the home page. */
export interface PresentationRequest {
  id: string; name: string; company: string; email: string; phone: string | null; message: string | null;
  status: PresentationStatus; created_at: string; updated_at: string;
}
export interface PresentationInput { name: string; company: string; email: string; phone?: string; message?: string; trap?: string }

/** Contact card on the public home page; edited by the platform owner. */
export interface SiteContact { company: string; email: string | null; phone: string | null; website: string | null }

export interface NetworkEdge {
  connection_id: string; status: ConnectionStatus; created_at: string; responded_at: string | null; ended_at: string | null;
  requester_id: string; requester_name: string; addressee_id: string; addressee_name: string;
  shared_by_requester: number; shared_by_addressee: number; open_requests: number;
}

export interface AdminCertificate {
  id: string; organization_id: string; title: string; expiry_date: string | null; sharing: Sharing;
  type: Pick<CertificateType, 'name' | 'name_en'> | null;
}

export type AuditEntry = Pick<AuditLogRow, 'id' | 'organization_id' | 'action' | 'entity_type' | 'entity_id' | 'created_at'> &
  Partial<Pick<AuditLogRow, 'old_data' | 'new_data' | 'metadata'>>;

/** The data API every page uses. Implemented by src/api/supabase.ts and src/api/demo.ts. */
export interface Api {
  mode: 'live' | 'demo';
  session(): Promise<unknown | null>;
  signOut(): Promise<void>;
  context(options?: { fresh?: boolean }): Promise<AppContext | null>;
  changePassword(currentPassword: string, password: string): Promise<void>;
  mfaEnroll(): Promise<{ id: string; totp: { qr_code: string; secret: string } }>;
  mfaConfirm(factorId: string, code: string): Promise<void>;
  mfaDisable(factorId: string): Promise<void>;

  updateOrganization(fields: OrganizationUpdate): Promise<void>;
  requestClosure(reason: string): Promise<void>;
  cancelClosure(): Promise<void>;

  certificateTypes(): Promise<CertificateType[]>;
  myCertificates(): Promise<Certificate[]>;
  partnerCertificates(partnerId: string): Promise<Certificate[]>;
  visiblePartnerCertificates(): Promise<Certificate[]>;
  saveCertificate(input: CertificateInput): Promise<string>;
  deleteCertificate(id: string): Promise<void>;
  setSharing(id: string, mode: Sharing, shares?: ShareInput[]): Promise<void>;
  certificateViews(options?: { certificateId?: string; limit?: number }): Promise<CertificateView[]>;
  openCertificate(id: string): Promise<OpenedFile>;

  connections(): Promise<Connection[]>;
  invitations(): Promise<Invitation[]>;
  findPartner(lookup: string): Promise<PartnerCandidate | null>;
  requestConnection(lookup: string): Promise<ConnectionResult>;
  respondConnection(id: string, accept: boolean): Promise<void>;
  endConnection(id: string, reason?: string): Promise<void>;
  cancelInvitation(id: string): Promise<void>;

  documentRequests(): Promise<DocumentRequest[]>;
  requestDocument(connectionId: string, typeId: string, note?: string, dueDate?: string): Promise<void>;
  cancelRequest(id: string): Promise<void>;
  declineRequest(id: string, note?: string): Promise<void>;
  fulfillRequest(id: string, certificateId: string): Promise<void>;

  notifications(limit?: number): Promise<Notification[]>;
  markNotificationsRead(ids: string[]): Promise<void>;
  notificationPreferences(): Promise<NotificationPreferences | null>;
  saveNotificationPreferences(prefs: NotificationPreferences): Promise<void>;

  adminOrganizations(): Promise<Organization[]>;
  adminNetwork(): Promise<NetworkEdge[]>;
  adminCertificates(): Promise<AdminCertificate[]>;
  adminAudit(limit?: number): Promise<AuditEntry[]>;
  adminSetOrganizationState(id: string, state: 'active' | 'suspended' | 'closed', reason?: string): Promise<void>;

  siteContact(): Promise<SiteContact>;
  setSiteContact(contact: SiteContact): Promise<SiteContact>;

  team(): Promise<Team>;
  inviteTeamMember(email: string, role: TeamRole): Promise<void>;
  cancelTeamInvitation(id: string): Promise<void>;
  setTeamRole(userId: string, role: TeamRole): Promise<void>;
  removeTeamMember(userId: string): Promise<void>;

  submitPresentationRequest(input: PresentationInput): Promise<void>;
  presentationRequests(): Promise<PresentationRequest[]>;
  setPresentationRequestStatus(id: string, status: PresentationStatus): Promise<void>;
}
