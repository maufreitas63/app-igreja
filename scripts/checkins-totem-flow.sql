-- Fluxo Totem: pré-check-in na audiência → confirmação no totem (QR da família).
--
-- Histórico: para o MVP basta atualizar `status` + `timestamp_confirmacao` na mesma linha.
-- Não é necessária tabela de histórico até existir requisito de auditoria (reversões, múltiplas tentativas).
--
-- Execute no SQL Editor do Supabase.
--
-- Ordem (C6 — fonte única das RPCs totem; reexecutar este arquivo não remove hooks de quórum):
--   1. scripts/events-totem-ativo.sql
--   2. scripts/events-requer-quorum.sql
--   3. scripts/checkins-totem-flow.sql   ← este arquivo
--   4. scripts/events-quorum-registry.sql (tabela + sync_quorum_registry; opcional se não usar quórum)

-- ---------------------------------------------------------------------------
-- 1. Tabela checkins (1 linha por inscrição em event_registrations)
-- ---------------------------------------------------------------------------

create table if not exists public.checkins (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  event_registration_id uuid not null references public.event_registrations (id) on delete cascade,
  family_id text not null,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'pre_checkin'
    check (status in ('pre_checkin', 'confirmado')),
  created_at timestamptz not null default now(),
  timestamp_confirmacao timestamptz null
);

create unique index if not exists checkins_event_registration_uq
  on public.checkins (event_registration_id);

create index if not exists idx_checkins_event_family
  on public.checkins (event_id, family_id);

create index if not exists idx_checkins_event_status
  on public.checkins (event_id, status);

comment on table public.checkins is
  'Check-in por participante inscrito na audiência; totem confirma família via QR.';

comment on column public.checkins.status is
  'pre_checkin: inscrito com totem ativo; confirmado: leitura do QR no totem.';

comment on column public.checkins.timestamp_confirmacao is
  'Preenchido quando status passa para confirmado.';

alter table public.checkins enable row level security;

drop policy if exists checkins_select_public on public.checkins;
create policy checkins_select_public
  on public.checkins
  for select
  to anon, authenticated
  using (true);

-- Inserções/atualizações apenas via funções security definer (register_member_atomic, confirm_totem_checkin).

-- ---------------------------------------------------------------------------
-- 2. Hook opcional para event_quorum_registry (definido em events-quorum-registry.sql)
-- ---------------------------------------------------------------------------

create or replace function public.maybe_sync_quorum_registry_for_registration(
  p_event_id uuid,
  p_registration_id uuid,
  p_profile_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname = 'sync_quorum_registry_for_registration'
  ) then
    return;
  end if;

  execute 'select public.sync_quorum_registry_for_registration($1, $2, $3)'
    using p_event_id, p_registration_id, p_profile_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Sincronizar check-in ao registrar na audiência (totem_ativo / requer_quorum)
-- ---------------------------------------------------------------------------

