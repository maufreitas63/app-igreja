-- Módulo de IA: papel Curador IA, auditoria e RPCs administrativos.
-- Execute no SQL Editor do Supabase após access-control-pastoral-role-change.sql
-- e profile-sessions.sql.
--
-- Secrets na Edge Function (Supabase Dashboard → Edge Functions → Secrets):
--   GEMINI_API_KEY = chave da API Google Gemini
--
-- Deploy da função: ver DEPLOY_SUPABASE_AI.md

-- ---------------------------------------------------------------------------
-- Papel Curador IA
-- ---------------------------------------------------------------------------

insert into public.access_roles (code, name, description, is_system)
values (
  'curador_ia',
  'Curador IA',
  'Utiliza o assistente de gestão com IA (Gemini) no painel de manutenção',
  true
)
on conflict (code) do update
  set name = excluded.name,
      description = excluded.description,
      is_system = excluded.is_system;

insert into public.access_resources (resource_type, resource_key, label, description, is_active)
values
  (
    'screen',
    'maintenance.card.ai_assistant',
    'Manutenção: Assistente IA',
    'Chat com assistente de gestão da igreja (Gemini)',
    true
  ),
  (
    'screen',
    'maintenance.card.ai_audit_logs',
    'Manutenção: Auditoria IA',
    'Histórico completo de interações com o assistente de IA',
    true
  )
on conflict (resource_type, resource_key) do update
  set label = coalesce(excluded.label, public.access_resources.label),
      description = coalesce(excluded.description, public.access_resources.description),
      is_active = true;

insert into public.access_grants (role_id, resource_id, can_view, can_update)
select r.id, res.id, true, false
  from public.access_roles r
  join public.access_resources res
    on res.resource_type = 'screen'
   and res.resource_key = 'maintenance.card.ai_assistant'
 where r.code in ('curador_ia', 'super_admin')
on conflict (role_id, resource_id) where (role_id is not null) do update
  set can_view = excluded.can_view,
      can_update = excluded.can_update,
      updated_at = now();

insert into public.access_grants (role_id, resource_id, can_view, can_update)
select r.id, res.id, true, false
  from public.access_roles r
  join public.access_resources res
    on res.resource_type = 'screen'
   and res.resource_key = 'maintenance.card.ai_audit_logs'
 where r.code = 'super_admin'
on conflict (role_id, resource_id) where (role_id is not null) do update
  set can_view = excluded.can_view,
      can_update = excluded.can_update,
      updated_at = now();

-- ---------------------------------------------------------------------------
-- View user_roles (mapeia profile_access_roles para integrações externas)
-- Se existir tabela legada com o mesmo nome, remove antes de criar a view.
-- ---------------------------------------------------------------------------

drop view if exists public.user_roles cascade;
drop table if exists public.user_roles cascade;

create view public.user_roles as
select
  par.profile_id as user_id,
  ar.id as role_id,
  ar.code as role_code,
  ar.name as role_name,
  par.granted_at as assigned_at
  from public.profile_access_roles par
  join public.access_roles ar on ar.id = par.role_id;

comment on view public.user_roles is
  'Visão de papéis por perfil (user_id = profiles.id). Usada por Edge Functions e auditoria.';

-- ---------------------------------------------------------------------------
-- Tabela de auditoria
-- ---------------------------------------------------------------------------

create table if not exists public.ai_audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  question text not null,
  ai_response text not null,
  role_at_time text not null,
  created_at timestamptz not null default now()
);

comment on table public.ai_audit_logs is 'Auditoria de perguntas e respostas do assistente de IA.';
comment on column public.ai_audit_logs.user_id is 'Perfil (profiles.id) que fez a consulta.';
comment on column public.ai_audit_logs.role_at_time is 'Papéis do usuário no momento da consulta.';

create index if not exists ai_audit_logs_user_id_idx on public.ai_audit_logs (user_id);
create index if not exists ai_audit_logs_created_at_idx on public.ai_audit_logs (created_at desc);

alter table public.ai_audit_logs enable row level security;

drop policy if exists ai_audit_logs_select_super_admin on public.ai_audit_logs;

create policy ai_audit_logs_select_super_admin
  on public.ai_audit_logs
  for select
  to anon, authenticated
  using (public.is_super_admin_profile(public.current_session_profile_id()));

-- Inserções apenas via service role (Edge Function) ou RPC security definer.

-- ---------------------------------------------------------------------------
-- Configuração do servidor de IA (chave Gemini — não exposta ao PWA)
-- ---------------------------------------------------------------------------

create table if not exists public.ai_server_config (
  config_key text primary key,
  config_value text not null,
  updated_at timestamptz not null default now()
);

comment on table public.ai_server_config is
  'Configuração server-side do assistente IA. Sem acesso direto via RLS.';

alter table public.ai_server_config enable row level security;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.profile_role_names_csv(p_profile_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    string_agg(ar.name, ', ' order by public.access_role_display_order(ar.code), ar.name),
    'Sem papel'
  )
    from public.profile_access_roles par
    join public.access_roles ar on ar.id = par.role_id
   where par.profile_id = p_profile_id;
