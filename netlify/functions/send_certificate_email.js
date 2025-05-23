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

    // Έλεγχος περιβάλλοντος
    const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM } = process.env;
    if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
      console.error('[CertiTrack] Λείπουν οι μεταβλητές SMTP περιβάλλοντος:', {
        SMTP_HOST,
        SMTP_USER,
        SMTP_PASS_PRESENT: !!SMTP_PASS
      });
      return {
        statusCode: 500,
        body: 'Missing SMTP configuration'
      };
    }

    // Ρυθμίσεις SMTP (π.χ. Gmail, SendGrid κλπ)
    const transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT || 587,
      secure: false,
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS,
      },
    });

    console.log('[CertiTrack] SMTP transporter created');

    const mailOptions = {
      from: SMTP_FROM || 'no-reply@yourdomain.com',
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
