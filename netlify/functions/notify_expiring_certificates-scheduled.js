// notify_expiring_certificates-scheduled.js - υποστήριξη για suppliers & companies

import fetch from 'node-fetch';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// 🔹 TEST EMAIL FUNCTION για έλεγχο αν δουλεύει η αποστολή
async function testEmailHandler() {
  try {
    if (!process.env.MAILERSEND_API_KEY) {
      return { statusCode: 500, body: '❌ Missing MAILERSEND_API_KEY' };
    }

    const res = await fetch('https://api.mailersend.com/v1/email', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.MAILERSEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: { email: 'info@certitrack.gr', name: 'CertiTrack' },
        to: [{ email: 'info@exeltos.com' }],
        subject: '✅ Δοκιμαστικό email από CertiTrack',
        html: '<p>Αυτό είναι ένα δοκιμαστικό email προς τον προμηθευτή info@exeltos.com</p>'
      })
    });

    if (!res.ok) {
      const text = await res.text();
      return { statusCode: 500, body: `❌ Failed: ${text}` };
    }

    return { statusCode: 200, body: '✅ Test email sent to info@exeltos.com!' };
  } catch (err) {
    return { statusCode: 500, body: '❌ Exception: ' + err.message };
  }
}

async function handler() {
  try {
    console.log('🚀 ΕΝΑΡΞΗ notify_expiring_certificates');
    const today = new Date();

    // ---------- 🔹 SUPPLIERS ----------
    const { data: supplierCerts, error: supplierErr } = await supabase.from('supplier_certificates').select('*');
    if (supplierErr) throw supplierErr;

    const groupedSuppliers = {};
    for (const cert of supplierCerts) {
      if (!cert?.date || !cert?.supplier_afm) continue;
      const exp = new Date(cert.date);
      const days = Math.ceil((exp - today) / (1000 * 60 * 60 * 24));
      const status = days < 0 ? 'expired' : days <= 30 ? 'soon' : null;
      if (!status) continue;
      if (!groupedSuppliers[cert.supplier_afm]) groupedSuppliers[cert.supplier_afm] = { expired: [], soon: [] };
      groupedSuppliers[cert.supplier_afm][status].push(cert);
    }

    for (const afm of Object.keys(groupedSuppliers)) {
      console.log('[DEBUG] Ελέγχεται supplier με ΑΦΜ:', afm);
      const { data: supplier, error } = await supabase.from('suppliers').select('id, email').eq('afm', afm).maybeSingle();
      if (error || !supplier?.email) continue;
      const { data: notifications } = await supabase.from('supplier_notifications').select('type').eq('supplier_id', supplier.id);
      console.log('[DEBUG] Notifications για supplier', supplier.email, ':', notifications);
      const sent = notifications?.map(n => n.type) || [];
      for (const type of ['expired', 'soon']) {
        const certs = groupedSuppliers[afm][type];
        if (!certs.length || sent.includes(type)) continue;
        const subject = type === 'expired' ? 'Έχετε ληγμένα πιστοποιητικά' : 'Πιστοποιητικά προς λήξη σε 30 ημέρες';
        const html = buildEmailTable(certs, type);
        try {
          await sendEmail(supplier.email, subject, html);
        } catch (e) {
          console.error('[❌ ERROR] Αποτυχία αποστολής email στον supplier:', supplier.email, e.message);
        }
      }
    }

    // ---------- 🔹 COMPANIES ----------
    const { data: companyCerts, error: companyErr } = await supabase.from('company_certificates').select('*');
    if (companyErr) throw companyErr;

    const groupedCompanies = {};
    for (const cert of companyCerts) {
      if (!cert?.date || !cert?.company_afm) continue;
      const exp = new Date(cert.date);
      const days = Math.ceil((exp - today) / (1000 * 60 * 60 * 24));
      const status = days < 0 ? 'expired' : days <= 30 ? 'soon' : null;
      if (!status) continue;
      if (!groupedCompanies[cert.company_afm]) groupedCompanies[cert.company_afm] = { expired: [], soon: [] };
      groupedCompanies[cert.company_afm][status].push(cert);
    }

    for (const afm of Object.keys(groupedCompanies)) {
      const { data: company, error } = await supabase.from('companies').select('id, email').eq('afm', afm).maybeSingle();
      if (error || !company?.email) continue;
      const { data: notifications } = await supabase.from('company_notifications').select('type').eq('company_id', company.id);
      const sent = notifications?.map(n => n.type) || [];
      for (const type of ['expired', 'soon']) {
        const certs = groupedCompanies[afm][type];
        if (!certs.length || sent.includes(type)) continue;
        const subject = type === 'expired' ? 'Έχετε ληγμένα πιστοποιητικά' : 'Πιστοποιητικά προς λήξη σε 30 ημέρες';
        const html = buildEmailTable(certs, type);
        try {
          await sendEmail(company.email, subject, html);
        } catch (e) {
          console.error('[❌ ERROR] Αποτυχία αποστολής email στην εταιρεία:', company.email, e.message);
        }
      }
    }

    return { statusCode: 200, body: '✅ Emails sent to suppliers & companies' };
  } catch (err) {
    console.error('❌ Σφάλμα:', err);
    console.log('FULL ERROR OBJECT:', err);
    throw err;
  }
}

function buildEmailTable(certs, type) {
  return `
    <p>${type === 'expired'
      ? 'Τα παρακάτω πιστοποιητικά έχουν <strong>λήξει</strong>:'
      : 'Τα παρακάτω πιστοποιητικά <strong>λήγουν εντός 30 ημερών</strong>:'}</p>
    <table border="1" cellpadding="6" cellspacing="0" style="border-collapse: collapse; margin-top: 10px;">
      <thead><tr><th>Τίτλος</th><th>Ημερομηνία</th></tr></thead>
      <tbody>
        ${certs.map(c =>
          `<tr><td>${c.title}</td><td>${new Date(c.date).toLocaleDateString('el-GR')}</td></tr>`).join('')}
      </tbody>
    </table>
    <p style="margin-top:12px;">Συνδεθείτε στο CertiTrack για να διαχειριστείτε τα πιστοποιητικά σας.</p>
  `;
}

async function sendEmail(to, subject, html) {
  console.log('[DEBUG] Προσπάθεια αποστολής email σε:', to);
  console.log('[DEBUG] Χρήση MAILERSEND_API_KEY:', process.env.MAILERSEND_API_KEY?.slice(0, 8));
  if (!process.env.MAILERSEND_API_KEY) {
    throw new Error('❌ Δεν έχει οριστεί το MAILERSEND_API_KEY στο περιβάλλον!');
  }

  const res = await fetch('https://api.mailersend.com/v1/email', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.MAILERSEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: { email: 'info@certitrack.gr', name: 'CertiTrack' },
      to: [{ email: to }],
      subject,
      html
    })
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Mail error: ${txt}`);
  }
}

module.exports = {
  handler,
  testEmailHandler
};
