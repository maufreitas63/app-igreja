-- Contrato: datas, rescisão na renovação e desliga igrejas.is_active no fim do ciclo.

create or replace function public.get_tenant_billing_status(p_tenant_id uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_tenant uuid;
  v_sub public.tenant_subscriptions%rowtype;
  v_plan public.billing_plans%rowtype;
  v_members integer := 0;
  v_breakdown jsonb := '{}'::jsonb;
  v_allowed boolean := false;
  v_can_add boolean := false;
  v_instance_active boolean := true;
begin
  v_tenant := coalesce(p_tenant_id, public.current_session_tenant_id());

  if v_tenant is null then
    return jsonb_build_object(
      'success', false,
      'billing_configured', true,
      'message', 'Tenant não identificado.'
    );
  end if;

  if p_tenant_id is not null
     and public.current_session_profile_id() is not null
     and p_tenant_id is distinct from public.current_session_tenant_id()
     and not public.is_super_admin_profile(public.current_session_profile_id()) then
    return jsonb_build_object(
      'success', false,
      'billing_configured', true,
      'message', 'Tenant não autorizado para esta sessão.'
    );
  end if;

  select coalesce(i.is_active, true)
    into v_instance_active
    from public.igrejas i
   where i.id = v_tenant;

  select *
    into v_sub
    from public.tenant_subscriptions ts
   where ts.tenant_id = v_tenant;

  v_breakdown := public.count_tenant_active_users_by_role(v_tenant);
  v_members := coalesce((v_breakdown ->> 'active_users')::integer, 0);

  if v_sub.id is null then
    return jsonb_build_object(
      'success', true,
      'billing_configured', true,
      'tenant_id', v_tenant,
      'has_subscription', false,
      'status', 'inactive',
      'access_allowed', false,
      'instance_active', coalesce(v_instance_active, true),
      'member_count', v_members,
      'active_members', coalesce((v_breakdown ->> 'active_members')::integer, 0),
      'active_congregados', coalesce((v_breakdown ->> 'active_congregados')::integer, 0),
      'max_members', null,
      'can_add_member', false,
      'plan', null
    );
  end if;

  select *
    into v_plan
    from public.billing_plans bp
   where bp.id = v_sub.plan_id;

  v_allowed := public.tenant_subscription_is_access_allowed(v_sub.status);
  v_can_add :=
    v_allowed
    and coalesce(v_instance_active, true)
    and (
      v_plan.max_members = -1
      or v_members < v_plan.max_members
    );

  return jsonb_build_object(
    'success', true,
    'billing_configured', true,
    'tenant_id', v_tenant,
    'has_subscription', true,
    'status', v_sub.status,
    'access_allowed', v_allowed,
    'instance_active', coalesce(v_instance_active, true),
    'member_count', v_members,
    'active_members', coalesce((v_breakdown ->> 'active_members')::integer, 0),
    'active_congregados', coalesce((v_breakdown ->> 'active_congregados')::integer, 0),
    'max_members', v_plan.max_members,
    'can_add_member', v_can_add,
    'cancel_at_period_end', v_sub.cancel_at_period_end,
    'signed_at', v_sub.created_at,
    'current_period_start', v_sub.current_period_start,
    'current_period_end', v_sub.current_period_end,
    'stripe_customer_id', v_sub.stripe_customer_id,
    'stripe_subscription_id', v_sub.stripe_subscription_id,
    'plan', jsonb_build_object(
      'id', v_plan.id,
      'code', v_plan.code,
      'name', v_plan.name,
      'description', v_plan.description,
      'max_members', v_plan.max_members,
      'stripe_price_id', v_plan.stripe_price_id
    )
  );
end;
$$;

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
  p_raw_stripe jsonb default '{}'::jsonb
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
  if v_status = '' then
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

  -- Rescisão efetiva (status terminal): desmarca o checkbox da instância.
  -- Reativa só no checkout novo (session id), para não desfazer bloqueio manual do super-admin.
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

  return jsonb_build_object(
    'success', true,
    'tenant_id', v_row.tenant_id,
    'status', v_row.status,
    'plan_id', v_row.plan_id
  );
end;
$$;

-- Super-admin entra em qualquer instância, inclusive inativa após rescisão.
create or replace function public.profile_can_use_tenant(
  p_profile_id uuid,
  p_tenant_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    p_profile_id is not null
    and p_tenant_id is not null
    and exists (
      select 1 from public.igrejas i where i.id = p_tenant_id
    )
    and (
      public.profile_has_super_admin_role(p_profile_id)
      or (
        exists (
          select 1
            from public.igrejas i
           where i.id = p_tenant_id
             and i.is_active = true
        )
        and public.profile_belongs_to_tenant(p_profile_id, p_tenant_id)
      )
    );
$$;

grant execute on function public.get_tenant_billing_status(uuid) to anon, authenticated, service_role;
grant execute on function public.upsert_tenant_subscription_from_stripe(uuid, text, text, text, text, text, timestamptz, timestamptz, boolean, jsonb) to service_role;
grant execute on function public.profile_can_use_tenant(uuid, uuid) to anon, authenticated;

notify pgrst, 'reload schema';
