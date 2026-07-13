-- =============================================================================
-- Salas personalizadas por instância + atribuição de membros
-- =============================================================================
-- Execute no SQL Editor do Supabase (produção), com a sessão/tenant desejado
-- já suportado pelos helpers multi-tenant.
--
-- Pré-requisitos:
--   scripts/multi-tenant-01-schema.sql
--   scripts/multi-tenant-wave0-helper.sql
--   access-control (profile_has_access / profile_has_role_code / is_super_admin_profile)
--
-- Após executar: hard refresh no app e testar em IBEP.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1) Tabelas
-- ---------------------------------------------------------------------------

create table if not exists public.church_room_settings (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.igrejas (id) on delete cascade,
  room_key text not null,
  display_label text not null,
  badge_label text null,
  color_hex text null,
  is_enabled boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint church_room_settings_room_key_check
    check (upper(trim(room_key)) in ('KIDS', 'TEENS')),
  constraint church_room_settings_tenant_room_unique
    unique (tenant_id, room_key)
);

create index if not exists church_room_settings_tenant_idx
  on public.church_room_settings (tenant_id);

create table if not exists public.user_room_assignment (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.igrejas (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  room_key text not null,
  assigned_by_profile_id uuid null references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_room_assignment_room_key_check
    check (upper(trim(room_key)) in ('KIDS', 'TEENS')),
  constraint user_room_assignment_tenant_profile_unique
    unique (tenant_id, profile_id)
);

create index if not exists user_room_assignment_tenant_idx
  on public.user_room_assignment (tenant_id);

create index if not exists user_room_assignment_profile_idx
  on public.user_room_assignment (profile_id);

-- Tenant automático no insert
do $$
begin
  if exists (
    select 1 from pg_proc where proname = 'tg_set_tenant_id_from_session'
  ) then
    drop trigger if exists trg_church_room_settings_tenant on public.church_room_settings;
    create trigger trg_church_room_settings_tenant
      before insert on public.church_room_settings
      for each row
      execute function public.tg_set_tenant_id_from_session();

    drop trigger if exists trg_user_room_assignment_tenant on public.user_room_assignment;
    create trigger trg_user_room_assignment_tenant
      before insert on public.user_room_assignment
      for each row
      execute function public.tg_set_tenant_id_from_session();
  end if;
end $$;

alter table public.church_room_settings enable row level security;
alter table public.user_room_assignment enable row level security;

drop policy if exists church_room_settings_tenant_all on public.church_room_settings;
create policy church_room_settings_tenant_all
  on public.church_room_settings
  for all
  using (
    public.session_tenant_matches(tenant_id)
    or public.is_super_admin_profile(public.current_session_profile_id())
  )
  with check (
    public.session_tenant_matches(tenant_id)
    or public.is_super_admin_profile(public.current_session_profile_id())
  );

drop policy if exists user_room_assignment_tenant_all on public.user_room_assignment;
create policy user_room_assignment_tenant_all
  on public.user_room_assignment
  for all
  using (
    public.session_tenant_matches(tenant_id)
    or public.is_super_admin_profile(public.current_session_profile_id())
  )
  with check (
    public.session_tenant_matches(tenant_id)
    or public.is_super_admin_profile(public.current_session_profile_id())
  );

-- ---------------------------------------------------------------------------
-- 2) Seed defaults por igreja (IBN / IBEP / demais)
-- ---------------------------------------------------------------------------

insert into public.church_room_settings (tenant_id, room_key, display_label, sort_order)
select i.id, 'KIDS', 'Infantil', 10
  from public.igrejas i
 where not exists (
   select 1 from public.church_room_settings s
    where s.tenant_id = i.id and s.room_key = 'KIDS'
 )
union all
select i.id, 'TEENS', 'Jovens', 20
  from public.igrejas i
 where not exists (
   select 1 from public.church_room_settings s
    where s.tenant_id = i.id and s.room_key = 'TEENS'
 );

-- ---------------------------------------------------------------------------
-- 3) ACL
-- ---------------------------------------------------------------------------

insert into public.access_resources (resource_type, resource_key, label, description, is_active)
values
  (
    'screen',
    '/configuracao-salas',
    'Configuração de salas',
    'Nomes afetivos das salas e atribuição de membros',
    true
  ),
  (
    'table',
    'church_room_settings',
    'Configuração de salas',
    null,
    true
  ),
  (
    'table',
    'user_room_assignment',
    'Atribuição de membros às salas',
    null,
    true
  )
on conflict (resource_type, resource_key) do update
  set label = excluded.label,
      description = excluded.description,
      is_active = true;

-- Grants: líder, líder geral, events_admin, super_admin
insert into public.access_grants (role_id, resource_id, can_view, can_update)
select r.id, res.id, true, true
  from public.access_roles r
  cross join public.access_resources res
 where r.code in ('lider', 'lider_geral', 'events_admin', 'super_admin')
   and res.resource_type = 'screen'
   and res.resource_key = '/configuracao-salas'
   and not exists (
     select 1
       from public.access_grants g
      where g.role_id = r.id
        and g.resource_id = res.id
   );

