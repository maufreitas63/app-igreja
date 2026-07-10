-- =============================================================================
-- Multi-tenancy 12 — app_parameters único por tenant (corrige criar instância)
-- =============================================================================
-- Problema: o índice app_parameters_parameter_lower_unique (legado) é GLOBAL em
-- lower(trim(parameter)). Ao criar uma nova igreja, onboard_igreja_admin copia
-- os parâmetros da IBN e estoura unique_violation → "erro inesperado" no app.
--
-- Pré-requisitos: multi-tenant-10 (onboard_igreja_admin).
-- Execute no SQL Editor do Supabase.
-- =============================================================================

begin;

-- 1) Índice único por (tenant, parâmetro)
drop index if exists public.app_parameters_parameter_lower_unique;

create unique index if not exists app_parameters_tenant_parameter_lower_unique
  on public.app_parameters (tenant_id, lower(trim(parameter)))
  where tenant_id is not null;

comment on index public.app_parameters_tenant_parameter_lower_unique is
  'Um parâmetro por tenant (case-insensitive). Substitui o índice global legado.';

-- 2) salvar_app_parameter_admin: existência deve ser por tenant
create or replace function public.salvar_app_parameter_admin(
  p_actor_profile_id uuid,
  p_parameter text,
  p_value text
)
returns jsonb
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
  v_parameter text;
  v_value text;
begin
  perform public.assert_access_admin(p_actor_profile_id);

  v_parameter := trim(coalesce(p_parameter, ''));
  v_value := trim(coalesce(p_value, ''));

  if v_parameter = '' then
    return jsonb_build_object('success', false, 'message', 'Parâmetro inválido.');
  end if;

  update public.app_parameters
     set value = v_value,
         parameter = v_parameter
   where tenant_id = v_tenant
     and lower(trim(parameter)) = lower(v_parameter);

  delete from public.app_parameters dup
   where dup.tenant_id = v_tenant
     and lower(trim(dup.parameter)) = lower(v_parameter)
     and dup.ctid not in (
       select ap.ctid
         from public.app_parameters ap
        where ap.tenant_id = v_tenant
          and lower(trim(ap.parameter)) = lower(v_parameter)
        order by
          case when ap.parameter = v_parameter then 0 else 1 end,
          ap.parameter
        limit 1
     );

  if not exists (
    select 1
      from public.app_parameters ap
     where ap.tenant_id = v_tenant
       and lower(trim(ap.parameter)) = lower(v_parameter)
  ) then
    insert into public.app_parameters (parameter, value, tenant_id)
    values (v_parameter, v_value, v_tenant);
  end if;

  return jsonb_build_object(
    'success', true,
    'message', 'Parâmetro salvo.',
    'parameter', v_parameter,
    'value', v_value
  );
exception
  when others then
    return jsonb_build_object('success', false, 'message', sqlerrm);
end;
$$;

grant execute on function public.salvar_app_parameter_admin(uuid, text, text)
  to anon, authenticated;

-- 3) onboard com mensagem clara em unique_violation / erros
create or replace function public.onboard_igreja_admin(
  p_code text,
  p_name text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := public.current_session_profile_id();
  v_code text;
  v_name text;
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

  if exists (select 1 from public.igrejas i where upper(trim(i.code)) = v_code) then
    return jsonb_build_object('success', false, 'message', 'Já existe igreja com este código.');
  end if;

  v_ibn := public.resolve_default_tenant_id();
  if v_ibn is null then
    return jsonb_build_object('success', false, 'message', 'Tenant IBN não encontrado.');
  end if;

  insert into public.igrejas (code, name, is_active)
  values (v_code, v_name, true)
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

grant execute on function public.onboard_igreja_admin(text, text) to anon, authenticated;

notify pgrst, 'reload schema';

commit;
