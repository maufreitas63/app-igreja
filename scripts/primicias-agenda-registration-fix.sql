-- Corrige a inscrição na agenda ao doar em Prímicias.
-- register_profile_atomic falha (tenant_id / check-in) e o compromisso não entra em event_registrations.
-- Aplica: npx supabase db query --linked -f scripts/primicias-agenda-registration-fix.sql

create or replace function public.sync_primicias_event_registration(
  p_event_id uuid,
  p_profile_id uuid,
  p_register boolean
)
returns void
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_profile public.profiles%rowtype;
  v_tenant uuid;
  v_family text;
begin
  if p_event_id is null or p_profile_id is null then
    raise exception 'Evento ou perfil ausente para a agenda de Prímicias.';
  end if;

  perform set_config('app.bypass_tenant_guard', 'on', true);

  select e.tenant_id into v_tenant
    from public.events e
   where e.id = p_event_id;

  if v_tenant is null then
    raise exception 'Evento da campanha Prímicias não encontrado.';
  end if;

  select * into v_profile
    from public.profiles p
   where p.id = p_profile_id;

  if v_profile.id is null then
    raise exception 'Perfil não encontrado para inscrever na agenda.';
  end if;

  v_family := nullif(upper(trim(coalesce(v_profile.family_id, v_profile.codigo_membro, ''))), '');

  if not p_register then
    delete from public.event_registrations er
     where er.event_id = p_event_id
       and er.profile_id = p_profile_id;
    return;
  end if;

  if exists (
    select 1
      from public.event_registrations er
     where er.event_id = p_event_id
       and er.profile_id = p_profile_id
  ) then
    update public.event_registrations
       set family_id = coalesce(v_family, family_id),
           full_name = coalesce(nullif(trim(v_profile.full_name), ''), full_name)
     where event_id = p_event_id
       and profile_id = p_profile_id;
    return;
  end if;

  insert into public.event_registrations (
    tenant_id,
    event_id,
    profile_id,
    family_id,
    full_name
  )
  values (
    v_tenant,
    p_event_id,
    v_profile.id,
    v_family,
    coalesce(nullif(trim(v_profile.full_name), ''), 'Membro')
  );
exception
  when unique_violation then
    update public.event_registrations
       set family_id = coalesce(v_family, family_id),
           full_name = coalesce(nullif(trim(v_profile.full_name), ''), full_name)
     where event_id = p_event_id
       and profile_id = p_profile_id;
end;
$$;

create or replace function public.ensure_primicias_occurrence_registrations(p_occurrence_id uuid)
returns void
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_event_id uuid;
  v_profile_id uuid;
begin
  select o.event_id into v_event_id
    from public.primicias_occurrences o
   where o.id = p_occurrence_id
     and o.closed_at is null;

  if v_event_id is null then
    return;
  end if;

  for v_profile_id in
    select distinct pl.profile_id
      from public.primicias_pledges pl
     where pl.occurrence_id = p_occurrence_id
  loop
    begin
      perform public.sync_primicias_event_registration(v_event_id, v_profile_id, true);
    exception
      when others then
        raise warning 'Prímicias: falha ao inscrever % na agenda: %', v_profile_id, sqlerrm;
    end;
  end loop;
end;
$$;

