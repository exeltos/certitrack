import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function handler() {
  try {
    const { data, error } = await supabase.from('supplier_certificates').select('*').limit(5);

    console.log('[TEST] error:', error);
    console.log('[TEST] count:', data?.length);
    console.log('[ENV] KEY START:', process.env.SUPABASE_SERVICE_ROLE_KEY?.slice(0, 5));

    return {
      statusCode: 200,
      body: JSON.stringify({ count: data?.length, key: process.env.SUPABASE_SERVICE_ROLE_KEY?.slice(0, 5) })
    };
  } catch (err) {
    console.error('[❌ ERROR]', err);
    return {
      statusCode: 500,
      body: '❌ Σφάλμα: ' + err.message
    };
  }
}
