import { createClient } from '@supabase/supabase-js';
import { checkRateLimit, clientIp, tooManyRequestsResponse } from './_lib/rateLimit.js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      }
    };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { email } = JSON.parse(event.body);
    if (!email) {
      return { statusCode: 400, body: 'Missing email' };
    }

    // Throttle per-email (stop reset-spam against one victim) and per-IP
    // (stop one caller enumerating many emails).
    const normalizedEmail = String(email).trim().toLowerCase();
    const emailAllowed = await checkRateLimit(supabase, `reset_password:email:${normalizedEmail}`, 5, 15 * 60);
    const ipAllowed = await checkRateLimit(supabase, `reset_password:ip:${clientIp(event)}`, 20, 15 * 60);
    if (!emailAllowed || !ipAllowed) {
      return tooManyRequestsResponse();
    }

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: 'https://www.certitrack.gr/pages/auth/reset-password.html'


    });

    if (error) {
      return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*'
      },
      body: `Error: ${error.message}`
    };
    }

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*'
      },
      body: 'OK'
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*'
      },
      body: `Server Error: ${err.message}`
    };
  }
}


