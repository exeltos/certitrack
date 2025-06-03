import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function handler() {
  console.log('----- CertiTrack DEBUG -----');
  try {
    const today = new Date();
    console.log('[ΣΗΜΕΡΑ]', today.toISOString());

    const { data: certs, error } = await supabase.from('supplier_certificates').select('*');
    if (error) throw error;

    console.log('[ΠΙΣΤΟΠΟΙΗΤΙΚΑ]', `Σύνολο: ${certs.length}`);

    const grouped = {};

    for (const cert of certs) {
      console.log('\n🔍 --- ΕΛΕΓΧΟΣ ΠΙΣΤΟΠΟΙΗΤΙΚΟΥ ---');
      console.log('Τίτλος:', cert.title);
      console.log('Ημερομηνία (raw):', cert.date);
      console.log('AFM:', cert.supplier_afm);

      if (!cert.date || !cert.supplier_afm || typeof cert.supplier_afm !== 'string' || cert.supplier_afm.trim() === '') {
        console.log('⛔ Παραλείπεται: άδεια ημερομηνία ή ΑΦΜ');
        continue;
      }

      const expDate = new Date(cert.date);
      if (isNaN(expDate)) {
        console.log('⛔ Άκυρη ημερομηνία:', cert.date);
        continue;
      }

      const daysLeft = Math.ceil((expDate - today) / (1000 * 60 * 60 * 24));
      console.log('✅ Ημερομηνία λήξης:', expDate.toISOString());
      console.log('📅 Υπολειπόμενες ημέρες:', daysLeft);

      const status = daysLeft < 0 ? 'expired' : daysLeft <= 30 ? 'soon' : null;
      if (!status) {
        console.log('ℹ️ Δεν είναι ληγμένο ή προς λήξη');
        continue;
      }

      if (!grouped[cert.supplier_afm]) grouped[cert.supplier_afm] = { expired: [], soon: [] };
      grouped[cert.supplier_afm][status].push(cert);
      console.log(`📦 Κατηγοριοποιήθηκε ως: ${status}`);
    }

    console.log('\n✅ ΤΕΛΙΚΟ ΑΠΟΤΕΛΕΣΜΑ:', grouped);
    return {
      statusCode: 200,
      body: '✅ Done (logs printed)'
    };
  } catch (err) {
    console.error('[❌ ERROR]', err);
    return {
      statusCode: 500,
      body: '❌ Σφάλμα: ' + err.message
    };
  }
}
