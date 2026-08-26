-- =============================================================================
-- Gestão de Campanhas e Projetos — multi-tenant
-- =============================================================================
-- Tabelas: campaign_projects, campaign_milestone_notices, campaign_contribution_intents
-- ACL: dashboard.card.campaign / maintenance.finance.campaigns
-- Conciliação: sufixo de centavos em financials.amount reconhece depósitos da campanha
--   e reclassifica como EXTRAORDINÁRIO / CAMPANHAS (fora da receita ordinária do modelo preditivo).
-- tenant_id sempre da sessão (require_session_tenant_id).
-- Aplica: npx supabase db query --linked -f scripts/campaign-projects-schema.sql
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1) Tabelas
-- ---------------------------------------------------------------------------

create table if not exists public.campaign_projects (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.igrejas (id) on delete cascade,
  titulo text not null,
  descricao text not null default '',
  meta_financeira numeric(14, 2) not null check (meta_financeira > 0),
  valor_arrecadado numeric(14, 2) not null default 0 check (valor_arrecadado >= 0),
  data_inicio date not null default (timezone('America/Sao_Paulo', now()))::date,
  data_fim date null,
  status text not null default 'rascunho'
    check (status in ('rascunho', 'ativo', 'concluido')),
  centavos_referencia numeric(4, 2) not null
    check (centavos_referencia >= 0.01 and centavos_referencia <= 0.99),
  cover_url text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by_profile_id uuid null references public.profiles (id) on delete set null,
  constraint campaign_projects_titulo_check check (length(trim(titulo)) >= 2),
  constraint campaign_projects_range_check check (data_fim is null or data_fim >= data_inicio)
);

create index if not exists campaign_projects_tenant_status_idx
  on public.campaign_projects (tenant_id, status, data_inicio desc);

create unique index if not exists campaign_projects_tenant_cents_active_idx
  on public.campaign_projects (tenant_id, (round(centavos_referencia * 100)::integer))
  where status in ('rascunho', 'ativo');

comment on table public.campaign_projects is
  'Campanhas e projetos por igreja. valor_arrecadado é recalculado pelos depósitos conciliados.';
comment on column public.campaign_projects.centavos_referencia is
  'Sufixo de centavos (ex.: 0.60) usado para reconhecer depósitos PIX da campanha.';

create table if not exists public.campaign_milestone_notices (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.igrejas (id) on delete cascade,
  campaign_id uuid not null references public.campaign_projects (id) on delete cascade,
  milestone_pct integer not null check (milestone_pct in (50, 90, 100)),
  title text not null,
  body text not null,
  created_at timestamptz not null default now(),
  constraint campaign_milestone_notices_unique unique (campaign_id, milestone_pct)
);

create index if not exists campaign_milestone_notices_tenant_idx
  on public.campaign_milestone_notices (tenant_id, created_at desc);

comment on table public.campaign_milestone_notices is
  'Avisos automáticos de marcos (50/90/100%) — sem dados financeiros de outros tenants.';

create table if not exists public.campaign_contribution_intents (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.igrejas (id) on delete cascade,
  campaign_id uuid not null references public.campaign_projects (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint campaign_contribution_intents_unique unique (campaign_id, profile_id)
);

create index if not exists campaign_contribution_intents_campaign_idx
  on public.campaign_contribution_intents (campaign_id);

alter table public.financials
  add column if not exists campaign_project_id uuid null references public.campaign_projects (id) on delete set null;

create index if not exists financials_campaign_project_idx
  on public.financials (campaign_project_id)
  where campaign_project_id is not null;

comment on column public.financials.campaign_project_id is
  'Depósito conciliado a uma campanha pelo sufixo de centavos.';

alter table public.campaign_projects enable row level security;
alter table public.campaign_milestone_notices enable row level security;
alter table public.campaign_contribution_intents enable row level security;

drop policy if exists campaign_projects_tenant_all on public.campaign_projects;
create policy campaign_projects_tenant_all
  on public.campaign_projects
  using (public.session_tenant_matches(tenant_id))
  with check (public.session_tenant_matches(tenant_id));

drop policy if exists campaign_milestone_notices_tenant_all on public.campaign_milestone_notices;
create policy campaign_milestone_notices_tenant_all
  on public.campaign_milestone_notices
  using (public.session_tenant_matches(tenant_id))
  with check (public.session_tenant_matches(tenant_id));

drop policy if exists campaign_contribution_intents_tenant_all on public.campaign_contribution_intents;
create policy campaign_contribution_intents_tenant_all
  on public.campaign_contribution_intents
  using (public.session_tenant_matches(tenant_id))
  with check (public.session_tenant_matches(tenant_id));

-- ---------------------------------------------------------------------------
-- 2) Helpers
-- ---------------------------------------------------------------------------

