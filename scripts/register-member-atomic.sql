-- Atualiza a RPC `register_member_atomic` para gravar
-- `family_id`, `full_name` e `kids_status` em `public.event_registrations`.
-- Também centraliza a sincronização de família entre
-- `public.members.family_id`, `public.profiles.family_id`
-- e `public.profiles.codigo_membro`.
--
-- Execute este script no SQL Editor do Supabase.
-- Ele já inclui o ajuste de schema necessário para a tabela.

drop function if exists public.register_member_atomic(uuid, uuid, uuid);
drop function if exists public.unregister_member_atomic(uuid, uuid, uuid);
drop function if exists public.get_registered_event_members(uuid, text);
drop function if exists public.get_event_registrations_by_status(uuid);
drop function if exists public.get_event_registration_count(uuid);
drop function if exists public.set_event_registration_room_entry(uuid, boolean);
drop trigger if exists trg_sync_profile_family_from_member on public.members;
drop trigger if exists trg_sync_member_family_from_profile on public.profiles;
drop function if exists public.sync_profile_family_from_member();
drop function if exists public.sync_member_family_from_profile();
drop function if exists public.find_profile_id_for_member_sync(text, text);
drop function if exists public.find_member_id_for_profile_sync(text, text);
drop function if exists public.normalize_phone_for_sync(text);
drop function if exists public.get_family_id_prefix();
drop function if exists public.reserve_next_family_id();
drop function if exists public.update_profile_field(uuid, text, jsonb);

alter table public.event_registrations
  add column if not exists family_id text,
  add column if not exists full_name text,
  add column if not exists kids_status text,
  add column if not exists room_entry_checked boolean not null default false;

alter table public.profiles
  add column if not exists family_id text;

do $$
declare
  v_index record;
begin
  begin
    alter table public.profiles
      drop constraint if exists profiles_codigo_membro_key;
  exception
    when undefined_object then
      null;
  end;

  for v_index in
    select indexname
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'profiles'
      and indexdef ilike 'create unique index%'
      and indexdef ilike '%(codigo_membro)%'
  loop
    execute format('drop index if exists public.%I', v_index.indexname);
  end loop;
end
$$;

create index if not exists idx_event_registrations_family_id
  on public.event_registrations (family_id);

create index if not exists idx_event_registrations_full_name
  on public.event_registrations (full_name);

create index if not exists idx_profiles_family_id
  on public.profiles (family_id);

create index if not exists idx_profiles_codigo_membro
  on public.profiles (codigo_membro);

create or replace function public.normalize_phone_for_sync(p_value text)
returns text
language sql
immutable
security definer
set search_path = public
as $$
  select regexp_replace(coalesce(p_value, ''), '\D', '', 'g');
$$;

create or replace function public.find_profile_id_for_member_sync(
  p_phone text,
  p_full_name text
)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select p.id
  from public.profiles p
  where
    (
      p_phone is not null
      and (
        p.phone = p_phone
        or public.normalize_phone_for_sync(p.phone) = public.normalize_phone_for_sync(p_phone)
      )
    )
    or (
      nullif(trim(coalesce(p_full_name, '')), '') is not null
      and lower(trim(coalesce(p.full_name, ''))) = lower(trim(p_full_name))
    )
  order by
    case
      when p_phone is not null and p.phone = p_phone then 0
      when p_phone is not null and public.normalize_phone_for_sync(p.phone) = public.normalize_phone_for_sync(p_phone) then 1
      else 2
    end,
    p.id
  limit 1;
$$;

create or replace function public.find_member_id_for_profile_sync(
  p_phone text,
  p_full_name text
)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select m.id
  from public.members m
  where m.accepted is true
    and (
      p_phone is not null
      and (
        m.phone = p_phone
        or public.normalize_phone_for_sync(m.phone) = public.normalize_phone_for_sync(p_phone)
      )
    )
    or (
      nullif(trim(coalesce(p_full_name, '')), '') is not null
      and lower(trim(coalesce(m.full_name, ''))) = lower(trim(p_full_name))
    )
  order by
    case
      when p_phone is not null and m.phone = p_phone then 0
      when p_phone is not null and public.normalize_phone_for_sync(m.phone) = public.normalize_phone_for_sync(p_phone) then 1
      else 2
    end,
    m.id
  limit 1;
$$;

