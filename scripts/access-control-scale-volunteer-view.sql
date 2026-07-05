-- Servos escalados (voluntarios_escala) passam a ver os tipos de escala no card Escalas.
-- Execute no Supabase após access-control-lider-escala.sql e access-control-pastoral-intercessao.sql
-- (usa normalize_person_name). Depois: Settings → API → Reload schema.

-- ---------------------------------------------------------------------------
-- Helpers de vínculo perfil ↔ nome do servo
-- ---------------------------------------------------------------------------

create or replace function public.profile_voluntario_name_matches_profile(
  p_voluntario_nome text,
  p_profile_full_name text
)
returns boolean
language sql
immutable
as $$
  select
    nullif(trim(p_profile_full_name), '') is not null
    and nullif(trim(p_voluntario_nome), '') is not null
    and (
      public.normalize_person_name(p_voluntario_nome) = public.normalize_person_name(p_profile_full_name)
      or public.normalize_person_name(p_voluntario_nome) = public.normalize_person_name(
        split_part(trim(p_profile_full_name), ' ', 1)
        || ' '
        || reverse(split_part(reverse(trim(p_profile_full_name)), ' ', 1))
      )
    );
$$;

create or replace function public.profile_is_scale_type_volunteer(
  p_profile_id uuid,
  p_tipo_escala_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.profiles p
      join public.voluntarios_escala ve
        on ve.tipo_escala_id = p_tipo_escala_id
       and ve.is_ativo = true
       and public.profile_voluntario_name_matches_profile(ve.nome, p.full_name)
      join public.tipos_escala te
        on te.id = ve.tipo_escala_id
       and te.is_ativa = true
     where p.id = p_profile_id
  );
$$;

-- ---------------------------------------------------------------------------
-- ACL: view para servos vinculados ao tipo (não só líderes / grants explícitos)
-- ---------------------------------------------------------------------------

create or replace function public.profile_has_lider_geral_scale_role(p_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.profile_access_roles par
      join public.access_roles ar on ar.id = par.role_id
     where par.profile_id = p_profile_id
       and ar.code = 'lider_geral'
  );
$$;

create or replace function public.profile_has_scale_type_access(
  p_profile_id uuid,
  p_tipo_escala_id uuid,
  p_action text default 'view'
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_codigo text;
  v_resource_key text;
  v_action text;
begin
  v_action := lower(trim(coalesce(p_action, 'view')));

  if v_action not in ('view', 'update') then
    return false;
  end if;

  if p_profile_id is null or p_tipo_escala_id is null then
    return false;
  end if;

  if public.is_super_admin_profile(p_profile_id) then
    return true;
  end if;

  if public.profile_has_access(p_profile_id, 'screen', 'maintenance.card.scale_types', v_action) then
    return true;
  end if;

  select te.codigo
    into v_codigo
    from public.tipos_escala te
   where te.id = p_tipo_escala_id
     and te.is_ativa = true;

  if v_codigo is null then
    return false;
  end if;

  if public.profile_has_lider_geral_scale_role(p_profile_id) then
    return true;
  end if;

  v_resource_key := public.scale_type_resource_key(v_codigo);

  if public.profile_has_access(p_profile_id, 'screen', v_resource_key, v_action) then
    return true;
  end if;

  if exists (
    select 1
      from public.profile_scale_leadership psl
     where psl.profile_id = p_profile_id
       and psl.tipo_escala_id = p_tipo_escala_id
  ) then
    if v_action = 'view' then
      return true;
    end if;

    return exists (
      select 1
        from public.profile_access_roles par
        join public.access_roles ar on ar.id = par.role_id
       where par.profile_id = p_profile_id
         and ar.code = 'lider'
    );
  end if;

  -- Líder (não geral): só tipos com liderança atribuída; não herda view de servo escalado.
  if exists (
    select 1
      from public.profile_access_roles par
      join public.access_roles ar on ar.id = par.role_id
     where par.profile_id = p_profile_id
       and ar.code = 'lider'
  ) then
    return false;
  end if;

  if v_action = 'view' and public.profile_is_scale_type_volunteer(p_profile_id, p_tipo_escala_id) then
    return true;
  end if;

  return false;
end;
$$;

grant execute on function public.profile_has_lider_geral_scale_role(uuid) to anon, authenticated;
grant execute on function public.profile_voluntario_name_matches_profile(text, text) to anon, authenticated;
grant execute on function public.profile_is_scale_type_volunteer(uuid, uuid) to anon, authenticated;
grant execute on function public.profile_has_scale_type_access(uuid, uuid, text) to anon, authenticated;

notify pgrst, 'reload schema';
