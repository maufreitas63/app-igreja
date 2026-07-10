-- =============================================================================
-- Multi-tenancy — Passo 1/3: schema de igrejas, vínculos e helpers de sessão
-- =============================================================================
-- Pré-requisitos:
--   - access-control-table-rls.sql (current_session_profile_id)
--   - profile-sessions*.sql (sessão assinada via x-session-token)
--
-- Modelo deste app (IMPORTANTE):
--   Identidade = profiles.id (PIN + telefone), NÃO auth.uid() isolado.
--   Sessão chega por headers x-session-token / x-profile-id.
--   Isolamento de igreja = tenant_id + vínculo em profile_igreja_vinculos.
--
-- Execute no SQL Editor do Supabase. Depois: multi-tenant-02-columns.sql
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Tabela de igrejas (tenants)
-- ---------------------------------------------------------------------------

create table if not exists public.igrejas (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint igrejas_code_unique unique (code),
  constraint igrejas_code_nonempty check (length(trim(code)) > 0),
  constraint igrejas_name_nonempty check (length(trim(name)) > 0)
);

create index if not exists igrejas_is_active_idx
  on public.igrejas (is_active)
  where is_active = true;

comment on table public.igrejas is
  'Tenant / igreja. Isolamento multi-tenant via tenant_id nas tabelas de dados.';

-- Seed da igreja atual (IBN) — idempotente
insert into public.igrejas (id, code, name)
select
  'a0000000-0000-4000-8000-000000000001'::uuid,
  'IBN',
  'Igreja Batista Norte'
where not exists (
  select 1 from public.igrejas where upper(trim(code)) = 'IBN'
);

-- ---------------------------------------------------------------------------
-- 2. Vínculo perfil ↔ igreja (usuário logado → tenant)
-- ---------------------------------------------------------------------------

create table if not exists public.profile_igreja_vinculos (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  tenant_id uuid not null references public.igrejas (id) on delete restrict,
  is_primary boolean not null default true,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profile_igreja_vinculos_profile_tenant_unique unique (profile_id, tenant_id)
);

create index if not exists profile_igreja_vinculos_profile_active_idx
  on public.profile_igreja_vinculos (profile_id)
  where is_active = true;

create index if not exists profile_igreja_vinculos_tenant_idx
  on public.profile_igreja_vinculos (tenant_id)
  where is_active = true;

comment on table public.profile_igreja_vinculos is
  'Associa profiles.id à igreja (tenant). Fonte de verdade para current_session_tenant_id().';

-- Garante no máximo um vínculo primary ativo por perfil
create unique index if not exists profile_igreja_vinculos_one_primary_idx
  on public.profile_igreja_vinculos (profile_id)
  where is_primary = true and is_active = true;

-- ---------------------------------------------------------------------------
-- 3. Helpers de tenant (sessão do app + fallback auth.uid)
-- ---------------------------------------------------------------------------

create or replace function public.resolve_default_tenant_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select i.id
    from public.igrejas i
   where upper(trim(i.code)) = 'IBN'
     and i.is_active = true
   order by i.created_at
   limit 1;
$$;

