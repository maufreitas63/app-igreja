-- Histórico de acessos à aplicação (card exclusivo super_admin na manutenção).
-- Execute no SQL Editor do Supabase APÓS:
--   1. access-control-admin-rpc.sql
--   2. access-control-profile-access-insights.sql (etiqueta ACL no Controle de Acesso)
-- Recomendado após profile-sessions.sql (backfill a partir de sessões existentes).
--
-- Se o editor truncar este arquivo, execute em partes:
--   scripts/profile-access-insights-screen-visits-patch.sql

-- ---------------------------------------------------------------------------
-- Eventos de acesso (um registro por login / emissão de sessão)
-- ---------------------------------------------------------------------------

create table if not exists public.profile_app_access_events (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  profile_session_id uuid references public.profile_sessions (id) on delete cascade,
  accessed_at timestamptz not null default now()
);

alter table public.profile_app_access_events
  add column if not exists profile_session_id uuid references public.profile_sessions (id) on delete cascade;

create index if not exists profile_app_access_events_profile_id_idx
  on public.profile_app_access_events (profile_id);

create index if not exists profile_app_access_events_session_id_idx
  on public.profile_app_access_events (profile_session_id);

create index if not exists profile_app_access_events_accessed_at_idx
  on public.profile_app_access_events (accessed_at desc);

alter table public.profile_app_access_events enable row level security;

-- Tabela interna: leitura/escrita somente via funções security definer (sem policies).
alter table public.profile_app_access_events disable row level security;

create or replace function public.record_profile_app_access(
  p_profile_id uuid,
  p_profile_session_id uuid default null,
  p_accessed_at timestamptz default now()
)
returns void
language plpgsql
security definer
set search_path = public
as $record_profile_app_access$
begin
  if p_profile_id is null then
    return;
  end if;

  insert into public.profile_app_access_events (profile_id, profile_session_id, accessed_at)
  values (p_profile_id, p_profile_session_id, coalesce(p_accessed_at, now()));
end;
$record_profile_app_access$;

-- ---------------------------------------------------------------------------
-- Trigger: cada nova sessão emitida conta como um acesso
-- ---------------------------------------------------------------------------

create or replace function public.trg_profile_sessions_access_log_fn()
returns trigger
language plpgsql
security definer
set search_path = public
as $trg_profile_sessions_access_log_fn$
begin
  perform public.record_profile_app_access(new.profile_id, new.id, new.created_at);
  return new;
end;
$trg_profile_sessions_access_log_fn$;

do $do_profile_sessions_access_trigger$
begin
  if exists (
    select 1
      from information_schema.tables
     where table_schema = 'public'
       and table_name = 'profile_sessions'
  ) then
    drop trigger if exists trg_profile_sessions_access_log on public.profile_sessions;

    create trigger trg_profile_sessions_access_log
    after insert on public.profile_sessions
    for each row
    execute function public.trg_profile_sessions_access_log_fn();
  end if;
end;
$do_profile_sessions_access_trigger$;

-- Backfill inicial: só quando a tabela ainda está vazia (evita repovoar após "Limpar histórico").
do $do_profile_access_backfill$
begin
  if exists (select 1 from public.profile_app_access_events limit 1) then
    return;
  end if;

  if not exists (
    select 1
      from information_schema.tables
     where table_schema = 'public'
       and table_name = 'profile_sessions'
  ) then
    return;
  end if;

  insert into public.profile_app_access_events (profile_id, profile_session_id, accessed_at)
  select ps.profile_id, ps.id, ps.created_at
    from public.profile_sessions ps;
end;
$do_profile_access_backfill$;

-- Vincula eventos antigos à sessão correspondente (quando possível).
update public.profile_app_access_events e
   set profile_session_id = ps.id
  from public.profile_sessions ps
 where e.profile_session_id is null
   and e.profile_id = ps.profile_id
   and abs(extract(epoch from (e.accessed_at - ps.created_at))) < 5;

-- ---------------------------------------------------------------------------
-- Telas visitadas durante cada login (associadas ao evento de acesso)
-- ---------------------------------------------------------------------------

