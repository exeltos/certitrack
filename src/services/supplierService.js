import { supabase } from './supabaseClient.js';

export const supplierService = {
  table: () => supabase.from('suppliers'),
  certificates: () => supabase.from('supplier_certificates'),
  notifications: () => supabase.from('supplier_notifications'),

  async getByUserId(userId, columns = '*') {
    return supabase.from('suppliers').select(columns).eq('user_id', userId).maybeSingle();
  },

  async getById(id, columns = '*') {
    return supabase.from('suppliers').select(columns).eq('id', id).maybeSingle();
  },

  async listCertificatesByUser(userId, columns = '*') {
    return supabase.from('supplier_certificates').select(columns).eq('supplier_user_id', userId).order('date', { ascending: false });
  },

  async listCertificatesBySupplierId(supplierId, columns = '*') {
    return supabase.from('supplier_certificates').select(columns).eq('supplier_id', supplierId).order('date', { ascending: false });
  }
};
