-- =============================================================================
-- Papel: Gestor em Controle de Acesso (`gestor_controle_acesso`)
-- =============================================================================
-- Execute no SQL Editor do Supabase APÓS:
--   access-control-schema.sql, access-control-admin-rpc.sql,
--   access-control-security-hardening.sql, access-control-ghost-mode.sql
--   (e demais scripts de cards já aplicados no ambiente).
-- Depois: Settings → API → Reload schema.
--
-- Autonomia operacional (leitura/gravação) nos módulos listados abaixo.
-- Blindagem absoluta do Super Administrador e bloqueio de PIN/senha.
-- Camada de verificação (security middleware em SQL): helpers + asserts
-- em todas as RPCs de gestão de usuários / papéis / logs.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1) Papel + recursos
-- ---------------------------------------------------------------------------

insert into public.access_roles (code, name, description, is_system)
values (
  'gestor_controle_acesso',
  'Gestor em Controle de Acesso',
  'Gestão operacional de eventos, escalas, presença, cadastro/recepção, salas, avisos, relatórios e ACL — sem visibilidade do Super Administrador',
  true
)
on conflict (code) do update
  set name = excluded.name,
      description = excluded.description,
      is_system = true;

insert into public.access_resources (resource_type, resource_key, label, description, is_active)
values
  ('screen', '/maintenance-dashboard', 'Manutenção do sistema', null, true),
  ('screen', 'maintenance.card.events', 'Manutenção — Programação de eventos', null, true),
  ('screen', 'maintenance.card.events_gantt', 'Manutenção — Cronograma de eventos', null, true),
  ('screen', 'maintenance.card.sala_servidor', 'Manutenção — Sala do servidor', null, true),
  ('screen', 'maintenance.card.quorum_presence', 'Manutenção — Presença / Quórum', null, true),
  ('screen', 'maintenance.card.scale_types', 'Manutenção — Tipos de escala', null, true),
  ('screen', 'maintenance.card.scale_volunteers', 'Manutenção — Voluntários / Servos', null, true),
  ('screen', 'maintenance.card.scales', 'Manutenção — Escalas / Disponibilidade', null, true),
  ('screen', 'maintenance.card.predictive_insights', 'Manutenção — Insights preditivos', null, true),
  ('screen', 'maintenance.card.relatorios', 'Manutenção — Relatórios', null, true),
  ('screen', 'maintenance.card.profile_cadastro', 'Manutenção — Cadastro / Recepção familiar', null, true),
  ('screen', 'maintenance.card.access_control', 'Manutenção — Controle de Acesso', null, true),
  ('screen', 'maintenance.card.profile_access_insights', 'Manutenção — Insights de acesso', null, true),
  ('screen', 'maintenance.card.mudanca_papeis', 'Manutenção — Mudança de papéis', null, true),
  ('screen', 'maintenance.card.event_orchestration', 'Manutenção — Orquestração / Avisos', null, true),
  ('screen', '/configuracao-salas', 'Configuração de salas', null, true),
  ('screen', '/redes-sociais', 'Redes Sociais', null, true),
  ('screen', 'menu_redes_sociais', 'Menu — Redes Sociais', null, true),
  ('table', 'events', 'Eventos', null, true),
  ('table', 'event_registrations', 'Inscrições em eventos', null, true),
  ('table', 'event_avisos', 'Avisos de eventos', null, true),
  ('table', 'church_room_settings', 'Configuração de salas', null, true),
  ('table', 'user_room_assignment', 'Atribuição de salas', null, true),
  ('table', 'scales', 'Escalas', null, true),
  ('table', 'scale_types', 'Tipos de escala', null, true),
  ('table', 'scale_volunteers', 'Voluntários de escala', null, true)
on conflict (resource_type, resource_key) do update
  set label = coalesce(excluded.label, public.access_resources.label),
      description = coalesce(excluded.description, public.access_resources.description),
      is_active = true;

