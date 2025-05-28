import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

exports.handler = async function (event) {
  try {
    const today = new Date();

    // 🔹 Supplier Certificates
    const allSupplierCerts = await supabase.from('supplier_certificates').select('*');
    if (allSupplierCerts.error) throw allSupplierCerts.error;

    const groupedSuppliers = {};
    for (const cert of allSupplierCerts.data) {
      const expDate = new Date(cert.date);
      const daysLeft = Math.ceil((expDate - today) / (1000 * 60 * 60 * 24));
      const status = daysLeft < 0 ? 'expired' : daysLeft <= 30 ? 'soon' : null;
      if (!status) continue;

      if (!groupedSuppliers[cert.supplier_afm]) groupedSuppliers[cert.supplier_afm] = { expired: [], soon: [] };
      groupedSuppliers[cert.supplier_afm][status].push(cert);
    }

    for (const afm of Object.keys(groupedSuppliers)) {
      const { data: supplier, error } = await supabase.from('suppliers').select('id, email').eq('afm', afm).maybeSingle();
      if (error || !supplier?.email) continue;

      const notifications = await supabase.from('supplier_notifications')
        .select('type')
        .eq('supplier_id', supplier.id);

      const sentTypes = notifications.data?.map(n => n.type) || [];

      const send = async (type, certList) => {
        if (certList.length === 0 || sentTypes.includes(type)) return;
        const subject = type === 'expired' ? 'Έχετε ληγμένα πιστοποιητικά' : 'Πιστοποιητικά προς λήξη σε 30 ημέρες';
        const certificates = certList.map(c => ({ title: c.title, date: c.date }));

        await fetch('https://www.certitrack.gr/.netlify/functions/send_email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: supplier.email, type: 'certificate', certificates, subject })
        });

        await supabase.from('supplier_notifications').insert({ supplier_id: supplier.id, type, sent_at: new Date().toISOString() });
      };

      await send('expired', groupedSuppliers[afm].expired);
      await send('soon', groupedSuppliers[afm].soon);
    }

    // 🔹 Company Certificates
    const allCompanyCerts = await supabase.from('company_certificates').select('*');
    if (allCompanyCerts.error) throw allCompanyCerts.error;

    const groupedCompanies = {};
    for (const cert of allCompanyCerts.data) {
      const expDate = new Date(cert.date);
      const daysLeft = Math.ceil((expDate - today) / (1000 * 60 * 60 * 24));
      const status = daysLeft < 0 ? 'expired' : daysLeft <= 30 ? 'soon' : null;
      if (!status) continue;

      if (!groupedCompanies[cert.company_afm]) groupedCompanies[cert.company_afm] = { expired: [], soon: [] };
      groupedCompanies[cert.company_afm][status].push(cert);
    }

    for (const afm of Object.keys(groupedCompanies)) {
      const { data: company, error } = await supabase.from('companies').select('id, email').eq('afm', afm).maybeSingle();
      if (error || !company?.email) continue;

      const notifications = await supabase.from('company_notifications')
        .select('type')
        .eq('company_id', company.id);

      const sentTypes = notifications.data?.map(n => n.type) || [];

      const send = async (type, certList) => {
        if (certList.length === 0 || sentTypes.includes(type)) return;
        const subject = type === 'expired' ? 'Έχετε ληγμένα πιστοποιητικά' : 'Πιστοποιητικά προς λήξη σε 30 ημέρες';
        const certificates = certList.map(c => ({ title: c.title, date: c.date }));

        await fetch('https://www.certitrack.gr/.netlify/functions/send_email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: company.email, type: 'certificate', certificates, subject })
        });

        await supabase.from('company_notifications').insert({ company_id: company.id, type, sent_at: new Date().toISOString() });
      };

      await send('expired', groupedCompanies[afm].expired);
      await send('soon', groupedCompanies[afm].soon);
    }

    return { statusCode: 200, body: 'All notifications sent.' };
  } catch (err) {
    console.error('[CertiTrack] Σφάλμα ειδοποίησης:', err);
    return { statusCode: 500, body: 'Internal Server Error' };
  }
};
