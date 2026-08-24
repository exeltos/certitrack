// Phase 3 tenant helpers. Keeps organization IDs separate from auth user IDs.
import { supabase } from '../services/supabaseClient.js';

export async function getCurrentCompany(userId) {
  const { data, error } = await supabase.from('companies')
    .select('id, user_id, name, afm, email, blocked')
    .eq('user_id', userId).maybeSingle();
  if (error) throw error;
  return data;
}

export async function getCurrentSupplier(userId) {
  const { data, error } = await supabase.from('suppliers')
    .select('id, user_id, name, afm, email, status, blocked')
    .eq('user_id', userId).maybeSingle();
  if (error) throw error;
  return data;
}

export function relationshipIsGranted(relation) {
  return (relation?.access || 'granted') !== 'blocked';
}
