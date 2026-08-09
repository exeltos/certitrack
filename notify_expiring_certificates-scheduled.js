const fetch = require('node-fetch');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const DAY = 24 * 60 * 60 * 1000;
const REMINDER_DAYS = new Set([30, 15, 7, 1, 0]);

function daysUntil(dateValue) {
  if (!dateValue) return null;
  const target = new Date(dateValue);
  if (Number.isNaN(target.getTime())) return null;
  const now = new Date();
  const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const targetUtc = Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), target.getUTCDate());
  return Math.round((targetUtc - todayUtc) / DAY);
}

async function sendEmail(email, certificates, subject) {
  if (!email || !process.env.MAILERSEND_TOKEN) return false;
  const html = `<p>Σας ενημερώνουμε ότι τα παρακάτω πιστοποιητικά λήγουν σύντομα ή έχουν λήξει:</p><ul>${certificates.map(c => `<li><strong>${String(c.title || '—').replace(/[<>&]/g, '')}</strong> — ${String(c.date || '—').replace(/[<>&]/g, '')}</li>`).join('')}</ul>`;
  const response = await fetch('https://api.mailersend.com/v1/email', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.MAILERSEND_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: { email: 'noreply@certitrack.gr', name: 'CertiTrack' }, to: [{ email }], subject, html })
  });
  if (!response.ok) console.error('MailerSend expiry notification failed:', response.status);
  return response.ok;
}

exports.handler = async () => {
  try {
    const [{ data: companies, error: ce }, { data: supplierCerts, error: se }, { data: companyCerts, error: cce }] = await Promise.all([
      supabase.from('companies').select('id, user_id, email'),
      supabase.from('supplier_certificates').select('id, supplier_user_id, title, date'),
      supabase.from('company_certificates').select('id, company_user_id, title, date')
    ]);
    if (ce || se || cce) throw ce || se || cce;

    const { data: suppliers, error: suppliersError } = await supabase.from('suppliers').select('id, user_id');
    if (suppliersError) throw suppliersError;
    const supplierUserById = new Map((suppliers || []).map(s => [s.id, s.user_id]));

    let sent = 0;
    for (const company of companies || []) {
      if (!company.email) continue;
      const { data: relations, error: re } = await supabase.from('company_suppliers').select('supplier_id').eq('company_id', company.id).eq('access', 'granted');
      if (re) continue;
      const supplierUserIds = new Set((relations || []).map(r => supplierUserById.get(r.supplier_id)).filter(Boolean));
      const due = (supplierCerts || []).filter(c => supplierUserIds.has(c.supplier_user_id) && REMINDER_DAYS.has(daysUntil(c.date)));
      if (due.length && await sendEmail(company.email, due, '📄 CertiTrack — Λήξεις πιστοποιητικών προμηθευτών')) sent++;
    }

    // Company-owned certificates: notify the owning company where the relation is explicit.
    for (const company of companies || []) {
      if (!company.email) continue;
      const due = (companyCerts || []).filter(c => c.company_user_id === company.user_id && REMINDER_DAYS.has(daysUntil(c.date)));
      if (due.length && await sendEmail(company.email, due, '📄 CertiTrack — Λήξεις εταιρικών πιστοποιητικών')) sent++;
    }

    return { statusCode: 200, body: JSON.stringify({ success: true, notificationsSent: sent }) };
  } catch (error) {
    console.error('Scheduled certificate notification failed:', error.message);
    return { statusCode: 500, body: JSON.stringify({ success: false, error: 'Scheduled notification failed' }) };
  }
};
