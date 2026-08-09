const fetch = require('node-fetch');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const DAY = 24 * 60 * 60 * 1000;
const REMINDER_DAYS = new Set([30, 15, 7, 1, 0]);

function subscriptionExpiry(timestamp) {
  if (!timestamp) return null;
  const signup = new Date(timestamp);
  if (Number.isNaN(signup.getTime())) return null;
  const grace = new Date(signup);
  grace.setDate(grace.getDate() + 7);
  const expiry = new Date(grace);
  expiry.setFullYear(expiry.getFullYear() + 1);
  return expiry;
}
function daysUntil(date) {
  if (!date) return null;
  return Math.ceil((date.getTime() - Date.now()) / DAY);
}
async function notify(user, expiry) {
  if (!user.email || !process.env.MAILERSEND_TOKEN) return false;
  const date = expiry.toLocaleDateString('el-GR', { timeZone: 'Europe/Athens' });
  const response = await fetch('https://api.mailersend.com/v1/email', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.MAILERSEND_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: { email: 'noreply@certitrack.gr', name: 'CertiTrack' },
      to: [{ email: user.email }],
      subject: '⏳ CertiTrack — Υπενθύμιση λήξης συνδρομής',
      html: `<p>Η συνδρομή σας στο CertiTrack λήγει στις <strong>${date}</strong>.</p><p>Παρακαλούμε φροντίστε για την έγκαιρη ανανέωσή της.</p>`
    })
  });
  return response.ok;
}
exports.handler = async () => {
  try {
    const [{ data: companies, error: ce }, { data: suppliers, error: se }] = await Promise.all([
      supabase.from('companies').select('id, email, timestamp, blocked'),
      supabase.from('suppliers').select('id, email, timestamp, blocked')
    ]);
    if (ce || se) throw ce || se;
    let sent = 0;
    for (const user of [...(companies || []), ...(suppliers || [])]) {
      if (user.blocked) continue;
      const expiry = subscriptionExpiry(user.timestamp);
      if (REMINDER_DAYS.has(daysUntil(expiry)) && await notify(user, expiry)) sent++;
    }
    return { statusCode: 200, body: JSON.stringify({ success: true, notificationsSent: sent }) };
  } catch (error) {
    console.error('Scheduled subscription notification failed:', error.message);
    return { statusCode: 500, body: JSON.stringify({ success: false, error: 'Scheduled subscription notification failed' }) };
  }
};
