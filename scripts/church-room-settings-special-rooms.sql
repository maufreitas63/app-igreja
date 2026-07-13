-- =============================================================================
-- Salas Padrão e Especial (override por período)
-- =============================================================================
-- Execute após:
--   scripts/church-room-settings.sql
--   scripts/church-room-settings-custom-rooms.sql
--
-- Regras:
--   - Sala Padrão: permanente (sem datas)
--   - Sala Especial: exige start_date/end_date; enquanto vigente, sobrepõe a padrão
--   - Usuário pode ter 1 atribuição padrao + 1 especial
--   - Ao encerrar a data da especial, a efetiva volta automaticamente à padrão
-- =============================================================================

alter table public.church_room_settings
  add column if not exists room_kind text not null default 'padrao';

alter table public.church_room_settings
  add column if not exists start_date date null;

alter table public.church_room_settings
  add column if not exists end_date date null;

update public.church_room_settings
   set room_kind = 'padrao'
 where room_kind is null
    or trim(room_kind) = ''
    or lower(trim(room_kind)) not in ('padrao', 'especial');

alter table public.church_room_settings
  drop constraint if exists church_room_settings_room_kind_check;

alter table public.church_room_settings
  add constraint church_room_settings_room_kind_check
  check (room_kind in ('padrao', 'especial'));

alter table public.church_room_settings
  drop constraint if exists church_room_settings_especial_dates_check;

alter table public.church_room_settings
  add constraint church_room_settings_especial_dates_check
  check (
    (room_kind = 'padrao' and start_date is null and end_date is null)
    or (
      room_kind = 'especial'
      and start_date is not null
      and end_date is not null
      and end_date >= start_date
    )
  );

update public.church_room_settings
   set room_kind = 'padrao',
       start_date = null,
       end_date = null
 where upper(trim(room_key)) in ('KIDS', 'TEENS')
    or coalesce(is_system, false) = true;

alter table public.user_room_assignment
  add column if not exists assignment_kind text not null default 'padrao';

update public.user_room_assignment
   set assignment_kind = 'padrao'
 where assignment_kind is null
    or trim(assignment_kind) = ''
    or lower(trim(assignment_kind)) not in ('padrao', 'especial');

alter table public.user_room_assignment
  drop constraint if exists user_room_assignment_assignment_kind_check;

alter table public.user_room_assignment
  add constraint user_room_assignment_assignment_kind_check
  check (assignment_kind in ('padrao', 'especial'));

alter table public.user_room_assignment
  drop constraint if exists user_room_assignment_tenant_profile_unique;

drop index if exists user_room_assignment_tenant_profile_unique;

with ranked as (
  select
    id,
    row_number() over (
      partition by tenant_id, profile_id, assignment_kind
      order by updated_at desc nulls last, created_at desc nulls last, id desc
    ) as rn
  from public.user_room_assignment
)
delete from public.user_room_assignment a
 using ranked r
 where a.id = r.id
   and r.rn > 1;

alter table public.user_room_assignment
  drop constraint if exists user_room_assignment_tenant_profile_kind_unique;

alter table public.user_room_assignment
  add constraint user_room_assignment_tenant_profile_kind_unique
  unique (tenant_id, profile_id, assignment_kind);

create index if not exists user_room_assignment_kind_idx
  on public.user_room_assignment (tenant_id, assignment_kind);

