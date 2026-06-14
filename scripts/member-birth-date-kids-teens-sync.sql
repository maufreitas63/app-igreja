-- Kids/Teens: priorizar birth_date de members e recalcular kids_status nas inscrições.
-- Execute no SQL Editor do Supabase após register-member-atomic.sql e sync-managed-member-profile-family-rpc.sql.

create or replace function public.resolve_kids_status_from_birth_date(p_birth_date date)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_age_years integer;
  v_idade_kids integer;
  v_idade_teens integer;
begin
  if p_birth_date is null then
    return null;
  end if;

  select
    case when trim(ap.value) ~ '^\d+$' then trim(ap.value)::integer else null end
    into v_idade_kids
  from public.app_parameters ap
  where lower(ap.parameter) = 'idade_kids'
  limit 1;

  select
    case when trim(ap.value) ~ '^\d+$' then trim(ap.value)::integer else null end
    into v_idade_teens
  from public.app_parameters ap
  where lower(ap.parameter) = 'idade_teens'
  limit 1;

  v_age_years := extract(year from age(current_date, p_birth_date::date))::integer;

  if v_idade_kids is not null and v_age_years <= v_idade_kids then
    return 'KIDS';
  end if;

  if
    v_idade_kids is not null
    and v_idade_teens is not null
    and v_age_years > v_idade_kids
    and v_age_years <= v_idade_teens
  then
    return 'TEENS';
  end if;

  return null;
end;
$$;

