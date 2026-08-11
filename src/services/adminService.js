import { supabase } from './supabaseClient.js';
export const adminService={
  listOrganizations:()=>supabase.from('organizations').select('*').order('created_at',{ascending:false}),
  listRelationships:()=>supabase.from('organization_relationships').select('*').order('created_at',{ascending:false}),
  listCertificates:()=>supabase.from('certificates').select('*').is('deleted_at',null).order('created_at',{ascending:false}),
  audit:()=>supabase.from('audit_log')
};
