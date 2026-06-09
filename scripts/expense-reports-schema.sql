-- RD — Relatório de Despesas
-- Execute após scripts/financials-schema.sql e scripts/access-control-table-rls.sql

create extension if not exists pgcrypto;

-- PIX opcional no perfil do membro (cabeçalho do RD)
alter table public.profiles
  add column if not exists pix_key text;

comment on column public.profiles.pix_key is
  'Chave PIX do membro para reembolso em Relatórios de Despesas (RD).';

create sequence if not exists public.expense_report_number_seq;

create table if not exists public.expense_reports (
  id uuid primary key default gen_random_uuid(),
  report_number text not null,
  user_id uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  total_amount numeric(14, 2) not null default 0,
  pix_key text not null,
  status text not null default 'pending',
  financial_id uuid references public.financials (id) on delete set null,
  constraint expense_reports_report_number_not_blank check (btrim(report_number) <> ''),
  constraint expense_reports_pix_key_not_blank check (btrim(pix_key) <> ''),
  constraint expense_reports_status_check check (status in ('pending', 'reconciled')),
  constraint expense_reports_total_amount_non_negative check (total_amount >= 0)
);

create unique index if not exists idx_expense_reports_report_number
  on public.expense_reports (report_number);

create index if not exists idx_expense_reports_user_id
  on public.expense_reports (user_id, created_at desc);

create index if not exists idx_expense_reports_status
  on public.expense_reports (status, created_at desc);

create index if not exists idx_expense_reports_financial_id
  on public.expense_reports (financial_id)
  where financial_id is not null;

comment on table public.expense_reports is
  'Relatórios de Despesas (RD) enviados por membros à tesouraria.';

create table if not exists public.expense_items (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.expense_reports (id) on delete cascade,
  date date not null,
  description text not null,
  amount numeric(14, 2) not null,
  receipt_url text,
  created_at timestamptz not null default now(),
  constraint expense_items_description_not_blank check (btrim(description) <> ''),
  constraint expense_items_amount_positive check (amount > 0)
);

create index if not exists idx_expense_items_report_id
  on public.expense_items (report_id, date asc);

comment on table public.expense_items is
  'Linhas de despesa vinculadas a um Relatório de Despesas (RD).';

comment on column public.expense_items.receipt_url is
  'Caminho do comprovante no bucket privado financial-docs (ex.: receipts/rd/{report_id}/{item_id}/...).';

create or replace function public.set_updated_at_expense_reports()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_set_updated_at_expense_reports on public.expense_reports;
create trigger trg_set_updated_at_expense_reports
before update on public.expense_reports
for each row
execute function public.set_updated_at_expense_reports();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.expense_reports enable row level security;
alter table public.expense_items enable row level security;

create or replace function public.session_owns_expense_report(p_report_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_report_user_id::text = public.current_session_profile_id()::text;
$$;

create or replace function public.session_can_manage_expense_reports_treasury()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.session_has_resource_access('table', 'financials', 'update');
$$;

drop policy if exists expense_reports_select_acl on public.expense_reports;
create policy expense_reports_select_acl
  on public.expense_reports
  for select
  to anon, authenticated
  using (
    public.session_owns_expense_report(user_id)
    or public.session_can_manage_expense_reports_treasury()
  );

drop policy if exists expense_reports_insert_acl on public.expense_reports;
create policy expense_reports_insert_acl
  on public.expense_reports
  for insert
  to anon, authenticated
  with check (
    public.session_owns_expense_report(user_id)
  );

drop policy if exists expense_reports_update_acl on public.expense_reports;
create policy expense_reports_update_acl
  on public.expense_reports
  for update
  to anon, authenticated
  using (
    (
      public.session_owns_expense_report(user_id)
      and status = 'pending'
    )
    or public.session_can_manage_expense_reports_treasury()
  )
  with check (
    (
      public.session_owns_expense_report(user_id)
      and status = 'pending'
    )
    or public.session_can_manage_expense_reports_treasury()
  );

drop policy if exists expense_items_select_acl on public.expense_items;
create policy expense_items_select_acl
  on public.expense_items
  for select
  to anon, authenticated
  using (
    exists (
      select 1
        from public.expense_reports er
       where er.id = expense_items.report_id
         and (
           public.session_owns_expense_report(er.user_id)
           or public.session_can_manage_expense_reports_treasury()
         )
    )
  );

drop policy if exists expense_items_insert_acl on public.expense_items;
create policy expense_items_insert_acl
  on public.expense_items
  for insert
  to anon, authenticated
  with check (
    exists (
      select 1
        from public.expense_reports er
       where er.id = expense_items.report_id
         and public.session_owns_expense_report(er.user_id)
         and er.status = 'pending'
    )
  );

drop policy if exists expense_items_update_acl on public.expense_items;
create policy expense_items_update_acl
  on public.expense_items
  for update
  to anon, authenticated
  using (
    exists (
      select 1
        from public.expense_reports er
       where er.id = expense_items.report_id
         and (
           (
             public.session_owns_expense_report(er.user_id)
             and er.status = 'pending'
           )
           or public.session_can_manage_expense_reports_treasury()
         )
    )
  )
  with check (
    exists (
      select 1
        from public.expense_reports er
       where er.id = expense_items.report_id
         and (
           (
             public.session_owns_expense_report(er.user_id)
             and er.status = 'pending'
           )
           or public.session_can_manage_expense_reports_treasury()
         )
    )
  );

grant select, insert, update on public.expense_reports to anon, authenticated;
grant select, insert, update on public.expense_items to anon, authenticated;

-- Parâmetro do tesoureiro (WhatsApp)
insert into public.app_parameters (parameter, value)
values ('Tesoureiro_contato', '')
on conflict (parameter) do nothing;

-- Recursos ACL
insert into public.access_resources (resource_type, resource_key, label, description)
values
  ('screen', '/expense-report', 'Relatório de Despesas (RD)', 'Formulário e histórico de RD do membro'),
  ('table', 'expense_reports', 'Relatórios de Despesas', 'RD enviados pelos membros')
on conflict (resource_type, resource_key) do update
  set label = excluded.label,
      description = excluded.description;

insert into public.access_grants (role_id, resource_id, can_view, can_update)
select r.id, res.id, true, true
  from public.access_roles r
 cross join public.access_resources res
 where r.code = 'member'
   and res.resource_type = 'screen'
   and res.resource_key = '/expense-report'
on conflict (role_id, resource_id) where (role_id is not null) do update
  set can_view = excluded.can_view,
      can_update = excluded.can_update,
      updated_at = now();

insert into public.access_grants (role_id, resource_id, can_view, can_update)
select r.id, res.id, true, true
  from public.access_roles r
 cross join public.access_resources res
 where r.code = 'member'
   and res.resource_type = 'table'
   and res.resource_key = 'expense_reports'
on conflict (role_id, resource_id) where (role_id is not null) do update
  set can_view = excluded.can_view,
      can_update = excluded.can_update,
      updated_at = now();

notify pgrst, 'reload schema';
