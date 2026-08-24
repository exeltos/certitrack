const fetch = require('node-fetch');
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');

const escapeHtml = (value = '') => String(value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/\"/g, '&quot;')
  .replace(/'/g, '&#039;');

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  const authHeader = event.headers?.authorization || event.headers?.Authorization || '';
  const accessToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!accessToken) {
    return { statusCode: 401, body: JSON.stringify({ error: "Authentication required." }) };
  }

  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const { data: authData, error: authError } = await supabase.auth.getUser(accessToken);
  if (authError || !authData?.user) {
    return { statusCode: 401, body: JSON.stringify({ error: "Invalid session." }) };
  }

  // Throttle per authenticated user: 30 emails per 15 minutes is generous for
  // legitimate certificate-notification usage but stops a compromised/scripted
  // session from mail-bombing recipients. See supabase/migrations/20260824_phase50_rate_limiting.sql.
  const { data: rateOk, error: rateError } = await supabase.rpc('ct_check_rate_limit', {
    p_bucket_key: `send_email:user:${authData.user.id}`,
    p_max_count: 30,
    p_window_seconds: 15 * 60
  });
  if (rateError) {
    console.error('[send_email] rate limit check failed, allowing request:', rateError.message);
  } else if (rateOk === false) {
    return {
      statusCode: 429,
      headers: { 'Retry-After': '900' },
      body: JSON.stringify({ error: 'Too many emails sent recently. Please try again later.' })
    };
  }

  const { email, type, certificates = [], subject, companyName } = JSON.parse(event.body || '{}');
  if (!email || !type) {
    return { statusCode: 400, body: JSON.stringify({ error: "Missing required fields." }) };
  }

  let htmlContent = "";
  let usedSubject = subject || "CertiTrack";

  switch (type) {
    case "certificate":
      usedSubject = subject || "📄 Πιστοποιητικά από το CertiTrack";
      if (/λήξη|χρήστη|συνδρομή/i.test(subject || "")) {
        htmlContent = `
          <h2>Λίστα χρηστών με ληγμένη συνδρομή</h2>
          <ul>
            ${certificates.map(c => `
              <li>
                <strong>Ονομασία:</strong> ${escapeHtml(c.name || '—')}<br>
                <strong>Email:</strong> ${escapeHtml(c.email || '—')}<br>
                <strong>ΑΦΜ:</strong> ${escapeHtml(c.afm || '—')}<br>
                <strong>Ημερομηνία Λήξης:</strong> ${escapeHtml(c.date || '—')}
              </li>
            `).join('<hr>')}
          </ul>
        `;
      } else {
        htmlContent = `
          <p>Σας ενημερώνουμε ότι τα παρακάτω πιστοποιητικά προμηθευτών έχουν λήξει ή πρόκειται να λήξουν:</p>
          <ul style="font-size: 15px; line-height: 1.6">
            ${certificates.map(c => `
              <li style="margin-bottom: 12px">
                <strong>Τίτλος:</strong> ${escapeHtml(c.title || '—')}<br>
                <strong>Ημερομηνία Λήξης:</strong> ${escapeHtml(c.date || '—')}<br>
                ${c.supplier ? `<strong>Προμηθευτής:</strong> ${escapeHtml(c.supplier)}` : ''}
                ${c.afm ? `<br><strong>ΑΦΜ:</strong> ${c.afm}` : ''}
              </li>
            `).join('')}
          </ul>
        `;
      }
      break;
    case "invite":
      usedSubject = subject || "📨 Πρόσκληση Εγγραφής στο CertiTrack";
      htmlContent = `
        <p>Η εταιρεία <strong>${escapeHtml(companyName || "μια συνεργαζόμενη εταιρεία")}</strong> σας προσκαλεί να εγγραφείτε στο CertiTrack.</p>
        <p>Με την εγγραφή σας, θα μπορείτε να ανταλλάσσετε πιστοποιητικά και έγγραφα εύκολα και οργανωμένα με τους συνδεδεμένους πελάτες σας.</p>
        <p>Ολοκληρώστε την εγγραφή σας, καταχωρώντας τα στοιχεία σας στον παρακάτω σύνδεσμο:</p>
        <p><a href="https://www.certitrack.gr/pages/auth/supplier-register.html">➕ Εγγραφή Προμηθευτή</a></p>
      `;
      break;
    case "reset":
      usedSubject = subject || "🔑 Επαναφορά Κωδικού CertiTrack";
      htmlContent = `
        <p>Για να αλλάξετε τον κωδικό σας, κάντε κλικ στο παρακάτω σύνδεσμο:</p>
        <p><a href="https://www.certitrack.gr/pages/auth/reset-password.html">Ορισμός νέου κωδικού</a></p>
      `;
      break;
    case "renewal_reminder":
      usedSubject = subject || "⏳ Υπενθύμιση Λήξης Συνδρομής";
      htmlContent = `
        <p>Αγαπητέ χρήστη,</p>
        <p>Η συνδρομή σας στο CertiTrack λήγει στις <strong>${escapeHtml(certificates[0]?.date || '—')}</strong>.</p>
        <p>Παρακαλούμε προχωρήστε σε ανανέωση για να διατηρήσετε την πρόσβασή σας.</p>
        <p>Εάν έχετε ήδη ανανεώσει, μπορείτε να αγνοήσετε αυτό το μήνυμα.</p>
        <p>Ευχαριστούμε,<br>Η ομάδα CertiTrack</p>
      `;
      break;
    default:
      return { statusCode: 400, body: JSON.stringify({ error: "Invalid email type" }) };
  }

  try {
    const { sendMail } = require('./_lib/mailer.js');
    const sent = await sendMail({ to: email, subject: usedSubject, html: htmlContent });
    if (!sent) {
      throw new Error('Αποτυχία αποστολής email');
    }

    if (type === "invite") {
      // NOTE: supplier_invites is a legacy table that no longer exists in
      // the canonical schema (verified 2026-08-24, see
      // docs/CURRENT_SUPABASE_STATE_2026-08-24.md). This whole "invite" email
      // type is called only from the legacy src/pages/company/* flow, which
      // itself queries tables (companies, suppliers, company_certificates)
      // that also no longer exist. This insert WILL fail until that legacy
      // flow is either migrated to the canonical organization_relationships
      // model (see ct_request_relationship) or removed. Left as-is rather
      // than silently papered over, since fixing it requires a product
      // decision about the company/supplier pages, not just a code fix.
      const inviteToken = crypto.randomUUID();
      const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString();

      const { error: inviteErr } = await supabase.from('supplier_invites').insert({
        email,
        token: inviteToken,
        expires_at: expiresAt,
        company_name: companyName || null,
        created_at: new Date().toISOString()
      });

      if (inviteErr) {
        console.error('❌ Σφάλμα κατά την εισαγωγή πρόσκλησης:', inviteErr);
      }
    }

    return { statusCode: 200, body: JSON.stringify({ success: true }) };
  } catch (err) {
    console.error("Email send error:", err);
    require('./_lib/monitoring.js').captureError(err, { function: 'send_email' });
    return { statusCode: 500, body: JSON.stringify({ error: "Email sending failed" }) };
  }
};

