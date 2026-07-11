-- =============================================================================
-- Multi-tenancy 24 — corrige list_session_igrejas + list_admin_igrejas
-- =============================================================================
-- Sintoma: tela Instâncias → "Não foi possível listar as igrejas."
-- Causa: conflito de nomes OUT (id, is_active, …) no RETURN QUERY (PL/pgSQL).
--
-- Execute no SQL Editor do Supabase (substitui/complementa o 23).
-- =============================================================================

begin;

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
-- list_admin_igrejas (ativas + bloqueadas, só super_admin)
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

notify pgrst, 'reload schema';

commit;
