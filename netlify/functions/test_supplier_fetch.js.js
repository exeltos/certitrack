import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function handler(event) {
  try {
    const { data, error } = await supabase.from('supplier_certificates').select('*').limit(10);
    if (error) throw error;

    console.log('[TEST] Δεδομένα:', data);

    return {
      statusCode: 200,
      body: JSON.stringify({ count: data.length, first: data[0] })
    };
  } catch (err) {
    console.error('[TEST] Σφάλμα:', err);
    return {
      statusCode: 500,
      body: '❌ Σφάλμα: ' + err.message
    };
  }
}
