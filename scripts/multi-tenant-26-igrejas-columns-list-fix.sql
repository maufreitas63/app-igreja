-- =============================================================================
-- Multi-tenancy 26 — garante colunas de igrejas + recria listagens
-- =============================================================================
-- Erro: column i.website_url does not exist
-- (ou logo_url / instagram_url / youtube_url / cnpj / pix_*)
--
-- Causa: scripts 24/22 referenciam colunas que ainda não existem neste banco.
-- Execute este arquivo no SQL Editor do Supabase.
-- =============================================================================

begin;

alter table public.igrejas
  add column if not exists logo_url text,
  add column if not exists website_url text,
  add column if not exists instagram_url text,
  add column if not exists youtube_url text,
  add column if not exists cnpj text,
  add column if not exists pix_institution text,
  add column if not exists pix_key text;

comment on column public.igrejas.website_url is
  'URL do site oficial da instância (menu Redes Sociais / cadastro).';

-- ---------------------------------------------------------------------------
-- list_session_igrejas
-- ---------------------------------------------------------------------------
drop function if exists public.list_session_igrejas();

create function public.list_session_igrejas()
returns table (
  id uuid,
  code text,
  name text,
  logo_url text,
  website_url text,
  instagram_url text,
  youtube_url text,
  cnpj text,
  pix_institution text,
  pix_key text,
  is_active boolean,
  is_primary boolean,
  is_linked boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_profile_id uuid := public.current_session_profile_id();
  v_is_super boolean := false;
begin
  if v_profile_id is null then
    return;
  end if;

  v_is_super := public.profile_has_super_admin_role(v_profile_id);

  if v_is_super then
    return query
    select
      q.id,
      q.code,
      q.name,
      q.logo_url,
      q.website_url,
      q.instagram_url,
      q.youtube_url,
      q.cnpj,
      q.pix_institution,
      q.pix_key,
      q.is_active,
      q.is_primary,
      q.is_linked
    from (
      select
        i.id,
        i.code,
        i.name,
        nullif(trim(i.logo_url), '') as logo_url,
        nullif(trim(i.website_url), '') as website_url,
        nullif(trim(i.instagram_url), '') as instagram_url,
        nullif(trim(i.youtube_url), '') as youtube_url,
        nullif(trim(i.cnpj), '') as cnpj,
        nullif(trim(i.pix_institution), '') as pix_institution,
        nullif(trim(i.pix_key), '') as pix_key,
        i.is_active,
        coalesce(v.is_primary, false) as is_primary,
        (v.id is not null) as is_linked
      from public.igrejas i
      left join public.profile_igreja_vinculos v
        on v.tenant_id = i.id
       and v.profile_id = v_profile_id
       and v.is_active = true
      where i.is_active = true
    ) q
    order by q.is_primary desc, q.name asc;
    return;
  end if;

  return query
  select
    q.id,
    q.code,
    q.name,
    q.logo_url,
    q.website_url,
    q.instagram_url,
    q.youtube_url,
    q.cnpj,
    q.pix_institution,
    q.pix_key,
    q.is_active,
    q.is_primary,
    q.is_linked
  from (
    select
      i.id,
      i.code,
      i.name,
      nullif(trim(i.logo_url), '') as logo_url,
      nullif(trim(i.website_url), '') as website_url,
      nullif(trim(i.instagram_url), '') as instagram_url,
      nullif(trim(i.youtube_url), '') as youtube_url,
      nullif(trim(i.cnpj), '') as cnpj,
      nullif(trim(i.pix_institution), '') as pix_institution,
      nullif(trim(i.pix_key), '') as pix_key,
      i.is_active,
      v.is_primary,
      true as is_linked
    from public.profile_igreja_vinculos v
    join public.igrejas i on i.id = v.tenant_id
    where v.profile_id = v_profile_id
      and v.is_active = true
      and i.is_active = true
  ) q
  order by q.is_primary desc, q.name asc;
end;
$$;

grant execute on function public.list_session_igrejas() to anon, authenticated;

-- ---------------------------------------------------------------------------
-- list_admin_igrejas
-- ---------------------------------------------------------------------------
drop function if exists public.list_admin_igrejas();

create function public.list_admin_igrejas()
returns table (
  id uuid,
  code text,
  name text,
  logo_url text,
  website_url text,
  instagram_url text,
  youtube_url text,
  cnpj text,
  pix_institution text,
  pix_key text,
  is_active boolean,
  is_primary boolean,
  is_linked boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_profile_id uuid := public.current_session_profile_id();
begin
  if v_profile_id is null then
    return;
  end if;

  if not public.profile_has_super_admin_role(v_profile_id) then
    return;
  end if;

  return query
  select
    q.id,
    q.code,
    q.name,
    q.logo_url,
    q.website_url,
    q.instagram_url,
    q.youtube_url,
    q.cnpj,
    q.pix_institution,
    q.pix_key,
    q.is_active,
    q.is_primary,
    q.is_linked
  from (
    select
      i.id,
      i.code,
      i.name,
      nullif(trim(i.logo_url), '') as logo_url,
      nullif(trim(i.website_url), '') as website_url,
      nullif(trim(i.instagram_url), '') as instagram_url,
      nullif(trim(i.youtube_url), '') as youtube_url,
      nullif(trim(i.cnpj), '') as cnpj,
      nullif(trim(i.pix_institution), '') as pix_institution,
      nullif(trim(i.pix_key), '') as pix_key,
      i.is_active,
      coalesce(v.is_primary, false) as is_primary,
      (v.id is not null) as is_linked
    from public.igrejas i
    left join public.profile_igreja_vinculos v
      on v.tenant_id = i.id
     and v.profile_id = v_profile_id
     and v.is_active = true
  ) q
  order by q.is_active desc, q.is_primary desc, q.name asc;
end;
$$;

grant execute on function public.list_admin_igrejas() to anon, authenticated;

-- Ofertas (se ainda não existir)
create or replace function public.get_session_offerings_recipient(p_tenant_id uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_profile_id uuid := public.current_session_profile_id();
  v_tenant uuid;
  v_row record;
begin
  if v_profile_id is null then
    return jsonb_build_object('success', false, 'message', 'Sessão inválida.');
  end if;

  v_tenant := coalesce(
    p_tenant_id,
    public.current_session_tenant_id(),
    public.resolve_default_tenant_id()
  );

  if v_tenant is null then
    return jsonb_build_object('success', false, 'message', 'Igreja ativa não encontrada.');
  end if;

  if not public.profile_can_use_tenant(v_profile_id, v_tenant) then
    return jsonb_build_object('success', false, 'message', 'Sem acesso a esta igreja.');
  end if;

  select
    i.id,
    i.code,
    i.name,
    nullif(trim(i.cnpj), '') as cnpj,
    nullif(trim(i.pix_institution), '') as pix_institution,
    nullif(trim(i.pix_key), '') as pix_key
  into v_row
  from public.igrejas i
  where i.id = v_tenant
    and i.is_active = true;

  if v_row.id is null then
    return jsonb_build_object('success', false, 'message', 'Igreja não encontrada ou inativa.');
  end if;

  return jsonb_build_object(
    'success', true,
    'id', v_row.id,
    'code', v_row.code,
    'name', v_row.name,
    'cnpj', v_row.cnpj,
    'pix_institution', v_row.pix_institution,
    'pix_key', v_row.pix_key
  );
end;
$$;

grant execute on function public.get_session_offerings_recipient(uuid)
  to anon, authenticated;

notify pgrst, 'reload schema';

commit;