create or replace function public.session_can_manage_campaigns()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    public.is_super_admin_profile(public.current_session_profile_id())
    or public.profile_has_access(
      public.current_session_profile_id(),
      'screen',
      'maintenance.finance.campaigns',
      'view'
    ),
    false
  );
$$;

create or replace function public.session_can_view_campaigns()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    public.is_super_admin_profile(public.current_session_profile_id())
    or public.profile_has_access(
      public.current_session_profile_id(),
      'screen',
      'dashboard.card.campaign',
      'view'
    )
    or public.session_can_manage_campaigns(),
    false
  );
$$;

create or replace function public.campaign_cents_suffix(p_amount numeric)
returns integer
language sql
immutable
as $$
  select mod(round(abs(coalesce(p_amount, 0)) * 100)::integer, 100);
$$;

create or replace function public.refresh_campaign_project_totals(p_campaign_id uuid)
returns void
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_sum numeric(14, 2);
begin
  select coalesce(sum(abs(f.amount)), 0)
    into v_sum
    from public.financials f
   where f.campaign_project_id = p_campaign_id
     and upper(trim(f.budget_version)) like '%REALIZ%'
     and upper(trim(f.transaction_kind)) like '%ENTRAD%';

  update public.campaign_projects
     set valor_arrecadado = v_sum,
         updated_at = now(),
         status = case
           when status = 'ativo' and meta_financeira > 0 and v_sum >= meta_financeira
             then 'concluido'
           else status
         end
   where id = p_campaign_id;
end;
$$;

create or replace function public.trg_financials_campaign_totals()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    if old.campaign_project_id is not null then
      perform public.refresh_campaign_project_totals(old.campaign_project_id);
    end if;
    return old;
  end if;

  if tg_op = 'UPDATE'
     and old.campaign_project_id is distinct from new.campaign_project_id
     and old.campaign_project_id is not null
  then
    perform public.refresh_campaign_project_totals(old.campaign_project_id);
  end if;

  if new.campaign_project_id is not null then
    perform public.refresh_campaign_project_totals(new.campaign_project_id);
  end if;

  return new;
end;
$$;

drop trigger if exists trg_financials_campaign_totals on public.financials;
create trigger trg_financials_campaign_totals
after insert or update of campaign_project_id, amount, budget_version, transaction_kind
or delete on public.financials
for each row
execute function public.trg_financials_campaign_totals();

create or replace function public.dispatch_campaign_milestones(p_campaign_id uuid)
returns void
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_row public.campaign_projects%rowtype;
  v_pct numeric;
  v_mark integer;
  v_title text;
  v_body text;
begin
  select * into v_row from public.campaign_projects where id = p_campaign_id;

  if v_row.id is null or v_row.meta_financeira <= 0 then
    return;
  end if;

  v_pct := round((v_row.valor_arrecadado / v_row.meta_financeira) * 100, 1);

  foreach v_mark in array array[50, 90, 100]
  loop
    if v_pct < v_mark then
      continue;
    end if;

    if v_mark = 50 then
      v_title := 'Campanha na metade da meta';
      v_body := 'A campanha "' || v_row.titulo || '" já chegou à metade da meta. Continue contribuindo!';
    elsif v_mark = 90 then
      v_title := 'Faltam apenas 10%';
      v_body := 'Faltam apenas 10% para concluirmos "' || v_row.titulo || '"!';
    else
      v_title := 'Meta da campanha atingida';
      v_body := 'A campanha "' || v_row.titulo || '" atingiu a meta. Obrigado pela generosidade!';
    end if;

    insert into public.campaign_milestone_notices (
      tenant_id, campaign_id, milestone_pct, title, body
    ) values (
      v_row.tenant_id, v_row.id, v_mark, v_title, v_body
    )
    on conflict (campaign_id, milestone_pct) do nothing;

    if found then
      begin
        insert into public.event_avisos (
          tenant_id, title, body, sort_order, is_published, audience
        ) values (
          v_row.tenant_id, v_title, v_body, 0, true, 'all'
        );
      exception
        when others then
          null;
      end;
    end if;
  end loop;
