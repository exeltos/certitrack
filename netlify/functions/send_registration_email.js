const nodemailer = require('nodemailer');

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: 'Method Not Allowed'
    };
  }

  try {
    const { name, email } = JSON.parse(event.body);

    if (!email || !name) {
      return {
        statusCode: 400,
        body: 'Missing required fields'
      };
    }

    const transporter = nodemailer.createTransport({
      service: 'gmail', // ή Mailersend/SMTP provider
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });

    const htmlContent = `
      <p>Αγαπητέ/ή <strong>${name}</strong>,</p>
      <p>Η εγγραφή σας στο CertiTrack πραγματοποιήθηκε με επιτυχία.</p>
      <p>Με την εγγραφή σας, αποδέχεστε τους όρους χρήσης του συστήματος.</p>
      <p>Μπορείτε να συνδεθείτε μέσω του παρακάτω συνδέσμου:</p>
      <p><a href="${process.env.BASE_URL}/general_login.html" style="color:#2563eb;">Μετάβαση στο CertiTrack</a></p>
      <hr>
      <p style="font-size:0.9em;color:#555;">Αυτό το email στάλθηκε αυτόματα από το σύστημα CertiTrack.</p>
    `;

    await transporter.sendMail({
      from: `CertiTrack <${process.env.EMAIL_USER}>`,
      to: email,
      subject: '✅ Επιβεβαίωση Εγγραφής στο CertiTrack',
      html: htmlContent
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true })
    };
  } catch (err) {
    console.error('Email error:', err);
    return {
      statusCode: 500,
      body: 'Internal Server Error'
    };
  }
};
