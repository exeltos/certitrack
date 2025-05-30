const fetch = require('node-fetch');

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

    const response = await fetch('https://api.mailersend.com/v1/email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.MAILERSEND_TOKEN}`
      },
      body: JSON.stringify({
        from: { email: 'noreply@certitrack.gr', name: 'CertiTrack' },
        to: [{ email, name }],
        subject: '✅ Επιβεβαίωση Εγγραφής στο CertiTrack',
        html: `
          <p>Αγαπητέ/ή <strong>${name}</strong>,</p>
          <p>Η εγγραφή σας στο CertiTrack πραγματοποιήθηκε με επιτυχία.</p>
          <p>Με την εγγραφή σας, αποδέχεστε τους όρους χρήσης του συστήματος.</p>
          <p>Μπορείτε να συνδεθείτε μέσω του παρακάτω συνδέσμου:</p>
          <p><a href="${process.env.BASE_URL}/general_login.html" style="color:#2563eb;">Μετάβαση στο CertiTrack</a></p>
          <hr>
          <p style="font-size:0.9em;color:#555;">Αυτό το email στάλθηκε αυτόματα από το σύστημα CertiTrack.</p>
        `
      })
    });

    if (!response.ok) {
      const txt = await response.text();
      console.error('Mailersend error:', txt);
      return { statusCode: 500, body: 'Email sending failed' };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true })
    };
  } catch (err) {
    console.error('Function error:', err);
    return {
      statusCode: 500,
      body: 'Internal Server Error'
    };
  }
};
