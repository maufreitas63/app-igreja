-- Avisos do culto (event_avisos) — conteúdo exibido em /avisos e gerenciado no orquestrador.
-- Execute no SQL Editor do Supabase após event-control-orchestration.sql.

-- ---------------------------------------------------------------------------
-- Tabela event_avisos
-- ---------------------------------------------------------------------------

create table if not exists public.event_avisos (
  id uuid primary key default gen_random_uuid(),
  title text not null default '',
  body text not null,
  sort_order integer not null default 0,
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by_profile_id uuid null references public.profiles (id) on delete set null,
  updated_by_profile_id uuid null references public.profiles (id) on delete set null,
  constraint event_avisos_body_check check (char_length(trim(body)) > 0)
);

create index if not exists idx_event_avisos_published_sort
  on public.event_avisos (is_published, sort_order asc, updated_at desc);

alter table public.event_avisos
  add column if not exists audience text not null default 'all';

alter table public.event_avisos
  drop constraint if exists event_avisos_audience_check;

alter table public.event_avisos
  add constraint event_avisos_audience_check
  check (audience in ('all', 'small_group_leaders', 'opportunity_match'));

-- ---------------------------------------------------------------------------
-- Rotas da orquestração — Ofertas + Dízimos unificados
-- ---------------------------------------------------------------------------

alter table public.event_control
  drop constraint if exists event_control_active_route_check;

update public.event_control
   set active_route = '/ofertas_dizimos'
 where active_route in ('/ofertas', '/dizimos');

alter table public.event_control
  add constraint event_control_active_route_check check (
    active_route in ('/home', '/ofertas_dizimos', '/avisos', '/ofertas', '/dizimos')
  );

