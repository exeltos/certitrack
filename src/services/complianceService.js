import { supabase } from './supabaseClient.js';

export const complianceService = {
  certificateTypes: () => supabase.from('certificate_types'),
  profiles: () => supabase.from('requirement_profiles'),
  profileItems: () => supabase.from('requirement_profile_items'),
  supplierRequirements: () => supabase.from('company_supplier_requirements'),
  audit: () => supabase.from('audit_log'),

  async listCertificateTypes() {
    return supabase.from('certificate_types').select('*').eq('active', true).order('name');
  },

  async listProfiles(companyId) {
    return supabase.from('requirement_profiles').select('*').eq('company_id', companyId).eq('active', true).order('name');
  },

  async listProfileItems(profileIds) {
    if (!profileIds?.length) return { data: [], error: null };
    return supabase.from('requirement_profile_items').select('id,profile_id,certificate_type_id,required').in('profile_id', profileIds);
  },

  async listSupplierRequirements(companyId) {
    return supabase.from('company_supplier_requirements')
      .select('id,company_id,supplier_id,profile_id,certificate_type_id,required')
      .eq('company_id', companyId);
  },

  async createProfile(companyId, name, description = '') {
    return supabase.from('requirement_profiles').insert([{ company_id: companyId, name, description, active: true }]).select('*').single();
  },

  async replaceProfileItems(profileId, certificateTypeIds = []) {
    const del = await supabase.from('requirement_profile_items').delete().eq('profile_id', profileId);
    if (del.error) return del;
    if (!certificateTypeIds.length) return { data: [], error: null };
    return supabase.from('requirement_profile_items').insert(certificateTypeIds.map(certificate_type_id => ({ profile_id: profileId, certificate_type_id, required: true })));
  },

  async assignProfile(companyId, supplierId, profileId, certificateTypeIds = []) {
    const del = await supabase.from('company_supplier_requirements').delete().eq('company_id', companyId).eq('supplier_id', supplierId);
    if (del.error) return del;
    if (!certificateTypeIds.length) return { data: [], error: null };
    return supabase.from('company_supplier_requirements').insert(certificateTypeIds.map(certificate_type_id => ({
      company_id: companyId, supplier_id: supplierId, profile_id: profileId || null, certificate_type_id, required: true
    })));
  }
};
