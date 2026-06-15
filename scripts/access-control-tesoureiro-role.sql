-- Papel Tesoureiro: financeiro (card + manutenção), eventos retroativos e RD por mês (prefixo AAMM).
-- Execute no SQL Editor do Supabase após access-control-schema.sql e financial-module-access.sql.
--
-- Inclui:
--   • Papel `tesoureiro` e grants ACL
--   • Coluna events.retroactive_publish (publicação retroativa sem re-bloqueio)
--   • Bypass de bloqueio automático de eventos passados
--   • Numeração RD: AAMM + sequência reiniciada a cada mês (ex.: 250500001)

-- ---------------------------------------------------------------------------
-- Papel Tesoureiro
-- ---------------------------------------------------------------------------

insert into public.access_roles (code, name, description, is_system)
values (
  'tesoureiro',
  'Tesoureiro',
  'Tesouraria: card financeiro, manutenção financeira, eventos de meses anteriores e RD por mês de referência',
  true
)
on conflict (code) do update
  set name = excluded.name,
      description = excluded.description,
      is_system = excluded.is_system;

insert into public.access_resources (resource_type, resource_key, label, description, is_active)
values
  ('screen', 'dashboard.card.financial', 'Card Financeiro (dashboard)', null, true),
  ('screen', '/financial', 'Relatórios financeiros (/financial)', null, true),
  ('screen', '/expense-report', 'Relatório de Despesas (RD)', null, true),
  ('screen', '/maintenance-dashboard', 'Manutenção do sistema', null, true),
  ('screen', 'maintenance.card.financials', 'Manutenção — Informações financeiras', null, true),
  ('screen', 'maintenance.card.events', 'Manutenção — Programação de eventos', null, true),
  ('screen', 'maintenance.card.events_gantt', 'Manutenção — Cronograma de eventos', null, true),
  ('table', 'financials', 'Lançamentos financeiros', null, true),
  ('table', 'events', 'Eventos', null, true),
  ('table', 'event_registrations', 'Inscrições em eventos', null, true),
  ('table', 'expense_reports', 'Relatórios de Despesas', null, true)
on conflict (resource_type, resource_key) do update
  set label = coalesce(excluded.label, public.access_resources.label),
      description = coalesce(excluded.description, public.access_resources.description),
      is_active = true;

insert into public.access_grants (role_id, resource_id, can_view, can_update)
select r.id, res.id, g.can_view, g.can_update
  from public.access_roles r
 cross join (
    values
      ('screen', 'dashboard.card.financial', true, false),
      ('screen', '/financial', true, false),
      ('screen', '/expense-report', true, true),
      ('screen', '/maintenance-dashboard', true, false),
      ('screen', 'maintenance.card.financials', true, true),
      ('screen', 'maintenance.card.events', true, true),
      ('screen', 'maintenance.card.events_gantt', true, true),
      ('table', 'financials', true, true),
      ('table', 'events', true, true),
      ('table', 'event_registrations', true, true),
      ('table', 'expense_reports', true, true)
  ) as g(resource_type, resource_key, can_view, can_update)
  join public.access_resources res
    on res.resource_type = g.resource_type
   and res.resource_key = g.resource_key
 where r.code = 'tesoureiro'
on conflict (role_id, resource_id) where (role_id is not null) do update
  set can_view = excluded.can_view,
      can_update = excluded.can_update,
      updated_at = now();

-- ---------------------------------------------------------------------------
-- Eventos retroativos (Tesoureiro / super_admin)
-- ---------------------------------------------------------------------------

create or replace function public.profile_has_role_code(
  p_profile_id uuid,
  p_role_code text
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.profile_access_roles par
      join public.access_roles ar on ar.id = par.role_id
     where par.profile_id = p_profile_id
       and ar.code = lower(trim(coalesce(p_role_code, '')))
  );
$$;

grant execute on function public.profile_has_role_code(uuid, text) to anon, authenticated;

alter table public.events
  add column if not exists retroactive_publish boolean not null default false;

comment on column public.events.retroactive_publish is
  'Quando true, evento publicado em data passada não é re-bloqueado por lock_past_events.';

create or replace function public.session_can_bypass_event_past_date_lock()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_super_admin_profile(public.current_session_profile_id())
    or public.profile_has_role_code(public.current_session_profile_id(), 'tesoureiro');
$$;

grant execute on function public.session_can_bypass_event_past_date_lock() to anon, authenticated;

