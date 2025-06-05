import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const MAILERSEND_API_KEY = process.env.MAILERSEND_TOKEN;

async function sendEmail(to, subject, html) {
  try {
    const response = await fetch('https://api.mailersend.com/v1/email', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${MAILERSEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: { email: 'info@certitrack.gr', name: 'CertiTrack' },
        to: [{ email: to }],
        subject,
        html
      })
    });
    console.log(`[MAILERSEND RESPONSE] Status: ${response.status}`);
    return response;
  } catch (err) {
    console.error('[SEND_EMAIL FUNCTION ERROR]', err);
    throw err;
  }
}

exports.handler = async function (event) {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      }
    };
  }

  try {
    const today = new Date();
    const allCerts = await supabase.from('supplier_certificates').select('*');
    if (allCerts.error) throw allCerts.error;

    const grouped = {};
    for (const cert of allCerts.data) {
      console.log('[RAW CERT]', cert);
      const rawDate = cert.date;
      const expDate = new Date(rawDate);
      const isValid = !isNaN(expDate);
      const parsedDateStr = isValid ? expDate.toISOString() : 'Invalid Date';
      console.log('[DEBUG] Checking cert:', {
        title: cert.title,
        date: rawDate,
        parsedDate: parsedDateStr,
        isValid
      });
      // ήδη ορίστηκε παραπάνω η expDate
      if (!cert.date || isNaN(expDate)) {
        console.warn(`[SKIP CERT] Invalid date for cert:`, cert);
        continue;
      }
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
        console.warn(`[SKIP] No supplier for AFM: ${afm}`);
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

        const message = `${subject}:\n` + certList.map(c => `• ${c.title} - Λήγει: ${c.date}`).join('\n');

        console.log(`[SENDING] To: ${supplier.email} | Subject: ${subject}`);

        try {
          const res = await sendEmail(supplier.email, subject, `<p>${message.replace(/\n/g, '<br>')}</p>`);

          if (!res.ok) {
            const errText = await res.text();
            console.error(`[MAIL ERROR ${res.status}] ${supplier.email}: ${errText}`);
            return;
          }

          console.log(`[NOTIFIED] ${supplier.email} | Type: ${type}`);

          await supabase.from('supplier_notifications').insert({
            supplier_id: supplier.id,
            type,
            sent_at: new Date().toISOString()
          });
        } catch (mailErr) {
          console.error(`[MAIL EXCEPTION] ${supplier.email}:`, mailErr);
        }
      };

      await send('expired', grouped[afm].expired);
      await send('soon', grouped[afm].soon);
    }

    return {
      statusCode: 200,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: 'Notifications sent.'
    };
  } catch (err) {
    console.error('[CertiTrack] Σφάλμα ειδοποίησης:', err);
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: 'Internal Server Error'
    };
  }
};
