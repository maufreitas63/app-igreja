-- Guarda de status Stripe: nunca grava status desconhecido como active.
-- Mantém ciclo da instância + contrato SaaS quando a assinatura realmente libera acesso.

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

notify pgrst, 'reload schema';