end;
$$;

create or replace function public.reconcile_campaign_deposits(p_tenant_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_tenant uuid;
  v_session_tenant uuid := public.current_session_tenant_id();
  v_session_profile uuid := public.current_session_profile_id();
  v_privileged boolean := (session_user in ('postgres', 'supabase_admin'));
  v_linked int := 0;
  v_count int := 0;
  v_campaign record;
  v_loop_tenant uuid;
begin
  if v_privileged then
    v_tenant := coalesce(p_tenant_id, v_session_tenant);
  else
    if v_session_profile is null or v_session_tenant is null then
      raise exception 'Sessão inválida.';
    end if;
    -- PostgREST nunca concilia outra igreja nem todas as igrejas.
    v_tenant := v_session_tenant;
  end if;

  if v_tenant is null then
    if not v_privileged then
      raise exception 'Sessão inválida.';
    end if;

    for v_loop_tenant in
      select distinct tenant_id from public.campaign_projects
    loop
      v_linked := v_linked
        + coalesce((public.reconcile_campaign_deposits(v_loop_tenant) ->> 'linked')::int, 0);
    end loop;

    return jsonb_build_object('success', true, 'linked', v_linked);
  end if;

  for v_campaign in
    select *
      from public.campaign_projects c
     where c.tenant_id = v_tenant
       and c.status in ('ativo', 'concluido')
  loop
    update public.financials f
       set campaign_project_id = v_campaign.id,
           ministry = 'CAMPANHAS',
           movement = 'EXTRAORDINÁRIO',
           comments = case
             when coalesce(f.comments, '') ilike '%' || v_campaign.titulo || '%' then f.comments
             when coalesce(trim(f.comments), '') = '' then 'Campanha: ' || v_campaign.titulo
             else trim(f.comments) || ' | Campanha: ' || v_campaign.titulo
           end
     where f.tenant_id = v_tenant
       and f.campaign_project_id is null
       and upper(trim(f.budget_version)) like '%REALIZ%'
       and upper(trim(f.transaction_kind)) like '%ENTRAD%'
       and f.transaction_date >= v_campaign.data_inicio
       and (v_campaign.data_fim is null or f.transaction_date <= v_campaign.data_fim)
       and public.campaign_cents_suffix(f.amount) = round(v_campaign.centavos_referencia * 100)::integer;

    get diagnostics v_count = row_count;
    v_linked := v_linked + v_count;

    perform public.refresh_campaign_project_totals(v_campaign.id);
    perform public.dispatch_campaign_milestones(v_campaign.id);
  end loop;

  return jsonb_build_object('success', true, 'linked', v_linked);
end;
$$;

revoke all on function public.reconcile_campaign_deposits(uuid) from public;
revoke all on function public.reconcile_campaign_deposits(uuid) from anon;
grant execute on function public.reconcile_campaign_deposits(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 3) Membro
-- ---------------------------------------------------------------------------

create or replace function public.campaign_project_json(p_row public.campaign_projects)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_donations int;
  v_intents int;
  v_days numeric;
  v_pct numeric;
begin
  select count(*)::int
    into v_donations
    from public.financials f
   where f.campaign_project_id = p_row.id
     and upper(trim(f.budget_version)) like '%REALIZ%'
     and upper(trim(f.transaction_kind)) like '%ENTRAD%';

  select count(*)::int
    into v_intents
    from public.campaign_contribution_intents i
   where i.campaign_id = p_row.id;

  v_days := greatest(
    1,
    (coalesce(p_row.data_fim, (timezone('America/Sao_Paulo', now()))::date)
      - p_row.data_inicio) + 1
  );
  v_pct := case
    when p_row.meta_financeira > 0
      then round((p_row.valor_arrecadado / p_row.meta_financeira) * 100, 1)
    else 0
  end;

  return jsonb_build_object(
    'id', p_row.id,
    'titulo', p_row.titulo,
    'descricao', p_row.descricao,
    'meta_financeira', p_row.meta_financeira,
    'valor_arrecadado', p_row.valor_arrecadado,
    'data_inicio', p_row.data_inicio,
    'data_fim', p_row.data_fim,
    'status', p_row.status,
    'centavos_referencia', p_row.centavos_referencia,
    'cover_url', p_row.cover_url,
    'progress_pct', v_pct,
    'donations_count', v_donations,
    'unique_donors', greatest(v_donations, v_intents),
    'velocity_per_day', round(p_row.valor_arrecadado / v_days, 2)
  );
end;
$$;

create or replace function public.list_active_campaign_projects()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
  v_actor uuid := public.current_session_profile_id();
begin
  if v_actor is null or not public.session_can_view_campaigns() then
    return jsonb_build_object('success', false, 'message', 'Sem permissão.', 'campaigns', '[]'::jsonb);
  end if;

  perform public.reconcile_campaign_deposits(v_tenant);

  return jsonb_build_object(
    'success', true,
    'campaigns',
    coalesce(
      (
        select jsonb_agg(public.campaign_project_json(c) order by c.data_inicio desc, c.titulo)
          from public.campaign_projects c
         where c.tenant_id = v_tenant
           and c.status = 'ativo'
      ),
      '[]'::jsonb
    )
  );
end;
$$;

grant execute on function public.list_active_campaign_projects() to anon, authenticated;

create or replace function public.get_campaign_project(p_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
  v_actor uuid := public.current_session_profile_id();
  v_row public.campaign_projects%rowtype;
begin
  if v_actor is null or not public.session_can_view_campaigns() then
    return jsonb_build_object('success', false, 'message', 'Sem permissão.');
  end if;

  select * into v_row
    from public.campaign_projects c
   where c.id = p_id
     and c.tenant_id = v_tenant;

  if v_row.id is null then
    return jsonb_build_object('success', false, 'message', 'Campanha não encontrada.');
  end if;

  if v_row.status = 'rascunho' and not public.session_can_manage_campaigns() then
    return jsonb_build_object('success', false, 'message', 'Campanha não encontrada.');
  end if;

  return jsonb_build_object('success', true, 'campaign', public.campaign_project_json(v_row));
end;
$$;

grant execute on function public.get_campaign_project(uuid) to anon, authenticated;

create or replace function public.register_campaign_contribution_intent(p_campaign_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
  v_actor uuid := public.current_session_profile_id();
begin
  if v_actor is null or not public.session_can_view_campaigns() then
    return jsonb_build_object('success', false, 'message', 'Sem permissão.');
  end if;

  insert into public.campaign_contribution_intents (tenant_id, campaign_id, profile_id)
  select v_tenant, c.id, v_actor
    from public.campaign_projects c
   where c.id = p_campaign_id
     and c.tenant_id = v_tenant
     and c.status = 'ativo'
  on conflict (campaign_id, profile_id) do nothing;

  return jsonb_build_object('success', true);
end;
$$;

grant execute on function public.register_campaign_contribution_intent(uuid)
  to anon, authenticated;

create or replace function public.list_campaign_financial_summary()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
  v_actor uuid := public.current_session_profile_id();
  v_campaigns numeric(14, 2) := 0;
  v_ordinary numeric(14, 2) := 0;
begin
  if v_actor is null then
    return jsonb_build_object('success', false, 'message', 'Sessão inválida.');
  end if;

  perform public.reconcile_campaign_deposits(v_tenant);

  select coalesce(sum(abs(f.amount)), 0)
    into v_campaigns
    from public.financials f
   where f.tenant_id = v_tenant
     and upper(trim(f.budget_version)) like '%REALIZ%'
     and upper(trim(f.transaction_kind)) like '%ENTRAD%'
     and (
       f.campaign_project_id is not null
       or upper(trim(f.ministry)) in ('CAMPANHAS', 'PROJETOS')
     );

  select coalesce(sum(abs(f.amount)), 0)
    into v_ordinary
    from public.financials f
   where f.tenant_id = v_tenant
     and upper(trim(f.budget_version)) like '%REALIZ%'
     and upper(trim(f.transaction_kind)) like '%ENTRAD%'
     and upper(trim(f.movement)) like '%ORDIN%'
     and f.campaign_project_id is null
     and upper(trim(f.ministry)) not in ('CAMPANHAS', 'PROJETOS')
     and (
       upper(trim(f.ministry)) = 'OFERTAS'
       or upper(trim(f.ministry)) like '%DIZIM%'
     );

  return jsonb_build_object(
    'success', true,
    'ordinary_revenue', v_ordinary,
    'campaign_revenue', v_campaigns
  );
end;
$$;

grant execute on function public.list_campaign_financial_summary() to anon, authenticated;

create or replace function public.list_my_campaign_notices()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.current_session_tenant_id();
  v_actor uuid := public.current_session_profile_id();
begin
  if v_actor is null or v_tenant is null then
    return jsonb_build_object('success', true, 'notices', '[]'::jsonb);
  end if;

  return jsonb_build_object(
    'success', true,
    'notices',
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', n.id,
            'title', n.title,
            'body', n.body,
            'created_at', n.created_at
          )
          order by n.created_at desc
        )
        from public.campaign_milestone_notices n
       where n.tenant_id = v_tenant
         and n.created_at >= now() - interval '14 days'
      ),
      '[]'::jsonb
    )
  );
