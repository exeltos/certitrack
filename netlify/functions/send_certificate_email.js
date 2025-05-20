export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      }
    };
  }

  try {
    const { email, certificates } = JSON.parse(event.body || '{}');

    if (!email || !Array.isArray(certificates)) {
      return {
        statusCode: 400,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: 'Missing data' })
      };
    }

    const RESEND_API_KEY = process.env.RESEND_API_KEY;
    const certList = certificates.map(c => `• ${c.title} (${c.date})\n${c.url}`).join('\n\n');

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'noreply@certitrack.gr',
        to: email,
        subject: 'Τα πιστοποιητικά σας',
        text: `Σας αποστέλλονται τα παρακάτω:\n\n${certList}`
      })
    });

    if (!response.ok) {
      const err = await response.text();
      return {
        statusCode: 500,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: 'Email failed', detail: err })
      };
    }

    return {
      statusCode: 200,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ success: true })
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: 'Internal error', detail: err.message })
    };
  }
}
