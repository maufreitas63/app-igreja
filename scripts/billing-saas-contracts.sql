-- Contratos SaaS Conecta+: um registro por contratação/renovação trimestral.
-- Gerado na persistência Stripe (checkout, webhook, sync). Histórico sequencial por igreja.
-- Execute: npx supabase db query --linked -f scripts/billing-saas-contracts.sql

begin;

create table if not exists public.billing_saas_contracts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.igrejas (id) on delete cascade,
  sequence_number integer not null,
  event_type text not null,
  plan_code text not null,
  plan_name text not null,
  plan_type text not null,
  period_start timestamptz not null,
  period_end timestamptz null,
  accepted_at timestamptz not null default now(),
  licensed_name text not null,
  licensed_document text null,
  licensed_instance_code text null,
  stripe_subscription_id text null,
  stripe_checkout_session_id text null,
  body text not null,
  created_at timestamptz not null default now(),
  constraint billing_saas_contracts_event_chk check (event_type in ('contratacao', 'renovacao')),
  constraint billing_saas_contracts_seq_chk check (sequence_number >= 1),
  constraint billing_saas_contracts_body_chk check (length(btrim(body)) >= 80)
);

create unique index if not exists billing_saas_contracts_tenant_seq_uidx
  on public.billing_saas_contracts (tenant_id, sequence_number);

create unique index if not exists billing_saas_contracts_tenant_period_uidx
  on public.billing_saas_contracts (tenant_id, period_start);

create index if not exists billing_saas_contracts_tenant_created_idx
  on public.billing_saas_contracts (tenant_id, sequence_number desc);

alter table public.billing_saas_contracts enable row level security;

revoke all on table public.billing_saas_contracts from public, anon, authenticated;

create or replace function public.billing_saas_contract_format_date(p_at timestamptz)
returns text
language sql
immutable
as $$
  select case
    when p_at is null then '—'
    else to_char(p_at at time zone 'America/Sao_Paulo', 'DD/MM/YYYY')
  end;
$$;

-- Número do contrato: código da instância + sequência local daquela igreja (IBN-001, IBEP-001…).
create or replace function public.billing_saas_contract_number(p_code text, p_sequence integer)
returns text
language sql
immutable
as $$
  select case
    when nullif(upper(btrim(coalesce(p_code, ''))), '') is not null
      then upper(btrim(p_code)) || '-' || lpad(greatest(coalesce(p_sequence, 0), 0)::text, 3, '0')
    else lpad(greatest(coalesce(p_sequence, 0), 0)::text, 3, '0')
  end;
$$;

create or replace function public.billing_saas_license_contract_text(
  p_sequence integer,
  p_event_type text,
  p_plan_name text,
  p_plan_type text,
  p_licensed_name text,
  p_licensed_document text,
  p_licensed_code text,
  p_accepted_at timestamptz,
  p_period_start timestamptz,
  p_period_end timestamptz
)
returns text
language plpgsql
immutable
as $$
declare
  v_event text := case
    when lower(coalesce(p_event_type, '')) = 'renovacao' then 'Renovação'
    else 'Contratação'
  end;
  v_licenciado text;
  v_doc text := nullif(btrim(coalesce(p_licensed_document, '')), '');
  v_code text := nullif(btrim(coalesce(p_licensed_code, '')), '');
  v_name text := coalesce(nullif(btrim(p_licensed_name), ''), 'LICENCIADO identificado na aceitação eletrônica');
