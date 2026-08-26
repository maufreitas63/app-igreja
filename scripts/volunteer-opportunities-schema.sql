-- Mural de Oportunidades e Voluntariado (tenant = igrejas).
-- Match: ministerial_resultados (Lição 5.1), nunca expõe o perfil no mural do membro.

alter table public.event_avisos
  add column if not exists opportunity_id uuid;

do $$
begin
  if not exists (
    select 1
      from pg_constraint
     where conname = 'event_avisos_opportunity_id_fkey'
  ) then
    alter table public.event_avisos
      add constraint event_avisos_opportunity_id_fkey
      foreign key (opportunity_id) references public.volunteer_opportunities(id) on delete set null;
  end if;
exception
  when undefined_table then
    null;
end
$$;

create table if not exists public.volunteer_opportunities (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.igrejas(id) on delete cascade,
  titulo text not null,
  descricao text not null default '',
  tipo_escala_id uuid references public.tipos_escala(id) on delete set null,
  leader_profile_id uuid references public.profiles(id) on delete set null,
  required_gifts text[] not null default '{}'::text[],
  status text not null default 'rascunho'
    check (status in ('rascunho', 'aberta', 'encerrada', 'preenchida')),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint volunteer_opportunities_titulo_check check (length(trim(titulo)) >= 2)
);

do $$
begin
  if not exists (
    select 1
      from pg_constraint
     where conname = 'event_avisos_opportunity_id_fkey'
  ) then
    alter table public.event_avisos
      add constraint event_avisos_opportunity_id_fkey
      foreign key (opportunity_id) references public.volunteer_opportunities(id) on delete set null;
  end if;
end
$$;

create index if not exists idx_volunteer_opportunities_tenant_status
  on public.volunteer_opportunities (tenant_id, status, created_at desc);

