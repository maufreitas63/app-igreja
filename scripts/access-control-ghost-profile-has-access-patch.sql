-- Patch: Modo Ghost — profile_has_access avalia ACL do alvo do header.
-- Execute no SQL Editor do Supabase APÓS access-control-ghost-mode.sql.
-- Motivo: com Ghost ativo no app, o bypass de SA do operador é desligado.
-- Se a sessão efetiva não virar o alvo (header) e o operador não for SA,
-- profile_has_access negava p_profile_id ≠ sessão → menu só Início/Redes Sociais.

create or replace function public.profile_has_access(
  p_profile_id uuid,
  p_resource_type text,
  p_resource_key text,
  p_action text
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_type text;
  v_key text;
  v_action text;
  v_acl_enabled boolean;
  v_allowed boolean;
  v_has_roles boolean;
  v_session uuid;
  v_real uuid;
  v_ghost_header uuid;
begin
  v_type := lower(trim(coalesce(p_resource_type, '')));
  v_key := trim(coalesce(p_resource_key, ''));
  v_action := lower(trim(coalesce(p_action, '')));

  if v_type not in ('screen', 'table', 'column') or v_key = '' then
    return false;
  end if;

  if v_action not in ('view', 'update') then
    return false;
  end if;

  v_session := public.current_session_profile_id();
  v_real := public.current_real_session_profile_id();
  v_ghost_header := public.current_ghost_profile_id_from_header();

  -- Super admin da sessão efetiva (alvo no Ghost, se a troca funcionou).
  if v_session is not null and public.is_super_admin_profile(v_session) then
    return true;
  end if;

  -- Operador autorizado em Ghost consultando o perfil do header:
  -- usar avaliação pura de grants do alvo (sem herdar SA do operador).
  if v_ghost_header is not null
     and p_profile_id is not null
     and p_profile_id = v_ghost_header
     and v_real is not null
     and public.can_operate_ghost_mode(v_real) then
    return public.evaluate_profile_resource_access(
      p_profile_id,
      v_type,
      v_key,
      v_action
    );
  end if;

  if p_profile_id is not null
     and v_session is not null
     and p_profile_id <> v_session
     and not public.is_super_admin_profile(v_session) then
    return false;
  end if;

  select exists (select 1 from public.access_grants limit 1)
    into v_acl_enabled;

  if not v_acl_enabled then
    return false;
  end if;

  if p_profile_id is null then
    return public.role_has_access('visitantes', v_type, v_key, v_action);
  end if;

  select exists (
    select 1
      from public.access_grants g
      join public.access_resources r on r.id = g.resource_id
     where r.resource_type = v_type
       and r.is_active = true
       and public.access_resource_matches(r.resource_key, v_key)
       and (
         (v_action = 'view' and g.can_view)
         or (v_action = 'update' and g.can_update)
       )
       and (
         g.profile_id = p_profile_id
         or g.role_id in (
           select par.role_id
             from public.profile_access_roles par
            where par.profile_id = p_profile_id
         )
       )
  )
    into v_allowed;

  if coalesce(v_allowed, false) then
    return true;
  end if;

  select exists (
    select 1
      from public.profile_access_roles par
     where par.profile_id = p_profile_id
  )
    into v_has_roles;

  if not coalesce(v_has_roles, false) then
    return public.role_has_access('visitantes', v_type, v_key, v_action);
  end if;

  return false;
end;
$$;

notify pgrst, 'reload schema';
