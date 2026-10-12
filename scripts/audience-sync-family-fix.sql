-- Audiência da família: o check-in rejeitava integrantes que a lista mostra
-- (accepted nulo) e comparava o código da família sem normalizar.
-- A sessão também pode gravar a família do próprio integrante quando o
-- family_id do perfil ficou diferente do código usado na tela.

create or replace function public.assert_session_can_manage_family(p_family_group_id text)
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_session_profile_id uuid;
  v_session_family text;
  v_normalized_family text;
  v_tenant uuid;
begin
  v_session_profile_id := public.current_session_profile_id();

  if v_session_profile_id is null then
    raise exception 'Sessão não identificada.';
  end if;

  v_normalized_family := upper(btrim(coalesce(p_family_group_id, '')));

  if v_normalized_family = '' then
    raise exception 'Família não informada.';
  end if;

  select upper(btrim(coalesce(p.family_id, p.codigo_membro, '')))
    into v_session_family
  from public.profiles p
  where p.id = v_session_profile_id;

  if v_session_family = v_normalized_family then
    return;
  end if;

  v_tenant := public.current_session_tenant_id();

  if exists (
    select 1
    from public.members m
    where (v_tenant is null or m.tenant_id = v_tenant)
      and upper(btrim(coalesce(m.family_id, ''))) = v_normalized_family
      and m.accepted is distinct from false
      and public.find_profile_id_for_member_sync(m.phone, m.full_name) = v_session_profile_id
  ) then
    return;
  end if;

  raise exception 'Você só pode gerenciar o pré-cadastro da sua família.';
end;
$$;

create or replace function public.sync_family_event_registrations_atomic(
  p_event_id uuid,
  p_family_group_id text,
  p_member_ids uuid[],
  p_latitude double precision default null,
  p_longitude double precision default null,
  p_skip_geofence boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
  v_family text := upper(btrim(coalesce(p_family_group_id, '')));
  v_member_id uuid;
  v_result jsonb;
  v_names text[] := '{}';
  v_name text;
  v_target_profile_ids uuid[] := '{}';
  v_profile_id uuid;
  v_member members%rowtype;
  v_has_existing_checkin boolean;
begin
  perform public.assert_session_can_manage_family(v_family);

  v_has_existing_checkin := public.family_has_geo_checkin_at_event(p_event_id, v_family);

  perform public.assert_geofence_for_event(
    p_event_id,
    p_latitude,
    p_longitude,
    coalesce(p_skip_geofence, false) or v_has_existing_checkin
  );

  foreach v_member_id in array coalesce(p_member_ids, '{}'::uuid[])
  loop
    select m.*
      into v_member
    from public.members m
    where m.tenant_id = v_tenant
      and m.id = v_member_id
      and m.accepted is distinct from false;

    if not found then
      raise exception 'Membro % não encontrado ou não reconhecido.', v_member_id::text;
    end if;

    if nullif(btrim(coalesce(v_member.family_id, '')), '') is not null
       and upper(btrim(v_member.family_id)) <> v_family then
      raise exception 'Membro % não pertence à família informada.', v_member_id::text;
    end if;

    v_profile_id := public.find_profile_id_for_member_sync(v_member.phone, v_member.full_name);

    if v_profile_id is null then
      raise exception 'Perfil vinculado ao membro % não foi encontrado.', coalesce(nullif(btrim(v_member.full_name), ''), v_member_id::text);
    end if;

    v_target_profile_ids := array_append(v_target_profile_ids, v_profile_id);
  end loop;

  delete from public.event_registrations er
  where er.tenant_id = v_tenant
    and er.event_id = p_event_id
    and upper(btrim(coalesce(er.family_id, ''))) = v_family
    and (
      cardinality(v_target_profile_ids) = 0
      or er.profile_id <> all (v_target_profile_ids)
    );

  foreach v_member_id in array coalesce(p_member_ids, '{}'::uuid[])
  loop
    v_result := public.register_member_atomic(p_event_id, v_member_id, v_family);

    if coalesce((v_result ->> 'success')::boolean, false) is not true then
      raise exception '%', coalesce(v_result ->> 'message', 'Falha ao registrar participante.');
    end if;

    select m.full_name
      into v_name
    from public.members m
    where m.tenant_id = v_tenant
      and m.id = v_member_id;

    if v_name is not null then
      v_names := array_append(v_names, btrim(v_name));
    end if;
  end loop;

  return jsonb_build_object(
    'success', true,
    'message', 'Audiência da família atualizada com sucesso.',
    'participant_names', to_jsonb(v_names)
  );
end;
$$;

grant execute on function public.assert_session_can_manage_family(text) to anon, authenticated;
grant execute on function public.sync_family_event_registrations_atomic(uuid, text, uuid[], double precision, double precision, boolean) to anon, authenticated;

notify pgrst, 'reload schema';
