import { supabase } from '../supabaseClient.js';

export async function callAuthenticatedFunction(functionName, payload = {}) {
  const { data, error } = await supabase.auth.getSession();
  const session = data?.session;
  if (error || !session?.access_token) {
    throw new Error('Δεν βρέθηκε ενεργή συνεδρία.');
  }

  const response = await fetch(`/.netlify/functions/${functionName}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(detail || `Αποτυχία κλήσης ${functionName}`);
  }

  const contentType = response.headers.get('content-type') || '';
  return contentType.includes('application/json') ? response.json() : response.text();
}
