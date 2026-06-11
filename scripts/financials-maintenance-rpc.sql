-- Manutenção: lançamentos em public.financials por dia ou mês.
-- Execute após scripts/financials-schema.sql

drop function if exists public.listar_lancamentos_financeiros_periodo(text, date);
drop function if exists public.cadastrar_lancamento_financeiro(date, text, numeric, text, text, text, text);
drop function if exists public.carga_lote_lancamentos_financeiros(text, date, jsonb, boolean);
drop function if exists public.excluir_lancamento_financeiro(uuid);
drop function if exists public.excluir_lancamentos_financeiros_periodo(text, date);
drop function if exists public.atualizar_comentario_lancamento_financeiro(uuid, text);
drop function if exists public.atualizar_comprovante_lancamento_financeiro(uuid, text);
drop function if exists public.atualizar_lancamento_financeiro(uuid, date, text, numeric, text, text, text, text);

alter table public.financials
  add column if not exists receipt_url text;

comment on column public.financials.receipt_url is
  'Caminho do comprovante no bucket privado financial-docs (ex.: receipts/{id}/{timestamp}.jpg).';

create or replace function public.financials_period_bounds(
  p_periodo text,
  p_referencia date
)
returns table (start_date date, end_date_exclusive date)
language sql
immutable
as $$
  select
    case
      when lower(trim(coalesce(p_periodo, ''))) = 'dia' then p_referencia
      else date_trunc('month', p_referencia)::date
    end as start_date,
    case
      when lower(trim(coalesce(p_periodo, ''))) = 'dia' then (p_referencia + 1)
      else (date_trunc('month', p_referencia) + interval '1 month')::date
    end as end_date_exclusive;
$$;

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
  source_row integer,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
security definer
set search_path = public
as $$
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
    f.source_row,
    f.created_at,
    f.updated_at
  from public.financials f
  cross join bounds b
  where f.transaction_date >= b.start_date
    and f.transaction_date < b.end_date_exclusive
  order by
    f.transaction_kind asc,
    f.transaction_date asc,
    f.account asc,
    f.movement asc,
    f.ministry asc;
$$;

