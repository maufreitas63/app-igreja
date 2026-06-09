-- Passo 9f: RLS nas tabelas de dados usando profile_has_access.
-- Requer: access-control-schema.sql, profiles-access-pin.sql (find_profile_id_by_phone).
-- O app envia o header x-profile-id (lib/supabase.ts) com profiles.id da sessão.
--
-- Modo legado: se não existir nenhum grant em access_grants, as policies liberam acesso
-- (comportamento atual do app). Com ACL ativo, exige header + grant ou exceções documentadas.

-- ---------------------------------------------------------------------------
-- Helpers de sessão / ACL
-- ---------------------------------------------------------------------------

create or replace function public.acl_enforcement_enabled()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.access_grants limit 1);
$$;

create or replace function public.current_session_profile_id()
returns uuid
language plpgsql
stable
as $$
declare
  v_headers text;
  v_raw text;
begin
  begin
    v_headers := current_setting('request.headers', true);
  exception
    when others then
      return null;
  end;

  if v_headers is null or v_headers = '' then
    return null;
  end if;

  v_raw := nullif(trim(coalesce((v_headers::json ->> 'x-profile-id'), '')), '');

  if v_raw is null then
    return null;
  end if;

  begin
    return v_raw::uuid;
  exception
    when invalid_text_representation then
      return null;
  end;
end;
$$;

create or replace function public.session_profile_family_id()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select nullif(trim(coalesce(p.family_id, '')), '')
    from public.profiles p
   where p.id = public.current_session_profile_id();
$$;

