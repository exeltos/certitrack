import { supabase } from './supabaseClient.js';

const TYPE_CODE_BY_LABEL = new Map([
  ['ISO 9001','ISO9001'],['ISO 13485','ISO13485'],['ISO 14001','ISO14001'],
  ['ISO 27001','ISO27001'],['ISO 45001','ISO45001'],['CE','CE'],
  ['Πιστοποιητικό CE','CE'],['Άδεια λειτουργίας','OPERATING_LICENSE'],
  ['Άδεια Λειτουργίας','OPERATING_LICENSE']
]);

function canonicalCertificate(row={}) {
  const typeName=row.custom_type_label||row.certificate_type?.name_el||row.certificate_type?.name_en||'Πιστοποιητικό';
  return {
    ...row,
    type:typeName,
    date:row.expiry_date||null,
    file_url:row.current_file?.storage_path||row.storage_path||'',
    name:row.current_file?.original_file_name||row.original_file_name||'certificate.pdf',
    is_private:row.visibility==='private',
    file_size_bytes:row.current_file?.file_size_bytes||row.file_size_bytes||null,
    mime_type:row.current_file?.mime_type||row.mime_type||'application/pdf'
  };
}
async function resolveCertificateType(label) {
  const value=String(label||'').trim();
  const code=TYPE_CODE_BY_LABEL.get(value)||'OTHER';
  const {data,error}=await supabase.from('certificate_types').select('id,code').eq('code',code).maybeSingle();
  if(error)throw error;
  return {id:data?.id||null,customLabel:code==='OTHER'?(value||'Άλλο'):null};
}
function certificatePayload(record={}) {
  return {
    title:record.title,
    certificate_number:record.certificate_number||null,
    issuer:record.issuer||null,
    issue_date:record.issue_date||null,
    expiry_date:record.date||record.expiry_date||null,
    notes:record.notes||null,
    visibility:record.is_private===true||record.visibility==='private'?'private':'partners'
  };
}
function requireOrg(org){
  if(!org?.id||org.source!=='organizations')throw new Error('Δεν βρέθηκε ενεργός οργανισμός.');
}

