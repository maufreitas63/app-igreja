-- Super admin pode alterar papéis básicos e datas de membresia mesmo em perfis protegidos.
-- Execute no Supabase se aparecer: "Este perfil possui papel protegido...".

create or replace function public.definir_papel_basico_perfil_pastoral(
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
  v_current_role text;
begin
  perform public.assert_pastoral_role_change_actor(p_actor_profile_id);

  if p_target_profile_id is null then
    return jsonb_build_object('success', false, 'message', 'Perfil não informado.');
  end if;

  if not exists (select 1 from public.profiles p where p.id = p_target_profile_id) then
    return jsonb_build_object('success', false, 'message', 'Perfil não encontrado.');
  end if;

  if not public.is_super_admin_profile(p_actor_profile_id)
     and public.profile_has_protected_role_for_pastoral_change(p_target_profile_id) then
    return jsonb_build_object(
      'success',
      false,
      'message',
      'Este perfil possui papel protegido e não pode ser alterado por esta tela.'
    );
  end if;

  v_role_code := lower(trim(coalesce(p_role_code, '')));

  if v_role_code not in ('visitante', 'congregado', 'member') then
    return jsonb_build_object(
      'success',
      false,
      'message',
      'Papel inválido. Use visitante, congregado ou member.'
    );
  end if;

  v_current_role := public.resolve_basic_role_code_for_profile(p_target_profile_id);

  if v_current_role = v_role_code then
    return jsonb_build_object('success', true, 'message', 'Papel já estava definido.');
  end if;

  delete from public.profile_access_roles par
   using public.access_roles ar
   where par.role_id = ar.id
     and par.profile_id = p_target_profile_id
     and ar.code in ('member', 'congregado', 'visitantes');

  if v_role_code = 'visitante' then
    perform public.ensure_profile_visitantes_role(p_target_profile_id, p_actor_profile_id);

    return jsonb_build_object(
      'success',
      true,
      'message',
      'Perfil definido como visitante.'
    );
  end if;

  select ar.id
    into v_role_id
    from public.access_roles ar
   where ar.code = v_role_code;

  if v_role_id is null then
    return jsonb_build_object('success', false, 'message', 'Papel não encontrado no sistema.');
  end if;

  insert into public.profile_access_roles (profile_id, role_id, granted_by_profile_id)
  values (p_target_profile_id, v_role_id, p_actor_profile_id)
  on conflict (profile_id, role_id) do nothing;

  return jsonb_build_object(
    'success',
    true,
    'message',
    case v_role_code
      when 'member' then 'Papel alterado para Membro.'
      when 'congregado' then 'Papel alterado para Congregado.'
      else 'Papel atualizado.'
    end
  );
end;
$$;

create or replace function public.atualizar_membership_date_perfil_pastoral(
  p_actor_profile_id uuid,
  p_target_profile_id uuid,
  p_membership_date date,
  p_membership_out date default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.assert_pastoral_role_change_actor(p_actor_profile_id);

  if p_target_profile_id is null then
    return jsonb_build_object('success', false, 'message', 'Perfil não informado.');
  end if;

  if not exists (select 1 from public.profiles p where p.id = p_target_profile_id) then
    return jsonb_build_object('success', false, 'message', 'Perfil não encontrado.');
  end if;

  if not public.is_super_admin_profile(p_actor_profile_id)
     and public.profile_has_protected_role_for_pastoral_change(p_target_profile_id) then
    return jsonb_build_object(
      'success',
      false,
      'message',
      'Este perfil possui papel protegido e não pode ser alterado por esta tela.'
    );
  end if;

  if public.resolve_basic_role_code_for_profile(p_target_profile_id) <> 'member' then
    return jsonb_build_object(
      'success',
      false,
      'message',
      'As datas de membresia só podem ser editadas para perfis classificados como Membro.'
    );
  end if;

  update public.profiles
     set membership_date = p_membership_date,
         membership_out = p_membership_out,
         updated_at = now()
   where id = p_target_profile_id;

  return jsonb_build_object(
    'success',
    true,
    'message',
    case
      when p_membership_date is null and p_membership_out is null then 'Datas de membresia removidas.'
      else 'Datas de membresia atualizadas.'
    end,
    'membership_date', p_membership_date,
    'membership_out', p_membership_out
  );
end;
$$;

grant execute on function public.definir_papel_basico_perfil_pastoral(uuid, uuid, text) to anon, authenticated;
grant execute on function public.atualizar_membership_date_perfil_pastoral(uuid, uuid, date, date) to anon, authenticated;

notify pgrst, 'reload schema';
