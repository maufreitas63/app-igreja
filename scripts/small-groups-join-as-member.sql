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

  insert into public.small_group_members (tenant_id, small_group_id, profile_id)
  values (v_tenant, p_group_id, v_me)
  on conflict (small_group_id, profile_id) do nothing;

  return jsonb_build_object(
    'success', true,
    'message', 'Inscrição confirmada em "' || v_name || '".'
  );
end;
$$;

grant execute on function public.join_small_group_as_member(uuid) to anon, authenticated;
