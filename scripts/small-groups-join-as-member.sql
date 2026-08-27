-- Membro se inscreve no próprio pequeno grupo (identidade efetiva / Ghost).

create or replace function public.join_small_group_as_member(p_group_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
  v_me uuid := public.current_session_profile_id();
  v_name text;
  v_inserted int;
begin
  if v_me is null then
    return jsonb_build_object('success', false, 'message', 'Sessão inválida.');
  end if;

  if p_group_id is null then
    return jsonb_build_object('success', false, 'message', 'Informe o grupo.');
  end if;

  if exists (
    select 1 from public.profiles p
     where p.id = v_me
       and p.membership_out is not null
  ) then
    return jsonb_build_object('success', false, 'message', 'Perfil inativo não pode participar de um grupo.');
  end if;

  select g.name into v_name
    from public.small_groups g
   where g.id = p_group_id
     and g.tenant_id = v_tenant
     and g.is_active
     and g.host_profile_id is not null;

  if v_name is null then
    return jsonb_build_object('success', false, 'message', 'Grupo não encontrado ou sem anfitrião.');
  end if;

  if exists (
    select 1 from public.small_group_members m
     where m.tenant_id = v_tenant
       and m.profile_id = v_me
       and m.small_group_id = p_group_id
  ) then
    return jsonb_build_object('success', true, 'message', 'Você já participa deste grupo.');
  end if;

  if exists (
    select 1 from public.small_group_members m
     where m.tenant_id = v_tenant
       and m.profile_id = v_me
       and m.small_group_id <> p_group_id
  ) then
    return jsonb_build_object('success', false, 'message', 'Você já participa de outro pequeno grupo.');
  end if;

  begin
    insert into public.small_group_members (tenant_id, small_group_id, profile_id)
    values (v_tenant, p_group_id, v_me);
    get diagnostics v_inserted = row_count;
  exception
    when unique_violation then
      return jsonb_build_object(
        'success', false,
        'message', 'Você já participa de outro pequeno grupo.'
      );
  end;

  if coalesce(v_inserted, 0) < 1 then
    return jsonb_build_object('success', false, 'message', 'Não foi possível registrar a inscrição.');
  end if;

  return jsonb_build_object(
    'success', true,
    'message', 'Inscrição confirmada em "' || v_name || '".'
  );
end;
$$;

grant execute on function public.join_small_group_as_member(uuid) to anon, authenticated;

create or replace function public.leave_small_group_as_member(p_group_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
  v_me uuid := public.current_session_profile_id();
  v_name text;
  v_is_host boolean;
  v_is_leader boolean;
  v_deleted int;
begin
  if v_me is null then
    return jsonb_build_object('success', false, 'message', 'Sessão inválida.');
  end if;

  if p_group_id is null then
    return jsonb_build_object('success', false, 'message', 'Informe o grupo.');
  end if;

  select g.name,
         g.host_profile_id is not distinct from v_me,
         g.leader_profile_id is not distinct from v_me
    into v_name, v_is_host, v_is_leader
    from public.small_groups g
   where g.id = p_group_id
     and g.tenant_id = v_tenant;

  if v_name is null then
    return jsonb_build_object('success', false, 'message', 'Grupo não encontrado.');
  end if;

  if v_is_host or v_is_leader then
    return jsonb_build_object(
      'success', false,
      'message', 'Anfitrião ou líder não sai por aqui. Peça à gestão para realocar o grupo.'
    );
  end if;

  delete from public.small_group_members m
   where m.tenant_id = v_tenant
     and m.small_group_id = p_group_id
     and m.profile_id = v_me;

  get diagnostics v_deleted = row_count;

  if v_deleted < 1 then
    return jsonb_build_object('success', true, 'message', 'Você já não participa deste grupo.');
  end if;

  return jsonb_build_object(
    'success', true,
    'message', 'Você saiu do grupo "' || v_name || '".'
  );
end;
$$;

grant execute on function public.leave_small_group_as_member(uuid) to anon, authenticated;
