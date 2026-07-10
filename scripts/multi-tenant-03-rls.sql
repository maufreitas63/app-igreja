-- =============================================================================
-- Multi-tenancy — Passo 3/3: RLS + policies RESTRICTIVE de isolamento
-- =============================================================================
-- Pré-requisito: multi-tenant-01-schema.sql + multi-tenant-02-columns.sql
--
-- Estratégia:
--   - Policies existentes (ACL) permanecem PERMISSIVE.
--   - Novas policies AS RESTRICTIVE exigem session_tenant_matches(tenant_id)
--     em USING e WITH CHECK para SELECT/INSERT/UPDATE/DELETE.
--   - Em PostgreSQL, RESTRICTIVE é AND com o resultado das PERMISSIVE →
--     ninguém acessa outra igreja mesmo com grant ACL amplo.
--
-- App: queries NÃO precisam filtrar tenant_id manualmente — o RLS filtra.
-- INSERT: trigger tg_set_tenant_id_from_session preenche tenant_id.
--
-- ATENÇÃO — SECURITY DEFINER:
--   RPCs security definer ignoram RLS do invocador. Revise funções que leem/
--   gravam tabelas de dados para filtrar por current_session_tenant_id()
--   ou habilitar SET row_security = on quando seguro.
-- =============================================================================

create or replace function public._mt_apply_tenant_rls(p_table regclass)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_schema text;
  v_table text;
  v_pol text;
begin
  select n.nspname, c.relname
    into v_schema, v_table
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
   where c.oid = p_table;

  if v_table is null then
    raise notice 'Tabela % não existe — pulando RLS tenant.', p_table;
    return;
  end if;

  if not exists (
    select 1
      from information_schema.columns
     where table_schema = v_schema
       and table_name = v_table
       and column_name = 'tenant_id'
  ) then
    raise notice '%.% sem tenant_id — pulando.', v_schema, v_table;
    return;
  end if;

  execute format('alter table %I.%I enable row level security', v_schema, v_table);
  -- NÃO usar FORCE ROW LEVEL SECURITY aqui: RPCs security definer
  -- (login, sessões, pastoral, etc.) precisam gravar como owner sem
  -- headers de sessão. Isolamento do client continua via policies abaixo.

  -- SELECT
  v_pol := format('%s_tenant_select', v_table);
  execute format('drop policy if exists %I on %I.%I', v_pol, v_schema, v_table);
  execute format(
    $sql$
      create policy %I
        on %I.%I
        as restrictive
        for select
        to anon, authenticated
        using (public.session_tenant_matches(tenant_id))
    $sql$,
    v_pol, v_schema, v_table
  );

  -- INSERT
  v_pol := format('%s_tenant_insert', v_table);
  execute format('drop policy if exists %I on %I.%I', v_pol, v_schema, v_table);
  execute format(
    $sql$
      create policy %I
        on %I.%I
        as restrictive
        for insert
        to anon, authenticated
        with check (public.session_tenant_matches(tenant_id))
    $sql$,
    v_pol, v_schema, v_table
  );

  -- UPDATE (USING + WITH CHECK obrigatórios)
  v_pol := format('%s_tenant_update', v_table);
  execute format('drop policy if exists %I on %I.%I', v_pol, v_schema, v_table);
  execute format(
    $sql$
      create policy %I
        on %I.%I
        as restrictive
        for update
        to anon, authenticated
        using (public.session_tenant_matches(tenant_id))
        with check (public.session_tenant_matches(tenant_id))
    $sql$,
    v_pol, v_schema, v_table
  );

  -- DELETE
  v_pol := format('%s_tenant_delete', v_table);
  execute format('drop policy if exists %I on %I.%I', v_pol, v_schema, v_table);
  execute format(
    $sql$
      create policy %I
        on %I.%I
        as restrictive
        for delete
        to anon, authenticated
        using (public.session_tenant_matches(tenant_id))
    $sql$,
    v_pol, v_schema, v_table
  );

  raise notice 'RLS tenant RESTRICTIVE aplicada em %.%', v_schema, v_table;
end;
$$;

do $$
declare
  t text;
  -- profile_sessions / password_recovery_* : acesso só via security definer
  -- (sem policies client). Mantêm tenant_id + trigger, sem policy RESTRICTIVE.
  tables text[] := array[
    'profiles',
    'members',
    'families',
    'profile_vehicles',
    'profile_app_access_events',
    'profile_app_access_screen_visits',
    'profile_access_roles',
    'profile_scale_leadership',
    'ghost_mode_audit_log',
    'events',
    'event_registrations',
    'event_control',
    'event_avisos',
    'event_favorite_locations',
    'event_quorum_registry',
    'checkins',
    'pastoral_requests',
    'pastoral_reason_categories',
    'pastoral_reason_subcategories',
    'financials',
    'expense_reports',
    'expense_items',
    'tipos_escala',
    'voluntarios_escala',
    'escalas_log',
    'pending_authorizations',
    'authorizations',
    'recepcao_cadastro_familiar',
    'recepcao_cadastro_familiar_lote',
    'maintenance_assembly_minutes',
    'maintenance_support_themes',
    'maintenance_support_requests',
    'maintenance_support_attachments',
    'maintenance_support_interactions',
    'maintenance_support_communications',
    'ministerial_respostas',
    'ministerial_resultados',
    'app_parameters',
    'paletas',
    'access_grants'
  ];
begin
  foreach t in array tables loop
    if to_regclass(format('public.%I', t)) is not null then
      perform public._mt_apply_tenant_rls(format('public.%I', t)::regclass);
    else
      raise notice 'Tabela public.% não existe — pulando.', t;
    end if;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Diagnóstico rápido (rode após aplicar)
-- ---------------------------------------------------------------------------
-- select tablename, rowsecurity
--   from pg_tables
--  where schemaname = 'public'
--    and tablename = any(array['profiles','events','financials','pastoral_requests']);
--
-- select pol.polname, pol.polcmd, pol.polpermissive, c.relname
--   from pg_policy pol
--   join pg_class c on c.oid = pol.polrelid
--  where c.relname like '%tenant%' or pol.polname like '%tenant%';
--
-- select public.current_session_tenant_id();  -- com headers de sessão no PostgREST

notify pgrst, 'reload schema';