create or replace function public.effective_user_room(
  p_tenant_id uuid,
  p_profile_id uuid,
  p_as_of date default current_date
)
returns table (
  room_key text,
  room_label text,
  room_kind text,
  padrao_room_key text,
  padrao_room_label text,
  especial_room_key text,
  especial_room_label text,
  especial_end_date date
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_padrao_key text;
  v_padrao_label text;
  v_esp_key text;
  v_esp_label text;
  v_esp_start date;
  v_esp_end date;
  v_esp_active boolean := false;
  v_as_of date := coalesce(p_as_of, current_date);
begin
  select a.room_key, coalesce(nullif(trim(s.display_label), ''), a.room_key)
    into v_padrao_key, v_padrao_label
    from public.user_room_assignment a
    join public.church_room_settings s
      on s.tenant_id = a.tenant_id
     and s.room_key = a.room_key
   where a.tenant_id = p_tenant_id
     and a.profile_id = p_profile_id
     and a.assignment_kind = 'padrao'
     and s.is_enabled = true
     and s.room_kind = 'padrao'
   limit 1;

  -- Sempre retorna a atribuição especial (para o chip admin marcar selecionado).
  -- A vigência por data só decide se ela vira a sala efetiva.
  select a.room_key,
         coalesce(nullif(trim(s.display_label), ''), a.room_key),
         s.start_date,
         s.end_date
    into v_esp_key, v_esp_label, v_esp_start, v_esp_end
    from public.user_room_assignment a
    join public.church_room_settings s
      on s.tenant_id = a.tenant_id
     and s.room_key = a.room_key
   where a.tenant_id = p_tenant_id
     and a.profile_id = p_profile_id
     and a.assignment_kind = 'especial'
     and s.is_enabled = true
     and s.room_kind = 'especial'
   limit 1;

  v_esp_active :=
    v_esp_key is not null
    and v_esp_start is not null
    and v_esp_end is not null
    and v_as_of between v_esp_start and v_esp_end;

  if v_esp_active then
    room_key := v_esp_key;
    room_label := v_esp_label;
    room_kind := 'especial';
  else
    room_key := v_padrao_key;
    room_label := v_padrao_label;
    room_kind := case when v_padrao_key is not null then 'padrao' else null end;
  end if;

  padrao_room_key := v_padrao_key;
  padrao_room_label := v_padrao_label;
  especial_room_key := v_esp_key;
  especial_room_label := v_esp_label;
  especial_end_date := v_esp_end;
  return next;
end;
$$;

grant execute on function public.effective_user_room(uuid, uuid, date) to anon, authenticated;

create or replace function public.list_church_room_settings()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
  v_rows jsonb;
begin
  insert into public.church_room_settings (
    tenant_id, room_key, display_label, sort_order, is_system, room_kind
  )
  select v_tenant, x.room_key, x.display_label, x.sort_order, true, 'padrao'
    from (values
      ('KIDS', 'Infantil', 10),
      ('TEENS', 'Jovens', 20)
    ) as x(room_key, display_label, sort_order)
   where not exists (
     select 1 from public.church_room_settings s
      where s.tenant_id = v_tenant
        and s.room_key = x.room_key
   );

  update public.church_room_settings
     set is_system = true,
         room_kind = 'padrao',
         start_date = null,
         end_date = null
   where tenant_id = v_tenant
     and room_key in ('KIDS', 'TEENS');

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', s.id,
      'tenant_id', s.tenant_id,
      'room_key', s.room_key,
      'display_label', s.display_label,
      'badge_label', s.badge_label,
      'color_hex', s.color_hex,
      'is_enabled', s.is_enabled,
      'is_system', s.is_system,
      'sort_order', s.sort_order,
      'room_kind', s.room_kind,
      'start_date', s.start_date,
      'end_date', s.end_date
    )
    order by
      case when s.room_kind = 'padrao' then 0 else 1 end,
      s.sort_order,
      s.room_key
  ), '[]'::jsonb)
    into v_rows
    from public.church_room_settings s
   where s.tenant_id = v_tenant;

  return v_rows;
end;
$$;

grant execute on function public.list_church_room_settings() to anon, authenticated;

drop function if exists public.create_church_room_setting(text);

