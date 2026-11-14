// Database types, generated from the live Supabase schema (generate_typescript_types)
// and trimmed to what the frontend uses: public tables and client-callable RPCs.
// Regenerate after every migration that changes tables or ct_* function signatures.
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type FK<Name extends string, Cols extends string[], Ref extends string> = {
  foreignKeyName: Name; columns: Cols; isOneToOne: false; referencedRelation: Ref; referencedColumns: ['id'];
};

export type OrganizationRow = {
  address_line1: string | null; address_line2: string | null; city: string | null; closed_at: string | null;
  closure_reason: string | null; closure_requested_at: string | null; closure_requested_by: string | null;
  contact_email: string | null; country_code: string; created_at: string; created_by: string | null;
  display_name: string | null; erasure_completed_at: string | null; erasure_completed_by: string | null;
  id: string; legal_name: string; phone: string | null; postal_code: string | null; status: string;
  suspended_at: string | null; suspended_by: string | null; suspension_reason: string | null;
  updated_at: string; vat_number: string; website: string | null;
};
export type CertificateRow = {
  certificate_number: string | null; certificate_type_id: string; created_at: string; created_by: string | null;
  current_file_id: string | null; custom_type_label: string | null; deleted_at: string | null; deleted_by: string | null;
  expiry_date: string | null; id: string; issue_date: string | null; issuer: string | null; notes: string | null;
  organization_id: string; sharing: string; title: string; updated_at: string; updated_by: string | null;
};
export type CertificateFileRow = {
  certificate_id: string; created_at: string; file_size_bytes: number; id: string; mime_type: string;
  organization_id: string; original_file_name: string; retired_at: string | null; storage_path: string;
  uploaded_by: string | null; version_no: number;
};
export type CertificateTypeRow = {
  active: boolean; code: string; created_at: string; id: string; name: string; name_en: string;
  requires_expiry: boolean; sort_order: number; updated_at: string;
};
export type CertificateShareRow = {
  certificate_id: string; created_at: string; created_by: string | null; expires_at: string | null; grantee_org_id: string;
};
export type CertificateViewRow = {
  certificate_id: string; file_id: string | null; id: number; owner_org_id: string; viewed_at: string;
  viewer_org_id: string | null; viewer_org_name: string; viewer_user_id: string | null;
};
export type ConnectionRow = {
  addressee_org_id: string; created_at: string; end_reason: string | null; ended_at: string | null; ended_by: string | null;
  ended_by_org_id: string | null; id: string; requested_by: string | null; requester_org_id: string;
  responded_at: string | null; responded_by: string | null; status: string; updated_at: string;
};
export type DocumentRequestRow = {
  certificate_type_id: string; connection_id: string; created_at: string; created_by: string | null; due_date: string | null;
  fulfilled_certificate_id: string | null; id: string; note: string | null; requester_org_id: string;
  resolved_at: string | null; resolved_by: string | null; responder_org_id: string; response_note: string | null;
  status: string; updated_at: string;
};
export type InvitationRow = {
  connection_id: string | null; created_at: string; email: string; expires_at: string; id: string;
  invited_by: string | null; inviter_org_id: string; status: string; updated_at: string;
};
export type NotificationPreferencesRow = {
  created_at: string; email_enabled: boolean; expiry_email_enabled: boolean; expiry_in_app_enabled: boolean;
  expiry_warning_days: number[]; id: string; in_app_enabled: boolean; organization_id: string;
  partner_certificate_notifications: boolean; relationship_notifications: boolean; updated_at: string; user_id: string;
};
export type NotificationRow = {
  body: string | null; created_at: string; dedupe_key: string | null; entity_id: string | null; entity_type: string | null;
  id: string; metadata: Json; organization_id: string; read_at: string | null; severity: string; title: string;
  type: string; user_id: string;
};
export type OrganizationMemberRow = {
  created_at: string; id: string; organization_id: string; removed_at: string | null; role: string; status: string;
  updated_at: string; user_id: string;
};
export type AuditLogRow = {
  action: string; actor_user_id: string | null; created_at: string; entity_id: string | null; entity_type: string;
  id: number; metadata: Json; new_data: Json | null; old_data: Json | null; organization_id: string | null;
};

type Table<Row, Insert = Partial<Row>, Rels = []> = { Row: Row; Insert: Insert; Update: Partial<Row>; Relationships: Rels };

