// Shared SMTP mailer. Replaces the MailerSend HTTP API — sends directly
// through whatever SMTP account you configure, using nodemailer.
//
// Setup: set these Netlify environment variables (Site settings ->
// Environment variables). Use the SAME SMTP account you configure in
// Supabase (Project Settings -> Auth -> SMTP Settings) if you want one
// mail server for everything — Supabase Auth only uses its SMTP config for
// its own auth emails (signup confirmation, password reset, invites), so
// app-level emails like certificate-expiry reminders still need to be sent
// from here, independently.
//
//   SMTP_HOST=smtp.yourprovider.com
//   SMTP_PORT=587
//   SMTP_SECURE=false          (true if using port 465)
//   SMTP_USER=your-smtp-username
//   SMTP_PASSWORD=your-smtp-password
//   SMTP_FROM_EMAIL=noreply@certitrack.gr
//   SMTP_FROM_NAME=CertiTrack
//
// No-ops (logs a warning, returns false) if SMTP_HOST is not set, so a
// missing config doesn't crash the calling function.

const nodemailer = require('nodemailer');

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;
  if (!process.env.SMTP_HOST) return null;
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD
    }
  });
  return transporter;
}

async function sendMail({ to, subject, html }) {
  const t = getTransporter();
  if (!t) {
    console.warn('[mailer] SMTP_HOST not configured — email not sent:', subject, 'to', to);
    return false;
  }
  try {
    await t.sendMail({
      from: `${process.env.SMTP_FROM_NAME || 'CertiTrack'} <${process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER}>`,
      to,
      subject,
      html
    });
    return true;
  } catch (err) {
    console.error('[mailer] send failed:', err.message);
    return false;
  }
}

module.exports = { sendMail };
