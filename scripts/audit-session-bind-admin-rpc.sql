-- Amarra ator das RPCs admin/orquestrador à sessão efetiva (inclui Ghost).
-- Aplica: npx supabase db query --linked -f scripts/audit-session-bind-admin-rpc.sql

create or replace function public.assert_access_admin(p_actor_profile_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_actor_profile_id is null then
    raise exception 'Sessão inválida. Saia e entre novamente no aplicativo.';
  end if;

  perform public.assert_actor_matches_session(p_actor_profile_id);

  if public.can_manage_access_control(p_actor_profile_id) then
    return;
  end if;

  raise exception 'Apenas Super Administrador ou Gestor em Controle de Acesso podem gerenciar permissões.';
end;
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

notify pgrst, 'reload schema';
