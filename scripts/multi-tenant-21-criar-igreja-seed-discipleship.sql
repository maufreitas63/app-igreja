-- =============================================================================
-- Multi-tenancy 21 — seed da Trilha ao criar instância
-- =============================================================================
-- Sintoma: Nova instância falha com
--   function public.seed_discipleship_trail_for_tenant(uuid) does not exist
--
-- Causa: criar_igreja_admin (produção) ainda chama o nome antigo. O patch
--   discipleship-trail-five-modules-patch.sql dropou essa função. O seed atual
--   é seed_default_discipleship_trail (também disparado pelo trigger em igrejas).
-- =============================================================================

begin;

create or replace function public.seed_discipleship_trail_for_tenant(p_tenant_id uuid)
returns void
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
begin
  perform public.seed_default_discipleship_trail(p_tenant_id);
end;
$$;

comment on function public.seed_discipleship_trail_for_tenant(uuid) is
  'Compatibilidade: encaminha para seed_default_discipleship_trail.';

grant execute on function public.seed_discipleship_trail_for_tenant(uuid)
  to anon, authenticated, service_role;

create or replace function public.criar_igreja_admin(
  p_code text,
  p_name text,
  p_logo_url text
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

  perform set_config('app.bypass_tenant_guard', 'on', true);

  insert into public.igrejas (code, name, is_active, logo_url)
  values (v_code, v_name, true, v_logo)
  returning id into v_new;

  insert into public.app_parameters (parameter, value, tenant_id)
  select distinct on (lower(trim(ap.parameter)))
         ap.parameter,
         ap.value,
         v_new
    from public.app_parameters ap
   where ap.tenant_id = v_ibn
   order by lower(trim(ap.parameter)), ap.parameter;

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

  begin
    perform public.seed_default_discipleship_trail(v_new);
  exception
    when others then
      raise warning 'seed_default_discipleship_trail falhou para %: %', v_new, sqlerrm;
  end;

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
      left(
        'Conflito de unicidade ao criar instância. Se mencionar app_parameters_pkey, execute scripts/multi-tenant-20-app-parameters-surrogate-pk.sql. Detalhe: '
          || sqlerrm,
        300
      )
    );
  when others then
    return jsonb_build_object(
      'success', false,
      'message', left('Falha ao criar instância: ' || sqlerrm, 280)
    );
end;
$$;

grant execute on function public.criar_igreja_admin(text, text, text) to anon, authenticated;

notify pgrst, 'reload schema';

commit;

select 'multi-tenant-21-criar-igreja-seed-discipleship: ok' as status;
