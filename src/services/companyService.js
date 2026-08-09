import { supabase } from './supabaseClient.js';

export const companyService = {
  table: () => supabase.from('companies'),
  certificates: () => supabase.from('company_certificates'),
  notifications: () => supabase.from('company_notifications'),

  async getByUserId(userId, columns = '*') {
    return supabase.from('companies').select(columns).eq('user_id', userId).maybeSingle();
  },

  async getByEmail(email, columns = '*') {
    return supabase.from('companies').select(columns).eq('email', email).maybeSingle();
  },

  async listCertificatesByUser(userId, columns = '*') {
    return supabase.from('company_certificates').select(columns).eq('company_user_id', userId).order('date', { ascending: false });
  }
};