$$;

create or replace function public.profile_is_ai_curator(p_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.profile_has_role_code(p_profile_id, 'curador_ia');
$$;

create or replace function public.insert_ai_audit_log(
  p_user_id uuid,
  p_question text,
  p_ai_response text,
  p_role_at_time text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  insert into public.ai_audit_logs (user_id, question, ai_response, role_at_time)
  values (
    p_user_id,
    left(trim(coalesce(p_question, '')), 8000),
    left(trim(coalesce(p_ai_response, '')), 32000),
    left(trim(coalesce(p_role_at_time, 'Sem papel')), 500)
  )
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.registrar_auditoria_ia_actor(
  p_actor_profile_id uuid,
  p_question text,
  p_ai_response text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_actor_profile_id is null then
    raise exception 'nao autorizado para esta funçao';
  end if;

  if not public.profile_is_ai_curator(p_actor_profile_id) then
    raise exception 'nao autorizado para esta funçao';
  end if;

  return public.insert_ai_audit_log(
    p_actor_profile_id,
    p_question,
    p_ai_response,
    public.profile_role_names_csv(p_actor_profile_id)
  );
end;
$$;

create or replace function public.obter_chave_gemini_ia_curador(p_actor_profile_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_key text;
begin
  if p_actor_profile_id is null then
    raise exception 'nao autorizado para esta funçao';
  end if;

  if not public.profile_is_ai_curator(p_actor_profile_id) then
    raise exception 'nao autorizado para esta funçao';
  end if;

  select c.config_value
    into v_key
    from public.ai_server_config c
   where c.config_key = 'gemini_api_key';

  if nullif(trim(coalesce(v_key, '')), '') is null then
    raise exception
      'Chave Gemini não configurada. Execute scripts/configurar-gemini-api-key.sql no Supabase ou defina GEMINI_API_KEY no Cloudflare Pages.';
  end if;

  return trim(v_key);
end;
$$;

create or replace function public.salvar_chave_gemini_ia_admin(
  p_actor_profile_id uuid,
  p_api_key text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.assert_ai_audit_logs_admin(p_actor_profile_id);

  if nullif(trim(coalesce(p_api_key, '')), '') is null then
    raise exception 'Informe a chave da API Gemini.';
  end if;

  insert into public.ai_server_config (config_key, config_value)
  values ('gemini_api_key', trim(p_api_key))
  on conflict (config_key) do update
    set config_value = excluded.config_value,
        updated_at = now();
end;
$$;

create or replace function public.assert_ai_audit_logs_admin(p_actor_profile_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_actor_profile_id is null then
    raise exception 'Sessão inválida. Saia e entre novamente no aplicativo.';
  end if;

  if not public.is_super_admin_profile(p_actor_profile_id) then
    raise exception 'Apenas super admin pode consultar a auditoria de IA.';
  end if;
end;
$$;

drop function if exists public.listar_ai_audit_logs_admin(uuid, integer);

create or replace function public.listar_ai_audit_logs_admin(
  p_actor_profile_id uuid,
  p_limit integer default 100
)
returns table (
  id uuid,
  user_id uuid,
  user_name text,
  question text,
  ai_response text,
  role_at_time text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.assert_ai_audit_logs_admin(p_actor_profile_id);

  return query
  select
    l.id,
    l.user_id,
    coalesce(nullif(trim(p.full_name), ''), '—') as user_name,
    l.question,
    l.ai_response,
    l.role_at_time,
    l.created_at
    from public.ai_audit_logs l
    left join public.profiles p on p.id = l.user_id
   order by l.created_at desc
   limit greatest(1, least(coalesce(p_limit, 100), 500));
end;
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
    when 'lider' then 45
    when 'events_admin' then 50
    when 'orquestrador_evento' then 52
    when 'tesoureiro' then 55
    when 'pastoral' then 60
    when 'curador_ia' then 65
    when 'super_admin' then 70
    else 100
  end;
$$;

grant execute on function public.profile_role_names_csv(uuid) to anon, authenticated, service_role;
grant execute on function public.profile_is_ai_curator(uuid) to anon, authenticated, service_role;
grant execute on function public.insert_ai_audit_log(uuid, text, text, text) to service_role;
grant execute on function public.registrar_auditoria_ia_actor(uuid, text, text) to anon, authenticated, service_role;
grant execute on function public.obter_chave_gemini_ia_curador(uuid) to anon, authenticated, service_role;
grant execute on function public.salvar_chave_gemini_ia_admin(uuid, text) to anon, authenticated;
grant execute on function public.assert_ai_audit_logs_admin(uuid) to anon, authenticated;
grant execute on function public.listar_ai_audit_logs_admin(uuid, integer) to anon, authenticated;
grant execute on function public.access_role_display_order(text) to anon, authenticated;

grant select on public.user_roles to service_role;

notify pgrst, 'reload schema';
