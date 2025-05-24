import fetch from 'node-fetch';

export async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: 'Method Not Allowed'
    };
  }

  try {
    const { to, subject, message } = JSON.parse(event.body);

    if (!to || !subject || !message) {
      return {
        statusCode: 400,
        body: 'Missing to, subject or message'
      };
    }

    const response = await fetch('https://api.mailersend.com/v1/email', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.MAILERSEND_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: {
          email: process.env.MAIL_FROM || 'info@exeltos.com',
          name: 'CertiTrack'
        },
        to: [ { email: to } ],
        subject,
        text: message
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`MailerSend error: ${errorText}`);
    }

    return {
      statusCode: 200,
      body: 'Email sent successfully'
    };
  } catch (err) {
    console.error('[CertiTrack] send-email error:', err);
    return {
      statusCode: 500,
      body: 'Server error: ' + err.message
    };
  }
}
