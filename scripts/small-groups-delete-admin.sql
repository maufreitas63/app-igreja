-- Exclui o pequeno grupo (membros e chamada em cascade). Anfitrião e líder
-- saem deste cadastro; os perfis na igreja permanecem.

create or replace function public.delete_small_group_admin(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
  v_actor uuid := public.current_session_profile_id();
  v_name text;
begin
  if v_actor is null or not public.can_admin_small_groups(v_actor) then
    return jsonb_build_object('success', false, 'message', 'Sem permissão para excluir grupos.');
  end if;

  if p_id is null then
    return jsonb_build_object('success', false, 'message', 'Informe o grupo.');
  end if;

  select g.name into v_name
    from public.small_groups g
   where g.id = p_id
     and g.tenant_id = v_tenant;

  if v_name is null then
    return jsonb_build_object('success', false, 'message', 'Grupo não encontrado nesta igreja.');
  end if;

  delete from public.small_groups g
   where g.id = p_id
     and g.tenant_id = v_tenant;

  return jsonb_build_object(
    'success', true,
    'message', 'Grupo "' || v_name || '" excluído, incluindo anfitrião e líder deste cadastro.'
  );
end;
$$;

grant execute on function public.delete_small_group_admin(uuid) to anon, authenticated;
