-- Phase 52 — Support for final account erasure (GDPR right-to-erasure),
-- distinct from organization "closure" (deactivation, already implemented
-- by ct_platform_set_organization_state / ct_request_organization_closure).
--
-- Closure keeps all data intact (for audit/legal retention -- see
-- docs/legal/DATA_RETENTION_POLICY.md) and is reversible by a platform
-- admin. Erasure is the separate, IRREVERSIBLE step that actually removes
-- personal data and files once retention requirements are satisfied and a
-- human has confirmed the request. This migration only adds the tracking
-- column and a narrowly-scoped SQL finalizer; see
-- netlify/functions/finalize_account_erasure.js for the function that
-- orchestrates storage + Supabase Auth user deletion and calls this.

alter table public.organizations add column if not exists erasure_completed_at timestamptz;
alter table public.organizations add column if not exists erasure_completed_by uuid references auth.users(id) on delete set null;

-- Finalizes DB-side erasure bookkeeping for an already-CLOSED organization.
-- Does NOT touch storage.objects or auth.users -- those must already have
-- been deleted by the caller (the Netlify function, using the Storage and
-- Auth Admin APIs) before this is called, since Postgres alone can't do
-- either of those.
--
-- Deliberately restricted to the service role: this is the last step of a
-- destructive, human-confirmed workflow, not something to expose to any
-- authenticated user or even to platform admins directly via RPC.
create or replace function public.ct_finalize_erasure(p_org uuid)
returns public.organizations
language plpgsql security definer set search_path=public
as $$
declare o public.organizations;
begin
  select * into o from public.organizations where id = p_org for update;
  if o.id is null then
    raise exception 'Organization not found';
  end if;
  if o.status <> 'closed' then
    raise exception 'Organization must be closed before erasure (current status: %)', o.status;
  end if;
  if o.erasure_completed_at is not null then
    raise exception 'Erasure already completed for this organization';
  end if;

  -- Anonymize identifying fields while keeping the row (and its id) for
  -- audit_log referential integrity and any legally-required record that
  -- an account existed and was erased on a given date.
  --
  -- vat_number is deliberately NOT cleared: it's a tax/company identifier
  -- (not personal data in the GDPR sense for a legal entity), the column is
  -- NOT NULL with a format constraint, and Greek accounting law generally
  -- requires retaining VAT-linked records independent of a platform account
  -- being erased. Confirm this assumption with counsel before relying on it.
  update public.organizations set
    legal_name = 'Erased organization',
    display_name = 'Erased organization',
    contact_email = null,
    phone = null,
    website = null,
    address_line1 = null,
    address_line2 = null,
    city = null,
    postal_code = null,
    erasure_completed_at = now(),
    erasure_completed_by = auth.uid(),
    updated_at = now()
  where id = p_org
  returning * into o;

  perform public.ct_write_audit(p_org, 'erasure_completed', 'organization', p_org::text, null,
    jsonb_build_object('erased_at', o.erasure_completed_at), '{}'::jsonb, auth.uid());

  return o;
end;
$$;

revoke all on function public.ct_finalize_erasure(uuid) from public, authenticated, anon;
-- No grant to authenticated: only callable with the service-role key.

-- Verification query (run manually):
--   select id, status, erasure_completed_at from public.organizations where erasure_completed_at is not null;
