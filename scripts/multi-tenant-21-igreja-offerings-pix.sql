-- =============================================================================
-- Multi-tenancy 21 — dados de Dízimos/Ofertas por instância (igrejas)
-- =============================================================================
-- Problema: tela Dízimos e Ofertas usava CNPJ/instituição hardcoded da IBN e
-- chave_pix global (ou da IBN), sem respeitar a igreja ativa.
--
-- Solução: colunas em igrejas + list_session_igrejas + RPC de update.
-- Execute no SQL Editor do Supabase.
-- =============================================================================

begin;

alter table public.igrejas
  add column if not exists cnpj text,
  add column if not exists pix_institution text,
  add column if not exists pix_key text;

comment on column public.igrejas.cnpj is
  'CNPJ do recebedor (tela Dízimos e Ofertas), por instância.';
comment on column public.igrejas.pix_institution is
  'Instituição bancária do PIX (tela Dízimos e Ofertas), por instância.';
comment on column public.igrejas.pix_key is
  'Chave PIX da igreja (tela Dízimos e Ofertas), por instância.';

-- Seed IBN com os valores que estavam hardcoded no app
update public.igrejas i
   set cnpj = coalesce(nullif(trim(i.cnpj), ''), '58.186.489/0001-18'),
       pix_institution = coalesce(
         nullif(trim(i.pix_institution), ''),
         'COOP SICREDI VANGUARDA PR/SP/RJ'
       ),
       updated_at = now()
 where upper(trim(i.code)) = 'IBN';

-- Migrar chave_pix de app_parameters (tenant IBN) se igrejas.pix_key ainda vazio
update public.igrejas i
   set pix_key = ap.value,
       updated_at = now()
  from public.app_parameters ap
 where upper(trim(i.code)) = 'IBN'
   and nullif(trim(i.pix_key), '') is null
   and ap.tenant_id = i.id
   and lower(trim(ap.parameter)) = 'chave_pix'
   and nullif(trim(ap.value), '') is not null;

-- Fallback: se app_parameters.chave_pix ainda for global (sem tenant), usa na IBN
update public.igrejas i
   set pix_key = ap.value,
       updated_at = now()
  from public.app_parameters ap
 where upper(trim(i.code)) = 'IBN'
   and nullif(trim(i.pix_key), '') is null
   and lower(trim(ap.parameter)) = 'chave_pix'
   and nullif(trim(ap.value), '') is not null
   and ap.ctid = (
     select ap2.ctid
       from public.app_parameters ap2
      where lower(trim(ap2.parameter)) = 'chave_pix'
        and nullif(trim(ap2.value), '') is not null
      order by
        case when ap2.tenant_id = i.id then 0 else 1 end,
        ap2.parameter
      limit 1
   );

-- get_app_parameter_value tenant-aware (reforço; wave2c)
create or replace function public.get_app_parameter_value(p_parameter text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid := coalesce(public.current_session_tenant_id(), public.resolve_default_tenant_id());
  v_value text;
begin
  select ap.value
    into v_value
    from public.app_parameters ap
   where ap.tenant_id = v_tenant
     and lower(trim(ap.parameter)) = lower(trim(p_parameter))
   order by
     case when ap.parameter = trim(p_parameter) then 0 else 1 end,
     ap.parameter
   limit 1;

  return v_value;
end;
$$;

grant execute on function public.get_app_parameter_value(text) to anon, authenticated;

drop function if exists public.list_session_igrejas();

create or replace function public.list_session_igrejas()
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
      nullif(trim(i.website_url), '') as website_url,
      nullif(trim(i.instagram_url), '') as instagram_url,
      nullif(trim(i.youtube_url), '') as youtube_url,
      nullif(trim(i.cnpj), '') as cnpj,
      nullif(trim(i.pix_institution), '') as pix_institution,
      nullif(trim(i.pix_key), '') as pix_key,
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
    nullif(trim(i.website_url), '') as website_url,
    nullif(trim(i.instagram_url), '') as instagram_url,
    nullif(trim(i.youtube_url), '') as youtube_url,
    nullif(trim(i.cnpj), '') as cnpj,
    nullif(trim(i.pix_institution), '') as pix_institution,
    nullif(trim(i.pix_key), '') as pix_key,
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

create or replace function public.set_igreja_offerings_admin(
  p_tenant_id uuid,
  p_cnpj text,
  p_pix_institution text,
  p_pix_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := public.current_session_profile_id();
  v_cnpj text := nullif(trim(coalesce(p_cnpj, '')), '');
  v_inst text := nullif(trim(coalesce(p_pix_institution, '')), '');
  v_pix text := nullif(trim(coalesce(p_pix_key, '')), '');
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
     set cnpj = v_cnpj,
         pix_institution = v_inst,
         pix_key = v_pix,
         updated_at = now()
   where id = p_tenant_id;

  if v_pix is not null then
    perform set_config('app.bypass_tenant_guard', 'on', true);

    update public.app_parameters
       set value = v_pix
     where tenant_id = p_tenant_id
       and lower(trim(parameter)) = 'chave_pix';

    if not found then
      insert into public.app_parameters (parameter, value, tenant_id)
      values ('chave_pix', v_pix, p_tenant_id);
    end if;
  end if;

  return jsonb_build_object(
    'success', true,
    'tenant_id', p_tenant_id,
    'cnpj', v_cnpj,
    'pix_institution', v_inst,
    'pix_key', v_pix,
    'message', 'Dados de dízimos/ofertas atualizados.'
  );
end;
$$;

grant execute on function public.set_igreja_offerings_admin(uuid, text, text, text)
  to anon, authenticated;

notify pgrst, 'reload schema';

commit;