-- Grants operacionais do Gestor (não inclui Ghost/Auditor, nem wildcards, nem PIN).
insert into public.access_grants (role_id, resource_id, can_view, can_update)
select r.id, res.id, g.can_view, g.can_update
  from public.access_roles r
 cross join (
    values
      ('screen', '/maintenance-dashboard', true, true),
      ('screen', 'maintenance.card.events', true, true),
      ('screen', 'maintenance.card.events_gantt', true, true),
      ('screen', 'maintenance.card.sala_servidor', true, true),
      ('screen', 'maintenance.card.quorum_presence', true, true),
      ('screen', 'maintenance.card.scale_types', true, true),
      ('screen', 'maintenance.card.scale_volunteers', true, true),
      ('screen', 'maintenance.card.scales', true, true),
      ('screen', 'maintenance.card.predictive_insights', true, true),
      ('screen', 'maintenance.card.relatorios', true, true),
      ('screen', 'maintenance.card.profile_cadastro', true, true),
      ('screen', 'maintenance.card.access_control', true, true),
      ('screen', 'maintenance.card.profile_access_insights', true, true),
      ('screen', 'maintenance.card.mudanca_papeis', true, true),
      ('screen', 'maintenance.card.event_orchestration', true, true),
      ('screen', '/configuracao-salas', true, true),
      ('screen', '/redes-sociais', true, true),
      ('screen', 'menu_redes_sociais', true, false),
      ('table', 'events', true, true),
      ('table', 'event_registrations', true, true),
      ('table', 'event_avisos', true, true),
      ('table', 'church_room_settings', true, true),
      ('table', 'user_room_assignment', true, true),
      ('table', 'scales', true, true),
      ('table', 'scale_types', true, true),
      ('table', 'scale_volunteers', true, true)
  ) as g(resource_type, resource_key, can_view, can_update)
  join public.access_resources res
    on res.resource_type = g.resource_type
   and res.resource_key = g.resource_key
 where r.code = 'gestor_controle_acesso'
on conflict (role_id, resource_id) where (role_id is not null) do update
  set can_view = excluded.can_view,
      can_update = excluded.can_update,
      updated_at = now();

-- Blindagem: Gestor NÃO recebe grant de PIN/senha (mesmo se recurso existir).
delete from public.access_grants g
 using public.access_roles ar, public.access_resources res
 where g.role_id = ar.id
   and g.resource_id = res.id
   and ar.code = 'gestor_controle_acesso'
   and res.resource_type = 'column'
   and (
     res.resource_key ilike '%access_pin%'
     or res.resource_key ilike '%password%'
     or res.resource_key ilike '%senha%'
   );

-- ---------------------------------------------------------------------------
-- 2) Security middleware (camada SQL)
-- ---------------------------------------------------------------------------

create table if not exists public.gestor_acesso_proibido_log (
  id uuid primary key default gen_random_uuid(),
  actor_profile_id uuid null references public.profiles (id) on delete set null,
  target_profile_id uuid null references public.profiles (id) on delete set null,
  role_code text null,
  action text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists gestor_acesso_proibido_log_created_idx
  on public.gestor_acesso_proibido_log (created_at desc);

create index if not exists gestor_acesso_proibido_log_actor_idx
  on public.gestor_acesso_proibido_log (actor_profile_id, created_at desc);

alter table public.gestor_acesso_proibido_log enable row level security;

drop policy if exists gestor_acesso_proibido_log_select_sa on public.gestor_acesso_proibido_log;
create policy gestor_acesso_proibido_log_select_sa
  on public.gestor_acesso_proibido_log
  for select
  using (public.is_super_admin_profile(public.current_session_profile_id()));

create or replace function public.profile_has_role_code(
  p_profile_id uuid,
  p_role_code text
)
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
       and ar.code = lower(trim(coalesce(p_role_code, '')))
  );
