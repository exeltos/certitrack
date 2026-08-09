import { supabase } from './supabaseClient.js';

export const relationshipService = {
  table: () => supabase.from('company_suppliers'),

  async listForCompany(companyId, columns = '*') {
    return supabase.from('company_suppliers').select(columns).eq('company_id', companyId);
  },

  async listForSupplier(supplierId, columns = '*') {
    return supabase.from('company_suppliers').select(columns).eq('supplier_id', supplierId);
  },

  async updateAccess(companyId, supplierId, access) {
    return supabase.from('company_suppliers').update({ access }).eq('company_id', companyId).eq('supplier_id', supplierId);
  }
};
