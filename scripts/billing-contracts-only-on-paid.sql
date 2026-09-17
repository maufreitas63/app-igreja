-- Contrato SaaS só após pagamento confirmado.
-- Remove o IBEP-001 emitido sem confirmação e refaz a sequência das igrejas restantes.

create or replace function public.ensure_billing_saas_contract(
  p_tenant_id uuid,
  p_plan_id uuid,
  p_status text,
  p_period_start timestamptz,
  p_period_end timestamptz,
  p_stripe_subscription_id text default null,
  p_stripe_checkout_session_id text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan public.billing_plans%rowtype;
  v_igreja public.igrejas%rowtype;
  v_seq integer;
  v_event text;
  v_prev_plan text;
  v_id uuid;
  v_body text;
begin
  if p_tenant_id is null or p_plan_id is null or p_period_start is null then
    return null;
  end if;

  if not public.tenant_subscription_is_access_allowed(p_status) then
    return null;
  end if;

  if coalesce(nullif(btrim(p_stripe_subscription_id), ''), '') !~ '^sub_[A-Za-z0-9]+$'
     or lower(coalesce(p_stripe_subscription_id, '')) like 'sub_test%' then
    return null;
  end if;

  select c.id
    into v_id
    from public.billing_saas_contracts c
   where c.tenant_id = p_tenant_id
     and c.period_start = p_period_start
   limit 1;

  if v_id is not null then
    return v_id;
  end if;

  select * into v_plan from public.billing_plans where id = p_plan_id;
  if v_plan.id is null then
    return null;
  end if;

  select * into v_igreja from public.igrejas where id = p_tenant_id;
  if v_igreja.id is null then
    return null;
  end if;

  perform pg_advisory_xact_lock(hashtext(p_tenant_id::text), 814229);

  select c.id
    into v_id
    from public.billing_saas_contracts c
   where c.tenant_id = p_tenant_id
     and c.period_start = p_period_start
   limit 1;

  if v_id is not null then
    return v_id;
  end if;

  select c.plan_code
    into v_prev_plan
    from public.billing_saas_contracts c
   where c.tenant_id = p_tenant_id
   order by c.sequence_number desc
   limit 1;

  select coalesce(max(c.sequence_number), 0) + 1
    into v_seq
    from public.billing_saas_contracts c
   where c.tenant_id = p_tenant_id;

  if v_seq = 1 or v_prev_plan is distinct from v_plan.code then
    v_event := 'contratacao';
  else
    v_event := 'renovacao';
  end if;

  v_body := public.billing_saas_license_contract_text(
    v_seq,
    v_event,
    v_plan.name,
    coalesce(nullif(btrim(v_plan.description), ''), v_plan.name),
    coalesce(nullif(btrim(v_igreja.name), ''), v_igreja.code),
    v_igreja.cnpj,
    v_igreja.code,
    coalesce(p_period_start, now()),
    p_period_start,
    p_period_end
  );

  insert into public.billing_saas_contracts (
    tenant_id,
    sequence_number,
    event_type,
    plan_code,
    plan_name,
    plan_type,
    period_start,
    period_end,
    accepted_at,
    licensed_name,
    licensed_document,
    licensed_instance_code,
    stripe_subscription_id,
    stripe_checkout_session_id,
    body
  )
  values (
    p_tenant_id,
    v_seq,
    v_event,
    v_plan.code,
    v_plan.name,
    coalesce(nullif(btrim(v_plan.description), ''), v_plan.name),
    p_period_start,
    p_period_end,
    coalesce(p_period_start, now()),
    coalesce(nullif(btrim(v_igreja.name), ''), v_igreja.code),
    nullif(btrim(coalesce(v_igreja.cnpj, '')), ''),
    nullif(btrim(coalesce(v_igreja.code, '')), ''),
    nullif(btrim(coalesce(p_stripe_subscription_id, '')), ''),
    nullif(btrim(coalesce(p_stripe_checkout_session_id, '')), ''),
    v_body
  )
  on conflict (tenant_id, period_start) do nothing
  returning id into v_id;

  if v_id is null then
    select c.id
      into v_id
      from public.billing_saas_contracts c
     where c.tenant_id = p_tenant_id
       and c.period_start = p_period_start
     limit 1;
  end if;

  return v_id;
end;
$$;

drop function if exists public.upsert_tenant_subscription_from_stripe(uuid, text, text, text, text, text, timestamptz, timestamptz, boolean, jsonb);

create or replace function public.upsert_tenant_subscription_from_stripe(
  p_tenant_id uuid,
  p_plan_code text,
  p_status text,
  p_stripe_customer_id text default null,
  p_stripe_subscription_id text default null,
  p_stripe_checkout_session_id text default null,
  p_current_period_start timestamptz default null,
  p_current_period_end timestamptz default null,
  p_cancel_at_period_end boolean default false,
  p_raw_stripe jsonb default '{}'::jsonb,
  p_emit_contract boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan_id uuid;
  v_status text;
  v_row public.tenant_subscriptions%rowtype;
begin
  if p_tenant_id is null then
    return jsonb_build_object('success', false, 'message', 'tenant_id obrigatório.');
  end if;

  if not exists (select 1 from public.igrejas i where i.id = p_tenant_id) then
    return jsonb_build_object('success', false, 'message', 'Igreja (tenant) não encontrada.');
  end if;

  select bp.id
    into v_plan_id
    from public.billing_plans bp
   where bp.code = lower(trim(coalesce(p_plan_code, '')))
     and bp.is_active = true;

  if v_plan_id is null then
    return jsonb_build_object('success', false, 'message', 'Plano inválido.');
  end if;

  v_status := lower(trim(coalesce(p_status, 'inactive')));
  if v_status not in (
    'inactive',
    'incomplete',
    'incomplete_expired',
    'trialing',
    'active',
    'past_due',
    'canceled',
    'unpaid',
    'paused'
  ) then
    v_status := 'inactive';
  end if;

  insert into public.tenant_subscriptions (
    tenant_id,
    plan_id,
    status,
    stripe_customer_id,
    stripe_subscription_id,
    stripe_checkout_session_id,
    current_period_start,
    current_period_end,
    cancel_at_period_end,
    raw_stripe,
    updated_at
  )
  values (
    p_tenant_id,
    v_plan_id,
    v_status,
    nullif(trim(coalesce(p_stripe_customer_id, '')), ''),
    nullif(trim(coalesce(p_stripe_subscription_id, '')), ''),
    nullif(trim(coalesce(p_stripe_checkout_session_id, '')), ''),
    p_current_period_start,
    p_current_period_end,
    coalesce(p_cancel_at_period_end, false),
    coalesce(p_raw_stripe, '{}'::jsonb),
    now()
  )
  on conflict (tenant_id) do update
    set plan_id = excluded.plan_id,
        status = excluded.status,
        stripe_customer_id = coalesce(excluded.stripe_customer_id, public.tenant_subscriptions.stripe_customer_id),
        stripe_subscription_id = coalesce(excluded.stripe_subscription_id, public.tenant_subscriptions.stripe_subscription_id),
        stripe_checkout_session_id = coalesce(excluded.stripe_checkout_session_id, public.tenant_subscriptions.stripe_checkout_session_id),
        current_period_start = coalesce(excluded.current_period_start, public.tenant_subscriptions.current_period_start),
        current_period_end = coalesce(excluded.current_period_end, public.tenant_subscriptions.current_period_end),
        cancel_at_period_end = excluded.cancel_at_period_end,
        raw_stripe = excluded.raw_stripe,
        updated_at = now()
  returning * into v_row;

  if v_status in ('canceled', 'unpaid', 'incomplete_expired') then
    update public.igrejas
       set is_active = false,
           updated_at = now()
     where id = p_tenant_id
       and upper(trim(code)) is distinct from 'IBN';
  elsif v_status in ('active', 'trialing')
        and nullif(trim(coalesce(p_stripe_checkout_session_id, '')), '') is not null then
    update public.igrejas
       set is_active = true,
           updated_at = now()
     where id = p_tenant_id;
  end if;

  if coalesce(p_emit_contract, false)
     and public.tenant_subscription_is_access_allowed(v_row.status)
     and v_row.current_period_start is not null
     and coalesce(v_row.stripe_subscription_id, '') ~ '^sub_[A-Za-z0-9]+$'
     and lower(coalesce(v_row.stripe_subscription_id, '')) not like 'sub_test%' then
    perform public.ensure_billing_saas_contract(
      v_row.tenant_id,
      v_row.plan_id,
      v_row.status,
      v_row.current_period_start,
      v_row.current_period_end,
      v_row.stripe_subscription_id,
      v_row.stripe_checkout_session_id
    );
  end if;

  return jsonb_build_object(
    'success', true,
    'tenant_id', v_row.tenant_id,
    'status', v_row.status,
    'plan_id', v_row.plan_id
  );
end;
$$;

grant execute on function public.upsert_tenant_subscription_from_stripe(uuid, text, text, text, text, text, timestamptz, timestamptz, boolean, jsonb, boolean) to service_role;
grant execute on function public.ensure_billing_saas_contract(uuid, uuid, text, timestamptz, timestamptz, text, text) to service_role;

-- IBEP-001 foi emitido no checkout sem pagamento confirmado.
delete from public.billing_saas_contracts c
 using public.igrejas i
 where c.tenant_id = i.id
   and upper(btrim(i.code)) = 'IBEP';

update public.tenant_subscriptions ts
   set status = 'incomplete',
       updated_at = now()
  from public.igrejas i
 where ts.tenant_id = i.id
   and upper(btrim(i.code)) = 'IBEP';

-- Refaz 001, 002… por igreja, na ordem em que os contratos restantes foram efetivados.
update public.billing_saas_contracts
   set sequence_number = sequence_number + 100000;

with ordered as (
  select
    id,
    row_number() over (
      partition by tenant_id
      order by period_start asc, created_at asc, id asc
    ) as n
  from public.billing_saas_contracts
)
update public.billing_saas_contracts c
   set sequence_number = o.n
  from ordered o
 where c.id = o.id;

update public.billing_saas_contracts c
   set body = public.billing_saas_license_contract_text(
     c.sequence_number,
     c.event_type,
     c.plan_name,
     c.plan_type,
     c.licensed_name,
     c.licensed_document,
     c.licensed_instance_code,
     c.accepted_at,
     c.period_start,
     c.period_end
   );

notify pgrst, 'reload schema';
