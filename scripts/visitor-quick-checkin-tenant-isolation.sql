-- =============================================================================
-- Visitantes / Cadastro Rápido — isolamento por tenant (igreja da sessão)
-- =============================================================================
-- Bug: get_active_visitor_checkin_context e resolve_event_by_visitor_checkin_code
-- buscavam eventos em TODAS as igrejas. Em IBN aparecia culto da IBS.
-- Lookup/submit de profiles/members também ficam restritos ao tenant da sessão.
-- Aplica: npx supabase db query --linked -f scripts/visitor-quick-checkin-tenant-isolation.sql
-- =============================================================================

create or replace function public.resolve_event_by_visitor_checkin_code(p_code text)
returns public.events
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_code text := regexp_replace(coalesce(p_code, ''), '\D', '', 'g');
  v_event public.events%rowtype;
  v_today date := (timezone('America/Sao_Paulo', now()))::date;
  v_tenant uuid := public.require_session_tenant_id();
begin
  if length(v_code) <> 4 then
    raise exception 'Informe o código de 4 dígitos do evento.';
  end if;

  select e.*
    into v_event
    from public.events e
   where e.tenant_id = v_tenant
     and trim(coalesce(e.visitor_checkin_code, '')) = v_code
     and (
       (e.event_date at time zone 'America/Sao_Paulo')::date = v_today
       or (
         e.event_end_date is not null
         and (e.event_date at time zone 'America/Sao_Paulo')::date <= v_today
         and (e.event_end_date at time zone 'America/Sao_Paulo')::date >= v_today
       )
     )
   order by e.event_date desc
   limit 1;

  if v_event.id is null then
    select e.*
      into v_event
      from public.events e
     where e.tenant_id = v_tenant
       and trim(coalesce(e.visitor_checkin_code, '')) = v_code
       and (e.event_date at time zone 'America/Sao_Paulo')::date
           between (v_today - 1) and (v_today + 1)
     order by abs(
       extract(
         epoch from (
           e.event_date - timezone('America/Sao_Paulo', now())
         )
       )
     ) asc
     limit 1;
  end if;

  if v_event.id is null then
    raise exception 'Código de evento inválido ou sem culto ativo.';
  end if;

  return v_event;
end;
$$;

create or replace function public.get_active_visitor_checkin_context()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid;
  v_event public.events%rowtype;
  v_today date := (timezone('America/Sao_Paulo', now()))::date;
  v_tenant uuid;
begin
  v_actor := public.assert_visitor_quick_checkin_actor();
  v_tenant := public.require_session_tenant_id();

  select e.*
    into v_event
    from public.events e
   where e.tenant_id = v_tenant
     and coalesce(e.is_locked, false) = false
     and (
       (e.event_date at time zone 'America/Sao_Paulo')::date = v_today
       or (
         e.event_end_date is not null
         and (e.event_date at time zone 'America/Sao_Paulo')::date <= v_today
         and (e.event_end_date at time zone 'America/Sao_Paulo')::date >= v_today
       )
     )
   order by e.event_date asc
   limit 1;

  if v_event.id is null then
    select e.*
      into v_event
      from public.events e
     where e.tenant_id = v_tenant
       and coalesce(e.is_locked, false) = false
       and (e.event_date at time zone 'America/Sao_Paulo')::date
           between v_today and (v_today + 1)
     order by e.event_date asc
     limit 1;
  end if;

  if v_event.id is null then
    return jsonb_build_object(
      'success', false,
      'message', 'Nenhum culto ativo encontrado para check-in de visitantes.'
    );
  end if;

  if length(trim(coalesce(v_event.visitor_checkin_code, ''))) <> 4 then
    update public.events
       set visitor_checkin_code = public.generate_unique_visitor_checkin_code(tenant_id)
     where id = v_event.id
       and tenant_id = v_tenant
     returning * into v_event;
  end if;

  return jsonb_build_object(
    'success', true,
    'event', jsonb_build_object(
      'id', v_event.id,
      'name', v_event.name,
      'event_date', v_event.event_date,
      'visitor_checkin_code', v_event.visitor_checkin_code
    ),
    'actor_profile_id', v_actor
  );
end;
$$;

