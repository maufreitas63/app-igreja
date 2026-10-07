-- =============================================================================
-- Aliança Conecta Reino — 10% perpétuo de cashback na fatura da igreja mãe
-- =============================================================================
-- Incide sobre o pacote da igreja indicada. As duas igrejas precisam estar
-- ativas. O desconto da indicadora não passa de 100% do pacote dela.
-- Aplica: npx supabase db query --linked -f scripts/alianca-cashback-perpetuo.sql
-- =============================================================================

begin;

alter table public.referral_payouts
  add column if not exists applied_to_invoice_id text;

alter table public.referral_payouts
  alter column reward_pct set default 0.1000;

alter table public.referral_payouts
  drop constraint if exists referral_payouts_status_check;

alter table public.referral_payouts
  add constraint referral_payouts_status_check
  check (status in ('A_Pagar', 'Pago', 'Creditado', 'Abatido'));

comment on column public.referral_payouts.applied_to_invoice_id is
  'Fatura Stripe da igreja indicadora em que o cashback foi abatido.';

-- Teto: crédito novo não pode fazer o saldo em aberto passar do pacote da mãe.
create or replace function public.alianca_cap_cashback(
  p_raw_cents integer,
  p_unapplied_cents integer,
  p_package_cents integer
)
returns integer
language sql
immutable
as $$
  select least(
    greatest(coalesce(p_raw_cents, 0), 0),
    greatest(coalesce(p_package_cents, 0) - greatest(coalesce(p_unapplied_cents, 0), 0), 0)
  )::integer;
$$;

do $$
begin
  if public.alianca_cap_cashback(500, 800, 1000) <> 200 then
    raise exception 'teto parcial falhou';
  end if;
  if public.alianca_cap_cashback(500, 1000, 1000) <> 0 then
    raise exception 'teto cheio falhou';
  end if;
  if public.alianca_cap_cashback(1500, 0, 1000) <> 1000 then
    raise exception 'teto do pacote falhou';
  end if;
  if public.alianca_cap_cashback(100, 0, 0) <> 0 then
    raise exception 'pacote zerado falhou';
  end if;
end $$;

create or replace function public.alianca_package_cents(p_tenant uuid)
returns integer
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select coalesce(
    (
      select bp.quarterly_amount_cents
        from public.tenant_subscriptions ts
        join public.billing_plans bp on bp.id = ts.plan_id
       where ts.tenant_id = p_tenant
         and coalesce(bp.quarterly_amount_cents, 0) > 0
       limit 1
    ),
    (
      select bi.amount_paid_cents
        from public.billing_invoices bi
       where bi.tenant_id = p_tenant
         and bi.status = 'paid'
         and bi.amount_paid_cents > 0
       order by bi.paid_at desc nulls last
       limit 1
    ),
    0
  )::integer;
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
     and rp.mae_tenant_id = p_mae
   order by case when rp.status_global = 'Encerrado' then 1 else 0 end,
            rp.created_at desc
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
    values (p_mae, p_filha, v_inicio, null, 0, 'Ativo')
    returning id into v_id;
    return v_id;
  end if;

  update public.referral_partnerships
     set mae_tenant_id = p_mae,
         data_inicio = coalesce(data_inicio, v_inicio),
         data_fim = null,
         status_global = case
           when status_global = 'Encerrado' then 'Ativo'
           else status_global
         end,
         updated_at = now()
   where id = v_id;

  return v_id;
end;
$$;

drop function if exists public.process_alianca_invoice_paid(text, uuid, integer, text, timestamptz, text, text);