create or replace function public.events_enforce_lock_if_past()
returns trigger
language plpgsql
as $$
begin
  if public.session_can_bypass_event_past_date_lock() then
    if coalesce(new.is_locked, true) is false
       and public.is_event_date_in_past(new.event_date) then
      new.retroactive_publish := true;
    end if;

    return new;
  end if;

  if tg_op = 'UPDATE' and new.event_date is not distinct from old.event_date
     and new.is_locked is true then
    return new;
  end if;

  if pg_typeof(new.event_date)::text = 'date' then
    if new.event_date::date < public.app_local_today() then
      new.is_locked := true;
      new.retroactive_publish := false;
    end if;
  elsif pg_typeof(new.event_date)::text = 'timestamp without time zone' then
    if new.event_date::date < public.app_local_today() then
      new.is_locked := true;
      new.retroactive_publish := false;
    end if;
  elsif pg_typeof(new.event_date)::text = 'timestamp with time zone' then
    if (new.event_date::timestamptz at time zone 'America/Sao_Paulo')::date < public.app_local_today() then
      new.is_locked := true;
      new.retroactive_publish := false;
    end if;
  elsif new.event_date is not null
        and public.is_event_date_in_past(new.event_date::text) then
    new.is_locked := true;
    new.retroactive_publish := false;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_events_enforce_lock_if_past on public.events;

create trigger trg_events_enforce_lock_if_past
before insert or update
on public.events
for each row
execute function public.events_enforce_lock_if_past();

create or replace function public.lock_past_events()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
  v_today date := public.app_local_today();
begin
  update public.events e
     set is_locked = true
   where coalesce(e.retroactive_publish, false) is not true
     and e.event_date is not null
     and (
       case pg_typeof(e.event_date)::text
         when 'date' then e.event_date::date < v_today
         when 'timestamp without time zone' then e.event_date::date < v_today
         when 'timestamp with time zone' then
           (e.event_date::timestamptz at time zone 'America/Sao_Paulo')::date < v_today
         else
           public.is_event_date_in_past(e.event_date::text)
       end
     )
     and coalesce(e.is_locked, false) is distinct from true;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- ---------------------------------------------------------------------------
-- RD — numeração AAMM + sequência mensal
-- ---------------------------------------------------------------------------

create or replace function public.expense_report_month_prefix(p_reference date)
returns text
language sql
immutable
as $$
  select to_char(date_trunc('month', p_reference)::date, 'YYMM');
$$;

create or replace function public.next_expense_report_number(p_reference_month date default null)
returns text
language plpgsql
as $$
declare
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

  v_prefix := public.expense_report_month_prefix(v_ref);

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
   where er.report_number like v_prefix || '%';

  return v_prefix || lpad(v_next::text, 5, '0');
end;
$$;

drop function if exists public.criar_relatorio_despesas(text, jsonb);
drop function if exists public.criar_relatorio_despesas(text, jsonb, uuid);

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
    status
  )
  values (
    v_report_id,
    v_report_number,
    v_profile_id,
    v_total,
    v_pix_key,
    'pending'
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
      receipt_url
    )
    values (
      v_item_id,
      v_report_id,
      v_date,
      v_description,
      v_amount,
      v_receipt_url
    );

    v_inserted := v_inserted + 1;
  end loop;

  update public.profiles p
  set pix_key = v_pix_key
  where p.id = v_profile_id
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
language sql
security definer
set search_path = public
as $$
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
    ) as items_count,
    coalesce(
      (
        select string_agg(ei.description, ' · ' order by ei.date asc, ei.created_at asc)
          from public.expense_items ei
         where ei.report_id = er.id
      ),
      ''
    ) as item_descriptions
  from public.expense_reports er
  left join public.profiles p on p.id = er.user_id
  cross join public.financials_period_bounds('mes', p_referencia) b
  where public.session_can_manage_expense_reports_treasury()
    and (
      left(er.report_number, 4) = public.expense_report_month_prefix(p_referencia)
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
             and f.transaction_date >= b.start_date
             and f.transaction_date < b.end_date_exclusive
        )
      )
    )
  order by er.created_at desc;
$$;

grant execute on function public.criar_relatorio_despesas(text, jsonb, uuid, date) to anon, authenticated;
grant execute on function public.next_expense_report_number(date) to anon, authenticated;
grant execute on function public.expense_report_month_prefix(date) to anon, authenticated;

notify pgrst, 'reload schema';
