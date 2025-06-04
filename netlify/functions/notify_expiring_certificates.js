// notify_expiring_certificates-scheduled.js - υποστήριξη για suppliers & companies

import fetch from 'node-fetch';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function handler() {
  try {
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

    console.log('[DEBUG] groupedSuppliers:', JSON.stringify(groupedSuppliers, null, 2));

    for (const afm of Object.keys(groupedSuppliers)) {
      const { data: supplier, error } = await supabase.from('suppliers').select('id, email').eq('afm', afm).maybeSingle();
      if (error || !supplier?.email) continue;
      const { data: notifications } = await supabase.from('supplier_notifications').select('type').eq('supplier_id', supplier.id);
      const sent = notifications?.map(n => n.type) || [];
      for (const type of ['expired', 'soon']) {
        const certs = groupedSuppliers[afm][type];
        if (!certs.length || sent.includes(type)) continue;
        const subject = type === 'expired' ? 'Έχετε ληγμένα πιστοποιητικά' : 'Πιστοποιητικά προς λήξη σε 30 ημέρες';
        const html = buildEmailTable(certs, type);
        await sendEmail(supplier.email, subject, html);
        await supabase.from('supplier_notifications').insert({ supplier_id: supplier.id, type, sent_at: new Date().toISOString() });
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

    console.log('[DEBUG] groupedCompanies:', JSON.stringify(groupedCompanies, null, 2));

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
        await sendEmail(company.email, subject, html);
        await supabase.from('company_notifications').insert({ company_id: company.id, type, sent_at: new Date().toISOString() });
      }
    }

    return { statusCode: 200, body: '✅ Emails sent to suppliers & companies' };
  } catch (err) {
    console.error('[❌ ERROR]', err);
    return { statusCode: 500, body: '❌ Σφάλμα: ' + err.message };
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
  const res = await fetch('https://api.mailersend.com/v1/email', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.MAILERSEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: { email: 'info@exeltos.com', name: 'CertiTrack' },
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
