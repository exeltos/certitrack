import { supabase } from './supabaseClient.js';

const TYPE_CODE_BY_LABEL = new Map([
  ['ISO 9001','ISO9001'],['ISO 13485','ISO13485'],['ISO 14001','ISO14001'],
  ['ISO 27001','ISO27001'],['ISO 45001','ISO45001'],['CE','CE'],
  ['Πιστοποιητικό CE','CE'],['Άδεια λειτουργίας','OPERATING_LICENSE'],
  ['Άδεια Λειτουργίας','OPERATING_LICENSE'],['Ασφάλιση','INSURANCE'],
  ['Ασφαλιστική ενημερότητα','INSURANCE_CLEARANCE'],['Φορολογική ενημερότητα','TAX_CLEARANCE']
]);

function latestFile(files=[]){
  return [...(Array.isArray(files)?files:[])].sort((a,b)=>(b.version_no||0)-(a.version_no||0))[0]||null;
}
function canonicalCertificate(row={}) {
  const file=latestFile(row.files);
  const typeName=row.certificate_type?.name||'Πιστοποιητικό';
  return {
    ...row,
    title:row.title||typeName,
    type:typeName,
    date:row.expiry_date||null,
    issuer:row.issuer||null,
    file_url:file?.storage_path||'',
    name:file?.original_file_name||'certificate.pdf',
    is_private:row.visibility==='private',
    file_size_bytes:file?.file_size_bytes||null,
    mime_type:file?.mime_type||'application/pdf',
    current_file:file
  };
}
async function resolveCertificateType(label) {
  const value=String(label||'').trim();
  const code=TYPE_CODE_BY_LABEL.get(value)||'OTHER';
  const {data,error}=await supabase.from('certificate_types').select('id,code,name').eq('code',code).maybeSingle();
  if(error)throw error;
  if(!data)throw new Error('Δεν βρέθηκε ο τύπος πιστοποιητικού.');
  return data;
}
function certificatePayload(record={}) {
  const payload={
    certificate_number:record.certificate_number||null,
    // Was writing to a non-existent "issuer_name" column (real column is
    // "issuer"), so every certificate create/update failed. Fixed 2026-08-24.
    issuer:record.issuer||record.issuer_name||null,
    issue_date:record.issue_date||null,
    expiry_date:record.date||record.expiry_date||null,
    notes:record.notes||null,
    visibility:record.is_private===true||record.visibility==='private'?'private':'partners'
  };
  if('title' in record) payload.title=record.title||null;
  return payload;
}
function requireOrg(org){
  if(!org?.id||org.source!=='organizations')throw new Error('Δεν βρέθηκε ενεργός οργανισμός.');
}

const CERT_SELECT=`
  *,
  certificate_type:certificate_types!certificates_certificate_type_id_fkey(id,code,name),
  files:certificate_files!certificate_files_certificate_id_fkey(
    id,storage_path,original_file_name,mime_type,file_size_bytes,version_no,created_at
  )
`;

