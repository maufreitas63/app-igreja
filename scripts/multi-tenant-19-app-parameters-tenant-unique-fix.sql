-- =============================================================================
-- Multi-tenancy 19 — app_parameters: unicidade só por tenant + criar_igreja estável
-- =============================================================================
-- Sintoma: ao criar instância, o app pede o script 12 de novo e de novo.
--
-- Causas típicas:
-- 1) Ainda existe UNIQUE(parameter) ou índice GLOBAL em lower(trim(parameter))
--    (ex.: app-parameter-lgpd-ativo-dedupe.sql recria o índice global).
-- 2) O script 12 falha no CREATE UNIQUE (duplicatas no mesmo tenant) e o
--    BEGIN/COMMIT faz rollback — o índice global volta.
-- 3) O handler de unique_violation sempre culpava o script 12, escondendo o
--    constraint real (SQLERRM).
--
-- Este script:
--   - remove unicidades GLOBAIS em app_parameters
--   - deduplica por (tenant_id, lower(trim(parameter)))
--   - cria o índice único por tenant
--   - recria criar_igreja_admin com cópia DISTINCT ON + mensagem de erro real
--
-- Execute no SQL Editor do Supabase (uma vez). NÃO reexecute o script 12 depois.
-- =============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1) Remover constraints UNIQUE que NÃO incluem tenant_id
-- ---------------------------------------------------------------------------
do $$
declare
  r record;
  v_def text;
begin
  for r in
    select c.oid, c.conname
      from pg_constraint c
     where c.conrelid = 'public.app_parameters'::regclass
       and c.contype = 'u'
  loop
    v_def := pg_get_constraintdef(r.oid);
    if v_def is not null and position('tenant_id' in lower(v_def)) = 0 then
      execute format('alter table public.app_parameters drop constraint if exists %I', r.conname);
      raise notice 'Dropped UNIQUE constraint: % (%)', r.conname, v_def;
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 2) Remover índices UNIQUE globais (sem tenant_id na definição)
-- ---------------------------------------------------------------------------
drop index if exists public.app_parameters_parameter_lower_unique;
drop index if exists public.app_parameters_parameter_key;

do $$
declare
  r record;
begin
  for r in
    select i.relname as index_name,
           pg_get_indexdef(i.oid) as index_def
      from pg_index x
      join pg_class i on i.oid = x.indexrelid
      join pg_class t on t.oid = x.indrelid
      join pg_namespace n on n.oid = t.relnamespace
     where n.nspname = 'public'
       and t.relname = 'app_parameters'
       and x.indisunique
       and not x.indisprimary
  loop
    if position('tenant_id' in lower(r.index_def)) = 0 then
      execute format('drop index if exists public.%I', r.index_name);
      raise notice 'Dropped unique index: %', r.index_name;
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 3) Deduplicar dentro de cada tenant (mantém 1 linha por parâmetro)
-- ---------------------------------------------------------------------------
delete from public.app_parameters a
 using public.app_parameters b
 where a.tenant_id is not distinct from b.tenant_id
   and lower(trim(a.parameter)) = lower(trim(b.parameter))
   and a.ctid > b.ctid;

-- ---------------------------------------------------------------------------
-- 4) Índice único correto: (tenant, parâmetro)
-- ---------------------------------------------------------------------------
drop index if exists public.app_parameters_tenant_parameter_lower_unique;

create unique index app_parameters_tenant_parameter_lower_unique
  on public.app_parameters (tenant_id, lower(trim(parameter)))
  where tenant_id is not null;

comment on index public.app_parameters_tenant_parameter_lower_unique is
  'Um parâmetro por tenant (case-insensitive). Sem unicidade global.';

-- ---------------------------------------------------------------------------
-- 5) Recriar criar_igreja_admin (cópia deduplicada + erro real)
-- ---------------------------------------------------------------------------
do $$
declare
  r record;
begin
  for r in
    select p.oid::regprocedure as sig
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname = 'criar_igreja_admin'
  loop
    execute 'drop function if exists ' || r.sig || ' cascade';
  end loop;
end $$;

create function public.criar_igreja_admin(
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

  -- Uma linha por parâmetro (evita unique_violation se a IBN tiver duplicatas)
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
        'Conflito de unicidade ao criar instância. Execute scripts/multi-tenant-19-app-parameters-tenant-unique-fix.sql. Detalhe: '
          || sqlerrm,
        280
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

-- Conferência (rode depois do commit):
-- Índices únicos em app_parameters — só deve restar o por tenant:
-- select i.relname, pg_get_indexdef(i.oid)
--   from pg_index x
--   join pg_class i on i.oid = x.indexrelid
--   join pg_class t on t.oid = x.indrelid
--   join pg_namespace n on n.oid = t.relnamespace
--  where n.nspname = 'public' and t.relname = 'app_parameters' and x.indisunique;
--
-- Constraints UNIQUE:
-- select conname, pg_get_constraintdef(oid)
--   from pg_constraint
--  where conrelid = 'public.app_parameters'::regclass and contype = 'u';
