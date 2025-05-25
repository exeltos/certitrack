// send_email.js – Refactored unified email sender

import MailerSend from "@mailersend/sdk";

const mailerSend = new MailerSend({ apiKey: process.env.MAILERSEND_API_KEY });

/**
 * Unified email sender for all types: invite, certificate, reset
 * Expects POST body: { email, subject?, type, certificates? }
 */
export default async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { email, type, certificates = [], subject } = req.body;
  if (!email || !type) {
    return res.status(400).json({ error: "Missing required fields." });
  }

  try {
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
          <p>Σας καλούμε να εγγραφείτε στο CertiTrack για να μοιραζόμαστε εύκολα πιστοποιητικά.</p>
          <p><a href="https://www.certitrack.gr/supplier-register.html">Εγγραφή Προμηθευτή</a></p>
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
        return res.status(400).json({ error: "Invalid email type" });
    }

    const sent = await mailerSend.email.send({
      from: { email: "noreply@certitrack.gr", name: "CertiTrack" },
      to: [{ email }],
      subject: usedSubject,
      html: htmlContent,
    });

    return res.status(200).json({ success: true, sent });
  } catch (err) {
    console.error("Email send error:", err);
    return res.status(500).json({ error: "Email sending failed" });
  }
};