-- Prefixo dos codigos de familia (ex.: IBN0001): valor de app_parameters.parm_entidade
-- (apenas letras e numeros, em maiusculas). Se vazio ou inexistente, usa IBN.
create or replace function public.get_family_id_prefix()
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_raw text;
  v_clean text;
begin
  select trim(ap.value)
  into v_raw
  from public.app_parameters ap
  where lower(ap.parameter) = 'parm_entidade'
  limit 1;

  v_clean := upper(regexp_replace(coalesce(v_raw, ''), '[^A-Za-z0-9]', '', 'g'));
  if v_clean is null or v_clean = '' then
    return 'IBN';
  end if;

  return v_clean;
end;
$$;

create or replace function public.reserve_next_family_id()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prefix text;
  v_param_last int;
  v_family_ref_num int;
  v_max_suffix int;
  v_base int;
  v_next int;
  v_new_id text;
begin
  perform pg_advisory_xact_lock(4821901);

  v_prefix := public.get_family_id_prefix();

  -- Ultimo sufixo numerico emitido (parametro dedicado); aceita legado IBN se prefixo mudou.
  select
    case
      when trim(ap.value) ~ ('^' || v_prefix || '\d+$') then
        substring(trim(ap.value) from (v_prefix || '(\d+)$'))::integer
      when v_prefix is distinct from 'IBN' and trim(ap.value) ~ '^IBN\d+$' then
        substring(trim(ap.value) from 'IBN(\d+)$')::integer
      when trim(ap.value) ~ '^\d+$' then trim(ap.value)::integer
      else null
    end
  into v_param_last
  from public.app_parameters ap
  where lower(ap.parameter) = 'last_family_id'
  limit 1;

  -- Legado: family_ref guardava o proximo indice (ultimo emitido + 1).
  select
    case
      when trim(ap.value) ~ '^\d+$' then trim(ap.value)::integer
      else null
    end
  into v_family_ref_num
  from public.app_parameters ap
  where lower(ap.parameter) = 'family_ref'
  limit 1;

  select coalesce(max(t.n), 0)
  into v_max_suffix
  from (
    select substring(trim(m.family_id) from (v_prefix || '(\d+)$'))::integer as n
    from public.members m
    where trim(coalesce(m.family_id, '')) ~ ('^' || v_prefix || '\d+$')
    union all
    select substring(trim(m.family_id) from 'IBN(\d+)$')::integer as n
    from public.members m
    where v_prefix is distinct from 'IBN' and trim(coalesce(m.family_id, '')) ~ '^IBN\d+$'
    union all
    select substring(trim(p.family_id) from (v_prefix || '(\d+)$'))::integer as n
    from public.profiles p
    where trim(coalesce(p.family_id, '')) ~ ('^' || v_prefix || '\d+$')
    union all
    select substring(trim(p.family_id) from 'IBN(\d+)$')::integer as n
    from public.profiles p
    where v_prefix is distinct from 'IBN' and trim(coalesce(p.family_id, '')) ~ '^IBN\d+$'
    union all
    select substring(trim(p.codigo_membro) from (v_prefix || '(\d+)$'))::integer as n
    from public.profiles p
    where trim(coalesce(p.codigo_membro, '')) ~ ('^' || v_prefix || '\d+$')
    union all
    select substring(trim(p.codigo_membro) from 'IBN(\d+)$')::integer as n
    from public.profiles p
    where v_prefix is distinct from 'IBN' and trim(coalesce(p.codigo_membro, '')) ~ '^IBN\d+$'
  ) t;

  v_base := greatest(
    coalesce(v_param_last, case when v_family_ref_num is not null then v_family_ref_num - 1 else null end, 0),
    v_max_suffix
  );

  v_next := v_base + 1;
  v_new_id := v_prefix || lpad(v_next::text, 4, '0');

  update public.app_parameters
  set value = v_next::text
  where lower(parameter) = 'last_family_id';

  if not found then
    insert into public.app_parameters (parameter, value)
    values ('last_family_id', v_next::text);
  end if;

  -- Mantem compat com leituras existentes (ex.: resolveCurrentFamilyId em lib/family.ts).
  update public.app_parameters
  set value = (v_next + 1)::text
  where lower(parameter) = 'family_ref';

  if not found then
    insert into public.app_parameters (parameter, value)
    values ('family_ref', (v_next + 1)::text);
  end if;

  return v_new_id;
end;
$$;

update public.profiles p
set
  family_id = synced.family_id,
  codigo_membro = synced.family_id
