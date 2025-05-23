const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

exports.handler = async function (event, context) {
  try {
    const in30Days = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    // Ερώτημα για πιστοποιητικά με λήξη σε 30 μέρες
    const { data: certs, error } = await supabase
      .from('company_certificates')
      .select('id, title, company_id, company_email')
      .lte('date', in30Days);

    if (error) {
      console.error(error);
      return { statusCode: 500, body: 'Error fetching certificates' };
    }

    for (const cert of certs) {
      // Έλεγχος αν έχει ήδη σταλεί ειδοποίηση
      const { data: notifications } = await supabase
        .from('company_notifications')
        .select('id')
        .eq('certificate_id', cert.id)
        .eq('company_id', cert.company_id)
        .limit(1);

      if (notifications.length > 0) continue;

      // Αποστολή email (πρέπει να υλοποιηθεί ή να καλέσεις άλλη λειτουργία)

      // Καταχώριση ειδοποίησης
      await supabase.from('company_notifications').insert({
        certificate_id: cert.id,
        company_id: cert.company_id,
        notified_at: new Date().toISOString()
      });
    }

    return { statusCode: 200, body: 'Notifications sent' };
  } catch (error) {
    console.error(error);
    return { statusCode: 500, body: 'Internal Server Error' };
  }
};
