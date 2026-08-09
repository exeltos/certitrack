-- CertiTrack Phase 3A: tenant isolation + certificate ownership foundation
-- IMPORTANT: run this migration before deploying the Phase 3 frontend.
-- It preserves legacy columns so existing data remains compatible.

begin;

-- 1) Normalize relationship data without changing the current UI contract.
update public.company_suppliers set access = 'granted' where access is null or btrim(access) = '';
update public.company_suppliers set status = 'active' where status is null or btrim(status) = '';

-- Remove accidental duplicate links before adding the uniqueness constraint.
delete from public.company_suppliers a
using public.company_suppliers b
where a.id > b.id
  and a.company_id = b.company_id
  and a.supplier_id = b.supplier_id;

create unique index if not exists company_suppliers_company_supplier_uidx
  on public.company_suppliers(company_id, supplier_id);

-- 2) Add stable organization ownership to certificates while retaining legacy user ownership.
alter table public.company_certificates add column if not exists company_id uuid;
alter table public.supplier_certificates add column if not exists supplier_id uuid;

update public.company_certificates cc
set company_id = c.id
from public.companies c
where cc.company_id is null and c.user_id = cc.company_user_id;

update public.supplier_certificates sc
set supplier_id = s.id
from public.suppliers s
where sc.supplier_id is null and s.user_id = sc.supplier_user_id;

do $$ begin
  alter table public.company_certificates
    add constraint company_certificates_company_id_fkey
    foreign key (company_id) references public.companies(id) on delete cascade;
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.supplier_certificates
    add constraint supplier_certificates_supplier_id_fkey
    foreign key (supplier_id) references public.suppliers(id) on delete cascade;
exception when duplicate_object then null; end $$;

create index if not exists company_certificates_company_id_idx on public.company_certificates(company_id);
create index if not exists supplier_certificates_supplier_id_idx on public.supplier_certificates(supplier_id);
create index if not exists company_suppliers_company_id_idx on public.company_suppliers(company_id);
create index if not exists company_suppliers_supplier_id_idx on public.company_suppliers(supplier_id);

-- 3) Fix notification relationships. A company must be able to have many notifications.
alter table public.company_notifications drop constraint if exists company_notifications_company_id_key;

do $$ begin
  alter table public.company_notifications
    add constraint company_notifications_company_id_fkey
    foreign key (company_id) references public.companies(id) on delete cascade;
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.company_notifications
    add constraint company_notifications_company_certificate_id_fkey
    foreign key (company_certificate_id) references public.company_certificates(id) on delete cascade;
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.company_notifications
    add constraint company_notifications_supplier_certificate_id_fkey
    foreign key (supplier_certificate_id) references public.supplier_certificates(id) on delete cascade;
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.supplier_notifications
    add constraint supplier_notifications_supplier_id_fkey
    foreign key (supplier_id) references public.suppliers(id) on delete cascade;
exception when duplicate_object then null; end $$;

-- 4) Invitations need an owning company. Existing rows remain valid and can be backfilled later.
alter table public.supplier_invites add column if not exists company_id uuid;
alter table public.supplier_invites add column if not exists accepted_at timestamptz;
alter table public.supplier_invites add column if not exists revoked_at timestamptz;
do $$ begin
  alter table public.supplier_invites
    add constraint supplier_invites_company_id_fkey
    foreign key (company_id) references public.companies(id) on delete cascade;
exception when duplicate_object then null; end $$;

-- 5) RLS: replace conflicting permissive policies with one clear rule per operation.
alter table public.companies enable row level security;
alter table public.suppliers enable row level security;
alter table public.company_certificates enable row level security;
alter table public.supplier_certificates enable row level security;
alter table public.company_suppliers enable row level security;
alter table public.supplier_invites enable row level security;
alter table public.supplier_notifications enable row level security;
alter table public.company_notifications enable row level security;

