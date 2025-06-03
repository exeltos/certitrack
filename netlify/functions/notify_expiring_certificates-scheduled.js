import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function handler(event) {
  console.log('--- CertiTrack DEBUG: ΕΝΑΡΞΗ ---');
  try {
    const today = new Date();
    console.log('[DEBUG] Σήμερα:', today.toISOString());

    const { data: certs, error } = await supabase.from('supplier_certificates').select('*');
    if (error) throw error;

    console.log(`[DEBUG] Βρέθηκαν συνολικά πιστοποιητικά: ${certs.length}`);

    const grouped = {};

    for (const cert of certs) {
      console.log('\n------------------------------');
      console.log(`[DEBUG] Πιστοποιητικό:`, {
        title: cert.title,
        date: cert.date,
        afm: cert.supplier_afm
      });

      if (!cert.date || !cert.supplier_afm || typeof cert.supplier_afm !== 'string' || cert.supplier_afm.trim() === '') {
        console.warn('[SKIP] Λείπει ημερομηνία ή ΑΦΜ');
        continue;
      }

      const exp = new Date(cert.date);
      if (isNaN(exp)) {
        console.warn('[SKIP] Άκυρη ημερομηνία:', cert.date);
        continue;
      }

      const days = Math.ceil((exp - today) / (1000 * 60 * 60 * 24));
      console.log(`[DEBUG] Υπολειπόμενες ημέρες: ${days}`);

      const status = days < 0 ? 'expired' : days <= 30 ? 'soon' : null;
      if (!status) {
        console.log('[SKIP] Δεν είναι ούτε ληγμένο ούτε προς λήξη');
        continue;
      }

      if (!grouped[cert.supplier_afm]) grouped[cert.supplier_afm] = { expired: [], soon: [] };
      grouped[cert.supplier_afm][status].push(cert);
      console.log(`[DEBUG] Καταχωρήθηκε ως '${status}'`);
    }

    console.log('\n✅ ΤΕΛΙΚΟ GROUPED:', grouped);
    console.log('--- CertiTrack DEBUG: ΤΕΛΟΣ ---');

    return { statusCode: 200, body: '✅ Debug completed. Check logs.' };
  } catch (err) {
    console.error('[CertiTrack] Σφάλμα DEBUG:', err);
    return { statusCode: 500, body: '❌ Σφάλμα: ' + err.message };
  }
}
