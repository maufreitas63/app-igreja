-- Álbum de inscritos da sala: selfie, idade, alertas e responsáveis
-- só da instância da sessão, e só para quem vê Sala(s) ou tem o papel Ministério Infantil.

create or replace function public.get_room_roster_album(
  p_event_id uuid,
  p_room_key text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
  v_actor uuid := public.current_session_profile_id();
  v_room text := upper(nullif(trim(coalesce(p_room_key, '')), ''));
  v_allowed boolean := false;
  v_children jsonb := '[]'::jsonb;
begin
  if v_actor is null or p_event_id is null or v_room not in ('KIDS', 'TEENS') then
    return jsonb_build_object(
      'allowed', false,
      'message', 'Sem permissão para ver o álbum de inscritos nesta instância.',
      'children', '[]'::jsonb
    );
  end if;

  if not exists (
    select 1
      from public.profiles p
     where p.id = v_actor
       and (
         p.tenant_id = v_tenant
         or public.is_super_admin_profile(p.id)
       )
  ) then
    return jsonb_build_object(
      'allowed', false,
      'message', 'Sem permissão para ver o álbum de inscritos nesta instância.',
      'children', '[]'::jsonb
    );
  end if;

  v_allowed :=
    public.profile_has_access(v_actor, 'screen', 'maintenance.card.sala_servidor', 'view')
    or public.profile_has_role_code(v_actor, 'ministerio_infantil')
    or exists (
      select 1
        from public.events e
       where e.id = p_event_id
         and e.tenant_id = v_tenant
         and public.profile_is_room_servidor_on_date(
           v_actor,
           v_room,
           (e.event_date at time zone 'America/Sao_Paulo')::date
         )
    );

  if not v_allowed then
    return jsonb_build_object(
      'allowed', false,
      'message', 'Sem permissão para ver o álbum de inscritos nesta instância.',
      'children', '[]'::jsonb
    );
  end if;

  if not exists (
    select 1
      from public.events e
     where e.id = p_event_id
       and e.tenant_id = v_tenant
  ) then
    return jsonb_build_object(
      'allowed', true,
      'message', null,
      'children', '[]'::jsonb
    );
  end if;

  select coalesce(jsonb_agg(child.payload order by child.sort_name), '[]'::jsonb)
    into v_children
    from (
      select
        public.normalize_person_name(er.full_name) as sort_name,
        jsonb_build_object(
          'id', er.id,
          'fullName', er.full_name,
          'birthDate', case
            when prof.birth_date is null then ''
            else to_char(prof.birth_date::date, 'YYYY-MM-DD')
          end,
          'ageYears', case
            when prof.birth_date is null then 0
            else extract(year from age(current_date, prof.birth_date::date))::int
          end,
          'selfieUrl', nullif(trim(coalesce(prof.selfie_url, '')), ''),
          'medicalFoodAlerts', nullif(trim(coalesce(prof.medical_food_alerts, '')), ''),
          'specialNeedsNotes', nullif(
            trim(concat_ws(
              E'\n',
              nullif(trim(coalesce(prof.additional_care_notes, '')), ''),
              nullif(trim(coalesce(prof.special_needs, '')), '')
            )),
            ''
          ),
          'familyId', coalesce(nullif(trim(er.family_id), ''), nullif(trim(prof.family_id), ''), ''),
          'checkinStatus', case
            when coalesce(er.room_released, false) and coalesce(er.room_entry_checked, false) then 'released'
            when coalesce(er.room_entry_checked, false) then 'in_room'
            else 'pending'
          end,
          'checkinTime', null,
          'guardians', coalesce((
            select jsonb_agg(
              jsonb_build_object(
                'id', g.id,
                'fullName', g.full_name,
                'relationship', coalesce(g.relationship, ''),
                'phone', coalesce(g.phone, '')
              )
              order by g.full_name
            )
              from public.members g
             where g.tenant_id = v_tenant
               and g.accepted is true
               and nullif(trim(g.family_id), '') is not null
               and upper(trim(g.family_id)) = upper(trim(coalesce(nullif(trim(er.family_id), ''), prof.family_id)))
               and public.normalize_person_name(g.full_name) <> public.normalize_person_name(er.full_name)
               and (
                 public.normalize_person_name(coalesce(g.relationship, '')) similar to '%(pai|mae|conjuge|responsavel|representante|tutor|avo)%'
                 or (
                   nullif(trim(coalesce(g.phone, '')), '') is not null
                   and public.normalize_person_name(coalesce(g.relationship, '')) not similar to '%(filho|filha|irmao|irma|neto|neta)%'
                 )
               )
          ), '[]'::jsonb)
        ) as payload
      from public.event_registrations er
      left join lateral (
        select p.birth_date, p.selfie_url, p.medical_food_alerts, p.additional_care_notes, p.special_needs, p.family_id
          from public.profiles p
         where p.tenant_id = v_tenant
           and (
             (er.profile_id is not null and p.id = er.profile_id)
             or (
               er.profile_id is null
               and public.normalize_person_name(p.full_name) = public.normalize_person_name(er.full_name)
               and (
                 nullif(trim(er.family_id), '') is null
                 or upper(trim(p.family_id)) = upper(trim(er.family_id))
               )
             )
           )
         order by case when er.profile_id is not null and p.id = er.profile_id then 0 else 1 end
         limit 1
      ) prof on true
     where er.tenant_id = v_tenant
       and er.event_id = p_event_id
       and er.kids_status = v_room
       and not (coalesce(er.room_released, false) and not coalesce(er.room_entry_checked, false))
    ) child;

  return jsonb_build_object(
    'allowed', true,
    'message', null,
    'children', v_children
  );
end;
$$;

grant execute on function public.get_room_roster_album(uuid, text) to anon, authenticated;

-- Libera uma criança para retirada sem finalizar a sala inteira.
create or replace function public.set_event_registration_room_release(
  p_registration_id uuid,
  p_actor_profile_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
  v_actor uuid := coalesce(p_actor_profile_id, public.current_session_profile_id());
  v_event_date timestamptz;
  v_service_date date;
  v_kids_status text;
begin
  if v_actor is null then
    return jsonb_build_object('success', false, 'message', 'Sessão inválida.');
  end if;

  if not exists (
    select 1
      from public.profiles p
     where p.id = v_actor
       and p.tenant_id = v_tenant
  ) then
    return jsonb_build_object('success', false, 'message', 'Operador sem permissão nesta instância.');
  end if;

  select er.kids_status, ev.event_date
    into v_kids_status, v_event_date
    from public.event_registrations er
    join public.events ev on ev.id = er.event_id and ev.tenant_id = v_tenant
   where er.id = p_registration_id
     and er.tenant_id = v_tenant;

  if v_kids_status is null or v_kids_status not in ('KIDS', 'TEENS') then
    return jsonb_build_object('success', false, 'message', 'Inscrição do evento não encontrada.');
  end if;

  v_service_date := (v_event_date at time zone 'America/Sao_Paulo')::date;

  if not public.profile_is_room_servidor_on_date(v_actor, v_kids_status, v_service_date) then
    return jsonb_build_object(
      'success', false,
      'message',
      'Somente Secretaria, Super Admin ou servidores escalados para esta sala na data do evento podem registrar a saída.'
    );
  end if;

  update public.event_registrations
     set room_entry_checked = true,
         room_released = true
   where id = p_registration_id
     and tenant_id = v_tenant;

  if not found then
    return jsonb_build_object('success', false, 'message', 'Inscrição do evento não encontrada.');
  end if;

  return jsonb_build_object('success', true, 'message', 'Saída registrada. Criança liberada para retirada.');
exception
  when others then
    return jsonb_build_object('success', false, 'message', sqlerrm);
end;
$$;

grant execute on function public.set_event_registration_room_release(uuid, uuid) to anon, authenticated;

notify pgrst, 'reload schema';
