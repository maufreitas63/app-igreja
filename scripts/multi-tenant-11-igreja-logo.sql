-- =============================================================================
-- Multi-tenancy — logo da igreja (chrome / identidade da instância)
-- =============================================================================
-- Execute no SQL Editor do Supabase após multi-tenant-09.
--
-- logo_url: URL pública (Storage ou CDN) da marca da igreja.
-- Se NULL, o app usa fallback local (IBN → logo IBNORTE; demais → nome da igreja).
-- =============================================================================

alter table public.igrejas
  add column if not exists logo_url text;

comment on column public.igrejas.logo_url is
  'URL pública do logo da instância (chrome do app). NULL = fallback no cliente.';

drop function if exists public.list_session_igrejas();

create or replace function public.list_session_igrejas()
returns table (
  id uuid,
  code text,
  name text,
  logo_url text,
  is_primary boolean,
  is_linked boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
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
      i.id,
      i.code,
      i.name,
      nullif(trim(i.logo_url), '') as logo_url,
      coalesce(v.is_primary, false) as is_primary,
      (v.id is not null) as is_linked
    from public.igrejas i
    left join public.profile_igreja_vinculos v
      on v.tenant_id = i.id
     and v.profile_id = v_profile_id
     and v.is_active = true
    where i.is_active = true
    order by coalesce(v.is_primary, false) desc, i.name asc;
    return;
  end if;

  return query
  select
    i.id,
    i.code,
    i.name,
    nullif(trim(i.logo_url), '') as logo_url,
    v.is_primary,
    true as is_linked
  from public.profile_igreja_vinculos v
  join public.igrejas i on i.id = v.tenant_id
  where v.profile_id = v_profile_id
    and v.is_active = true
    and i.is_active = true
  order by v.is_primary desc, i.name asc;
end;
$$;

grant execute on function public.list_session_igrejas() to anon, authenticated;

-- Exemplo (opcional): apontar logo da IBN para um arquivo no Storage
-- update public.igrejas
-- set logo_url = 'https://SEU_PROJETO.supabase.co/storage/v1/object/public/branding/ibn-logo.png'
-- where upper(trim(code)) = 'IBN';
