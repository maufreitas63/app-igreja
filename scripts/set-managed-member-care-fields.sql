-- Gerenciar Família: grava/limpa campos de cuidado no perfil do integrante.
-- Necessário porque RLS de profiles só permite UPDATE no próprio perfil
-- (supabase.from('profiles').update silencia 0 linhas).

create or replace function public.set_managed_member_care_fields(
  p_profile_id uuid,
  p_medical_food_alerts text default null,
  p_additional_care_notes text default null,
  p_special_needs text default null,
  p_member_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
  v_actor uuid := public.current_session_profile_id();
  v_profile_id uuid := p_profile_id;
  v_target_family text;
  v_actor_family text;
  v_can_manage boolean := false;
begin
  if v_actor is null then
    return jsonb_build_object('success', false, 'message', 'Sessão inválida.');
  end if;

  if v_profile_id is null and p_member_id is not null then
    select public.find_profile_id_for_member_sync(m.phone, m.full_name)
      into v_profile_id
      from public.members m
     where m.id = p_member_id
       and m.tenant_id = v_tenant;
  end if;

  if v_profile_id is null then
    return jsonb_build_object(
      'success', false,
      'message', 'Perfil do integrante não encontrado para gravar os cuidados.'
    );
  end if;

  select nullif(upper(trim(coalesce(p.family_id, p.codigo_membro, ''))), '')
    into v_target_family
    from public.profiles p
   where p.id = v_profile_id
     and p.tenant_id = v_tenant;

  if v_target_family is null then
    return jsonb_build_object(
      'success', false,
      'message', 'Perfil sem família no tenant atual.'
    );
  end if;

  select nullif(upper(trim(coalesce(p.family_id, p.codigo_membro, ''))), '')
    into v_actor_family
    from public.profiles p
   where p.id = v_actor
     and p.tenant_id = v_tenant;

  v_can_manage :=
    (v_actor_family is not null and v_actor_family = v_target_family)
    or public.profile_has_access(v_actor, 'table', '*', 'update');

  if not v_can_manage then
    return jsonb_build_object(
      'success', false,
      'message', 'Sem permissão para alterar cuidados deste integrante.'
    );
  end if;

  update public.profiles p
     set medical_food_alerts = nullif(trim(coalesce(p_medical_food_alerts, '')), ''),
         additional_care_notes = nullif(trim(coalesce(p_additional_care_notes, '')), ''),
         special_needs = nullif(trim(coalesce(p_special_needs, '')), ''),
         updated_at = now()
   where p.id = v_profile_id
     and p.tenant_id = v_tenant;

  if not found then
    return jsonb_build_object(
      'success', false,
      'message', 'Não foi possível atualizar o perfil.'
    );
  end if;

  return jsonb_build_object(
    'success', true,
    'profile_id', v_profile_id,
    'medical_food_alerts', nullif(trim(coalesce(p_medical_food_alerts, '')), ''),
    'additional_care_notes', nullif(trim(coalesce(p_additional_care_notes, '')), ''),
    'special_needs', nullif(trim(coalesce(p_special_needs, '')), '')
  );
end;
$$;

grant execute on function public.set_managed_member_care_fields(uuid, text, text, text, uuid)
  to anon, authenticated;

notify pgrst, 'reload schema';