create or replace function public.profile_primary_tenant_id(p_profile_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select v.tenant_id
    from public.profile_igreja_vinculos v
   where v.profile_id = p_profile_id
     and v.is_active = true
   order by v.is_primary desc, v.created_at
   limit 1;
$$;

-- Tenant da sessão atual.
-- Ordem: vínculo do profile da sessão → vínculo via auth.uid() → null.
create or replace function public.current_session_tenant_id()
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_profile_id uuid;
  v_tenant_id uuid;
  v_auth_uid uuid;
begin
  v_profile_id := public.current_session_profile_id();

  if v_profile_id is not null then
    v_tenant_id := public.profile_primary_tenant_id(v_profile_id);
    if v_tenant_id is not null then
      return v_tenant_id;
    end if;
  end if;

  begin
    v_auth_uid := auth.uid();
  exception
    when others then
      v_auth_uid := null;
  end;

  if v_auth_uid is not null then
    select public.profile_primary_tenant_id(p.id)
      into v_tenant_id
      from public.profiles p
     where p.auth_user_id = v_auth_uid
     limit 1;

    if v_tenant_id is not null then
      return v_tenant_id;
    end if;
  end if;

  return null;
end;
$$;

-- Predicado obrigatório para policies (USING / WITH CHECK)
create or replace function public.session_tenant_matches(p_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    p_tenant_id is not null
    and public.current_session_tenant_id() is not null
    and p_tenant_id = public.current_session_tenant_id();
$$;

comment on function public.session_tenant_matches(uuid) is
  'True somente se p_tenant_id = tenant da sessão. Usar em USING e WITH CHECK.';

-- Perfil tem vínculo ativo com o tenant?
create or replace function public.profile_belongs_to_tenant(
  p_profile_id uuid,
  p_tenant_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.profile_igreja_vinculos v
     where v.profile_id = p_profile_id
       and v.tenant_id = p_tenant_id
       and v.is_active = true
  );
$$;

-- ---------------------------------------------------------------------------
-- 4. Trigger: preenche tenant_id automaticamente no INSERT
--    (app não precisa enviar tenant_id em cada query)
-- ---------------------------------------------------------------------------

create or replace function public.tg_set_tenant_id_from_session()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid;
begin
  if new.tenant_id is null then
    v_tenant := public.current_session_tenant_id();
    if v_tenant is null then
      v_tenant := public.resolve_default_tenant_id();
    end if;
    if v_tenant is null then
      raise exception 'tenant_id obrigatório: sessão sem igreja vinculada e sem tenant padrão.';
    end if;
    new.tenant_id := v_tenant;
  end if;

  -- Impede gravar em outra igreja mesmo se o cliente enviar tenant_id estranho
  if public.current_session_tenant_id() is not null
     and new.tenant_id is distinct from public.current_session_tenant_id() then
    raise exception 'tenant_id (%) diverge do tenant da sessão (%)',
      new.tenant_id, public.current_session_tenant_id();
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. RLS nas tabelas de catálogo multi-tenant
-- ---------------------------------------------------------------------------

alter table public.igrejas enable row level security;
alter table public.profile_igreja_vinculos enable row level security;

drop policy if exists igrejas_select_own_tenant on public.igrejas;
create policy igrejas_select_own_tenant
  on public.igrejas
  for select
  to anon, authenticated
  using (
    id = public.current_session_tenant_id()
    or public.session_has_resource_access('table', '*', 'view')
  );

drop policy if exists igrejas_write_admin on public.igrejas;
create policy igrejas_write_admin
  on public.igrejas
  for all
  to anon, authenticated
  using (
    public.session_has_resource_access('table', '*', 'update')
  )
  with check (
    public.session_has_resource_access('table', '*', 'update')
  );

drop policy if exists profile_igreja_vinculos_select on public.profile_igreja_vinculos;
create policy profile_igreja_vinculos_select
  on public.profile_igreja_vinculos
  for select
  to anon, authenticated
  using (
    public.session_tenant_matches(tenant_id)
    or profile_id = public.current_session_profile_id()
  );

drop policy if exists profile_igreja_vinculos_write_admin on public.profile_igreja_vinculos;
create policy profile_igreja_vinculos_write_admin
  on public.profile_igreja_vinculos
  for all
  to anon, authenticated
  using (
    public.session_has_resource_access('table', '*', 'update')
  )
  with check (
    public.session_has_resource_access('table', '*', 'update')
  );

grant select on public.igrejas to anon, authenticated;
grant select on public.profile_igreja_vinculos to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 6. Backfill de vínculos: todos os profiles → IBN (migração single → multi)
-- ---------------------------------------------------------------------------

insert into public.profile_igreja_vinculos (profile_id, tenant_id, is_primary, is_active)
select
  p.id,
  coalesce(
    (select i.id from public.igrejas i where upper(trim(i.code)) = 'IBN' limit 1),
    public.resolve_default_tenant_id()
  ),
  true,
  true
from public.profiles p
where not exists (
  select 1
    from public.profile_igreja_vinculos v
   where v.profile_id = p.id
)
  and public.resolve_default_tenant_id() is not null;

-- ---------------------------------------------------------------------------
-- Grants das funções
-- ---------------------------------------------------------------------------

grant execute on function public.resolve_default_tenant_id() to anon, authenticated;
grant execute on function public.profile_primary_tenant_id(uuid) to anon, authenticated;
grant execute on function public.current_session_tenant_id() to anon, authenticated;
grant execute on function public.session_tenant_matches(uuid) to anon, authenticated;
grant execute on function public.profile_belongs_to_tenant(uuid, uuid) to anon, authenticated;

notify pgrst, 'reload schema';
