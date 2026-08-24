import { supabase } from './supabaseClient.js';

const REST_BASE = 'https://klutmusrabsizqjnzwpu.supabase.co/rest/v1';

async function lookupEmail(table, afm) {
  const response = await fetch(`${REST_BASE}/${table}?select=email&afm=eq.${encodeURIComponent(afm)}`, {
    headers: {
      apikey: supabase.supabaseKey,
      Authorization: `Bearer ${supabase.supabaseKey}`
    }
  });
  if (!response.ok) throw new Error('Αποτυχία αναζήτησης λογαριασμού.');
  const rows = await response.json();
  return rows?.[0]?.email || null;
}

export async function findAccountEmailByAfm(afm) {
  return (await lookupEmail('companies', afm)) || (await lookupEmail('suppliers', afm));
}
