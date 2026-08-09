import { supabase } from './supabaseClient.js';

export async function sendNotificationIfNotSent(certificateId, companyId, toEmail) {
  try {
    // Έλεγχος για υπάρχουσα ειδοποίηση
    const { data, error } = await supabase
      .from('company_notifications')
      .select('id')
      .eq('certificate_id', certificateId)
      .eq('company_id', companyId)
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') { // Κωδικός για no rows found
      throw error;
    }

    if (data) {
      return;
    }

    // TODO: Στείλε email εδώ (θα το υλοποιήσουμε στο επόμενο βήμα)

    // Καταχώριση ειδοποίησης στη βάση
    const { error: insertError } = await supabase
      .from('company_notifications')
      .insert([{ certificate_id: certificateId, company_id: companyId }]);

    if (insertError) throw insertError;

  } catch (err) {
    console.error('Σφάλμα στην αποστολή ειδοποίησης:', err.message);
  }
}
