-- =============================================================================
-- Multi-tenancy 15 — corrigir criar instância (bypass do guard de tenant)
-- =============================================================================
-- Erro observado:
--   tenant_id (NOVA) diverge do tenant da sessão (IBN)
--
-- Causa: tg_set_tenant_id_from_session impede INSERT com tenant_id diferente
-- da sessão, inclusive dentro de onboard_igreja_admin (cópia de app_parameters
-- e vínculo profile_igreja_vinculos).
--
-- Solução: GUC local app.bypass_tenant_guard = on apenas no onboard
-- (security definer + super_admin).
--
-- Execute no SQL Editor do Supabase.
-- =============================================================================

begin;

create or replace function public.tg_set_tenant_id_from_session()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid;
  v_bypass text := coalesce(current_setting('app.bypass_tenant_guard', true), '');
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

  -- Onboarding de nova igreja (super_admin) pode gravar outro tenant_id
  if lower(trim(v_bypass)) in ('on', 'true', '1') then
    return new;
  end if;

  if public.current_session_tenant_id() is not null
     and new.tenant_id is distinct from public.current_session_tenant_id() then
    raise exception 'tenant_id (%) diverge do tenant da sessão (%)',
      new.tenant_id, public.current_session_tenant_id();
  end if;

  return new;
end;
$$;

drop function if exists public.onboard_igreja_admin(text, text);
drop function if exists public.onboard_igreja_admin(text, text, text);

create or replace function public.onboard_igreja_admin(
  p_code text,
  p_name text,
  p_logo_url text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_actor uuid := public.current_session_profile_id();
  v_code text;
  v_name text;
  v_logo text := nullif(trim(coalesce(p_logo_url, '')), '');
  v_ibn uuid;
  v_new uuid;
  v_param record;
begin
  if v_actor is null then
    return jsonb_build_object('success', false, 'message', 'Sessão inválida.');
  end if;

  if not public.profile_has_super_admin_role(v_actor) then
    return jsonb_build_object(
      'success', false,
      'message', 'Apenas super administradores podem criar instâncias.'
    );
  end if;

  v_code := upper(trim(coalesce(p_code, '')));
  v_name := trim(coalesce(p_name, ''));

  if length(v_code) < 2 or length(v_code) > 12 then
    return jsonb_build_object(
      'success', false,
      'message', 'Código deve ter entre 2 e 12 caracteres.'
    );
  end if;

  if v_code !~ '^[A-Z0-9_]+$' then
    return jsonb_build_object(
      'success', false,
      'message', 'Código: apenas letras, números e underscore.'
    );
  end if;

  if length(v_name) < 3 then
    return jsonb_build_object('success', false, 'message', 'Informe o nome da igreja.');
  end if;

  if v_logo is not null and v_logo !~* '^https?://' then
    return jsonb_build_object('success', false, 'message', 'URL do logo inválida.');
  end if;

  if exists (select 1 from public.igrejas i where upper(trim(i.code)) = v_code) then
    return jsonb_build_object('success', false, 'message', 'Já existe igreja com este código.');
  end if;

  v_ibn := public.resolve_default_tenant_id();
  if v_ibn is null then
    return jsonb_build_object('success', false, 'message', 'Tenant IBN não encontrado.');
  end if;

  -- Permite INSERT/UPDATE em outro tenant_id só neste fluxo
  perform set_config('app.bypass_tenant_guard', 'on', true);

  insert into public.igrejas (code, name, is_active, logo_url)
  values (v_code, v_name, true, v_logo)
  returning id into v_new;

  for v_param in
    select ap.parameter, ap.value
      from public.app_parameters ap
     where ap.tenant_id = v_ibn
  loop
    insert into public.app_parameters (parameter, value, tenant_id)
    select v_param.parameter, v_param.value, v_new
    where not exists (
      select 1 from public.app_parameters x
      where x.tenant_id = v_new
        and lower(trim(x.parameter)) = lower(trim(v_param.parameter))
    );
  end loop;

  update public.app_parameters
     set value = v_code
   where tenant_id = v_new
     and lower(trim(parameter)) = 'parm_entidade';

  if not found then
    insert into public.app_parameters (parameter, value, tenant_id)
    values ('Parm_entidade', v_code, v_new);
  end if;

  insert into public.profile_igreja_vinculos (profile_id, tenant_id, is_primary, is_active)
  values (v_actor, v_new, false, true)
  on conflict (profile_id, tenant_id) do update
    set is_active = true,
        updated_at = now();

  return jsonb_build_object(
    'success', true,
    'tenant_id', v_new,
    'code', v_code,
    'name', v_name,
    'logo_url', v_logo,
    'message', 'Instância criada. Selecione-a na lista para operar nela.'
  );
exception
  when unique_violation then
    return jsonb_build_object(
      'success', false,
      'message',
      'Conflito ao copiar parâmetros. Execute scripts/multi-tenant-12-app-parameters-unique-per-tenant.sql e tente de novo.'
    );
  when others then
    return jsonb_build_object(
      'success', false,
      'message', left('Falha ao criar instância: ' || sqlerrm, 240)
    );
end;
$$;

grant execute on function public.onboard_igreja_admin(text, text, text) to anon, authenticated;

notify pgrst, 'reload schema';

commit;