create or replace function public.cadastrar_lancamento_financeiro(
  p_transaction_date date,
  p_account text,
  p_amount numeric,
  p_ministry text,
  p_transaction_kind text,
  p_movement text,
  p_budget_version text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_account text;
  v_ministry text;
  v_transaction_kind text;
  v_movement text;
  v_budget_version text;
begin
  if p_transaction_date is null then
    return jsonb_build_object('success', false, 'message', 'Informe a data do lançamento.');
  end if;

  v_account := trim(coalesce(p_account, ''));
  v_ministry := trim(coalesce(p_ministry, ''));
  v_transaction_kind := trim(coalesce(p_transaction_kind, ''));
  v_movement := trim(coalesce(p_movement, ''));
  v_budget_version := trim(coalesce(p_budget_version, ''));

  if v_account = '' then
    return jsonb_build_object('success', false, 'message', 'Informe a conta.');
  end if;

  if v_ministry = '' then
    return jsonb_build_object('success', false, 'message', 'Informe o ministério.');
  end if;

  if v_transaction_kind = '' then
    return jsonb_build_object('success', false, 'message', 'Informe o tipo de transação.');
  end if;

  if v_movement = '' then
    return jsonb_build_object('success', false, 'message', 'Informe o movimento.');
  end if;

  if v_budget_version = '' then
    return jsonb_build_object('success', false, 'message', 'Informe a versão (planejado/realizado).');
  end if;

  if p_amount is null then
    return jsonb_build_object('success', false, 'message', 'Informe o valor.');
  end if;

  insert into public.financials (
    transaction_date,
    account,
    amount,
    ministry,
    transaction_kind,
    movement,
    budget_version
  )
  values (
    p_transaction_date,
    v_account,
    p_amount,
    v_ministry,
    v_transaction_kind,
    v_movement,
    v_budget_version
  )
  returning id into v_id;

  return jsonb_build_object(
    'success', true,
    'message', 'Lançamento cadastrado.',
    'id', v_id
  );
end;
$$;

drop function if exists public.carga_lote_lancamentos_financeiros(text, date, jsonb, boolean);
drop function if exists public.carga_lote_lancamentos_financeiros(text, date, jsonb, boolean, text);

create or replace function public.carga_lote_lancamentos_financeiros(
  p_periodo text,
  p_referencia date,
  p_rows jsonb,
  p_substituir boolean default true,
  p_budget_version text default 'REALIZADO'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_periodo text;
  v_budget_version text;
  v_inserted integer;
  v_deleted integer := 0;
begin
  v_periodo := lower(trim(coalesce(p_periodo, '')));
  v_budget_version := upper(trim(coalesce(p_budget_version, '')));

  if v_periodo not in ('dia', 'mes') then
    return jsonb_build_object('success', false, 'message', 'Período inválido. Use dia ou mes.');
  end if;

  if p_referencia is null then
    return jsonb_build_object('success', false, 'message', 'Informe a data de referência do período.');
  end if;

  if v_budget_version = '' then
    return jsonb_build_object('success', false, 'message', 'Informe a versão (REALIZADO ou PLANEJADO).');
  end if;

  if p_rows is null or jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) = 0 then
    return jsonb_build_object('success', false, 'message', 'Nenhum lançamento válido para importar.');
  end if;

  if coalesce(p_substituir, false) then
    delete from public.financials f
    using public.financials_period_bounds(p_periodo, p_referencia) b
    where f.transaction_date >= b.start_date
      and f.transaction_date < b.end_date_exclusive
      and upper(trim(f.budget_version)) = v_budget_version;

    get diagnostics v_deleted = row_count;
  end if;

  insert into public.financials (
    transaction_date,
    account,
    amount,
    ministry,
    transaction_kind,
    movement,
    budget_version,
    comments,
    source_row
  )
  select
    (row_item->>'transaction_date')::date,
    trim(row_item->>'account'),
    (row_item->>'amount')::numeric,
    trim(row_item->>'ministry'),
    trim(row_item->>'transaction_kind'),
    trim(row_item->>'movement'),
    trim(row_item->>'budget_version'),
    nullif(
      trim(coalesce(row_item->>'comments', row_item->>'Comments', row_item->>'comentario', '')),
      ''
    ),
    nullif(trim(coalesce(row_item->>'source_row', '')), '')::integer
  from jsonb_array_elements(p_rows) as row_item
  cross join public.financials_period_bounds(p_periodo, p_referencia) b
  where trim(coalesce(row_item->>'account', '')) <> ''
    and trim(coalesce(row_item->>'ministry', '')) <> ''
    and trim(coalesce(row_item->>'transaction_kind', '')) <> ''
    and trim(coalesce(row_item->>'movement', '')) <> ''
    and trim(coalesce(row_item->>'budget_version', '')) <> ''
    and (row_item->>'amount') ~ '^-?[0-9]+(\.[0-9]+)?$'
    and (row_item->>'transaction_date')::date >= b.start_date
    and (row_item->>'transaction_date')::date < b.end_date_exclusive;

  get diagnostics v_inserted = row_count;

  if v_inserted = 0 then
    return jsonb_build_object(
      'success', false,
      'message', 'Nenhum lançamento foi importado. Verifique datas e colunas do arquivo.'
    );
  end if;

  return jsonb_build_object(
    'success', true,
    'message',
    case
      when coalesce(p_substituir, false) then
        format(
          'Carga concluída: %s lançamento(s) importado(s); %s removido(s) da versão %s no período.',
          v_inserted,
          v_deleted,
          v_budget_version
        )
      else
        format('%s lançamento(s) acrescentado(s) ao período.', v_inserted)
    end,
    'inserted_count', v_inserted,
    'deleted_count', v_deleted,
    'replaced_period', coalesce(p_substituir, false)
  );
exception
  when others then
    return jsonb_build_object(
      'success', false,
      'message', format('Falha na carga em lote: %s', sqlerrm)
    );
end;
$$;

create or replace function public.excluir_lancamento_financeiro(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted integer;
begin
  if p_id is null then
    return jsonb_build_object('success', false, 'message', 'Lançamento não informado.');
  end if;

  delete from public.financials f
  where f.id = p_id;

  get diagnostics v_deleted = row_count;

  if v_deleted = 0 then
    return jsonb_build_object('success', false, 'message', 'Nenhum lançamento foi apagado.');
  end if;

  return jsonb_build_object('success', true, 'message', 'Lançamento excluído.');
end;
$$;

drop function if exists public.excluir_lancamentos_financeiros_periodo(text, date);
drop function if exists public.excluir_lancamentos_financeiros_periodo(text, date, text);

create or replace function public.excluir_lancamentos_financeiros_periodo(
  p_periodo text,
  p_referencia date,
  p_budget_version text default 'REALIZADO'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted integer;
  v_periodo text;
  v_budget_version text;
begin
  v_periodo := lower(trim(coalesce(p_periodo, '')));
  v_budget_version := upper(trim(coalesce(p_budget_version, '')));

  if v_periodo not in ('dia', 'mes') then
    return jsonb_build_object('success', false, 'message', 'Período inválido. Use dia ou mes.');
  end if;

  if p_referencia is null then
    return jsonb_build_object('success', false, 'message', 'Informe a data de referência do período.');
  end if;

  if v_budget_version = '' then
    return jsonb_build_object('success', false, 'message', 'Informe a versão (REALIZADO ou PLANEJADO).');
  end if;

  delete from public.financials f
  using public.financials_period_bounds(p_periodo, p_referencia) b
  where f.transaction_date >= b.start_date
    and f.transaction_date < b.end_date_exclusive
    and upper(trim(f.budget_version)) = v_budget_version;

  get diagnostics v_deleted = row_count;

  if v_deleted = 0 then
    return jsonb_build_object(
      'success', true,
      'message', 'Nenhum lançamento encontrado no período.',
      'deleted_count', 0
    );
  end if;

  return jsonb_build_object(
    'success', true,
    'message',
    case
      when v_periodo = 'dia' then format('%s lançamento(s) excluído(s) do dia.', v_deleted)
      else format('%s lançamento(s) excluído(s) do mês.', v_deleted)
    end,
    'deleted_count', v_deleted
  );
end;
$$;

create or replace function public.atualizar_lancamento_financeiro(
  p_id uuid,
  p_transaction_date date,
  p_account text,
  p_amount numeric,
  p_ministry text,
  p_transaction_kind text,
  p_movement text,
  p_budget_version text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_updated integer;
  v_account text;
  v_ministry text;
  v_transaction_kind text;
  v_movement text;
  v_budget_version text;
begin
  if p_id is null then
    return jsonb_build_object('success', false, 'message', 'Lançamento não informado.');
  end if;

  if not public.session_has_resource_access('table', 'financials', 'update') then
    return jsonb_build_object('success', false, 'message', 'Sem permissão para alterar lançamentos financeiros.');
  end if;

  if p_transaction_date is null then
    return jsonb_build_object('success', false, 'message', 'Informe a data do lançamento.');
  end if;

  v_account := trim(coalesce(p_account, ''));
  v_ministry := trim(coalesce(p_ministry, ''));
  v_transaction_kind := trim(coalesce(p_transaction_kind, ''));
  v_movement := trim(coalesce(p_movement, ''));
  v_budget_version := trim(coalesce(p_budget_version, ''));

  if v_account = '' then
    return jsonb_build_object('success', false, 'message', 'Informe a conta.');
  end if;

  if v_ministry = '' then
    return jsonb_build_object('success', false, 'message', 'Informe o ministério.');
  end if;

  if v_transaction_kind = '' then
    return jsonb_build_object('success', false, 'message', 'Informe o tipo de transação.');
  end if;

  if v_movement = '' then
    return jsonb_build_object('success', false, 'message', 'Informe o movimento.');
  end if;

  if v_budget_version = '' then
    return jsonb_build_object('success', false, 'message', 'Informe a versão (planejado/realizado).');
  end if;

  if p_amount is null then
    return jsonb_build_object('success', false, 'message', 'Informe o valor.');
  end if;

  update public.financials f
  set
    transaction_date = p_transaction_date,
    account = v_account,
    amount = p_amount,
    ministry = v_ministry,
    transaction_kind = v_transaction_kind,
    movement = v_movement,
    budget_version = v_budget_version,
    updated_at = now()
  where f.id = p_id;

  get diagnostics v_updated = row_count;

  if v_updated = 0 then
    return jsonb_build_object('success', false, 'message', 'Nenhum lançamento foi atualizado.');
  end if;

  return jsonb_build_object(
    'success', true,
    'message', 'Lançamento atualizado.',
    'id', p_id
  );
end;
$$;

create or replace function public.atualizar_comentario_lancamento_financeiro(
  p_id uuid,
  p_comments text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_updated integer;
  v_comments text;
begin
  if p_id is null then
    return jsonb_build_object('success', false, 'message', 'Lançamento não informado.');
  end if;

  if not public.session_has_resource_access('table', 'financials', 'update') then
    return jsonb_build_object('success', false, 'message', 'Sem permissão para alterar lançamentos financeiros.');
  end if;

  v_comments := nullif(trim(coalesce(p_comments, '')), '');

  update public.financials f
  set
    comments = v_comments,
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
      when v_comments is null then 'Comentário removido.'
      else 'Comentário salvo.'
    end,
    'id', p_id,
    'comments', v_comments
  );
end;
$$;

grant execute on function public.listar_lancamentos_financeiros_periodo(text, date) to anon, authenticated;
grant execute on function public.cadastrar_lancamento_financeiro(date, text, numeric, text, text, text, text) to anon, authenticated;
grant execute on function public.carga_lote_lancamentos_financeiros(text, date, jsonb, boolean, text) to anon, authenticated;
grant execute on function public.excluir_lancamento_financeiro(uuid) to anon, authenticated;
grant execute on function public.excluir_lancamentos_financeiros_periodo(text, date, text) to anon, authenticated;
create or replace function public.atualizar_comprovante_lancamento_financeiro(
  p_id uuid,
  p_receipt_url text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_updated integer;
  v_receipt_url text;
begin
  if p_id is null then
    return jsonb_build_object('success', false, 'message', 'Lançamento não informado.');
  end if;

  if not public.session_has_resource_access('table', 'financials', 'update') then
    return jsonb_build_object('success', false, 'message', 'Sem permissão para alterar lançamentos financeiros.');
  end if;

  v_receipt_url := nullif(trim(coalesce(p_receipt_url, '')), '');

  update public.financials f
  set
    receipt_url = v_receipt_url,
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
      when v_receipt_url is null then 'Comprovante removido.'
      else 'Comprovante anexado.'
    end,
    'id', p_id,
    'receipt_url', v_receipt_url
  );
end;
$$;

grant execute on function public.atualizar_lancamento_financeiro(uuid, date, text, numeric, text, text, text, text) to anon, authenticated;
grant execute on function public.atualizar_comentario_lancamento_financeiro(uuid, text) to anon, authenticated;
grant execute on function public.atualizar_comprovante_lancamento_financeiro(uuid, text) to anon, authenticated;

-- Storage: comprovantes no bucket privado financial-docs
-- Pré-requisito: bucket `financial-docs` criado como privado no painel Supabase.

drop policy if exists financial_docs_select on storage.objects;
drop policy if exists financial_docs_insert on storage.objects;
drop policy if exists financial_docs_update on storage.objects;
drop policy if exists financial_docs_delete on storage.objects;

create policy financial_docs_select
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'financial-docs'
    and public.session_has_resource_access('table', 'financials', 'view')
  );

create policy financial_docs_insert
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'financial-docs'
    and (storage.foldername(name))[1] = 'receipts'
    and public.session_has_resource_access('table', 'financials', 'update')
  );

create policy financial_docs_update
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'financial-docs'
    and public.session_has_resource_access('table', 'financials', 'update')
  )
  with check (
    bucket_id = 'financial-docs'
    and public.session_has_resource_access('table', 'financials', 'update')
  );

create policy financial_docs_delete
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'financial-docs'
    and public.session_has_resource_access('table', 'financials', 'update')
  );
