import nodemailer from 'nodemailer';

export async function handler(event) {
  if (event.httpMethod !== 'POST') {
    console.log('[CertiTrack] Rejected non-POST request');
    return {
      statusCode: 405,
      body: 'Method Not Allowed',
    };
  }

  try {
    console.log('[CertiTrack] Received POST request');
    const { email, zipBase64 } = JSON.parse(event.body);

    console.log('[CertiTrack] Email to:', email);
    console.log('[CertiTrack] zipBase64 length:', zipBase64?.length);

    if (!email || !zipBase64) {
      console.warn('[CertiTrack] Missing email or zipBase64');
      return {
        statusCode: 400,
        body: 'Missing email or zipBase64',
      };
    }

    // Ρυθμίσεις SMTP (π.χ. Gmail, SendGrid κλπ)
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT || 587,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    console.log('[CertiTrack] SMTP transporter created');

    const mailOptions = {
      from: process.env.SMTP_FROM || 'no-reply@yourdomain.com',
      to: email,
      subject: 'Τα Πιστοποιητικά σας από CertiTrack',
      text: 'Συνημμένα θα βρείτε τα πιστοποιητικά σας σε αρχείο ZIP.',
      attachments: [
        {
          filename: 'certificates.zip',
          content: Buffer.from(zipBase64, 'base64'),
          contentType: 'application/zip',
        },
      ],
    };

    console.log('[CertiTrack] Sending email...');
    await transporter.sendMail(mailOptions);

    console.log('[CertiTrack] Email sent successfully');
    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Email sent successfully' }),
    };
  } catch (error) {
    console.error('[CertiTrack] Error sending email:', error);
    return {
      statusCode: 500,
      body: 'Internal Server Error',
    };
  }
}