do $$
declare r record;
begin
  for r in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in (
        'companies','suppliers','company_certificates','supplier_certificates',
        'company_suppliers','supplier_invites','supplier_notifications','company_notifications'
      )
  loop
    execute format('drop policy if exists %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end $$;

-- Companies: a company user sees/changes only its own company.
create policy companies_select_own on public.companies
for select to authenticated
using (user_id = auth.uid());

create policy companies_insert_own on public.companies
for insert to authenticated
with check (user_id = auth.uid());

create policy companies_update_own on public.companies
for update to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy companies_delete_own on public.companies
for delete to authenticated
using (user_id = auth.uid());

-- Suppliers:
-- supplier sees itself; a company sees only suppliers connected to that company.
create policy suppliers_select_allowed on public.suppliers
for select to authenticated
using (
  user_id = auth.uid()
  or exists (
    select 1
    from public.company_suppliers cs
    join public.companies c on c.id = cs.company_id
    where cs.supplier_id = suppliers.id
      and c.user_id = auth.uid()
  )
);

-- Keep registration/import compatible. Inserts are validated by the application;
-- UPDATE/DELETE remain owner-only. Tightening INSERT further is a later server-side registration step.
create policy suppliers_insert_authenticated on public.suppliers
for insert to authenticated
with check (true);

create policy suppliers_update_own on public.suppliers
for update to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy suppliers_delete_own on public.suppliers
for delete to authenticated
using (user_id = auth.uid());

-- Company ↔ supplier relationships:
-- Company sees only its links. Supplier sees only links where it is the supplier.
create policy company_suppliers_select_members on public.company_suppliers
for select to authenticated
using (
  exists (
    select 1 from public.companies c
    where c.id = company_suppliers.company_id and c.user_id = auth.uid()
  )
  or exists (
    select 1 from public.suppliers s
    where s.id = company_suppliers.supplier_id and s.user_id = auth.uid()
  )
);

create policy company_suppliers_insert_company on public.company_suppliers
for insert to authenticated
with check (
  exists (
    select 1 from public.companies c
    where c.id = company_suppliers.company_id and c.user_id = auth.uid()
  )
);

-- Both sides may update their own relationship row because the current supplier UI controls access.
create policy company_suppliers_update_members on public.company_suppliers
for update to authenticated
using (
  exists (
    select 1 from public.companies c
    where c.id = company_suppliers.company_id and c.user_id = auth.uid()
  )
  or exists (
    select 1 from public.suppliers s
    where s.id = company_suppliers.supplier_id and s.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.companies c
    where c.id = company_suppliers.company_id and c.user_id = auth.uid()
  )
  or exists (
    select 1 from public.suppliers s
    where s.id = company_suppliers.supplier_id and s.user_id = auth.uid()
  )
);

create policy company_suppliers_delete_company on public.company_suppliers
for delete to authenticated
using (
  exists (
    select 1 from public.companies c
    where c.id = company_suppliers.company_id and c.user_id = auth.uid()
  )
);

-- Company certificates: company only.
create policy company_certificates_select_own on public.company_certificates
for select to authenticated
using (
  exists (
    select 1 from public.companies c
    where c.id = company_certificates.company_id and c.user_id = auth.uid()
  )
  or company_user_id = auth.uid()
);

create policy company_certificates_insert_own on public.company_certificates
for insert to authenticated
with check (
  exists (
    select 1 from public.companies c
    where c.id = company_certificates.company_id and c.user_id = auth.uid()
  )
  and company_user_id = auth.uid()
);

create policy company_certificates_update_own on public.company_certificates
for update to authenticated
using (company_user_id = auth.uid())
with check (company_user_id = auth.uid());

create policy company_certificates_delete_own on public.company_certificates
for delete to authenticated
using (company_user_id = auth.uid());

-- Supplier certificates:
-- supplier sees all own certificates.
-- connected companies see only shared certificates and only while access is granted.
create policy supplier_certificates_select_allowed on public.supplier_certificates
for select to authenticated
using (
  supplier_user_id = auth.uid()
  or (
    coalesce(is_private, false) = false
    and exists (
      select 1
      from public.company_suppliers cs
      join public.companies c on c.id = cs.company_id
      where cs.supplier_id = supplier_certificates.supplier_id
        and c.user_id = auth.uid()
        and coalesce(cs.access, 'granted') <> 'blocked'
    )
  )
);

create policy supplier_certificates_insert_own on public.supplier_certificates
for insert to authenticated
with check (
  supplier_user_id = auth.uid()
  and exists (
    select 1 from public.suppliers s
    where s.id = supplier_certificates.supplier_id and s.user_id = auth.uid()
  )
);

create policy supplier_certificates_update_own on public.supplier_certificates
for update to authenticated
using (supplier_user_id = auth.uid())
with check (supplier_user_id = auth.uid());

create policy supplier_certificates_delete_own on public.supplier_certificates
for delete to authenticated
using (supplier_user_id = auth.uid());

-- Supplier sees which companies have saved it; companies never get a reverse-directory view.
-- Invites are readable by the invited email and creatable by a company for itself.
create policy supplier_invites_select_invited on public.supplier_invites
for select to authenticated
using (email = auth.email());

create policy supplier_invites_insert_company on public.supplier_invites
for insert to authenticated
with check (
  company_id is not null
  and exists (
    select 1 from public.companies c
    where c.id = supplier_invites.company_id and c.user_id = auth.uid()
  )
);

-- Notifications.
create policy supplier_notifications_delete_own on public.supplier_notifications
for delete to authenticated
using (
  exists (
    select 1 from public.suppliers s
    where s.id = supplier_notifications.supplier_id and s.user_id = auth.uid()
  )
);
create policy supplier_notifications_select_own on public.supplier_notifications
for select to authenticated
using (
  exists (
    select 1 from public.suppliers s
    where s.id = supplier_notifications.supplier_id and s.user_id = auth.uid()
  )
);

create policy company_notifications_select_own on public.company_notifications
for select to authenticated
using (
  exists (
    select 1 from public.companies c
    where c.id = company_notifications.company_id and c.user_id = auth.uid()
  )
);
create policy company_notifications_delete_own on public.company_notifications
for delete to authenticated
using (
  exists (
    select 1 from public.companies c
    where c.id = company_notifications.company_id and c.user_id = auth.uid()
  )
);

-- service_role bypasses RLS; scheduled functions do not need public policies.

commit;
