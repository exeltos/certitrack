-- CertiTrack Phase 31 — richer certificate metadata.
-- Safe additive migration. Run after phase28_organization_network.sql.

alter table public.certificates add column if not exists issue_date date;
alter table public.certificates add column if not exists certificate_number text;
alter table public.certificates add column if not exists issuer text;
alter table public.certificates add column if not exists notes text;

create index if not exists certificates_org_expiry_idx on public.certificates (organization_id, date);
create index if not exists certificates_org_number_idx on public.certificates (organization_id, certificate_number);