create or replace function public.process_alianca_invoice_paid(
  p_stripe_invoice_id text,
  p_tenant_id uuid,
  p_amount_paid_cents integer,
  p_currency text,
  p_paid_at timestamptz,
  p_billing_reason text,
  p_stripe_subscription_id text,
  p_balance_applied_cents integer default 0
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
  v_package_filha integer := 0;
  v_package_mae integer := 0;
  v_raw integer := 0;
  v_unapplied integer := 0;
  v_credit integer := 0;
  v_abatement integer := 0;
  v_room integer := 0;
  v_balance integer := greatest(coalesce(p_balance_applied_cents, 0), 0);
  v_customer text;
  v_row public.referral_payouts%rowtype;
begin
  if v_invoice is null or p_tenant_id is null then
    return jsonb_build_object('success', false, 'message', 'Fatura ou tenant ausente.');
  end if;

  insert into public.billing_invoices (
    stripe_invoice_id, tenant_id, amount_paid_cents, currency, paid_at,
    billing_reason, stripe_subscription_id, status
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

  -- Cashback da filha para a mãe desta instância (mesmo tenant da fatura).
  if not exists (
    select 1 from public.referral_payouts po where po.stripe_invoice_id = v_invoice
  ) then
    select i.mae_tenant_id into v_mae
      from public.igrejas i
     where i.id = p_tenant_id;

    if v_mae is not null and v_mae <> p_tenant_id and v_amount > 0 then
      v_partnership := public.alianca_ensure_partnership(v_mae, p_tenant_id, v_paid_at);

      if public.alianca_tenant_is_adimplente(p_tenant_id)
         and public.alianca_tenant_is_adimplente(v_mae) then
        update public.referral_partnerships
           set status_global = 'Ativo',
               data_fim = null,
               last_invoice_id = v_invoice,
               updated_at = now()
         where id = v_partnership;

        v_package_filha := public.alianca_package_cents(p_tenant_id);
        v_package_mae := public.alianca_package_cents(v_mae);
        -- Base é o pacote da filha; se o plano ainda não tem preço, usa a fatura paga.
        v_raw := round((case when v_package_filha > 0 then v_package_filha else v_amount end) * 0.10)::integer;

        -- Teto ocupa todo crédito ainda não abatido desta mãe, mesmo suspenso.
        select coalesce(sum(po.reward_amount_cents), 0)::integer into v_unapplied
          from public.referral_payouts po
         where po.mae_tenant_id = v_mae
           and po.status = 'Creditado';

        v_credit := public.alianca_cap_cashback(v_raw, v_unapplied, v_package_mae);

        if v_credit > 0 then
          insert into public.referral_payouts (
            partnership_id, stripe_invoice_id, mae_tenant_id, filha_tenant_id,
            gross_amount_cents, reward_pct, reward_amount_cents, due_at, status
          )
          values (
            v_partnership, v_invoice, v_mae, p_tenant_id,
            case when v_package_filha > 0 then v_package_filha else v_amount end,
            0.1000, v_credit, v_paid_at::date, 'Creditado'
          );
        end if;
      else
        update public.referral_partnerships
           set status_global = 'Suspenso_Inadimplencia',
               last_invoice_id = v_invoice,
               updated_at = now()
         where id = v_partnership
           and status_global is distinct from 'Encerrado';
      end if;
    end if;
  end if;

  -- Abate só o que o saldo Stripe desta fatura realmente descontou, no máximo o pacote.
  v_package_mae := public.alianca_package_cents(p_tenant_id);
  v_room := least(
    v_balance,
    case when v_package_mae > 0 then v_package_mae else v_balance end
  );

  for v_row in
    select po.*
      from public.referral_payouts po
      join public.igrejas filha on filha.id = po.filha_tenant_id
     where po.mae_tenant_id = p_tenant_id
       and po.status = 'Creditado'
       and filha.mae_tenant_id = p_tenant_id
       and public.alianca_tenant_is_adimplente(po.filha_tenant_id)
       and public.alianca_tenant_is_adimplente(po.mae_tenant_id)
     order by po.created_at asc
  loop
    exit when v_abatement >= v_room;
    if v_abatement + v_row.reward_amount_cents <= v_room then
      update public.referral_payouts
         set status = 'Abatido',
             paid_at = v_paid_at,
             applied_to_invoice_id = v_invoice,
             updated_at = now()
       where id = v_row.id
         and status = 'Creditado';
      v_abatement := v_abatement + v_row.reward_amount_cents;
    end if;
  end loop;

  select ts.stripe_customer_id into v_customer
    from public.tenant_subscriptions ts
   where ts.tenant_id = v_mae
   limit 1;

  return jsonb_build_object(
    'success', true,
    'cashback_cents', v_credit,
    'abatement_cents', v_abatement,
    'mae_tenant_id', v_mae,
    'mae_stripe_customer_id', nullif(trim(coalesce(v_customer, '')), ''),
    'reward_pct', 0.10
  );
end;
$$;

grant execute on function public.process_alianca_invoice_paid(text, uuid, integer, text, timestamptz, text, text, integer)
  to anon, authenticated, service_role;

revoke all on function public.alianca_package_cents(uuid) from public, anon, authenticated;
revoke all on function public.alianca_cap_cashback(integer, integer, integer) from public, anon, authenticated;

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
  if v_po.status <> 'A_Pagar' then
    return jsonb_build_object(
      'success', false,
      'message', 'Cashback de 10% abate na fatura da igreja que indicou. Não há baixa manual.'
    );
  end if;

  update public.referral_partnerships
     set ciclos_pagos = least(ciclos_pagos + 1, 4),
         updated_at = now()
   where id = v_po.partnership_id
  returning ciclos_pagos into v_ciclos;

  update public.referral_payouts
     set status = 'Pago',
         paid_at = now(),
         paid_by_profile_id = v_actor,
         ciclo_number = v_ciclos,
         updated_at = now()
   where id = p_payout_id
     and status = 'A_Pagar';

  return jsonb_build_object(
    'success', true,
    'ciclos_pagos', v_ciclos,
    'encerrado', false,
    'message', 'Oferta do modelo anterior efetivada. Novos descontos abatem na fatura.'
  );
end;
$$;

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
  v_package integer := 0;
  v_open integer := 0;
begin
  if v_actor is null or v_tenant is null then
    return jsonb_build_object('success', false, 'message', 'Sessão inválida.');
  end if;

  v_package := public.alianca_package_cents(v_tenant);

  select coalesce(sum(po.reward_amount_cents), 0)::integer into v_open
    from public.referral_payouts po
    join public.igrejas filha on filha.id = po.filha_tenant_id
   where po.mae_tenant_id = v_tenant
     and po.status = 'Creditado'
     and filha.mae_tenant_id = v_tenant
     and public.alianca_tenant_is_adimplente(po.filha_tenant_id)
     and public.alianca_tenant_is_adimplente(v_tenant);

  return jsonb_build_object(
    'success', true,
    'tenant_id', v_tenant,
    'package_cents', v_package,
    'cashback_open_cents', least(v_open, v_package),
    'reward_pct', 0.10,
    'daughters', coalesce((
      select jsonb_agg(x order by x->>'filha_name')
      from (
        select jsonb_build_object(
          'filha_tenant_id', i.id,
          'filha_code', i.code,
          'filha_name', i.name,
          'partnership_id', rp.id,
          'status_global', case
            when public.alianca_tenant_is_adimplente(i.id)
             and public.alianca_tenant_is_adimplente(v_tenant) then 'Ativo'
            else 'Suspenso_Inadimplencia'
          end,
          'status_label', case
            when public.alianca_tenant_is_adimplente(i.id)
             and public.alianca_tenant_is_adimplente(v_tenant)
              then 'Ativa — 10% na sua fatura'
            else 'Suspensa — uma das igrejas está inativa'
          end,
          'ciclos_pagos', coalesce(rp.ciclos_pagos, 0),
          'data_inicio', rp.data_inicio,
          'data_fim', null,
          'next_due_at', null,
          'next_amount_cents', (
            select po.reward_amount_cents
              from public.referral_payouts po
             where po.filha_tenant_id = i.id
               and po.mae_tenant_id = v_tenant
               and po.status = 'Creditado'
             order by po.created_at desc
             limit 1
          )
        ) as x
        from public.igrejas i
        left join lateral (
          select rp.*
            from public.referral_partnerships rp
           where rp.filha_tenant_id = i.id
             and rp.mae_tenant_id = v_tenant
           order by rp.created_at desc
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
          'category', 'Cashback Aliança — 10%'
        ) as x
        from public.referral_payouts po
        join public.igrejas fi on fi.id = po.filha_tenant_id
        where po.mae_tenant_id = v_tenant
      ) q
    ), '[]'::jsonb)
  );
end;
$$;

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
  v_applied bigint := 0;
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
    join public.igrejas filha on filha.id = po.filha_tenant_id
    join public.igrejas mae on mae.id = po.mae_tenant_id
   where po.status = 'Creditado'
     and filha.mae_tenant_id = po.mae_tenant_id
     and public.alianca_tenant_is_adimplente(po.filha_tenant_id)
     and public.alianca_tenant_is_adimplente(po.mae_tenant_id);

  select coalesce(sum(po.reward_amount_cents), 0)::bigint into v_applied
    from public.referral_payouts po
   where po.status in ('Abatido', 'Pago');

  return jsonb_build_object(
    'success', true,
    'gross_revenue_cents', v_gross,
    'payout_pending_cents', v_pending,
    'payout_paid_cents', v_applied,
    'net_realized_cents', v_gross - v_applied,
    'net_after_pending_cents', v_gross - v_applied - v_pending,
    'reward_pct', 0.10,
    'payouts', coalesce((
      select jsonb_agg(x order by (x->>'status') asc, x->>'created_at' desc)
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

update public.knowledge_articles
   set body = $body$## O que é a Aliança Conecta Reino
É o programa de indicação entre instâncias do Conecta+. Quando uma igreja indica outra e a igreja indicada paga o pacote, a igreja que indicou recebe 10% perpétuo de cashback/desconto na própria fatura.

## Como a indicação é registrada
Somente o Super Administrador vincula a igreja mãe em Instâncias. Uma igreja não indica a si mesma nem fecha ciclo na árvore. Cada igreja indicada tem uma parceria. O cálculo usa o tenant de cada igreja, sem misturar instâncias.

## Quando nasce o desconto
O desconto nasce no pagamento real da fatura da igreja indicada. A base é 10% do valor do pacote assinado por ela. A mesma fatura não gera dois créditos.

## As duas igrejas precisam estar ativas
O benefício é perpétuo, mas só enquanto a igreja que indicou e a igreja indicada estão ativas e com a assinatura em dia. Se uma das duas for desativada ou ficar inadimplente, o percentual de 10% fica suspenso na hora.

## Teto de 100%
A soma do cashback em aberto da igreja que indicou não passa de 100% do valor do pacote assinado por ela. O que exceder esse teto não entra na fatura.

## O que aparece neste demonstrativo
Receitas brutas: o que as igrejas pagaram de assinatura. Cashback a abater: 10% ainda não usado na fatura, só de pares ativos. Descontos na fatura: o que já foi abatido. A receita após descontos desconta esse abatimento.$body$,
       title = 'Aliança Conecta Reino',
       question = 'Como funciona o cashback de indicação de novas igrejas?',
       updated_at = now()
 where tenant_id is null
   and lower(slug) = 'alianca-conecta-reino';

update public.knowledge_articles
   set body = replace(body, 'A Aliança de 40% baixa em Aliança Conecta Reino.', 'A Aliança de 10% de cashback abate na fatura da igreja que indicou.'),
       updated_at = now()
 where body like '%Aliança de 40%%';

update public.knowledge_articles
   set body = replace(body, 'Oferta de 40% da Aliança não é paga pelo Stripe à igreja mãe — a baixa é em Aliança Conecta Reino.', 'Oferta de cashback de 10% da Aliança abate na fatura da igreja que indicou — não há baixa manual.'),
       updated_at = now()
 where body like '%40% da Aliança%';

update public.knowledge_articles
   set body = replace(body, 'Os 40% não baixam aqui — tela Aliança Conecta Reino.', 'O cashback de 10% abate na fatura da igreja que indicou.'),
       updated_at = now()
 where body like '%Os 40% não baixam%';

update public.knowledge_articles
   set body = replace(body, 'Ofertas de apoio ministerial da Aliança aparecem no recorte da igreja mãe; a baixa dos 40% é na tela Aliança Conecta Reino.', 'O cashback de 10% da Aliança aparece no recorte da igreja que indicou e abate na fatura dela.'),
       updated_at = now()
 where body like '%baixa dos 40%%';

update public.knowledge_articles
   set body = replace(body, 'a seção Aliança mostra o recorte das ofertas de apoio — ela não efetiva o pagamento.', 'a seção Aliança mostra o cashback de 10% que abate na fatura desta igreja.'),
       updated_at = now()
 where body like '%ofertas de apoio — ela não efetiva%';

notify pgrst, 'reload schema';

commit;
