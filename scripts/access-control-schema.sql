-- Controle de acesso por perfil (profiles.id): telas, tabelas e colunas.
-- view / update por recurso, via papel (access_roles) ou grant direto ao perfil.
--
-- Execute no SQL Editor do Supabase.
-- Documentação: CONTROLE_ACESSO.md

-- ---------------------------------------------------------------------------
-- Catálogo de recursos
-- ---------------------------------------------------------------------------

create table if not exists public.access_resources (
  id uuid primary key default gen_random_uuid(),
  resource_type text not null,
  resource_key text not null,
  label text not null default '',
  description text null,
  parent_resource_id uuid null references public.access_resources (id) on delete set null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint access_resources_type_check
    check (resource_type in ('screen', 'table', 'column')),
  constraint access_resources_key_check
    check (char_length(trim(resource_key)) > 0),
  constraint access_resources_unique_type_key
    unique (resource_type, resource_key)
);

create index if not exists idx_access_resources_parent
  on public.access_resources (parent_resource_id);

create index if not exists idx_access_resources_type_key
  on public.access_resources (resource_type, resource_key);

-- ---------------------------------------------------------------------------
-- Papéis
-- ---------------------------------------------------------------------------

create table if not exists public.access_roles (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  name text not null,
  description text null,
  is_system boolean not null default false,
  created_at timestamptz not null default now(),
  constraint access_roles_code_check
    check (code ~ '^[a-z][a-z0-9_]*$'),
  constraint access_roles_code_unique unique (code)
);

-- ---------------------------------------------------------------------------
-- Perfil ↔ papel
-- ---------------------------------------------------------------------------

create table if not exists public.profile_access_roles (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  role_id uuid not null references public.access_roles (id) on delete cascade,
  granted_at timestamptz not null default now(),
  granted_by_profile_id uuid null references public.profiles (id) on delete set null,
  primary key (profile_id, role_id)
);

create index if not exists idx_profile_access_roles_role
  on public.profile_access_roles (role_id);

-- ---------------------------------------------------------------------------
-- Grants (relacionamento principal: quem pode ver / atualizar o quê)
-- ---------------------------------------------------------------------------

create table if not exists public.access_grants (
  id uuid primary key default gen_random_uuid(),
  resource_id uuid not null references public.access_resources (id) on delete cascade,
  role_id uuid null references public.access_roles (id) on delete cascade,
  profile_id uuid null references public.profiles (id) on delete cascade,
  can_view boolean not null default false,
  can_update boolean not null default false,
  notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint access_grants_subject_check
    check (
      (role_id is not null and profile_id is null)
      or (role_id is null and profile_id is not null)
    ),
  constraint access_grants_permission_check
    check (can_view = true or can_update = true)
);

-- Unicidade separada: grants por papel (profile_id null) não podem colidir com
-- a constraint de perfil (antes, UNIQUE(profile_id, resource_id) tratava todos
-- os NULL como o mesmo valor e permitia só um grant por recurso no total).
alter table public.access_grants
  drop constraint if exists access_grants_role_resource_unique;

alter table public.access_grants
  drop constraint if exists access_grants_profile_resource_unique;

drop index if exists access_grants_role_resource_uq;
create unique index access_grants_role_resource_uq
  on public.access_grants (role_id, resource_id)
  where role_id is not null;

drop index if exists access_grants_profile_resource_uq;
create unique index access_grants_profile_resource_uq
  on public.access_grants (profile_id, resource_id)
  where profile_id is not null;

create index if not exists idx_access_grants_resource
  on public.access_grants (resource_id);

create index if not exists idx_access_grants_role
  on public.access_grants (role_id)
  where role_id is not null;

create index if not exists idx_access_grants_profile
  on public.access_grants (profile_id)
  where profile_id is not null;

-- Requer `public.find_profile_id_by_phone` (scripts/profiles-access-pin.sql).

-- ---------------------------------------------------------------------------
-- Checagem de permissão
-- ---------------------------------------------------------------------------

create or replace function public.access_resource_matches(
  p_grant_key text,
  p_requested_key text
)
returns boolean
language sql
immutable
as $$
  select
    p_grant_key = p_requested_key
    or p_grant_key = '*'
    or (
      right(p_grant_key, 2) = '.*'
      and left(p_requested_key, length(p_grant_key) - 1) = left(p_grant_key, length(p_grant_key) - 2)
    );