update public.access_grants g
   set can_view = true,
       can_update = true
  from public.access_roles r
  join public.access_resources res on true
 where g.role_id = r.id
   and g.resource_id = res.id
   and r.code in ('lider', 'lider_geral', 'events_admin', 'super_admin')
   and res.resource_type = 'screen'
   and res.resource_key = '/configuracao-salas';

insert into public.access_grants (role_id, resource_id, can_view, can_update)
select r.id, res.id, true, true
  from public.access_roles r
  cross join public.access_resources res
 where r.code in ('lider', 'lider_geral', 'events_admin', 'super_admin')
   and res.resource_type = 'table'
   and res.resource_key in ('church_room_settings', 'user_room_assignment')
   and not exists (
     select 1
       from public.access_grants g
      where g.role_id = r.id
        and g.resource_id = res.id
   );

update public.access_grants g
   set can_view = true,
       can_update = true
  from public.access_roles r
  join public.access_resources res on true
 where g.role_id = r.id
   and g.resource_id = res.id
   and r.code in ('lider', 'lider_geral', 'events_admin', 'super_admin')
   and res.resource_type = 'table'
   and res.resource_key in ('church_room_settings', 'user_room_assignment');

-- ---------------------------------------------------------------------------
-- 4) Helpers
-- ---------------------------------------------------------------------------

create or replace function public.assert_church_room_manager(p_actor uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_actor is null then
    raise exception 'Sessão inválida. Saia e entre novamente.';
  end if;

  if public.is_super_admin_profile(p_actor) then
    return;
  end if;

  if public.profile_has_role_code(p_actor, 'events_admin')
     or public.profile_has_role_code(p_actor, 'lider')
     or public.profile_has_role_code(p_actor, 'lider_geral')
     or public.profile_has_access(p_actor, 'screen', '/configuracao-salas', 'view') then
    return;
  end if;

  raise exception 'Apenas Líder ou Administrador pode gerenciar salas.';
end;
$$;

create or replace function public.normalize_church_room_key(p_room_key text)
returns text
language sql
immutable
as $$
  select upper(trim(coalesce(p_room_key, '')));
$$;

-- ---------------------------------------------------------------------------
-- 5) RPCs — configuração de salas
-- ---------------------------------------------------------------------------

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
  -- Garante defaults se a instância ainda não tiver linhas
  insert into public.church_room_settings (tenant_id, room_key, display_label, sort_order)
  select v_tenant, x.room_key, x.display_label, x.sort_order
    from (values
      ('KIDS', 'Infantil', 10),
      ('TEENS', 'Jovens', 20)
    ) as x(room_key, display_label, sort_order)
   where not exists (
     select 1 from public.church_room_settings s
      where s.tenant_id = v_tenant and s.room_key = x.room_key
   );

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', s.id,
      'tenant_id', s.tenant_id,
      'room_key', s.room_key,
      'display_label', s.display_label,
      'badge_label', s.badge_label,
      'color_hex', s.color_hex,
      'is_enabled', s.is_enabled,
      'sort_order', s.sort_order
    )
    order by s.sort_order, s.room_key
  ), '[]'::jsonb)
    into v_rows
    from public.church_room_settings s
   where s.tenant_id = v_tenant;

  return v_rows;
end;
$$;

grant execute on function public.list_church_room_settings() to anon, authenticated;

