-- Auditoria média 13–17: opportunity_match, matches sem duplicata,
-- reabrir interesse recusado e insights isolados por tenant.
-- Aplica: npx supabase db query --linked -f scripts/audit-medium-13-17.sql

alter table public.event_avisos
  add column if not exists audience text not null default 'all';

alter table public.event_avisos
  drop constraint if exists event_avisos_audience_check;

alter table public.event_avisos
  add constraint event_avisos_audience_check
  check (audience in ('all', 'small_group_leaders', 'opportunity_match'));

drop function if exists public.salvar_event_aviso(uuid, uuid, text, text, integer, boolean);
drop function if exists public.salvar_event_aviso(uuid, uuid, text, text, integer, boolean, text);

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

create or replace function public.list_profile_access_insights_admin(
  p_actor_profile_id uuid
)
returns table (
  profile_id uuid,
  full_name text,
  last_access_at timestamptz,
  access_count bigint
)
language plpgsql
security definer
set search_path = public
as $list_profile_access_insights_admin$
declare
  v_tenant uuid := public.require_session_tenant_id();
begin
  perform public.assert_access_admin(p_actor_profile_id);
  -- Proteção aplicada: Gestor não tem visibilidade do Super Administrador

  return query
  select
    p.id as profile_id,
    p.full_name,
    max(e.accessed_at) as last_access_at,
    count(e.id)::bigint as access_count
  from public.profiles p
  inner join public.profile_app_access_events e on e.profile_id = p.id
  where p.tenant_id = v_tenant
    and coalesce(trim(p.full_name), '') <> ''
    and lower(trim(p.full_name)) <> 'visitante'
    and public.profile_visible_to_access_actor(p_actor_profile_id, p.id)
  group by p.id, p.full_name
  having count(e.id) > 0
  order by max(e.accessed_at) desc, p.full_name asc;
end;
$list_profile_access_insights_admin$;

create or replace function public.list_profile_access_screen_visits_admin(
  p_actor_profile_id uuid,
  p_target_profile_id uuid
)
returns table (
  access_event_id uuid,
  accessed_at timestamptz,
  screen_key text,
  screen_label text,
  visited_at timestamptz,
  visit_order integer
)
language plpgsql
security definer
set search_path = public
as $list_profile_access_screen_visits_admin$
declare
  v_tenant uuid := public.require_session_tenant_id();
begin
  perform public.assert_access_admin(p_actor_profile_id);
  -- Proteção aplicada: Gestor não tem visibilidade do Super Administrador
  perform public.assert_gestor_super_admin_shield(
    p_actor_profile_id,
    p_target_profile_id,
    null,
    'list_access_screen_visits'
  );

  if p_target_profile_id is null then
    return;
  end if;

  if not exists (
    select 1
      from public.profiles p
     where p.id = p_target_profile_id
       and p.tenant_id = v_tenant
       and public.profile_visible_to_access_actor(p_actor_profile_id, p.id)
  ) then
    return;
  end if;

  return query
  select
    e.id as access_event_id,
    e.accessed_at,
    sv.screen_key,
    sv.screen_label,
    sv.visited_at,
    sv.visit_order
  from public.profile_app_access_events e
  left join public.profile_app_access_screen_visits sv
    on sv.access_event_id = e.id
   and sv.screen_label not in ('Dashboard', 'Manutenção')
   and sv.screen_key not in ('/dashboard', '/maintenance-dashboard')
  where e.profile_id = p_target_profile_id
  order by e.accessed_at desc, sv.visit_order asc nulls last;
end;
$list_profile_access_screen_visits_admin$;

notify pgrst, 'reload schema';
