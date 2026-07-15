-- =============================================================================
-- Billing SaaS — planos + assinaturas por tenant (igreja)
-- =============================================================================
-- Execute no SQL Editor do Supabase APÓS multi-tenant (igrejas / tenant_id).
-- Instância alvo de testes: IBEP (igrejas.code = 'IBEP') + Stripe Test Keys.
-- Depois: Settings → API → Reload schema.
-- =============================================================================

create table if not exists public.billing_plans (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text null,
  max_members integer not null default 50,
  sort_order integer not null default 100,
  stripe_price_id text null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint billing_plans_max_members_check check (max_members = -1 or max_members >= 0)
);

comment on column public.billing_plans.max_members is
  'Limite de membros do tenant; -1 = ilimitado.';

create table if not exists public.tenant_subscriptions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.igrejas (id) on delete cascade,
  plan_id uuid not null references public.billing_plans (id),
  status text not null default 'inactive',
  stripe_customer_id text null,
  stripe_subscription_id text null,
  stripe_checkout_session_id text null,
  current_period_start timestamptz null,
  current_period_end timestamptz null,
  cancel_at_period_end boolean not null default false,
  raw_stripe jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tenant_subscriptions_tenant_unique unique (tenant_id),
  constraint tenant_subscriptions_status_check check (
    status in (
      'inactive',
      'incomplete',
      'incomplete_expired',
      'trialing',
      'active',
      'past_due',
      'canceled',
      'unpaid',
      'paused'
    )
  )
);

create index if not exists tenant_subscriptions_status_idx
  on public.tenant_subscriptions (status);

create index if not exists tenant_subscriptions_stripe_sub_idx
  on public.tenant_subscriptions (stripe_subscription_id);

alter table public.billing_plans enable row level security;
alter table public.tenant_subscriptions enable row level security;

drop policy if exists billing_plans_select_authenticated on public.billing_plans;
create policy billing_plans_select_authenticated
  on public.billing_plans
  for select
  using (is_active = true);

drop policy if exists tenant_subscriptions_select_own on public.tenant_subscriptions;
create policy tenant_subscriptions_select_own
  on public.tenant_subscriptions
  for select
  using (
    tenant_id = public.current_session_tenant_id()
    or public.is_super_admin_profile(public.current_session_profile_id())
  );

-- Planos seed (price_id preenchido depois via admin / env no webhook+checkout)
insert into public.billing_plans (code, name, description, max_members, sort_order, is_active)
values
  (
    'semente',
    'Semente',
    'Igrejas em formação — até 50 membros',
    50,
    10,
    true
  ),
  (
    'crescimento',
    'Crescimento',
    'Comunidades em expansão — até 200 membros',
    200,
    20,
    true
  ),
  (
    'expansao',
    'Expansão',
    'Igrejas consolidadas — até 1.000 membros',
    1000,
    30,
    true
  ),
  (
    'ministerio',
    'Ministério',
    'Operação completa — membros ilimitados',
    -1,
    40,
    true
  )
on conflict (code) do update
  set name = excluded.name,
      description = excluded.description,
      max_members = excluded.max_members,
      sort_order = excluded.sort_order,
      is_active = true,
      updated_at = now();

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

create or replace function public.tenant_subscription_is_access_allowed(p_status text)
returns boolean
language sql
immutable
as $$
  select lower(trim(coalesce(p_status, ''))) in ('active', 'trialing');
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
begin
  v_tenant := coalesce(p_tenant_id, public.current_session_tenant_id());

  if v_tenant is null then
    return jsonb_build_object(
      'success', false,
      'billing_configured', true,
      'message', 'Tenant não identificado.'
    );
  end if;

  -- Sessão de app: só o próprio tenant (ou super_admin). Service role / SQL Editor: p_tenant_id explícito.
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

create or replace function public.list_billing_plans()
returns table (
  id uuid,
  code text,
  name text,
  description text,
  max_members integer,
  sort_order integer,
  stripe_price_id text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    bp.id,
    bp.code,
    bp.name,
    bp.description,
    bp.max_members,
    bp.sort_order,
    bp.stripe_price_id
  from public.billing_plans bp
  where bp.is_active = true
  order by bp.sort_order asc, bp.name asc;
$$;

create or replace function public.assert_tenant_can_add_member(p_tenant_id uuid default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status jsonb;
begin
  v_status := public.get_tenant_billing_status(p_tenant_id);

  if coalesce((v_status ->> 'success')::boolean, false) is not true then
    raise exception '%', coalesce(v_status ->> 'message', 'Faturamento indisponível.');
  end if;

  if coalesce((v_status ->> 'access_allowed')::boolean, false) is not true then
    raise exception 'Assinatura inativa ou vencida. Ative um plano em Assinaturas.';
  end if;

  if coalesce((v_status ->> 'can_add_member')::boolean, false) is not true then
    raise exception 'Limite de membros do plano atingido. Faça upgrade em Assinaturas.';
  end if;
end;
$$;

-- Upsert interno usado pelo webhook (service_role) e RPCs admin.
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

  return jsonb_build_object(
    'success', true,
    'tenant_id', v_row.tenant_id,
    'status', v_row.status,
    'plan_id', v_row.plan_id
  );
end;
$$;

-- Atalho de teste IBEP (service role / SQL Editor) — marca assinatura active no plano escolhido.
create or replace function public.billing_test_activate_ibep_subscription(
  p_plan_code text default 'semente'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid;
begin
  select i.id
    into v_tenant
    from public.igrejas i
   where upper(trim(i.code)) = 'IBEP'
   limit 1;

  if v_tenant is null then
    return jsonb_build_object('success', false, 'message', 'Igreja IBEP não encontrada.');
  end if;

  return public.upsert_tenant_subscription_from_stripe(
    v_tenant,
    p_plan_code,
    'active',
    'cus_test_ibep',
    'sub_test_ibep',
    null,
    now(),
    now() + interval '30 days',
    false,
    jsonb_build_object('source', 'billing_test_activate_ibep_subscription')
  );
end;
$$;

grant select on public.billing_plans to anon, authenticated;
grant select on public.tenant_subscriptions to authenticated;
grant execute on function public.count_tenant_billable_members(uuid) to anon, authenticated;
grant execute on function public.count_tenant_active_users_by_role(uuid) to anon, authenticated;
grant execute on function public.tenant_subscription_is_access_allowed(text) to anon, authenticated;
grant execute on function public.get_tenant_billing_status(uuid) to anon, authenticated, service_role;
grant execute on function public.list_billing_plans() to anon, authenticated, service_role;
grant execute on function public.assert_tenant_can_add_member(uuid) to anon, authenticated;
grant execute on function public.upsert_tenant_subscription_from_stripe(uuid, text, text, text, text, text, timestamptz, timestamptz, boolean, jsonb) to service_role;
grant execute on function public.billing_test_activate_ibep_subscription(text) to service_role;

notify pgrst, 'reload schema';