begin
  v_licenciado := v_name;
  if v_doc is not null then
    v_licenciado := v_licenciado || ', inscrita no CNPJ sob o nº ' || v_doc;
  end if;
  if v_code is not null then
    v_licenciado := v_licenciado || ', instância ' || v_code || ' da plataforma Conecta+';
  end if;

  return
    'CONTRATO DE LICENCIAMENTO DE USO DE SOFTWARE E PRESTAÇÃO DE SERVIÇOS (SaaS) — CONECTA+'
    || E'\n\n'
    || 'Contrato nº ' || public.billing_saas_contract_number(v_code, p_sequence)
    || '  ·  Natureza: ' || v_event
    || E'\n'
    || 'Data da aceitação eletrônica: ' || public.billing_saas_contract_format_date(p_accepted_at)
    || E'\n'
    || 'Vigência do ciclo: '
    || public.billing_saas_contract_format_date(p_period_start)
    || ' a '
    || public.billing_saas_contract_format_date(p_period_end)
    || E'\n\n'
    || 'Por este instrumento privado, de um lado:'
    || E'\n\n'
    || 'ODEH PEOPLEWARE SISTEMAS E PROJETOS LTDA, pessoa jurídica de direito privado, inscrita no CNPJ sob o nº 01.030.447/0001-76, com sede na Rua Luiz Razera, nº 223, Sala 01, Bairro Nova América, CEP 13.417-530, Piracicaba/SP, doravante denominada simplesmente LICENCIANTE;'
    || E'\n\n'
    || 'E, de outro lado, ' || v_licenciado
    || ', devidamente qualificada no momento da aceitação eletrônica na plataforma, doravante denominada simplesmente LICENCIADO;'
    || E'\n\n'
    || 'Têm entre si, de forma justa e contratada, o presente instrumento, que se regerá pelas cláusulas e condições seguintes:'
    || E'\n\n'
    || 'CLÁUSULA PRIMEIRA – DO OBJETO'
    || E'\n'
    || '1.1. O presente contrato tem por objeto o licenciamento temporário, não exclusivo e intransferível de uso do software em formato SaaS (Software as a Service) denominado Conecta+ (doravante simplesmente "Software"), disponibilizado por meio de computação em nuvem, acessível via web e/ou aplicativos oficiais.'
    || E'\n'
    || '1.2. A licença de uso ora contratada abrange exclusivamente o acesso às funcionalidades disponibilizadas no plano contratado pelo LICENCIADO no momento da aceitação eletrônica.'
    || E'\n\n'
    || 'CLÁUSULA SEGUNDA – DOS PLANOS, PRAZO E VIGÊNCIA'
    || E'\n'
    || '2.1. O presente contrato é celebrado sob a modalidade de assinatura trimestral, referente ao plano '
    || coalesce(nullif(btrim(p_plan_name), ''), 'contratado')
    || ' (do tipo '
    || coalesce(nullif(btrim(p_plan_type), ''), 'plano SaaS Conecta+')
    || '), o qual é automaticamente identificado e preenchido pela plataforma no momento da contratação.'
    || E'\n'
    || '2.2. A vigência inicial deste contrato é de 3 (três) meses, contados a partir da confirmação do pagamento e liberação de acesso ao Software pela LICENCIANTE.'
    || E'\n'
    || '2.3. Ao término de cada período trimestral, o contrato será renovado automaticamente por igual período, mediante a cobrança da taxa de assinatura vigente à época para o respectivo plano, exceto se qualquer das partes manifestar expressamente o desinteresse na renovação com antecedência mínima de 5 (cinco) dias úteis antes do vencimento do trimestre em curso.'
    || E'\n\n'
    || 'CLÁUSULA TERCEIRA – DO VALOR E DAS CONDIÇÕES DE PAGAMENTO'
    || E'\n'
    || '3.1. Pelo licenciamento e acesso ao Conecta+, o LICENCIADO pagará à LICENCIANTE o valor correspondente ao plano trimestral escolhido, nas formas de pagamento disponibilizadas na plataforma (cartão de crédito, boleto bancário ou Pix).'
    || E'\n'
    || '3.2. O pagamento da assinatura é pré-pago, devendo ser quitado a cada ciclo trimestral para garantir a continuidade do acesso ao sistema sem interrupções.'
    || E'\n'
    || '3.3. Em caso de atraso no pagamento de qualquer parcela ou renovação, o acesso ao Software será bloqueado automaticamente após o transcurso de 5 (cinco) dias corridos da data de vencimento, sem prejuízo da incidência de multa moratória de 2% (dois por cento) e juros de 1% (um por cento) ao mês sobre o valor em aberto.'
    || E'\n\n'
    || 'CLÁUSULA QUARTA – DAS OBRIGAÇÕES DA LICENCIANTE'
    || E'\n'
    || '4.1. Constituem obrigações da LICENCIANTE:'
    || E'\n'
    || '• Disponibilizar o acesso ao Conecta+ em ambiente de nuvem durante a vigência deste contrato, envidando esforços para manter a disponibilidade (uptime) em níveis razoáveis de mercado;'
    || E'\n'
    || '• Prestar suporte técnico ao LICENCIADO por meio dos canais oficiais de atendimento informados na plataforma, em horário comercial;'
    || E'\n'
    || '• Proteger e zelar pela confidencialidade e segurança dos dados inseridos pelo LICENCIADO, em estrita conformidade com a Lei Geral de Proteção de Dados (LGPD - Lei nº 13.709/2018).'
    || E'\n\n'
    || 'CLÁUSULA QUINTA – DAS OBRIGAÇÕES DO LICENCIADO'
    || E'\n'
    || '5.1. Constituem obrigações do LICENCIADO:'
    || E'\n'
    || '• Efetuar o pagamento pontual dos valores devidos pela assinatura trimestral;'
    || E'\n'
    || '• Utilizar o Software de maneira ética, lícita e estritamente para os fins a que se destina, abstendo-se de praticar engenharia reversa, descompilação ou qualquer tentativa de copiar o código-fonte da aplicação;'
    || E'\n'
    || '• Manter seus dados cadastrais e de meio de pagamento sempre atualizados;'
    || E'\n'
    || '• Responsabilizar-se integralmente pela segurança de suas senhas e credenciais de acesso, bem como pelo conteúdo das informações e dados inseridos por sua equipe no sistema.'
    || E'\n\n'
    || 'CLÁUSULA SEXTA – DA PROPRIEDADE INTELECTUAL'
    || E'\n'
    || '6.1. Todos os direitos de propriedade intelectual, industrial, marcas, logotipos, códigos-fonte, algoritmos, designs e bases de dados relativos ao Conecta+ pertencem exclusiva e integralmente à LICENCIANTE.'
    || E'\n'
    || '6.2. O presente contrato concede ao LICENCIADO apenas uma licença de uso, temporária e revogável, não importando em cessão de direitos autorais ou transferência de propriedade sobre o Software ou qualquer de suas partes.'
    || E'\n\n'
    || 'CLÁUSULA SÉTIMA – DA LIMITAÇÃO DE RESPONSABILIDADE'
    || E'\n'
    || '7.1. A LICENCIANTE não se responsabiliza por eventuais interrupções no acesso ao Software causadas por falhas na internet do LICENCIADO, quedas de energia, manutenções emergenciais de infraestrutura de servidores em nuvem de terceiros (como AWS, Google Cloud ou similares), ou casos fortuitos e força maior.'
    || E'\n'
    || '7.2. O Software é fornecido "no estado em que se encontra", não se responsabilizando a LICENCIANTE por expectativas de resultados comerciais específicos que o LICENCIADO esperasse alcançar com o uso da ferramenta.'
    || E'\n\n'
    || 'CLÁUSULA OITAVA – DA RESCISÃO'
    || E'\n'
    || '8.1. O presente contrato poderá ser rescindido a qualquer momento por qualquer das partes, sem incidência de multa rescisória, desde que manifestado o interesse por escrito com antecedência mínima de 5 (cinco) dias antes do fechamento do próximo ciclo trimestral.'
    || E'\n'
    || '8.2. Não haverá reembolso proporcional de valores já pagos caso o LICENCIADO decida interromper o uso antes do término do trimestre já quitado.'
    || E'\n'
    || '8.3. O descumprimento de qualquer cláusula deste instrumento por qualquer das partes poderá ensejar a rescisão imediata do contrato, sem prejuízo das indenizações cabíveis.'
    || E'\n\n'
    || 'CLÁUSULA NONA – DO FORO'
    || E'\n'
    || '9.1. Fica eleito o Foro da Comarca de Piracicaba, Estado de São Paulo, para dirimir quaisquer dúvidas ou litígios oriundos deste contrato, com renúncia expressa a qualquer outro, por mais privilegiado que seja.';
