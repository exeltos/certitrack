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
        <p><a href="https://www.certitrack.gr/supplier-register.html">➕ Εγγραφή Προμηθευτή</a></p>
      `;
      break;
    case "reset":
      usedSubject = subject || "🔑 Επαναφορά Κωδικού CertiTrack";
      htmlContent = `
        <p>Για να αλλάξετε τον κωδικό σας, κάντε κλικ στο παρακάτω σύνδεσμο:</p>
        <p><a href="https://www.certitrack.gr/reset-password.html">Ορισμός νέου κωδικού</a></p>
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
    const response = await fetch("https://api.mailersend.com/v1/email", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.MAILERSEND_TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: { email: "noreply@certitrack.gr", name: "CertiTrack" },
        to: [{ email }],
        subject: usedSubject,
        html: htmlContent
      })
    });

    const responseBody = await response.text();
    if (!response.ok) {
      console.error("Mail provider error:", response.status, responseBody.slice(0, 300));
      throw new Error("Αποτυχία αποστολής email");
    }

    if (type === "invite") {
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
      } else {
      }
    }

    return { statusCode: 200, body: JSON.stringify({ success: true }) };
  } catch (err) {
    console.error("Email send error:", err);
    return { statusCode: 500, body: JSON.stringify({ error: "Email sending failed" }) };
  }
};

