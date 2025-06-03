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

    console.log(`[DEBUG] Βρέθηκαν: ${certs.length} πιστοποιητικά.`);

    const grouped = {};

    for (const cert of certs) {
      if (!cert?.date || !cert?.supplier_afm) {
        console.warn('[SKIP] Άκυρη εγγραφή:', cert);
        continue;
      }

      const expDate = new Date(cert.date);
      const daysLeft = Math.ceil((expDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

      console.log(`[CHECK] ${cert.title} | ${cert.date} | ${daysLeft} ημέρες`);

      const status = daysLeft < 0 ? 'expired' : daysLeft <= 30 ? 'soon' : null;
      if (!status) continue;

      if (!grouped[cert.supplier_afm]) grouped[cert.supplier_afm] = { expired: [], soon: [] };
      grouped[cert.supplier_afm][status].push(cert);
    }

    console.log('[DEBUG] Grouped suppliers:', grouped);

    return { statusCode: 200, body: '✅ Done. Check logs.' };
  } catch (err) {
    console.error('[ERROR]', err);
    return { statusCode: 500, body: '❌ Σφάλμα: ' + err.message };
  }
}
