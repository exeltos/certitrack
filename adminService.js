import { supabase } from './supabaseClient.js';
export const adminService={
  listOrganizations:()=>supabase.from('organizations').select('*').order('created_at',{ascending:false}),
  listRelationships:()=>supabase.from('organization_relationships').select('*').order('created_at',{ascending:false}),
  listCertificates:()=>supabase.from('certificates').select('*').is('deleted_at',null).order('created_at',{ascending:false}),
  setOrganizationState:(id,state,reason='')=>supabase.rpc('ct_platform_set_organization_state',{p_org:id,p_state:state,p_reason:reason||null}),
  audit:()=>supabase.from('audit_log')
};
