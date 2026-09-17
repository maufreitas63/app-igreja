-- Trava comercial da instância + interruptor mestre do Superadmin.
-- Não altera papéis, grants nem profile_access_roles.

alter table public.igrejas
  add column if not exists management_unlocked boolean not null default false;

comment on column public.igrejas.management_unlocked is
  'Interruptor mestre do Super Administrador: libera a gestão da instância mesmo sem contrato/pagamento Stripe. Não altera papéis nem permissões.';

create or replace function public.tenant_has_signed_saas_contract(p_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.billing_saas_contracts c
     where c.tenant_id = p_tenant_id
  );
$$;

create or replace function public.set_tenant_management_unlocked(
  p_unlocked boolean,
  p_tenant_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid;
  v_unlocked boolean;
begin
  -- Interruptor de governança operacional. Não toca profile_access_roles / access_grants.
  if public.current_session_profile_id() is null
     or not public.is_super_admin_profile(public.current_session_profile_id()) then
    raise exception 'Apenas o Super Administrador pode liberar ou bloquear a gestão da instância.';
  end if;

  v_tenant := coalesce(p_tenant_id, public.current_session_tenant_id());

  if v_tenant is null then
    return jsonb_build_object('success', false, 'message', 'Tenant não identificado.');
  end if;

  if not exists (select 1 from public.igrejas i where i.id = v_tenant) then
    return jsonb_build_object('success', false, 'message', 'Igreja (tenant) não encontrada.');
  end if;

  update public.igrejas
     set management_unlocked = coalesce(p_unlocked, false)
   where id = v_tenant
  returning management_unlocked into v_unlocked;

  return jsonb_build_object(
    'success', true,
    'tenant_id', v_tenant,
    'management_unlocked', coalesce(v_unlocked, false),
    'message', case
      when coalesce(v_unlocked, false) then 'Gestão da instância liberada. Papéis e permissões não foram alterados.'
      else 'Gestão da instância bloqueada. Papéis e permissões não foram alterados.'
    end
  );
end;
$$;

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
      'can_add_member', false,
      'plan', null
    );
  end if;

  select *
    into v_plan
    from public.billing_plans bp
   where bp.id = v_sub.plan_id;

  v_allowed := public.tenant_subscription_is_access_allowed(v_sub.status);
  v_commercially_ok := v_allowed and v_has_contract;
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

grant execute on function public.tenant_has_signed_saas_contract(uuid) to anon, authenticated, service_role;
grant execute on function public.set_tenant_management_unlocked(boolean, uuid) to authenticated, service_role;
grant execute on function public.get_tenant_billing_status(uuid) to anon, authenticated, service_role;

notify pgrst, 'reload schema';