create or replace function public.session_has_resource_access(
  p_resource_type text,
  p_resource_key text,
  p_action text
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    not public.acl_enforcement_enabled()
    or public.profile_has_access(
      public.current_session_profile_id(),
      lower(trim(coalesce(p_resource_type, ''))),
      trim(coalesce(p_resource_key, '')),
      lower(trim(coalesce(p_action, '')))
    );
$$;

create or replace function public.session_has_screen_access(
  p_screen_key text,
  p_action text default 'view'
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.session_has_resource_access('screen', p_screen_key, p_action);
$$;

-- ---------------------------------------------------------------------------
-- Grant complementar: member lê financials quando tem tela /financial
-- ---------------------------------------------------------------------------

insert into public.access_grants (role_id, resource_id, can_view, can_update)
select r.id, res.id, true, false
  from public.access_roles r
  join public.access_resources res
    on res.resource_type = 'table'
   and res.resource_key = 'financials'
 where r.code = 'member'
on conflict (role_id, resource_id) where (role_id is not null) do update
  set can_view = excluded.can_view,
      can_update = excluded.can_update,
      updated_at = now();

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;

drop policy if exists profiles_select_acl on public.profiles;
create policy profiles_select_acl
  on public.profiles
  for select
  to anon, authenticated
  using (
    public.session_has_resource_access('table', 'profiles', 'view')
  );

drop policy if exists profiles_insert_acl on public.profiles;
create policy profiles_insert_acl
  on public.profiles
  for insert
  to anon, authenticated
  with check (
    public.session_has_resource_access('table', 'profiles', 'update')
  );

drop policy if exists profiles_update_acl on public.profiles;
create policy profiles_update_acl
  on public.profiles
  for update
  to anon, authenticated
  using (
    not public.acl_enforcement_enabled()
    or (
      public.current_session_profile_id() is not null
      and public.profile_has_access(public.current_session_profile_id(), 'table', 'profiles', 'update')
      and (
        id = public.current_session_profile_id()
        or public.profile_has_access(public.current_session_profile_id(), 'table', '*', 'update')
      )
    )
  )
  with check (
    not public.acl_enforcement_enabled()
    or (
      public.current_session_profile_id() is not null
      and public.profile_has_access(public.current_session_profile_id(), 'table', 'profiles', 'update')
      and (
        id = public.current_session_profile_id()
        or public.profile_has_access(public.current_session_profile_id(), 'table', '*', 'update')
      )
    )
  );

drop policy if exists profiles_delete_acl on public.profiles;
create policy profiles_delete_acl
  on public.profiles
  for delete
  to anon, authenticated
  using (
    public.current_session_profile_id() is not null
    and public.profile_has_access(public.current_session_profile_id(), 'table', '*', 'update')
  );

grant select, insert, update, delete on public.profiles to anon, authenticated;

-- ---------------------------------------------------------------------------
-- members
-- ---------------------------------------------------------------------------

alter table public.members enable row level security;

drop policy if exists members_select_policy on public.members;
drop policy if exists members_select_acl on public.members;
create policy members_select_acl
  on public.members
  for select
  to anon, authenticated
  using (
    public.session_has_resource_access('table', 'members', 'view')
    or (
      public.current_session_profile_id() is not null
      and public.session_profile_family_id() is not null
      and family_id = public.session_profile_family_id()
    )
  );

drop policy if exists members_insert_policy on public.members;
drop policy if exists members_insert_acl on public.members;
create policy members_insert_acl
  on public.members
  for insert
  to anon, authenticated
  with check (
    public.session_has_resource_access('table', 'members', 'update')
    or (
      public.current_session_profile_id() is not null
      and public.session_profile_family_id() is not null
      and family_id = public.session_profile_family_id()
    )
  );

drop policy if exists members_update_policy on public.members;
drop policy if exists members_update_acl on public.members;
create policy members_update_acl
  on public.members
  for update
  to anon, authenticated
  using (
    public.session_has_resource_access('table', 'members', 'update')
    or (
      public.current_session_profile_id() is not null
      and public.session_profile_family_id() is not null
      and family_id = public.session_profile_family_id()
    )
  )
  with check (
    public.session_has_resource_access('table', 'members', 'update')
    or (
      public.current_session_profile_id() is not null
      and public.session_profile_family_id() is not null
      and family_id = public.session_profile_family_id()
    )
  );

drop policy if exists members_delete_acl on public.members;
create policy members_delete_acl
  on public.members
  for delete
  to anon, authenticated
  using (
    public.session_has_resource_access('table', 'members', 'update')
    or (
      public.current_session_profile_id() is not null
      and public.session_profile_family_id() is not null
      and family_id = public.session_profile_family_id()
    )
  );

grant select, insert, update, delete on public.members to anon, authenticated;

-- ---------------------------------------------------------------------------
-- events
-- ---------------------------------------------------------------------------

alter table public.events enable row level security;

drop policy if exists events_select_policy on public.events;
drop policy if exists events_select_acl on public.events;
create policy events_select_acl
  on public.events
  for select
  to anon, authenticated
  using (
    public.session_has_resource_access('table', 'events', 'view')
    or coalesce(is_locked, false) = false
  );

drop policy if exists events_insert_policy on public.events;
drop policy if exists events_insert_acl on public.events;
create policy events_insert_acl
  on public.events
  for insert
  to anon, authenticated
  with check (
    public.session_has_resource_access('table', 'events', 'update')
  );

drop policy if exists events_update_policy on public.events;
drop policy if exists events_update_acl on public.events;
create policy events_update_acl
  on public.events
  for update
  to anon, authenticated
  using (public.session_has_resource_access('table', 'events', 'update'))
  with check (public.session_has_resource_access('table', 'events', 'update'));

drop policy if exists events_delete_policy on public.events;
drop policy if exists events_delete_acl on public.events;
create policy events_delete_acl
  on public.events
  for delete
  to anon, authenticated
  using (public.session_has_resource_access('table', 'events', 'update'));

grant select, insert, update, delete on public.events to anon, authenticated;

-- ---------------------------------------------------------------------------
-- event_registrations
-- ---------------------------------------------------------------------------

alter table public.event_registrations enable row level security;

drop policy if exists event_registrations_select_acl on public.event_registrations;
create policy event_registrations_select_acl
  on public.event_registrations
  for select
  to anon, authenticated
  using (
    public.session_has_resource_access('table', 'event_registrations', 'view')
    or profile_id::text = public.current_session_profile_id()::text
  );

drop policy if exists event_registrations_insert_acl on public.event_registrations;
create policy event_registrations_insert_acl
  on public.event_registrations
  for insert
  to anon, authenticated
  with check (
    public.session_has_resource_access('table', 'event_registrations', 'update')
    or profile_id::text = public.current_session_profile_id()::text
  );

drop policy if exists event_registrations_update_acl on public.event_registrations;
create policy event_registrations_update_acl
  on public.event_registrations
  for update
  to anon, authenticated
  using (
    public.session_has_resource_access('table', 'event_registrations', 'update')
    or profile_id::text = public.current_session_profile_id()::text
  )
  with check (
    public.session_has_resource_access('table', 'event_registrations', 'update')
    or profile_id::text = public.current_session_profile_id()::text
  );

drop policy if exists event_registrations_delete_acl on public.event_registrations;
create policy event_registrations_delete_acl
  on public.event_registrations
  for delete
  to anon, authenticated
  using (
    public.session_has_resource_access('table', 'event_registrations', 'update')
    or profile_id::text = public.current_session_profile_id()::text
  );

grant select, insert, update, delete on public.event_registrations to anon, authenticated;

-- ---------------------------------------------------------------------------
-- pastoral_requests (substituído por access-control-pastoral-intercessao.sql)
-- ---------------------------------------------------------------------------

create or replace function public.session_has_full_pastoral_requests_access()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_super_admin_profile(public.current_session_profile_id())
    or exists (
      select 1
        from public.profile_access_roles par
        join public.access_roles ar on ar.id = par.role_id
       where par.profile_id = public.current_session_profile_id()
         and ar.code = 'pastoral'
    );
$$;

create or replace function public.session_profile_is_intercession_scale_volunteer()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select false;
$$;

create or replace function public.pastoral_destination_label_is_sigilo(p_label text)
returns boolean
language sql
immutable
as $$
  select lower(trim(coalesce(p_label, ''))) = 'sigilo pastoral';
$$;

create or replace function public.pastoral_destination_label_is_intercession(p_label text)
returns boolean
language sql
immutable
as $$
  select lower(trim(coalesce(p_label, ''))) like '%intercess%';
$$;

create or replace function public.session_can_view_pastoral_request(
  p_request_profile_id uuid,
  p_destination_label text
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    p_request_profile_id::text = public.current_session_profile_id()::text
    or public.session_has_resource_access('table', 'pastoral_requests', 'view');
$$;

create or replace function public.session_can_update_pastoral_request(
  p_request_profile_id uuid,
  p_destination_label text
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    p_request_profile_id::text = public.current_session_profile_id()::text
    or public.session_has_resource_access('table', 'pastoral_requests', 'update');
$$;

alter table public.pastoral_requests enable row level security;

drop policy if exists pastoral_requests_select_acl on public.pastoral_requests;
create policy pastoral_requests_select_acl
  on public.pastoral_requests
  for select
  to anon, authenticated
  using (
    public.session_can_view_pastoral_request(profile_id, destination_label)
  );

drop policy if exists pastoral_requests_insert_acl on public.pastoral_requests;
create policy pastoral_requests_insert_acl
  on public.pastoral_requests
  for insert
  to anon, authenticated
  with check (
    profile_id::text = public.current_session_profile_id()::text
    and (
      not public.acl_enforcement_enabled()
      or public.session_has_resource_access('table', 'pastoral_requests', 'update')
    )
  );

drop policy if exists pastoral_requests_update_policy on public.pastoral_requests;
drop policy if exists pastoral_requests_update_acl on public.pastoral_requests;
create policy pastoral_requests_update_acl
  on public.pastoral_requests
  for update
  to anon, authenticated
  using (
    public.session_can_update_pastoral_request(profile_id, destination_label)
  )
  with check (
    public.session_can_update_pastoral_request(profile_id, destination_label)
  );

grant select, insert, update on public.pastoral_requests to anon, authenticated;

-- ---------------------------------------------------------------------------
-- financials
-- ---------------------------------------------------------------------------

alter table public.financials enable row level security;

drop policy if exists financials_select_authenticated on public.financials;
drop policy if exists financials_select_anon on public.financials;
drop policy if exists financials_select_acl on public.financials;
create policy financials_select_acl
  on public.financials
  for select
  to anon, authenticated
  using (
    public.session_has_resource_access('table', 'financials', 'view')
    or public.session_has_screen_access('/financial', 'view')
  );

drop policy if exists financials_write_acl on public.financials;
create policy financials_write_acl
  on public.financials
  for all
  to anon, authenticated
  using (public.session_has_resource_access('table', 'financials', 'update'))
  with check (public.session_has_resource_access('table', 'financials', 'update'));

grant select, insert, update, delete on public.financials to anon, authenticated;

-- ---------------------------------------------------------------------------
-- profile_vehicles
-- ---------------------------------------------------------------------------

alter table public.profile_vehicles enable row level security;

drop policy if exists profile_vehicles_select_policy on public.profile_vehicles;
drop policy if exists profile_vehicles_select_acl on public.profile_vehicles;
create policy profile_vehicles_select_acl
  on public.profile_vehicles
  for select
  to anon, authenticated
  using (public.session_has_resource_access('table', 'profile_vehicles', 'view'));

drop policy if exists profile_vehicles_insert_policy on public.profile_vehicles;
drop policy if exists profile_vehicles_insert_acl on public.profile_vehicles;
create policy profile_vehicles_insert_acl
  on public.profile_vehicles
  for insert
  to anon, authenticated
  with check (public.session_has_resource_access('table', 'profile_vehicles', 'update'));

drop policy if exists profile_vehicles_update_policy on public.profile_vehicles;
drop policy if exists profile_vehicles_update_acl on public.profile_vehicles;
create policy profile_vehicles_update_acl
  on public.profile_vehicles
  for update
  to anon, authenticated
  using (public.session_has_resource_access('table', 'profile_vehicles', 'update'))
  with check (public.session_has_resource_access('table', 'profile_vehicles', 'update'));

drop policy if exists profile_vehicles_delete_policy on public.profile_vehicles;
drop policy if exists profile_vehicles_delete_acl on public.profile_vehicles;
create policy profile_vehicles_delete_acl
  on public.profile_vehicles
  for delete
  to anon, authenticated
  using (public.session_has_resource_access('table', 'profile_vehicles', 'update'));

grant select, insert, update, delete on public.profile_vehicles to anon, authenticated;

-- ---------------------------------------------------------------------------
-- families
-- ---------------------------------------------------------------------------

alter table public.families enable row level security;

drop policy if exists families_select_acl on public.families;
create policy families_select_acl
  on public.families
  for select
  to anon, authenticated
  using (
    public.session_has_resource_access('table', 'families', 'view')
    or (
      public.current_session_profile_id() is not null
      and exists (
        select 1
          from public.profiles p
         where p.id = public.current_session_profile_id()
           and p.family_group_id is not null
           and public.families.id::text = trim(p.family_group_id::text)
      )
    )
  );

grant select on public.families to anon, authenticated;

-- ---------------------------------------------------------------------------
-- app_parameters (leitura ampla — PIX, QR, totem)
-- ---------------------------------------------------------------------------

alter table public.app_parameters enable row level security;

drop policy if exists app_parameters_select_acl on public.app_parameters;
create policy app_parameters_select_acl
  on public.app_parameters
  for select
  to anon, authenticated
  using (public.session_has_resource_access('table', 'app_parameters', 'view'));

grant select on public.app_parameters to anon, authenticated;

-- ---------------------------------------------------------------------------
-- pastoral_reason_categories / subcategories (leitura do formulário)
-- ---------------------------------------------------------------------------

alter table public.pastoral_reason_categories enable row level security;
alter table public.pastoral_reason_subcategories enable row level security;

drop policy if exists pastoral_reason_categories_select on public.pastoral_reason_categories;
drop policy if exists pastoral_reason_categories_select_acl on public.pastoral_reason_categories;
create policy pastoral_reason_categories_select_acl
  on public.pastoral_reason_categories
  for select
  to anon, authenticated
  using (public.session_has_resource_access('table', 'pastoral_reason_categories', 'view'));

drop policy if exists pastoral_reason_subcategories_select on public.pastoral_reason_subcategories;
drop policy if exists pastoral_reason_subcategories_select_acl on public.pastoral_reason_subcategories;
create policy pastoral_reason_subcategories_select_acl
  on public.pastoral_reason_subcategories
  for select
  to anon, authenticated
  using (public.session_has_resource_access('table', 'pastoral_reason_subcategories', 'view'));

grant select on public.pastoral_reason_categories to anon, authenticated;
grant select on public.pastoral_reason_subcategories to anon, authenticated;

-- Garante recursos de tabela usados nas policies
insert into public.access_resources (resource_type, resource_key, label)
values
  ('table', 'event_registrations', 'Inscrições em eventos'),
  ('table', 'profile_vehicles', 'Veículos do perfil'),
  ('table', 'families', 'Famílias'),
  ('table', 'app_parameters', 'Parâmetros do app'),
  ('table', 'pastoral_reason_categories', 'Categorias pastorais'),
  ('table', 'pastoral_reason_subcategories', 'Subcategorias pastorais'),
  ('table', 'financials', 'Lançamentos financeiros')
on conflict (resource_type, resource_key) do update
  set label = excluded.label;

-- Grants de tabela que o member usa mas podem faltar no seed antigo
insert into public.access_grants (role_id, resource_id, can_view, can_update)
select r.id, res.id, g.can_view, g.can_update
  from public.access_roles r
 cross join (
    values
      ('table', 'events', true, false),
      ('table', 'event_registrations', true, true),
      ('table', 'profile_vehicles', true, true),
      ('table', 'families', true, false),
      ('table', 'app_parameters', true, false),
      ('table', 'pastoral_reason_categories', true, false),
      ('table', 'pastoral_reason_subcategories', true, false)
  ) as g(resource_type, resource_key, can_view, can_update)
  join public.access_resources res
    on res.resource_type = g.resource_type
   and res.resource_key = g.resource_key
 where r.code = 'member'
on conflict (role_id, resource_id) where (role_id is not null) do update
  set can_view = excluded.can_view,
      can_update = excluded.can_update,
      updated_at = now();

grant execute on function public.acl_enforcement_enabled() to anon, authenticated;
grant execute on function public.current_session_profile_id() to anon, authenticated;
grant execute on function public.session_profile_family_id() to anon, authenticated;
grant execute on function public.session_has_resource_access(text, text, text) to anon, authenticated;
grant execute on function public.session_has_screen_access(text, text) to anon, authenticated;

notify pgrst, 'reload schema';