from (
  select
    id,
    coalesce(nullif(trim(family_id), ''), nullif(trim(codigo_membro), '')) as family_id
  from public.profiles
) as synced
where p.id = synced.id
  and synced.family_id is not null
  and (
    p.family_id is distinct from synced.family_id
    or p.codigo_membro is distinct from synced.family_id
  );

with matched_profiles as (
  select
    m.id as member_id,
    public.find_profile_id_for_member_sync(m.phone, m.full_name) as profile_id,
    nullif(trim(m.family_id), '') as family_id
  from public.members m
)
update public.profiles p
set
  family_id = matched_profiles.family_id,
  codigo_membro = matched_profiles.family_id
from matched_profiles
where p.id = matched_profiles.profile_id
  and matched_profiles.family_id is not null
  and (
    p.family_id is distinct from matched_profiles.family_id
    or p.codigo_membro is distinct from matched_profiles.family_id
  );

with matched_members as (
  select
    p.id as profile_id,
    public.find_member_id_for_profile_sync(p.phone, p.full_name) as member_id,
    coalesce(nullif(trim(p.family_id), ''), nullif(trim(p.codigo_membro), '')) as family_id
  from public.profiles p
)
update public.members m
set family_id = matched_members.family_id
from matched_members
where m.id = matched_members.member_id
  and matched_members.family_id is not null
  and m.family_id is distinct from matched_members.family_id;

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
    family_id = v_family_id,
    codigo_membro = v_family_id
  where p.id = v_profile_id
    and (
      p.family_id is distinct from v_family_id
      or p.codigo_membro is distinct from v_family_id
    );

  return new;
end;
$$;

create or replace function public.sync_member_family_from_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_member_id uuid;
  v_family_id text;
begin
  if pg_trigger_depth() > 1 then
    return new;
  end if;

  if
    tg_op = 'UPDATE'
    and new.codigo_membro is distinct from old.codigo_membro
    and new.family_id is not distinct from old.family_id
  then
    v_family_id := nullif(trim(coalesce(new.codigo_membro, '')), '');
  elsif tg_op = 'UPDATE' and new.family_id is distinct from old.family_id then
    v_family_id := nullif(trim(coalesce(new.family_id, '')), '');
  else
    v_family_id := coalesce(
      nullif(trim(coalesce(new.family_id, '')), ''),
      nullif(trim(coalesce(new.codigo_membro, '')), '')
    );
  end if;

  update public.profiles p
  set
    family_id = v_family_id,
    codigo_membro = v_family_id
  where p.id = new.id
    and (
      p.family_id is distinct from v_family_id
      or p.codigo_membro is distinct from v_family_id
    );

  v_member_id := public.find_member_id_for_profile_sync(new.phone, new.full_name);

  if v_member_id is null then
    return new;
  end if;

  update public.members m
  set family_id = v_family_id
  where m.id = v_member_id
    and m.family_id is distinct from v_family_id;

  return new;
end;
$$;

create trigger trg_sync_profile_family_from_member
after insert or update of family_id, phone, full_name
on public.members
for each row
execute function public.sync_profile_family_from_member();

create trigger trg_sync_member_family_from_profile
after insert or update of family_id, codigo_membro, phone, full_name
on public.profiles
for each row
execute function public.sync_member_family_from_profile();

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

  v_kids_status := public.resolve_kids_status_from_birth_date(
    coalesce(v_member.birth_date, v_profile.birth_date)
  );

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

