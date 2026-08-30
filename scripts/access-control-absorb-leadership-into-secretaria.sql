-- Absorve Administrador de Eventos, Orquestrador de Evento, Líder e Líder Geral
-- no papel Secretaria e em seguida exclui os quatro papéis.
-- Cuidado Pastoral e tesouraria global continuam fora da Secretaria.
-- Super Admin não é alterado.
--
-- Isolamento por tenant_id permanece nas RPCs/RLS (sem curinga `*`).

-- ---------------------------------------------------------------------------
-- 1) Secretaria passa a reunir os grants operacionais dos quatro papéis
-- ---------------------------------------------------------------------------

update public.access_roles
   set description = 'Operação da igreja: eventos, orquestração, escalas, salas, totem, células, recepção, avisos, trilha (temas), murais e campanhas. Sem Cuidado Pastoral nem tesouraria global.',
       name = 'Secretaria',
       is_system = true
 where code = 'secretaria';

insert into public.access_grants (role_id, resource_id, can_view, can_update)
select sec.id, src.resource_id, src.can_view, src.can_update
  from public.access_roles sec
  join (
    select
      ag.resource_id,
      bool_or(ag.can_view) as can_view,
      bool_or(ag.can_update) as can_update
      from public.access_grants ag
      join public.access_roles ar on ar.id = ag.role_id
      join public.access_resources res on res.id = ag.resource_id
     where ar.code in ('events_admin', 'orquestrador_evento', 'lider', 'lider_geral')
       and ag.role_id is not null
       and not (
         (res.resource_type = 'screen' and res.resource_key in (
           'maintenance.card.pastoral_care',
           'maintenance.pastoral.agenda',
           'maintenance.card.financials',
           'maintenance.card.predictive_insights',
           '/financial',
           'dashboard.card.financial',
           'maintenance.card.access_control',
           'maintenance.card.auditor',
           'maintenance.card.mudanca_papeis'
         ))
         or (res.resource_type = 'table' and res.resource_key = 'financials')
       )
     group by ag.resource_id
  ) src on true
 where sec.code = 'secretaria'
on conflict (role_id, resource_id) where (role_id is not null) do update
  set can_view = public.access_grants.can_view or excluded.can_view,
      can_update = public.access_grants.can_update or excluded.can_update,
      updated_at = now();

-- ---------------------------------------------------------------------------
-- 2) Quem tinha um dos quatro papéis passa a ter Secretaria
-- ---------------------------------------------------------------------------

insert into public.profile_access_roles (profile_id, role_id, tenant_id, granted_by_profile_id)
select distinct on (par.profile_id)
       par.profile_id,
       sec.id,
       par.tenant_id,
       par.granted_by_profile_id
  from public.profile_access_roles par
  join public.access_roles ar on ar.id = par.role_id
  join public.access_roles sec on sec.code = 'secretaria'
 where ar.code in ('events_admin', 'orquestrador_evento', 'lider', 'lider_geral')
on conflict (profile_id, role_id) do nothing;

-- ---------------------------------------------------------------------------
-- 3) Funções SQL: atalhos de papel apontam para Secretaria
-- ---------------------------------------------------------------------------

