import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function handler() {
  try {
    const { data, error } = await supabase.from('supplier_certificates').select('*');

    console.log('[CHECK] error:', error);
    console.log('[CHECK] data is array?', Array.isArray(data));
    console.log('[CHECK] data:', data);

    return {
      statusCode: 200,
      body: JSON.stringify({
        length: data?.length || 0,
        isArray: Array.isArray(data),
        raw: data
      })
    };
  } catch (err) {
    console.error('[ERROR]', err);
    return {
      statusCode: 500,
      body: '❌ Σφάλμα: ' + err.message
    };
  }
}
