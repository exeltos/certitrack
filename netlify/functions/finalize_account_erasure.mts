// Finalizes a GDPR-style erasure request for an organization that has
// already gone through the (reversible) closure flow
// (ct_platform_set_organization_state / status = 'closed').
//
// This is the IRREVERSIBLE step: it deletes certificate files from storage
// and deletes Supabase Auth users who have no other organization
// membership, then calls ct_finalize_erasure() to anonymize the DB row.
//
// Restricted to platform admins, and only for organizations already in
// 'closed' status, as a guard against skipping the review step.
//
// IMPORTANT: this has not been run against a live database. Test against a
// staging project (docs/operations/STAGING_SETUP.md) with disposable data
// before relying on it in production.
import { createClient } from '@supabase/supabase-js';
import { checkRateLimit, clientIp, tooManyRequestsResponse, type FunctionEvent, type FunctionResponse } from './_lib/rateLimit.mts';
import { captureError } from './_lib/monitoring.mts';

const supabase = createClient(process.env.SUPABASE_URL ?? '', process.env.SUPABASE_SERVICE_ROLE_KEY ?? '');
const CERTIFICATE_BUCKET = 'organizationcertificates';

const corsHeaders = (): Record<string, string> => ({
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization'
});
const json = (statusCode: number, body: unknown): FunctionResponse => ({ statusCode, headers: corsHeaders(), body: JSON.stringify(body) });

export async function handler(event: FunctionEvent): Promise<FunctionResponse> {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: corsHeaders() };
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

  try {
    const authHeader = event.headers?.authorization || event.headers?.Authorization || '';
    const accessToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    if (!accessToken) return json(401, { error: 'Authentication required.' });

    const { data: authData, error: authError } = await supabase.auth.getUser(accessToken);
    if (authError || !authData?.user) return json(401, { error: 'Invalid session.' });

    const { data: isAdmin, error: adminError } = await supabase.rpc('ct_is_platform_admin', { p_user: authData.user.id });
    if (adminError || isAdmin !== true) return json(403, { error: 'Platform administrator required.' });

    const allowed = await checkRateLimit(supabase, `finalize_erasure:${clientIp(event)}`, 10, 60 * 60);
    if (!allowed) return tooManyRequestsResponse(corsHeaders());

    const { organizationId, confirm } = JSON.parse(event.body || '{}') as { organizationId?: string; confirm?: string };
    if (!organizationId) return json(400, { error: 'Missing organizationId.' });
    if (confirm !== 'ERASE') return json(400, { error: 'Pass { "confirm": "ERASE" } to acknowledge this action is irreversible.' });

    const { data: org, error: orgError } = await supabase
      .from('organizations').select('id, status, erasure_completed_at').eq('id', organizationId).maybeSingle();
    if (orgError || !org) return json(404, { error: 'Organization not found.' });
    if (org.status !== 'closed') return json(409, { error: `Organization must be closed first (current status: ${org.status}).` });
    if (org.erasure_completed_at) return json(409, { error: 'Erasure already completed.' });

    // 1. Delete certificate files from storage. A missing file must not block
    // the rest of the erasure: it is logged for manual follow-up.
    const { data: files, error: filesError } = await supabase
      .from('certificate_files').select('storage_path').eq('organization_id', organizationId);
    if (filesError) throw filesError;
    if (files?.length) {
      const { error: removeError } = await supabase.storage.from(CERTIFICATE_BUCKET).remove(files.map(f => f.storage_path as string));
      if (removeError) console.error('[finalize_account_erasure] storage removal error:', removeError.message);
    }

    // 2. Delete Auth users who belong ONLY to this organization. Users with
    // another membership keep their login.
    const { data: members, error: membersError } = await supabase
      .from('organization_members').select('user_id').eq('organization_id', organizationId);
    if (membersError) throw membersError;

    const deletedUsers: string[] = [];
    const skippedUsers: string[] = [];
    for (const member of members ?? []) {
      const userId = member.user_id as string;
      const { count, error: otherOrgsError } = await supabase
        .from('organization_members').select('id', { count: 'exact', head: true })
        .eq('user_id', userId).neq('organization_id', organizationId);
      if (otherOrgsError) throw otherOrgsError;
      if (count && count > 0) { skippedUsers.push(userId); continue; }
      const { error: deleteUserError } = await supabase.auth.admin.deleteUser(userId);
      if (deleteUserError) {
        console.error(`[finalize_account_erasure] failed to delete auth user ${userId}:`, deleteUserError.message);
        skippedUsers.push(userId);
      } else {
        deletedUsers.push(userId);
      }
    }

    // 3. Finalize the anonymization in the database.
    const { data: finalized, error: finalizeError } = await supabase.rpc('ct_finalize_erasure', { p_org: organizationId });
    if (finalizeError) throw finalizeError;

    return json(200, {
      success: true,
      organization: finalized,
      filesRemoved: files?.length ?? 0,
      usersDeleted: deletedUsers,
      usersSkipped: skippedUsers   // another membership, or deletion failed (see logs)
    });
  } catch (err) {
    console.error('[finalize_account_erasure] error:', err);
    await captureError(err, { function: 'finalize_account_erasure' }).catch(() => {});
    return json(500, { error: 'Erasure failed. No partial DB state was finalized.' });
  }
}