create table if not exists public.profile_app_access_screen_visits (
  id uuid primary key default gen_random_uuid(),
  access_event_id uuid not null references public.profile_app_access_events (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  screen_key text not null,
  screen_label text not null,
  visited_at timestamptz not null default now(),
  visit_order integer not null default 1
);

create index if not exists profile_app_access_screen_visits_access_event_id_idx
  on public.profile_app_access_screen_visits (access_event_id, visit_order);

create index if not exists profile_app_access_screen_visits_profile_id_idx
  on public.profile_app_access_screen_visits (profile_id);

alter table public.profile_app_access_screen_visits enable row level security;
alter table public.profile_app_access_screen_visits disable row level security;

create or replace function public.resolve_current_profile_session_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $resolve_current_profile_session_id$
  select ps.id
    from public.profile_sessions ps
   where ps.token = nullif(
     trim(coalesce((nullif(current_setting('request.headers', true), '')::json ->> 'x-session-token'), '')),
     ''
   )
     and ps.revoked_at is null
     and ps.expires_at > now()
   limit 1;
$resolve_current_profile_session_id$;

create or replace function public.resolve_current_access_event_id(
  p_profile_id uuid,
  p_profile_session_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $resolve_current_access_event_id$
declare
  v_access_event_id uuid;
begin
  if p_profile_id is null then
    return null;
  end if;

  if p_profile_session_id is not null then
    select e.id
      into v_access_event_id
      from public.profile_app_access_events e
     where e.profile_session_id = p_profile_session_id
     order by e.accessed_at desc
     limit 1;

    if v_access_event_id is not null then
      return v_access_event_id;
    end if;

    insert into public.profile_app_access_events (profile_id, profile_session_id, accessed_at)
    select ps.profile_id, ps.id, ps.created_at
      from public.profile_sessions ps
     where ps.id = p_profile_session_id
     returning id into v_access_event_id;

    return v_access_event_id;
  end if;

  select e.id
    into v_access_event_id
    from public.profile_app_access_events e
   where e.profile_id = p_profile_id
   order by e.accessed_at desc
   limit 1;

  return v_access_event_id;
end;
$resolve_current_access_event_id$;

create or replace function public.record_profile_app_access_screen_visit(
  p_screen_key text,
  p_screen_label text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $record_profile_app_access_screen_visit$
declare
  v_profile_id uuid;
  v_session_id uuid;
  v_access_event_id uuid;
  v_screen_key text;
  v_screen_label text;
  v_last_key text;
  v_next_order integer;
begin
  v_session_id := public.resolve_current_profile_session_id();
  v_profile_id := public.current_session_profile_id();

  if v_profile_id is null then
    return;
  end if;

  v_screen_key := nullif(trim(coalesce(p_screen_key, '')), '');

  if v_screen_key is null then
    return;
  end if;

  v_screen_label := nullif(trim(coalesce(p_screen_label, p_screen_key, '')), '');

  if v_screen_label in ('Dashboard', 'Manutenção')
     or v_screen_key in ('/dashboard', '/maintenance-dashboard') then
    return;
  end if;

  v_access_event_id := public.resolve_current_access_event_id(v_profile_id, v_session_id);

  if v_access_event_id is null then
    return;
  end if;

  select sv.screen_key
    into v_last_key
    from public.profile_app_access_screen_visits sv
   where sv.access_event_id = v_access_event_id
   order by sv.visit_order desc
   limit 1;

  if v_last_key = v_screen_key then
    return;
  end if;

  select coalesce(max(sv.visit_order), 0) + 1
    into v_next_order
    from public.profile_app_access_screen_visits sv
   where sv.access_event_id = v_access_event_id;

  insert into public.profile_app_access_screen_visits (
    access_event_id,
    profile_id,
    screen_key,
    screen_label,
    visit_order
  )
  values (
    v_access_event_id,
    v_profile_id,
    v_screen_key,
    v_screen_label,
    v_next_order
  );
end;
$record_profile_app_access_screen_visit$;

grant execute on function public.resolve_current_profile_session_id() to anon, authenticated;
grant execute on function public.record_profile_app_access_screen_visit(text, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- RPC: lista agregada para o painel de manutenção (somente super_admin)
-- ---------------------------------------------------------------------------

drop function if exists public.list_profile_access_insights_admin(uuid);

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
begin
  perform public.assert_access_admin(p_actor_profile_id);

  return query
  select
    p.id as profile_id,
    p.full_name,
    max(e.accessed_at) as last_access_at,
    count(e.id)::bigint as access_count
  from public.profiles p
  inner join public.profile_app_access_events e on e.profile_id = p.id
  where coalesce(trim(p.full_name), '') <> ''
    and lower(trim(p.full_name)) <> 'visitante'
  group by p.id, p.full_name
  having count(e.id) > 0
  order by max(e.accessed_at) desc, p.full_name asc;
end;
$list_profile_access_insights_admin$;

grant execute on function public.list_profile_access_insights_admin(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- RPC: histórico de telas por login (somente super_admin)
-- ---------------------------------------------------------------------------

drop function if exists public.list_profile_access_screen_visits_admin(uuid, uuid);

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
begin
  perform public.assert_access_admin(p_actor_profile_id);

  if p_target_profile_id is null then
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

grant execute on function public.list_profile_access_screen_visits_admin(uuid, uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- RPC: limpa todo o histórico (somente super_admin)
-- ---------------------------------------------------------------------------

drop function if exists public.clear_profile_access_insights_admin(uuid);

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
  perform public.assert_access_admin(p_actor_profile_id);

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

grant execute on function public.clear_profile_access_insights_admin(uuid) to anon, authenticated;

notify pgrst, 'reload schema';