create or replace function public.upsert_church_room_setting(
  p_room_key text,
  p_display_label text,
  p_badge_label text default null,
  p_is_enabled boolean default true,
  p_sort_order integer default null
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
  v_label text := trim(coalesce(p_display_label, ''));
  v_row public.church_room_settings%rowtype;
begin
  perform public.assert_church_room_manager(v_actor);

  -- Preferir scripts/church-room-settings-custom-rooms.sql para salas extras.
  -- Aqui já liberamos qualquer room_key válido para não bloquear deploys mistos.
  if v_key is null or v_key !~ '^[A-Z0-9_]{2,40}$' then
    return jsonb_build_object('success', false, 'message', 'Código da sala inválido.');
  end if;

  if char_length(v_label) < 2 then
    return jsonb_build_object('success', false, 'message', 'Informe um nome afetivo (mínimo 2 caracteres).');
  end if;

  insert into public.church_room_settings as s (
    tenant_id, room_key, display_label, badge_label, is_enabled, sort_order, updated_at
  )
  values (
    v_tenant,
    v_key,
    v_label,
    nullif(trim(coalesce(p_badge_label, '')), ''),
    coalesce(p_is_enabled, true),
    coalesce(
      p_sort_order,
      case
        when v_key = 'KIDS' then 10
        when v_key = 'TEENS' then 20
        else 100
      end
    ),
    now()
  )
  on conflict (tenant_id, room_key) do update
    set display_label = excluded.display_label,
        badge_label = excluded.badge_label,
        is_enabled = excluded.is_enabled,
        sort_order = coalesce(excluded.sort_order, s.sort_order),
        updated_at = now()
  returning * into v_row;

  return jsonb_build_object(
    'success', true,
    'message', 'Sala atualizada.',
    'row', jsonb_build_object(
      'id', v_row.id,
      'tenant_id', v_row.tenant_id,
      'room_key', v_row.room_key,
      'display_label', v_row.display_label,
      'badge_label', v_row.badge_label,
      'color_hex', v_row.color_hex,
      'is_enabled', v_row.is_enabled,
      'sort_order', v_row.sort_order
    )
  );
end;
$$;

grant execute on function public.upsert_church_room_setting(text, text, text, boolean, integer) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 6) RPCs — atribuição de usuários
-- ---------------------------------------------------------------------------

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
      'room_key', a.room_key,
      'room_label', coalesce(nullif(trim(s.display_label), ''), a.room_key)
    )
    order by lower(coalesce(p.full_name, '')), p.phone
  ), '[]'::jsonb)
    into v_rows
    from public.profiles p
    join public.profile_igreja_vinculos v
      on v.profile_id = p.id
     and v.tenant_id = v_tenant
    left join public.user_room_assignment a
      on a.profile_id = p.id
     and a.tenant_id = v_tenant
    left join public.church_room_settings s
      on s.tenant_id = v_tenant
     and s.room_key = a.room_key
   where (
     v_q = ''
     or lower(coalesce(p.full_name, '')) like '%' || v_q || '%'
     or regexp_replace(coalesce(p.phone, ''), '\D', '', 'g') like '%' || regexp_replace(v_q, '\D', '', 'g') || '%'
   );

  return v_rows;
end;
$$;

grant execute on function public.list_profiles_for_room_assignment(text) to anon, authenticated;

create or replace function public.set_user_room_assignment(
  p_profile_id uuid,
  p_room_key text
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
  v_label text;
begin
  perform public.assert_church_room_manager(v_actor);

  if p_profile_id is null then
    return jsonb_build_object('success', false, 'message', 'Perfil não informado.');
  end if;

  if v_key not in ('KIDS', 'TEENS') then
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

  if not exists (
    select 1 from public.church_room_settings s
     where s.tenant_id = v_tenant and s.room_key = v_key and s.is_enabled
  ) then
    return jsonb_build_object('success', false, 'message', 'Sala desabilitada nesta instância.');
  end if;

  insert into public.user_room_assignment as a (
    tenant_id, profile_id, room_key, assigned_by_profile_id, updated_at
  )
  values (v_tenant, p_profile_id, v_key, v_actor, now())
  on conflict (tenant_id, profile_id) do update
    set room_key = excluded.room_key,
        assigned_by_profile_id = excluded.assigned_by_profile_id,
        updated_at = now();

  select s.display_label into v_label
    from public.church_room_settings s
   where s.tenant_id = v_tenant and s.room_key = v_key;

  return jsonb_build_object(
    'success', true,
    'message', 'Atribuição salva.',
    'profile_id', p_profile_id,
    'room_key', v_key,
    'room_label', coalesce(v_label, v_key)
  );
end;
$$;

grant execute on function public.set_user_room_assignment(uuid, text) to anon, authenticated;

create or replace function public.clear_user_room_assignment(p_profile_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
  v_actor uuid := public.current_session_profile_id();
begin
  perform public.assert_church_room_manager(v_actor);

  if p_profile_id is null then
    return jsonb_build_object('success', false, 'message', 'Perfil não informado.');
  end if;

  delete from public.user_room_assignment a
   where a.tenant_id = v_tenant
     and a.profile_id = p_profile_id;

  return jsonb_build_object('success', true, 'message', 'Atribuição removida.');
end;
$$;

grant execute on function public.clear_user_room_assignment(uuid) to anon, authenticated;

-- Resolve rótulos para audiência (telefone → sala)
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
      'room_key', a.room_key,
      'room_label', coalesce(nullif(trim(s.display_label), ''), a.room_key)
    )
  ), '[]'::jsonb)
    into v_rows
    from public.user_room_assignment a
    join public.profiles p on p.id = a.profile_id
    left join public.church_room_settings s
      on s.tenant_id = a.tenant_id
     and s.room_key = a.room_key
   where a.tenant_id = v_tenant
     and (
       p_phones is null
       or cardinality(p_phones) = 0
       or p.phone = any (p_phones)
       or regexp_replace(coalesce(p.phone, ''), '\D', '', 'g') = any (
         select regexp_replace(coalesce(x, ''), '\D', '', 'g') from unnest(p_phones) as x
       )
     );

  return v_rows;
end;
$$;

grant execute on function public.resolve_audience_room_labels(text[]) to anon, authenticated;

notify pgrst, 'reload schema';

select
  'church_room_settings + user_room_assignment prontos.' as status,
  (select count(*) from public.church_room_settings) as room_rows,
  (select count(*) from public.igrejas) as churches;
