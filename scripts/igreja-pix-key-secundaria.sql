-- =============================================================================
-- Chave Pix secundária no cadastro da instância (igrejas)
-- =============================================================================
-- Espelha igrejas.pix_key: coluna na igreja + app_parameters.chave_pix_secundaria.
-- Super admin grava em /igrejas (Logo, redes e dízimos/ofertas).
-- Aplica: npx supabase db query --linked -f scripts/igreja-pix-key-secundaria.sql
-- =============================================================================

alter table public.igrejas
  add column if not exists pix_key_secundaria text;

comment on column public.igrejas.pix_key_secundaria is
  'Segunda chave Pix da instância (campanhas / conta alternativa).';

update public.igrejas i
   set pix_key_secundaria = ap.value
  from public.app_parameters ap
 where ap.tenant_id = i.id
   and lower(trim(ap.parameter)) = 'chave_pix_secundaria'
   and nullif(trim(ap.value), '') is not null
   and nullif(trim(coalesce(i.pix_key_secundaria, '')), '') is null;

create or replace function public.resolve_tenant_pix_key(p_tenant uuid, p_slot text)
returns text
language plpgsql
stable
security definer
set search_path = public
set row_security = off
as $$
declare
  v_slot text := public.normalize_pix_account_slot(p_slot);
  v_pix text;
begin
  if p_tenant is null then
    return null;
  end if;

  if v_slot = '2' then
    v_pix := public.read_tenant_app_parameter(p_tenant, 'chave_pix_secundaria');

    if v_pix is null then
      select nullif(trim(i.pix_key_secundaria), '')
        into v_pix
        from public.igrejas i
       where i.id = p_tenant;
    end if;
  else
    v_pix := public.read_tenant_app_parameter(p_tenant, 'chave_pix');

    if v_pix is null then
      select nullif(trim(i.pix_key), '')
        into v_pix
        from public.igrejas i
       where i.id = p_tenant;
    end if;
  end if;

  return v_pix;
end;
$$;

drop function if exists public.set_igreja_offerings_admin(uuid, text, text, text);

create or replace function public.set_igreja_offerings_admin(
  p_tenant_id uuid,
  p_cnpj text,
  p_pix_institution text,
  p_pix_key text,
  p_pix_key_secundaria text default null
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
  v_pix_2 text := nullif(trim(coalesce(p_pix_key_secundaria, '')), '');
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
         pix_key_secundaria = v_pix_2,
         updated_at = now()
   where id = p_tenant_id;

  perform set_config('app.bypass_tenant_guard', 'on', true);

  if v_pix is not null then
    update public.app_parameters
       set value = v_pix
     where tenant_id = p_tenant_id
       and lower(trim(parameter)) = 'chave_pix';

    if not found then
      insert into public.app_parameters (parameter, value, tenant_id)
      values ('chave_pix', v_pix, p_tenant_id);
    end if;
  end if;

  update public.app_parameters
     set value = coalesce(v_pix_2, '')
   where tenant_id = p_tenant_id
     and lower(trim(parameter)) = 'chave_pix_secundaria';

  if not found then
    insert into public.app_parameters (parameter, value, tenant_id)
    values ('chave_pix_secundaria', coalesce(v_pix_2, ''), p_tenant_id);
  end if;

  return jsonb_build_object(
    'success', true,
    'tenant_id', p_tenant_id,
    'cnpj', v_cnpj,
    'pix_institution', v_inst,
    'pix_key', v_pix,
    'pix_key_secundaria', v_pix_2,
    'message', 'Dados de dízimos/ofertas atualizados.'
  );
end;
$$;

grant execute on function public.set_igreja_offerings_admin(uuid, text, text, text, text)
  to anon, authenticated;

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
  is_active boolean,
  is_primary boolean,
  is_linked boolean,
  mae_tenant_id uuid,
  mae_code text,
  mae_name text
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
    q.pix_key_secundaria,
    q.is_active,
    q.is_primary,
    q.is_linked,
    q.mae_tenant_id,
    q.mae_code,
    q.mae_name
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
      nullif(trim(i.pix_key_secundaria), '') as pix_key_secundaria,
      i.is_active,
      coalesce(v.is_primary, false) as is_primary,
      (v.id is not null) as is_linked,
      i.mae_tenant_id,
      mae.code as mae_code,
      mae.name as mae_name
    from public.igrejas i
    left join public.igrejas mae on mae.id = i.mae_tenant_id
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
