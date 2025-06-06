const fetch = require('node-fetch');
const crypto = require('crypto');

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  const { email, type, certificates = [], subject, companyName } = JSON.parse(event.body || '{}');
  if (!email || !type) {
    return { statusCode: 400, body: JSON.stringify({ error: "Missing required fields." }) };
  }

  console.log("📤 Αποστολή email:", { email, type, subject });
  console.log("🔹 Company Name:", companyName);
  console.log("📦 Περιβάλλον:", process.env.MAILERSEND_TOKEN ? "✔️ Token υπάρχει" : "❌ Token ΔΕΝ υπάρχει");

  let htmlContent = "";
  let usedSubject = subject || "CertiTrack";

  switch (type) {
    case "certificate":
      usedSubject = subject || "📄 Πιστοποιητικά από το CertiTrack";
      if (subject?.toLowerCase().includes("λήξη") || subject?.toLowerCase().includes("χρήστη")) {
        htmlContent = `
          <h2>Λίστα χρηστών με ληγμένη συνδρομή</h2>
          <ul>
            ${certificates.map(c => `<li>• ${c.title}</li>`).join("")}
          </ul>
        `;
      } else {
        htmlContent = `
          <h2>Έλαβες νέα πιστοποιητικά</h2>
          <ul>
            ${certificates.map(c => `<li><strong>${c.title}</strong> - ${c.date}</li>`).join("")}
          </ul>
        `;
      }
      break;
    case "invite":
      usedSubject = subject || "📨 Πρόσκληση Εγγραφής στο CertiTrack";
      htmlContent = `
        <p>Η εταιρεία <strong>${companyName || "μια συνεργαζόμενη εταιρεία"}</strong> σας προσκαλεί να εγγραφείτε στο CertiTrack.</p>
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
    default:
      return { statusCode: 400, body: JSON.stringify({ error: "Invalid email type" }) };
  }

  const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

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

    const debug = await response.text();
    console.log("📨 Mailersend απάντηση:", response.status, debug);

    if (!response.ok) throw new Error("Αποτυχία αποστολής email");

    // 🔄 Καταγραφή πρόσκλησης στον πίνακα supplier_invites (ανεξαρτήτως ύπαρξης προμηθευτή)
    const inviteToken = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString(); // 7 μέρες

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
      console.log('✅ Καταχωρήθηκε στο supplier_invites');
    }

    

    return { statusCode: 200, body: JSON.stringify({ success: true }) };
  } catch (err) {
    console.error("Email send error:", err);
    return { statusCode: 500, body: JSON.stringify({ error: "Email sending failed" }) };
  }
  }