create or replace function public.ensure_event_visitor_checkin_code(p_event_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
  v_attempt int := 0;
  v_tenant uuid := public.require_session_tenant_id();
begin
  perform public.assert_visitor_quick_checkin_actor();

  select trim(coalesce(visitor_checkin_code, ''))
    into v_code
    from public.events
   where id = p_event_id
     and tenant_id = v_tenant;

  if not found then
    raise exception 'Evento não encontrado nesta igreja.';
  end if;

  if v_code is not null and length(v_code) = 4 then
    return v_code;
  end if;

  loop
    v_attempt := v_attempt + 1;
    v_code := public.generate_unique_visitor_checkin_code(v_tenant);
    begin
      update public.events
         set visitor_checkin_code = v_code
       where id = p_event_id
         and tenant_id = v_tenant
         and (visitor_checkin_code is null or length(trim(visitor_checkin_code)) <> 4);
      exit;
    exception
      when unique_violation then
        if v_attempt >= 20 then
          raise;
        end if;
    end;
  end loop;

  select trim(coalesce(visitor_checkin_code, ''))
    into v_code
    from public.events
   where id = p_event_id
     and tenant_id = v_tenant;

  return v_code;
end;
$$;

create or replace function public.lookup_visitor_quick_checkin(
  p_phone text,
  p_event_code text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid;
  v_event public.events%rowtype;
  v_phone text := public.visitor_quick_phone_digits(p_phone);
  v_guardian public.profiles%rowtype;
  v_role text;
  v_children jsonb := '[]'::jsonb;
  v_family_id text;
  v_tenant uuid;
begin
  v_actor := public.assert_visitor_quick_checkin_actor();
  v_tenant := public.require_session_tenant_id();
  v_event := public.resolve_event_by_visitor_checkin_code(p_event_code);

  if v_phone is null or length(v_phone) < 10 then
    return jsonb_build_object(
      'success', false,
      'status', 'invalid_phone',
      'message', 'Informe um celular válido com DDD.'
    );
  end if;

  select p.*
    into v_guardian
    from public.profiles p
   where p.tenant_id = v_tenant
     and public.visitor_quick_phones_match(p.phone, v_phone)
   order by
     case when public.resolve_basic_role_code_for_profile(p.id) = 'member' then 0 else 1 end,
     p.created_at asc nulls last
   limit 1;

  if v_guardian.id is not null then
    v_role := public.resolve_basic_role_code_for_profile(v_guardian.id);

    if v_role = 'member' then
      return jsonb_build_object(
        'success', false,
        'status', 'member_blocked',
        'message',
          'Este celular pertence a um membro ativo da igreja. Use o fluxo padrão de check-in (Agenda da Família / Totem), não o cadastro de visitantes.',
        'guardian', jsonb_build_object(
          'id', v_guardian.id,
          'full_name', v_guardian.full_name,
          'phone', v_guardian.phone,
          'family_id', v_guardian.family_id,
          'role_code', v_role
        ),
        'event', jsonb_build_object(
          'id', v_event.id,
          'name', v_event.name,
          'event_date', v_event.event_date,
          'visitor_checkin_code', v_event.visitor_checkin_code
        )
      );
    end if;

    v_family_id := nullif(trim(coalesce(v_guardian.family_id, v_guardian.codigo_membro, '')), '');

    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'profile_id', c.id,
          'full_name', c.full_name,
          'birth_date', c.birth_date,
          'medical_food_alerts', c.medical_food_alerts,
          'special_needs', c.special_needs,
          'additional_care_notes', c.additional_care_notes,
          'lgpd_accepted', c.lgpd_accepted
        )
        order by c.full_name
      ),
      '[]'::jsonb
    )
      into v_children
      from public.profiles c
     where c.tenant_id = v_tenant
       and v_family_id is not null
       and (
         nullif(trim(coalesce(c.family_id, '')), '') = v_family_id
         or nullif(trim(coalesce(c.codigo_membro, '')), '') = v_family_id
       )
       and c.id is distinct from v_guardian.id
       and (
         public.resolve_kids_status_from_birth_date(c.birth_date) in ('KIDS', 'TEENS')
         or exists (
           select 1
             from public.members m
            where m.tenant_id = v_tenant
              and m.family_id = v_family_id
              and public.normalize_person_name(m.full_name) = public.normalize_person_name(c.full_name)
              and lower(coalesce(m.relationship, '')) like '%filho%'
         )
       );

    return jsonb_build_object(
      'success', true,
      'status', 'recurring_visitor',
      'message',
        'Visitante recorrente encontrado: Família de '
        || coalesce(nullif(trim(v_guardian.full_name), ''), 'visitante'),
      'guardian', jsonb_build_object(
        'id', v_guardian.id,
        'full_name', v_guardian.full_name,
        'phone', v_guardian.phone,
        'family_id', v_family_id,
        'role_code', v_role,
        'lgpd_accepted', v_guardian.lgpd_accepted
      ),
      'children', v_children,
      'event', jsonb_build_object(
        'id', v_event.id,
        'name', v_event.name,
        'event_date', v_event.event_date,
        'visitor_checkin_code', v_event.visitor_checkin_code
      ),
      'actor_profile_id', v_actor
    );
  end if;

  return jsonb_build_object(
    'success', true,
    'status', 'new_visitor',
    'message', 'Celular não encontrado. Preencha o cadastro rápido.',
    'guardian', jsonb_build_object(
      'phone', v_phone
    ),
    'children', '[]'::jsonb,
    'event', jsonb_build_object(
      'id', v_event.id,
      'name', v_event.name,
      'event_date', v_event.event_date,
      'visitor_checkin_code', v_event.visitor_checkin_code
    ),
    'actor_profile_id', v_actor
  );