end;
$$;

grant execute on function public.list_my_campaign_notices() to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4) Manutenção
-- ---------------------------------------------------------------------------

create or replace function public.list_campaign_projects_admin()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
  v_actor uuid := public.current_session_profile_id();
begin
  if v_actor is null or not public.session_can_manage_campaigns() then
    return jsonb_build_object('success', false, 'message', 'Sem permissão.', 'campaigns', '[]'::jsonb);
  end if;

  perform public.reconcile_campaign_deposits(v_tenant);

  return jsonb_build_object(
    'success', true,
    'campaigns',
    coalesce(
      (
        select jsonb_agg(public.campaign_project_json(c) order by c.status, c.data_inicio desc, c.titulo)
          from public.campaign_projects c
         where c.tenant_id = v_tenant
      ),
      '[]'::jsonb
    )
  );
end;
$$;

grant execute on function public.list_campaign_projects_admin() to anon, authenticated;

create or replace function public.upsert_campaign_project(
  p_id uuid default null,
  p_titulo text default null,
  p_descricao text default '',
  p_meta_financeira numeric default null,
  p_data_inicio date default null,
  p_data_fim date default null,
  p_status text default 'rascunho',
  p_centavos_referencia numeric default null,
  p_cover_url text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
  v_actor uuid := public.current_session_profile_id();
  v_status text := lower(trim(coalesce(p_status, 'rascunho')));
  v_cents numeric(4, 2);
  v_id uuid;
  v_row public.campaign_projects%rowtype;
begin
  if v_actor is null or not public.session_can_manage_campaigns() then
    return jsonb_build_object('success', false, 'message', 'Sem permissão para gerir campanhas.');
  end if;

  if not (
    public.is_super_admin_profile(v_actor)
    or public.profile_has_access(
      v_actor,
      'screen',
      'maintenance.finance.campaigns',
      'update'
    )
  ) then
    return jsonb_build_object('success', false, 'message', 'Sem permissão para alterar campanhas.');
  end if;

  if v_status not in ('rascunho', 'ativo', 'concluido') then
    v_status := 'rascunho';
  end if;

  v_cents := round(coalesce(p_centavos_referencia, 0.01), 2);

  if v_cents < 0.01 or v_cents > 0.99 then
    return jsonb_build_object('success', false, 'message', 'Informe os centavos de referência entre 0,01 e 0,99.');
  end if;

  if p_id is null then
    if coalesce(trim(p_titulo), '') = '' or p_meta_financeira is null or p_meta_financeira <= 0 then
      return jsonb_build_object('success', false, 'message', 'Informe título e meta financeira.');
    end if;

    insert into public.campaign_projects (
      tenant_id, titulo, descricao, meta_financeira, data_inicio, data_fim,
      status, centavos_referencia, cover_url, created_by_profile_id
    ) values (
      v_tenant,
      trim(p_titulo),
      coalesce(trim(p_descricao), ''),
      p_meta_financeira,
      coalesce(p_data_inicio, (timezone('America/Sao_Paulo', now()))::date),
      p_data_fim,
      v_status,
      v_cents,
      nullif(trim(coalesce(p_cover_url, '')), ''),
      v_actor
    )
    returning * into v_row;
  else
    update public.campaign_projects c
       set titulo = coalesce(nullif(trim(coalesce(p_titulo, '')), ''), c.titulo),
           descricao = coalesce(p_descricao, c.descricao),
           meta_financeira = coalesce(p_meta_financeira, c.meta_financeira),
           data_inicio = coalesce(p_data_inicio, c.data_inicio),
           data_fim = p_data_fim,
           status = v_status,
           centavos_referencia = v_cents,
           cover_url = case
             when p_cover_url is null then c.cover_url
             when trim(p_cover_url) = '' then null
             else trim(p_cover_url)
           end,
           updated_at = now()
     where c.id = p_id
       and c.tenant_id = v_tenant
    returning * into v_row;

    if v_row.id is null then
      return jsonb_build_object('success', false, 'message', 'Campanha não encontrada.');
    end if;
  end if;

  v_id := v_row.id;
  perform public.reconcile_campaign_deposits(v_tenant);
  select * into v_row from public.campaign_projects where id = v_id;

  return jsonb_build_object('success', true, 'id', v_id, 'campaign', public.campaign_project_json(v_row));
exception
  when unique_violation then
    return jsonb_build_object(
      'success', false,
      'message', 'Já existe uma campanha ativa/rascunho com estes centavos de referência.'
    );
end;
$$;

grant execute on function public.upsert_campaign_project(
  uuid, text, text, numeric, date, date, text, numeric, text
) to anon, authenticated;

-- pg_cron opcional (conciliação a cada minuto; o app também dispara a cada ~15s)
do $$
begin
  perform cron.schedule(
    'campaign-deposit-reconcile',
    '* * * * *',
    $cron$select public.reconcile_campaign_deposits(null);$cron$
  );
exception
  when undefined_function then
    null;
  when undefined_object then
    null;
  when others then
    null;
end
$$;

-- ---------------------------------------------------------------------------
-- 5) ACL
-- ---------------------------------------------------------------------------

