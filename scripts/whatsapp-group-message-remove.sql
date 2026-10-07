-- =============================================================================
-- Remove o grupo de WhatsApp da instância e o envio pelo menu
-- =============================================================================
-- Aplica: npx supabase db query --linked -f scripts/whatsapp-group-message-remove.sql
-- =============================================================================

begin;

drop function if exists public.get_session_whatsapp_group();
drop function if exists public.set_igreja_whatsapp_group_admin(uuid, text);

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
  super_admin_geolocalizacao boolean,
  cel_totem text,
  senha_totem text
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
    coalesce(i.super_admin_geolocalizacao, true),
    public.canonical_br_phone_digits(i.cel_totem),
    nullif(trim(i.senha_totem), '')
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

alter table public.igrejas
  drop column if exists whatsapp_group_id;

delete from public.access_grants g
 using public.access_resources res
 where g.resource_id = res.id
   and res.resource_type = 'screen'
   and res.resource_key = 'maintenance.card.whatsapp_group';

delete from public.access_resources
 where resource_type = 'screen'
   and resource_key = 'maintenance.card.whatsapp_group';

notify pgrst, 'reload schema';

commit;
