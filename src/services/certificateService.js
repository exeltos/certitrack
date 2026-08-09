import { supabase } from './supabaseClient.js';

export const certificateService = {
  supplier: () => supabase.from('supplier_certificates'),
  company: () => supabase.from('company_certificates'),

  insertSupplier: record => supabase.from('supplier_certificates').insert([record]),
  updateSupplier: (id, updates) => supabase.from('supplier_certificates').update(updates).eq('id', id),
  deleteSupplier: id => supabase.from('supplier_certificates').delete().eq('id', id),
  getSupplier: id => supabase.from('supplier_certificates').select('*').eq('id', id).maybeSingle(),

  insertCompany: record => supabase.from('company_certificates').insert([record]),
  updateCompany: (id, updates) => supabase.from('company_certificates').update(updates).eq('id', id),
  deleteCompany: id => supabase.from('company_certificates').delete().eq('id', id),
  getCompany: id => supabase.from('company_certificates').select('*').eq('id', id).maybeSingle()
};