insert into public.access_resources (resource_type, resource_key, label, description, is_active)
values
  (
    'screen',
    'dashboard.card.campaign',
    'Card — Campanhas e Projetos',
    'Acompanha metas, progresso e contribuição identificada pelos centavos.',
    true
  ),
  (
    'screen',
    'maintenance.finance.campaigns',
    'Gestão de Campanhas',
    'Cadastro de projetos, centavos simbólicos, capa e desempenho da arrecadação.',
    true
  ),
  (
    'table',
    'campaign_projects',
    'Campanhas e projetos',
    null,
    true
  )
on conflict (resource_type, resource_key) do update
  set label = excluded.label,
      description = excluded.description,
      is_active = true;

insert into public.access_grants (role_id, resource_id, can_view, can_update)
select r.id, res.id, true, r.code = 'super_admin'
  from public.access_roles r
  join public.access_resources res
    on res.resource_type = 'screen'
   and res.resource_key = 'dashboard.card.campaign'
 where r.code in (
   'super_admin', 'pastoral', 'lider_geral', 'lider', 'member', 'congregado', 'tesoureiro', 'events_admin'
 )
on conflict (role_id, resource_id) where (role_id is not null) do update
  set can_view = excluded.can_view,
      can_update = excluded.can_update,
      updated_at = now();

insert into public.access_grants (role_id, resource_id, can_view, can_update)
select r.id, res.id, true,
       r.code in ('super_admin', 'pastoral', 'tesoureiro', 'lider_geral')
  from public.access_roles r
  join public.access_resources res
    on res.resource_type = 'screen'
   and res.resource_key = 'maintenance.finance.campaigns'
 where r.code in (
   'super_admin', 'pastoral', 'tesoureiro', 'lider_geral', 'gestor_controle_acesso'
 )
on conflict (role_id, resource_id) where (role_id is not null) do update
  set can_view = excluded.can_view,
      can_update = excluded.can_update,
      updated_at = now();

notify pgrst, 'reload schema';