create or replace function public.profile_has_lider_geral_scale_role(p_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  -- Nome histórico (Líder Geral). Acesso pleno a tipos de escala = Secretaria.
  select exists (
    select 1
      from public.profile_access_roles par
      join public.access_roles ar on ar.id = par.role_id
     where par.profile_id = p_profile_id
       and ar.code = 'secretaria'
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
    return true;
  end if;

  if v_action = 'view' and public.profile_is_scale_type_volunteer(p_profile_id, p_tipo_escala_id) then
    return true;
  end if;

  return false;
end;
$$;

create or replace function public.profile_is_event_control_admin(p_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_super_admin_profile(p_profile_id)
    or public.profile_has_role_code(p_profile_id, 'secretaria')
    or public.profile_has_access(p_profile_id, 'screen', 'maintenance.card.event_orchestration', 'update');
$$;

create or replace function public.profile_can_manage_event_control(p_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.profile_is_event_control_admin(p_profile_id);
$$;

create or replace function public.assert_church_room_manager(p_actor uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_actor is null then
    raise exception 'Sessão inválida. Saia e entre novamente.';
  end if;

  if public.is_super_admin_profile(p_actor) then
    return;
  end if;

  if public.profile_has_role_code(p_actor, 'gestor_controle_acesso')
     or public.profile_has_role_code(p_actor, 'secretaria')
     or public.profile_has_access(p_actor, 'screen', '/configuracao-salas', 'view') then
    return;
  end if;

  raise exception 'Apenas Secretaria, Gestor em Controle de Acesso ou Super Administrador pode gerenciar salas.';
end;
$$;

create or replace function public.is_small_group_operator(p_actor uuid, p_group_id uuid default null)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_tenant uuid;
begin
  if p_actor is null then
    return false;
  end if;

  if public.is_super_admin_profile(p_actor) then
    return true;
  end if;

  if public.profile_has_access(p_actor, 'screen', 'maintenance.card.small_groups_management', 'update')
     or public.profile_has_role_code(p_actor, 'pastoral')
     or public.profile_has_role_code(p_actor, 'secretaria')
  then
    return true;
  end if;

  if p_group_id is null then
    return public.profile_has_access(
      p_actor, 'screen', 'maintenance.card.small_groups_management', 'view'
    );
  end if;

  v_tenant := public.current_session_tenant_id();

  return exists (
    select 1
      from public.small_groups g
     where g.id = p_group_id
       and g.is_active
       and (v_tenant is null or g.tenant_id = v_tenant)
       and (g.leader_profile_id = p_actor or g.host_profile_id = p_actor)
  );
end;
$$;

create or replace function public.can_admin_small_groups(p_actor uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    p_actor is not null
    and (
      public.is_super_admin_profile(p_actor)
      or public.profile_has_access(p_actor, 'screen', 'maintenance.card.small_groups_management', 'update')
      or public.profile_has_role_code(p_actor, 'pastoral')
      or public.profile_has_role_code(p_actor, 'secretaria')
    ),
    false
  );
$$;

create or replace function public.can_manage_discipleship_trail(p_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    p_profile_id is not null
    and (
      public.is_super_admin_profile(p_profile_id)
      or public.profile_has_role_code(p_profile_id, 'pastoral')
      or public.profile_has_role_code(p_profile_id, 'secretaria')
      or public.profile_has_access(p_profile_id, 'screen', 'maintenance.card.discipleship_themes', 'update')
    );
$$;

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
    when 'secretaria' then 50
    when 'tesoureiro' then 55
    when 'pastoral' then 60
    when 'gestor_controle_acesso' then 65
    when 'super_admin' then 70
    else 100
  end;
$$;

grant execute on function public.profile_has_lider_geral_scale_role(uuid) to anon, authenticated;
grant execute on function public.profile_has_scale_type_access(uuid, uuid, text) to anon, authenticated;
grant execute on function public.profile_is_event_control_admin(uuid) to anon, authenticated;
grant execute on function public.profile_can_manage_event_control(uuid) to anon, authenticated;
grant execute on function public.assert_church_room_manager(uuid) to anon, authenticated;
grant execute on function public.is_small_group_operator(uuid, uuid) to anon, authenticated;
grant execute on function public.can_admin_small_groups(uuid) to anon, authenticated;
grant execute on function public.can_manage_discipleship_trail(uuid) to anon, authenticated;
grant execute on function public.access_role_display_order(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4) Remove atribuições, grants e os quatro papéis
-- ---------------------------------------------------------------------------

delete from public.profile_access_roles par
 using public.access_roles ar
 where par.role_id = ar.id
   and ar.code in ('events_admin', 'orquestrador_evento', 'lider', 'lider_geral');

delete from public.access_grants ag
 using public.access_roles ar
 where ag.role_id = ar.id
   and ar.code in ('events_admin', 'orquestrador_evento', 'lider', 'lider_geral');

delete from public.access_roles
 where code in ('events_admin', 'orquestrador_evento', 'lider', 'lider_geral');

notify pgrst, 'reload schema';
