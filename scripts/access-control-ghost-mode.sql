-- Modo Ghost: simulação de identidade para auditoria de permissões.
-- Execute no SQL Editor do Supabase APÓS:
--   1. profile-sessions.sql
--   2. access-control-security-hardening.sql
--
-- Depois: Settings → API → Reload schema.

-- ---------------------------------------------------------------------------
-- Recurso ACL do card de auditoria
-- ---------------------------------------------------------------------------

insert into public.access_resources (resource_type, resource_key, label, description, is_active)
values
  (
    'screen',
    'maintenance.card.auditor',
    'Modo Ghost (Auditor)',
    'Card de manutenção para simular a sessão de outro usuário (super_admin ou grant explícito)',
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
   and res.resource_key = 'maintenance.card.auditor'
 where r.code = 'super_admin'
on conflict (role_id, resource_id) where (role_id is not null) do update
  set can_view = excluded.can_view,
      can_update = excluded.can_update,
      updated_at = now();

-- ---------------------------------------------------------------------------
-- Auditoria
-- ---------------------------------------------------------------------------

create table if not exists public.ghost_mode_audit_log (
  id uuid primary key default gen_random_uuid(),
  operator_profile_id uuid not null references public.profiles (id) on delete cascade,
  target_profile_id uuid null references public.profiles (id) on delete set null,
  event_type text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint ghost_mode_audit_log_event_type_check
    check (event_type in ('started', 'ended', 'rpc_action'))
);

create index if not exists ghost_mode_audit_log_operator_created_idx
  on public.ghost_mode_audit_log (operator_profile_id, created_at desc);

alter table public.ghost_mode_audit_log enable row level security;

-- ---------------------------------------------------------------------------
-- Sessão real vs efetiva (ghost)
-- ---------------------------------------------------------------------------

create or replace function public.current_real_session_profile_id()
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_headers text;
  v_token text;
  v_raw text;
  v_profile_id uuid;
begin
  begin
    v_headers := current_setting('request.headers', true);
  exception
    when others then
      return null;
  end;

  if v_headers is null or v_headers = '' then
    return null;
  end if;

  v_token := nullif(trim(coalesce((v_headers::json ->> 'x-session-token'), '')), '');

  if v_token is not null then
    v_profile_id := public.resolve_profile_session_token(v_token);

    if v_profile_id is not null then
      return v_profile_id;
    end if;

    return null;
  end if;

  v_raw := nullif(trim(coalesce((v_headers::json ->> 'x-profile-id'), '')), '');

  if v_raw is null then
    return null;
  end if;

  begin
    return v_raw::uuid;
  exception
    when invalid_text_representation then
      return null;
  end;
end;
$$;

create or replace function public.current_ghost_profile_id_from_header()
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_headers text;
  v_raw text;
begin
  begin
    v_headers := current_setting('request.headers', true);
  exception
    when others then
      return null;
  end;

  if v_headers is null or v_headers = '' then
    return null;
  end if;

  v_raw := nullif(trim(coalesce((v_headers::json ->> 'x-ghost-profile-id'), '')), '');

  if v_raw is null then
    return null;
  end if;

  begin
    return v_raw::uuid;
  exception
    when invalid_text_representation then
      return null;
  end;
end;
$$;

create or replace function public.profile_has_super_admin_role(p_profile_id uuid)
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
       and ar.code = 'super_admin'
  );
$$;

