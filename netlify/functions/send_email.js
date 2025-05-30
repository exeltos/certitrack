const fetch = require('node-fetch');

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  const { email, type, certificates = [], subject, companyName } = JSON.parse(event.body || '{}');
  if (!email || !type) {
    return { statusCode: 400, body: JSON.stringify({ error: "Missing required fields." }) };
  }

  console.log("📤 Αποστολή email:", { email, type, subject });
  console.log("📦 Περιβάλλον:", process.env.MAILERSEND_TOKEN ? "✔️ Token υπάρχει" : "❌ Token ΔΕΝ υπάρχει");

  let htmlContent = "";
  let usedSubject = subject || "CertiTrack";

  switch (type) {
    case "certificate":
      usedSubject = subject || "📄 Πιστοποιητικά από το CertiTrack";
      htmlContent = `
        <h2>Έλαβες νέα πιστοποιητικά</h2>
        <ul>
          ${certificates.map(c => `<li><strong>${c.title}</strong> - ${c.date}</li>`).join("")}
        </ul>
      `;
      break;
    case "invite":
      usedSubject = subject || "📨 Πρόσκληση Εγγραφής στο CertiTrack";
      htmlContent = `
        <p>Η εταιρεία <strong>${companyName || "μια συνεργαζόμενη εταιρεία"}</strong> σας προσκαλεί να εγγραφείτε στο CertiTrack.</p>
        <p>Με την εγγραφή σας, θα μπορείτε να ανταλλάσσετε πιστοποιητικά εύκολα και οργανωμένα.</p>
        <p><a href="https://www.certitrack.gr/supplier-register.html">➕ Εγγραφή Προμηθευτή</a></p>
      `;
      break;      break;
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

    return { statusCode: 200, body: JSON.stringify({ success: true }) };
  } catch (err) {
    console.error("Email send error:", err);
    return { statusCode: 500, body: JSON.stringify({ error: "Email sending failed" }) };
  }
};