end;
$$;

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

create or replace function public.list_billing_saas_contracts(p_tenant_id uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_tenant uuid;
  v_me uuid := public.current_session_profile_id();
  v_items jsonb;
begin
  v_tenant := coalesce(p_tenant_id, public.current_session_tenant_id());

  if v_tenant is null then
    return jsonb_build_object('success', false, 'message', 'Tenant não identificado.', 'contracts', '[]'::jsonb);
  end if;

  if v_me is not null
     and p_tenant_id is not null
     and p_tenant_id is distinct from public.current_session_tenant_id()
     and not public.is_super_admin_profile(v_me) then
    return jsonb_build_object('success', false, 'message', 'Tenant não autorizado para esta sessão.', 'contracts', '[]'::jsonb);
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', c.id,
        'sequence_number', c.sequence_number,
        'event_type', c.event_type,
        'plan_code', c.plan_code,
        'plan_name', c.plan_name,
        'plan_type', c.plan_type,
        'period_start', c.period_start,
        'period_end', c.period_end,
        'accepted_at', c.accepted_at,
        'licensed_name', c.licensed_name,
        'licensed_instance_code', c.licensed_instance_code,
        'contract_number', public.billing_saas_contract_number(c.licensed_instance_code, c.sequence_number),
        'body', c.body
      )
      order by c.sequence_number desc
    ),
    '[]'::jsonb
  )
    into v_items
    from public.billing_saas_contracts c
   where c.tenant_id = v_tenant;

  return jsonb_build_object('success', true, 'tenant_id', v_tenant, 'contracts', coalesce(v_items, '[]'::jsonb));