create or replace function public.can_operate_ghost_mode(p_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    p_profile_id is not null
    and (
      public.profile_has_super_admin_role(p_profile_id)
      or public.profile_has_access(
        p_profile_id,
        'screen',
        'maintenance.card.auditor',
        'view'
      )
    );
$$;

create or replace function public.resolve_valid_ghost_profile_id()
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_real uuid;
  v_ghost uuid;
begin
  v_real := public.current_real_session_profile_id();
  v_ghost := public.current_ghost_profile_id_from_header();

  if v_ghost is null then
    return null;
  end if;

  if v_real is null then
    return null;
  end if;

  if not public.can_operate_ghost_mode(v_real) then
    return null;
  end if;

  if v_ghost = v_real then
    return null;
  end if;

  if not exists (
    select 1
      from public.profiles p
     where p.id = v_ghost
       and p.membership_out is null
  ) then
    return null;
  end if;

  return v_ghost;
end;
$$;

create or replace function public.current_session_profile_id()
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_ghost uuid;
begin
  v_ghost := public.resolve_valid_ghost_profile_id();

  if v_ghost is not null then
    return v_ghost;
  end if;

  return public.current_real_session_profile_id();
end;
$$;

create or replace function public.is_ghost_mode_active()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.resolve_valid_ghost_profile_id() is not null;
$$;

-- ---------------------------------------------------------------------------
-- Endurecimento: asserts e super_admin usam sessão real para operador
-- ---------------------------------------------------------------------------

create or replace function public.assert_actor_matches_real_session(p_actor_profile_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_actor_profile_id is null then
    raise exception 'Sessão inválida. Saia e entre novamente no aplicativo.';
  end if;

  if public.current_real_session_profile_id() is null then
    raise exception 'Sessão não identificada. Saia e entre novamente no aplicativo.';
  end if;

  if p_actor_profile_id <> public.current_real_session_profile_id() then
    raise exception 'Sessão inconsistente com o perfil informado.';
  end if;
end;
$$;

create or replace function public.assert_actor_matches_session(p_actor_profile_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_effective uuid;
begin
  if p_actor_profile_id is null then
    raise exception 'Sessão inválida. Saia e entre novamente no aplicativo.';
  end if;

  v_effective := public.current_session_profile_id();

  if v_effective is null then
    raise exception 'Sessão não identificada. Saia e entre novamente no aplicativo.';
  end if;

  if p_actor_profile_id <> v_effective then
    raise exception 'Sessão inconsistente com o perfil informado.';
  end if;

  if public.is_ghost_mode_active() then
    insert into public.ghost_mode_audit_log (
      operator_profile_id,
      target_profile_id,
      event_type,
      details
    )
    values (
      public.current_real_session_profile_id(),
      public.resolve_valid_ghost_profile_id(),
      'rpc_action',
      jsonb_build_object('actor_profile_id', p_actor_profile_id)
    );
  end if;
end;
$$;

create or replace function public.is_super_admin_profile(p_profile_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_real_session uuid;
begin
  if p_profile_id is null then
    return false;
  end if;

  v_real_session := public.current_real_session_profile_id();

  if v_real_session is not null and p_profile_id <> v_real_session then
    if not public.profile_has_super_admin_role(v_real_session) then
      return false;
    end if;
  end if;

  return public.profile_has_super_admin_role(p_profile_id);
end;
$$;

create or replace function public.assert_access_admin(p_actor_profile_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.assert_actor_matches_session(p_actor_profile_id);

  if not public.profile_has_super_admin_role(p_actor_profile_id) then
    raise exception 'Apenas super administradores podem gerenciar permissões.';
  end if;
end;
$$;

create or replace function public.session_has_resource_access(
  p_resource_type text,
  p_resource_key text,
  p_action text
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    not public.acl_enforcement_enabled()
    or public.profile_has_access(
      public.current_session_profile_id(),
      lower(trim(coalesce(p_resource_type, ''))),
      trim(coalesce(p_resource_key, '')),
      lower(trim(coalesce(p_action, '')))
    );
$$;

-- ---------------------------------------------------------------------------
-- RPCs do Modo Ghost
-- ---------------------------------------------------------------------------

drop function if exists public.listar_perfis_ghost_mode(uuid, integer);

create or replace function public.listar_perfis_ghost_mode(
  p_operator_profile_id uuid,
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
  v_limit integer;
begin
  perform public.assert_actor_matches_real_session(p_operator_profile_id);

  if not public.can_operate_ghost_mode(p_operator_profile_id) then
    raise exception 'Sem permissão para usar o Modo Ghost.';
  end if;

  v_limit := greatest(1, least(coalesce(p_limit, 5000), 5000));

  return query
  select
    p.id,
    coalesce(nullif(trim(p.full_name), ''), nullif(trim(p.phone), ''), '(sem nome)') as full_name,
    coalesce(p.phone, '') as phone,
    coalesce(p.codigo_membro, '') as codigo_membro
  from public.profiles p
  where p.membership_out is null
    and coalesce(
      nullif(trim(p.full_name), ''),
      nullif(trim(p.phone), ''),
      nullif(trim(p.codigo_membro), '')
    ) is not null
  order by p.full_name asc
  limit v_limit;
end;
$$;

drop function if exists public.registrar_evento_ghost_mode(uuid, text, uuid, jsonb);

create or replace function public.registrar_evento_ghost_mode(
  p_operator_profile_id uuid,
  p_event_type text,
  p_target_profile_id uuid default null,
  p_details jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event text;
begin
  perform public.assert_actor_matches_real_session(p_operator_profile_id);

  if not public.can_operate_ghost_mode(p_operator_profile_id) then
    return jsonb_build_object('success', false, 'message', 'Sem permissão para usar o Modo Ghost.');
  end if;

  v_event := lower(trim(coalesce(p_event_type, '')));

  if v_event not in ('started', 'ended') then
    return jsonb_build_object('success', false, 'message', 'Tipo de evento inválido.');
  end if;

  insert into public.ghost_mode_audit_log (
    operator_profile_id,
    target_profile_id,
    event_type,
    details
  )
  values (
    p_operator_profile_id,
    p_target_profile_id,
    v_event,
    coalesce(p_details, '{}'::jsonb)
  );

  return jsonb_build_object(
    'success', true,
    'message',
    case
      when v_event = 'started' then 'Modo Ghost iniciado.'
      else 'Modo Ghost encerrado.'
    end
  );
end;
$$;

grant execute on function public.current_real_session_profile_id() to anon, authenticated;
grant execute on function public.current_ghost_profile_id_from_header() to anon, authenticated;
grant execute on function public.profile_has_super_admin_role(uuid) to anon, authenticated;
grant execute on function public.can_operate_ghost_mode(uuid) to anon, authenticated;
grant execute on function public.resolve_valid_ghost_profile_id() to anon, authenticated;
grant execute on function public.is_ghost_mode_active() to anon, authenticated;
grant execute on function public.assert_actor_matches_real_session(uuid) to anon, authenticated;
grant execute on function public.listar_perfis_ghost_mode(uuid, integer) to anon, authenticated;
grant execute on function public.registrar_evento_ghost_mode(uuid, text, uuid, jsonb) to anon, authenticated;

notify pgrst, 'reload schema';
