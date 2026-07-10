-- =============================================================================
-- Multi-tenancy — Passo 2/3: coluna tenant_id + FK + índices + triggers
-- =============================================================================
-- Pré-requisito: multi-tenant-01-schema.sql
--
-- Para cada tabela de dados:
--   1. ADD COLUMN tenant_id uuid (nullable temporário)
--   2. BACKFILL com a igreja IBN
--   3. SET NOT NULL (quando houver linhas ou tabela vazia)
--   4. FK → igrejas(id)
--   5. Índice (tenant_id) e composto comum
--   6. Trigger BEFORE INSERT para preencher tenant_id da sessão
--
-- Tabelas compartilhadas (catálogo global) NÃO recebem tenant_id:
--   bible_themes, bible_verses_by_theme, cep_geolocations, cep_address_cache,
--   ministerial_perguntas, ministerial_opcoes (questionário canônico),
--   access_resources, access_roles (catálogo ACL global — grants ficam por perfil/tenant)
-- =============================================================================

create or replace function public._mt_add_tenant_id(p_table regclass)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_schema text;
  v_table text;
  v_default uuid;
  v_has_rows boolean;
  v_nulls bigint;
  v_trigger_name text;
begin
  select n.nspname, c.relname
    into v_schema, v_table
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
   where c.oid = p_table;

  if v_table is null then
    raise notice 'Tabela % não existe — pulando.', p_table;
    return;
  end if;

  v_default := public.resolve_default_tenant_id();
  if v_default is null then
    raise exception 'Tenant padrão IBN não encontrado. Execute multi-tenant-01-schema.sql.';
  end if;

  -- Coluna
  if not exists (
    select 1
      from information_schema.columns
     where table_schema = v_schema
       and table_name = v_table
       and column_name = 'tenant_id'
  ) then
    execute format(
      'alter table %I.%I add column tenant_id uuid',
      v_schema, v_table
    );
    raise notice 'Coluna tenant_id adicionada em %.%', v_schema, v_table;
  end if;

  -- Backfill
  execute format(
    'update %I.%I set tenant_id = $1 where tenant_id is null',
    v_schema, v_table
  ) using v_default;

  execute format('select exists (select 1 from %I.%I limit 1)', v_schema, v_table)
    into v_has_rows;

  execute format(
    'select count(*) from %I.%I where tenant_id is null',
    v_schema, v_table
  ) into v_nulls;

  if v_nulls > 0 then
    raise exception '%.% ainda tem % linhas sem tenant_id', v_schema, v_table, v_nulls;
  end if;

  -- NOT NULL
  begin
    execute format(
      'alter table %I.%I alter column tenant_id set not null',
      v_schema, v_table
    );
  exception
    when others then
      raise notice 'NOT NULL em %.%.tenant_id: %', v_schema, v_table, SQLERRM;
  end;

  -- FK
  if not exists (
    select 1
      from pg_constraint
     where conname = format('%s_tenant_id_fkey', v_table)
       and conrelid = p_table
  ) then
    execute format(
      'alter table %I.%I add constraint %I foreign key (tenant_id) references public.igrejas (id) on delete restrict',
      v_schema, v_table, format('%s_tenant_id_fkey', v_table)
    );
  end if;

  -- Índice
  execute format(
    'create index if not exists %I on %I.%I (tenant_id)',
    format('%s_tenant_id_idx', v_table),
    v_schema,
    v_table
  );

  -- Trigger auto-fill
  v_trigger_name := format('trg_%s_set_tenant_id', v_table);
  execute format('drop trigger if exists %I on %I.%I', v_trigger_name, v_schema, v_table);
  execute format(
    'create trigger %I before insert on %I.%I for each row execute function public.tg_set_tenant_id_from_session()',
    v_trigger_name, v_schema, v_table
  );

  raise notice 'tenant_id OK em %.% (rows=%s)', v_schema, v_table, v_has_rows;
end;
$$;

-- ---------------------------------------------------------------------------
-- Aplicar em todas as tabelas de dados do projeto
-- ---------------------------------------------------------------------------

do $$
declare
  t text;
  tables text[] := array[
    -- Identidade / família
    'profiles',
    'members',
    'families',
    'profile_vehicles',
    'profile_sessions',
    'profile_app_access_events',
    'profile_app_access_screen_visits',
    'profile_access_roles',
    'profile_scale_leadership',
    'ghost_mode_audit_log',
    'password_recovery_state',
    'password_recovery_tokens',

    -- Eventos / check-in
    'events',
    'event_registrations',
    'event_control',
    'event_avisos',
    'event_favorite_locations',
    'event_quorum_registry',
    'checkins',

    -- Pastoral
    'pastoral_requests',
    'pastoral_reason_categories',
    'pastoral_reason_subcategories',

    -- Financeiro
    'financials',
    'expense_reports',
    'expense_items',

    -- Escalas
    'tipos_escala',
    'voluntarios_escala',
    'escalas_log',

    -- Autorização de mídia
    'pending_authorizations',
    'authorizations',

    -- Recepção
    'recepcao_cadastro_familiar',
    'recepcao_cadastro_familiar_lote',

    -- Manutenção / suporte
    'maintenance_assembly_minutes',
    'maintenance_support_themes',
    'maintenance_support_requests',
    'maintenance_support_attachments',
    'maintenance_support_interactions',
    'maintenance_support_communications',

    -- Ministerial (respostas por pessoa — por tenant)
    'ministerial_respostas',
    'ministerial_resultados',

    -- Config / UI por igreja
    'app_parameters',
    'paletas',

    -- ACL grants (escopo por tenant; catálogo de roles/resources permanece global)
    'access_grants'
  ];
begin
  foreach t in array tables loop
    if to_regclass(format('public.%I', t)) is not null then
      perform public._mt_add_tenant_id(format('public.%I', t)::regclass);
    else
      raise notice 'Tabela public.% não existe — pulando.', t;
    end if;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Índices compostos úteis (idempotentes)
-- ---------------------------------------------------------------------------

do $$
begin
  if to_regclass('public.profiles') is not null then
    execute 'create index if not exists profiles_tenant_family_idx on public.profiles (tenant_id, family_id)';
  end if;
  if to_regclass('public.members') is not null then
    execute 'create index if not exists members_tenant_family_idx on public.members (tenant_id, family_id)';
  end if;
  if to_regclass('public.events') is not null then
    execute 'create index if not exists events_tenant_date_idx on public.events (tenant_id, event_date)';
  end if;
  if to_regclass('public.pastoral_requests') is not null then
    execute 'create index if not exists pastoral_requests_tenant_created_idx on public.pastoral_requests (tenant_id, created_at desc)';
  end if;
  if to_regclass('public.financials') is not null then
    execute 'create index if not exists financials_tenant_idx on public.financials (tenant_id)';
  end if;
  if to_regclass('public.checkins') is not null then
    execute 'create index if not exists checkins_tenant_created_idx on public.checkins (tenant_id, created_at desc)';
  end if;
end;
$$;

-- Limpa helper interno (opcional manter para reexecução)
-- drop function if exists public._mt_add_tenant_id(regclass);

notify pgrst, 'reload schema';
