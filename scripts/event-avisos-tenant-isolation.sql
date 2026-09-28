-- Avisos do culto ficam na igreja da sessão.
-- A lista do orquestrador não filtrava tenant_id, então a IBN via os avisos da IBS.
-- A lista publicada tratava tenant nulo como "todas as igrejas".

create or replace function public.listar_event_avisos_orquestrador(p_actor_profile_id uuid)
returns setof public.event_avisos
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.current_session_tenant_id();
begin
  if v_tenant is null
     or p_actor_profile_id is null
     or p_actor_profile_id is distinct from public.current_session_profile_id()
     or not public.profile_is_event_control_admin(p_actor_profile_id) then
    return;
  end if;

  return query
  select ea.*
    from public.event_avisos ea
   where ea.tenant_id = v_tenant
   order by ea.sort_order asc, ea.updated_at desc;
end;
$$;

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
  if v_tenant is null then
    return;
  end if;

  if v_actor is not null then
    select exists (
      select 1
        from public.small_groups g
       where g.is_active
         and g.tenant_id = v_tenant
         and (g.leader_profile_id = v_actor or g.host_profile_id = v_actor)
    ) into v_is_leader;

    select r.perfil_vencedor into v_winner
      from public.ministerial_resultados r
     where r.profile_id = v_actor
       and r.tenant_id = v_tenant
     order by r.completed_at desc nulls last
     limit 1;
  end if;

  return query
  select ea.*
    from public.event_avisos ea
    left join public.volunteer_opportunities o
      on o.id = ea.opportunity_id
     and o.tenant_id = v_tenant
   where ea.is_published is true
     and ea.tenant_id = v_tenant
     and (
       coalesce(ea.audience, 'all') = 'all'
       or (ea.audience = 'small_group_leaders' and v_is_leader)
       or (
         ea.audience = 'opportunity_match'
         and v_winner is not null
         and o.id is not null
         and o.status = 'aberta'
         and v_winner = any(public.volunteer_gifts_normalized(o.required_gifts))
       )
     )
   order by ea.sort_order asc, ea.updated_at desc;
end;
$$;

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
  elsif v_opp is null or not exists (
    select 1
      from public.volunteer_opportunities opp
     where opp.id = v_opp
       and opp.tenant_id = v_tenant
  ) then
    return jsonb_build_object(
      'success', false,
      'message', 'Selecione a vaga desta igreja para avisar só quem tem o perfil compatível.'
    );
  end if;

  if p_id is not null and exists (
    select 1
      from public.event_avisos existing
     where existing.id = p_id
       and existing.tenant_id is distinct from v_tenant
  ) then
    return jsonb_build_object('success', false, 'message', 'Aviso não encontrado.');
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
  where public.event_avisos.tenant_id = v_tenant
  returning * into v_row;

  if v_row.id is null then
    return jsonb_build_object('success', false, 'message', 'Aviso não encontrado.');
  end if;

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

create or replace function public.excluir_event_aviso(
  p_actor_profile_id uuid,
  p_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
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

  delete from public.event_avisos
   where id = p_id
     and tenant_id = v_tenant;

  if not found then
    return jsonb_build_object('success', false, 'message', 'Aviso não encontrado.');
  end if;

  return jsonb_build_object('success', true, 'message', 'Aviso excluído.');
end;
$$;

grant execute on function public.listar_event_avisos_orquestrador(uuid) to anon, authenticated, service_role;
grant execute on function public.listar_event_avisos_publicados() to anon, authenticated, service_role;
grant execute on function public.salvar_event_aviso(uuid, uuid, text, text, integer, boolean, text, uuid) to anon, authenticated, service_role;
grant execute on function public.excluir_event_aviso(uuid, uuid) to anon, authenticated, service_role;

notify pgrst, 'reload schema';
