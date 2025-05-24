import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { email } = JSON.parse(event.body);
    if (!email) {
      return { statusCode: 400, body: 'Missing email' };
    }

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: 'https://www.certitrack.gr/reset-password.html'


    });

    if (error) {
      return { statusCode: 500, body: `Error: ${error.message}` };
    }

    return { statusCode: 200, body: 'OK' };
  } catch (err) {
    return { statusCode: 500, body: `Server Error: ${err.message}` };
  }
}