create or replace function public.atualizar_event_control_rota(
  p_actor_profile_id uuid,
  p_active_route text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_route text;
  v_row public.event_control%rowtype;
begin
  if p_actor_profile_id is null then
    return jsonb_build_object('success', false, 'message', 'Sessão inválida.');
  end if;

  if not public.profile_is_event_control_admin(p_actor_profile_id) then
    return jsonb_build_object(
      'success',
      false,
      'message',
      'Apenas orquestradores de evento podem alterar a orquestração.'
    );
  end if;

  v_route := lower(trim(coalesce(p_active_route, '')));

  if v_route in ('/ofertas', '/dizimos') then
    v_route := '/ofertas_dizimos';
  end if;

  if v_route not in ('/home', '/ofertas_dizimos', '/avisos', '/ofertas', '/dizimos') then
    return jsonb_build_object('success', false, 'message', 'Rota inválida para orquestração.');
  end if;

  update public.event_control
     set active_route = v_route,
         updated_at = now()
   where id = 1
  returning * into v_row;

  if not found then
    insert into public.event_control (id, active_route, updated_at)
    values (1, v_route, now())
    returning * into v_row;
  end if;

  return jsonb_build_object(
    'success',
    true,
    'message',
    'Rota atualizada.',
    'id',
    v_row.id,
    'active_route',
    v_row.active_route,
    'updated_at',
    v_row.updated_at
  );
end;
$$;

grant execute on function public.atualizar_event_control_rota(uuid, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- RPCs — avisos
-- ---------------------------------------------------------------------------

create or replace function public.listar_event_avisos_publicados()
returns setof public.event_avisos
language sql
stable
security definer
set search_path = public
as $$
  select *
    from public.event_avisos ea
   where ea.is_published is true
     and coalesce(ea.audience, 'all') <> 'opportunity_match'
   order by ea.sort_order asc, ea.updated_at desc;
$$;

create or replace function public.listar_event_avisos_orquestrador(p_actor_profile_id uuid)
returns setof public.event_avisos
language sql
stable
security definer
set search_path = public
as $$
  select *
    from public.event_avisos ea
   where p_actor_profile_id is not null
     and p_actor_profile_id = public.current_session_profile_id()
     and public.profile_is_event_control_admin(p_actor_profile_id)
   order by ea.sort_order asc, ea.updated_at desc;
$$;

create or replace function public.salvar_event_aviso(
  p_actor_profile_id uuid,
  p_id uuid default null,
  p_title text default '',
  p_body text default '',
  p_sort_order integer default 0,
  p_is_published boolean default true
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

  if v_body = '' then
    return jsonb_build_object('success', false, 'message', 'Informe o texto do aviso.');
  end if;

  v_id := coalesce(p_id, gen_random_uuid());

  insert into public.event_avisos (
    id,
    title,
    body,
    sort_order,
    is_published,
    created_by_profile_id,
    updated_by_profile_id
  )
  values (
    v_id,
    v_title,
    v_body,
    coalesce(p_sort_order, 0),
    coalesce(p_is_published, true),
    p_actor_profile_id,
    p_actor_profile_id
  )
  on conflict (id) do update
    set title = excluded.title,
        body = excluded.body,
        sort_order = excluded.sort_order,
        is_published = excluded.is_published,
        updated_at = now(),
        updated_by_profile_id = p_actor_profile_id
  returning * into v_row;

  return jsonb_build_object(
    'success',
    true,
    'message',
    'Aviso salvo.',
    'id',
    v_row.id,
    'title',
    v_row.title,
    'body',
    v_row.body,
    'sort_order',
    v_row.sort_order,
    'is_published',
    v_row.is_published,
    'updated_at',
    v_row.updated_at
  );
end;
$$;

create or replace function public.excluir_event_aviso(
  p_actor_profile_id uuid,
  p_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_actor_profile_id is null then
    return jsonb_build_object('success', false, 'message', 'Sessão inválida.');
  end if;

  perform public.assert_actor_matches_session(p_actor_profile_id);

  if not public.profile_is_event_control_admin(p_actor_profile_id) then
    return jsonb_build_object('success', false, 'message', 'Sem permissão para excluir avisos.');
  end if;

  if p_id is null then
    return jsonb_build_object('success', false, 'message', 'Aviso inválido.');
  end if;

  delete from public.event_avisos where id = p_id;

  if not found then
    return jsonb_build_object('success', false, 'message', 'Aviso não encontrado.');
  end if;

  return jsonb_build_object('success', true, 'message', 'Aviso excluído.');
end;
$$;

grant execute on function public.listar_event_avisos_publicados() to anon, authenticated;
grant execute on function public.listar_event_avisos_orquestrador(uuid) to anon, authenticated;
grant execute on function public.salvar_event_aviso(uuid, uuid, text, text, integer, boolean) to anon, authenticated;
grant execute on function public.excluir_event_aviso(uuid, uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.event_avisos enable row level security;

drop policy if exists event_avisos_select_published on public.event_avisos;
drop policy if exists event_avisos_write_orchestrator on public.event_avisos;

create policy event_avisos_select_published
  on public.event_avisos
  for select
  to anon, authenticated
  using (
    is_published is true
    and coalesce(audience, 'all') = 'all'
  );

create policy event_avisos_write_orchestrator
  on public.event_avisos
  for all
  to authenticated
  using (false)
  with check (false);

grant select on public.event_avisos to anon, authenticated;

-- ---------------------------------------------------------------------------
-- ACL — recurso da tabela
-- ---------------------------------------------------------------------------

insert into public.access_resources (resource_type, resource_key, label, description, is_active)
values (
  'table',
  'event_avisos',
  'Avisos do culto (event_avisos)',
  'Comunicados exibidos na rota /avisos durante o evento',
  true
)
on conflict (resource_type, resource_key) do update
  set label = coalesce(excluded.label, public.access_resources.label),
      description = coalesce(excluded.description, public.access_resources.description),
      is_active = true;

insert into public.access_grants (role_id, resource_id, can_view, can_update)
select r.id, res.id, true, true
  from public.access_roles r
  join public.access_resources res
    on res.resource_type = 'table'
   and res.resource_key = 'event_avisos'
 where r.code = 'orquestrador_evento'
on conflict (role_id, resource_id) where (role_id is not null) do update
  set can_view = true,
      can_update = true,
      updated_at = now();

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      alter publication supabase_realtime add table public.event_avisos;
    exception
      when duplicate_object then
        null;
    end;
  end if;
end;
$$;

-- Se o mural já existir, restaura o filtro opportunity_match e remove overload antigo do salvar.
do $restore_opportunity_match$
begin
  if to_regclass('public.volunteer_opportunities') is null then
    return;
  end if;

  drop function if exists public.salvar_event_aviso(uuid, uuid, text, text, integer, boolean);
  drop function if exists public.salvar_event_aviso(uuid, uuid, text, text, integer, boolean, text);

  execute $fn$
create or replace function public.listar_event_avisos_publicados()
returns setof public.event_avisos
language plpgsql
stable
security definer
set search_path = public
as $listar$
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
$listar$;
$fn$;
end
$restore_opportunity_match$;

notify pgrst, 'reload schema';