create table if not exists public.volunteer_opportunity_interests (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.igrejas(id) on delete cascade,
  opportunity_id uuid not null references public.volunteer_opportunities(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pendente'
    check (status in ('pendente', 'aceito', 'recusado')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references public.profiles(id) on delete set null,
  unique (opportunity_id, profile_id)
);

create index if not exists idx_volunteer_opportunity_interests_opp
  on public.volunteer_opportunity_interests (opportunity_id, status);

create table if not exists public.volunteer_opportunity_notices (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.igrejas(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  opportunity_id uuid references public.volunteer_opportunities(id) on delete cascade,
  title text not null,
  body text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_volunteer_opportunity_notices_unread
  on public.volunteer_opportunity_notices (tenant_id, profile_id, created_at desc)
  where read_at is null;

alter table public.volunteer_opportunities enable row level security;
alter table public.volunteer_opportunity_interests enable row level security;
alter table public.volunteer_opportunity_notices enable row level security;

drop policy if exists volunteer_opportunities_deny_direct on public.volunteer_opportunities;
create policy volunteer_opportunities_deny_direct
  on public.volunteer_opportunities for all using (false) with check (false);

drop policy if exists volunteer_opportunity_interests_deny_direct on public.volunteer_opportunity_interests;
create policy volunteer_opportunity_interests_deny_direct
  on public.volunteer_opportunity_interests for all using (false) with check (false);

drop policy if exists volunteer_opportunity_notices_deny_direct on public.volunteer_opportunity_notices;
create policy volunteer_opportunity_notices_deny_direct
  on public.volunteer_opportunity_notices for all using (false) with check (false);

alter table public.event_avisos drop constraint if exists event_avisos_audience_check;
alter table public.event_avisos
  add constraint event_avisos_audience_check
  check (audience in ('all', 'small_group_leaders', 'opportunity_match'));

-- ---------------------------------------------------------------------------
create or replace function public.volunteer_gifts_normalized(p_gifts text[])
returns text[]
language sql
immutable
as $$
  select coalesce(
    array(
      select distinct upper(trim(g))
        from unnest(coalesce(p_gifts, '{}'::text[])) as g
       where upper(trim(g)) in (
         'PREGACAO', 'LOUVOR', 'PASTORAL', 'EVANGELISMO', 'DISCIPULADO', 'LIDERANCA'
       )
    ),
    '{}'::text[]
  );
$$;

create or replace function public.volunteer_gift_match_pct(
  p_winner text,
  p_scores jsonb,
  p_required text[]
)
returns integer
language plpgsql
immutable
as $$
declare
  v_required text[] := public.volunteer_gifts_normalized(p_required);
  v_winner text := upper(trim(coalesce(p_winner, '')));
  v_key text;
  v_total numeric := 0;
  v_overlap numeric := 0;
  v_val numeric;
  v_pct integer;
begin
  if v_required is null or array_length(v_required, 1) is null then
    return 0;
  end if;

  if p_scores is null or jsonb_typeof(p_scores) is distinct from 'object' then
    if v_winner = any(v_required) then
      return 90;
    end if;
    return 0;
  end if;

  for v_key in select jsonb_object_keys(p_scores)
  loop
    v_val := coalesce(nullif(p_scores ->> v_key, '')::numeric, 0);
    v_total := v_total + v_val;
    if upper(v_key) = any(v_required) then
      v_overlap := v_overlap + v_val;
    end if;
  end loop;

  if v_total <= 0 then
    if v_winner = any(v_required) then
      return 90;
    end if;
    return 0;
  end if;

  v_pct := round(100.0 * v_overlap / v_total)::integer;

  if v_winner = any(v_required) then
    return greatest(v_pct, 80);
  end if;

  return v_pct;
end;
$$;

create or replace function public.session_can_manage_volunteer_mural()
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_me uuid := public.current_session_profile_id();
begin
  if v_me is null then
    return false;
  end if;
  if public.is_super_admin_profile(v_me) then
    return true;
  end if;
  return public.profile_has_access(v_me, 'screen', 'maintenance.volunteer.mural', 'view')
      or public.profile_has_access(v_me, 'screen', 'maintenance.volunteer.mural', 'update');
end;
$$;

create or replace function public.session_can_view_volunteer_mural()
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_me uuid := public.current_session_profile_id();
begin
  if v_me is null then
    return false;
  end if;
  if public.is_super_admin_profile(v_me) then
    return true;
  end if;
  return public.profile_has_access(v_me, 'screen', 'dashboard.card.opportunities', 'view')
      or public.session_can_manage_volunteer_mural();
end;
$$;

create or replace function public.volunteer_opportunity_notify_matches(p_opportunity_id uuid)
returns void
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_opp public.volunteer_opportunities%rowtype;
  v_type_name text;
  v_privileged boolean := (session_user in ('postgres', 'supabase_admin'));
begin
  select * into v_opp
    from public.volunteer_opportunities
   where id = p_opportunity_id;

  if not found or v_opp.status is distinct from 'aberta' then
    return;
  end if;

  if not v_privileged then
    if public.current_session_profile_id() is null
       or not public.session_can_manage_volunteer_mural()
       or v_opp.tenant_id is distinct from public.current_session_tenant_id()
    then
      raise exception 'Sem permissão.';
    end if;
  end if;

  select te.nome into v_type_name
    from public.tipos_escala te
   where te.id = v_opp.tipo_escala_id;

  insert into public.volunteer_opportunity_notices (tenant_id, profile_id, opportunity_id, title, body)
  select
    v_opp.tenant_id,
    r.profile_id,
    v_opp.id,
    'Nova oportunidade aberta',
    'Há uma vaga em '
      || coalesce(v_type_name, 'um ministério')
      || ' alinhada ao seu perfil ministerial: '
      || v_opp.titulo || '.'
    from public.ministerial_resultados r
   where r.tenant_id = v_opp.tenant_id
     and r.perfil_vencedor = any(public.volunteer_gifts_normalized(v_opp.required_gifts))
     and not exists (
       select 1
         from public.volunteer_opportunity_notices n
        where n.opportunity_id = v_opp.id
          and n.profile_id = r.profile_id
     );
end;
$$;

create or replace function public.list_volunteer_opportunities_for_me()
returns table (
  id uuid,
  titulo text,
  descricao text,
  tipo_escala_id uuid,
  ministerio_nome text,
  leader_name text,
  leader_phone text,
  required_gifts text[],
  status text,
  match_pct integer,
  is_primary_match boolean,
  my_interest text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
  v_me uuid := public.current_session_profile_id();
  v_winner text;
  v_scores jsonb;
begin
  if v_me is null or not public.session_can_view_volunteer_mural() then
    return;
  end if;

  select r.perfil_vencedor, r.pontuacao_detalhada
    into v_winner, v_scores
    from public.ministerial_resultados r
   where r.profile_id = v_me
     and r.tenant_id = v_tenant
   order by r.completed_at desc nulls last
   limit 1;

  return query
  select
    o.id,
    o.titulo,
    o.descricao,
    o.tipo_escala_id,
    te.nome,
    lp.full_name,
    lp.phone,
    o.required_gifts,
    o.status,
    public.volunteer_gift_match_pct(v_winner, v_scores, o.required_gifts),
    (v_winner is not null and v_winner = any(public.volunteer_gifts_normalized(o.required_gifts))),
    i.status
    from public.volunteer_opportunities o
    left join public.tipos_escala te on te.id = o.tipo_escala_id
    left join public.profiles lp on lp.id = o.leader_profile_id
    left join public.volunteer_opportunity_interests i
      on i.opportunity_id = o.id and i.profile_id = v_me
   where o.tenant_id = v_tenant
     and o.status = 'aberta'
   order by
     (v_winner is not null and v_winner = any(public.volunteer_gifts_normalized(o.required_gifts))) desc,
     public.volunteer_gift_match_pct(v_winner, v_scores, o.required_gifts) desc,
     o.created_at desc;
end;
$$;

create or replace function public.express_volunteer_opportunity_interest(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
  v_me uuid := public.current_session_profile_id();
  v_opp public.volunteer_opportunities%rowtype;
begin
  if v_me is null then
    return jsonb_build_object('success', false, 'message', 'Sessão inválida.');
  end if;
  if not public.session_can_view_volunteer_mural() then
    return jsonb_build_object('success', false, 'message', 'Sem permissão para o mural.');
  end if;

  select * into v_opp
    from public.volunteer_opportunities o
   where o.id = p_id and o.tenant_id = v_tenant;

  if not found or v_opp.status is distinct from 'aberta' then
    return jsonb_build_object('success', false, 'message', 'Esta vaga não está aberta.');
  end if;

  insert into public.volunteer_opportunity_interests (tenant_id, opportunity_id, profile_id, status)
  values (v_tenant, v_opp.id, v_me, 'pendente')
  on conflict (opportunity_id, profile_id) do update
    set status = 'pendente',
        resolved_at = null,
        resolved_by = null
  where volunteer_opportunity_interests.status = 'recusado';

  return jsonb_build_object('success', true, 'message', 'Interesse registrado. Fale com o líder no WhatsApp.');
end;
$$;

create or replace function public.list_volunteer_opportunities_admin()
returns table (
  id uuid,
  titulo text,
  descricao text,
  tipo_escala_id uuid,
  ministerio_nome text,
  leader_profile_id uuid,
  leader_name text,
  required_gifts text[],
  status text,
  interests_count bigint,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
begin
  if not public.session_can_manage_volunteer_mural() then
    return;
  end if;

  return query
  select
    o.id,
    o.titulo,
    o.descricao,
    o.tipo_escala_id,
    te.nome,
    o.leader_profile_id,
    lp.full_name,
    o.required_gifts,
    o.status,
    (select count(*) from public.volunteer_opportunity_interests i where i.opportunity_id = o.id),
    o.created_at
    from public.volunteer_opportunities o
    left join public.tipos_escala te on te.id = o.tipo_escala_id
    left join public.profiles lp on lp.id = o.leader_profile_id
   where o.tenant_id = v_tenant
   order by o.created_at desc;
end;
$$;

create or replace function public.upsert_volunteer_opportunity(
  p_id uuid default null,
  p_titulo text default '',
  p_descricao text default '',
  p_tipo_escala_id uuid default null,
  p_leader_profile_id uuid default null,
  p_required_gifts text[] default '{}'::text[],
  p_status text default 'rascunho'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
  v_me uuid := public.current_session_profile_id();
  v_id uuid;
  v_prev text;
  v_status text;
  v_gifts text[];
begin
  if v_me is null or not public.session_can_manage_volunteer_mural() then
    return jsonb_build_object('success', false, 'message', 'Sem permissão para gerenciar o mural.');
  end if;

  v_status := lower(trim(coalesce(p_status, 'rascunho')));
  if v_status not in ('rascunho', 'aberta', 'encerrada', 'preenchida') then
    v_status := 'rascunho';
  end if;
  v_gifts := public.volunteer_gifts_normalized(p_required_gifts);

  if length(trim(coalesce(p_titulo, ''))) < 2 then
    return jsonb_build_object('success', false, 'message', 'Informe o título da vaga.');
  end if;

  if p_id is not null then
    select o.status into v_prev
      from public.volunteer_opportunities o
     where o.id = p_id and o.tenant_id = v_tenant;
    if not found then
      return jsonb_build_object('success', false, 'message', 'Vaga não encontrada.');
    end if;
  end if;

  v_id := coalesce(p_id, gen_random_uuid());

  insert into public.volunteer_opportunities (
    id, tenant_id, titulo, descricao, tipo_escala_id, leader_profile_id,
    required_gifts, status, created_by, updated_at
  ) values (
    v_id, v_tenant, trim(p_titulo), trim(coalesce(p_descricao, '')),
    p_tipo_escala_id, p_leader_profile_id, v_gifts, v_status, v_me, now()
  )
  on conflict (id) do update
    set titulo = excluded.titulo,
        descricao = excluded.descricao,
        tipo_escala_id = excluded.tipo_escala_id,
        leader_profile_id = excluded.leader_profile_id,
        required_gifts = excluded.required_gifts,
        status = excluded.status,
        updated_at = now()
  where public.volunteer_opportunities.tenant_id = v_tenant;

  if v_status = 'aberta' and coalesce(v_prev, '') is distinct from 'aberta' then
    perform public.volunteer_opportunity_notify_matches(v_id);
  end if;

  return jsonb_build_object('success', true, 'id', v_id, 'message', 'Vaga salva.');
end;
$$;

create or replace function public.list_opportunity_matching_members(p_id uuid)
returns table (
  profile_id uuid,
  full_name text,
  phone text,
  perfil_vencedor text,
  perfil_label text,
  match_pct integer,
  lesson_completed boolean,
  interest_status text,
  interest_id uuid
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
  v_me uuid := public.current_session_profile_id();
  v_opp public.volunteer_opportunities%rowtype;
begin
  -- Proteção aplicada: Gestor não tem visibilidade do Super Administrador
  if v_me is null or not public.session_can_manage_volunteer_mural() then
    return;
  end if;

  select * into v_opp
    from public.volunteer_opportunities o
   where o.id = p_id and o.tenant_id = v_tenant;

  if not found then
    return;
  end if;

  return query
  select
    q.profile_id,
    q.full_name,
    q.phone,
    q.perfil_vencedor,
    q.perfil_label,
    q.match_pct,
    q.lesson_completed,
    q.interest_status,
    q.interest_id
  from (
    select distinct on (p.id)
      p.id as profile_id,
      p.full_name,
      p.phone,
      r.perfil_vencedor,
      public.ministerial_profile_label(r.perfil_vencedor) as perfil_label,
      public.volunteer_gift_match_pct(
        r.perfil_vencedor,
        r.pontuacao_detalhada,
        v_opp.required_gifts
      ) as match_pct,
      exists (
        select 1
          from public.user_discipleship_progress udp
          join public.discipleship_lessons dl on dl.id = udp.lesson_id
          join public.discipleship_modules dm on dm.id = dl.module_id
         where udp.profile_id = p.id
           and udp.status = 'completed'
           and public.is_discipleship_ministerial_gifts_lesson(dm.sort_order, dl.sort_order, dl.title)
      ) as lesson_completed,
      i.status as interest_status,
      i.id as interest_id
    from public.ministerial_resultados r
    join public.profiles p on p.id = r.profile_id
    left join public.volunteer_opportunity_interests i
      on i.opportunity_id = v_opp.id and i.profile_id = p.id
   where r.tenant_id = v_tenant
     and p.tenant_id = v_tenant
     and p.status = 'approved'
     and public.profile_visible_to_access_actor(v_me, p.id)
     and (
       r.perfil_vencedor = any(public.volunteer_gifts_normalized(v_opp.required_gifts))
       or public.volunteer_gift_match_pct(r.perfil_vencedor, r.pontuacao_detalhada, v_opp.required_gifts) >= 50
     )
   order by
     p.id,
     (r.perfil_vencedor = any(public.volunteer_gifts_normalized(v_opp.required_gifts))) desc,
     public.volunteer_gift_match_pct(r.perfil_vencedor, r.pontuacao_detalhada, v_opp.required_gifts) desc,
     r.completed_at desc nulls last
  ) q
  order by
    (q.perfil_vencedor = any(public.volunteer_gifts_normalized(v_opp.required_gifts))) desc,
    q.match_pct desc,
    q.full_name;
end;
$$;

create or replace function public.resolve_volunteer_opportunity_interest(
  p_interest_id uuid,
  p_accept boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
  v_me uuid := public.current_session_profile_id();
  v_row public.volunteer_opportunity_interests%rowtype;
  v_tipo uuid;
begin
  if v_me is null or not public.session_can_manage_volunteer_mural() then
    return jsonb_build_object('success', false, 'message', 'Sem permissão.');
  end if;

  select * into v_row
    from public.volunteer_opportunity_interests i
   where i.id = p_interest_id and i.tenant_id = v_tenant
   for update;

  if not found then
    return jsonb_build_object('success', false, 'message', 'Interesse não encontrado.');
  end if;

  if v_row.status is distinct from 'pendente' then
    return jsonb_build_object('success', false, 'message', 'Este interesse já foi resolvido.');
  end if;

  update public.volunteer_opportunity_interests
     set status = case when p_accept then 'aceito' else 'recusado' end,
         resolved_at = now(),
         resolved_by = v_me
   where id = v_row.id;

  select o.tipo_escala_id into v_tipo
    from public.volunteer_opportunities o
   where o.id = v_row.opportunity_id;

  if p_accept then
    return jsonb_build_object(
      'success', true,
      'message', 'Interesse aceito. Inclua o membro em Servos em Disponibilidade.',
      'suggest_scale_volunteer', true,
      'profile_id', v_row.profile_id,
      'tipo_escala_id', v_tipo
    );
  end if;

  return jsonb_build_object('success', true, 'message', 'Interesse recusado.');
end;
$$;

create or replace function public.list_unread_opportunity_notices()
returns table (
  id uuid,
  opportunity_id uuid,
  title text,
  body text,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
  v_me uuid := public.current_session_profile_id();
begin
  if v_me is null then
    return;
  end if;
  return query
  select n.id, n.opportunity_id, n.title, n.body, n.created_at
    from public.volunteer_opportunity_notices n
   where n.tenant_id = v_tenant
     and n.profile_id = v_me
     and n.read_at is null
   order by n.created_at desc
   limit 30;
end;
$$;

-- ---------------------------------------------------------------------------
-- Orquestrador: aviso só para quem tem o perfil compatível com a vaga.
-- ---------------------------------------------------------------------------
create or replace function public.listar_event_avisos_publicados()
returns setof public.event_avisos
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_actor uuid := public.current_session_profile_id();
  v_tenant uuid := public.current_session_tenant_id();
  v_is_leader boolean := false;
  v_winner text;
begin
  if v_actor is not null then
    select exists (
      select 1
        from public.small_groups g
       where g.is_active
         and (v_tenant is null or g.tenant_id = v_tenant)
         and (g.leader_profile_id = v_actor or g.host_profile_id = v_actor)
    ) into v_is_leader;

    select r.perfil_vencedor into v_winner
      from public.ministerial_resultados r
     where r.profile_id = v_actor
       and (v_tenant is null or r.tenant_id = v_tenant)
     order by r.completed_at desc nulls last
     limit 1;
  end if;

  return query
  select ea.*
    from public.event_avisos ea
    left join public.volunteer_opportunities o on o.id = ea.opportunity_id
   where ea.is_published is true
     and (v_tenant is null or ea.tenant_id is null or ea.tenant_id = v_tenant)
     and (
       coalesce(ea.audience, 'all') = 'all'
       or (ea.audience = 'small_group_leaders' and v_is_leader)
       or (
         ea.audience = 'opportunity_match'
         and v_winner is not null
         and o.id is not null
         and o.status = 'aberta'
         and (v_tenant is null or o.tenant_id = v_tenant)
         and v_winner = any(public.volunteer_gifts_normalized(o.required_gifts))
       )
     )
   order by ea.sort_order asc, ea.updated_at desc;
end;
$$;

drop function if exists public.salvar_event_aviso(uuid, uuid, text, text, integer, boolean);
drop function if exists public.salvar_event_aviso(uuid, uuid, text, text, integer, boolean, text);
create or replace function public.salvar_event_aviso(
  p_actor_profile_id uuid,
  p_id uuid default null,
  p_title text default '',
  p_body text default '',
  p_sort_order integer default 0,
  p_is_published boolean default true,
  p_audience text default 'all',
  p_opportunity_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_row public.event_avisos%rowtype;
  v_title text;
  v_body text;
  v_audience text;
  v_opp uuid;
  v_tenant uuid := public.require_session_tenant_id();
begin
  if p_actor_profile_id is null then
    return jsonb_build_object('success', false, 'message', 'Sessão inválida.');
  end if;

  perform public.assert_actor_matches_session(p_actor_profile_id);

  if not public.profile_is_event_control_admin(p_actor_profile_id) then
    return jsonb_build_object('success', false, 'message', 'Sem permissão para gerenciar avisos.');
  end if;

  v_title := trim(coalesce(p_title, ''));
  v_body := trim(coalesce(p_body, ''));
  v_audience := lower(trim(coalesce(p_audience, 'all')));
  v_opp := p_opportunity_id;

  if v_body = '' then
    return jsonb_build_object('success', false, 'message', 'Informe o texto do aviso.');
  end if;

  if v_audience not in ('all', 'small_group_leaders', 'opportunity_match') then
    v_audience := 'all';
  end if;

  if v_audience is distinct from 'opportunity_match' then
    v_opp := null;
  elsif v_opp is null then
    return jsonb_build_object(
      'success', false,
      'message', 'Selecione a vaga para avisar só quem tem o perfil compatível.'
    );
  end if;

  v_id := coalesce(p_id, gen_random_uuid());

  insert into public.event_avisos (
    id, title, body, sort_order, is_published, audience, opportunity_id,
    created_by_profile_id, updated_by_profile_id, tenant_id
  )
  values (
    v_id, v_title, v_body, coalesce(p_sort_order, 0), coalesce(p_is_published, true),
    v_audience, v_opp, p_actor_profile_id, p_actor_profile_id, v_tenant
  )
  on conflict (id) do update
    set title = excluded.title,
        body = excluded.body,
        sort_order = excluded.sort_order,
        is_published = excluded.is_published,
        audience = excluded.audience,
        opportunity_id = excluded.opportunity_id,
        updated_at = now(),
        updated_by_profile_id = p_actor_profile_id
  returning * into v_row;

  return jsonb_build_object(
    'success', true,
    'message', 'Aviso salvo.',
    'id', v_row.id,
    'title', v_row.title,
    'body', v_row.body,
    'sort_order', v_row.sort_order,
    'is_published', v_row.is_published,
    'audience', v_row.audience,
    'opportunity_id', v_row.opportunity_id,
    'created_at', v_row.created_at,
    'updated_at', v_row.updated_at
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- ACL
-- ---------------------------------------------------------------------------
insert into public.access_resources (resource_type, resource_key, label, description, is_active)
values
  (
    'screen',
    'dashboard.card.opportunities',
    'Card — Mural de Oportunidades',
    'Vagas de voluntariado alinhadas ao Perfil Ministerial (Lição 5.1).',
    true
  ),
  (
    'screen',
    'maintenance.volunteer.mural',
    'Manutenção — Mural de Voluntários',
    'Cadastro de vagas, dons exigidos e busca ativa de servos compatíveis.',
    true
  ),
  (
    'table',
    'volunteer_opportunities',
    'Oportunidades de voluntariado',
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
   and res.resource_key = 'dashboard.card.opportunities'
 where r.code in (
   'super_admin', 'pastoral', 'lider_geral', 'lider', 'member', 'congregado',
   'tesoureiro', 'events_admin', 'gestor_controle_acesso'
 )
on conflict (role_id, resource_id) where (role_id is not null) do update
  set can_view = excluded.can_view,
      can_update = excluded.can_update,
      updated_at = now();

insert into public.access_grants (role_id, resource_id, can_view, can_update)
select r.id, res.id, true,
       r.code in ('super_admin', 'pastoral', 'lider_geral', 'lider', 'gestor_controle_acesso')
  from public.access_roles r
  join public.access_resources res
    on res.resource_type = 'screen'
   and res.resource_key = 'maintenance.volunteer.mural'
 where r.code in (
   'super_admin', 'pastoral', 'lider_geral', 'lider', 'gestor_controle_acesso'
 )
on conflict (role_id, resource_id) where (role_id is not null) do update
  set can_view = excluded.can_view,
      can_update = excluded.can_update,
      updated_at = now();

grant execute on function public.volunteer_gifts_normalized(text[]) to anon, authenticated, service_role;
grant execute on function public.volunteer_gift_match_pct(text, jsonb, text[]) to anon, authenticated, service_role;
grant execute on function public.session_can_manage_volunteer_mural() to anon, authenticated, service_role;
grant execute on function public.session_can_view_volunteer_mural() to anon, authenticated, service_role;
grant execute on function public.list_volunteer_opportunities_for_me() to anon, authenticated, service_role;
grant execute on function public.express_volunteer_opportunity_interest(uuid) to anon, authenticated, service_role;
grant execute on function public.list_volunteer_opportunities_admin() to anon, authenticated, service_role;
grant execute on function public.upsert_volunteer_opportunity(uuid, text, text, uuid, uuid, text[], text) to anon, authenticated, service_role;
grant execute on function public.list_opportunity_matching_members(uuid) to anon, authenticated, service_role;
grant execute on function public.resolve_volunteer_opportunity_interest(uuid, boolean) to anon, authenticated, service_role;
revoke all on function public.volunteer_opportunity_notify_matches(uuid) from public;
revoke all on function public.volunteer_opportunity_notify_matches(uuid) from anon;
revoke all on function public.volunteer_opportunity_notify_matches(uuid) from authenticated;
grant execute on function public.volunteer_opportunity_notify_matches(uuid) to service_role;

grant execute on function public.list_unread_opportunity_notices() to anon, authenticated, service_role;

create or replace function public.mark_opportunity_notices_read()
returns jsonb
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
  v_me uuid := public.current_session_profile_id();
begin
  if v_me is null then
    return jsonb_build_object('success', false);
  end if;
  update public.volunteer_opportunity_notices
     set read_at = now()
   where tenant_id = v_tenant
     and profile_id = v_me
     and read_at is null;
  return jsonb_build_object('success', true);
end;
$$;

grant execute on function public.mark_opportunity_notices_read() to anon, authenticated, service_role;
grant execute on function public.listar_event_avisos_publicados() to anon, authenticated, service_role;
grant execute on function public.salvar_event_aviso(uuid, uuid, text, text, integer, boolean, text, uuid) to anon, authenticated, service_role;

notify pgrst, 'reload schema';
