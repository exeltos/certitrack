import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

exports.handler = async function () {
  try {
    const today = new Date();
    const allSupplierCerts = await supabase.from('supplier_certificates').select('*');
    const allCompanyCerts = await supabase.from('company_certificates').select('*');

    if (allSupplierCerts.error) throw allSupplierCerts.error;
    if (allCompanyCerts.error) throw allCompanyCerts.error;

    const groupCertsBy = (certs, type) => {
      const grouped = {};
      for (const cert of certs) {
        const expDate = new Date(cert.date);
        const daysLeft = Math.ceil((expDate - today) / (1000 * 60 * 60 * 24));
        const status = daysLeft < 0 ? 'expired' : daysLeft <= 30 ? 'soon' : null;
        if (!status) continue;

        const id = type === 'supplier' ? cert.supplier_afm : cert.company_id;
        if (!grouped[id]) grouped[id] = { expired: [], soon: [] };
        grouped[id][status].push(cert);
      }
      return grouped;
    };

    const supplierGrouped = groupCertsBy(allSupplierCerts.data, 'supplier');
    const companyGrouped = groupCertsBy(allCompanyCerts.data, 'company');

    const sendNotification = async (to, subject, message) => {
      const res = await fetch('https://www.certitrack.gr/.netlify/functions/send_email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to, subject, message })
      });
      if (!res.ok) {
        const err = await res.text();
        throw new Error(`[EMAIL ERROR] ${to}: ${err}`);
      }
    };

    for (const afm of Object.keys(supplierGrouped)) {
      const { data: supplier, error } = await supabase.from('suppliers').select('id, email').eq('afm', afm).maybeSingle();
      if (error || !supplier?.email) continue;

      const notifications = await supabase.from('supplier_notifications')
        .select('type')
        .eq('supplier_id', supplier.id);
      const sentTypes = notifications.data?.map(n => n.type) || [];

      const send = async (type, certList) => {
        if (certList.length === 0 || sentTypes.includes(type)) return;
        const subject = type === 'expired' ? 'Έχετε ληγμένα πιστοποιητικά' : 'Πιστοποιητικά προς λήξη σε 30 ημέρες';
        const message = `${subject}:
` + certList.map(c => `• ${c.title} - Λήγει: ${c.date}`).join('\n');
        await sendNotification(supplier.email, subject, message);
        await supabase.from('supplier_notifications').insert({
          supplier_id: supplier.id,
          type,
          sent_at: new Date().toISOString()
        });
      };

      await send('expired', supplierGrouped[afm].expired);
      await send('soon', supplierGrouped[afm].soon);
    }

    for (const companyId of Object.keys(companyGrouped)) {
      const { data: company, error } = await supabase.from('companies').select('id, email').eq('id', companyId).maybeSingle();
      if (error || !company?.email) continue;

      const notifications = await supabase.from('company_notifications')
        .select('type')
        .eq('company_id', company.id);
      const sentTypes = notifications.data?.map(n => n.type) || [];

      const send = async (type, certList) => {
        if (certList.length === 0 || sentTypes.includes(type)) return;
        const subject = type === 'expired' ? 'Η εταιρεία σας έχει ληγμένα πιστοποιητικά' : 'Πιστοποιητικά προς λήξη εντός 30 ημερών';
        const message = `${subject}:
` + certList.map(c => `• ${c.title} - Λήγει: ${c.date}`).join('\n');
        await sendNotification(company.email, subject, message);
        await supabase.from('company_notifications').insert({
          company_id: company.id,
          type,
          sent_at: new Date().toISOString()
        });
      };

      await send('expired', companyGrouped[companyId].expired);
      await send('soon', companyGrouped[companyId].soon);
    }

    return { statusCode: 200, body: 'Notifications sent to suppliers and companies.' };
  } catch (err) {
    console.error('[CertiTrack] notify error:', err);
    return { statusCode: 500, body: 'Internal Server Error' };
  }
};