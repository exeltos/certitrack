import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

exports.handler = async function () {
  try {
    const email = 'example@email.com'; // ← βάλε το email του προμηθευτή
    const redirectUrl = 'https://certitrack.gr/certificates.html'; // ← ή όπου θέλεις

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: redirectUrl
    });

    if (error) {
      console.error('[CertiTrack] Σφάλμα αποστολής email:', error);
      return { statusCode: 500, body: 'Αποτυχία αποστολής email' };
    }

    console.log('[CertiTrack] Email ειδοποίησης στάλθηκε στο:', email);
    return { statusCode: 200, body: 'OK' };
  } catch (err) {
    console.error('[CertiTrack] Γενικό σφάλμα:', err);
    return { statusCode: 500, body: 'Internal Server Error' };
  }
};
