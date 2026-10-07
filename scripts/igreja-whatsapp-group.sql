-- =============================================================================
-- Identificação do grupo de WhatsApp por instância (envio de mensagens)
-- =============================================================================
-- Aplica: npx supabase db query --linked -f scripts/igreja-whatsapp-group.sql
-- =============================================================================

begin;

alter table public.igrejas
  add column if not exists whatsapp_group_id text;

comment on column public.igrejas.whatsapp_group_id is
  'Identificação do grupo de WhatsApp desta igreja, usada no envio de mensagens.';

-- ---------------------------------------------------------------------------
-- list_admin_igrejas — inclui o grupo de WhatsApp
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
  super_admin_geolocalizacao boolean,
  cel_totem text,
  senha_totem text,
  whatsapp_group_id text
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
    nullif(trim(i.senha_totem), ''),
    nullif(trim(i.whatsapp_group_id), '')
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
-- Grava só a identificação do grupo (não altera site, Instagram ou YouTube)
-- ---------------------------------------------------------------------------
create or replace function public.set_igreja_whatsapp_group_admin(
  p_tenant_id uuid,
  p_whatsapp_group_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := public.current_session_profile_id();
  v_group text := nullif(trim(coalesce(p_whatsapp_group_id, '')), '');
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

  if v_group is not null and char_length(v_group) > 200 then
    return jsonb_build_object(
      'success', false,
      'message', 'A identificação do grupo de WhatsApp pode ter no máximo 200 caracteres.'
    );
  end if;

  if v_group is not null and v_group ~ '[[:cntrl:]]' then
    return jsonb_build_object(
      'success', false,
      'message', 'A identificação do grupo de WhatsApp não pode conter quebras de linha.'
    );
  end if;

  if not exists (select 1 from public.igrejas i where i.id = p_tenant_id) then
    return jsonb_build_object('success', false, 'message', 'Igreja não encontrada.');
  end if;

  update public.igrejas
     set whatsapp_group_id = v_group,
         updated_at = now()
   where id = p_tenant_id;

  return jsonb_build_object(
    'success', true,
    'tenant_id', p_tenant_id,
    'whatsapp_group_id', v_group,
    'message', 'Grupo de WhatsApp atualizado.'
  );
end;
$$;

grant execute on function public.set_igreja_whatsapp_group_admin(uuid, text)
  to authenticated;

notify pgrst, 'reload schema';

commit;
