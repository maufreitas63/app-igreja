-- Campo referencia em public.financials (nome do JPG de comprovante).
-- Execute no Supabase SQL Editor após scripts/financials-schema.sql e
-- scripts/financials-maintenance-rpc.sql.
--
-- Padrão: aaaammdd + espaço + valor absoluto (nnnn,nn) + .jpg
-- Exemplo: 20260526 3825,00.jpg

alter table public.financials
  add column if not exists referencia text;

comment on column public.financials.referencia is
  'Nome do arquivo JPG de comprovante: aaaammdd nnnn,nn.jpg (derivado de transaction_date e amount).';

create or replace function public.build_financial_referencia(
  p_transaction_date date,
  p_amount numeric
)
returns text
language sql
immutable
as $$
  select
    to_char(p_transaction_date, 'YYYYMMDD')
    || ' '
    || replace(to_char(abs(coalesce(p_amount, 0)), 'FM999999990.00'), '.', ',')
    || '.jpg';
$$;

comment on function public.build_financial_referencia(date, numeric) is
  'Monta o nome do JPG: aaaammdd nnnn,nn.jpg a partir da data e do valor absoluto.';

-- Preenche registros existentes.
update public.financials f
set referencia = public.build_financial_referencia(f.transaction_date, f.amount)
where f.referencia is distinct from public.build_financial_referencia(f.transaction_date, f.amount);

create or replace function public.set_financial_referencia()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT'
    or new.transaction_date is distinct from old.transaction_date
    or new.amount is distinct from old.amount
  then
    new.referencia := public.build_financial_referencia(new.transaction_date, new.amount);
  end if;

  return new;
end;
$$;

drop trigger if exists trg_set_financial_referencia on public.financials;

create trigger trg_set_financial_referencia
before insert or update of transaction_date, amount
on public.financials
for each row
execute function public.set_financial_referencia();