end;
$$;

-- Gera o contrato só quando o caller confirma pagamento (p_emit_contract).
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

-- Contratos das assinaturas já ativas (histórico inicial).
do $$
declare
  r record;
begin
  for r in
    select ts.tenant_id,
           ts.plan_id,
           ts.status,
           ts.current_period_start,
           ts.current_period_end,
           ts.stripe_subscription_id,
           ts.stripe_checkout_session_id
      from public.tenant_subscriptions ts
     where public.tenant_subscription_is_access_allowed(ts.status)
       and ts.current_period_start is not null
  loop
    perform public.ensure_billing_saas_contract(
      r.tenant_id,
      r.plan_id,
      r.status,
      r.current_period_start,
      r.current_period_end,
      r.stripe_subscription_id,
      r.stripe_checkout_session_id
    );
  end loop;
end;
$$;

-- Regrava o número no corpo já existente (código da instância + sequência da igreja).
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

revoke all on function public.billing_saas_contract_format_date(timestamptz) from public, anon, authenticated;
revoke all on function public.billing_saas_contract_number(text, integer) from public, anon, authenticated;
revoke all on function public.billing_saas_license_contract_text(integer, text, text, text, text, text, text, timestamptz, timestamptz, timestamptz) from public, anon, authenticated;
revoke all on function public.ensure_billing_saas_contract(uuid, uuid, text, timestamptz, timestamptz, text, text) from public, anon, authenticated;
revoke all on function public.list_billing_saas_contracts(uuid) from public, anon, authenticated;

grant execute on function public.list_billing_saas_contracts(uuid) to anon, authenticated, service_role;
grant execute on function public.ensure_billing_saas_contract(uuid, uuid, text, timestamptz, timestamptz, text, text) to service_role;
grant execute on function public.upsert_tenant_subscription_from_stripe(uuid, text, text, text, text, text, timestamptz, timestamptz, boolean, jsonb, boolean) to service_role;

commit;

notify pgrst, 'reload schema';
