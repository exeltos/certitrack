// notify_expiring_certificates.js
const { createClient } = require('@supabase/supabase-js');
const fetch = require('node-fetch');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

exports.handler = async function () {
  try {
    const today = new Date();
    const in30Days = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    // ---- ΒΗΜΑ 1: Βρες όλα τα certificates (εταιρειών & προμηθευτών) που έχουν λήξει ή θα λήξουν εντός 30 ημερών ----
    const [companyCerts, supplierCerts] = await Promise.all([
      supabase
        .from('company_certificates')
        .select('id, title, date, company_id, company_email')
        .lte('date', in30Days),

      supabase
        .from('supplier_certificates')
        .select('id, title, date, supplier_user_id, supplier_email')
        .lte('date', in30Days)
    ]);

    if (companyCerts.error || supplierCerts.error) {
      console.error('DB Errors:', companyCerts.error, supplierCerts.error);
      return { statusCode: 500, body: 'Error loading certificates' };
    }

    // ---- ΒΗΜΑ 2: Φιλτράρισμα ώστε να μη σταλεί ξανά email για τα ίδια πιστοποιητικά ----
    const [companyNotifs, supplierNotifs] = await Promise.all([
      supabase.from('company_notifications').select('certificate_id'),
      supabase.from('supplier_notifications').select('certificate_id')
    ]);

    const alreadyNotifiedCompany = new Set(companyNotifs.data.map(n => n.certificate_id));
    const alreadyNotifiedSupplier = new Set(supplierNotifs.data.map(n => n.certificate_id));

    const pendingCompany = companyCerts.data.filter(c => !alreadyNotifiedCompany.has(c.id));
    const pendingSupplier = supplierCerts.data.filter(c => !alreadyNotifiedSupplier.has(c.id));

    // ---- ΒΗΜΑ 3: Ομαδοποίηση πιστοποιητικών ανά email ----
    const groupByEmail = (certs, emailField) => {
      const map = {};
      for (const cert of certs) {
        const email = cert[emailField];
        if (!email) continue;
        if (!map[email]) map[email] = [];
        map[email].push(cert);
      }
      return map;
    };

    const groupedCompanies = groupByEmail(pendingCompany, 'company_email');
    const groupedSuppliers = groupByEmail(pendingSupplier, 'supplier_email');

    // ---- ΒΗΜΑ 4: Στείλε email και καταχώρισε την ειδοποίηση ----
    const sendNotification = async (email, certs, type) => {
      const zipContent = certs.map(c => `\u2022 ${c.title} (Λήξη: ${new Date(c.date).toLocaleDateString('el-GR')})`).join('\n');
      const response = await fetch(process.env.EMAIL_FUNCTION_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          zipBase64: Buffer.from(zipContent, 'utf-8').toString('base64')
        })
      });

      if (!response.ok) throw new Error('Email send failed');

      const notifications = certs.map(c => ({
        certificate_id: c.id,
        [type === 'company' ? 'company_id' : 'supplier_user_id']: c[type === 'company' ? 'company_id' : 'supplier_user_id'],
        notified_at: new Date().toISOString()
      }));

      const table = type === 'company' ? 'company_notifications' : 'supplier_notifications';
      await supabase.from(table).insert(notifications);
    };

    for (const [email, certs] of Object.entries(groupedCompanies)) {
      await sendNotification(email, certs, 'company');
    }

    for (const [email, certs] of Object.entries(groupedSuppliers)) {
      await sendNotification(email, certs, 'supplier');
    }

    return { statusCode: 200, body: 'Notifications sent' };
  } catch (err) {
    console.error('Notify error:', err);
    return { statusCode: 500, body: 'Internal Server Error' };
  }
};