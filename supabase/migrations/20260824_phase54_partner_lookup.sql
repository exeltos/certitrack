-- Phase 54 — Add the missing ct_find_partner_candidate() function.
--
-- src/services/organizationService.js has always called
-- supabase.rpc('ct_find_partner_candidate', {p_lookup: term}) as a
-- read-only "preview" step before sending a partner invitation (so the UI
-- can show "is this the organization you mean?" before committing). This
-- function was never actually created anywhere in the schema -- every call
-- failed with a PostgREST "function not found" error, meaning the entire
-- "add partner" flow never got past the first step.
--
-- Mirrors the exact lookup logic already used inside
-- ct_create_relationship_invitation() (match by contact_email or
-- normalized VAT number, active + not-deleted organizations only).
-- Read-only, no side effects.

create or replace function public.ct_find_partner_candidate(p_lookup text)
returns table(id uuid, name text, afm text, email text)
language sql
stable
security definer
set search_path = public
as $$
  select o.id,
         coalesce(o.display_name, o.legal_name) as name,
         o.vat_number as afm,
         o.contact_email as email
  from public.organizations o
  where o.deleted_at is null
    and o.status = 'active'
    and (
      lower(o.contact_email) = lower(trim(p_lookup))
      or public.ct_normalize_vat(o.vat_number) = public.ct_normalize_vat(p_lookup)
    )
  limit 1;
$$;

grant execute on function public.ct_find_partner_candidate(text) to authenticated;

-- Verification query (run manually after applying):
--   select proname from pg_proc where proname = 'ct_find_partner_candidate';
