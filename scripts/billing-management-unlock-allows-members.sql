-- Gestão Liberada: libera a manutenção da instância (inclui cadastro de usuários)
-- mesmo com assinatura inativa/vencida/ausente. Não altera papéis nem grants.
-- Execute: npx supabase db query --linked -f scripts/billing-management-unlock-allows-members.sql

comment on column public.igrejas.management_unlocked is
  'Interruptor mestre do Super Administrador: libera a gestão da instância (cadastros e telas de manutenção) mesmo sem contrato/pagamento Stripe. Não altera papéis nem permissões.';

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
  v_management_unlocked boolean := false;
  v_has_contract boolean := false;
  v_commercially_ok boolean := false;
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

  select coalesce(i.is_active, true), coalesce(i.management_unlocked, false)
    into v_instance_active, v_management_unlocked
    from public.igrejas i
   where i.id = v_tenant;

  v_has_contract := public.tenant_has_signed_saas_contract(v_tenant);

  select *
    into v_sub
    from public.tenant_subscriptions ts
   where ts.tenant_id = v_tenant;

  v_breakdown := public.count_tenant_active_users_by_role(v_tenant);
  v_members := coalesce((v_breakdown ->> 'active_users')::integer, 0);

  if v_sub.id is null then
    v_can_add :=
      coalesce(v_management_unlocked, false)
      and coalesce(v_instance_active, true);

    return jsonb_build_object(
      'success', true,
      'billing_configured', true,
      'tenant_id', v_tenant,
      'has_subscription', false,
      'status', 'inactive',
      'access_allowed', false,
      'instance_active', coalesce(v_instance_active, true),
      'management_unlocked', coalesce(v_management_unlocked, false),
      'has_signed_contract', v_has_contract,
      'commercially_ok', false,
      'member_count', v_members,
      'active_members', coalesce((v_breakdown ->> 'active_members')::integer, 0),
      'active_congregados', coalesce((v_breakdown ->> 'active_congregados')::integer, 0),
      'max_members', null,
      'can_add_member', v_can_add,
      'plan', null
    );
  end if;

  select *
    into v_plan
    from public.billing_plans bp
   where bp.id = v_sub.plan_id;

  v_allowed := public.tenant_subscription_is_access_allowed(v_sub.status);
  v_commercially_ok := v_allowed and v_has_contract;

  if coalesce(v_management_unlocked, false) and coalesce(v_instance_active, true) then
    -- Gestão Liberada: manutenção operacional (inclui novos cadastros) sem exigir plano pago.
    v_can_add := true;
  else
    v_can_add :=
      v_allowed
      and coalesce(v_instance_active, true)
      and (
        v_plan.max_members = -1
        or v_members < v_plan.max_members
      );
  end if;

  return jsonb_build_object(
    'success', true,
    'billing_configured', true,
    'tenant_id', v_tenant,
    'has_subscription', true,
    'status', v_sub.status,
    'access_allowed', v_allowed,
    'instance_active', coalesce(v_instance_active, true),
    'management_unlocked', coalesce(v_management_unlocked, false),
    'has_signed_contract', v_has_contract,
    'commercially_ok', v_commercially_ok,
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

create or replace function public.assert_tenant_can_add_member(p_tenant_id uuid default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status jsonb;
  v_management_unlocked boolean := false;
  v_instance_active boolean := true;
begin
  v_status := public.get_tenant_billing_status(p_tenant_id);

  if coalesce((v_status ->> 'success')::boolean, false) is not true then
    raise exception '%', coalesce(v_status ->> 'message', 'Faturamento indisponível.');
  end if;

  v_management_unlocked := coalesce((v_status ->> 'management_unlocked')::boolean, false);
  v_instance_active := coalesce((v_status ->> 'instance_active')::boolean, true);

  if v_management_unlocked then
    if v_instance_active is not true then
      raise exception 'A instância está inativa. Reative a igreja antes de cadastrar usuários.';
    end if;
    return;
  end if;

  if coalesce((v_status ->> 'access_allowed')::boolean, false) is not true then
    raise exception 'Assinatura inativa ou vencida. Ative um plano em Assinaturas.';
  end if;

  if coalesce((v_status ->> 'can_add_member')::boolean, false) is not true then
    raise exception 'Limite de membros do plano atingido. Faça upgrade em Assinaturas.';
  end if;
end;
$$;

grant execute on function public.get_tenant_billing_status(uuid) to anon, authenticated, service_role;
grant execute on function public.assert_tenant_can_add_member(uuid) to anon, authenticated;

notify pgrst, 'reload schema';
