import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function handler() {
  try {
    const { data, error } = await supabase.from('supplier_certificates').select('*').limit(5);

    console.log('[TEST] error:', error);
    console.log('[TEST] data:', data);
    console.log('[TEST] count:', data?.length);
    if (Array.isArray(data)) {
      data.forEach(c => {
        console.log('📄 Τίτλος:', c.title);
        console.log('📅 Ημερομηνία:', c.date);
        console.log('🔢 AFM:', c.supplier_afm);
      });
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        count: data?.length || 0
      })
    };
  } catch (err) {
    console.error('[❌ ERROR]', err);
    return {
      statusCode: 500,
      body: '❌ Σφάλμα: ' + err.message
    };
  }
}