export const organizationService={
  async isModernModelAvailable(){ return true; },

  async getByUserId(userId){
    const {data,error}=await supabase.from('organization_members')
      .select('role,status,organization:organizations!organization_members_organization_id_fkey(*)')
      .eq('user_id',userId).eq('status','active').limit(1).maybeSingle();
    if(error)throw error;
    if(!data?.organization)return null;
    return {...data.organization,source:'organizations',member_role:data.role};
  },

  async update(org,updates){
    requireOrg(org);
    const {data,error}=await supabase.from('organizations').update(updates).eq('id',org.id).select().single();
    if(error)throw error;
    return {...data,source:'organizations',member_role:org.member_role};
  },

  async requestClosure(org,reason){
    requireOrg(org);
    // Was a permanent stub that always threw "will be enabled in a future
    // backend phase" -- the backend RPC (ct_request_organization_closure)
    // has existed in the canonical schema all along. Wired up 2026-08-24.
    const res=await supabase.rpc('ct_request_organization_closure',{p_org:org.id,p_reason:reason||null});
    if(res.error)throw res.error; return res.data;
  },
  async cancelClosure(org){
    requireOrg(org);
    const res=await supabase.rpc('ct_cancel_organization_closure',{p_org:org.id});
    if(res.error)throw res.error; return res.data;
  },

  async listOwnCertificates(org){
    requireOrg(org);
    const res=await supabase.from('certificates').select(CERT_SELECT)
      .eq('organization_id',org.id).is('deleted_at',null)
      .order('expiry_date',{ascending:true,nullsFirst:false});
    if(res.error)throw res.error;
    return (res.data||[]).map(canonicalCertificate);
  },

  certificateBucket(){return 'organizationcertificates';},
  partnerCertificateBucket(){return 'organizationcertificates';},

  async insertCertificate(org,user,record){
    requireOrg(org);
    const type=await resolveCertificateType(record.type);
    const payload={...certificatePayload(record),organization_id:org.id,certificate_type_id:type.id,created_by:user.id,updated_by:user.id};
    const res=await supabase.from('certificates').insert([payload]).select('*').single();
    if(res.error)throw res.error;
    return canonicalCertificate(res.data);
  },

  async updateCertificate(org,id,updates){
    requireOrg(org);
    const payload=certificatePayload(updates);
    if('type' in updates){ const type=await resolveCertificateType(updates.type); payload.certificate_type_id=type.id; }
    payload.updated_by=(await supabase.auth.getUser()).data?.user?.id||null;
    const res=await supabase.from('certificates').update(payload).eq('id',id).eq('organization_id',org.id).select('*').single();
    if(res.error)throw res.error;
    return canonicalCertificate(res.data);
  },

  async registerCertificateFile(org,certificateId,{path,file}){
    requireOrg(org);
    // Was doing a direct client-side INSERT into certificate_files, but the
    // canonical schema deliberately has NO client insert/update/delete
    // policy on that table -- file rows can only be registered through the
    // ct_register_certificate_file() RPC, which also validates the storage
    // path, retires the previous version, and updates the parent
    // certificate's denormalized file fields atomically. Fixed 2026-08-24.
    const res=await supabase.rpc('ct_register_certificate_file',{
      p_certificate:certificateId,
      p_storage_path:path,
      p_original_file_name:file.name||'certificate.pdf',
      p_mime_type:file.type||'application/pdf',
      p_file_size_bytes:file.size
    });
    if(res.error)throw res.error;
    return res.data;
  },

  async abortCertificateDraft(org,id){
    requireOrg(org);
    // Was a direct client-side DELETE, but the canonical schema grants no
    // client DELETE on certificates at all ("No client DELETE policy: UI
    // deletion is soft delete via UPDATE" -- see schema comment). Aborting
    // a still-fileless draft goes through ct_abort_certificate_draft().
    // Fixed 2026-08-24.
    const res=await supabase.rpc('ct_abort_certificate_draft',{p_certificate:id});
    if(res.error)throw res.error;
  },

  async deleteCertificate(org,id){
    requireOrg(org);
    // Was a direct client-side UPDATE setting deleted_at/deleted_by, but a
    // trigger explicitly blocks that for non-admins ("Use the certificate
    // delete function"). Soft-delete goes through ct_soft_delete_certificate().
    // Fixed 2026-08-24.
    const res=await supabase.rpc('ct_soft_delete_certificate',{p_certificate:id});
    if(res.error)throw res.error;
  },

  async findPartnerCandidate(value){
    const term=String(value||'').trim(); if(!term)return null;
    const res=await supabase.rpc('ct_find_partner_candidate',{p_lookup:term});
    if(res.error)throw res.error;
    const row=Array.isArray(res.data)?res.data[0]:res.data;
    return row?{...row,source:'organizations'}:null;
  },

  async requestPartner(org,lookup){
    requireOrg(org);
    // Was calling the RPC name 'ct_request_relationship' with a 'p_lookup'
    // parameter -- that function actually takes (p_requester_org, p_target_org),
    // not a lookup string, so every call failed with a "function not found"
    // error from PostgREST. The function that actually does VAT/email lookup
    // and creates both the relationship AND the invitation row (with
    // notifications) is ct_create_relationship_invitation. Fixed 2026-08-24.
    const res=await supabase.rpc('ct_create_relationship_invitation',{p_requester_org:org.id,p_lookup:String(lookup||'').trim()});
    if(res.error)throw res.error; return res.data;
  },

  async cancelRelationshipInvitation(org,relationshipId){
    requireOrg(org);
    const res=await supabase.rpc('ct_cancel_relationship',{p_relationship:relationshipId});
    if(res.error)throw res.error; return res.data;
  },

  async respondToRelationship(org,relationshipId,status){
    requireOrg(org);
    if(!['active','declined'].includes(status))throw new Error('Μη έγκυρη κατάσταση σχέσης.');
    const res=await supabase.rpc('ct_respond_relationship',{p_relationship:relationshipId,p_accept:status==='active'});
    if(res.error)throw res.error; return res.data;
  },

  async listSharedCertificates(partner){
    if(!partner?.id)return[];
    const res=await supabase.from('certificates').select(CERT_SELECT)
      .eq('organization_id',partner.id).eq('visibility','partners').is('deleted_at',null)
      .order('expiry_date',{ascending:true,nullsFirst:false});
    if(res.error)throw res.error;
    return (res.data||[]).map(canonicalCertificate);
  },

  async deleteRelationship(org,relationship){
    requireOrg(org); if(!relationship)return;
    const res=await supabase.rpc('ct_end_relationship',{p_relationship:relationship.id});
    if(res.error)throw res.error; return res.data;
  },

  async listPartners(org){
    requireOrg(org);
    // Was selecting requester_organization_id/partner_organization_id and
    // matching foreign-key embed names that don't exist -- the real columns
    // are requester_id/partner_id (see organization_relationships table),
    // so this query failed every time. Fixed 2026-08-24.
    const res=await supabase.from('organization_relationships')
      .select(`
        id,requester_id,partner_id,status,created_at,updated_at,
        requester:organizations!organization_relationships_requester_id_fkey(id,legal_name,display_name,vat_number,contact_email,status),
        partner_org:organizations!organization_relationships_partner_id_fkey(id,legal_name,display_name,vat_number,contact_email,status)
      `)
      .or(`requester_id.eq.${org.id},partner_id.eq.${org.id}`);
    if(res.error)throw res.error;
    return (res.data||[]).map(r=>{
      const outgoing=String(r.requester_id)===String(org.id);
      const raw=outgoing?r.partner_org:r.requester;
      return {...r,direction:outgoing?'outgoing':'incoming',partner:{...raw,name:raw?.display_name||raw?.legal_name||'',afm:raw?.vat_number||'',email:raw?.contact_email||'',source:'organizations'}};
    });
  }
};