create or replace function public.unregister_member_atomic(
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
  v_profile_id uuid;
  v_deleted_count integer;
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

  select public.find_profile_id_for_member_sync(v_member.phone, v_member.full_name)
    into v_profile_id;

  if v_profile_id is null then
    return jsonb_build_object(
      'success', false,
      'message', 'Perfil vinculado ao membro não foi encontrado.'
    );
  end if;

  delete from public.event_registrations er
  where er.event_id = p_event_id
    and er.profile_id = v_profile_id;

  get diagnostics v_deleted_count = row_count;

  if v_deleted_count = 0 then
    return jsonb_build_object(
      'success', true,
      'message', 'Participante já não estava registrado.'
    );
  end if;

  return jsonb_build_object(
    'success', true,
    'message', 'Participante removido do evento com sucesso.'
  );
exception
  when others then
    return jsonb_build_object(
      'success', false,
      'message', sqlerrm
    );
end;
$$;

create or replace function public.get_registered_event_members(
  p_event_id uuid,
  p_family_id text
)
returns table (
  profile_id uuid,
  family_id text,
  full_name text,
  kids_status text
)
language sql
security definer
set search_path = public
as $$
  select
    er.profile_id,
    er.family_id,
    er.full_name,
    er.kids_status
  from public.event_registrations er
  where er.event_id = p_event_id
    and er.family_id = p_family_id
  order by er.created_at desc;
$$;

create or replace function public.get_event_registration_count(
  p_event_id uuid
)
returns bigint
language sql
security definer
set search_path = public
as $$
  select count(*)
  from public.event_registrations er
  where er.event_id = p_event_id;
$$;

create or replace function public.get_event_registrations_by_status(
  p_event_id uuid
)
returns table (
  registration_id uuid,
  full_name text,
  kids_status text,
  room_entry_checked boolean
)
language sql
security definer
set search_path = public
as $$
  select
    er.id,
    er.full_name,
    er.kids_status,
    er.room_entry_checked
  from public.event_registrations er
  where er.event_id = p_event_id
    and er.kids_status in ('KIDS', 'TEENS')
  order by er.kids_status asc, er.full_name asc;
$$;

create or replace function public.set_event_registration_room_entry(
  p_registration_id uuid,
  p_room_entry_checked boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.event_registrations
  set room_entry_checked = coalesce(p_room_entry_checked, false)
  where id = p_registration_id;

  if not found then
    return jsonb_build_object(
      'success', false,
      'message', 'Inscrição do evento não encontrada.'
    );
  end if;

  return jsonb_build_object(
    'success', true,
    'message', 'Entrada na sala atualizada com sucesso.'
  );
exception
  when others then
    return jsonb_build_object(
      'success', false,
      'message', sqlerrm
    );
end;
$$;

create or replace function public.update_profile_field(
  p_profile_id uuid,
  p_field text,
  p_value jsonb default 'null'::jsonb,
  p_actor_profile_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_field text;
  v_actor_id uuid;
  v_column_key text;
  v_updated public.profiles%rowtype;
begin
  if p_profile_id is null then
    raise exception 'Perfil não informado.';
  end if;

  v_field := trim(coalesce(p_field, ''));

  if v_field = '' then
    raise exception 'Campo não informado.';
  end if;

  if lower(v_field) = any(array['id', 'created_at', 'updated_at', 'auth_user_id', 'access_pin']) then
    raise exception 'Campo protegido: %', v_field;
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = v_field
  ) then
    raise exception 'Campo inexistente em profiles: %', v_field;
  end if;

  v_actor_id := coalesce(p_actor_profile_id, p_profile_id);
  v_column_key := 'profiles.' || v_field;

  if exists (
    select 1
      from public.access_resources r
     where r.resource_type = 'column'
       and r.is_active = true
       and public.access_resource_matches(r.resource_key, v_column_key)
  )
  and not public.profile_has_access(v_actor_id, 'column', v_column_key, 'update') then
    raise exception 'Você não tem permissão para alterar este campo.';
  end if;

  execute format(
    'update public.profiles as p
        set %1$I = (jsonb_populate_record(null::public.profiles, jsonb_build_object(%2$L, $1))).%1$I,
            updated_at = now()
      where p.id = $2
      returning p.*',
    v_field,
    v_field
  )
  using p_value, p_profile_id
  into v_updated;

  if v_updated.id is null then
    raise exception 'Perfil não encontrado ou sem permissão para atualizar.';
  end if;

  return to_jsonb(v_updated);
end;
$$;

grant execute on function public.get_registered_event_members(uuid, text) to anon;
grant execute on function public.get_registered_event_members(uuid, text) to authenticated;
grant execute on function public.get_event_registration_count(uuid) to anon;
grant execute on function public.get_event_registration_count(uuid) to authenticated;
grant execute on function public.get_event_registrations_by_status(uuid) to anon;
grant execute on function public.get_event_registrations_by_status(uuid) to authenticated;
grant execute on function public.set_event_registration_room_entry(uuid, boolean) to anon;
grant execute on function public.set_event_registration_room_entry(uuid, boolean) to authenticated;
grant execute on function public.reserve_next_family_id() to anon;
grant execute on function public.reserve_next_family_id() to authenticated;
grant execute on function public.get_family_id_prefix() to anon;
grant execute on function public.get_family_id_prefix() to authenticated;
grant execute on function public.update_profile_field(uuid, text, jsonb, uuid) to anon;
grant execute on function public.update_profile_field(uuid, text, jsonb, uuid) to authenticated;
