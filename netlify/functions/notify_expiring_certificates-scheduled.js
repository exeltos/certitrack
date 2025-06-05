import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const MAILERSEND_API_KEY = process.env.MAILERSEND_TOKEN;

async function sendEmail(to, subject, html) {
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
  return response;
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
      if (!cert.date || !cert.supplier_afm) continue;
      const expDate = new Date(cert.date);
      if (isNaN(expDate)) continue;

      const daysLeft = Math.ceil((expDate - today) / (1000 * 60 * 60 * 24));
      const status = daysLeft < 0 ? 'expired' : daysLeft <= 30 ? 'soon' : null;
      if (!status) continue;

      if (!grouped[cert.supplier_afm]) grouped[cert.supplier_afm] = { expired: [], soon: [] };
      grouped[cert.supplier_afm][status].push(cert);
    }

    for (const afm of Object.keys(grouped)) {
      const { data: supplier, error } = await supabase
        .from('suppliers')
        .select('id, email')
        .eq('afm', afm)
        .maybeSingle();
      if (error || !supplier?.email) continue;

      const notifications = await supabase
        .from('supplier_notifications')
        .select('type')
        .eq('supplier_id', supplier.id);

      const sentTypes = notifications.data?.map(n => n.type) || [];

      const send = async (type, certList) => {
        if (certList.length === 0 || sentTypes.includes(type)) return;

        const subject = type === 'expired'
          ? 'Έχετε ληγμένα πιστοποιητικά'
          : 'Πιστοποιητικά προς λήξη σε 30 ημέρες';

        const message = `${subject}:
` + certList.map(c => `• ${c.title} - Λήγει: ${c.date}`).join('\n');

        const res = await sendEmail(
          supplier.email,
          subject,
          `<p>${message.replace(/\n/g, '<br>')}</p>`
        );

        if (res.ok) {
          await supabase.from('supplier_notifications').insert({
            supplier_id: supplier.id,
            type,
            sent_at: new Date().toISOString()
          });
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
