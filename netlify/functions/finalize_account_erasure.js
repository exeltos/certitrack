// Finalizes a GDPR-style erasure request for an organization that has
// already gone through the (reversible) closure flow
// (ct_platform_set_organization_state / status = 'closed').
//
// This is the IRREVERSIBLE step: it deletes certificate files from storage
// and deletes Supabase Auth users who have no other organization
// membership, then calls ct_finalize_erasure() to anonymize the DB row.
//
// Deliberately restricted to platform admins. Requires the organization to
// already be in 'closed' status as a safety guard against skipping the
// review step in ct_platform_set_organization_state.
//
// IMPORTANT: this has not been run against a live database. Test against a
// staging project (docs/operations/STAGING_SETUP.md) with disposable data
// before relying on it against production.

import { createClient } from '@supabase/supabase-js';
import { checkRateLimit, clientIp, tooManyRequestsResponse } from './_lib/rateLimit.js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const CERTIFICATE_BUCKET = 'organizationcertificates';

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders() };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const authHeader = event.headers?.authorization || event.headers?.Authorization || '';
    const accessToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    if (!accessToken) {
      return { statusCode: 401, headers: corsHeaders(), body: JSON.stringify({ error: 'Authentication required.' }) };
    }

    const { data: authData, error: authError } = await supabase.auth.getUser(accessToken);
    if (authError || !authData?.user) {
      return { statusCode: 401, headers: corsHeaders(), body: JSON.stringify({ error: 'Invalid session.' }) };
    }

    const { data: isAdmin, error: adminError } = await supabase.rpc('ct_is_platform_admin', { p_user: authData.user.id });
    if (adminError || isAdmin !== true) {
      return { statusCode: 403, headers: corsHeaders(), body: JSON.stringify({ error: 'Platform administrator required.' }) };
    }

    const allowed = await checkRateLimit(supabase, `finalize_erasure:${clientIp(event)}`, 10, 60 * 60);
    if (!allowed) return tooManyRequestsResponse(corsHeaders());

    const { organizationId, confirm } = JSON.parse(event.body || '{}');
    if (!organizationId) {
      return { statusCode: 400, headers: corsHeaders(), body: JSON.stringify({ error: 'Missing organizationId.' }) };
    }
    if (confirm !== 'ERASE') {
      return {
        statusCode: 400,
        headers: corsHeaders(),
        body: JSON.stringify({ error: 'Pass { "confirm": "ERASE" } to acknowledge this action is irreversible.' })
      };
    }

    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .select('id, status, erasure_completed_at')
      .eq('id', organizationId)
      .maybeSingle();
    if (orgError || !org) {
      return { statusCode: 404, headers: corsHeaders(), body: JSON.stringify({ error: 'Organization not found.' }) };
    }
    if (org.status !== 'closed') {
      return {
        statusCode: 409,
        headers: corsHeaders(),
        body: JSON.stringify({ error: `Organization must be closed first (current status: ${org.status}).` })
      };
    }
    if (org.erasure_completed_at) {
      return { statusCode: 409, headers: corsHeaders(), body: JSON.stringify({ error: 'Erasure already completed.' }) };
    }

    // 1. Delete certificate files from storage.
    const { data: files, error: filesError } = await supabase
      .from('certificate_files')
      .select('storage_path')
      .eq('organization_id', organizationId);
    if (filesError) throw filesError;

    if (files?.length) {
      const paths = files.map(f => f.storage_path);
      const { error: removeError } = await supabase.storage.from(CERTIFICATE_BUCKET).remove(paths);
      // Don't abort on a partial storage failure -- log it and continue, so
      // a single missing/already-deleted file doesn't block the rest of
      // erasure. Surface it in the response for manual follow-up.
      if (removeError) {
        console.error('[finalize_account_erasure] storage removal error:', removeError.message);
      }
    }

    // 2. Delete Auth users who belong ONLY to this organization.
    // Users who are also members of another organization keep their login;
    // only their membership row for this org is affected (already handled
    // by ct_platform_set_organization_state, which suspends memberships on
    // closure -- we don't need to touch organization_members here).
    const { data: members, error: membersError } = await supabase
      .from('organization_members')
      .select('user_id')
      .eq('organization_id', organizationId);
    if (membersError) throw membersError;

    const deletedUsers = [];
    const skippedUsers = [];
    for (const member of members || []) {
      const { count, error: otherOrgsError } = await supabase
        .from('organization_members')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', member.user_id)
        .neq('organization_id', organizationId);
      if (otherOrgsError) throw otherOrgsError;

      if (count && count > 0) {
        skippedUsers.push(member.user_id);
        continue;
      }
      const { error: deleteUserError } = await supabase.auth.admin.deleteUser(member.user_id);
      if (deleteUserError) {
        console.error(`[finalize_account_erasure] failed to delete auth user ${member.user_id}:`, deleteUserError.message);
        skippedUsers.push(member.user_id);
      } else {
        deletedUsers.push(member.user_id);
      }
    }

    // 3. Finalize DB-side anonymization.
    const { data: finalized, error: finalizeError } = await supabase.rpc('ct_finalize_erasure', { p_org: organizationId });
    if (finalizeError) throw finalizeError;

    return {
      statusCode: 200,
      headers: corsHeaders(),
      body: JSON.stringify({
        success: true,
        organization: finalized,
        filesRemoved: files?.length || 0,
        usersDeleted: deletedUsers,
        usersSkipped: skippedUsers // still had another org membership, or deletion failed -- check logs
      })
    };
  } catch (err) {
    console.error('[finalize_account_erasure] error:', err);
    try {
      const monitoring = await import('./_lib/monitoring.js');
      monitoring.default.captureError(err, { function: 'finalize_account_erasure' });
    } catch { /* monitoring optional */ }
    return { statusCode: 500, headers: corsHeaders(), body: JSON.stringify({ error: 'Erasure failed. No partial DB state was finalized.' }) };
  }
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  };
}
