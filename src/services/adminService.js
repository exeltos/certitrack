import { supabase } from './supabaseClient.js';

export const adminService = {
  companies: () => supabase.from('companies'),
  suppliers: () => supabase.from('suppliers'),
  companyCertificates: () => supabase.from('company_certificates'),
  supplierCertificates: () => supabase.from('supplier_certificates'),
  relationships: () => supabase.from('company_suppliers'),
  audit: () => supabase.from('audit_log')
};
