-- Permite super_admin gravar parâmetros globais (ex.: LGPD_Ativo) pela manutenção.
-- Pré-requisitos:
--   scripts/access-control-admin-rpc.sql (assert_access_admin)
--   scripts/access-control-table-rls.sql (current_session_profile_id)
-- Execute no SQL Editor do Supabase.

-- Escrita via cliente (header x-profile-id) e via RPC security definer.
drop policy if exists app_parameters_insert_super_admin on public.app_parameters;
drop policy if exists app_parameters_update_super_admin on public.app_parameters;

create policy app_parameters_insert_super_admin
  on public.app_parameters
  for insert
  to anon, authenticated
  with check (public.is_super_admin_profile(public.current_session_profile_id()));

create policy app_parameters_update_super_admin
  on public.app_parameters
  for update
  to anon, authenticated
  using (public.is_super_admin_profile(public.current_session_profile_id()))
  with check (public.is_super_admin_profile(public.current_session_profile_id()));

grant insert, update on public.app_parameters to anon, authenticated;

create or replace function public.salvar_app_parameter_admin(
  p_actor_profile_id uuid,
  p_parameter text,
  p_value text
)
returns jsonb
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_parameter text;
  v_value text;
begin
  perform public.assert_access_admin(p_actor_profile_id);

  v_parameter := trim(coalesce(p_parameter, ''));
  v_value := trim(coalesce(p_value, ''));

  if v_parameter = '' then
    return jsonb_build_object('success', false, 'message', 'Parâmetro inválido.');
  end if;

  update public.app_parameters
     set value = v_value
   where lower(parameter) = lower(v_parameter);

  if not found then
    insert into public.app_parameters (parameter, value)
    values (v_parameter, v_value);
  end if;

  return jsonb_build_object(
    'success', true,
    'message', 'Parâmetro salvo.',
    'parameter', v_parameter,
    'value', v_value
  );
exception
  when others then
    return jsonb_build_object('success', false, 'message', sqlerrm);
end;
$$;

grant execute on function public.salvar_app_parameter_admin(uuid, text, text) to anon, authenticated;

notify pgrst, 'reload schema';
