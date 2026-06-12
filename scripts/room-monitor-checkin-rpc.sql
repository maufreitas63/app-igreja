-- Check-in Kids/Teens: somente monitores escalados na data do evento.
-- Execute no SQL Editor do Supabase após vigilancia-escalas.sql e get-app-parameter-value.sql.

create or replace function public.normalize_person_name(p_name text)
returns text
language sql
immutable
as $$
  select lower(
    trim(
      translate(
        coalesce(p_name, ''),
        'ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇçÑñ',
        'AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCcNn'
      )
    )
  );
$$;

create or replace function public.normalize_scale_token(p_value text)
returns text
language sql
immutable
as $$
  select regexp_replace(public.normalize_person_name(p_value), '[^a-z0-9]+', '', 'g');
$$;

create or replace function public.is_kids_room_monitor_scale(
  p_codigo text,
  p_nome text,
  p_configured_code text default null
)
returns boolean
language sql
immutable
as $$
  select
    (
      coalesce(public.normalize_scale_token(p_configured_code), '') <> ''
      and public.normalize_scale_token(p_codigo) = public.normalize_scale_token(p_configured_code)
    )
    or (
      public.normalize_person_name(p_nome) like '%monitor%'
      and public.normalize_person_name(p_nome) like '%kids%'
    )
    or (
      public.normalize_person_name(p_nome) like '%sala%'
      and public.normalize_person_name(p_nome) like '%kids%'
    )
    or public.normalize_person_name(p_nome) like '%ibn kids%'
    or public.normalize_person_name(p_nome) like '%ibnkids%'
    or public.normalize_person_name(p_codigo) like '%monitor_kids%'
    or public.normalize_person_name(p_codigo) like '%sala_kids%'
    or public.normalize_person_name(p_codigo) like '%ibn_kids%'
    or public.normalize_person_name(p_codigo) = 'monitor_ibn_kids';
$$;

create or replace function public.is_teens_room_monitor_scale(
  p_codigo text,
  p_nome text,
  p_configured_code text default null
)
returns boolean
language sql
immutable
as $$
  select
    (
      coalesce(public.normalize_scale_token(p_configured_code), '') <> ''
      and public.normalize_scale_token(p_codigo) = public.normalize_scale_token(p_configured_code)
    )
    or (
      public.normalize_person_name(p_nome) like '%monitor%'
      and public.normalize_person_name(p_nome) like '%teens%'
    )
    or (
      public.normalize_person_name(p_nome) like '%sala%'
      and public.normalize_person_name(p_nome) like '%teens%'
    )
    or public.normalize_person_name(p_nome) like '%ibn teens%'
    or public.normalize_person_name(p_nome) like '%ibnteens%'
    or public.normalize_person_name(p_codigo) like '%monitor_teens%'
    or public.normalize_person_name(p_codigo) like '%sala_teens%'
    or public.normalize_person_name(p_codigo) like '%ibn_teens%'
    or public.normalize_person_name(p_codigo) = 'monitor_ibn_teens';
$$;

create or replace function public.profile_is_room_monitor_on_date(
  p_profile_id uuid,
  p_room text,
  p_service_date date
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_profile_name text;
  v_kids_code text;
  v_teens_code text;
begin
  if p_profile_id is null or p_service_date is null then
    return false;
  end if;

  if public.is_super_admin_profile(p_profile_id) then
    return true;
  end if;

  select p.full_name
    into v_profile_name
    from public.profiles p
   where p.id = p_profile_id
   limit 1;

  if coalesce(trim(v_profile_name), '') = '' then
    return false;
  end if;

  v_kids_code := public.get_app_parameter_value('escala_codigo_monitor_kids');
  v_teens_code := public.get_app_parameter_value('escala_codigo_monitor_teens');

  return exists (
    select 1
      from public.escalas_log el
      join public.tipos_escala te on te.id = el.tipo_escala_id
      join public.voluntarios_escala ve on ve.id = el.voluntario_id
     where el.data_servico = p_service_date
       and te.is_ativa = true
       and (
         (
           upper(trim(coalesce(p_room, ''))) = 'KIDS'
           and public.is_kids_room_monitor_scale(te.codigo, te.nome, v_kids_code)
         )
         or (
           upper(trim(coalesce(p_room, ''))) = 'TEENS'
           and public.is_teens_room_monitor_scale(te.codigo, te.nome, v_teens_code)
         )
       )
       and (
         public.normalize_person_name(ve.nome) = public.normalize_person_name(v_profile_name)
         or public.normalize_person_name(ve.nome) = public.normalize_person_name(
           split_part(trim(v_profile_name), ' ', 1)
           || ' '
           || reverse(split_part(reverse(trim(v_profile_name)), ' ', 1))
         )
       )
  );
end;
$$;

drop function if exists public.set_event_registration_room_entry(uuid, boolean);

create or replace function public.set_event_registration_room_entry(
  p_registration_id uuid,
  p_room_entry_checked boolean,
  p_actor_profile_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_date timestamptz;
  v_service_date date;
  v_kids_status text;
begin
  select er.kids_status, ev.event_date
    into v_kids_status, v_event_date
    from public.event_registrations er
    join public.events ev on ev.id = er.event_id
   where er.id = p_registration_id;

  if v_kids_status is null then
    return jsonb_build_object(
      'success', false,
      'message', 'Inscrição do evento não encontrada.'
    );
  end if;

  if v_kids_status not in ('KIDS', 'TEENS') then
    return jsonb_build_object(
      'success', false,
      'message', 'Esta inscrição não pertence a IBN KIDS ou IBN TEENS.'
    );
  end if;

  v_service_date := (v_event_date at time zone 'America/Sao_Paulo')::date;

  if p_actor_profile_id is null then
    return jsonb_build_object(
      'success', false,
      'message', 'Sessão inválida. Saia e entre novamente no aplicativo.'
    );
  end if;

  if not public.profile_is_room_monitor_on_date(p_actor_profile_id, v_kids_status, v_service_date) then
    return jsonb_build_object(
      'success', false,
      'message',
      'Somente monitores escalados para esta sala na data do evento podem registrar o check-in.'
    );
  end if;

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

grant execute on function public.normalize_person_name(text) to anon, authenticated;
grant execute on function public.normalize_scale_token(text) to anon, authenticated;
grant execute on function public.is_kids_room_monitor_scale(text, text, text) to anon, authenticated;
grant execute on function public.is_teens_room_monitor_scale(text, text, text) to anon, authenticated;
grant execute on function public.profile_is_room_monitor_on_date(uuid, text, date) to anon, authenticated;
grant execute on function public.set_event_registration_room_entry(uuid, boolean, uuid) to anon, authenticated;
