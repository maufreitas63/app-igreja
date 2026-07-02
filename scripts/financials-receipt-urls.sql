-- Coluna receipt_urls e RPC para até 3 comprovantes por lançamento.
-- Execute no Supabase SQL Editor (uma vez).
--
-- Pré-requisitos: scripts/financials-schema.sql e scripts/financials-maintenance-rpc.sql
-- (ou ao menos a tabela public.financials com receipt_url).
--
-- Após executar: recarregue o schema do PostgREST em
-- Settings → API → Reload schema (se o erro persistir no app).

alter table public.financials
  add column if not exists receipt_url text;

comment on column public.financials.receipt_url is
  'Caminho do comprovante principal (primeiro da lista receipt_urls) no bucket privado financial-docs.';

alter table public.financials
  add column if not exists receipt_urls jsonb not null default '[]'::jsonb;

comment on column public.financials.receipt_urls is
  'Lista de caminhos de comprovantes (máx. 3) no bucket financial-docs.';

update public.financials f
set receipt_urls = jsonb_build_array(trim(f.receipt_url))
where coalesce(trim(f.receipt_url), '') <> ''
  and (
    f.receipt_urls is null
    or f.receipt_urls = '[]'::jsonb
    or jsonb_array_length(f.receipt_urls) = 0
  );

create or replace function public.normalize_financial_receipt_urls(p_receipt_urls jsonb)
returns jsonb
language plpgsql
immutable
as $$
declare
  v_item jsonb;
  v_url text;
  v_result jsonb := '[]'::jsonb;
  v_seen text[] := array[]::text[];
begin
  if p_receipt_urls is null or jsonb_typeof(p_receipt_urls) <> 'array' then
    return '[]'::jsonb;
  end if;

  for v_item in select value from jsonb_array_elements(p_receipt_urls)
  loop
    v_url := nullif(trim(both from coalesce(v_item #>> '{}', '')), '');

    if v_url is null or v_url = any(v_seen) then
      continue;
    end if;

    v_seen := array_append(v_seen, v_url);
    v_result := v_result || jsonb_build_array(to_jsonb(v_url));

    if jsonb_array_length(v_result) >= 3 then
      exit;
    end if;
  end loop;

  return v_result;
end;
$$;

create or replace function public.financials_sync_receipt_url_columns()
returns trigger
language plpgsql
as $$
begin
  if jsonb_array_length(public.normalize_financial_receipt_urls(coalesce(NEW.receipt_urls, '[]'::jsonb))) = 0
     and coalesce(trim(NEW.receipt_url), '') <> '' then
    NEW.receipt_urls := jsonb_build_array(trim(NEW.receipt_url));
  end if;

  NEW.receipt_urls := public.normalize_financial_receipt_urls(NEW.receipt_urls);
  NEW.receipt_url := nullif(trim(coalesce(NEW.receipt_urls->>0, '')), '');

  return NEW;
end;
$$;

drop trigger if exists trg_financials_sync_receipt_url_columns on public.financials;
create trigger trg_financials_sync_receipt_url_columns
before insert or update of receipt_url, receipt_urls on public.financials
for each row
execute function public.financials_sync_receipt_url_columns();

drop function if exists public.atualizar_comprovante_lancamento_financeiro(uuid, jsonb);

create or replace function public.atualizar_comprovante_lancamento_financeiro(
  p_id uuid,
  p_receipt_urls jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_updated integer;
  v_receipt_urls jsonb;
begin
  if p_id is null then
    return jsonb_build_object('success', false, 'message', 'Lançamento não informado.');
  end if;

  if not public.session_has_resource_access('table', 'financials', 'update') then
    return jsonb_build_object('success', false, 'message', 'Sem permissão para alterar lançamentos financeiros.');
  end if;

  v_receipt_urls := public.normalize_financial_receipt_urls(coalesce(p_receipt_urls, '[]'::jsonb));

  if jsonb_array_length(v_receipt_urls) > 3 then
    return jsonb_build_object('success', false, 'message', 'Cada lançamento aceita no máximo 3 comprovantes.');
  end if;

  update public.financials f
  set
    receipt_urls = v_receipt_urls,
    receipt_url = nullif(trim(coalesce(v_receipt_urls->>0, '')), ''),
    updated_at = now()
  where f.id = p_id;

  get diagnostics v_updated = row_count;

  if v_updated = 0 then
    return jsonb_build_object('success', false, 'message', 'Nenhum lançamento foi atualizado.');
  end if;

  return jsonb_build_object(
    'success', true,
    'message',
    case
      when jsonb_array_length(v_receipt_urls) = 0 then 'Comprovante removido.'
      when jsonb_array_length(v_receipt_urls) = 1 then 'Comprovante anexado.'
      else 'Comprovantes atualizados.'
    end,
    'id', p_id,
    'receipt_url', nullif(trim(coalesce(v_receipt_urls->>0, '')), ''),
    'receipt_urls', v_receipt_urls
  );
end;
$$;

create or replace function public.atualizar_comprovante_lancamento_financeiro(
  p_id uuid,
  p_receipt_url text
)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select public.atualizar_comprovante_lancamento_financeiro(
    p_id,
    case
      when nullif(trim(coalesce(p_receipt_url, '')), '') is null then '[]'::jsonb
      else jsonb_build_array(trim(p_receipt_url))
    end
  );
$$;

grant execute on function public.atualizar_comprovante_lancamento_financeiro(uuid, jsonb) to anon, authenticated;
grant execute on function public.atualizar_comprovante_lancamento_financeiro(uuid, text) to anon, authenticated;

-- Atualiza listagem para expor receipt_urls (se a função já existir com RD).
create or replace function public.listar_lancamentos_financeiros_periodo(
  p_periodo text,
  p_referencia date
)
returns table (
  id uuid,
  transaction_date date,
  account text,
  amount numeric,
  ministry text,
  transaction_kind text,
  movement text,
  budget_version text,
  comments text,
  receipt_url text,
  receipt_urls jsonb,
  referencia text,
  expense_report_id uuid,
  expense_report_number text,
  source_row integer,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not (
    public.session_has_resource_access('table', 'financials', 'view')
    or public.session_has_screen_access('maintenance.card.financials', 'view')
  ) then
    return;
  end if;

  return query
  with bounds as (
    select b.start_date, b.end_date_exclusive
    from public.financials_period_bounds(p_periodo, p_referencia) b
  )
  select
    f.id,
    f.transaction_date,
    f.account,
    f.amount,
    f.ministry,
    f.transaction_kind,
    f.movement,
    f.budget_version,
    f.comments,
    f.receipt_url,
    f.receipt_urls,
    f.referencia,
    er.id as expense_report_id,
    er.report_number as expense_report_number,
    f.source_row,
    f.created_at,
    f.updated_at
  from public.financials f
  left join public.expense_reports er
    on er.financial_id = f.id
   and er.status = 'reconciled'
  cross join bounds b
  where f.transaction_date >= b.start_date
    and f.transaction_date < b.end_date_exclusive
  order by
    f.transaction_kind asc,
    f.transaction_date asc,
    f.account asc,
    f.movement asc,
    f.ministry asc;
end;
$$;

grant execute on function public.listar_lancamentos_financeiros_periodo(text, date) to anon, authenticated;
