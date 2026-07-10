-- =============================================================================
-- Multi-tenancy — Passo 8: onboarding de uma NOVA igreja (tenant)
-- =============================================================================
-- Pré-requisito: passos 01–07 ok (IBN operacional).
--
-- 1) Edite o bloco CONFIG abaixo.
-- 2) Execute o arquivo INTEIRO no SQL Editor (BEGIN/COMMIT).
-- 3) Se der erro, a transação reverte — nada fica pela metade.
--
-- ATENÇÃO:
--   - Não reutilize telefone de profile da IBN como admin da nova igreja
--     se quiser isolamento total (um profile = um tenant primary).
--   - Login por telefone ainda é global no DB; com 2 igrejas e mesmo
--     telefone, find_profile_id_by_phone pode ambiguidade — use phones únicos
--     ou planeje evolução do login multi-tenant.
-- =============================================================================

begin;

-- ---------------------------------------------------------------------------
-- CONFIG — altere estes valores
-- ---------------------------------------------------------------------------
do $$
declare
  -- Código curto (prefixo familiar / Parm_entidade), ex.: 'IBC'
  v_code text := 'NOVA';
  -- Nome oficial
  v_name text := 'Nome da Nova Igreja';
  -- Profile que será admin primary desta igreja (UUID existente em profiles)
  -- Deixe null para só criar a igreja + parâmetros, sem vínculo.
  v_admin_profile_id uuid := null; -- ex.: '........-....-....-....-............'

  v_ibn uuid;
  v_new uuid;
  v_param record;
begin
  v_code := upper(trim(v_code));
  v_name := trim(v_name);

  if v_code = '' or v_code = 'IBN' or v_code = 'NOVA' then
    raise exception 'Defina v_code com um código real (não use IBN nem o placeholder NOVA).';
  end if;

  if v_name = '' or v_name = 'Nome da Nova Igreja' then
    raise exception 'Defina v_name com o nome real da igreja.';
  end if;

  if exists (select 1 from public.igrejas i where upper(trim(i.code)) = v_code) then
    raise exception 'Já existe igreja com code=%', v_code;
  end if;

  v_ibn := public.resolve_default_tenant_id();
  if v_ibn is null then
    raise exception 'Tenant IBN não encontrado. Execute multi-tenant-01-schema.sql.';
  end if;

  -- 1) Criar igreja
  insert into public.igrejas (code, name, is_active)
  values (v_code, v_name, true)
  returning id into v_new;

  raise notice 'Igreja criada: id=% code=% name=%', v_new, v_code, v_name;

  -- 2) Copiar app_parameters da IBN para o novo tenant (exceto se já existir)
  for v_param in
    select ap.parameter, ap.value
      from public.app_parameters ap
     where ap.tenant_id = v_ibn
  loop
    insert into public.app_parameters (parameter, value, tenant_id)
    select v_param.parameter, v_param.value, v_new
    where not exists (
      select 1
        from public.app_parameters x
       where x.tenant_id = v_new
         and lower(trim(x.parameter)) = lower(trim(v_param.parameter))
    );
  end loop;

  -- 3) Ajustar Parm_entidade / prefixo da nova igreja
  update public.app_parameters
     set value = v_code
   where tenant_id = v_new
     and lower(trim(parameter)) = 'parm_entidade';

  if not found then
    insert into public.app_parameters (parameter, value, tenant_id)
    values ('Parm_entidade', v_code, v_new);
  end if;

  -- 4) Vínculo do admin (opcional)
  if v_admin_profile_id is not null then
    if not exists (select 1 from public.profiles p where p.id = v_admin_profile_id) then
      raise exception 'Profile admin % não existe.', v_admin_profile_id;
    end if;

    -- Desativa primary anterior deste profile (se houver)
    update public.profile_igreja_vinculos
       set is_primary = false,
           updated_at = now()
     where profile_id = v_admin_profile_id
       and is_primary = true
       and is_active = true;

    insert into public.profile_igreja_vinculos (profile_id, tenant_id, is_primary, is_active)
    values (v_admin_profile_id, v_new, true, true)
    on conflict (profile_id, tenant_id) do update
      set is_primary = true,
          is_active = true,
          updated_at = now();

    -- Alinha profiles.tenant_id ao primary atual
    update public.profiles
       set tenant_id = v_new
     where id = v_admin_profile_id;

    raise notice 'Admin % vinculado como primary ao tenant %', v_admin_profile_id, v_new;
  else
    raise notice 'Nenhum admin vinculado (v_admin_profile_id null).';
  end if;

  raise notice 'Onboarding OK. Próximos passos manuais: tipos de escala, categorias pastorais, ACL grants, primeiro evento.';
end;
$$;

commit;

notify pgrst, 'reload schema';

-- ---------------------------------------------------------------------------
-- Verificação rápida (rode depois, fora da transação se preferir)
-- ---------------------------------------------------------------------------
-- select id, code, name, is_active from public.igrejas order by created_at;
-- select parameter, value from public.app_parameters
--  where tenant_id = (select id from public.igrejas where code = 'SEU_CODE')
--  order by parameter;