$$;

create or replace function public.is_gestor_controle_acesso_profile(p_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.profile_has_role_code(p_profile_id, 'gestor_controle_acesso');
$$;

-- Pode operar o painel Controle de Acesso (SA ou Gestor).
create or replace function public.can_manage_access_control(p_profile_id uuid)
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
      or public.is_gestor_controle_acesso_profile(p_profile_id)
    );
$$;

create or replace function public.log_gestor_acesso_proibido(
  p_actor_profile_id uuid,
  p_target_profile_id uuid,
  p_role_code text,
  p_action text,
  p_details jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.gestor_acesso_proibido_log (
    actor_profile_id,
    target_profile_id,
    role_code,
    action,
    details
  )
  values (
    p_actor_profile_id,
    p_target_profile_id,
    nullif(lower(trim(coalesce(p_role_code, ''))), ''),
    coalesce(nullif(trim(p_action), ''), 'forbidden'),
    coalesce(p_details, '{}'::jsonb)
  );
exception
  when others then
    null;
end;
$$;

-- Middleware: Gestor_Controle_Acesso nunca toca Super Admin (perfil ou papel).
-- Proteção aplicada: Gestor não tem visibilidade do Super Administrador
create or replace function public.assert_gestor_super_admin_shield(
  p_actor_profile_id uuid,
  p_target_profile_id uuid default null,
  p_role_code text default null,
  p_action text default 'access'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_action text;
begin
  if p_actor_profile_id is null then
    raise exception 'Sessão inválida. Saia e entre novamente no aplicativo.';
  end if;

  -- Super Admin não é filtrado por esta blindagem.
  if public.is_super_admin_profile(p_actor_profile_id) then
    return;
  end if;

  if not public.is_gestor_controle_acesso_profile(p_actor_profile_id) then
    return;
  end if;

  v_role := lower(trim(coalesce(p_role_code, '')));
  v_action := coalesce(nullif(trim(p_action), ''), 'access');

  if v_role = 'super_admin' then
    perform public.log_gestor_acesso_proibido(
      p_actor_profile_id,
      p_target_profile_id,
      v_role,
      v_action,
      jsonb_build_object('reason', 'role_super_admin', 'http_status', 403)
    );
    raise exception '403 Forbidden: Gestor em Controle de Acesso não pode gerenciar o papel Super Administrador.';
  end if;

  if p_target_profile_id is not null
     and public.is_super_admin_profile(p_target_profile_id) then
    perform public.log_gestor_acesso_proibido(
      p_actor_profile_id,
      p_target_profile_id,
      v_role,
      v_action,
      jsonb_build_object('reason', 'target_super_admin', 'http_status', 403)
    );
    raise exception '403 Forbidden: Gestor em Controle de Acesso não pode acessar dados do Super Administrador.';
  end if;
end;
$$;

-- Filtro SQL reutilizável: WHERE NOT is_super_admin quando ator é Gestor.
create or replace function public.profile_visible_to_access_actor(
  p_actor_profile_id uuid,
  p_target_profile_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    p_target_profile_id is not null
    and (
      public.is_super_admin_profile(p_actor_profile_id)
      or not public.is_super_admin_profile(p_target_profile_id)
    );
$$;

create or replace function public.assert_access_admin(p_actor_profile_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_actor_profile_id is null then
    raise exception 'Sessão inválida. Saia e entre novamente no aplicativo.';
  end if;

  perform public.assert_actor_matches_session(p_actor_profile_id);

  if public.can_manage_access_control(p_actor_profile_id) then
    return;
  end if;

  raise exception 'Apenas Super Administrador ou Gestor em Controle de Acesso podem gerenciar permissões.';
end;
$$;

-- ---------------------------------------------------------------------------
-- 3) Ordem de exibição do papel
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
    when 'gestor_controle_acesso' then 65
    when 'super_admin' then 70
    else 100
  end;
$$;

-- ---------------------------------------------------------------------------
-- 4) RPCs admin com middleware (listagem / papéis / grants)
-- Proteção aplicada: Gestor não tem visibilidade do Super Administrador
-- ---------------------------------------------------------------------------

create or replace function public.listar_access_roles_admin(p_actor_profile_id uuid)
returns table (
  id uuid,
  code text,
  name text,
  description text,
  is_system boolean
)
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.assert_access_admin(p_actor_profile_id);

  return query
  select
    ar.id,
    ar.code,
    ar.name,
    ar.description,
    ar.is_system
  from public.access_roles ar
  where
    public.is_super_admin_profile(p_actor_profile_id)
    or ar.code <> 'super_admin'
  order by public.access_role_display_order(ar.code), ar.name asc;
end;
$$;

create or replace function public.buscar_perfis_access_admin(
  p_actor_profile_id uuid,
  p_query text,
  p_limit integer default 20
)
returns table (
  id uuid,
  full_name text,
  phone text,
  codigo_membro text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
  v_query text;
  v_digits text;
  v_limit integer;
begin
  perform public.assert_access_admin(p_actor_profile_id);

  v_query := trim(coalesce(p_query, ''));
  v_digits := regexp_replace(v_query, '\D', '', 'g');
  v_limit := greatest(1, least(coalesce(p_limit, 20), 50));

  if char_length(v_query) < 2 then
    return;
  end if;

  return query
  select
    p.id,
    coalesce(p.full_name, '') as full_name,
    coalesce(p.phone, '') as phone,
    coalesce(p.codigo_membro, '') as codigo_membro
  from public.profiles p
  where p.tenant_id = v_tenant
    and coalesce(p.full_name, '') <> ''
    and public.profile_visible_to_access_actor(p_actor_profile_id, p.id)
    and (
      p.full_name ilike '%' || v_query || '%'
      or (
        v_digits <> ''
        and regexp_replace(coalesce(p.phone, ''), '\D', '', 'g') like '%' || v_digits || '%'
      )
      or coalesce(p.codigo_membro, '') ilike '%' || v_query || '%'
    )
  order by p.full_name asc
  limit v_limit;
end;
$$;

create or replace function public.listar_perfis_access_admin(
  p_actor_profile_id uuid,
  p_limit integer default 5000
)
returns table (
  id uuid,
  full_name text,
  phone text,
  codigo_membro text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
  v_limit integer;
begin
  perform public.assert_access_admin(p_actor_profile_id);

  v_limit := greatest(1, least(coalesce(p_limit, 5000), 5000));

  return query
  select
    p.id,
    coalesce(nullif(trim(p.full_name), ''), nullif(trim(p.phone), ''), '(sem nome)') as full_name,
    coalesce(p.phone, '') as phone,
    coalesce(p.codigo_membro, '') as codigo_membro
  from public.profiles p
  where p.tenant_id = v_tenant
    and coalesce(
      nullif(trim(p.full_name), ''),
      nullif(trim(p.phone), ''),
      nullif(trim(p.codigo_membro), '')
    ) is not null
    and public.profile_visible_to_access_actor(p_actor_profile_id, p.id)
  order by p.full_name asc
  limit v_limit;
end;
$$;

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
  -- Proteção aplicada: Gestor não tem visibilidade do Super Administrador
  perform public.assert_gestor_super_admin_shield(
    p_actor_profile_id,
    p_target_profile_id,
    null,
    'list_roles'
  );

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
    and (
      public.is_super_admin_profile(p_actor_profile_id)
      or ar.code <> 'super_admin'
    )
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

  -- Proteção aplicada: Gestor não tem visibilidade do Super Administrador
  begin
    perform public.assert_gestor_super_admin_shield(
      p_actor_profile_id,
      p_target_profile_id,
      v_role_code,
      'assign_role'
    );
  exception
    when others then
      return jsonb_build_object(
        'success', false,
        'http_status', 403,
        'message', SQLERRM
      );
  end;

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
      'O papel visitante é atribuído automaticamente na criação do perfil.'
    );
  end if;

  select ar.id
    into v_role_id
    from public.access_roles ar
   where ar.code = v_role_code;

  if v_role_id is null then
    return jsonb_build_object('success', false, 'message', 'Papel não encontrado.');
  end if;

  perform public.remove_profile_visitantes_role(p_target_profile_id);

  insert into public.profile_access_roles (profile_id, role_id, granted_by_profile_id)
  values (p_target_profile_id, v_role_id, p_actor_profile_id)
  on conflict (profile_id, role_id) do nothing;

  return jsonb_build_object('success', true, 'message', 'Papel atribuído.');
end;
$$;

create or replace function public.revogar_papel_perfil_access_admin(
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
  v_remaining_super_admins integer;
begin
  perform public.assert_access_admin(p_actor_profile_id);

  v_role_code := lower(trim(coalesce(p_role_code, '')));

  -- Proteção aplicada: Gestor não tem visibilidade do Super Administrador
  begin
    perform public.assert_gestor_super_admin_shield(
      p_actor_profile_id,
      p_target_profile_id,
      v_role_code,
      'revoke_role'
    );
  exception
    when others then
      return jsonb_build_object(
        'success', false,
        'http_status', 403,
        'message', SQLERRM
      );
  end;

  if p_target_profile_id is null then
    return jsonb_build_object('success', false, 'message', 'Perfil não informado.');
  end if;

  if v_role_code = '' then
    return jsonb_build_object('success', false, 'message', 'Papel não informado.');
  end if;

  select ar.id
    into v_role_id
    from public.access_roles ar
   where ar.code = v_role_code;

  if v_role_id is null then
    return jsonb_build_object('success', false, 'message', 'Papel não encontrado.');
  end if;

  if v_role_code = 'super_admin' then
    select count(*)::integer
      into v_remaining_super_admins
      from public.profile_access_roles par
      join public.access_roles ar on ar.id = par.role_id
     where ar.code = 'super_admin'
       and par.profile_id <> p_target_profile_id;

    if coalesce(v_remaining_super_admins, 0) = 0 then
      return jsonb_build_object(
        'success', false,
        'message', 'Não é possível remover o último super administrador.'
      );
    end if;
  end if;

  delete from public.profile_access_roles par
   where par.profile_id = p_target_profile_id
     and par.role_id = v_role_id;

  perform public.ensure_profile_visitantes_role(p_target_profile_id, p_actor_profile_id);

  return jsonb_build_object('success', true, 'message', 'Papel removido.');
end;
$$;

create or replace function public.listar_grants_recurso_papel_admin(
  p_actor_profile_id uuid,
  p_role_code text,
  p_resource_type text
)
returns table (
  resource_id uuid,
  resource_type text,
  resource_key text,
  label text,
  can_view boolean,
  can_update boolean,
  grant_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role_code text;
  v_role_id uuid;
  v_resource_type text;
begin
  perform public.assert_access_admin(p_actor_profile_id);

  v_role_code := lower(trim(coalesce(p_role_code, '')));
  v_resource_type := lower(trim(coalesce(p_resource_type, '')));

  -- Proteção aplicada: Gestor não tem visibilidade do Super Administrador
  perform public.assert_gestor_super_admin_shield(
    p_actor_profile_id,
    null,
    v_role_code,
    'list_role_grants'
  );

  if v_role_code = '' then
    raise exception 'Papel não informado.';
  end if;

  if v_resource_type not in ('screen', 'table', 'column') then
    raise exception 'Tipo de recurso inválido.';
  end if;

  select ar.id
    into v_role_id
    from public.access_roles ar
   where ar.code = v_role_code;

  if v_role_id is null then
    raise exception 'Papel não encontrado.';
  end if;

  return query
  select
    res.id as resource_id,
    res.resource_type,
    res.resource_key,
    res.label,
    coalesce(g.can_view, false) as can_view,
    coalesce(g.can_update, false) as can_update,
    g.id as grant_id
  from public.access_resources res
  left join public.access_grants g
    on g.resource_id = res.id
   and g.role_id = v_role_id
 where res.resource_type = v_resource_type
   and res.is_active = true
   and not (
     res.resource_type = 'screen'
     and res.resource_key like 'scale_type.tstmax%'
   )
   -- Gestor: sem recursos de PIN/senha na matriz
   and (
     public.is_super_admin_profile(p_actor_profile_id)
     or not (
       res.resource_type = 'column'
       and (
         res.resource_key ilike '%access_pin%'
         or res.resource_key ilike '%password%'
         or res.resource_key ilike '%senha%'
       )
     )
   )
 order by
   case when res.resource_key = 'maintenance.card.access_control' then 1 else 0 end,
   res.resource_key asc;
end;
$$;

create or replace function public.salvar_grant_papel_admin(
  p_actor_profile_id uuid,
  p_role_code text,
  p_resource_type text,
  p_resource_key text,
  p_can_view boolean,
  p_can_update boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role_code text;
  v_role_id uuid;
  v_resource_type text;
  v_resource_key text;
  v_resource_id uuid;
  v_can_view boolean;
  v_can_update boolean;
begin
  perform public.assert_access_admin(p_actor_profile_id);

  v_role_code := lower(trim(coalesce(p_role_code, '')));
  v_resource_type := lower(trim(coalesce(p_resource_type, '')));
  v_resource_key := trim(coalesce(p_resource_key, ''));
  v_can_view := coalesce(p_can_view, false);
  v_can_update := coalesce(p_can_update, false);

  -- Proteção aplicada: Gestor não tem visibilidade do Super Administrador
  begin
    perform public.assert_gestor_super_admin_shield(
      p_actor_profile_id,
      null,
      v_role_code,
      'save_role_grant'
    );
  exception
    when others then
      return jsonb_build_object(
        'success', false,
        'http_status', 403,
        'message', SQLERRM
      );
  end;

  if v_role_code = '' then
    return jsonb_build_object('success', false, 'message', 'Papel não informado.');
  end if;

  if v_resource_type not in ('screen', 'table', 'column') or v_resource_key = '' then
    return jsonb_build_object('success', false, 'message', 'Recurso inválido.');
  end if;

  -- Bloqueio de PIN/senha para Gestor (mesmo via matriz de grants).
  if not public.is_super_admin_profile(p_actor_profile_id)
     and public.is_gestor_controle_acesso_profile(p_actor_profile_id)
     and v_resource_type = 'column'
     and (
       v_resource_key ilike '%access_pin%'
       or v_resource_key ilike '%password%'
       or v_resource_key ilike '%senha%'
     ) then
    perform public.log_gestor_acesso_proibido(
      p_actor_profile_id,
      null,
      v_role_code,
      'save_pin_grant',
      jsonb_build_object('resource_key', v_resource_key, 'http_status', 403)
    );
    return jsonb_build_object(
      'success', false,
      'http_status', 403,
      'message', '403 Forbidden: Gestor não pode gerenciar PIN/senha.'
    );
  end if;

  if not v_can_view and not v_can_update then
    delete from public.access_grants g
     using public.access_roles ar, public.access_resources res
     where g.role_id = ar.id
       and g.resource_id = res.id
       and ar.code = v_role_code
       and res.resource_type = v_resource_type
       and res.resource_key = v_resource_key;

    return jsonb_build_object('success', true, 'message', 'Permissão removida.');
  end if;

  select ar.id
    into v_role_id
    from public.access_roles ar
   where ar.code = v_role_code;

  if v_role_id is null then
    return jsonb_build_object('success', false, 'message', 'Papel não encontrado.');
  end if;

  select res.id
    into v_resource_id
    from public.access_resources res
   where res.resource_type = v_resource_type
     and res.resource_key = v_resource_key
     and res.is_active = true;

  if v_resource_id is null then
    return jsonb_build_object('success', false, 'message', 'Recurso não encontrado.');
  end if;

  insert into public.access_grants (role_id, resource_id, can_view, can_update)
  values (v_role_id, v_resource_id, v_can_view, v_can_update)
  on conflict (role_id, resource_id) where (role_id is not null) do update
    set can_view = excluded.can_view,
        can_update = excluded.can_update,
        updated_at = now();

  return jsonb_build_object('success', true, 'message', 'Permissão salva.');
end;
$$;

create or replace function public.garantir_recurso_controle_acesso_admin(p_actor_profile_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.assert_access_admin(p_actor_profile_id);

  insert into public.access_resources (resource_type, resource_key, label, description, is_active)
  values
    (
      'screen',
      'maintenance.card.access_control',
      'Controle de Acesso',
      'Card de manutenção para gerenciar papéis e permissões (Super Admin / Gestor)',
      true
    )
  on conflict (resource_type, resource_key) do update
    set label = excluded.label,
        description = excluded.description,
        is_active = true;

  insert into public.access_grants (role_id, resource_id, can_view, can_update)
  select r.id, res.id, true, true
    from public.access_roles r
    join public.access_resources res
      on res.resource_type = 'screen'
     and res.resource_key = 'maintenance.card.access_control'
   where r.code in ('super_admin', 'gestor_controle_acesso')
  on conflict (role_id, resource_id) where (role_id is not null) do update
    set can_view = excluded.can_view,
        can_update = excluded.can_update,
        updated_at = now();

  return jsonb_build_object('success', true, 'message', 'Recurso Controle de Acesso sincronizado.');
end;
$$;

-- ---------------------------------------------------------------------------
-- 5) Insights de acesso — excluir Super Admin para o Gestor
-- Proteção aplicada: Gestor não tem visibilidade do Super Administrador
-- ---------------------------------------------------------------------------

create or replace function public.list_profile_access_insights_admin(
  p_actor_profile_id uuid
)
returns table (
  profile_id uuid,
  full_name text,
  last_access_at timestamptz,
  access_count bigint
)
language plpgsql
security definer
set search_path = public
as $list_profile_access_insights_admin$
declare
  v_tenant uuid := public.require_session_tenant_id();
begin
  perform public.assert_access_admin(p_actor_profile_id);
  -- Proteção aplicada: Gestor não tem visibilidade do Super Administrador

  return query
  select
    p.id as profile_id,
    p.full_name,
    max(e.accessed_at) as last_access_at,
    count(e.id)::bigint as access_count
  from public.profiles p
  inner join public.profile_app_access_events e on e.profile_id = p.id
  where p.tenant_id = v_tenant
    and coalesce(trim(p.full_name), '') <> ''
    and lower(trim(p.full_name)) <> 'visitante'
    and public.profile_visible_to_access_actor(p_actor_profile_id, p.id)
  group by p.id, p.full_name
  having count(e.id) > 0
  order by max(e.accessed_at) desc, p.full_name asc;
end;
$list_profile_access_insights_admin$;

create or replace function public.list_profile_access_screen_visits_admin(
  p_actor_profile_id uuid,
  p_target_profile_id uuid
)
returns table (
  access_event_id uuid,
  accessed_at timestamptz,
  screen_key text,
  screen_label text,
  visited_at timestamptz,
  visit_order integer
)
language plpgsql
security definer
set search_path = public
as $list_profile_access_screen_visits_admin$
declare
  v_tenant uuid := public.require_session_tenant_id();
begin
  perform public.assert_access_admin(p_actor_profile_id);
  -- Proteção aplicada: Gestor não tem visibilidade do Super Administrador
  perform public.assert_gestor_super_admin_shield(
    p_actor_profile_id,
    p_target_profile_id,
    null,
    'list_access_screen_visits'
  );

  if p_target_profile_id is null then
    return;
  end if;

  if not exists (
    select 1
      from public.profiles p
     where p.id = p_target_profile_id
       and p.tenant_id = v_tenant
       and public.profile_visible_to_access_actor(p_actor_profile_id, p.id)
  ) then
    return;
  end if;

  return query
  select
    e.id as access_event_id,
    e.accessed_at,
    sv.screen_key,
    sv.screen_label,
    sv.visited_at,
    sv.visit_order
  from public.profile_app_access_events e
  left join public.profile_app_access_screen_visits sv
    on sv.access_event_id = e.id
   and sv.screen_label not in ('Dashboard', 'Manutenção')
   and sv.screen_key not in ('/dashboard', '/maintenance-dashboard')
  where e.profile_id = p_target_profile_id
  order by e.accessed_at desc, sv.visit_order asc nulls last;
end;
$list_profile_access_screen_visits_admin$;

-- Limpeza total do histórico: apenas Super Admin (não o Gestor).
create or replace function public.clear_profile_access_insights_admin(
  p_actor_profile_id uuid
)
returns bigint
language plpgsql
security definer
set search_path = public
as $clear_profile_access_insights_admin$
declare
  cnt_before bigint;
  cnt_after bigint;
begin
  if p_actor_profile_id is null
     or not public.is_super_admin_profile(p_actor_profile_id) then
    perform public.log_gestor_acesso_proibido(
      p_actor_profile_id,
      null,
      null,
      'clear_access_insights',
      jsonb_build_object('http_status', 403)
    );
    raise exception '403 Forbidden: Apenas Super Administrador pode limpar o histórico de acessos.';
  end if;

  select count(*)::bigint into cnt_before from public.profile_app_access_events;

  truncate table
    public.profile_app_access_screen_visits,
    public.profile_app_access_events
  restart identity;

  select count(*)::bigint into cnt_after from public.profile_app_access_events;

  if cnt_after > 0 then
    raise exception 'Falha ao limpar profile_app_access_events (% registros restantes).', cnt_after;
  end if;

  return coalesce(cnt_before, 0);
end;
$clear_profile_access_insights_admin$;

-- ---------------------------------------------------------------------------
-- 6) Configuração de salas — Gestor autorizado
-- ---------------------------------------------------------------------------

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
     or public.profile_has_role_code(p_actor, 'events_admin')
     or public.profile_has_role_code(p_actor, 'lider')
     or public.profile_has_role_code(p_actor, 'lider_geral')
     or public.profile_has_access(p_actor, 'screen', '/configuracao-salas', 'view') then
    return;
  end if;

  raise exception 'Apenas Líder, Administrador ou Gestor em Controle de Acesso pode gerenciar salas.';
end;
$$;

-- ---------------------------------------------------------------------------
-- 7) Grants
-- ---------------------------------------------------------------------------

grant execute on function public.profile_has_role_code(uuid, text) to anon, authenticated;
grant execute on function public.is_gestor_controle_acesso_profile(uuid) to anon, authenticated;
grant execute on function public.can_manage_access_control(uuid) to anon, authenticated;
grant execute on function public.log_gestor_acesso_proibido(uuid, uuid, text, text, jsonb) to anon, authenticated;
grant execute on function public.assert_gestor_super_admin_shield(uuid, uuid, text, text) to anon, authenticated;
grant execute on function public.profile_visible_to_access_actor(uuid, uuid) to anon, authenticated;
grant execute on function public.assert_access_admin(uuid) to anon, authenticated;
grant execute on function public.access_role_display_order(text) to anon, authenticated;

notify pgrst, 'reload schema';
