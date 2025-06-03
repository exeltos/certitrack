import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function handler() {
  try {
    const today = new Date();
    console.log('[DEBUG] Σήμερα:', today.toISOString());

    const { data: certs, error } = await supabase.from('supplier_certificates').select('*');
    if (error) throw error;

    console.log(`[DEBUG] Πλήθος πιστοποιητικών: ${certs.length}`);

    for (const cert of certs) {
      console.log('------------------------------');
      console.log('📄 Τίτλος:', cert.title);
      console.log('📅 Ημερομηνία string:', cert.date);
      console.log('🧪 typeof date:', typeof cert.date);

      const parsed = new Date(cert.date);
      console.log('✅ Date object:', parsed.toISOString());
    }

    return { statusCode: 200, body: '✅ Test Done. Check logs' };
  } catch (err) {
    console.error('[ERROR]', err);
    return { statusCode: 500, body: '❌ Σφάλμα: ' + err.message };
  }
}
