-- Registro de check-in para eventos com requer_quorum = true.
-- Uma linha por participante/evento, ordenada por registered_at (cronológica).
-- Execute no Supabase após events-requer-quorum.sql e checkins-totem-flow.sql.
--
-- C6: não redefine sync_checkin_for_registration, confirm_totem_checkin nem register_member_atomic.
-- Fonte única dessas RPCs: scripts/checkins-totem-flow.sql (hooks via maybe_sync_quorum_registry_for_registration).

-- ---------------------------------------------------------------------------
-- 1. Tabela
-- ---------------------------------------------------------------------------

create table if not exists public.event_quorum_registry (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  event_registration_id uuid references public.event_registrations (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  checkin_id uuid references public.checkins (id) on delete set null,
  event_name text not null,
  event_date date,
  event_local text,
  max_capacity integer,
  participant_name text,
  participant_phone text,
  participant_email text,
  participant_cpf text,
  checkin_status text not null default 'inscrito',
  registered_at timestamptz not null default now(),
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint event_quorum_registry_event_profile_uq unique (event_id, profile_id)
);

create index if not exists idx_event_quorum_registry_event_registered
  on public.event_quorum_registry (event_id, registered_at asc);

comment on table public.event_quorum_registry is
  'Lista cronológica de check-ins/inscrições em eventos com requer_quorum = true.';

alter table public.event_quorum_registry enable row level security;

drop policy if exists event_quorum_registry_select_public on public.event_quorum_registry;
create policy event_quorum_registry_select_public
  on public.event_quorum_registry
  for select
  to anon, authenticated
  using (true);

-- Escrita apenas via funções security definer.

-- ---------------------------------------------------------------------------
-- 2. Sincronização (inscrição / check-in / confirmação totem)
-- ---------------------------------------------------------------------------

create or replace function public.sync_quorum_registry_for_registration(
  p_event_id uuid,
  p_registration_id uuid,
  p_profile_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_requer_quorum boolean;
  v_event public.events%rowtype;
  v_profile public.profiles%rowtype;
  v_checkin public.checkins%rowtype;
  v_status text;
  v_registered_at timestamptz;
begin
  if p_event_id is null or p_profile_id is null then
    return;
  end if;

  select coalesce(e.requer_quorum, false)
    into v_requer_quorum
  from public.events e
  where e.id = p_event_id;

  if not coalesce(v_requer_quorum, false) then
    return;
  end if;

  select *
    into v_event
  from public.events e
  where e.id = p_event_id;

  if not found then
    return;
  end if;

  select *
    into v_profile
  from public.profiles p
  where p.id = p_profile_id;

  if not found then
    return;
  end if;

  if p_registration_id is not null then
    select *
      into v_checkin
    from public.checkins c
    where c.event_registration_id = p_registration_id
    limit 1;
  end if;

  if v_checkin.id is not null then
    v_status := coalesce(nullif(trim(v_checkin.status), ''), 'pre_checkin');
    v_registered_at := coalesce(v_checkin.created_at, now());
  else
    v_status := 'inscrito';
    v_registered_at := now();
  end if;

  insert into public.event_quorum_registry (
    event_id,
    event_registration_id,
    profile_id,
    checkin_id,
    event_name,
    event_date,
    event_local,
    max_capacity,
    participant_name,
    participant_phone,
    participant_email,
    participant_cpf,
    checkin_status,
    registered_at,
    confirmed_at,
    updated_at
  )
  values (
    p_event_id,
    p_registration_id,
    p_profile_id,
    v_checkin.id,
    coalesce(nullif(trim(v_event.name), ''), 'Evento'),
    v_event.event_date::date,
    nullif(trim(coalesce(v_event.event_local, '')), ''),
    v_event.max_capacity,
    nullif(trim(coalesce(v_profile.full_name, '')), ''),
    nullif(trim(coalesce(v_profile.phone, '')), ''),
    nullif(trim(coalesce(v_profile.email, '')), ''),
    nullif(trim(coalesce(v_profile.cpf, '')), ''),
    v_status,
    v_registered_at,
    v_checkin.timestamp_confirmacao,
    now()
  )
  on conflict (event_id, profile_id) do update
  set
    event_registration_id = coalesce(excluded.event_registration_id, public.event_quorum_registry.event_registration_id),
    checkin_id = coalesce(excluded.checkin_id, public.event_quorum_registry.checkin_id),
    event_name = excluded.event_name,
    event_date = excluded.event_date,
    event_local = excluded.event_local,
    max_capacity = excluded.max_capacity,
    participant_name = excluded.participant_name,
    participant_phone = excluded.participant_phone,
    participant_email = excluded.participant_email,
    participant_cpf = excluded.participant_cpf,
    checkin_status = excluded.checkin_status,
    confirmed_at = excluded.confirmed_at,
    updated_at = now(),
    registered_at = case
      when public.event_quorum_registry.checkin_id is null
        and excluded.checkin_id is not null
        then excluded.registered_at
      else public.event_quorum_registry.registered_at
    end;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Backfill + ensure (app)
-- ---------------------------------------------------------------------------

create or replace function public.backfill_event_quorum_registry()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row record;
  v_count integer := 0;
begin
  for v_row in
    select er.event_id, er.id as registration_id, er.profile_id
    from public.event_registrations er
    inner join public.events e on e.id = er.event_id
    where coalesce(e.requer_quorum, false) = true
      and er.profile_id is not null
  loop
    perform public.sync_quorum_registry_for_registration(
      v_row.event_id,
      v_row.registration_id,
      v_row.profile_id
    );
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

create or replace function public.ensure_event_quorum_registry()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.ensure_events_requer_quorum_column();

  create table if not exists public.event_quorum_registry (
    id uuid primary key default gen_random_uuid(),
    event_id uuid not null references public.events (id) on delete cascade,
    event_registration_id uuid references public.event_registrations (id) on delete cascade,
    profile_id uuid not null references public.profiles (id) on delete cascade,
    checkin_id uuid references public.checkins (id) on delete set null,
    event_name text not null,
    event_date date,
    event_local text,
    max_capacity integer,
    participant_name text,
    participant_phone text,
    participant_email text,
    participant_cpf text,
    checkin_status text not null default 'inscrito',
    registered_at timestamptz not null default now(),
    confirmed_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint event_quorum_registry_event_profile_uq unique (event_id, profile_id)
  );

  perform public.backfill_event_quorum_registry();

  return true;
exception
  when undefined_table then
    raise exception
      'Dependências ausentes. Execute events-requer-quorum.sql e checkins-totem-flow.sql antes.';
end;
$$;

grant execute on function public.sync_quorum_registry_for_registration(uuid, uuid, uuid) to anon, authenticated, service_role;
grant execute on function public.backfill_event_quorum_registry() to anon, authenticated, service_role;
grant execute on function public.ensure_event_quorum_registry() to anon, authenticated, service_role;

notify pgrst, 'reload schema';
