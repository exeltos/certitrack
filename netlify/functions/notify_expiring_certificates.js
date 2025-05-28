const fetch = require('node-fetch');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

exports.handler = async function (event) {
  console.log("[DEBUG] notify_expiring_certificates-scheduled ξεκίνησε");
  console.log("[DEBUG] ENV:", process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY?.slice(0, 5));

  try {
    const today = new Date();
    console.log("[DEBUG] Σημερινή ημερομηνία:", today);

    // 🔹 Supplier Certificates
    const allSupplierCerts = await supabase.from('supplier_certificates').select('*');
    if (allSupplierCerts.error) throw allSupplierCerts.error;
    console.log("[DEBUG] Βρέθηκαν supplier_certificates:", allSupplierCerts.data.length);

    const groupedSuppliers = {};
    for (const cert of allSupplierCerts.data) {
      if (!cert?.date || isNaN(new Date(cert.date))) {
        console.warn("[WARN] Άκυρη ημερομηνία σε supplier_cert:", cert);
        continue;
      }
      const expDate = new Date(cert.date);
      const daysLeft = Math.ceil((expDate - today) / (1000 * 60 * 60 * 24));
      const status = daysLeft < 0 ? 'expired' : daysLeft <= 30 ? 'soon' : null;
      if (!status) continue;

      if (!groupedSuppliers[cert.supplier_afm]) groupedSuppliers[cert.supplier_afm] = { expired: [], soon: [] };
      groupedSuppliers[cert.supplier_afm][status].push(cert);
    }

    for (const afm of Object.keys(groupedSuppliers)) {
      console.log("[DEBUG] Επεξεργασία supplier AFM:", afm);
      const { data: supplier, error } = await supabase.from('suppliers').select('id, email').eq('afm', afm).maybeSingle();
      if (error || !supplier?.email) {
        console.warn("[WARN] Supplier χωρίς email:", afm);
        continue;
      }

      const notifications = await supabase.from('supplier_notifications')
        .select('type')
        .eq('supplier_id', supplier.id);

      const sentTypes = notifications.data?.map(n => n.type) || [];

      const send = async (type, certList) => {
        if (certList.length === 0 || sentTypes.includes(type)) return;
        const subject = type === 'expired' ? 'Έχετε ληγμένα πιστοποιητικά' : 'Πιστοποιητικά προς λήξη σε 30 ημέρες';
        const certificates = certList.map(c => ({ title: c.title, date: c.date }));

        console.log(`[DEBUG] Αποστολή email σε ${supplier.email} για`, type);

        try {
          const response = await fetch('https://www.certitrack.gr/.netlify/functions/send_email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: supplier.email, type: 'certificate', certificates, subject })
          });
          const responseText = await response.text();
          console.log(`[DEBUG] Απάντηση send_email:`, response.status, responseText);
        } catch (e) {
          console.error(`[ERROR] Αποτυχία fetch για supplier ${supplier.email}:`, e);
        }

        await supabase.from('supplier_notifications').insert({ supplier_id: supplier.id, type, sent_at: new Date().toISOString() });
      };

      await send('expired', groupedSuppliers[afm].expired);
      await send('soon', groupedSuppliers[afm].soon);
    }

    // 🔹 Company Certificates
    const allCompanyCerts = await supabase.from('company_certificates').select('*');
    if (allCompanyCerts.error) throw allCompanyCerts.error;
    console.log("[DEBUG] Βρέθηκαν company_certificates:", allCompanyCerts.data.length);

    const groupedCompanies = {};
    for (const cert of allCompanyCerts.data) {
      if (!cert?.date || isNaN(new Date(cert.date))) {
        console.warn("[WARN] Άκυρη ημερομηνία σε company_cert:", cert);
        continue;
      }
      const expDate = new Date(cert.date);
      const daysLeft = Math.ceil((expDate - today) / (1000 * 60 * 60 * 24));
      const status = daysLeft < 0 ? 'expired' : daysLeft <= 30 ? 'soon' : null;
      if (!status) continue;

      if (!groupedCompanies[cert.company_afm]) groupedCompanies[cert.company_afm] = { expired: [], soon: [] };
      groupedCompanies[cert.company_afm][status].push(cert);
    }

    for (const afm of Object.keys(groupedCompanies)) {
      console.log("[DEBUG] Επεξεργασία company AFM:", afm);
      const { data: company, error } = await supabase.from('companies').select('id, email').eq('afm', afm).maybeSingle();
      if (error || !company?.email) {
        console.warn("[WARN] Company χωρίς email:", afm);
        continue;
      }

      const notifications = await supabase.from('company_notifications')
        .select('type')
        .eq('company_id', company.id);

      const sentTypes = notifications.data?.map(n => n.type) || [];

      const send = async (type, certList) => {
        if (certList.length === 0 || sentTypes.includes(type)) return;
        const subject = type === 'expired' ? 'Έχετε ληγμένα πιστοποιητικά' : 'Πιστοποιητικά προς λήξη σε 30 ημέρες';
        const certificates = certList.map(c => ({ title: c.title, date: c.date }));

        console.log(`[DEBUG] Αποστολή email σε ${company.email} για`, type);

        try {
          const response = await fetch('https://www.certitrack.gr/.netlify/functions/send_email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: company.email, type: 'certificate', certificates, subject })
          });
          const responseText = await response.text();
          console.log(`[DEBUG] Απάντηση send_email:`, response.status, responseText);
        } catch (e) {
          console.error(`[ERROR] Αποτυχία fetch για company ${company.email}:`, e);
        }

        await supabase.from('company_notifications').insert({ company_id: company.id, type, sent_at: new Date().toISOString() });
      };

      await send('expired', groupedCompanies[afm].expired);
      await send('soon', groupedCompanies[afm].soon);
    }

    console.log("[DEBUG] notify_expiring_certificates-scheduled ολοκληρώθηκε επιτυχώς");
    return { statusCode: 200, body: 'All notifications sent.' };
  } catch (err) {
    console.error('[CertiTrack] Σφάλμα ειδοποίησης:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Σφάλμα ειδοποίησης',
        message: err.message,
        stack: err.stack
      })
    };
  }
};