export const organizationService={
  async isModernModelAvailable(){
    const res=await supabase.rpc('organization_model_version');
    return !res.error&&String(res.data)==='39';
  },

  async getByUserId(userId){
    const {data,error}=await supabase.from('organization_members')
      .select('role,status,organization:organizations(*)')
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

  async requestClosure(org,reason=''){
    requireOrg(org);
    const res=await supabase.rpc('ct_request_organization_closure',{p_org:org.id,p_reason:reason||null});
    if(res.error)throw res.error;return res.data;
  },

  async cancelClosure(org){
    requireOrg(org);
    const res=await supabase.rpc('ct_cancel_organization_closure',{p_org:org.id});
    if(res.error)throw res.error;return res.data;
  },

  async listOwnCertificates(org){
    requireOrg(org);
    const res=await supabase.from('certificates')
      .select('*,certificate_type:certificate_types(code,name_el,name_en),current_file:certificate_files!current_file_id(storage_path,original_file_name,mime_type,file_size_bytes,version_no)')
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
    const payload={...certificatePayload(record),organization_id:org.id,certificate_type_id:type.id,custom_type_label:type.customLabel,created_by:user.id,updated_by:user.id};
    const res=await supabase.from('certificates').insert([payload]).select('*').single();
    if(res.error)throw res.error;
    return canonicalCertificate(res.data);
  },

  async updateCertificate(org,id,updates){
    requireOrg(org);
    const payload=certificatePayload(updates);
    if('type' in updates){
      const type=await resolveCertificateType(updates.type);
      payload.certificate_type_id=type.id;payload.custom_type_label=type.customLabel;
    }
    payload.updated_by=(await supabase.auth.getUser()).data?.user?.id||null;
    const res=await supabase.from('certificates').update(payload).eq('id',id).select('*').single();
    if(res.error)throw res.error;
    return canonicalCertificate(res.data);
  },

  async registerCertificateFile(org,certificateId,{path,file}){
    requireOrg(org);
    const res=await supabase.rpc('ct_register_certificate_file',{
      p_certificate:certificateId,p_storage_path:path,p_original_file_name:file.name||'certificate.pdf',
      p_mime_type:file.type||'application/pdf',p_file_size_bytes:file.size
    });
    if(res.error)throw res.error;return res.data;
  },

  async abortCertificateDraft(org,id){
    requireOrg(org);
    const res=await supabase.rpc('ct_abort_certificate_draft',{p_certificate:id});
    if(res.error)throw res.error;
  },

  async deleteCertificate(org,id){
    requireOrg(org);
    const res=await supabase.rpc('ct_soft_delete_certificate',{p_certificate:id});
    if(res.error)throw res.error;
  },

  async findPartnerCandidate(value){
    const term=String(value||'').trim();if(!term)return null;
    const res=await supabase.rpc('find_organization_partner',{search_value:term});
    if(res.error)throw res.error;
    return res.data?.length?{...res.data[0],source:'organizations'}:null;
  },

  async requestPartner(org,lookup){
    requireOrg(org);
    const term=typeof lookup==='string'?lookup:(lookup?.email||lookup?.afm||'');
    const res=await supabase.rpc('ct_create_relationship_invitation',{p_requester_org:org.id,p_lookup:String(term).trim()});
    if(res.error)throw res.error;return res.data;
  },

  async cancelRelationshipInvitation(org,invitationId){
    requireOrg(org);
    const res=await supabase.rpc('ct_cancel_relationship_invitation',{p_invitation:invitationId});
    if(res.error)throw res.error;
  },

  async respondToRelationship(org,relationshipId,status){
    requireOrg(org);
    if(!['active','declined'].includes(status))throw new Error('Μη έγκυρη κατάσταση σχέσης.');
    const res=await supabase.rpc('ct_respond_relationship',{p_relationship:relationshipId,p_accept:status==='active'});
    if(res.error)throw res.error;return res.data;
  },

  async listSharedCertificates(partner){
    if(!partner?.id)return[];
    const res=await supabase.from('certificates')
      .select('*,certificate_type:certificate_types(code,name_el,name_en),current_file:certificate_files!current_file_id(storage_path,original_file_name,mime_type,file_size_bytes,version_no)')
      .eq('organization_id',partner.id).eq('visibility','partners').is('deleted_at',null)
      .order('expiry_date',{ascending:true,nullsFirst:false});
    if(res.error)throw res.error;
    return (res.data||[]).map(canonicalCertificate);
  },

  async deleteRelationship(org,relationship){
    requireOrg(org);if(!relationship)return;
    const res=await supabase.rpc('ct_end_relationship',{p_relationship:relationship.id,p_reason:null});
    if(res.error)throw res.error;return res.data;
  },

  async listPartners(org){
    requireOrg(org);
    const res=await supabase.from('organization_relationships')
      .select('id,requester_id,partner_id,status,relationship_type,created_at,accepted_at,ended_at,requester:organizations!organization_relationships_requester_id_fkey(id,legal_name,display_name,vat_number,contact_email,status),partner_org:organizations!organization_relationships_partner_id_fkey(id,legal_name,display_name,vat_number,contact_email,status)')
      .or(`requester_id.eq.${org.id},partner_id.eq.${org.id}`);
    if(res.error)throw res.error;
    return (res.data||[]).map(r=>{
      const raw=String(r.requester_id)===String(org.id)?r.partner_org:r.requester;
      return {...r,direction:String(r.requester_id)===String(org.id)?'outgoing':'incoming',
        partner:{...raw,name:raw?.display_name||raw?.legal_name||'',afm:raw?.vat_number||'',email:raw?.contact_email||'',source:'organizations'}};
    });
  }
};