create or replace function public.create_church_room_setting(
  p_display_label text,
  p_room_kind text default 'padrao',
  p_start_date date default null,
  p_end_date date default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
  v_actor uuid := public.current_session_profile_id();
  v_label text := trim(coalesce(p_display_label, ''));
  v_kind text := lower(trim(coalesce(p_room_kind, 'padrao')));
  v_key text;
  v_base text;
  v_suffix integer := 0;
  v_row public.church_room_settings%rowtype;
  v_start date := p_start_date;
  v_end date := p_end_date;
begin
  perform public.assert_church_room_manager(v_actor);

  if char_length(v_label) < 2 then
    return jsonb_build_object('success', false, 'message', 'Informe o nome da sala (mínimo 2).');
  end if;

  if v_kind not in ('padrao', 'especial') then
    return jsonb_build_object('success', false, 'message', 'Tipo de sala inválido. Use padrao ou especial.');
  end if;

  if v_kind = 'especial' then
    if v_start is null or v_end is null then
      return jsonb_build_object(
        'success', false,
        'message', 'Sala especial exige data de início e data de fim.'
      );
    end if;
    if v_end < v_start then
      return jsonb_build_object('success', false, 'message', 'A data de fim deve ser ≥ data de início.');
    end if;
  else
    v_start := null;
    v_end := null;
  end if;

  if exists (
    select 1
      from public.church_room_settings s
     where s.tenant_id = v_tenant
       and lower(trim(s.display_label)) = lower(v_label)
  ) then
    return jsonb_build_object(
      'success', false,
      'message', 'Já existe uma sala com este nome nesta instância.'
    );
  end if;

  v_base := public.slug_church_room_key(v_label);
  if v_base is null or char_length(v_base) < 2 then
    return jsonb_build_object('success', false, 'message', 'Não foi possível gerar o código da sala.');
  end if;

  if public.is_system_church_room_key(v_base) then
    v_base := v_base || '_CUSTOM';
  end if;

  v_key := left(v_base, 40);
  while exists (
    select 1 from public.church_room_settings s
     where s.tenant_id = v_tenant and s.room_key = v_key
  ) loop
    v_suffix := v_suffix + 1;
    v_key := left(v_base, 36) || '_' || v_suffix::text;
  end loop;

  insert into public.church_room_settings as s (
    tenant_id, room_key, display_label, badge_label, is_enabled, sort_order,
    is_system, room_kind, start_date, end_date, updated_at
  )
  values (
    v_tenant, v_key, v_label, null, true,
    case when v_kind = 'especial' then 200 else 100 end,
    false, v_kind, v_start, v_end, now()
  )
  returning * into v_row;

  return jsonb_build_object(
    'success', true,
    'message', case when v_kind = 'especial' then 'Sala especial criada.' else 'Sala padrão criada.' end,
    'row', jsonb_build_object(
      'id', v_row.id,
      'tenant_id', v_row.tenant_id,
      'room_key', v_row.room_key,
      'display_label', v_row.display_label,
      'badge_label', v_row.badge_label,
      'color_hex', v_row.color_hex,
      'is_enabled', v_row.is_enabled,
      'is_system', v_row.is_system,
      'sort_order', v_row.sort_order,
      'room_kind', v_row.room_kind,
      'start_date', v_row.start_date,
      'end_date', v_row.end_date
    )
  );
end;
$$;

grant execute on function public.create_church_room_setting(text, text, date, date)
  to anon, authenticated;

create or replace function public.create_church_room_setting(p_display_label text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  return public.create_church_room_setting(p_display_label, 'padrao', null, null);
end;
$$;

grant execute on function public.create_church_room_setting(text) to anon, authenticated;

drop function if exists public.set_user_room_assignment(uuid, text);

create or replace function public.set_user_room_assignment(
  p_profile_id uuid,
  p_room_key text,
  p_assignment_kind text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
  v_actor uuid := public.current_session_profile_id();
  v_key text := public.normalize_church_room_key(p_room_key);
  v_kind text;
  v_room_kind text;
  v_label text;
  v_start date;
  v_end date;
begin
  perform public.assert_church_room_manager(v_actor);

  if p_profile_id is null then
    return jsonb_build_object('success', false, 'message', 'Perfil não informado.');
  end if;

  if v_key is null or v_key !~ '^[A-Z0-9_]{2,40}$' then
    return jsonb_build_object('success', false, 'message', 'Sala inválida.');
  end if;

  if not exists (
    select 1
      from public.profile_igreja_vinculos v
     where v.profile_id = p_profile_id
       and v.tenant_id = v_tenant
  ) then
    return jsonb_build_object('success', false, 'message', 'Perfil não vinculado a esta instância.');
  end if;

  select s.room_kind, s.display_label, s.start_date, s.end_date
    into v_room_kind, v_label, v_start, v_end
    from public.church_room_settings s
   where s.tenant_id = v_tenant
     and s.room_key = v_key
     and s.is_enabled;

  if v_room_kind is null then
    return jsonb_build_object('success', false, 'message', 'Sala inexistente ou desabilitada.');
  end if;

  v_kind := lower(trim(coalesce(nullif(trim(p_assignment_kind), ''), v_room_kind)));
  if v_kind not in ('padrao', 'especial') then
    return jsonb_build_object('success', false, 'message', 'Tipo de atribuição inválido.');
  end if;

  if v_kind <> v_room_kind then
    return jsonb_build_object(
      'success', false,
      'message',
      'A atribuição deve ser do mesmo tipo da sala (padrão ↔ padrão, especial ↔ especial).'
    );
  end if;

  if v_kind = 'especial'
     and (v_start is null or v_end is null or current_date > v_end) then
    return jsonb_build_object(
      'success', false,
      'message', 'Esta sala especial já encerrou ou está sem período válido.'
    );
  end if;

  insert into public.user_room_assignment as a (
    tenant_id, profile_id, room_key, assignment_kind, assigned_by_profile_id, updated_at
  )
  values (v_tenant, p_profile_id, v_key, v_kind, v_actor, now())
  on conflict (tenant_id, profile_id, assignment_kind) do update
    set room_key = excluded.room_key,
        assigned_by_profile_id = excluded.assigned_by_profile_id,
        updated_at = now();

  return jsonb_build_object(
    'success', true,
    'message',
      case
        when v_kind = 'especial' then 'Sala especial atribuída (sobrepõe a padrão no período).'
        else 'Sala padrão atribuída.'
      end,
    'profile_id', p_profile_id,
    'room_key', v_key,
    'room_label', coalesce(v_label, v_key),
    'assignment_kind', v_kind
  );
end;
$$;

grant execute on function public.set_user_room_assignment(uuid, text, text)
  to anon, authenticated;

drop function if exists public.clear_user_room_assignment(uuid);

create or replace function public.clear_user_room_assignment(
  p_profile_id uuid,
  p_assignment_kind text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
  v_actor uuid := public.current_session_profile_id();
  v_kind text := lower(trim(coalesce(p_assignment_kind, '')));
begin
  perform public.assert_church_room_manager(v_actor);

  if p_profile_id is null then
    return jsonb_build_object('success', false, 'message', 'Perfil não informado.');
  end if;

  if v_kind = '' then
    delete from public.user_room_assignment a
     where a.tenant_id = v_tenant
       and a.profile_id = p_profile_id;
  elsif v_kind in ('padrao', 'especial') then
    delete from public.user_room_assignment a
     where a.tenant_id = v_tenant
       and a.profile_id = p_profile_id
       and a.assignment_kind = v_kind;
  else
    return jsonb_build_object('success', false, 'message', 'Tipo de atribuição inválido.');
  end if;

  return jsonb_build_object('success', true, 'message', 'Atribuição removida.');
end;
$$;

grant execute on function public.clear_user_room_assignment(uuid, text)
  to anon, authenticated;

create or replace function public.list_profiles_for_room_assignment(p_search text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
  v_actor uuid := public.current_session_profile_id();
  v_q text := lower(trim(coalesce(p_search, '')));
  v_rows jsonb;
begin
  perform public.assert_church_room_manager(v_actor);

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'profile_id', p.id,
      'full_name', p.full_name,
      'phone', p.phone,
      'birth_date', p.birth_date,
      'registered_event_name', (
        select coalesce(nullif(trim(e.name), ''), 'Evento')
          from public.event_registrations er
          join public.events e on e.id = er.event_id
         where er.profile_id = p.id
           and e.event_date is not null
           and e.event_date::date >= current_date
         order by e.event_date asc
         limit 1
      ),
      'room_key', eff.room_key,
      'room_label', eff.room_label,
      'room_kind', eff.room_kind,
      'padrao_room_key', eff.padrao_room_key,
      'padrao_room_label', eff.padrao_room_label,
      'especial_room_key', eff.especial_room_key,
      'especial_room_label', eff.especial_room_label,
      'especial_end_date', eff.especial_end_date
    )
    order by lower(coalesce(p.full_name, '')), p.phone
  ), '[]'::jsonb)
    into v_rows
    from public.profiles p
    join public.profile_igreja_vinculos v
      on v.profile_id = p.id
     and v.tenant_id = v_tenant
    left join lateral public.effective_user_room(v_tenant, p.id, current_date) eff on true
   where p.membership_out is null
     and (
     v_q = ''
     or lower(coalesce(p.full_name, '')) like '%' || v_q || '%'
     or regexp_replace(coalesce(p.phone, ''), '\D', '', 'g') like '%' || regexp_replace(v_q, '\D', '', 'g') || '%'
   );

  return v_rows;
end;
$$;

grant execute on function public.list_profiles_for_room_assignment(text) to anon, authenticated;

create or replace function public.resolve_audience_room_labels(p_phones text[] default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
  v_rows jsonb;
begin
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'profile_id', p.id,
      'phone', p.phone,
      'full_name', p.full_name,
      'room_key', eff.room_key,
      'room_label', eff.room_label,
      'room_kind', eff.room_kind
    )
  ), '[]'::jsonb)
    into v_rows
    from public.profiles p
    join public.profile_igreja_vinculos v
      on v.profile_id = p.id
     and v.tenant_id = v_tenant
    join lateral public.effective_user_room(v_tenant, p.id, current_date) eff on true
   where eff.room_key is not null
     and (
       p_phones is null
       or cardinality(p_phones) = 0
       or p.phone = any (p_phones)
       or regexp_replace(coalesce(p.phone, ''), '\D', '', 'g') = any (
         select regexp_replace(coalesce(x, ''), '\D', '', 'g')
           from unnest(p_phones) as x
       )
     );

  return v_rows;
end;
$$;

grant execute on function public.resolve_audience_room_labels(text[]) to anon, authenticated;

notify pgrst, 'reload schema';

select 'church-room-settings-special-rooms: ok' as status;
