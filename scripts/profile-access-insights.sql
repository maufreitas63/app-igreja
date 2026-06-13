-- Histórico de acessos à aplicação (card exclusivo super_admin na manutenção).
-- Execute no SQL Editor do Supabase APÓS:
--   1. access-control-admin-rpc.sql
--   2. access-control-profile-access-insights.sql (etiqueta ACL no Controle de Acesso)
-- Recomendado após profile-sessions.sql (backfill a partir de sessões existentes).

-- ---------------------------------------------------------------------------
-- Eventos de acesso (um registro por login / emissão de sessão)
-- ---------------------------------------------------------------------------

create table if not exists public.profile_app_access_events (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  accessed_at timestamptz not null default now()
);

create index if not exists profile_app_access_events_profile_id_idx
  on public.profile_app_access_events (profile_id);

create index if not exists profile_app_access_events_accessed_at_idx
  on public.profile_app_access_events (accessed_at desc);

alter table public.profile_app_access_events enable row level security;

-- Sem policies: leitura/escrita apenas via funções security definer.

create or replace function public.record_profile_app_access(p_profile_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_profile_id is null then
    return;
  end if;

  insert into public.profile_app_access_events (profile_id, accessed_at)
  values (p_profile_id, now());
end;
$$;

-- ---------------------------------------------------------------------------
-- Trigger: cada nova sessão emitida conta como um acesso
-- ---------------------------------------------------------------------------

create or replace function public.trg_profile_sessions_access_log_fn()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.record_profile_app_access(new.profile_id);
  return new;
end;
$$;

do $$
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
$$;

-- Backfill a partir de sessões já gravadas (idempotente por profile_id + accessed_at).
insert into public.profile_app_access_events (profile_id, accessed_at)
select ps.profile_id, ps.created_at
  from public.profile_sessions ps
 where not exists (
   select 1
     from public.profile_app_access_events e
    where e.profile_id = ps.profile_id
      and e.accessed_at = ps.created_at
 );

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
as $$
begin
  perform public.assert_access_admin(p_actor_profile_id);

  return query
  select
    p.id as profile_id,
    p.full_name,
    max(e.accessed_at) as last_access_at,
    count(e.id)::bigint as access_count
  from public.profiles p
  left join public.profile_app_access_events e on e.profile_id = p.id
  where coalesce(trim(p.full_name), '') <> ''
    and lower(trim(p.full_name)) <> 'visitante'
  group by p.id, p.full_name
  order by max(e.accessed_at) desc nulls last, p.full_name asc;
end;
$$;

grant execute on function public.list_profile_access_insights_admin(uuid) to anon, authenticated;
