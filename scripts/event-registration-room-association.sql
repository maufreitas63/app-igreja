-- Evento com sala ativa: a inscrição de quem pertence à sala fica na sala,
-- e não entra na contagem de vagas do evento.
-- Execute: npx supabase db query --linked -f scripts/event-registration-room-association.sql

alter table public.event_registrations
  add column if not exists registration_room_key text;

create or replace function public.registration_room_key_for_event_profile(
  p_event_id uuid,
  p_profile_id uuid
)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_tenant uuid;
  v_keys text[];
  v_kids boolean;
  v_teens boolean;
  v_assigned text;
  v_birth date;
  v_idade_kids integer;
  v_idade_teens integer;
  v_age integer;
begin
  if p_event_id is null or p_profile_id is null then
    return null;
  end if;

  select
    e.tenant_id,
    coalesce(e.kids_room, false),
    coalesce(e.teens_room, false),
    coalesce(e.enabled_room_keys, '{}'::text[])
    into v_tenant, v_kids, v_teens, v_keys
  from public.events e
  where e.id = p_event_id;

  if v_tenant is null then
    return null;
  end if;

  if v_kids and not ('KIDS' = any (v_keys)) then
    v_keys := v_keys || array['KIDS']::text[];
  end if;

  if v_teens and not ('TEENS' = any (v_keys)) then
    v_keys := v_keys || array['TEENS']::text[];
  end if;

  if coalesce(cardinality(v_keys), 0) = 0 then
    return null;
  end if;

  select upper(trim(eff.room_key))
    into v_assigned
  from public.effective_user_room(v_tenant, p_profile_id, current_date) eff
  limit 1;

  if v_assigned is not null and v_assigned = any (v_keys) then
    return v_assigned;
  end if;

  select p.birth_date
    into v_birth
  from public.profiles p
  where p.id = p_profile_id;

  if v_birth is null then
    return null;
  end if;

  select case
    when trim(ap.value) ~ '^\d+$' then trim(ap.value)::integer
    else null
  end
    into v_idade_kids
  from public.app_parameters ap
  where ap.tenant_id = v_tenant
    and lower(ap.parameter) = 'idade_kids'
  limit 1;

  select case
    when trim(ap.value) ~ '^\d+$' then trim(ap.value)::integer
    else null
  end
    into v_idade_teens
  from public.app_parameters ap
  where ap.tenant_id = v_tenant
    and lower(ap.parameter) = 'idade_teens'
  limit 1;

  v_age := extract(year from age(current_date, v_birth))::integer;

  if v_idade_kids is not null and v_age <= v_idade_kids then
    return 'KIDS';
  end if;

  if v_idade_kids is not null
     and v_idade_teens is not null
     and v_age > v_idade_kids
     and v_age <= v_idade_teens then
    return 'TEENS';
  end if;

  return null;
end;
$$;

create or replace function public.event_registrations_set_room_key()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.registration_room_key := public.registration_room_key_for_event_profile(
    new.event_id,
    new.profile_id
  );
  return new;
end;
$$;

drop trigger if exists trg_event_registrations_room_key on public.event_registrations;

create trigger trg_event_registrations_room_key
before insert or update of event_id, profile_id, kids_status
on public.event_registrations
for each row
execute function public.event_registrations_set_room_key();

update public.event_registrations er
set registration_room_key = public.registration_room_key_for_event_profile(er.event_id, er.profile_id);

create or replace function public.get_event_registration_count(
  p_event_id uuid
)
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select count(*)
  from public.event_registrations er
  where er.event_id = p_event_id
    and er.registration_room_key is null;
$$;

grant execute on function public.registration_room_key_for_event_profile(uuid, uuid) to anon, authenticated;
grant execute on function public.get_event_registration_count(uuid) to anon, authenticated;

notify pgrst, 'reload schema';
