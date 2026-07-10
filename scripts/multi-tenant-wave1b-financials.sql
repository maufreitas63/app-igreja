-- =============================================================================
-- Multi-tenancy — onda 1b: RPCs financeiros (tenant isolation)
-- =============================================================================
-- Pré-requisito: scripts/multi-tenant-wave0-helper.sql (require_session_tenant_id).
-- Fontes canônicas:
--   financials-receipt-urls.sql       → listar_lancamentos_financeiros_periodo,
--                                       anexar_comprovante_lancamento_financeiro,
--                                       atualizar_comprovante_lancamento_financeiro (jsonb+text)
--   financials-maintenance-rpc.sql    → cadastrar_lancamento_financeiro,
--                                       atualizar_lancamento_financeiro,
--                                       excluir_lancamento_financeiro,
--                                       excluir_lancamentos_financeiros_periodo,
--                                       carga_lote_lancamentos_financeiros,
--                                       atualizar_comentario_lancamento_financeiro
--   financials-import-rpc.sql         → importar_lancamentos_financeiros_csv,
--                                       importar_lancamentos_financeiros_de_arquivo
-- =============================================================================

begin;

-- ---------------------------------------------------------------------------
-- listar_lancamentos_financeiros_periodo
-- ---------------------------------------------------------------------------
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
declare
  v_tenant uuid := public.require_session_tenant_id();
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
   and er.tenant_id = v_tenant
  cross join bounds b
  where f.tenant_id = v_tenant
    and f.transaction_date >= b.start_date
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

