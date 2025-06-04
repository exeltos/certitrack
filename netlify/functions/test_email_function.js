// netlify/functions/test_email_function.js
import { testEmailHandler } from './notify_expiring_certificates-scheduled.js';

export const handler = testEmailHandler;
  
  const res = await fetch('https://api.mailersend.com/v1/email', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.MAILERSEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: { email: 'info@certitrack.gr', name: 'CertiTrack' },
      to: [{ email: 'info@exeltos.com' }], // ← δικό σου email
      subject: '✅ Test Email από CertiTrack',
      html: '<p>Αυτό είναι ένα δοκιμαστικό email</p>'
    })
  });

  if (!res.ok) {
    const text = await res.text();
    return { statusCode: 500, body: `❌ Failed: ${text}` };
  }

  return { statusCode: 200, body: '✅ Test email sent!' };