create or replace function public.toggle_primicias_pledge(p_item_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
  v_me uuid := public.current_session_profile_id();
  v_item public.primicias_items%rowtype;
  v_occ public.primicias_occurrences%rowtype;
  v_existed boolean := false;
  v_still_has boolean := false;
begin
  if v_me is null or not public.session_can_view_primicias() then
    return jsonb_build_object('success', false, 'message', 'Sem permissão.');
  end if;

  perform public.close_expired_primicias_occurrences();

  select * into v_occ
    from public.primicias_occurrences o
   where o.tenant_id = v_tenant
     and o.closed_at is null
   order by o.event_date desc
   limit 1;

  if not found then
    return jsonb_build_object(
      'success', false,
      'message', 'A campanha ainda não tem data. Defina a data em Gestão de Prímicias.'
    );
  end if;

  select * into v_item
    from public.primicias_items i
   where i.id = p_item_id and i.tenant_id = v_tenant;

  if not found then
    return jsonb_build_object('success', false, 'message', 'Item não encontrado.');
  end if;

  select exists (
    select 1
      from public.primicias_pledges p
     where p.item_id = v_item.id
       and p.profile_id = v_me
       and p.tenant_id = v_tenant
       and p.occurrence_id = v_occ.id
  ) into v_existed;

  if v_existed then
    delete from public.primicias_pledges
     where item_id = v_item.id
       and profile_id = v_me
       and tenant_id = v_tenant
       and occurrence_id = v_occ.id;

    select exists (
      select 1
        from public.primicias_pledges p
       where p.profile_id = v_me
         and p.tenant_id = v_tenant
         and p.occurrence_id = v_occ.id
    ) into v_still_has;

    if not v_still_has then
      perform public.sync_primicias_event_registration(v_occ.event_id, v_me, false);
    end if;

    return jsonb_build_object(
      'success', true,
      'pledged', false,
      'message', 'Compromisso removido.'
    );
  end if;

  insert into public.primicias_pledges (tenant_id, item_id, profile_id, occurrence_id)
  values (v_tenant, v_item.id, v_me, v_occ.id);

  perform public.sync_primicias_event_registration(v_occ.event_id, v_me, true);

  return jsonb_build_object(
    'success', true,
    'pledged', true,
    'message', 'Seu nome foi vinculado a este item e a inscrição entrou na agenda.'
  );
end;
$$;

create or replace function public.list_primicias_items()
returns jsonb
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
  v_me uuid := public.current_session_profile_id();
  v_occ uuid;
begin
  if v_me is null or not public.session_can_view_primicias() then
    return jsonb_build_object('success', false, 'message', 'Sem permissão para Prímicias.');
  end if;

  perform public.close_expired_primicias_occurrences();
  perform public.ensure_primicias_defaults(v_tenant);

  v_occ := public.open_primicias_occurrence_id(v_tenant);
  if v_occ is not null then
    perform public.ensure_primicias_occurrence_registrations(v_occ);
  end if;

  return jsonb_build_object(
    'success', true,
    'can_manage', public.session_can_manage_primicias(),
    'occurrence', public.primicias_occurrence_json(v_tenant),
    'items',
    coalesce(
      (
        select jsonb_agg(
          public.primicias_item_json(i, v_tenant, v_me)
          order by
            case i.category
              when 'alimenticios' then 1
              when 'limpeza_higiene' then 2
              when 'criancas' then 3
              else 9
            end,
            i.sort_order,
            i.product_name
        )
        from public.primicias_items i
       where i.tenant_id = v_tenant
      ),
      '[]'::jsonb
    )
  );
end;
$$;

-- A agenda da família só via family_id exato; Prímicias precisa casar também pelo perfil.
create or replace function public.get_registered_event_members(
  p_event_id uuid,
  p_family_id text
)
returns table (
  profile_id uuid,
  family_id text,
  full_name text,
  kids_status text,
  room_entry_checked boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
  v_family text := nullif(upper(trim(coalesce(p_family_id, ''))), '');
begin
  return query
  select
    er.profile_id,
    er.family_id,
    er.full_name,
    er.kids_status,
    coalesce(er.room_entry_checked, false)
  from public.event_registrations er
  where er.tenant_id = v_tenant
    and er.event_id = p_event_id
    and (
      (v_family is not null and upper(trim(coalesce(er.family_id, ''))) = v_family)
      or (
        v_family is not null
        and exists (
          select 1
            from public.profiles p
           where p.id = er.profile_id
             and upper(trim(coalesce(p.family_id, p.codigo_membro, ''))) = v_family
        )
      )
    )
  order by er.created_at desc;
end;
$$;

grant execute on function public.get_registered_event_members(uuid, text) to anon, authenticated;

-- Reinscreve quem já tinha doado nesta campanha aberta.
do $$
declare
  v_occ uuid;
begin
  for v_occ in
    select o.id from public.primicias_occurrences o where o.closed_at is null
  loop
    perform public.ensure_primicias_occurrence_registrations(v_occ);
  end loop;
end
$$;

create or replace function public.primicias_occurrence_json(p_tenant uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
set row_security = off
as $$
declare
  v_occ public.primicias_occurrences%rowtype;
  v_event public.events%rowtype;
begin
  select * into v_occ
    from public.primicias_occurrences o
   where o.tenant_id = p_tenant
     and o.closed_at is null
   order by o.event_date desc, o.created_at desc
   limit 1;

  if not found then
    return null;
  end if;

  select * into v_event from public.events e where e.id = v_occ.event_id;

  return jsonb_build_object(
    'id', v_occ.id,
    'event_id', v_occ.event_id,
    'event_date', v_occ.event_date,
    'starts_at', v_event.event_date,
    'event_end_date', v_event.event_end_date,
    'event_local', coalesce(nullif(trim(v_event.event_local), ''), 'Campanha Prímicias'),
    'reset_on', (v_occ.event_date + 10),
    'title', public.primicias_event_title()
  );
end;
$$;

drop function if exists public.debug_primicias_agenda_state();
drop function if exists public.debug_primicias_try_insert();

notify pgrst, 'reload schema';
