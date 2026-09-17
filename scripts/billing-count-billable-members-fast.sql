-- =============================================================================
-- Checkout Stripe: contagem de usuários faturáveis em SQL de conjunto
-- =============================================================================
-- assert_tenant_can_subscribe_plan chamava, por perfil:
--   resolve_basic_role_code_for_profile + resolve_effective_membership_dates_for_profile
--   (e para congregado, resolve_profile_guardian_profile_id com match fuzzy).
-- Em igrejas com centenas de perfis isso estoura statement_timeout no PostgREST.
-- Aqui: join em profile_access_roles + membership_out do próprio perfil.
-- Planos ilimitados (max_members < 0) nem contam.
-- Aplica: npx supabase db query --linked -f scripts/billing-count-billable-members-fast.sql
-- =============================================================================

create index if not exists profiles_tenant_id_idx on public.profiles (tenant_id);
create index if not exists profile_access_roles_profile_id_idx on public.profile_access_roles (profile_id);

create or replace function public.count_tenant_billable_members(p_tenant_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  with role_codes as (
    select
      par.profile_id,
      case
        when bool_or(ar.code = 'member') then 'member'
        when bool_or(ar.code = 'congregado') then 'congregado'
        else 'visitante'
      end as role_code
    from public.profile_access_roles par
    join public.access_roles ar on ar.id = par.role_id
    join public.profiles p on p.id = par.profile_id
    where p.tenant_id = p_tenant_id
      and ar.code in ('member', 'congregado')
    group by par.profile_id
  )
  select count(*)::integer
    from public.profiles p
    join role_codes rc on rc.profile_id = p.id
   where p.tenant_id = p_tenant_id
     and rc.role_code in ('member', 'congregado')
     and coalesce(p.membership_out::text, '') = '';
$$;

comment on function public.count_tenant_billable_members(uuid) is
  'Conta membros + congregados ativos do tenant (SQL de conjunto; membership_out do próprio perfil).';

create or replace function public.count_tenant_active_users_by_role(p_tenant_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with role_codes as (
    select
      par.profile_id,
      case
        when bool_or(ar.code = 'member') then 'member'
        when bool_or(ar.code = 'congregado') then 'congregado'
        else 'visitante'
      end as role_code
    from public.profile_access_roles par
    join public.access_roles ar on ar.id = par.role_id
    join public.profiles p on p.id = par.profile_id
    where p.tenant_id = p_tenant_id
      and ar.code in ('member', 'congregado')
    group by par.profile_id
  ),
  eligible as (
    select rc.role_code
      from public.profiles p
      join role_codes rc on rc.profile_id = p.id
     where p.tenant_id = p_tenant_id
       and rc.role_code in ('member', 'congregado')
       and coalesce(p.membership_out::text, '') = ''
  )
  select jsonb_build_object(
    'active_members', (select count(*)::integer from eligible where role_code = 'member'),
    'active_congregados', (select count(*)::integer from eligible where role_code = 'congregado'),
    'active_users', (select count(*)::integer from eligible)
  );
$$;

create or replace function public.assert_tenant_can_subscribe_plan(
  p_tenant_id uuid,
  p_plan_code text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_plan public.billing_plans%rowtype;
  v_users integer := 0;
begin
  if p_tenant_id is null or coalesce(trim(p_plan_code), '') = '' then
    return jsonb_build_object('ok', false, 'message', 'tenant_id e plan_code são obrigatórios.');
  end if;

  select *
    into v_plan
    from public.billing_plans bp
   where lower(trim(bp.code)) = lower(trim(p_plan_code))
     and bp.is_active = true
   limit 1;

  if v_plan.id is null then
    return jsonb_build_object('ok', false, 'message', 'Plano não encontrado.');
  end if;

  if v_plan.max_members < 0 then
    return jsonb_build_object('ok', true, 'active_users', null, 'max_members', v_plan.max_members);
  end if;

  v_users := public.count_tenant_billable_members(p_tenant_id);

  if v_users > v_plan.max_members then
    return jsonb_build_object(
      'ok', false,
      'message', format(
        'Este plano comporta até %s usuários ativos. A igreja tem %s (membros + congregados). Escolha um plano maior.',
        v_plan.max_members,
        v_users
      )
    );
  end if;

  return jsonb_build_object('ok', true, 'active_users', v_users, 'max_members', v_plan.max_members);
end;
$$;

grant execute on function public.count_tenant_billable_members(uuid) to anon, authenticated, service_role;
grant execute on function public.count_tenant_active_users_by_role(uuid) to anon, authenticated, service_role;
grant execute on function public.assert_tenant_can_subscribe_plan(uuid, text) to anon, authenticated, service_role;

notify pgrst, 'reload schema';
