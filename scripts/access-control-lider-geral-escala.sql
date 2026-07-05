-- Papel Líder Geral: mesmos privilégios operacionais do Líder, com acesso a TODAS as escalas ativas.
-- Execute no SQL Editor do Supabase após access-control-lider-escala.sql.
-- Depois: Settings → API → Reload schema.

-- ---------------------------------------------------------------------------
-- Papel
-- ---------------------------------------------------------------------------

insert into public.access_roles (code, name, description, is_system)
values (
  'lider_geral',
  'Líder Geral',
  'Gerencia servos e programação de todos os tipos de escala ativos, sem vínculo por tipo',
  true
)
on conflict (code) do update
  set name = excluded.name,
      description = excluded.description,
      is_system = excluded.is_system;

-- Mesmos grants de tela do papel lider.
insert into public.access_grants (role_id, resource_id, can_view, can_update)
select r.id, res.id, g.can_view, g.can_update
  from public.access_roles r
 cross join (
    values
      ('/maintenance-dashboard', true, false),
      ('maintenance.card.scale_volunteers', true, true),
      ('maintenance.card.scales', true, true),
      ('dashboard.card.vigilance_scales', true, false)
  ) as g(resource_key, can_view, can_update)
  join public.access_resources res
    on res.resource_type = 'screen'
   and res.resource_key = g.resource_key
 where r.code = 'lider_geral'
on conflict (role_id, resource_id) where (role_id is not null) do update
  set can_view = excluded.can_view,
      can_update = excluded.can_update,
      updated_at = now();

-- ---------------------------------------------------------------------------
-- Ordem na UI (acima de Líder)
-- ---------------------------------------------------------------------------

create or replace function public.access_role_display_order(p_code text)
returns integer
language sql
immutable
as $$
  select case lower(trim(coalesce(p_code, '')))
    when 'visitantes' then 10
    when 'congregado' then 20
    when 'member' then 30
    when 'family_acceptor' then 40
    when 'lider_geral' then 44
    when 'lider' then 45
    when 'events_admin' then 50
    when 'orquestrador_evento' then 52
    when 'tesoureiro' then 55
    when 'pastoral' then 60
    when 'super_admin' then 70
    else 100
  end;
$$;

-- ---------------------------------------------------------------------------
-- ACL por tipo de escala
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

  if v_action = 'view' and public.profile_is_scale_type_volunteer(p_profile_id, p_tipo_escala_id) then
    return true;
  end if;

  return false;
end;
$$;

grant execute on function public.profile_has_lider_geral_scale_role(uuid) to anon, authenticated;
grant execute on function public.access_role_display_order(text) to anon, authenticated;
grant execute on function public.profile_has_scale_type_access(uuid, uuid, text) to anon, authenticated;

notify pgrst, 'reload schema';
