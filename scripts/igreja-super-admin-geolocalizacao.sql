-- =============================================================================
-- Geolocalização do Superadministrador no mapa (por instância)
-- =============================================================================
-- O pin do Superadministrador com CEP fora da cidade da instância desloca o
-- centro do mapa (média das coordenadas). Cada igreja pode ligar/desligar
-- esse pin. Padrão: ligado (comportamento atual).
-- =============================================================================

begin;

alter table public.igrejas
  add column if not exists super_admin_geolocalizacao boolean not null default true;

comment on column public.igrejas.super_admin_geolocalizacao is
  'Quando false, o pin do Superadministrador não entra no mapa desta instância.';

-- ---------------------------------------------------------------------------
-- list_admin_igrejas — preserva PIX em bank_accounts + igreja mãe
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
  pix_key_secundaria text,
  pix_institution_secundaria text,
  is_active boolean,
  is_primary boolean,
  is_linked boolean,
  mae_tenant_id uuid,
  mae_code text,
  mae_name text,
  super_admin_geolocalizacao boolean
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
  if v_profile_id is null or not public.profile_has_super_admin_role(v_profile_id) then
    return;
  end if;

  return query
  select
    i.id,
    i.code,
    i.name,
    nullif(trim(i.logo_url), ''),
    nullif(trim(i.website_url), ''),
    nullif(trim(i.instagram_url), ''),
    nullif(trim(i.youtube_url), ''),
    nullif(trim(i.cnpj), ''),
    b1.institution,
    b1.pix_key,
    b2.pix_key,
    b2.institution,
    i.is_active,
    coalesce(v.is_primary, false),
    (v.id is not null),
    i.mae_tenant_id,
    mae.code,
    mae.name,
    coalesce(i.super_admin_geolocalizacao, true)
  from public.igrejas i
  left join public.igrejas mae on mae.id = i.mae_tenant_id
  left join public.profile_igreja_vinculos v
    on v.tenant_id = i.id
   and v.profile_id = v_profile_id
   and v.is_active = true
  left join lateral (
    select
      nullif(trim(b.institution), '') as institution,
      nullif(trim(b.pix_key), '') as pix_key
      from public.bank_accounts b
     where b.tenant_id = i.id
     order by b.sort_order, b.created_at
     limit 1
  ) b1 on true
  left join lateral (
    select
      nullif(trim(b.institution), '') as institution,
      nullif(trim(b.pix_key), '') as pix_key
      from public.bank_accounts b
     where b.tenant_id = i.id
     order by b.sort_order, b.created_at
     offset 1
     limit 1
  ) b2 on true
  order by i.is_active desc, coalesce(v.is_primary, false) desc, i.name asc;
end;
$$;

grant execute on function public.list_admin_igrejas() to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Setter (somente Superadministrador)
-- ---------------------------------------------------------------------------
create or replace function public.set_igreja_super_admin_geolocalizacao_admin(
  p_tenant_id uuid,
  p_enabled boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_actor uuid := public.current_session_profile_id();
  v_enabled boolean := coalesce(p_enabled, true);
begin
  if v_actor is null then
    return jsonb_build_object('success', false, 'message', 'Sessão inválida.');
  end if;

  if not public.profile_has_super_admin_role(v_actor) then
    return jsonb_build_object('success', false, 'message', 'Apenas super administradores.');
  end if;

  if p_tenant_id is null then
    return jsonb_build_object('success', false, 'message', 'Igreja não informada.');
  end if;

  if not exists (select 1 from public.igrejas i where i.id = p_tenant_id) then
    return jsonb_build_object('success', false, 'message', 'Igreja não encontrada.');
  end if;

  update public.igrejas
     set super_admin_geolocalizacao = v_enabled,
         updated_at = now()
   where id = p_tenant_id;

  return jsonb_build_object(
    'success', true,
    'tenant_id', p_tenant_id,
    'super_admin_geolocalizacao', v_enabled,
    'message', case
      when v_enabled then 'Pin do Superadministrador visível no mapa.'
      else 'Pin do Superadministrador oculto no mapa desta instância.'
    end
  );
end;
$$;

grant execute on function public.set_igreja_super_admin_geolocalizacao_admin(uuid, boolean)
  to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Leitura para o mapa (sessão da instância ativa)
-- ---------------------------------------------------------------------------
create or replace function public.session_map_geolocalizacao_settings()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.current_session_tenant_id();
  v_show boolean := true;
begin
  if v_tenant is null then
    return jsonb_build_object(
      'show_super_admin', true,
      'super_admin_ids', '[]'::jsonb
    );
  end if;

  select coalesce(i.super_admin_geolocalizacao, true)
    into v_show
    from public.igrejas i
   where i.id = v_tenant;

  return jsonb_build_object(
    'show_super_admin', coalesce(v_show, true),
    'super_admin_ids', coalesce((
      select jsonb_agg(p.id)
        from public.profiles p
       where public.profile_has_super_admin_role(p.id)
    ), '[]'::jsonb)
  );
end;
$$;

grant execute on function public.session_map_geolocalizacao_settings()
  to anon, authenticated;

-- Invalida o cache do mapa quando o interruptor muda.
create or replace function public.fetch_profiles_acl_sync_fingerprint()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select
    count(*)::text
    || '|'
    || coalesce(max(par.granted_at)::text, 'none')
    || '|saGeo:'
    || coalesce((
         select case when i.super_admin_geolocalizacao then '1' else '0' end
           from public.igrejas i
          where i.id = public.current_session_tenant_id()
         limit 1
       ), '1')
    from public.profile_access_roles par;
$$;

grant execute on function public.fetch_profiles_acl_sync_fingerprint()
  to anon, authenticated;

notify pgrst, 'reload schema';

commit;
