-- =============================================================================
-- Multi-tenancy 20 — app_parameters_pkey era GLOBAL em parameter
-- =============================================================================
-- Erro ao criar instância (após script 19):
--   duplicate key value violates unique constraint "app_parameters_pkey"
--
-- Causa: a PK de app_parameters é (provavelmente) só em `parameter`.
-- Copiar parâmetros da IBN para outra igreja reutiliza os mesmos nomes → PK.
--
-- Solução:
--   1) coluna id uuid (surrogate)
--   2) PK em id
--   3) unicidade de negócio: (tenant_id, lower(trim(parameter)))
--   4) recria criar_igreja_admin
--
-- Execute no SQL Editor do Supabase (uma vez). Depois hard refresh.
-- =============================================================================

begin;

-- 1) Surrogate key
alter table public.app_parameters
  add column if not exists id uuid;

update public.app_parameters
   set id = gen_random_uuid()
 where id is null;

alter table public.app_parameters
  alter column id set default gen_random_uuid(),
  alter column id set not null;

-- 2) Trocar PK: parameter → id
alter table public.app_parameters drop constraint if exists app_parameters_pkey;

do $$
declare
  r record;
  v_cols text;
begin
  for r in
    select c.oid, c.conname, c.conkey, c.conrelid
      from pg_constraint c
     where c.conrelid = 'public.app_parameters'::regclass
       and c.contype = 'p'
  loop
    select string_agg(a.attname, ',' order by u.ord)
      into v_cols
      from unnest(r.conkey) with ordinality as u(attnum, ord)
      join pg_attribute a
        on a.attrelid = r.conrelid and a.attnum = u.attnum;

    if coalesce(v_cols, '') is distinct from 'id' then
      execute format('alter table public.app_parameters drop constraint if exists %I', r.conname);
      raise notice 'Dropped PK % (cols=%)', r.conname, v_cols;
    end if;
  end loop;
end $$;

do $$
begin
  if not exists (
    select 1
      from pg_constraint c
     where c.conrelid = 'public.app_parameters'::regclass
       and c.contype = 'p'
  ) then
    alter table public.app_parameters
      add constraint app_parameters_pkey primary key (id);
  end if;
end $$;

-- 3) Remover unicidades globais restantes (não-PK)
drop index if exists public.app_parameters_parameter_lower_unique;
drop index if exists public.app_parameters_parameter_key;

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
      raise notice 'Dropped UNIQUE % (%)', r.conname, v_def;
    end if;
  end loop;
end $$;

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
      raise notice 'Dropped unique index %', r.index_name;
    end if;
  end loop;
end $$;

-- 4) Deduplicar por tenant + parâmetro
delete from public.app_parameters a
 using public.app_parameters b
 where a.tenant_id is not distinct from b.tenant_id
   and lower(trim(a.parameter)) = lower(trim(b.parameter))
   and a.ctid > b.ctid;

-- 5) Índice de negócio por tenant
drop index if exists public.app_parameters_tenant_parameter_lower_unique;

create unique index app_parameters_tenant_parameter_lower_unique
  on public.app_parameters (tenant_id, lower(trim(parameter)))
  where tenant_id is not null;

comment on column public.app_parameters.id is
  'PK surrogate. Unicidade de negócio: (tenant_id, lower(trim(parameter))).';

-- 6) Recriar criar_igreja_admin
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

-- Conferência:
-- select conname, pg_get_constraintdef(oid)
--   from pg_constraint
--  where conrelid = 'public.app_parameters'::regclass and contype = 'p';
-- -- esperado: PRIMARY KEY (id)
--
-- select i.relname, pg_get_indexdef(i.oid)
--   from pg_index x
--   join pg_class i on i.oid = x.indexrelid
--   join pg_class t on t.oid = x.indrelid
--   join pg_namespace n on n.oid = t.relnamespace
--  where n.nspname = 'public' and t.relname = 'app_parameters' and x.indisunique;