$$;

create or replace function public.role_has_access(
  p_role_code text,
  p_resource_type text,
  p_resource_key text,
  p_action text
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_type text;
  v_key text;
  v_action text;
  v_acl_enabled boolean;
  v_allowed boolean;
begin
  v_type := lower(trim(coalesce(p_resource_type, '')));
  v_key := trim(coalesce(p_resource_key, ''));
  v_action := lower(trim(coalesce(p_action, '')));

  if v_type not in ('screen', 'table', 'column') or v_key = '' then
    return false;
  end if;

  if v_action not in ('view', 'update') then
    return false;
  end if;

  select exists (select 1 from public.access_grants limit 1)
    into v_acl_enabled;

  if not v_acl_enabled then
    return true;
  end if;

  select exists (
    select 1
      from public.access_grants g
      join public.access_roles ar
        on ar.id = g.role_id
       and ar.code = lower(trim(coalesce(p_role_code, '')))
      join public.access_resources r on r.id = g.resource_id
     where r.resource_type = v_type
       and r.is_active = true
       and public.access_resource_matches(r.resource_key, v_key)
       and (
         (v_action = 'view' and g.can_view)
         or (v_action = 'update' and g.can_update)
       )
  )
    into v_allowed;

  return coalesce(v_allowed, false);
end;
$$;

create or replace function public.profile_has_access(
  p_profile_id uuid,
  p_resource_type text,
  p_resource_key text,
  p_action text
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_type text;
  v_key text;
  v_action text;
  v_acl_enabled boolean;
  v_allowed boolean;
  v_has_roles boolean;
begin
  v_type := lower(trim(coalesce(p_resource_type, '')));
  v_key := trim(coalesce(p_resource_key, ''));
  v_action := lower(trim(coalesce(p_action, '')));

  if v_type not in ('screen', 'table', 'column') or v_key = '' then
    return false;
  end if;

  if v_action not in ('view', 'update') then
    return false;
  end if;

  select exists (select 1 from public.access_grants limit 1)
    into v_acl_enabled;

  if not v_acl_enabled then
    return true;
  end if;

  if p_profile_id is null then
    return public.role_has_access('visitantes', v_type, v_key, v_action);
  end if;

  select exists (
    select 1
      from public.access_grants g
      join public.access_resources r on r.id = g.resource_id
     where r.resource_type = v_type
       and r.is_active = true
       and public.access_resource_matches(r.resource_key, v_key)
       and (
         (v_action = 'view' and g.can_view)
         or (v_action = 'update' and g.can_update)
       )
       and (
         g.profile_id = p_profile_id
         or g.role_id in (
           select par.role_id
             from public.profile_access_roles par
            where par.profile_id = p_profile_id
         )
       )
  )
    into v_allowed;

  if coalesce(v_allowed, false) then
    return true;
  end if;

  select exists (
    select 1
      from public.profile_access_roles par
     where par.profile_id = p_profile_id
  )
    into v_has_roles;

  if not coalesce(v_has_roles, false) then
    return public.role_has_access('visitantes', v_type, v_key, v_action);
  end if;

  return false;
end;
$$;

create or replace function public.profile_has_access_by_phone(
  p_phone text,
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
  select public.profile_has_access(
    public.find_profile_id_by_phone(p_phone),
    p_resource_type,
    p_resource_key,
    p_action
  );
$$;

-- ---------------------------------------------------------------------------
-- Seed: papéis
-- ---------------------------------------------------------------------------

insert into public.access_roles (code, name, description, is_system)
values
  ('member', 'Membro', 'Acesso padrão do aplicativo', true),
  ('congregado', 'Congregado', 'Participante cadastrado com acesso básico; sem gerência familiar', true),
  ('family_acceptor', 'Responsável familiar', 'Gerencia membros da família', true),
  ('visitantes', 'Visitantes', 'Acesso público mínimo sem perfil/papéis na sessão', true),
  ('events_admin', 'Administrador de eventos', 'Manutenção de eventos e salas', true),
  ('pastoral', 'Equipe pastoral', 'Pedidos e triagem pastoral', true),
  ('super_admin', 'Super administrador', 'Acesso total configurável', true)
on conflict (code) do update
  set name = excluded.name,
      description = excluded.description,
      is_system = excluded.is_system;

-- ---------------------------------------------------------------------------
-- Seed: recursos (telas)
-- ---------------------------------------------------------------------------

insert into public.access_resources (resource_type, resource_key, label, description)
values
  ('screen', '/', 'Login', null),
  ('screen', '/register', 'Cadastro', null),
  ('screen', '/dashboard', 'Dashboard', null),
  ('screen', '/maintenance-dashboard', 'Manutenção', null),
  ('screen', '/manage-profile', 'Dados cadastrais', null),
  ('screen', '/manage-members', 'Gerenciar família', null),
  ('screen', '/pastoral', 'Coração Aberto', null),
  ('screen', '/pastoral-history', 'Meus pedidos pastorais', null),
  ('screen', '/financial', 'Relatórios financeiros (/financial)', 'Resultado do mês, comparativos e orçamento'),
  ('screen', '/expense-report', 'Relatório de Despesas (RD)', null),
  ('screen', '/lgpd', 'LGPD', null),
  ('screen', 'dashboard.card.event_alt', 'Card Agenda da Família', null),
  ('screen', 'dashboard.card.qr', 'Card Check In', null),
  ('screen', 'dashboard.card.kids_teens', 'Card SALA(S)', null),
  ('screen', 'dashboard.card.offerings', 'Card Dízimos e Ofertas', null),
  ('screen', 'dashboard.card.pastoral', 'Card Coração Aberto', null),
  ('screen', 'dashboard.card.members_list', 'Card Lista de Membros', null),
  ('screen', 'dashboard.card.birthdays', 'Card Aniversariantes', null),
  ('screen', 'dashboard.card.financial', 'Card Financeiro (dashboard)', null),
  ('screen', 'dashboard.card.vigilance_scales', 'Card Escalas', null),
  ('screen', 'dashboard.card.parking_vehicle_v2', 'Card Estacionamento', null),
  ('screen', 'dashboard.card.grouped_manage', 'Card Menu', null),
  ('screen', '*', 'Todas as telas (curinga)', 'Uso restrito a super_admin')
on conflict (resource_type, resource_key) do update
  set label = excluded.label,
      description = excluded.description;

-- ---------------------------------------------------------------------------
-- Seed: recursos (tabelas)
-- ---------------------------------------------------------------------------

insert into public.access_resources (resource_type, resource_key, label)
values
  ('table', 'profiles', 'Perfis'),
  ('table', 'members', 'Membros da família'),
  ('table', 'events', 'Eventos'),
  ('table', 'event_registrations', 'Inscrições em eventos'),
  ('table', 'profile_vehicles', 'Veículos do perfil'),
  ('table', 'pastoral_requests', 'Pedidos pastorais'),
  ('table', 'pastoral_reason_categories', 'Categorias pastorais'),
  ('table', 'pastoral_reason_subcategories', 'Subcategorias pastorais'),
  ('table', 'app_parameters', 'Parâmetros do app'),
  ('table', 'families', 'Famílias'),
  ('table', 'financials', 'Lançamentos financeiros'),
  ('table', '*', 'Todas as tabelas (curinga)')
on conflict (resource_type, resource_key) do update
  set label = excluded.label;

-- ---------------------------------------------------------------------------
-- Seed: recursos (colunas sensíveis / editáveis em profiles)
-- ---------------------------------------------------------------------------

insert into public.access_resources (resource_type, resource_key, label)
values
  ('column', 'profiles.full_name', 'Nome completo'),
  ('column', 'profiles.phone', 'Telefone'),
  ('column', 'profiles.birth_date', 'Nascimento'),
  ('column', 'profiles.email', 'E-mail'),
  ('column', 'profiles.cpf', 'CPF'),
  ('column', 'profiles.access_pin', 'Senha de acesso (PIN)'),
  ('column', 'profiles.address_street', 'Rua'),
  ('column', 'profiles.address_number', 'Número'),
  ('column', 'profiles.address_complement', 'Complemento'),
  ('column', 'profiles.address_neighborhood', 'Bairro'),
  ('column', 'profiles.address_city', 'Cidade'),
  ('column', 'profiles.address_state', 'Estado'),
  ('column', 'profiles.cep', 'CEP'),
  ('column', 'profiles.medical_food_alerts', 'Alertas alimentares'),
  ('column', 'profiles.lgpd_accepted', 'LGPD aceito'),
  ('column', 'profiles.family_id', 'Código família'),
  ('column', 'profiles.role', 'Papel no sistema'),
  ('column', 'profiles.*', 'Todas as colunas de profiles (curinga)')
on conflict (resource_type, resource_key) do update
  set label = excluded.label;

-- ---------------------------------------------------------------------------
-- Seed: grants do papel member (exemplo mínimo)
-- ---------------------------------------------------------------------------

insert into public.access_grants (role_id, resource_id, can_view, can_update)
select r.id, res.id, g.can_view, g.can_update
  from public.access_roles r
 cross join (
    values
      ('screen', '/dashboard', true, false),
      ('screen', '/manage-profile', true, true),
      ('screen', '/manage-members', true, false),
      ('screen', '/pastoral', true, true),
      ('screen', '/pastoral-history', true, false),
      ('screen', '/financial', true, false),
      ('screen', '/expense-report', true, false),
      ('screen', '/lgpd', true, true),
      ('screen', 'dashboard.card.event_alt', true, false),
      ('screen', 'dashboard.card.qr', true, false),
      ('screen', 'dashboard.card.kids_teens', true, false),
      ('screen', 'dashboard.card.offerings', true, false),
      ('screen', 'dashboard.card.pastoral', true, false),
      ('screen', 'dashboard.card.members_list', true, false),
      ('screen', 'dashboard.card.birthdays', true, false),
      ('screen', 'dashboard.card.financial', true, false),
      ('screen', 'dashboard.card.vigilance_scales', true, false),
      ('screen', 'dashboard.card.parking_vehicle_v2', true, false),
      ('screen', 'dashboard.card.grouped_manage', true, false),
      ('table', 'profiles', true, true),
      ('table', 'members', true, false),
      ('table', 'pastoral_requests', true, true),
      ('column', 'profiles.full_name', true, true),
      ('column', 'profiles.phone', true, true),
      ('column', 'profiles.birth_date', true, true),
      ('column', 'profiles.email', true, true),
      ('column', 'profiles.cep', true, true),
      ('column', 'profiles.address_street', true, true),
      ('column', 'profiles.address_number', true, true),
      ('column', 'profiles.address_complement', true, true),
      ('column', 'profiles.address_neighborhood', true, true),
      ('column', 'profiles.address_city', true, true),
      ('column', 'profiles.address_state', true, true),
      ('column', 'profiles.cpf', true, true),
      ('column', 'profiles.medical_food_alerts', true, true)
  ) as g(resource_type, resource_key, can_view, can_update)
  join public.access_resources res
    on res.resource_type = g.resource_type
   and res.resource_key = g.resource_key
 where r.code = 'member'
on conflict (role_id, resource_id) where (role_id is not null) do update
  set can_view = excluded.can_view,
      can_update = excluded.can_update,
      updated_at = now();

-- congregado: acesso básico (sem gerenciar família / financeiro / lista de membros)
insert into public.access_grants (role_id, resource_id, can_view, can_update)
select r.id, res.id, g.can_view, g.can_update
  from public.access_roles r
 cross join (
    values
      ('screen', '/dashboard', true, false),
      ('screen', '/manage-profile', true, true),
      ('screen', '/pastoral', true, true),
      ('screen', '/pastoral-history', true, false),
      ('screen', '/lgpd', true, true),
      ('screen', 'dashboard.card.event_alt', true, false),
      ('screen', 'dashboard.card.qr', true, false),
      ('screen', 'dashboard.card.kids_teens', true, false),
      ('screen', 'dashboard.card.offerings', true, false),
      ('screen', 'dashboard.card.pastoral', true, false),
      ('screen', 'dashboard.card.birthdays', true, false),
      ('screen', 'dashboard.card.grouped_manage', true, false),
      ('table', 'profiles', true, true),
      ('table', 'pastoral_requests', true, true),
      ('column', 'profiles.full_name', true, true),
      ('column', 'profiles.phone', true, true),
      ('column', 'profiles.birth_date', true, true),
      ('column', 'profiles.email', true, true),
      ('column', 'profiles.cep', true, true),
      ('column', 'profiles.address_street', true, true),
      ('column', 'profiles.address_number', true, true),
      ('column', 'profiles.address_complement', true, true),
      ('column', 'profiles.address_neighborhood', true, true),
      ('column', 'profiles.address_city', true, true),
      ('column', 'profiles.address_state', true, true)
  ) as g(resource_type, resource_key, can_view, can_update)
  join public.access_resources res
    on res.resource_type = g.resource_type
   and res.resource_key = g.resource_key
 where r.code = 'congregado'
on conflict (role_id, resource_id) where (role_id is not null) do update
  set can_view = excluded.can_view,
      can_update = excluded.can_update,
      updated_at = now();

-- visitantes: acesso público mínimo (sem perfil na sessão ou perfil sem papéis)
insert into public.access_grants (role_id, resource_id, can_view, can_update)
select r.id, res.id, g.can_view, g.can_update
  from public.access_roles r
 cross join (
    values
      ('screen', '/', true, false),
      ('screen', '/register', true, true),
      ('screen', '/lgpd', true, true),
      ('screen', 'dashboard.card.qr', true, false),
      ('screen', 'dashboard.card.event_alt', true, false),
      ('table', 'events', true, false),
      ('table', 'event_registrations', true, true),
      ('table', 'app_parameters', true, false),
      ('table', 'pastoral_reason_categories', true, false),
      ('table', 'pastoral_reason_subcategories', true, false)
  ) as g(resource_type, resource_key, can_view, can_update)
  join public.access_resources res
    on res.resource_type = g.resource_type
   and res.resource_key = g.resource_key
 where r.code = 'visitantes'
on conflict (role_id, resource_id) where (role_id is not null) do update
  set can_view = excluded.can_view,
      can_update = excluded.can_update,
      updated_at = now();

-- super_admin: view+update em tudo (curingas)
insert into public.access_grants (role_id, resource_id, can_view, can_update)
select r.id, res.id, true, true
  from public.access_roles r
 cross join public.access_resources res
 where r.code = 'super_admin'
   and res.resource_key = '*'
on conflict (role_id, resource_id) where (role_id is not null) do update
  set can_view = true,
      can_update = true,
      updated_at = now();

-- events_admin
insert into public.access_grants (role_id, resource_id, can_view, can_update)
select r.id, res.id, true, true
  from public.access_roles r
 cross join public.access_resources res
 where r.code = 'events_admin'
   and (
     (res.resource_type = 'screen' and res.resource_key in ('/maintenance-dashboard', '/dashboard', 'dashboard.card.kids_teens'))
     or (res.resource_type = 'table' and res.resource_key in ('events', 'event_registrations'))
   )
on conflict (role_id, resource_id) where (role_id is not null) do update
  set can_view = true,
      can_update = true,
      updated_at = now();

-- ---------------------------------------------------------------------------
-- RLS: leitura/escrita só via service role ou RPC por enquanto
-- ---------------------------------------------------------------------------

alter table public.access_resources enable row level security;
alter table public.access_roles enable row level security;
alter table public.profile_access_roles enable row level security;
alter table public.access_grants enable row level security;

drop policy if exists access_resources_service on public.access_resources;
create policy access_resources_service on public.access_resources
  for all to service_role using (true) with check (true);

drop policy if exists access_roles_service on public.access_roles;
create policy access_roles_service on public.access_roles
  for all to service_role using (true) with check (true);

drop policy if exists profile_access_roles_service on public.profile_access_roles;
create policy profile_access_roles_service on public.profile_access_roles
  for all to service_role using (true) with check (true);

drop policy if exists access_grants_service on public.access_grants;
create policy access_grants_service on public.access_grants
  for all to service_role using (true) with check (true);

-- Funções de checagem para o app (anon) — leitura de metadados de permissão
grant execute on function public.role_has_access(text, text, text, text) to anon, authenticated;
grant execute on function public.profile_has_access(uuid, text, text, text) to anon, authenticated;
grant execute on function public.profile_has_access_by_phone(text, text, text, text) to anon, authenticated;

-- Opcional: após validar, revogar SELECT direto nas tabelas ACL para anon
-- revoke all on public.access_grants from anon;

comment on table public.access_grants is
  'Relacionamento de acesso: perfil OU papel → recurso (tela/tabela/coluna) com can_view e can_update.';
