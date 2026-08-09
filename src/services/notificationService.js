import { supabase } from './supabaseClient.js';

export const notificationService = {
  supplier: () => supabase.from('supplier_notifications'),
  company: () => supabase.from('company_notifications')
};