end;
$$;

create or replace function public.submit_visitor_quick_checkin(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid;
  v_event public.events%rowtype;
  v_event_code text := coalesce(p_payload->>'event_code', p_payload->>'visitor_checkin_code');
  v_phone text := public.visitor_quick_phone_digits(p_payload->>'phone');
  v_guardian_name text := nullif(trim(coalesce(p_payload->>'guardian_name', '')), '');
  v_lgpd boolean := coalesce((p_payload->>'lgpd_accepted')::boolean, false);
  v_children jsonb := coalesce(p_payload->'children', '[]'::jsonb);
  v_child jsonb;
  v_family_id text;
  v_guardian_id uuid;
  v_child_id uuid;
  v_member_id uuid;
  v_birth date;
  v_kids_status text;
  v_reg_id uuid;
  v_registered jsonb := '[]'::jsonb;
  v_role text;
  v_age_years int;
  v_idx int;
  v_tenant uuid;
begin
  v_actor := public.assert_visitor_quick_checkin_actor();
  v_tenant := public.require_session_tenant_id();
  v_event := public.resolve_event_by_visitor_checkin_code(v_event_code);

  if v_phone is null or length(v_phone) < 10 then
    return jsonb_build_object('success', false, 'message', 'Informe um celular válido com DDD.');
  end if;

  if v_guardian_name is null then
    return jsonb_build_object('success', false, 'message', 'Informe o nome completo do responsável.');
  end if;

  if jsonb_typeof(v_children) <> 'array' or jsonb_array_length(v_children) < 1 then
    return jsonb_build_object('success', false, 'message', 'Inclua ao menos uma criança/adolescente.');
  end if;

  if not v_lgpd then
    return jsonb_build_object('success', false, 'message', 'É necessário o aceite do termo de imagem (LGPD).');
  end if;

  select p.id, public.resolve_basic_role_code_for_profile(p.id)
    into v_guardian_id, v_role
    from public.profiles p
   where p.tenant_id = v_tenant
     and public.visitor_quick_phones_match(p.phone, v_phone)
   order by case when public.resolve_basic_role_code_for_profile(p.id) = 'member' then 0 else 1 end
   limit 1;

  if v_guardian_id is not null and v_role = 'member' then
    return jsonb_build_object(
      'success', false,
      'status', 'member_blocked',
      'message',
        'Este celular pertence a um membro ativo. Use o fluxo padrão de check-in.'
    );
  end if;

  if v_guardian_id is not null then
    select nullif(trim(coalesce(family_id, codigo_membro, '')), '')
      into v_family_id
      from public.profiles
     where id = v_guardian_id
       and tenant_id = v_tenant;
  end if;

  if v_family_id is null then
    v_family_id := public.reserve_next_family_id();
  end if;

  if v_guardian_id is null then
    insert into public.profiles (
      full_name,
      phone,
      family_id,
      codigo_membro,
      lgpd_accepted,
      lgpd_accepted_at,
      is_active,
      tenant_id
    ) values (
      v_guardian_name,
      v_phone,
      v_family_id,
      v_family_id,
      true,
      now(),
      true,
      v_tenant
    )
    returning id into v_guardian_id;

    insert into public.profile_access_roles (profile_id, role_id)
    select v_guardian_id, ar.id
      from public.access_roles ar
     where ar.code = 'visitantes'
       and not exists (
         select 1
           from public.profile_access_roles par
          where par.profile_id = v_guardian_id
            and par.role_id = ar.id
       );
  else
    update public.profiles
       set full_name = v_guardian_name,
           phone = v_phone,
           family_id = v_family_id,
           codigo_membro = coalesce(nullif(trim(codigo_membro), ''), v_family_id),
           lgpd_accepted = true,
           lgpd_accepted_at = coalesce(lgpd_accepted_at, now()),
           is_active = true
     where id = v_guardian_id
       and tenant_id = v_tenant;
  end if;

  select m.id
    into v_member_id
    from public.members m
   where m.tenant_id = v_tenant
     and m.family_id = v_family_id
     and (
       public.visitor_quick_phones_match(m.phone, v_phone)
       or public.normalize_person_name(m.full_name) = public.normalize_person_name(v_guardian_name)
     )
   limit 1;

  if v_member_id is null then
    insert into public.members (
      full_name,
      phone,
      relationship,
      family_id,
      accepted,
      is_responsavel,
      tenant_id
    ) values (
      v_guardian_name,
      v_phone,
      'Representante Legal',
      v_family_id,
      true,
      true,
      v_tenant
    );
  else
    update public.members
       set full_name = v_guardian_name,
           phone = v_phone,
           relationship = coalesce(nullif(trim(relationship), ''), 'Representante Legal'),
           accepted = true,
           is_responsavel = true
     where id = v_member_id
       and tenant_id = v_tenant;
  end if;

  for v_idx in 0 .. jsonb_array_length(v_children) - 1 loop
    v_child := v_children->v_idx;

    if nullif(trim(coalesce(v_child->>'full_name', '')), '') is null then
      return jsonb_build_object('success', false, 'message', 'Informe o nome de cada filho.');
    end if;

    v_birth := null;
    begin
      if nullif(trim(coalesce(v_child->>'birth_date', '')), '') is not null then
        v_birth := (trim(v_child->>'birth_date'))::date;
      elsif nullif(trim(coalesce(v_child->>'age_years', '')), '') is not null then
        v_age_years := greatest(0, least(17, (trim(v_child->>'age_years'))::int));
        v_birth := ((timezone('America/Sao_Paulo', now()))::date - make_interval(years => v_age_years))::date;
      end if;
    exception
      when others then
        return jsonb_build_object('success', false, 'message', 'Data de nascimento ou idade inválida.');
    end;

    if v_birth is null then
      return jsonb_build_object(
        'success', false,
        'message', 'Informe data de nascimento ou idade de cada filho.'
      );
    end if;

    v_kids_status := public.resolve_kids_status_from_birth_date(v_birth);
    if v_kids_status is null then
      return jsonb_build_object(
        'success', false,
        'message',
          'A criança/adolescente '
          || trim(v_child->>'full_name')
          || ' está fora da faixa Kids/Teens.'
      );
    end if;

    v_child_id := null;
    if nullif(trim(coalesce(v_child->>'profile_id', '')), '') is not null then
      begin
        v_child_id := (v_child->>'profile_id')::uuid;
      exception
        when others then
          v_child_id := null;
      end;

      if v_child_id is not null then
        if not exists (
          select 1
            from public.profiles c
           where c.id = v_child_id
             and c.tenant_id = v_tenant
        ) then
          v_child_id := null;
        end if;
      end if;
    end if;

    if v_child_id is null then
      select c.id
        into v_child_id
        from public.profiles c
       where c.tenant_id = v_tenant
         and (
           nullif(trim(coalesce(c.family_id, '')), '') = v_family_id
           or nullif(trim(coalesce(c.codigo_membro, '')), '') = v_family_id
         )
         and public.normalize_person_name(c.full_name)
           = public.normalize_person_name(trim(v_child->>'full_name'))
       limit 1;
    end if;

    if v_child_id is null then
      insert into public.profiles (
        full_name,
        birth_date,
        family_id,
        codigo_membro,
        medical_food_alerts,
        special_needs,
        additional_care_notes,
        lgpd_accepted,
        lgpd_accepted_at,
        is_active,
        tenant_id
      ) values (
        trim(v_child->>'full_name'),
        v_birth,
        v_family_id,
        v_family_id,
        nullif(trim(coalesce(v_child->>'medical_food_alerts', '')), ''),
        nullif(trim(coalesce(v_child->>'special_needs', '')), ''),
        nullif(trim(coalesce(v_child->>'additional_care_notes', '')), ''),
        true,
        now(),
        true,
        v_tenant
      )
      returning id into v_child_id;
    else
      update public.profiles
         set full_name = trim(v_child->>'full_name'),
             birth_date = v_birth,
             family_id = v_family_id,
             codigo_membro = coalesce(nullif(trim(codigo_membro), ''), v_family_id),
             medical_food_alerts = nullif(trim(coalesce(v_child->>'medical_food_alerts', '')), ''),
             special_needs = nullif(trim(coalesce(v_child->>'special_needs', '')), ''),
             additional_care_notes = nullif(trim(coalesce(v_child->>'additional_care_notes', '')), ''),
             lgpd_accepted = true,
             lgpd_accepted_at = coalesce(lgpd_accepted_at, now()),
             is_active = true
       where id = v_child_id
         and tenant_id = v_tenant;
    end if;

    v_member_id := null;
    select m.id
      into v_member_id
      from public.members m
     where m.tenant_id = v_tenant
       and m.family_id = v_family_id
       and public.normalize_person_name(m.full_name)
         = public.normalize_person_name(trim(v_child->>'full_name'))
     limit 1;

    if v_member_id is null then
      insert into public.members (
        full_name,
        birth_date,
        relationship,
        family_id,
        accepted,
        tenant_id
      ) values (
        trim(v_child->>'full_name'),
        v_birth,
        'Filho(a)',
        v_family_id,
        true,
        v_tenant
      )
      returning id into v_member_id;
    else
      update public.members
         set birth_date = v_birth,
             relationship = 'Filho(a)',
             accepted = true
       where id = v_member_id
         and tenant_id = v_tenant;
    end if;

    select er.id
      into v_reg_id
      from public.event_registrations er
     where er.event_id = v_event.id
       and (
         er.profile_id = v_child_id
         or (
           nullif(trim(coalesce(er.family_id, '')), '') = v_family_id
           and public.normalize_person_name(er.full_name)
             = public.normalize_person_name(trim(v_child->>'full_name'))
         )
       )
     limit 1;

    if v_reg_id is null then
      insert into public.event_registrations (
        event_id,
        profile_id,
        family_id,
        full_name,
        kids_status
      ) values (
        v_event.id,
        v_child_id,
        v_family_id,
        trim(v_child->>'full_name'),
        v_kids_status
      )
      returning id into v_reg_id;
    else
      update public.event_registrations
         set profile_id = v_child_id,
             family_id = v_family_id,
             full_name = trim(v_child->>'full_name'),
             kids_status = v_kids_status
       where id = v_reg_id;
    end if;

    v_registered := v_registered || jsonb_build_array(
      jsonb_build_object(
        'profile_id', v_child_id,
        'member_id', v_member_id,
        'registration_id', v_reg_id,
        'full_name', trim(v_child->>'full_name'),
        'kids_status', v_kids_status,
        'birth_date', v_birth
      )
    );
  end loop;

  return jsonb_build_object(
    'success', true,
    'status', 'checked_in',
    'message', 'Check-in de visitante concluído.',
    'family_id', v_family_id,
    'check_in_qr', v_family_id,
    'guardian', jsonb_build_object(
      'id', v_guardian_id,
      'full_name', v_guardian_name,
      'phone', v_phone,
      'family_id', v_family_id
    ),
    'children', v_registered,
    'event', jsonb_build_object(
      'id', v_event.id,
      'name', v_event.name,
      'event_date', v_event.event_date,
      'visitor_checkin_code', v_event.visitor_checkin_code
    ),
    'whatsapp', jsonb_build_object(
      'phone', v_phone,
      'family_id', v_family_id,
      'event_name', v_event.name
    ),
    'actor_profile_id', v_actor
  );
end;
$$;

grant execute on function public.resolve_event_by_visitor_checkin_code(text) to authenticated;
grant execute on function public.get_active_visitor_checkin_context() to authenticated;
grant execute on function public.ensure_event_visitor_checkin_code(uuid) to authenticated;
grant execute on function public.lookup_visitor_quick_checkin(text, text) to authenticated;
grant execute on function public.submit_visitor_quick_checkin(jsonb) to authenticated;

notify pgrst, 'reload schema';