create or replace function public.refresh_profile_kids_teens_registrations(
  p_profile_id uuid,
  p_birth_date date default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_birth_date date;
  v_kids_status text;
begin
  if p_profile_id is null then
    return;
  end if;

  select coalesce(p_birth_date, p.birth_date)
    into v_birth_date
  from public.profiles p
  where p.id = p_profile_id;

  v_kids_status := public.resolve_kids_status_from_birth_date(v_birth_date);

  update public.event_registrations er
  set kids_status = v_kids_status
  where er.profile_id = p_profile_id
    and er.kids_status is distinct from v_kids_status;
end;
$$;

grant execute on function public.resolve_kids_status_from_birth_date(date) to anon, authenticated;
grant execute on function public.refresh_profile_kids_teens_registrations(uuid, date) to anon, authenticated;

-- Sincroniza birth_date members → profiles e recalcula inscrições.
create or replace function public.sync_profile_family_from_member()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid;
  v_family_id text;
begin
  if pg_trigger_depth() > 1 then
    return new;
  end if;

  v_profile_id := public.find_profile_id_for_member_sync(new.phone, new.full_name);
  v_family_id := nullif(trim(coalesce(new.family_id, '')), '');

  if v_profile_id is null then
    return new;
  end if;

  update public.profiles p
  set
    family_id = coalesce(v_family_id, p.family_id),
    codigo_membro = coalesce(v_family_id, p.codigo_membro),
    birth_date = coalesce(new.birth_date, p.birth_date)
  where p.id = v_profile_id
    and (
      (v_family_id is not null and p.family_id is distinct from v_family_id)
      or (v_family_id is not null and p.codigo_membro is distinct from v_family_id)
      or (new.birth_date is not null and p.birth_date is distinct from new.birth_date)
    );

  if new.birth_date is not null then
    perform public.refresh_profile_kids_teens_registrations(v_profile_id, new.birth_date);
  end if;

  return new;
end;
$$;

drop trigger if exists trg_sync_profile_family_from_member on public.members;

create trigger trg_sync_profile_family_from_member
after insert or update of family_id, phone, full_name, birth_date
on public.members
for each row
execute function public.sync_profile_family_from_member();

create or replace function public.sync_managed_member_profile_family(
  p_member_id uuid,
  p_profile_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_member public.members%rowtype;
  v_profile_id uuid;
  v_family_id text;
begin
  select *
    into v_member
  from public.members m
  where m.id = p_member_id;

  if not found then
    return jsonb_build_object(
      'success', false,
      'message', 'Membro não encontrado.'
    );
  end if;

  v_family_id := nullif(trim(coalesce(v_member.family_id, '')), '');

  if v_family_id is null then
    return jsonb_build_object(
      'success', false,
      'message', 'Membro sem código de família para sincronizar.'
    );
  end if;

  v_profile_id := coalesce(
    p_profile_id,
    public.find_profile_id_for_member_sync(v_member.phone, v_member.full_name)
  );

  if v_profile_id is null then
    return jsonb_build_object(
      'success', false,
      'message', 'Perfil vinculado ao membro não foi encontrado.'
    );
  end if;

  update public.profiles p
  set
    family_id = v_family_id,
    codigo_membro = v_family_id,
    birth_date = coalesce(v_member.birth_date, p.birth_date)
  where p.id = v_profile_id
    and (
      p.family_id is distinct from v_family_id
      or p.codigo_membro is distinct from v_family_id
      or (v_member.birth_date is not null and p.birth_date is distinct from v_member.birth_date)
    );

  if v_member.birth_date is not null then
    perform public.refresh_profile_kids_teens_registrations(v_profile_id, v_member.birth_date);
  end if;

  return jsonb_build_object(
    'success', true,
    'profile_id', v_profile_id,
    'family_id', v_family_id
  );
end;
$$;

-- register_member_atomic: usar birth_date do membro (fonte do Gerenciar Família).
create or replace function public.register_member_atomic(
  p_event_id uuid,
  p_member_id uuid,
  p_family_group_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_member members%rowtype;
  v_profile profiles%rowtype;
  v_existing_registration_id uuid;
  v_effective_birth_date date;
  v_kids_status text;
  v_resolved_family_id text;
begin
  select *
    into v_member
  from public.members
  where id = p_member_id
    and accepted is true;

  if not found then
    return jsonb_build_object(
      'success', false,
      'message', 'Membro não encontrado ou não reconhecido pela família.'
    );
  end if;

  if v_member.family_id is not null
     and p_family_group_id is not null
     and v_member.family_id <> p_family_group_id then
    return jsonb_build_object(
      'success', false,
      'message', 'Membro não pertence à família informada.'
    );
  end if;

  v_resolved_family_id := coalesce(
    nullif(trim(coalesce(v_member.family_id, '')), ''),
    nullif(trim(coalesce(p_family_group_id, '')), '')
  );

  if v_resolved_family_id is not null
     and v_member.family_id is distinct from v_resolved_family_id then
    update public.members
    set family_id = v_resolved_family_id
    where id = v_member.id;

    v_member.family_id := v_resolved_family_id;
  end if;

  select p.*
    into v_profile
  from public.profiles p
  where p.id = public.find_profile_id_for_member_sync(v_member.phone, v_member.full_name)
  limit 1;

  if v_profile.id is null then
    return jsonb_build_object(
      'success', false,
      'message', 'Perfil vinculado ao membro não foi encontrado.'
    );
  end if;

  if v_resolved_family_id is not null then
    update public.profiles
    set
      family_id = v_resolved_family_id,
      codigo_membro = v_resolved_family_id,
      birth_date = coalesce(v_member.birth_date, birth_date)
    where id = v_profile.id
      and (
        family_id is distinct from v_resolved_family_id
        or codigo_membro is distinct from v_resolved_family_id
        or (v_member.birth_date is not null and birth_date is distinct from v_member.birth_date)
      );
  end if;

  v_effective_birth_date := coalesce(v_member.birth_date, v_profile.birth_date);
  v_kids_status := public.resolve_kids_status_from_birth_date(v_effective_birth_date);

  select er.id
    into v_existing_registration_id
  from public.event_registrations er
  where er.event_id = p_event_id
    and er.profile_id = v_profile.id
  limit 1;

  if v_existing_registration_id is not null then
    update public.event_registrations
    set
      family_id = v_resolved_family_id,
      full_name = v_member.full_name,
      kids_status = v_kids_status
    where id = v_existing_registration_id;

    return jsonb_build_object(
      'success', true,
      'message', 'Participante já estava registrado.'
    );
  end if;

  insert into public.event_registrations (
    event_id,
    profile_id,
    family_id,
    full_name,
    kids_status
  )
  values (
    p_event_id,
    v_profile.id,
    v_resolved_family_id,
    v_member.full_name,
    v_kids_status
  );

  return jsonb_build_object(
    'success', true,
    'message', 'Participante registrado com sucesso.'
  );
exception
  when others then
    return jsonb_build_object(
      'success', false,
      'message', sqlerrm
    );
end;
$$;

-- Corrige inscrições existentes com base na data de nascimento atual (member > profile).
with matched as (
  select
    p.id as profile_id,
    coalesce(m.birth_date, p.birth_date) as birth_date
  from public.members m
  join public.profiles p
    on p.id = public.find_profile_id_for_member_sync(m.phone, m.full_name)
  where m.accepted is true
)
update public.event_registrations er
set kids_status = public.resolve_kids_status_from_birth_date(matched.birth_date)
from matched
where er.profile_id = matched.profile_id
  and er.kids_status is distinct from public.resolve_kids_status_from_birth_date(matched.birth_date);
