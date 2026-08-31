-- =============================================================================
-- Aliança Conecta Reino — indicações, passivo de 40% e demonstrativo SaaS
-- =============================================================================
-- Super administrador: /igrejas (mãe) + /alianca-conecta-reino (baixa manual)
-- Igreja mãe: aba em /financial
-- Gatilho: webhook Stripe invoice.paid / invoice.payment_failed (service role)
-- =============================================================================

begin;

alter table public.igrejas
  add column if not exists mae_tenant_id uuid;

do $$
begin
  if not exists (
    select 1
      from pg_constraint
     where conname = 'igrejas_mae_tenant_id_fkey'
  ) then
    alter table public.igrejas
      add constraint igrejas_mae_tenant_id_fkey
      foreign key (mae_tenant_id) references public.igrejas (id) on delete set null;
  end if;
end $$;

create index if not exists igrejas_mae_tenant_id_idx
  on public.igrejas (mae_tenant_id);

comment on column public.igrejas.mae_tenant_id is
  'Igreja que indicou esta instância (Aliança Conecta Reino).';

create table if not exists public.referral_partnerships (
  id uuid primary key default gen_random_uuid(),
  mae_tenant_id uuid not null references public.igrejas (id) on delete cascade,
  filha_tenant_id uuid not null references public.igrejas (id) on delete cascade,
  data_inicio timestamptz null,
  data_fim timestamptz null,
  ciclos_pagos integer not null default 0,
  status_global text not null default 'Ativo',
  last_invoice_id text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint referral_partnerships_mae_filha_distinct check (mae_tenant_id <> filha_tenant_id),
  constraint referral_partnerships_ciclos_check check (ciclos_pagos >= 0 and ciclos_pagos <= 4),
  constraint referral_partnerships_status_check check (
    status_global in ('Ativo', 'Encerrado', 'Suspenso_Inadimplencia')
  )
);

alter table public.referral_partnerships
  drop constraint if exists referral_partnerships_filha_unique;

create index if not exists referral_partnerships_mae_idx
  on public.referral_partnerships (mae_tenant_id);

create unique index if not exists referral_partnerships_filha_ativa_uidx
  on public.referral_partnerships (filha_tenant_id)
  where status_global is distinct from 'Encerrado';

create table if not exists public.billing_invoices (
  id uuid primary key default gen_random_uuid(),
  stripe_invoice_id text not null unique,
  tenant_id uuid not null references public.igrejas (id) on delete cascade,
  amount_paid_cents integer not null default 0,
  currency text not null default 'brl',
  paid_at timestamptz null,
  billing_reason text null,
  stripe_subscription_id text null,
  status text not null default 'paid',
  created_at timestamptz not null default now(),
  constraint billing_invoices_status_check check (status in ('paid', 'failed'))
);

create index if not exists billing_invoices_tenant_paid_idx
  on public.billing_invoices (tenant_id, paid_at desc);

create table if not exists public.referral_payouts (
  id uuid primary key default gen_random_uuid(),
  partnership_id uuid not null references public.referral_partnerships (id) on delete cascade,
  stripe_invoice_id text not null unique,
  mae_tenant_id uuid not null references public.igrejas (id) on delete cascade,
  filha_tenant_id uuid not null references public.igrejas (id) on delete cascade,
  gross_amount_cents integer not null,
  reward_pct numeric(5, 4) not null default 0.4000,
  reward_amount_cents integer not null,
  due_at date not null,
  status text not null default 'A_Pagar',
  paid_at timestamptz null,
  paid_by_profile_id uuid null references public.profiles (id) on delete set null,
  ciclo_number integer null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint referral_payouts_status_check check (status in ('A_Pagar', 'Pago')),
  constraint referral_payouts_amounts_check check (
    gross_amount_cents >= 0 and reward_amount_cents >= 0
  )
);

create index if not exists referral_payouts_mae_status_idx
  on public.referral_payouts (mae_tenant_id, status);

create index if not exists referral_payouts_partnership_idx
  on public.referral_payouts (partnership_id);

alter table public.referral_partnerships enable row level security;
alter table public.billing_invoices enable row level security;
alter table public.referral_payouts enable row level security;

drop policy if exists referral_partnerships_no_direct on public.referral_partnerships;
create policy referral_partnerships_no_direct
  on public.referral_partnerships
  for all
  using (false)
  with check (false);