create or replace function public.sync_checkin_for_registration(
  p_event_id uuid,
  p_registration_id uuid,
  p_family_id text,
  p_profile_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_totem_ativo boolean;
  v_requer_quorum boolean;
  v_check_in_automatico text;
  v_status text;
begin
  if p_registration_id is null or p_profile_id is null then
    return;
  end if;

  select coalesce(e.totem_ativo, false), coalesce(e.requer_quorum, false)
    into v_totem_ativo, v_requer_quorum
  from public.events e
  where e.id = p_event_id;

  if not found then
    return;
  end if;

  if coalesce(v_totem_ativo, false) or coalesce(v_requer_quorum, false) then
    v_status := 'pre_checkin';
  else
    select ap.value
      into v_check_in_automatico
    from public.app_parameters ap
    where lower(ap.parameter) = 'check_in_automatico'
    limit 1;

    -- check_In_Automatico = nao → fluxo manual com QR; sem linha em checkins aqui.
    if lower(trim(coalesce(v_check_in_automatico, ''))) = 'nao' then
      perform public.maybe_sync_quorum_registry_for_registration(
        p_event_id,
        p_registration_id,
        p_profile_id
      );
      return;
    end if;

    v_status := 'confirmado';
  end if;

  insert into public.checkins (
    event_id,
    event_registration_id,
    family_id,
    profile_id,
    status,
    timestamp_confirmacao
  )
  values (
    p_event_id,
    p_registration_id,
    upper(trim(coalesce(nullif(trim(p_family_id), ''), '—'))),
    p_profile_id,
    v_status,
    case when v_status = 'confirmado' then now() else null end
  )
  on conflict (event_registration_id) do update
  set
    family_id = excluded.family_id,
    profile_id = excluded.profile_id,
    status = case
      when public.checkins.status = 'confirmado' then 'confirmado'
      else excluded.status
    end,
    timestamp_confirmacao = case
      when excluded.status = 'confirmado' then coalesce(public.checkins.timestamp_confirmacao, now())
      else public.checkins.timestamp_confirmacao
    end;

  perform public.maybe_sync_quorum_registry_for_registration(
    p_event_id,
    p_registration_id,
    p_profile_id
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Consulta e confirmação no totem (SELECT antes do UPDATE)
-- ---------------------------------------------------------------------------

create or replace function public.lookup_totem_checkin(
  p_event_id uuid,
  p_family_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_totem_ativo boolean;
  v_requer_quorum boolean;
  v_pre_count integer;
  v_confirmed_count integer;
  v_family text;
begin
  v_family := upper(nullif(trim(coalesce(p_family_id, '')), ''));

  if v_family is null then
    return jsonb_build_object(
      'success', false,
      'code', 'NOT_FOUND',
      'message', 'Código da família inválido.'
    );
  end if;

  select coalesce(e.totem_ativo, false), coalesce(e.requer_quorum, false)
    into v_totem_ativo, v_requer_quorum
  from public.events e
  where e.id = p_event_id;

  if not found then
    return jsonb_build_object(
      'success', false,
      'code', 'EVENT_NOT_FOUND',
      'message', 'Evento não encontrado.'
    );
  end if;

  if not coalesce(v_totem_ativo, false) and not coalesce(v_requer_quorum, false) then
    return jsonb_build_object(
      'success', false,
      'code', 'TOTEM_INACTIVE',
      'message', 'Totem não está ativo para este evento.'
    );
  end if;

  select
    count(*) filter (where c.status = 'pre_checkin'),
    count(*) filter (where c.status = 'confirmado')
  into v_pre_count, v_confirmed_count
  from public.checkins c
  where c.event_id = p_event_id
    and upper(trim(c.family_id)) = v_family;

  return jsonb_build_object(
    'success', true,
    'pre_checkin_count', coalesce(v_pre_count, 0),
    'confirmed_count', coalesce(v_confirmed_count, 0),
    'can_confirm', coalesce(v_pre_count, 0) > 0,
    'already_confirmed', coalesce(v_pre_count, 0) = 0 and coalesce(v_confirmed_count, 0) > 0
  );
end;
$$;

create or replace function public.confirm_totem_checkin(
  p_event_id uuid,
  p_family_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lookup jsonb;
  v_updated integer;
  v_row record;
begin
  v_lookup := public.lookup_totem_checkin(p_event_id, p_family_id);

  if coalesce((v_lookup ->> 'success')::boolean, false) is not true then
    return v_lookup;
  end if;

  if coalesce((v_lookup ->> 'already_confirmed')::boolean, false) then
    return jsonb_build_object(
      'success', false,
      'code', 'ALREADY_CONFIRMED',
      'message', 'Check-in já confirmado para esta família.'
    );
  end if;

  if coalesce((v_lookup ->> 'can_confirm')::boolean, false) is not true then
    return jsonb_build_object(
      'success', false,
      'code', 'NOT_FOUND',
      'message', 'Nenhum pré-check-in encontrado para esta família neste evento.'
    );
  end if;

  update public.checkins c
  set
    status = 'confirmado',
    timestamp_confirmacao = now()
  where c.event_id = p_event_id
    and upper(trim(c.family_id)) = upper(trim(p_family_id))
    and c.status = 'pre_checkin';

  get diagnostics v_updated = row_count;

  if v_updated = 0 then
    return jsonb_build_object(
      'success', false,
      'code', 'NOT_FOUND',
      'message', 'Nenhum pré-check-in pendente para confirmar.'
    );
  end if;

  for v_row in
    select c.event_registration_id, c.profile_id
    from public.checkins c
    where c.event_id = p_event_id
      and upper(trim(c.family_id)) = upper(trim(p_family_id))
      and c.status = 'confirmado'
  loop
    perform public.maybe_sync_quorum_registry_for_registration(
      p_event_id,
      v_row.event_registration_id,
      v_row.profile_id
    );
  end loop;

  return jsonb_build_object(
    'success', true,
    'code', 'CONFIRMED',
    'message', 'Confirmação realizada com sucesso',
    'updated_count', v_updated
  );
exception
  when others then
    return jsonb_build_object(
      'success', false,
      'code', 'NOT_FOUND',
      'message', sqlerrm
    );
end;
$$;

grant execute on function public.maybe_sync_quorum_registry_for_registration(uuid, uuid, uuid) to anon, authenticated, service_role;
grant execute on function public.sync_checkin_for_registration(uuid, uuid, text, uuid) to anon;
grant execute on function public.sync_checkin_for_registration(uuid, uuid, text, uuid) to authenticated;
grant execute on function public.lookup_totem_checkin(uuid, text) to anon;
grant execute on function public.lookup_totem_checkin(uuid, text) to authenticated;
grant execute on function public.confirm_totem_checkin(uuid, text) to anon;
grant execute on function public.confirm_totem_checkin(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Patch register_member_atomic — cria pré-check-in quando totem_ativo
-- ---------------------------------------------------------------------------

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
  v_registration_id uuid;
  v_age_years integer;
  v_idade_kids integer;
  v_idade_teens integer;
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
      codigo_membro = v_resolved_family_id
    where id = v_profile.id
      and (
        family_id is distinct from v_resolved_family_id
        or codigo_membro is distinct from v_resolved_family_id
      );
  end if;

  select
    case
      when trim(ap.value) ~ '^\d+$' then trim(ap.value)::integer
      else null
    end
    into v_idade_kids
  from public.app_parameters ap
  where lower(ap.parameter) = 'idade_kids'
  limit 1;

  select
    case
      when trim(ap.value) ~ '^\d+$' then trim(ap.value)::integer
      else null
    end
    into v_idade_teens
  from public.app_parameters ap
  where lower(ap.parameter) = 'idade_teens'
  limit 1;

  if v_profile.birth_date is not null then
    v_age_years := extract(year from age(current_date, v_profile.birth_date::date))::integer;

    if v_idade_kids is not null and v_age_years <= v_idade_kids then
      v_kids_status := 'KIDS';
    elsif
      v_idade_kids is not null
      and v_idade_teens is not null
      and v_age_years > v_idade_kids
      and v_age_years <= v_idade_teens
    then
      v_kids_status := 'TEENS';
    end if;
  end if;

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

    perform public.sync_checkin_for_registration(
      p_event_id,
      v_existing_registration_id,
      v_resolved_family_id,
      v_profile.id
    );

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
  )
  returning id into v_registration_id;

  perform public.sync_checkin_for_registration(
    p_event_id,
    v_registration_id,
    v_resolved_family_id,
    v_profile.id
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

grant execute on function public.register_member_atomic(uuid, uuid, text) to anon;
grant execute on function public.register_member_atomic(uuid, uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 6. Garantia automática (app chama ao abrir o totem / antes do scan)
-- ---------------------------------------------------------------------------

create or replace function public.ensure_totem_checkin_flow()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.checkins (
    event_id,
    event_registration_id,
    family_id,
    profile_id,
    status,
    timestamp_confirmacao
  )
  select
    er.event_id,
    er.id,
    upper(trim(coalesce(nullif(trim(er.family_id), ''), '—'))),
    er.profile_id,
    'pre_checkin',
    null
  from public.event_registrations er
  inner join public.events e on e.id = er.event_id
  where er.profile_id is not null
    and (
      coalesce(e.totem_ativo, false) = true
      or coalesce(e.requer_quorum, false) = true
    )
    and not exists (
      select 1
      from public.checkins c
      where c.event_registration_id = er.id
    );

  return true;
exception
  when undefined_table then
    raise exception
      'Tabela checkins ausente. Execute scripts/checkins-totem-flow.sql no Supabase.';
end;
$$;

grant execute on function public.ensure_totem_checkin_flow() to anon, authenticated, service_role;

comment on function public.ensure_totem_checkin_flow is
  'Cria pré-check-in faltante para inscrições em eventos com totem_ativo ou requer_quorum (idempotente).';

notify pgrst, 'reload schema';
