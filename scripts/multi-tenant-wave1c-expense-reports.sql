-- =============================================================================
-- Multi-tenancy — onda 1c: RPCs de Relatório de Despesas (tenant isolation)
-- =============================================================================
-- Pré-requisito: scripts/multi-tenant-wave0-helper.sql (require_session_tenant_id).
-- Fonte canônica: scripts/expense-reports-rpc.sql
-- =============================================================================

begin;

-- ---------------------------------------------------------------------------
-- next_expense_report_number
-- ---------------------------------------------------------------------------
create or replace function public.next_expense_report_number(p_reference_month date default null)
returns text
language plpgsql
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
  v_ref date;
  v_prefix text;
  v_next integer;
begin
  v_ref := date_trunc(
    'month',
    coalesce(
      p_reference_month,
      timezone('America/Sao_Paulo', now())
    )
  )::date;

  v_prefix := to_char(v_ref, 'YYMM');

  select coalesce(
    max(
      case
        when er.report_number ~ ('^' || v_prefix || '[0-9]+$')
        then substring(er.report_number from length(v_prefix) + 1)::integer
        else null
      end
    ),
    0
  ) + 1
    into v_next
    from public.expense_reports er
   where er.tenant_id = v_tenant
     and er.report_number like v_prefix || '%';

  return v_prefix || lpad(v_next::text, 5, '0');
end;
$$;

