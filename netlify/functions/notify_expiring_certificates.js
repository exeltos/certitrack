import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

exports.handler = async function () {
  try {
    const today = new Date();
    const allCerts = await supabase.from('supplier_certificates').select('*');
    if (allCerts.error) throw allCerts.error;

    const grouped = {};
    for (const cert of allCerts.data) {
      const expDate = new Date(cert.date);
      const daysLeft = Math.ceil((expDate - today) / (1000 * 60 * 60 * 24));
      const status = daysLeft < 0 ? 'expired' : daysLeft <= 30 ? 'soon' : null;

      if (!status) continue;

      if (!grouped[cert.supplier_afm]) grouped[cert.supplier_afm] = { expired: [], soon: [] };
      grouped[cert.supplier_afm][status].push(cert);
    }

    console.log('[DEBUG] Grouped suppliers:', grouped);

    for (const afm of Object.keys(grouped)) {
      const { data: supplier, error } = await supabase.from('suppliers').select('id, email').eq('afm', afm).maybeSingle();
      if (error || !supplier?.email) {
        console.warn(`[SKIP] No supplier for AFM ${afm}`);
        continue;
      }

      console.log(`[PROCESSING] Supplier: ${supplier.email} | AFM: ${afm}`);

      const notifications = await supabase.from('supplier_notifications')
        .select('type')
        .eq('supplier_id', supplier.id);

      const sentTypes = notifications.data?.map(n => n.type) || [];

      const send = async (type, certList) => {
        if (certList.length === 0 || sentTypes.includes(type)) {
          console.log(`[SKIP] Already notified: ${supplier.email} [${type}]`);
          return;
        }

        const subject = type === 'expired'
          ? 'Έχετε ληγμένα πιστοποιητικά'
          : 'Πιστοποιητικά προς λήξη σε 30 ημέρες';

        const message = `${subject}:
` + certList.map(c => `• ${c.title} - Λήγει: ${c.date}`).join('\n');

        console.log(`[SENDING] To: ${supplier.email} | Subject: ${subject}`);

        const { error: mailError } = await supabase.functions.invoke('send-email', {
          body: {
            to: supplier.email,
            subject,
            message
          }
        });

        if (mailError) {
          console.error(`[MAIL ERROR] ${supplier.email}:`, mailError.message);
          return;
        }

        console.log(`[NOTIFIED] ${supplier.email} | Type: ${type}`);

        await supabase.from('supplier_notifications').insert({
          supplier_id: supplier.id,
          type,
          sent_at: new Date().toISOString()
        });
      };

      await send('expired', grouped[afm].expired);
      await send('soon', grouped[afm].soon);
    }

    return { statusCode: 200, body: 'Notifications sent.' };
  } catch (err) {
    console.error('[CertiTrack] Σφάλμα ειδοποίησης:', err);
    return { statusCode: 500, body: 'Internal Server Error' };
  }
};
