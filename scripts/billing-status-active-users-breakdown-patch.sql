-- Patch: contagem de usuários faturáveis = membros + congregados ativos.
-- Retorna breakdown em get_tenant_billing_status para a UI de Assinaturas.
-- Execute no SQL Editor do Supabase APÓS billing-plans-subscriptions.sql
-- e após as funções resolve_basic_role_code_for_profile /
-- resolve_effective_membership_dates_for_profile.
-- Depois: Settings → API → Reload schema.

create or replace function public.count_tenant_billable_members(p_tenant_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::integer
    from public.profiles p
    cross join lateral public.resolve_effective_membership_dates_for_profile(p.id) eff
   where p.tenant_id = p_tenant_id
     and public.resolve_basic_role_code_for_profile(p.id) in ('member', 'congregado')
     and coalesce(eff.membership_out::text, '') = '';
$$;

comment on function public.count_tenant_billable_members(uuid) is
  'Conta membros + congregados ativos do tenant (membership_out efetiva vazia).';

create or replace function public.count_tenant_active_users_by_role(p_tenant_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with eligible as (
    select public.resolve_basic_role_code_for_profile(p.id) as role_code
      from public.profiles p
      cross join lateral public.resolve_effective_membership_dates_for_profile(p.id) eff
     where p.tenant_id = p_tenant_id
       and public.resolve_basic_role_code_for_profile(p.id) in ('member', 'congregado')
       and coalesce(eff.membership_out::text, '') = ''
  )
  select jsonb_build_object(
    'active_members', (select count(*)::integer from eligible where role_code = 'member'),
    'active_congregados', (select count(*)::integer from eligible where role_code = 'congregado'),
    'active_users', (select count(*)::integer from eligible)
  );
$$;

grant execute on function public.count_tenant_active_users_by_role(uuid) to anon, authenticated;

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
    'member_count', v_members,
    'active_members', coalesce((v_breakdown ->> 'active_members')::integer, 0),
    'active_congregados', coalesce((v_breakdown ->> 'active_congregados')::integer, 0),
    'max_members', v_plan.max_members,
    'can_add_member', v_can_add,
    'cancel_at_period_end', v_sub.cancel_at_period_end,
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