-- ---------------------------------------------------------------------------
-- criar_relatorio_despesas
-- ---------------------------------------------------------------------------
create or replace function public.criar_relatorio_despesas(
  p_pix_key text,
  p_items jsonb,
  p_report_id uuid default null,
  p_reference_month date default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
  v_profile_id uuid;
  v_report_id uuid;
  v_report_number text;
  v_pix_key text;
  v_total numeric(14, 2) := 0;
  v_item jsonb;
  v_amount numeric(14, 2);
  v_description text;
  v_date date;
  v_receipt_url text;
  v_item_id uuid;
  v_inserted integer := 0;
  v_min_item_date date;
  v_reference_month date;
  v_current_month date;
begin
  v_profile_id := public.current_session_profile_id();

  if v_profile_id is null then
    return jsonb_build_object('success', false, 'message', 'Sessão não identificada.');
  end if;

  if not exists (
    select 1
      from public.profiles p
     where p.id = v_profile_id
       and p.tenant_id = v_tenant
  ) then
    return jsonb_build_object('success', false, 'message', 'Perfil não encontrado nesta igreja.');
  end if;

  v_pix_key := nullif(trim(coalesce(p_pix_key, '')), '');

  if v_pix_key is null then
    return jsonb_build_object('success', false, 'message', 'Informe a chave PIX para reembolso.');
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    return jsonb_build_object('success', false, 'message', 'Adicione ao menos uma linha de despesa.');
  end if;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_amount := coalesce((v_item ->> 'amount')::numeric, 0);
    v_description := nullif(trim(coalesce(v_item ->> 'description', '')), '');
    v_date := nullif(trim(coalesce(v_item ->> 'date', '')), '')::date;

    if v_date is null then
      return jsonb_build_object('success', false, 'message', 'Informe a data em todas as linhas.');
    end if;

    if v_description is null then
      return jsonb_build_object('success', false, 'message', 'Informe a descrição em todas as linhas.');
    end if;

    if v_amount <= 0 then
      return jsonb_build_object('success', false, 'message', 'Informe valores maiores que zero.');
    end if;

    v_total := v_total + v_amount;
    v_min_item_date := case
      when v_min_item_date is null or v_date < v_min_item_date then v_date
      else v_min_item_date
    end;
  end loop;

  v_current_month := date_trunc('month', timezone('America/Sao_Paulo', now()))::date;
  v_reference_month := date_trunc(
    'month',
    coalesce(p_reference_month, v_min_item_date, timezone('America/Sao_Paulo', now()))
  )::date;

  if v_reference_month <> v_current_month
     and not public.session_can_manage_expense_reports_treasury() then
    return jsonb_build_object(
      'success', false,
      'message', 'Somente a tesouraria pode emitir RD para meses anteriores ou futuros.'
    );
  end if;

  v_report_id := coalesce(p_report_id, gen_random_uuid());
  v_report_number := public.next_expense_report_number(v_reference_month);

  insert into public.expense_reports (
    id,
    report_number,
    user_id,
    total_amount,
    pix_key,
    status,
    tenant_id
  )
  values (
    v_report_id,
    v_report_number,
    v_profile_id,
    v_total,
    v_pix_key,
    'pending',
    v_tenant
  );

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_item_id := coalesce(nullif(trim(coalesce(v_item ->> 'id', '')), '')::uuid, gen_random_uuid());
    v_amount := (v_item ->> 'amount')::numeric;
    v_description := trim(v_item ->> 'description');
    v_date := (v_item ->> 'date')::date;
    v_receipt_url := nullif(trim(coalesce(v_item ->> 'receipt_url', '')), '');

    insert into public.expense_items (
      id,
      report_id,
      date,
      description,
      amount,
      receipt_url,
      tenant_id
    )
    values (
      v_item_id,
      v_report_id,
      v_date,
      v_description,
      v_amount,
      v_receipt_url,
      v_tenant
    );

    v_inserted := v_inserted + 1;
  end loop;

  update public.profiles p
  set pix_key = v_pix_key
  where p.id = v_profile_id
    and p.tenant_id = v_tenant
    and coalesce(nullif(trim(p.pix_key), ''), '') = '';

  return jsonb_build_object(
    'success', true,
    'message', 'Relatório de despesas criado.',
    'id', v_report_id,
    'report_number', v_report_number,
    'total_amount', v_total,
    'items_count', v_inserted,
    'reference_month', to_char(v_reference_month, 'YYYY-MM')
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- listar_meus_relatorios_despesas
-- ---------------------------------------------------------------------------
create or replace function public.listar_meus_relatorios_despesas()
returns table (
  id uuid,
  report_number text,
  created_at timestamptz,
  total_amount numeric,
  pix_key text,
  status text,
  financial_id uuid,
  item_descriptions text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
begin
  return query
  select
    er.id,
    er.report_number,
    er.created_at,
    er.total_amount,
    er.pix_key,
    er.status,
    er.financial_id,
    coalesce(
      (
        select string_agg(ei.description, ' · ' order by ei.date asc, ei.created_at asc)
          from public.expense_items ei
         where ei.report_id = er.id
           and ei.tenant_id = v_tenant
      ),
      ''
    ) as item_descriptions
  from public.expense_reports er
  where er.tenant_id = v_tenant
    and er.user_id = public.current_session_profile_id()
  order by er.created_at desc;
end;
$$;

-- ---------------------------------------------------------------------------
-- obter_relatorio_despesas
-- ---------------------------------------------------------------------------
create or replace function public.obter_relatorio_despesas(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
  v_report public.expense_reports%rowtype;
  v_items jsonb;
begin
  if p_id is null then
    return jsonb_build_object('success', false, 'message', 'Relatório não informado.');
  end if;

  select *
    into v_report
    from public.expense_reports er
   where er.id = p_id
     and er.tenant_id = v_tenant;

  if not found then
    return jsonb_build_object('success', false, 'message', 'Relatório não encontrado.');
  end if;

  if not (
    public.session_owns_expense_report(v_report.user_id)
    or public.session_can_manage_expense_reports_treasury()
    or (
      v_report.status = 'reconciled'
      and v_report.financial_id is not null
      and public.session_has_screen_access('/financial', 'view')
    )
  ) then
    return jsonb_build_object('success', false, 'message', 'Sem permissão para visualizar este relatório.');
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', ei.id,
        'date', ei.date,
        'description', ei.description,
        'amount', ei.amount,
        'receipt_url', ei.receipt_url
      )
      order by ei.date asc, ei.created_at asc
    ),
    '[]'::jsonb
  )
    into v_items
    from public.expense_items ei
   where ei.report_id = v_report.id
     and ei.tenant_id = v_tenant;

  return jsonb_build_object(
    'success', true,
    'report', jsonb_build_object(
      'id', v_report.id,
      'report_number', v_report.report_number,
      'user_id', v_report.user_id,
      'created_at', v_report.created_at,
      'total_amount', v_report.total_amount,
      'pix_key', v_report.pix_key,
      'status', v_report.status,
      'financial_id', v_report.financial_id
    ),
    'items', v_items
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- listar_relatorios_despesas_pendentes
-- ---------------------------------------------------------------------------
create or replace function public.listar_relatorios_despesas_pendentes()
returns table (
  id uuid,
  report_number text,
  created_at timestamptz,
  total_amount numeric,
  pix_key text,
  user_id uuid,
  member_name text,
  member_phone text,
  items_count bigint,
  item_descriptions text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
begin
  return query
  select
    er.id,
    er.report_number,
    er.created_at,
    er.total_amount,
    er.pix_key,
    er.user_id,
    coalesce(nullif(trim(p.full_name), ''), '—') as member_name,
    coalesce(nullif(trim(p.phone), ''), '—') as member_phone,
    (
      select count(*)
        from public.expense_items ei
       where ei.report_id = er.id
         and ei.tenant_id = v_tenant
    ) as items_count,
    coalesce(
      (
        select string_agg(ei.description, ' · ' order by ei.date asc, ei.created_at asc)
          from public.expense_items ei
         where ei.report_id = er.id
           and ei.tenant_id = v_tenant
      ),
      ''
    ) as item_descriptions
  from public.expense_reports er
  left join public.profiles p
    on p.id = er.user_id
   and p.tenant_id = v_tenant
  where er.tenant_id = v_tenant
    and er.status = 'pending'
    and public.session_can_manage_expense_reports_treasury()
  order by er.created_at asc;
end;
$$;

-- ---------------------------------------------------------------------------
-- conciliar_relatorio_despesas
-- ---------------------------------------------------------------------------
create or replace function public.conciliar_relatorio_despesas(
  p_report_id uuid,
  p_financial_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
  v_updated integer;
begin
  if p_report_id is null or p_financial_id is null then
    return jsonb_build_object('success', false, 'message', 'Relatório e lançamento são obrigatórios.');
  end if;

  if not public.session_can_manage_expense_reports_treasury() then
    return jsonb_build_object('success', false, 'message', 'Sem permissão para conciliar relatórios de despesas.');
  end if;

  if not exists (
    select 1
      from public.financials f
     where f.id = p_financial_id
       and f.tenant_id = v_tenant
  ) then
    return jsonb_build_object('success', false, 'message', 'Lançamento financeiro não encontrado.');
  end if;

  update public.expense_reports er
  set
    financial_id = p_financial_id,
    status = 'reconciled',
    updated_at = now()
  where er.id = p_report_id
    and er.tenant_id = v_tenant
    and er.status = 'pending';

  get diagnostics v_updated = row_count;

  if v_updated = 0 then
    return jsonb_build_object(
      'success', false,
      'message', 'Nenhum relatório pendente foi vinculado. Verifique se o RD já foi conciliado.'
    );
  end if;

  return jsonb_build_object(
    'success', true,
    'message', 'Relatório de despesas vinculado ao lançamento.',
    'report_id', p_report_id,
    'financial_id', p_financial_id
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- listar_relatorios_despesas_periodo
-- ---------------------------------------------------------------------------
create or replace function public.listar_relatorios_despesas_periodo(p_referencia date)
returns table (
  id uuid,
  report_number text,
  created_at timestamptz,
  total_amount numeric,
  pix_key text,
  status text,
  financial_id uuid,
  member_name text,
  member_phone text,
  items_count bigint,
  item_descriptions text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
begin
  return query
  select
    er.id,
    er.report_number,
    er.created_at,
    er.total_amount,
    er.pix_key,
    er.status,
    er.financial_id,
    coalesce(nullif(trim(p.full_name), ''), '—') as member_name,
    coalesce(nullif(trim(p.phone), ''), '—') as member_phone,
    (
      select count(*)
        from public.expense_items ei
       where ei.report_id = er.id
         and ei.tenant_id = v_tenant
    ) as items_count,
    coalesce(
      (
        select string_agg(ei.description, ' · ' order by ei.date asc, ei.created_at asc)
          from public.expense_items ei
         where ei.report_id = er.id
           and ei.tenant_id = v_tenant
      ),
      ''
    ) as item_descriptions
  from public.expense_reports er
  left join public.profiles p
    on p.id = er.user_id
   and p.tenant_id = v_tenant
  cross join public.financials_period_bounds('mes', p_referencia) b
  where er.tenant_id = v_tenant
    and public.session_can_manage_expense_reports_treasury()
    and (
      left(er.report_number, 4) = to_char(date_trunc('month', p_referencia)::date, 'YYMM')
      or (
        er.status = 'pending'
        and er.created_at >= b.start_date::timestamptz
        and er.created_at < b.end_date_exclusive::timestamptz
      )
      or (
        er.status = 'reconciled'
        and er.financial_id is not null
        and exists (
          select 1
            from public.financials f
           where f.id = er.financial_id
             and f.tenant_id = v_tenant
             and f.transaction_date >= b.start_date
             and f.transaction_date < b.end_date_exclusive
        )
      )
    )
  order by er.created_at desc;
end;
$$;

-- ---------------------------------------------------------------------------
-- desconciliar_relatorio_despesas
-- ---------------------------------------------------------------------------
create or replace function public.desconciliar_relatorio_despesas(p_report_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
  v_updated integer;
begin
  if p_report_id is null then
    return jsonb_build_object('success', false, 'message', 'Relatório não informado.');
  end if;

  if not public.session_can_manage_expense_reports_treasury() then
    return jsonb_build_object('success', false, 'message', 'Sem permissão para desfazer conciliação.');
  end if;

  update public.expense_reports er
  set
    financial_id = null,
    status = 'pending',
    updated_at = now()
  where er.id = p_report_id
    and er.tenant_id = v_tenant
    and er.status = 'reconciled';

  get diagnostics v_updated = row_count;

  if v_updated = 0 then
    return jsonb_build_object(
      'success', false,
      'message', 'Nenhum relatório conciliado foi atualizado.'
    );
  end if;

  return jsonb_build_object(
    'success', true,
    'message', 'Conciliação removida. O RD voltou para pendente.',
    'report_id', p_report_id
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- excluir_relatorio_despesas
-- ---------------------------------------------------------------------------
create or replace function public.excluir_relatorio_despesas(p_report_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
  v_report public.expense_reports%rowtype;
begin
  if p_report_id is null then
    return jsonb_build_object('success', false, 'message', 'Relatório não informado.');
  end if;

  select *
    into v_report
    from public.expense_reports er
   where er.id = p_report_id
     and er.tenant_id = v_tenant;

  if not found then
    return jsonb_build_object('success', false, 'message', 'Relatório não encontrado.');
  end if;

  if not public.session_owns_expense_report(v_report.user_id) then
    return jsonb_build_object('success', false, 'message', 'Sem permissão para excluir este relatório.');
  end if;

  if v_report.status <> 'pending' then
    return jsonb_build_object(
      'success', false,
      'message', 'Somente relatórios pendentes podem ser excluídos.'
    );
  end if;

  delete from public.expense_reports er
   where er.id = p_report_id
     and er.tenant_id = v_tenant
     and er.user_id = public.current_session_profile_id()
     and er.status = 'pending';

  return jsonb_build_object(
    'success', true,
    'message', 'Relatório de despesas excluído.',
    'report_id', p_report_id
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
grant execute on function public.criar_relatorio_despesas(text, jsonb, uuid, date) to anon, authenticated;
grant execute on function public.listar_meus_relatorios_despesas() to anon, authenticated;
grant execute on function public.obter_relatorio_despesas(uuid) to anon, authenticated;
grant execute on function public.listar_relatorios_despesas_pendentes() to anon, authenticated;
grant execute on function public.conciliar_relatorio_despesas(uuid, uuid) to anon, authenticated;
grant execute on function public.listar_relatorios_despesas_periodo(date) to anon, authenticated;
grant execute on function public.desconciliar_relatorio_despesas(uuid) to anon, authenticated;
grant execute on function public.excluir_relatorio_despesas(uuid) to anon, authenticated;

notify pgrst, 'reload schema';

commit;
