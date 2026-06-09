-- Visitante é fallback automático (sem papéis em profile_access_roles).
-- O papel visitantes continua no ACL para grants, mas não é atribuível a perfis na UI.

create or replace function public.listar_papeis_perfil_access_admin(
  p_actor_profile_id uuid,
  p_target_profile_id uuid
)
returns table (
  role_id uuid,
  role_code text,
  role_name text,
  assigned boolean
)
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.assert_access_admin(p_actor_profile_id);

  if p_target_profile_id is null then
    raise exception 'Perfil não informado.';
  end if;

  if not exists (select 1 from public.profiles p where p.id = p_target_profile_id) then
    raise exception 'Perfil não encontrado.';
  end if;

  return query
  select
    ar.id as role_id,
    ar.code as role_code,
    ar.name as role_name,
    exists (
      select 1
        from public.profile_access_roles par
       where par.profile_id = p_target_profile_id
         and par.role_id = ar.id
    ) as assigned
  from public.access_roles ar
  where ar.code <> 'visitantes'
  order by public.access_role_display_order(ar.code), ar.name asc;
end;
$$;

create or replace function public.atribuir_papel_perfil_access_admin(
  p_actor_profile_id uuid,
  p_target_profile_id uuid,
  p_role_code text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role_code text;
  v_role_id uuid;
begin
  perform public.assert_access_admin(p_actor_profile_id);

  v_role_code := lower(trim(coalesce(p_role_code, '')));

  if p_target_profile_id is null then
    return jsonb_build_object('success', false, 'message', 'Perfil não informado.');
  end if;

  if v_role_code = '' then
    return jsonb_build_object('success', false, 'message', 'Papel não informado.');
  end if;

  if v_role_code = 'visitantes' then
    return jsonb_build_object(
      'success',
      false,
      'message',
      'O papel visitante é automático: perfis sem papéis já recebem esse acesso.'
    );
  end if;

  select ar.id
    into v_role_id
    from public.access_roles ar
   where ar.code = v_role_code;

  if v_role_id is null then
    return jsonb_build_object('success', false, 'message', 'Papel não encontrado.');
  end if;

  insert into public.profile_access_roles (profile_id, role_id, granted_by_profile_id)
  values (p_target_profile_id, v_role_id, p_actor_profile_id)
  on conflict (profile_id, role_id) do nothing;

  return jsonb_build_object('success', true, 'message', 'Papel atribuído.');
end;
$$;

grant execute on function public.listar_papeis_perfil_access_admin(uuid, uuid) to anon, authenticated;
grant execute on function public.atribuir_papel_perfil_access_admin(uuid, uuid, text) to anon, authenticated;

notify pgrst, 'reload schema';
