-- Finalizar sala: marca crianças como liberadas e sinaliza vibração aos responsáveis.

alter table public.event_registrations
  add column if not exists room_released boolean not null default false;

comment on column public.event_registrations.room_released is
  'True quando a sala foi finalizada e a criança está liberada para retirada.';

create table if not exists public.room_release_signals (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.igrejas (id) on delete cascade,
  event_id uuid not null references public.events (id) on delete cascade,
  room_key text not null,
  phones text[] not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists room_release_signals_tenant_created_idx
  on public.room_release_signals (tenant_id, created_at desc);

alter table public.room_release_signals enable row level security;

drop policy if exists room_release_signals_tenant_select on public.room_release_signals;
create policy room_release_signals_tenant_select
  on public.room_release_signals
  for select
  to anon, authenticated
  using (public.session_tenant_matches(tenant_id));

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      alter publication supabase_realtime add table public.room_release_signals;
    exception
      when duplicate_object then null;
    end;
  end if;
end $$;

-- Lista de check-in passa a expor room_released.
drop function if exists public.get_event_registrations_by_status(uuid);

create or replace function public.get_event_registrations_by_status(p_event_id uuid)
returns table (
  registration_id uuid,
  full_name text,
  kids_status text,
  room_entry_checked boolean,
  room_released boolean
)
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
begin
  return query
  select
    er.id,
    er.full_name,
    er.kids_status,
    coalesce(er.room_entry_checked, false),
    coalesce(er.room_released, false)
  from public.event_registrations er
  where er.tenant_id = v_tenant
    and er.event_id = p_event_id
    and er.kids_status in ('KIDS', 'TEENS')
  order by er.kids_status asc, er.full_name asc;
end;
$$;

grant execute on function public.get_event_registrations_by_status(uuid) to anon, authenticated;

-- Finaliza a sala: libera quem já está com check-in e notifica celulares de contato.
create or replace function public.finalize_event_room_release(
  p_event_id uuid,
  p_room_key text,
  p_actor_profile_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
  v_room text := upper(nullif(trim(coalesce(p_room_key, '')), ''));
  v_actor uuid := coalesce(p_actor_profile_id, public.current_session_profile_id());
  v_updated int := 0;
  v_phones text[] := array[]::text[];
begin
  if p_event_id is null then
    return jsonb_build_object('success', false, 'message', 'Evento inválido.');
  end if;

  if v_room is null or v_room not in ('KIDS', 'TEENS') then
    return jsonb_build_object('success', false, 'message', 'Sala inválida.');
  end if;

  if v_actor is null then
    return jsonb_build_object('success', false, 'message', 'Sessão inválida.');
  end if;

  -- Mesma regra prática do check-in: servidor escalado / secretaria / super admin
  -- (a UI já bloqueia; aqui reforça que o ator existe no tenant).
  if not exists (
    select 1
      from public.profiles p
     where p.id = v_actor
       and p.tenant_id = v_tenant
  ) then
    return jsonb_build_object('success', false, 'message', 'Operador sem permissão.');
  end if;

  update public.event_registrations er
     set room_released = true
   where er.tenant_id = v_tenant
     and er.event_id = p_event_id
     and er.kids_status = v_room
     and coalesce(er.room_entry_checked, false) = true
     and coalesce(er.room_released, false) = false;

  get diagnostics v_updated = row_count;

  -- Todos os celulares da família (mesmo critério do WhatsApp na lista de sala).
  select coalesce(array_agg(distinct nullif(trim(m.phone), '')), array[]::text[])
    into v_phones
    from public.event_registrations er
    join public.members m
      on m.tenant_id = v_tenant
     and nullif(trim(m.family_id), '') is not null
     and nullif(trim(er.family_id), '') is not null
     and upper(trim(m.family_id)) = upper(trim(er.family_id))
     and m.accepted is true
   where er.tenant_id = v_tenant
     and er.event_id = p_event_id
     and er.kids_status = v_room
     and coalesce(er.room_entry_checked, false) = true
     and nullif(trim(m.phone), '') is not null;

  if coalesce(cardinality(v_phones), 0) > 0 then
    insert into public.room_release_signals (tenant_id, event_id, room_key, phones)
    values (v_tenant, p_event_id, v_room, v_phones);
  end if;

  return jsonb_build_object(
    'success', true,
    'updated', v_updated,
    'phones', coalesce(to_jsonb(v_phones), '[]'::jsonb),
    'message',
    case
      when v_updated > 0 then format('Sala finalizada. %s criança(s) liberada(s).', v_updated)
      else 'Nenhuma criança pendente de liberação nesta sala.'
    end
  );
end;
$$;

grant execute on function public.finalize_event_room_release(uuid, text, uuid) to anon, authenticated;