-- ---------------------------------------------------------------------------
-- anexar_comprovante_lancamento_financeiro
-- ---------------------------------------------------------------------------
create or replace function public.anexar_comprovante_lancamento_financeiro(
  p_id uuid,
  p_receipt_path text,
  p_position integer default null,
  p_force boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
  v_row public.financials%rowtype;
  v_urls jsonb;
  v_path text;
  v_pos integer;
  v_len integer;
  v_idx integer;
  v_replaced text;
  v_arr text[] := array[]::text[];
  v_i integer;
begin
  if p_id is null then
    return jsonb_build_object('success', false, 'message', 'Lançamento não informado.');
  end if;

  v_path := nullif(trim(coalesce(p_receipt_path, '')), '');

  if v_path is null then
    return jsonb_build_object('success', false, 'message', 'Caminho do comprovante não informado.');
  end if;

  if not public.session_has_resource_access('table', 'financials', 'update') then
    return jsonb_build_object('success', false, 'message', 'Sem permissão para alterar lançamentos financeiros.');
  end if;

  select *
  into v_row
  from public.financials f
  where f.id = p_id
    and f.tenant_id = v_tenant
  for update;

  if not found then
    return jsonb_build_object('success', false, 'message', 'Lançamento não encontrado.');
  end if;

  v_urls := public.normalize_financial_receipt_urls(coalesce(v_row.receipt_urls, '[]'::jsonb));
  v_len := jsonb_array_length(v_urls);
  v_pos := coalesce(nullif(p_position, 0), v_len + 1);

  if v_pos < 1 or v_pos > 3 then
    return jsonb_build_object('success', false, 'message', 'Posição de comprovante inválida.');
  end if;

  if v_pos > v_len + 1 then
    return jsonb_build_object(
      'success',
      false,
      'message',
      format('Não é possível anexar na posição %s sem os comprovantes anteriores.', v_pos)
    );
  end if;

  if v_len > 0 then
  select coalesce(array_agg(value), array[]::text[])
  into v_arr
  from jsonb_array_elements_text(v_urls) as value;
  end if;

  v_idx := v_pos;

  if v_idx = coalesce(array_length(v_arr, 1), 0) + 1 then
    if v_len >= 3 and not coalesce(p_force, false) then
      return jsonb_build_object(
        'success',
        false,
        'message',
        'Cada lançamento aceita no máximo 3 comprovantes.',
        'code',
        'max_receipts'
      );
    end if;

    v_arr := array_append(v_arr, v_path);
  elsif v_idx <= coalesce(array_length(v_arr, 1), 0) then
    v_replaced := v_arr[v_idx];

    if v_replaced is not null and not coalesce(p_force, false) then
      return jsonb_build_object(
        'success',
        false,
        'message',
        format('Posição %s já possui comprovante.', v_pos),
        'code',
        'slot_occupied',
        'receipt_urls',
        v_urls,
        'replaced_url',
        v_replaced
      );
    end if;

    v_arr[v_idx] := v_path;
  else
    return jsonb_build_object(
      'success',
      false,
      'message',
      format('Não é possível anexar na posição %s sem os comprovantes anteriores.', v_pos)
    );
  end if;

  select coalesce(jsonb_agg(to_jsonb(url)), '[]'::jsonb)
  into v_urls
  from unnest(v_arr) as url
  where nullif(trim(url), '') is not null;

  v_urls := public.normalize_financial_receipt_urls(v_urls);

  update public.financials f
  set
    receipt_urls = v_urls,
    receipt_url = nullif(trim(coalesce(v_urls->>0, '')), ''),
    updated_at = now()
  where f.id = p_id
    and f.tenant_id = v_tenant;

  return jsonb_build_object(
    'success', true,
    'message',
    case
      when jsonb_array_length(v_urls) = 1 then 'Comprovante anexado.'
      else 'Comprovantes atualizados.'
    end,
    'id', p_id,
    'receipt_url', nullif(trim(coalesce(v_urls->>0, '')), ''),
    'receipt_urls', v_urls,
    'replaced_url', nullif(trim(coalesce(v_replaced, '')), ''),
    'position', v_pos
  );
end;
$$;

grant execute on function public.anexar_comprovante_lancamento_financeiro(uuid, text, integer, boolean)
  to anon, authenticated;

-- ---------------------------------------------------------------------------
-- atualizar_comprovante_lancamento_financeiro (jsonb)
-- ---------------------------------------------------------------------------
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
  v_tenant uuid := public.require_session_tenant_id();
  v_updated integer;
  v_receipt_urls jsonb;
  v_locked_id uuid;
begin
  if p_id is null then
    return jsonb_build_object('success', false, 'message', 'Lançamento não informado.');
  end if;

  if not public.session_has_resource_access('table', 'financials', 'update') then
    return jsonb_build_object('success', false, 'message', 'Sem permissão para alterar lançamentos financeiros.');
  end if;

  select f.id
  into v_locked_id
  from public.financials f
  where f.id = p_id
    and f.tenant_id = v_tenant
  for update;

  if v_locked_id is null then
    return jsonb_build_object('success', false, 'message', 'Nenhum lançamento foi atualizado.');
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
  where f.id = p_id
    and f.tenant_id = v_tenant;

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

-- ---------------------------------------------------------------------------
-- atualizar_comprovante_lancamento_financeiro (text) — delega ao overload jsonb
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- cadastrar_lancamento_financeiro
-- ---------------------------------------------------------------------------
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
  v_tenant uuid := public.require_session_tenant_id();
  v_id uuid;
  v_account text;
  v_ministry text;
  v_transaction_kind text;
  v_movement text;
  v_budget_version text;
begin
  if not public.session_has_resource_access('table', 'financials', 'update') then
    return jsonb_build_object('success', false, 'message', 'Sem permissão para incluir lançamentos financeiros.');
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

  insert into public.financials (
    transaction_date,
    account,
    amount,
    ministry,
    transaction_kind,
    movement,
    budget_version,
    tenant_id
  )
  values (
    p_transaction_date,
    v_account,
    p_amount,
    v_ministry,
    v_transaction_kind,
    v_movement,
    v_budget_version,
    v_tenant
  )
  returning id into v_id;

  return jsonb_build_object(
    'success', true,
    'message', 'Lançamento cadastrado.',
    'id', v_id
  );
end;
$$;

grant execute on function public.cadastrar_lancamento_financeiro(date, text, numeric, text, text, text, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- atualizar_lancamento_financeiro
-- ---------------------------------------------------------------------------
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
  v_tenant uuid := public.require_session_tenant_id();
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
  where f.id = p_id
    and f.tenant_id = v_tenant;

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

grant execute on function public.atualizar_lancamento_financeiro(uuid, date, text, numeric, text, text, text, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- excluir_lancamento_financeiro
-- ---------------------------------------------------------------------------
create or replace function public.excluir_lancamento_financeiro(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
  v_deleted integer;
begin
  if not public.session_has_resource_access('table', 'financials', 'update') then
    return jsonb_build_object('success', false, 'message', 'Sem permissão para excluir lançamentos financeiros.');
  end if;

  if p_id is null then
    return jsonb_build_object('success', false, 'message', 'Lançamento não informado.');
  end if;

  delete from public.financials f
  where f.id = p_id
    and f.tenant_id = v_tenant;

  get diagnostics v_deleted = row_count;

  if v_deleted = 0 then
    return jsonb_build_object('success', false, 'message', 'Nenhum lançamento foi apagado.');
  end if;

  return jsonb_build_object('success', true, 'message', 'Lançamento excluído.');
end;
$$;

grant execute on function public.excluir_lancamento_financeiro(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- excluir_lancamentos_financeiros_periodo
-- ---------------------------------------------------------------------------
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
  v_tenant uuid := public.require_session_tenant_id();
  v_deleted integer;
  v_periodo text;
  v_budget_version text;
begin
  if not public.session_has_resource_access('table', 'financials', 'update') then
    return jsonb_build_object('success', false, 'message', 'Sem permissão para excluir lançamentos financeiros.');
  end if;

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
  where f.tenant_id = v_tenant
    and f.transaction_date >= b.start_date
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

grant execute on function public.excluir_lancamentos_financeiros_periodo(text, date, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- carga_lote_lancamentos_financeiros
-- ---------------------------------------------------------------------------
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
  v_tenant uuid := public.require_session_tenant_id();
  v_periodo text;
  v_budget_version text;
  v_inserted integer;
  v_deleted integer := 0;
begin
  if not public.session_has_resource_access('table', 'financials', 'update') then
    return jsonb_build_object('success', false, 'message', 'Sem permissão para importar lançamentos financeiros.');
  end if;

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
    where f.tenant_id = v_tenant
      and f.transaction_date >= b.start_date
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
    source_row,
    tenant_id
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
    nullif(trim(coalesce(row_item->>'source_row', '')), '')::integer,
    v_tenant
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

grant execute on function public.carga_lote_lancamentos_financeiros(text, date, jsonb, boolean, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- atualizar_comentario_lancamento_financeiro
-- ---------------------------------------------------------------------------
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
  v_tenant uuid := public.require_session_tenant_id();
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
  where f.id = p_id
    and f.tenant_id = v_tenant;

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

grant execute on function public.atualizar_comentario_lancamento_financeiro(uuid, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- importar_lancamentos_financeiros_csv
-- ---------------------------------------------------------------------------
create or replace function public.importar_lancamentos_financeiros_csv(
  p_csv_conteudo text,
  p_substituir boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
  v_line text;
  v_parts text[];
  v_layout text;
  v_source_row integer := 0;
  v_inserted integer := 0;
  v_skipped integer := 0;
  v_errors jsonb := '[]'::jsonb;
  v_date_raw text;
  v_account text;
  v_ministry text;
  v_transaction_kind text;
  v_movement text;
  v_budget_version text;
  v_comments text;
  v_amount_raw text;
  v_transaction_date date;
  v_amount numeric;
begin
  if p_csv_conteudo is null or btrim(p_csv_conteudo) = '' then
    return jsonb_build_object('success', false, 'message', 'CSV vazio.');
  end if;

  if coalesce(p_substituir, false) then
    return jsonb_build_object(
      'success', false,
      'message', 'Substituição não suportada nesta importação. Use scripts/financials-reset-all.sql antes, se necessário.'
    );
  end if;

  for v_line in
    select btrim(line)
    from regexp_split_to_table(
      regexp_replace(coalesce(p_csv_conteudo, ''), '^\xEF\xBB\xBF', ''),
      E'\\r?\\n'
    ) as line
  loop
    v_source_row := v_source_row + 1;

    if v_line = '' then
      continue;
    end if;

    v_parts := public.financial_csv_trim_parts(v_line);

    if coalesce(array_length(v_parts, 1), 0) < 7 then
      v_skipped := v_skipped + 1;
      v_errors := v_errors || jsonb_build_array(
        jsonb_build_object('line', v_source_row, 'message', 'Menos de 7 colunas.')
      );
      continue;
    end if;

    if coalesce(array_length(v_parts, 1), 0) > 8 then
      v_skipped := v_skipped + 1;
      v_errors := v_errors || jsonb_build_array(
        jsonb_build_object('line', v_source_row, 'message', 'Mais de 8 colunas.')
      );
      continue;
    end if;

    v_date_raw := v_parts[1];

    if v_date_raw ~* '^(data|date)$' then
      continue;
    end if;

    if v_date_raw ~ '^0{1,2}/0{1,2}/1900$'
       and not exists (
         select 1
         from unnest(v_parts[2:array_length(v_parts, 1)]) as tail(value)
         where btrim(coalesce(tail.value, '')) <> ''
       ) then
      continue;
    end if;

    v_layout := public.financial_csv_detect_layout(v_parts);

    if v_layout = 'valor_third' then
      v_account := v_parts[2];
      v_amount_raw := v_parts[3];
      v_ministry := v_parts[4];
      v_transaction_kind := v_parts[5];
      v_movement := v_parts[6];
      v_budget_version := v_parts[7];
      v_comments := case when coalesce(array_length(v_parts, 1), 0) >= 8 then v_parts[8] else null end;
    elsif v_layout = 'legacy_comments_last' then
      v_account := v_parts[2];
      v_ministry := v_parts[3];
      v_transaction_kind := v_parts[4];
      v_movement := v_parts[5];
      v_budget_version := v_parts[6];
      v_amount_raw := v_parts[7];
      v_comments := case when coalesce(array_length(v_parts, 1), 0) >= 8 then v_parts[8] else null end;
    else
      v_account := v_parts[2];
      v_ministry := v_parts[3];
      v_transaction_kind := v_parts[4];
      v_movement := v_parts[5];
      v_budget_version := v_parts[6];
      v_amount_raw := v_parts[array_length(v_parts, 1)];
      v_comments := case when coalesce(array_length(v_parts, 1), 0) >= 8 then v_parts[7] else null end;
    end if;

    v_transaction_date := public.parse_financial_csv_date(v_date_raw);
    v_amount := public.parse_financial_csv_amount(v_amount_raw);

    if v_comments ~* '^(comentarios?|comments?|observacoes?|observação)$' then
      v_comments := null;
    end if;

    v_comments := nullif(btrim(coalesce(v_comments, '')), '');

    if v_transaction_date is null
       or v_amount is null
       or btrim(coalesce(v_account, '')) = ''
       or btrim(coalesce(v_ministry, '')) = ''
       or btrim(coalesce(v_transaction_kind, '')) = ''
       or btrim(coalesce(v_movement, '')) = ''
       or btrim(coalesce(v_budget_version, '')) = '' then
      v_skipped := v_skipped + 1;
      v_errors := v_errors || jsonb_build_array(
        jsonb_build_object('line', v_source_row, 'message', 'Dados inválidos na linha.')
      );
      continue;
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
      source_row,
      tenant_id
    )
    values (
      v_transaction_date,
      btrim(v_account),
      v_amount,
      btrim(v_ministry),
      btrim(v_transaction_kind),
      btrim(v_movement),
      btrim(v_budget_version),
      v_comments,
      v_source_row,
      v_tenant
    );

    v_inserted := v_inserted + 1;
  end loop;

  if v_inserted = 0 then
    return jsonb_build_object(
      'success', false,
      'message', 'Nenhum lançamento importado.',
      'inserted_count', 0,
      'skipped_count', v_skipped,
      'errors', v_errors
    );
  end if;

  return jsonb_build_object(
    'success', true,
    'message', format('%s lançamento(s) importado(s).', v_inserted),
    'inserted_count', v_inserted,
    'skipped_count', v_skipped,
    'errors', v_errors
  );
exception
  when others then
    return jsonb_build_object(
      'success', false,
      'message', format('Falha na importação: %s', sqlerrm)
    );
end;
$$;

-- ---------------------------------------------------------------------------
-- importar_lancamentos_financeiros_de_arquivo
-- ---------------------------------------------------------------------------
create or replace function public.importar_lancamentos_financeiros_de_arquivo(
  p_caminho_arquivo text,
  p_substituir boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
  v_path text;
  v_content text;
begin
  v_path := btrim(coalesce(p_caminho_arquivo, ''));

  if v_path = '' then
    return jsonb_build_object('success', false, 'message', 'Informe o caminho do arquivo CSV.');
  end if;

  begin
    v_content := pg_read_file(v_path);
  exception
    when others then
      return jsonb_build_object(
        'success', false,
        'message',
        format(
          'Não foi possível ler "%s" no servidor Postgres. No Supabase hospedado, rode: node scripts/run-financials-import.mjs %s',
          v_path,
          v_path
        )
      );
  end;

  return public.importar_lancamentos_financeiros_csv(v_content, p_substituir);
end;
$$;

grant execute on function public.importar_lancamentos_financeiros_csv(text, boolean) to anon, authenticated, service_role;
grant execute on function public.importar_lancamentos_financeiros_de_arquivo(text, boolean) to anon, authenticated, service_role;

notify pgrst, 'reload schema';

commit;