drop policy if exists billing_invoices_no_direct on public.billing_invoices;
create policy billing_invoices_no_direct
  on public.billing_invoices
  for all
  using (false)
  with check (false);

drop policy if exists referral_payouts_no_direct on public.referral_payouts;
create policy referral_payouts_no_direct
  on public.referral_payouts
  for all
  using (false)
  with check (false);

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function public.igreja_mae_would_loop(p_filha uuid, p_mae uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
set row_security = off
as $$
declare
  v_cur uuid := p_mae;
  v_guard integer := 0;
begin
  if p_filha is null or p_mae is null then
    return false;
  end if;
  if p_filha = p_mae then
    return true;
  end if;

  while v_cur is not null and v_guard < 32 loop
    if v_cur = p_filha then
      return true;
    end if;
    select i.mae_tenant_id into v_cur from public.igrejas i where i.id = v_cur;
    v_guard := v_guard + 1;
  end loop;

  return false;
end;
$$;

create or replace function public.alianca_tenant_is_adimplente(p_tenant uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
set row_security = off
as $$
declare
  v_active boolean := false;
  v_status text;
begin
  if p_tenant is null then
    return false;
  end if;

  select i.is_active into v_active from public.igrejas i where i.id = p_tenant;
  if coalesce(v_active, false) is not true then
    return false;
  end if;

  select ts.status
    into v_status
    from public.tenant_subscriptions ts
   where ts.tenant_id = p_tenant
   limit 1;

  return public.tenant_subscription_is_access_allowed(v_status);
end;
$$;

create or replace function public.alianca_ensure_partnership(
  p_mae uuid,
  p_filha uuid,
  p_inicio timestamptz default null
)
returns uuid
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_id uuid;
  v_inicio timestamptz;
begin
  if p_mae is null or p_filha is null or p_mae = p_filha then
    return null;
  end if;

  select rp.id into v_id
    from public.referral_partnerships rp
   where rp.filha_tenant_id = p_filha
     and rp.status_global is distinct from 'Encerrado'
   order by rp.created_at desc
   limit 1;

  v_inicio := coalesce(p_inicio, now());

  if v_id is null then
    insert into public.referral_partnerships (
      mae_tenant_id,
      filha_tenant_id,
      data_inicio,
      data_fim,
      ciclos_pagos,
      status_global
    )
    values (
      p_mae,
      p_filha,
      v_inicio,
      v_inicio + interval '12 months',
      0,
      'Ativo'
    )
    returning id into v_id;
    return v_id;
  end if;

  update public.referral_partnerships
     set mae_tenant_id = p_mae,
         data_inicio = coalesce(data_inicio, v_inicio),
         data_fim = coalesce(data_fim, coalesce(data_inicio, v_inicio) + interval '12 months'),
         updated_at = now()
   where id = v_id
     and status_global is distinct from 'Encerrado';

  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Super admin: vincular igreja mãe (anti-loop)
-- ---------------------------------------------------------------------------
create or replace function public.set_igreja_mae_tenant_admin(
  p_filha_tenant_id uuid,
  p_mae_tenant_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_actor uuid := public.current_session_profile_id();
  v_mae uuid := nullif(p_mae_tenant_id, '00000000-0000-0000-0000-000000000000'::uuid);
  v_pending integer := 0;
begin
  if v_actor is null then
    return jsonb_build_object('success', false, 'message', 'Sessão inválida.');
  end if;
  if not public.profile_has_super_admin_role(v_actor) then
    return jsonb_build_object('success', false, 'message', 'Apenas super administradores.');
  end if;
  if p_filha_tenant_id is null then
    return jsonb_build_object('success', false, 'message', 'Igreja filha não informada.');
  end if;
  if not exists (select 1 from public.igrejas i where i.id = p_filha_tenant_id) then
    return jsonb_build_object('success', false, 'message', 'Igreja filha não encontrada.');
  end if;

  if v_mae is null then
    select count(*)::integer into v_pending
      from public.referral_payouts po
      join public.referral_partnerships rp on rp.id = po.partnership_id
     where rp.filha_tenant_id = p_filha_tenant_id
       and po.status = 'A_Pagar';
    if v_pending > 0 then
      return jsonb_build_object(
        'success', false,
        'message', 'Há ofertas Aliança em aberto. Quite ou mantenha a igreja mãe.'
      );
    end if;

    update public.igrejas
       set mae_tenant_id = null,
           updated_at = now()
     where id = p_filha_tenant_id;

    update public.referral_partnerships
       set status_global = 'Encerrado',
           updated_at = now()
     where filha_tenant_id = p_filha_tenant_id
       and status_global is distinct from 'Encerrado'
       and ciclos_pagos = 0
       and not exists (
         select 1 from public.referral_payouts po
          where po.partnership_id = referral_partnerships.id
            and po.status = 'Pago'
       );

    return jsonb_build_object('success', true, 'message', 'Indicação removida.');
  end if;

  if not exists (select 1 from public.igrejas i where i.id = v_mae) then
    return jsonb_build_object('success', false, 'message', 'Igreja mãe não encontrada.');
  end if;
  if public.igreja_mae_would_loop(p_filha_tenant_id, v_mae) then
    return jsonb_build_object(
      'success', false,
      'message', 'Essa mãe geraria um ciclo na árvore de indicações.'
    );
  end if;

  update public.igrejas
     set mae_tenant_id = v_mae,
         updated_at = now()
   where id = p_filha_tenant_id;

  perform public.alianca_ensure_partnership(v_mae, p_filha_tenant_id, now());

  return jsonb_build_object('success', true, 'message', 'Igreja mãe vinculada.');
end;
$$;

-- ---------------------------------------------------------------------------
-- Webhook: fatura paga (receita + passivo 40%)
-- ---------------------------------------------------------------------------
create or replace function public.process_alianca_invoice_paid(
  p_stripe_invoice_id text,
  p_tenant_id uuid,
  p_amount_paid_cents integer,
  p_currency text,
  p_paid_at timestamptz,
  p_billing_reason text,
  p_stripe_subscription_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_invoice text := nullif(trim(coalesce(p_stripe_invoice_id, '')), '');
  v_amount integer := greatest(coalesce(p_amount_paid_cents, 0), 0);
  v_paid_at timestamptz := coalesce(p_paid_at, now());
  v_mae uuid;
  v_partnership uuid;
  v_rp public.referral_partnerships%rowtype;
  v_payouts integer := 0;
  v_reward integer := 0;
begin
  if v_invoice is null or p_tenant_id is null then
    return jsonb_build_object('success', false, 'message', 'Fatura ou tenant ausente.');
  end if;

  insert into public.billing_invoices (
    stripe_invoice_id,
    tenant_id,
    amount_paid_cents,
    currency,
    paid_at,
    billing_reason,
    stripe_subscription_id,
    status
  )
  values (
    v_invoice,
    p_tenant_id,
    v_amount,
    coalesce(nullif(lower(trim(coalesce(p_currency, ''))), ''), 'brl'),
    v_paid_at,
    nullif(trim(coalesce(p_billing_reason, '')), ''),
    nullif(trim(coalesce(p_stripe_subscription_id, '')), ''),
    'paid'
  )
  on conflict (stripe_invoice_id) do update
    set amount_paid_cents = excluded.amount_paid_cents,
        paid_at = coalesce(public.billing_invoices.paid_at, excluded.paid_at),
        status = 'paid';

  if exists (select 1 from public.referral_payouts po where po.stripe_invoice_id = v_invoice) then
    return jsonb_build_object('success', true, 'idempotent', true, 'payout', false);
  end if;

  select i.mae_tenant_id into v_mae from public.igrejas i where i.id = p_tenant_id;
  if v_mae is null then
    return jsonb_build_object('success', true, 'payout', false, 'reason', 'sem_mae');
  end if;

  v_partnership := public.alianca_ensure_partnership(v_mae, p_tenant_id, v_paid_at);
  select * into v_rp from public.referral_partnerships where id = v_partnership;

  update public.referral_partnerships
     set last_invoice_id = v_invoice,
         updated_at = now()
   where id = v_partnership;

  if v_rp.status_global = 'Encerrado' or coalesce(v_rp.ciclos_pagos, 0) >= 4 then
    return jsonb_build_object('success', true, 'payout', false, 'reason', 'vigencia_encerrada');
  end if;

  if v_rp.data_fim is not null and v_paid_at > v_rp.data_fim then
    update public.referral_partnerships
       set status_global = 'Encerrado',
           updated_at = now()
     where id = v_partnership;
    return jsonb_build_object('success', true, 'payout', false, 'reason', 'prazo_12_meses');
  end if;

  select count(*)::integer into v_payouts
    from public.referral_payouts po
   where po.partnership_id = v_partnership;
  if v_payouts >= 4 then
    return jsonb_build_object('success', true, 'payout', false, 'reason', 'quatro_ciclos');
  end if;

  if v_amount <= 0 then
    return jsonb_build_object('success', true, 'payout', false, 'reason', 'valor_zero');
  end if;

  if not public.alianca_tenant_is_adimplente(p_tenant_id)
     or not public.alianca_tenant_is_adimplente(v_mae) then
    update public.referral_partnerships
       set status_global = 'Suspenso_Inadimplencia',
           updated_at = now()
     where id = v_partnership
       and status_global is distinct from 'Encerrado';
    return jsonb_build_object('success', true, 'payout', false, 'reason', 'inadimplencia_cruzada');
  end if;

  if v_rp.status_global = 'Suspenso_Inadimplencia' then
    update public.referral_partnerships
       set status_global = 'Ativo',
           updated_at = now()
     where id = v_partnership;
  end if;

  v_reward := round(v_amount * 0.40)::integer;

  insert into public.referral_payouts (
    partnership_id,
    stripe_invoice_id,
    mae_tenant_id,
    filha_tenant_id,
    gross_amount_cents,
    reward_pct,
    reward_amount_cents,
    due_at,
    status
  )
  values (
    v_partnership,
    v_invoice,
    v_mae,
    p_tenant_id,
    v_amount,
    0.4000,
    v_reward,
    (v_paid_at + interval '30 days')::date,
    'A_Pagar'
  );

  return jsonb_build_object(
    'success', true,
    'payout', true,
    'reward_amount_cents', v_reward
  );
end;
$$;

create or replace function public.process_alianca_invoice_failed(
  p_stripe_invoice_id text,
  p_tenant_id uuid,
  p_stripe_subscription_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_invoice text := nullif(trim(coalesce(p_stripe_invoice_id, '')), '');
begin
  if p_tenant_id is null then
    return jsonb_build_object('success', false, 'message', 'Tenant ausente.');
  end if;

  if v_invoice is not null then
    insert into public.billing_invoices (
      stripe_invoice_id,
      tenant_id,
      amount_paid_cents,
      stripe_subscription_id,
      status
    )
    values (v_invoice, p_tenant_id, 0, nullif(trim(coalesce(p_stripe_subscription_id, '')), ''), 'failed')
    on conflict (stripe_invoice_id) do update
      set status = 'failed';
  end if;

  update public.referral_partnerships
     set status_global = 'Suspenso_Inadimplencia',
         last_invoice_id = coalesce(v_invoice, last_invoice_id),
         updated_at = now()
   where filha_tenant_id = p_tenant_id
     and status_global = 'Ativo';

  return jsonb_build_object('success', true);
end;
$$;

-- ---------------------------------------------------------------------------
-- Super admin: baixa manual da oferta (avança ciclo / encerra no 4º)
-- ---------------------------------------------------------------------------
create or replace function public.settle_alianca_payout_admin(p_payout_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_actor uuid := public.current_session_profile_id();
  v_po public.referral_payouts%rowtype;
  v_ciclos integer;
begin
  if v_actor is null then
    return jsonb_build_object('success', false, 'message', 'Sessão inválida.');
  end if;
  if not public.profile_has_super_admin_role(v_actor) then
    return jsonb_build_object('success', false, 'message', 'Apenas super administradores.');
  end if;
  if p_payout_id is null then
    return jsonb_build_object('success', false, 'message', 'Repasse não informado.');
  end if;

  select * into v_po from public.referral_payouts where id = p_payout_id;
  if v_po.id is null then
    return jsonb_build_object('success', false, 'message', 'Repasse não encontrado.');
  end if;
  if v_po.status = 'Pago' then
    return jsonb_build_object('success', true, 'idempotent', true, 'message', 'Já estava pago.');
  end if;

  update public.referral_partnerships
     set ciclos_pagos = least(ciclos_pagos + 1, 4),
         status_global = case
           when ciclos_pagos + 1 >= 4 then 'Encerrado'
           else status_global
         end,
         updated_at = now()
   where id = v_po.partnership_id
  returning ciclos_pagos into v_ciclos;

  update public.referral_payouts
     set status = 'Pago',
         paid_at = now(),
         paid_by_profile_id = v_actor,
         ciclo_number = v_ciclos,
         updated_at = now()
   where id = p_payout_id;

  return jsonb_build_object(
    'success', true,
    'ciclos_pagos', v_ciclos,
    'encerrado', v_ciclos >= 4,
    'message', case
      when v_ciclos >= 4 then 'Oferta efetivada. Parceria encerrada (4 ciclos).'
      else 'Oferta efetivada. Ciclo ' || v_ciclos::text || ' de 4.'
    end
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Painel da igreja mãe (/financial)
-- ---------------------------------------------------------------------------
create or replace function public.get_alianca_mae_panel()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
set row_security = off
as $$
declare
  v_actor uuid := public.current_session_profile_id();
  v_tenant uuid := public.current_session_tenant_id();
begin
  if v_actor is null or v_tenant is null then
    return jsonb_build_object('success', false, 'message', 'Sessão inválida.');
  end if;

  return jsonb_build_object(
    'success', true,
    'tenant_id', v_tenant,
    'daughters', coalesce((
      select jsonb_agg(x order by x->>'filha_name')
      from (
        select jsonb_build_object(
          'filha_tenant_id', i.id,
          'filha_code', i.code,
          'filha_name', i.name,
          'partnership_id', rp.id,
          'status_global', coalesce(rp.status_global, 'Ativo'),
          'status_label', case coalesce(rp.status_global, 'Ativo')
            when 'Ativo' then 'Apta'
            when 'Suspenso_Inadimplencia' then 'Suspensa'
            when 'Encerrado' then 'Encerrada (12 meses concluídos)'
            else coalesce(rp.status_global, 'Apta')
          end,
          'ciclos_pagos', coalesce(rp.ciclos_pagos, 0),
          'data_inicio', rp.data_inicio,
          'data_fim', rp.data_fim,
          'next_due_at', (
            select po.due_at
              from public.referral_payouts po
             where po.partnership_id = rp.id
               and po.status = 'A_Pagar'
             order by po.due_at asc
             limit 1
          ),
          'next_amount_cents', (
            select po.reward_amount_cents
              from public.referral_payouts po
             where po.partnership_id = rp.id
               and po.status = 'A_Pagar'
             order by po.due_at asc
             limit 1
          )
        ) as x
        from public.igrejas i
        left join lateral (
          select rp.*
            from public.referral_partnerships rp
           where rp.filha_tenant_id = i.id
             and rp.mae_tenant_id = v_tenant
           order by case when rp.status_global = 'Encerrado' then 1 else 0 end,
                    rp.created_at desc
           limit 1
        ) rp on true
        where i.mae_tenant_id = v_tenant
      ) q
    ), '[]'::jsonb),
    'payouts', coalesce((
      select jsonb_agg(x order by x->>'created_at' desc)
      from (
        select jsonb_build_object(
          'id', po.id,
          'filha_code', fi.code,
          'filha_name', fi.name,
          'gross_amount_cents', po.gross_amount_cents,
          'reward_amount_cents', po.reward_amount_cents,
          'due_at', po.due_at,
          'status', po.status,
          'paid_at', po.paid_at,
          'ciclo_number', po.ciclo_number,
          'created_at', po.created_at,
          'category', 'Oferta de Apoio Ministerial - Aliança'
        ) as x
        from public.referral_payouts po
        join public.igrejas fi on fi.id = po.filha_tenant_id
        where po.mae_tenant_id = v_tenant
      ) q
    ), '[]'::jsonb)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Demonstrativo Super Admin
-- ---------------------------------------------------------------------------
create or replace function public.get_alianca_admin_statement()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
set row_security = off
as $$
declare
  v_actor uuid := public.current_session_profile_id();
  v_gross bigint := 0;
  v_pending bigint := 0;
  v_paid bigint := 0;
begin
  if v_actor is null then
    return jsonb_build_object('success', false, 'message', 'Sessão inválida.');
  end if;
  if not public.profile_has_super_admin_role(v_actor) then
    return jsonb_build_object('success', false, 'message', 'Apenas super administradores.');
  end if;

  select coalesce(sum(bi.amount_paid_cents), 0)::bigint into v_gross
    from public.billing_invoices bi
   where bi.status = 'paid';

  select coalesce(sum(po.reward_amount_cents), 0)::bigint into v_pending
    from public.referral_payouts po
   where po.status = 'A_Pagar';

  select coalesce(sum(po.reward_amount_cents), 0)::bigint into v_paid
    from public.referral_payouts po
   where po.status = 'Pago';

  return jsonb_build_object(
    'success', true,
    'gross_revenue_cents', v_gross,
    'payout_pending_cents', v_pending,
    'payout_paid_cents', v_paid,
    'net_realized_cents', v_gross - v_paid,
    'net_after_pending_cents', v_gross - v_paid - v_pending,
    'reward_pct', 0.40,
    'payouts', coalesce((
      select jsonb_agg(x order by (x->>'status') asc, x->>'due_at' asc)
      from (
        select jsonb_build_object(
          'id', po.id,
          'mae_code', mae.code,
          'mae_name', mae.name,
          'filha_code', fi.code,
          'filha_name', fi.name,
          'gross_amount_cents', po.gross_amount_cents,
          'reward_amount_cents', po.reward_amount_cents,
          'due_at', po.due_at,
          'status', po.status,
          'paid_at', po.paid_at,
          'ciclo_number', po.ciclo_number,
          'ciclos_pagos', rp.ciclos_pagos,
          'status_global', rp.status_global,
          'created_at', po.created_at
        ) as x
        from public.referral_payouts po
        join public.referral_partnerships rp on rp.id = po.partnership_id
        join public.igrejas mae on mae.id = po.mae_tenant_id
        join public.igrejas fi on fi.id = po.filha_tenant_id
      ) q
    ), '[]'::jsonb)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- list_admin_igrejas — inclui igreja mãe
-- ---------------------------------------------------------------------------
drop function if exists public.list_admin_igrejas();

create function public.list_admin_igrejas()
returns table (
  id uuid,
  code text,
  name text,
  logo_url text,
  website_url text,
  instagram_url text,
  youtube_url text,
  cnpj text,
  pix_institution text,
  pix_key text,
  is_active boolean,
  is_primary boolean,
  is_linked boolean,
  mae_tenant_id uuid,
  mae_code text,
  mae_name text
)
language plpgsql
stable
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_profile_id uuid := public.current_session_profile_id();
begin
  if v_profile_id is null then
    return;
  end if;

  if not public.profile_has_super_admin_role(v_profile_id) then
    return;
  end if;

  return query
  select
    q.id,
    q.code,
    q.name,
    q.logo_url,
    q.website_url,
    q.instagram_url,
    q.youtube_url,
    q.cnpj,
    q.pix_institution,
    q.pix_key,
    q.is_active,
    q.is_primary,
    q.is_linked,
    q.mae_tenant_id,
    q.mae_code,
    q.mae_name
  from (
    select
      i.id,
      i.code,
      i.name,
      nullif(trim(i.logo_url), '') as logo_url,
      nullif(trim(i.website_url), '') as website_url,
      nullif(trim(i.instagram_url), '') as instagram_url,
      nullif(trim(i.youtube_url), '') as youtube_url,
      nullif(trim(i.cnpj), '') as cnpj,
      nullif(trim(i.pix_institution), '') as pix_institution,
      nullif(trim(i.pix_key), '') as pix_key,
      i.is_active,
      coalesce(v.is_primary, false) as is_primary,
      (v.id is not null) as is_linked,
      i.mae_tenant_id,
      mae.code as mae_code,
      mae.name as mae_name
    from public.igrejas i
    left join public.igrejas mae on mae.id = i.mae_tenant_id
    left join public.profile_igreja_vinculos v
      on v.tenant_id = i.id
     and v.profile_id = v_profile_id
     and v.is_active = true
  ) q
  order by q.is_active desc, q.is_primary desc, q.name asc;
end;
$$;

grant execute on function public.igreja_mae_would_loop(uuid, uuid) to anon, authenticated;
grant execute on function public.alianca_tenant_is_adimplente(uuid) to anon, authenticated;
grant execute on function public.alianca_ensure_partnership(uuid, uuid, timestamptz) to anon, authenticated;
grant execute on function public.set_igreja_mae_tenant_admin(uuid, uuid) to anon, authenticated;
grant execute on function public.process_alianca_invoice_paid(text, uuid, integer, text, timestamptz, text, text) to anon, authenticated, service_role;
grant execute on function public.process_alianca_invoice_failed(text, uuid, text) to anon, authenticated, service_role;
grant execute on function public.settle_alianca_payout_admin(uuid) to anon, authenticated;
grant execute on function public.get_alianca_mae_panel() to anon, authenticated;
grant execute on function public.get_alianca_admin_statement() to anon, authenticated;
grant execute on function public.list_admin_igrejas() to anon, authenticated;

notify pgrst, 'reload schema';

commit;
