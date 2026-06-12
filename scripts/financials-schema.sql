-- Tabela public.financials (lançamentos importados de financeiro.csv)
-- Execute antes de scripts/financials-import.sql (gerado por generate-financials-import.mjs)

create extension if not exists pgcrypto;

create table if not exists public.financials (
  id uuid primary key default gen_random_uuid(),
  transaction_date date not null,
  account text not null,
  amount numeric(14, 2) not null,
  ministry text not null,
  transaction_kind text not null,
  movement text not null,
  budget_version text not null,
  comments text,
  source_row integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint financials_account_not_blank check (btrim(account) <> ''),
  constraint financials_ministry_not_blank check (btrim(ministry) <> ''),
  constraint financials_transaction_kind_not_blank check (btrim(transaction_kind) <> ''),
  constraint financials_movement_not_blank check (btrim(movement) <> ''),
  constraint financials_budget_version_not_blank check (btrim(budget_version) <> '')
);

comment on table public.financials is
  'Lançamentos financeiros (planejado/realizado) importados do CSV da tesouraria.';

comment on column public.financials.transaction_date is 'Coluna DATA do CSV (YYYY/MM/DD).';
comment on column public.financials.account is 'Coluna CONTA do CSV.';
comment on column public.financials.amount is 'Coluna VALOR do CSV.';
comment on column public.financials.ministry is 'Coluna MINISTÉRIO do CSV.';
comment on column public.financials.transaction_kind is 'Coluna TRANSAÇÃO: ENTRADAS, SAÍDAS, ENTRE CONTAS.';
comment on column public.financials.movement is 'Coluna MOVIMENTO: ORDINÁRIO, EXTRAORDINÁRIO.';
comment on column public.financials.budget_version is 'Coluna VERSAO: PLANEJADO, REALIZADO.';
comment on column public.financials.comments is 'Observações opcionais do lançamento.';
comment on column public.financials.source_row is 'Número da linha no arquivo CSV de origem.';

alter table public.financials
  add column if not exists comments text;

-- Se a coluna existir como "Comments" (PascalCase), padronize com:
-- scripts/financials-comments-column-normalize.sql

create index if not exists idx_financials_transaction_date
  on public.financials (transaction_date desc);

create index if not exists idx_financials_account
  on public.financials (account);

create index if not exists idx_financials_ministry
  on public.financials (ministry);

create index if not exists idx_financials_budget_version
  on public.financials (budget_version);

create or replace function public.set_updated_at_financials()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_set_updated_at_financials on public.financials;
create trigger trg_set_updated_at_financials
before update on public.financials
for each row
execute function public.set_updated_at_financials();

alter table public.financials enable row level security;

drop policy if exists financials_select_authenticated on public.financials;
create policy financials_select_authenticated
  on public.financials
  for select
  to authenticated
  using (true);

drop policy if exists financials_select_anon on public.financials;
create policy financials_select_anon
  on public.financials
  for select
  to anon
  using (true);

grant select on public.financials to anon, authenticated;