export type Database = {
  __InternalSupabase: { PostgrestVersion: '12.2.3' };
  public: {
    Tables: {
      organizations: Table<OrganizationRow>;
      organization_members: Table<OrganizationMemberRow, Partial<OrganizationMemberRow>, [
        FK<'organization_members_organization_id_fkey', ['organization_id'], 'organizations'>]>;
      platform_admins: Table<{ created_at: string; created_by: string | null; user_id: string }>;
      certificate_types: Table<CertificateTypeRow>;
      certificates: Table<CertificateRow,
        Partial<CertificateRow> & Pick<CertificateRow, 'certificate_type_id' | 'organization_id' | 'title'>, [
        FK<'certificates_certificate_type_id_fkey', ['certificate_type_id'], 'certificate_types'>,
        FK<'certificates_current_file_fk', ['current_file_id'], 'certificate_files'>,
        FK<'certificates_organization_id_fkey', ['organization_id'], 'organizations'>]>;
      certificate_files: Table<CertificateFileRow, Partial<CertificateFileRow>, [
        FK<'certificate_files_certificate_id_fkey', ['certificate_id'], 'certificates'>]>;
      certificate_shares: Table<CertificateShareRow, Partial<CertificateShareRow>, [
        FK<'certificate_shares_certificate_id_fkey', ['certificate_id'], 'certificates'>]>;
      certificate_views: Table<CertificateViewRow, Partial<CertificateViewRow>, [
        FK<'certificate_views_certificate_id_fkey', ['certificate_id'], 'certificates'>]>;
      connections: Table<ConnectionRow>;
      invitations: Table<InvitationRow>;
      document_requests: Table<DocumentRequestRow, Partial<DocumentRequestRow>, [
        FK<'document_requests_certificate_type_id_fkey', ['certificate_type_id'], 'certificate_types'>]>;
      notification_preferences: Table<NotificationPreferencesRow>;
      notifications: Table<NotificationRow>;
      audit_log: Table<AuditLogRow>;
      site_settings: Table<{ key: string; value: Json; updated_at: string; updated_by: string | null }>;
      team_invitations: Table<{
        id: string; organization_id: string; email: string; role: string; status: string; invited_by: string | null;
        created_at: string; expires_at: string; accepted_at: string | null;
      }>;
      presentation_requests: Table<{
        id: string; name: string; company: string; email: string; phone: string | null; message: string | null;
        status: string; created_at: string; updated_at: string; handled_by: string | null;
      }>;
    };
    Views: { [_ in never]: never };
    Functions: {
      ct_is_platform_admin: { Args: { p_user?: string }; Returns: boolean };
      ct_find_partner_candidate: { Args: { p_lookup: string }; Returns: { country_code: string; id: string; name: string; vat_number: string }[] };
      ct_request_connection: { Args: { p_lookup: string; p_org: string }; Returns: Json };
      ct_respond_connection: { Args: { p_accept: boolean; p_connection: string }; Returns: ConnectionRow };
      ct_end_connection: { Args: { p_connection: string; p_reason?: string }; Returns: ConnectionRow };
      ct_cancel_invitation: { Args: { p_invitation: string }; Returns: undefined };
      ct_list_connections: {
        Args: { p_org: string };
        Returns: {
          created_at: string; direction: string; ended_at: string; id: string; partner_country: string; partner_email: string;
          partner_id: string; partner_name: string; partner_vat: string; responded_at: string; status: string;
        }[];
      };
      ct_set_certificate_sharing: { Args: { p_certificate: string; p_mode: string; p_shares?: Json }; Returns: undefined };
      ct_register_certificate_file: {
        Args: { p_certificate: string; p_file_size_bytes: number; p_mime_type: string; p_original_file_name: string; p_storage_path: string };
        Returns: CertificateFileRow;
      };
      ct_soft_delete_certificate: { Args: { p_certificate: string }; Returns: undefined };
      ct_abort_certificate_draft: { Args: { p_certificate: string }; Returns: undefined };
      ct_open_certificate: { Args: { p_certificate: string }; Returns: { file_name: string; storage_path: string }[] };
      ct_request_document: { Args: { p_certificate_type: string; p_connection: string; p_due_date?: string; p_note?: string }; Returns: DocumentRequestRow };
      ct_cancel_document_request: { Args: { p_request: string }; Returns: undefined };
      ct_decline_document_request: { Args: { p_note?: string; p_request: string }; Returns: undefined };
      ct_fulfill_document_request: { Args: { p_certificate: string; p_request: string }; Returns: undefined };
      ct_set_notification_read: { Args: { p_notification: string; p_read?: boolean }; Returns: undefined };
      ct_mark_notifications_read: { Args: { p_notifications: string[] }; Returns: number };
      ct_request_organization_closure: { Args: { p_org: string; p_reason?: string }; Returns: OrganizationRow };
      ct_cancel_organization_closure: { Args: { p_org: string }; Returns: OrganizationRow };
      ct_platform_set_organization_state: { Args: { p_org: string; p_reason?: string; p_state: string }; Returns: OrganizationRow };
      ct_team: { Args: { p_org: string }; Returns: { user_id: string; email: string; role: string; status: string; joined_at: string; is_me: boolean }[] };
      ct_invite_team_member: { Args: { p_org: string; p_email: string; p_role: string }; Returns: string };
      ct_cancel_team_invitation: { Args: { p_invitation: string }; Returns: undefined };
      ct_set_team_role: { Args: { p_org: string; p_user: string; p_role: string }; Returns: undefined };
      ct_remove_team_member: { Args: { p_org: string; p_user: string }; Returns: undefined };
      ct_submit_presentation_request: { Args: { p_name: string; p_company: string; p_email: string; p_phone?: string | null; p_message?: string | null; p_trap?: string | null }; Returns: undefined };
      ct_set_presentation_request_status: { Args: { p_request: string; p_status: string }; Returns: undefined };
      ct_set_site_contact: { Args: { p_company: string; p_email: string | null; p_phone: string | null; p_website: string | null }; Returns: Json };
      ct_admin_network: {
        Args: never;
        Returns: {
          addressee_id: string; addressee_name: string; connection_id: string; created_at: string; ended_at: string;
          open_requests: number; requester_id: string; requester_name: string; responded_at: string;
          shared_by_addressee: number; shared_by_requester: number; status: string;
        }[];
      };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
