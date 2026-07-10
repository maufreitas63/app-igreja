-- =============================================================================
-- Multi-tenancy — onda 4c: sync / params / e-mail / extras (tenant isolation)
-- =============================================================================
-- Pré-requisito: scripts/multi-tenant-wave0-helper.sql (require_session_tenant_id).
-- Fontes canônicas:
--   register-member-atomic.sql / sync-profiles-family-from-members.sql
--   change-phone-everywhere.sql / recepcao-cadastro-familiar.sql
--   update-profile-field.sql / profiles-sync-address-from-cep*.sql
--   member-birth-date-kids-teens-sync.sql
--   access-control-pastoral-congregado-membership.sql
--   profile-access-insights-screen-visits-patch.sql / media-authorization-rpc.sql
--   access-control-lider-escala.sql / geo-checkin-*.sql
--   paletas-table.sql / access-control-predictive-insights.sql
--   maintenance-support-suggestions.sql / access-control-security-hardening.sql
-- Admin/sessão: require_session_tenant_id().
-- Público/e-mail sem sessão: coalesce(current_session_tenant_id(), resolve_default_tenant_id()).
-- =============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1. sync_member_family_from_profile (trigger)
-- Fonte: register-member-atomic.sql
-- ---------------------------------------------------------------------------
create or replace function public.sync_member_family_from_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid := coalesce(
    new.tenant_id,
    public.current_session_tenant_id(),
    public.resolve_default_tenant_id()
  );
  v_member_id uuid;
  v_family_id text;
begin
  if pg_trigger_depth() > 1 then
    return new;
  end if;

  if v_tenant is null then
    return new;
  end if;

  if
    tg_op = 'UPDATE'
    and new.codigo_membro is distinct from old.codigo_membro
    and new.family_id is not distinct from old.family_id
  then
    v_family_id := nullif(trim(coalesce(new.codigo_membro, '')), '');
  elsif tg_op = 'UPDATE' and new.family_id is distinct from old.family_id then
    v_family_id := nullif(trim(coalesce(new.family_id, '')), '');
  else
    v_family_id := coalesce(
      nullif(trim(coalesce(new.family_id, '')), ''),
      nullif(trim(coalesce(new.codigo_membro, '')), '')
    );
  end if;

  update public.profiles p
  set
    family_id = v_family_id,
    codigo_membro = v_family_id
  where p.tenant_id = v_tenant
    and p.id = new.id
    and (
      p.family_id is distinct from v_family_id
      or p.codigo_membro is distinct from v_family_id
    );

  v_member_id := public.find_member_id_for_profile_sync(new.phone, new.full_name);

  if v_member_id is null then
    return new;
  end if;

  update public.members m
  set family_id = v_family_id
  where m.tenant_id = v_tenant
    and m.id = v_member_id
    and m.family_id is distinct from v_family_id;

  return new;
end;
$$;


-- ---------------------------------------------------------------------------
-- 2. sync_profile_family_from_member (trigger)
-- Fonte: register-member-atomic.sql
-- ---------------------------------------------------------------------------
create or replace function public.sync_profile_family_from_member()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid := coalesce(
    new.tenant_id,
    public.current_session_tenant_id(),
    public.resolve_default_tenant_id()
  );
  v_profile_id uuid;
  v_family_id text;
begin
  if pg_trigger_depth() > 1 then
    return new;
  end if;

  if v_tenant is null then
    return new;
  end if;

  v_profile_id := public.find_profile_id_for_member_sync(new.phone, new.full_name);
  v_family_id := nullif(trim(coalesce(new.family_id, '')), '');

  if v_profile_id is null then
    return new;
  end if;

  update public.profiles p
  set
    family_id = v_family_id,
    codigo_membro = v_family_id
  where p.tenant_id = v_tenant
    and p.id = v_profile_id
    and (
      p.family_id is distinct from v_family_id
      or p.codigo_membro is distinct from v_family_id
    );

  return new;
end;
$$;


-- ---------------------------------------------------------------------------
-- 3. sync_profiles_family_id_from_members
-- Fonte: sync-profiles-family-from-members.sql
-- ---------------------------------------------------------------------------
create or replace function public.sync_profiles_family_id_from_members()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
  v_updated int := 0;
  v_row_count int;
begin
  perform set_config('app.skip_family_sync_trigger', 'on', true);

  update public.profiles p
     set family_id = resolved.family_id,
         codigo_membro = resolved.family_id,
         updated_at = now()
    from (
      select
        p2.id as profile_id,
        public.resolve_member_family_id_for_directory_person(p2.phone, trim(p2.full_name)) as family_id
      from public.profiles p2
      where p2.tenant_id = v_tenant
        and p2.full_name is not null
        and trim(p2.full_name) <> ''
    ) resolved
   where p.tenant_id = v_tenant
     and p.id = resolved.profile_id
     and resolved.family_id is not null
     and public.profile_directory_family_code(p.family_id, p.codigo_membro) is distinct from resolved.family_id;

  get diagnostics v_row_count = row_count;
  v_updated := v_updated + v_row_count;

  update public.members m
     set accepted = true
    from public.recepcao_cadastro_familiar r
   where m.tenant_id = v_tenant
     and r.tenant_id = v_tenant
     and r.status = 'processed'
     and r.applied_member_id = m.id
     and coalesce(m.accepted, false) is false;

  get diagnostics v_row_count = row_count;
  v_updated := v_updated + v_row_count;

  perform set_config('app.skip_family_sync_trigger', 'off', true);

  return jsonb_build_object(
    'success', true,
    'rows_updated', v_updated
  );
exception
  when others then
    perform set_config('app.skip_family_sync_trigger', 'off', true);
    return jsonb_build_object(
      'success', false,
      'message', coalesce(sqlerrm, 'Falha ao sincronizar family_id em profiles.')
    );
end;
$$;

grant execute on function public.sync_profiles_family_id_from_members() to authenticated;


-- ---------------------------------------------------------------------------
-- 4. change_phone_everywhere
-- Fonte: change-phone-everywhere.sql
-- ---------------------------------------------------------------------------
create or replace function public.change_phone_everywhere(
  p_old_phone text,
  p_new_phone text,
  p_column_names text[] default array['phone', 'cell_phone', 'mobile_phone', 'whatsapp_phone']
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
  v_old_phone text := nullif(trim(coalesce(p_old_phone, '')), '');
  v_new_phone text := nullif(trim(coalesce(p_new_phone, '')), '');
  v_old_phone_normalized text;
  v_new_phone_normalized text;
  v_column_names text[] := coalesce(p_column_names, array['phone', 'cell_phone', 'mobile_phone', 'whatsapp_phone']);
  v_sql text;
  v_rows integer;
  v_total_rows integer := 0;
  v_changes jsonb := '[]'::jsonb;
  v_target record;
begin
  if v_old_phone is null then
    raise exception 'Telefone de origem nao informado.';
  end if;

  if v_new_phone is null then
    raise exception 'Telefone de destino nao informado.';
  end if;

  v_old_phone_normalized := public.normalize_phone_for_sync(v_old_phone);
  v_new_phone_normalized := public.normalize_phone_for_sync(v_new_phone);

  if v_old_phone_normalized = '' then
    raise exception 'Telefone de origem invalido.';
  end if;

  if v_new_phone_normalized = '' then
    raise exception 'Telefone de destino invalido.';
  end if;

  if v_old_phone_normalized = v_new_phone_normalized then
    return jsonb_build_object(
      'success', true,
      'message', 'Os numeros informado de origem e destino sao equivalentes apos normalizacao.',
      'old_phone', v_old_phone,
      'new_phone', v_new_phone,
      'updated_rows', 0,
      'changes', '[]'::jsonb
    );
  end if;

  for v_target in
    select
      c.table_schema,
      c.table_name,
      c.column_name,
      exists (
        select 1
        from information_schema.columns c2
        where c2.table_schema = c.table_schema
          and c2.table_name = c.table_name
          and c2.column_name = 'updated_at'
      ) as has_updated_at,
      exists (
        select 1
        from information_schema.columns c3
        where c3.table_schema = c.table_schema
          and c3.table_name = c.table_name
          and c3.column_name = 'tenant_id'
      ) as has_tenant_id
    from information_schema.columns c
    where c.table_schema = 'public'
      and c.column_name = any(v_column_names)
      and c.data_type in ('text', 'character varying', 'character')
    order by
      case c.table_name
        when 'profiles' then 0
        when 'members' then 1
        else 2
      end,
      c.table_name,
      c.column_name
  loop
    if v_target.has_tenant_id and v_target.has_updated_at then
      v_sql := format(
        'update %I.%I
            set %I = $1,
                updated_at = now()
          where tenant_id = $4
            and (%I = $2 or public.normalize_phone_for_sync(%I) = $3)',
        v_target.table_schema,
        v_target.table_name,
        v_target.column_name,
        v_target.column_name,
        v_target.column_name
      );
    elsif v_target.has_tenant_id then
      v_sql := format(
        'update %I.%I
            set %I = $1
          where tenant_id = $4
            and (%I = $2 or public.normalize_phone_for_sync(%I) = $3)',
        v_target.table_schema,
        v_target.table_name,
        v_target.column_name,
        v_target.column_name,
        v_target.column_name
      );
    elsif v_target.has_updated_at then
      v_sql := format(
        'update %I.%I
            set %I = $1,
                updated_at = now()
          where %I = $2
             or public.normalize_phone_for_sync(%I) = $3',
        v_target.table_schema,
        v_target.table_name,
        v_target.column_name,
        v_target.column_name,
        v_target.column_name
      );
    else
      v_sql := format(
        'update %I.%I
            set %I = $1
          where %I = $2
             or public.normalize_phone_for_sync(%I) = $3',
        v_target.table_schema,
        v_target.table_name,
        v_target.column_name,
        v_target.column_name,
        v_target.column_name
      );
    end if;

    if v_target.has_tenant_id then
      execute v_sql
      using v_new_phone, v_old_phone, v_old_phone_normalized, v_tenant;
    else
      execute v_sql
      using v_new_phone, v_old_phone, v_old_phone_normalized;
    end if;

    get diagnostics v_rows = row_count;

    if v_rows > 0 then
      v_total_rows := v_total_rows + v_rows;
      v_changes := v_changes || jsonb_build_array(
        jsonb_build_object(
          'table', format('%s.%s', v_target.table_schema, v_target.table_name),
          'column', v_target.column_name,
          'updated_rows', v_rows
        )
      );
    end if;
  end loop;

  return jsonb_build_object(
    'success', true,
    'old_phone', v_old_phone,
    'new_phone', v_new_phone,
    'old_phone_normalized', v_old_phone_normalized,
    'new_phone_normalized', v_new_phone_normalized,
    'updated_rows', v_total_rows,
    'changes', v_changes
  );
end;
$$;

comment on function public.change_phone_everywhere(text, text, text[]) is
  'Troca um numero de telefone em colunas textuais do schema public (escopo tenant quando a tabela tem tenant_id).';

grant execute on function public.change_phone_everywhere(text, text, text[]) to anon;
grant execute on function public.change_phone_everywhere(text, text, text[]) to authenticated;


-- ---------------------------------------------------------------------------
-- 5. reserve_next_family_id
-- Fonte: register-member-atomic.sql
-- ---------------------------------------------------------------------------
create or replace function public.reserve_next_family_id()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid := coalesce(
    public.current_session_tenant_id(),
    public.resolve_default_tenant_id()
  );
  v_prefix text;
  v_param_last int;
  v_family_ref_num int;
  v_max_suffix int;
  v_base int;
  v_next int;
  v_new_id text;
begin
  if v_tenant is null then
    raise exception 'Tenant padrão não encontrado.';
  end if;

  perform pg_advisory_xact_lock(hashtext('reserve_family:' || v_tenant::text), 4821901);

  v_prefix := public.get_family_id_prefix();

  select
    case
      when trim(ap.value) ~ ('^' || v_prefix || '\d+$') then
        substring(trim(ap.value) from (v_prefix || '(\d+)$'))::integer
      when v_prefix is distinct from 'IBN' and trim(ap.value) ~ '^IBN\d+$' then
        substring(trim(ap.value) from 'IBN(\d+)$')::integer
      when trim(ap.value) ~ '^\d+$' then trim(ap.value)::integer
      else null
    end
  into v_param_last
  from public.app_parameters ap
  where ap.tenant_id = v_tenant
    and lower(ap.parameter) = 'last_family_id'
  limit 1;

  select
    case
      when trim(ap.value) ~ '^\d+$' then trim(ap.value)::integer
      else null
    end
  into v_family_ref_num
  from public.app_parameters ap
  where ap.tenant_id = v_tenant
    and lower(ap.parameter) = 'family_ref'
  limit 1;

  select coalesce(max(t.n), 0)
  into v_max_suffix
  from (
    select substring(trim(m.family_id) from (v_prefix || '(\d+)$'))::integer as n
    from public.members m
    where m.tenant_id = v_tenant
      and trim(coalesce(m.family_id, '')) ~ ('^' || v_prefix || '\d+$')
    union all
    select substring(trim(m.family_id) from 'IBN(\d+)$')::integer as n
    from public.members m
    where m.tenant_id = v_tenant
      and v_prefix is distinct from 'IBN'
      and trim(coalesce(m.family_id, '')) ~ '^IBN\d+$'
    union all
    select substring(trim(p.family_id) from (v_prefix || '(\d+)$'))::integer as n
    from public.profiles p
    where p.tenant_id = v_tenant
      and trim(coalesce(p.family_id, '')) ~ ('^' || v_prefix || '\d+$')
    union all
    select substring(trim(p.family_id) from 'IBN(\d+)$')::integer as n
    from public.profiles p
    where p.tenant_id = v_tenant
      and v_prefix is distinct from 'IBN'
      and trim(coalesce(p.family_id, '')) ~ '^IBN\d+$'
    union all
    select substring(trim(p.codigo_membro) from (v_prefix || '(\d+)$'))::integer as n
    from public.profiles p
    where p.tenant_id = v_tenant
      and trim(coalesce(p.codigo_membro, '')) ~ ('^' || v_prefix || '\d+$')
    union all
    select substring(trim(p.codigo_membro) from 'IBN(\d+)$')::integer as n
    from public.profiles p
    where p.tenant_id = v_tenant
      and v_prefix is distinct from 'IBN'
      and trim(coalesce(p.codigo_membro, '')) ~ '^IBN\d+$'
  ) t;

  v_base := greatest(
    coalesce(v_param_last, case when v_family_ref_num is not null then v_family_ref_num - 1 else null end, 0),
    v_max_suffix
  );

  v_next := v_base + 1;
  v_new_id := v_prefix || lpad(v_next::text, 4, '0');

  update public.app_parameters
  set value = v_next::text
  where tenant_id = v_tenant
    and lower(parameter) = 'last_family_id';

  if not found then
    insert into public.app_parameters (parameter, value, tenant_id)
    values ('last_family_id', v_next::text, v_tenant);
  end if;

  update public.app_parameters
  set value = (v_next + 1)::text
  where tenant_id = v_tenant
    and lower(parameter) = 'family_ref';

  if not found then
    insert into public.app_parameters (parameter, value, tenant_id)
    values ('family_ref', (v_next + 1)::text, v_tenant);
  end if;

  return v_new_id;
end;
$$;

grant execute on function public.reserve_next_family_id() to anon;
grant execute on function public.reserve_next_family_id() to authenticated;


-- ---------------------------------------------------------------------------
-- 6. repair_recepcao_processed_family_grouping
-- Fonte: recepcao-cadastro-familiar.sql
-- ---------------------------------------------------------------------------
create or replace function public.repair_recepcao_processed_family_grouping()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
  v_lote record;
  v_canonical text;
  v_repaired_lotes int := 0;
  v_rows_touched int := 0;
  v_batch int;
begin
  for v_lote in
    select l.id as submission_id
      from public.recepcao_cadastro_familiar_lote l
     where l.tenant_id = v_tenant
       and l.status = 'processed'
     order by l.processed_at nulls last, l.created_at
  loop
    v_canonical := public.resolve_recepcao_lote_family_id(v_lote.submission_id);

    if v_canonical is null then
      select coalesce(
        nullif(trim(coalesce(r.applied_family_id, '')), ''),
        nullif(trim(coalesce(p.family_id, p.codigo_membro, '')), '')
      )
        into v_canonical
        from public.recepcao_cadastro_familiar r
        left join public.profiles p
          on p.id = r.applied_profile_id
         and (p.tenant_id = v_tenant or p.tenant_id is null)
       where r.tenant_id = v_tenant
         and r.submission_id = v_lote.submission_id
         and r.is_informant is true
       order by r.processed_at desc nulls last
       limit 1;
    end if;

    if v_canonical is null then
      select nullif(trim(coalesce(r.applied_family_id, '')), '')
        into v_canonical
        from public.recepcao_cadastro_familiar r
       where r.tenant_id = v_tenant
         and r.submission_id = v_lote.submission_id
         and r.applied_family_id is not null
       order by r.is_informant desc, r.processed_at desc nulls last
       limit 1;
    end if;

    continue when v_canonical is null;

    v_batch := public.finalize_recepcao_lote_family_assignments(v_lote.submission_id, v_canonical);

    if v_batch > 0 then
      v_repaired_lotes := v_repaired_lotes + 1;
      v_rows_touched := v_rows_touched + v_batch;

      update public.recepcao_cadastro_familiar_lote
         set process_message = trim(
           coalesce(process_message, '')
           || format(' [reparo %s: family_id unificado em %s]', now()::date, v_canonical)
         ),
             detected_family_id = v_canonical
       where tenant_id = v_tenant
         and id = v_lote.submission_id;
    end if;
  end loop;

  return jsonb_build_object(
    'success', true,
    'repaired_lotes', v_repaired_lotes,
    'rows_touched', v_rows_touched
  );
end;
$$;

grant execute on function public.repair_recepcao_processed_family_grouping() to authenticated;


-- ---------------------------------------------------------------------------
-- 7. update_profile_field
-- Fonte: update-profile-field.sql / register-member-atomic.sql
-- ---------------------------------------------------------------------------
create or replace function public.update_profile_field(
  p_profile_id uuid,
  p_field text,
  p_value jsonb default 'null'::jsonb,
  p_actor_profile_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
  v_field text;
  v_actor_id uuid;
  v_column_key text;
  v_updated public.profiles%rowtype;
begin
  if p_profile_id is null then
    raise exception 'Perfil não informado.';
  end if;

  v_field := trim(coalesce(p_field, ''));

  if v_field = '' then
    raise exception 'Campo não informado.';
  end if;

  if lower(v_field) = any(array['id', 'created_at', 'updated_at', 'auth_user_id', 'access_pin', 'tenant_id']) then
    raise exception 'Campo protegido: %', v_field;
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = v_field
  ) then
    raise exception 'Campo inexistente em profiles: %', v_field;
  end if;

  v_actor_id := coalesce(p_actor_profile_id, p_profile_id);
  v_column_key := 'profiles.' || v_field;

  if exists (
    select 1
      from public.access_resources r
     where r.resource_type = 'column'
       and r.is_active = true
       and public.access_resource_matches(r.resource_key, v_column_key)
  )
  and not public.profile_has_access(v_actor_id, 'column', v_column_key, 'update') then
    raise exception 'Você não tem permissão para alterar este campo.';
  end if;

  execute format(
    'update public.profiles as p
        set %1$I = (jsonb_populate_record(null::public.profiles, jsonb_build_object(%2$L, $1))).%1$I,
            updated_at = now()
      where p.id = $2
        and p.tenant_id = $3
      returning p.*',
    v_field,
    v_field
  )
  using p_value, p_profile_id, v_tenant
  into v_updated;

  if v_updated.id is null then
    raise exception 'Perfil não encontrado ou sem permissão para atualizar.';
  end if;

  return to_jsonb(v_updated);
end;
$$;

grant execute on function public.update_profile_field(uuid, text, jsonb, uuid) to anon;
grant execute on function public.update_profile_field(uuid, text, jsonb, uuid) to authenticated;


-- ---------------------------------------------------------------------------
-- 8. apply_cep_address_to_profile
-- Fonte: profiles-sync-address-from-cep.sql
-- ---------------------------------------------------------------------------
create or replace function public.apply_cep_address_to_profile(
  p_profile_id uuid,
  p_force_update boolean default false,
  p_refresh_cache boolean default false
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid := coalesce(
    public.current_session_tenant_id(),
    (select p.tenant_id from public.profiles p where p.id = p_profile_id),
    public.resolve_default_tenant_id()
  );
  v_row public.profiles%rowtype;
  v_digits text;
  v_cache public.cep_address_cache;
begin
  if p_profile_id is null or v_tenant is null then
    return false;
  end if;

  select *
    into v_row
    from public.profiles p
   where p.id = p_profile_id
     and (p.tenant_id = v_tenant or p.tenant_id is null);

  if not found then
    return false;
  end if;

  v_digits := public.normalize_profile_cep_digits(v_row.cep);

  if v_digits is null then
    return false;
  end if;

  v_cache := public.ensure_cep_address_cache(v_digits, p_refresh_cache);

  if v_cache is null then
    return false;
  end if;

  perform set_config('app.skip_cep_sync_trigger', 'on', true);

  update public.profiles p
  set
    cep = public.format_profile_cep_display(v_digits),
    address_street = case
      when p_force_update then v_cache.logradouro
      when nullif(trim(p.address_street), '') is null then v_cache.logradouro
      else p.address_street
    end,
    address_neighborhood = case
      when p_force_update then v_cache.bairro
      when nullif(trim(p.address_neighborhood), '') is null then v_cache.bairro
      else p.address_neighborhood
    end,
    address_city = case
      when p_force_update then v_cache.localidade
      when nullif(trim(p.address_city), '') is null then v_cache.localidade
      else p.address_city
    end,
    address_state = case
      when p_force_update then v_cache.uf
      when nullif(trim(p.address_state), '') is null then v_cache.uf
      else p.address_state
    end,
    address_complement = case
      when p_force_update and nullif(trim(v_cache.complemento), '') is not null
        then v_cache.complemento
      when nullif(trim(p.address_complement), '') is null
        and nullif(trim(v_cache.complemento), '') is not null
        then v_cache.complemento
      else p.address_complement
    end,
    tenant_id = coalesce(p.tenant_id, v_tenant),
    updated_at = now()
  where p.id = p_profile_id
    and (p.tenant_id = v_tenant or p.tenant_id is null);

  return true;
end;
$$;

grant execute on function public.apply_cep_address_to_profile(uuid, boolean, boolean) to anon, authenticated;


-- ---------------------------------------------------------------------------
-- 9. apply_recepcao_address_to_profile
-- Fonte: recepcao-cadastro-familiar.sql
-- ---------------------------------------------------------------------------
create or replace function public.apply_recepcao_address_to_profile(
  p_profile_id uuid,
  p_cep text,
  p_address_street text,
  p_address_neighborhood text,
  p_address_city text,
  p_address_state text,
  p_address_number text,
  p_address_complement text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid := coalesce(
    public.current_session_tenant_id(),
    (select p.tenant_id from public.profiles p where p.id = p_profile_id),
    public.resolve_default_tenant_id()
  );
  v_digits text;
  v_cep_formatted text;
  v_has_form_address boolean;
  v_cep_sync_ok boolean := false;
  v_profile_city text;
begin
  if p_profile_id is null or v_tenant is null then
    return null;
  end if;

  v_digits := regexp_replace(coalesce(p_cep, ''), '[^0-9]', '', 'g');
  if length(v_digits) <> 8 then
    v_digits := null;
  end if;

  if v_digits is not null then
    v_cep_formatted := substring(v_digits, 1, 5) || '-' || substring(v_digits, 6, 3);
  else
    v_cep_formatted := nullif(trim(p_cep), '');
  end if;

  v_has_form_address :=
    coalesce(
      nullif(trim(p_address_street), ''),
      nullif(trim(p_address_neighborhood), ''),
      nullif(trim(p_address_city), ''),
      nullif(trim(p_address_state), '')
    ) is not null;

  if v_digits is not null
     and nullif(trim(p_address_city), '') is not null
     and nullif(trim(p_address_state), '') is not null
     and to_regclass('public.cep_address_cache') is not null then
    insert into public.cep_address_cache (
      cep_digits,
      logradouro,
      bairro,
      localidade,
      uf,
      complemento,
      source
    )
    values (
      v_digits,
      nullif(trim(p_address_street), ''),
      nullif(trim(p_address_neighborhood), ''),
      nullif(trim(p_address_city), ''),
      nullif(trim(p_address_state), ''),
      nullif(trim(p_address_complement), ''),
      'recepcao_form'
    )
    on conflict (cep_digits) do update
      set logradouro = coalesce(excluded.logradouro, cep_address_cache.logradouro),
          bairro = coalesce(excluded.bairro, cep_address_cache.bairro),
          localidade = coalesce(excluded.localidade, cep_address_cache.localidade),
          uf = coalesce(excluded.uf, cep_address_cache.uf),
          complemento = coalesce(excluded.complemento, cep_address_cache.complemento),
          fetched_at = now();
  end if;

  perform set_config('app.skip_cep_sync_trigger', 'on', true);

  update public.profiles p
     set cep = coalesce(v_cep_formatted, p.cep),
         address_street = coalesce(nullif(trim(p_address_street), ''), p.address_street),
         address_neighborhood = coalesce(nullif(trim(p_address_neighborhood), ''), p.address_neighborhood),
         address_city = coalesce(nullif(trim(p_address_city), ''), p.address_city),
         address_state = coalesce(nullif(trim(p_address_state), ''), p.address_state),
         address_number = coalesce(nullif(trim(p_address_number), ''), p.address_number),
         address_complement = coalesce(nullif(trim(p_address_complement), ''), p.address_complement),
         tenant_id = coalesce(p.tenant_id, v_tenant),
         updated_at = now()
   where p.id = p_profile_id
     and (p.tenant_id = v_tenant or p.tenant_id is null);

  select nullif(trim(coalesce(p.address_city, '')), '')
    into v_profile_city
    from public.profiles p
   where p.id = p_profile_id
     and (p.tenant_id = v_tenant or p.tenant_id is null);

  if v_profile_city is null
     and v_digits is not null
     and exists (
       select 1
         from pg_proc pr
         join pg_namespace n on n.oid = pr.pronamespace
        where n.nspname = 'public'
          and pr.proname = 'apply_cep_address_to_profile'
     ) then
    v_cep_sync_ok := public.apply_cep_address_to_profile(p_profile_id, true, true);
  elsif v_has_form_address then
    v_cep_sync_ok := true;
  end if;

  if v_digits is null then
    return 'Gravado em profiles e members.';
  elsif v_cep_sync_ok or v_has_form_address then
    return 'Gravado em profiles e members; endereço preenchido pelo formulário/CEP.';
  else
    return 'Gravado em profiles e members; CEP informado mas logradouro não foi resolvido (habilite extensão http no Supabase ou revise o CEP).';
  end if;
end;
$$;


-- ---------------------------------------------------------------------------
-- 10. sync_profile_address_from_cep
-- Fonte: profiles-sync-address-from-cep-rpc.sql
-- ---------------------------------------------------------------------------
create or replace function public.sync_profile_address_from_cep(
  p_profile_id uuid,
  p_actor_profile_id uuid,
  p_cep text,
  p_address_street text default null,
  p_address_neighborhood text default null,
  p_address_city text default null,
  p_address_state text default null,
  p_address_number text default null,
  p_address_complement text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
  v_digits text;
  v_formatted_cep text;
  v_updated public.profiles%rowtype;
begin
  if p_profile_id is null then
    raise exception 'Perfil não informado.';
  end if;

  if p_actor_profile_id is null then
    raise exception 'Sessão inválida. Saia e entre novamente no aplicativo.';
  end if;

  if not public.is_super_admin_profile(p_actor_profile_id) then
    if p_actor_profile_id is distinct from p_profile_id then
      raise exception 'Sem permissão para alterar o cadastro de outro usuário.';
    end if;

    if not public.profile_has_access(p_actor_profile_id, 'column', 'profiles.cep', 'update') then
      raise exception 'Você não tem permissão para alterar o CEP.';
    end if;
  end if;

  v_digits := public.normalize_profile_cep_digits(p_cep);

  if v_digits is null then
    raise exception 'CEP inválido. Informe 8 dígitos (ex.: 11677-042).';
  end if;

  v_formatted_cep := public.format_profile_cep_display(v_digits);

  insert into public.cep_address_cache (
    cep_digits,
    logradouro,
    bairro,
    localidade,
    uf,
    complemento,
    source
  )
  values (
    v_digits,
    nullif(trim(coalesce(p_address_street, '')), ''),
    nullif(trim(coalesce(p_address_neighborhood, '')), ''),
    nullif(trim(coalesce(p_address_city, '')), ''),
    nullif(trim(coalesce(p_address_state, '')), ''),
    nullif(trim(coalesce(p_address_complement, '')), ''),
    'app_viacep'
  )
  on conflict (cep_digits) do update
    set logradouro = excluded.logradouro,
        bairro = excluded.bairro,
        localidade = excluded.localidade,
        uf = excluded.uf,
        complemento = excluded.complemento,
        fetched_at = now(),
        source = excluded.source;

  perform set_config('app.skip_cep_sync_trigger', 'on', true);

  update public.profiles p
  set
    cep = v_formatted_cep,
    address_street = nullif(trim(coalesce(p_address_street, '')), ''),
    address_neighborhood = nullif(trim(coalesce(p_address_neighborhood, '')), ''),
    address_city = nullif(trim(coalesce(p_address_city, '')), ''),
    address_state = nullif(trim(coalesce(p_address_state, '')), ''),
    address_number = nullif(trim(coalesce(p_address_number, '')), ''),
    address_complement = nullif(trim(coalesce(p_address_complement, '')), ''),
    updated_at = now()
  where p.id = p_profile_id
    and p.tenant_id = v_tenant
  returning p.* into v_updated;

  if not found then
    raise exception 'Perfil não encontrado.';
  end if;

  if exists (
    select 1
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname = 'ensure_cep_geolocation'
  ) then
    execute 'select public.ensure_cep_geolocation($1, true)' using v_digits;
  end if;

  return to_jsonb(v_updated);
end;
$$;

grant execute on function public.sync_profile_address_from_cep(
  uuid, uuid, text, text, text, text, text, text, text
) to anon, authenticated;


-- ---------------------------------------------------------------------------
-- 11. refresh_profile_kids_teens_registrations
-- Fonte: member-birth-date-kids-teens-sync.sql
-- ---------------------------------------------------------------------------
create or replace function public.refresh_profile_kids_teens_registrations(
  p_profile_id uuid,
  p_birth_date date default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid := coalesce(
    public.current_session_tenant_id(),
    (select p.tenant_id from public.profiles p where p.id = p_profile_id),
    public.resolve_default_tenant_id()
  );
  v_birth_date date;
  v_kids_status text;
begin
  if p_profile_id is null or v_tenant is null then
    return;
  end if;

  select coalesce(p_birth_date, p.birth_date)
    into v_birth_date
  from public.profiles p
  where p.id = p_profile_id
    and (p.tenant_id = v_tenant or p.tenant_id is null);

  v_kids_status := public.resolve_kids_status_from_birth_date(v_birth_date);

  update public.event_registrations er
  set kids_status = v_kids_status
  where er.tenant_id = v_tenant
    and er.profile_id = p_profile_id
    and er.kids_status is distinct from v_kids_status;
end;
$$;

grant execute on function public.refresh_profile_kids_teens_registrations(uuid, date) to anon, authenticated;


-- ---------------------------------------------------------------------------
-- 12. resolve_effective_membership_dates_for_profile
-- Fonte: access-control-pastoral-congregado-membership.sql
-- ---------------------------------------------------------------------------
create or replace function public.resolve_effective_membership_dates_for_profile(p_profile_id uuid)
returns table (
  membership_date date,
  membership_out date,
  membership_inherited boolean,
  inherited_from_profile_id uuid,
  inherited_from_name text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_tenant uuid := coalesce(
    public.current_session_tenant_id(),
    (select p.tenant_id from public.profiles p where p.id = p_profile_id),
    public.resolve_default_tenant_id()
  );
  v_role text;
  v_own_date date;
  v_own_out date;
  v_guardian_id uuid;
begin
  select
    public.resolve_basic_role_code_for_profile(p.id),
    p.membership_date,
    p.membership_out
  into v_role, v_own_date, v_own_out
  from public.profiles p
  where p.id = p_profile_id
    and (v_tenant is null or p.tenant_id = v_tenant or p.tenant_id is null);

  if coalesce(v_role, '') <> 'congregado' then
    return query
    select v_own_date, v_own_out, false, null::uuid, null::text;
    return;
  end if;

  v_guardian_id := public.resolve_profile_guardian_profile_id(p_profile_id);

  if v_guardian_id is null then
    return query
    select v_own_date, v_own_out, false, null::uuid, null::text;
    return;
  end if;

  return query
  select
    gp.membership_date,
    gp.membership_out,
    true,
    gp.id,
    coalesce(nullif(trim(gp.full_name), ''), '(responsável)')
  from public.profiles gp
  where gp.id = v_guardian_id
    and (v_tenant is null or gp.tenant_id = v_tenant or gp.tenant_id is null);
end;
$$;

grant execute on function public.resolve_effective_membership_dates_for_profile(uuid) to anon, authenticated;


-- ---------------------------------------------------------------------------
-- 13. resolve_profile_guardian_profile_id
-- Fonte: access-control-pastoral-congregado-membership.sql
-- ---------------------------------------------------------------------------
create or replace function public.resolve_profile_guardian_profile_id(p_profile_id uuid)
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_tenant uuid := coalesce(
    public.current_session_tenant_id(),
    (select p.tenant_id from public.profiles p where p.id = p_profile_id),
    public.resolve_default_tenant_id()
  );
  v_guardian_id uuid;
begin
  with target as (
    select
      p.id,
      upper(nullif(trim(coalesce(p.family_id, '')), '')) as family_id
    from public.profiles p
    where p.id = p_profile_id
      and (v_tenant is null or p.tenant_id = v_tenant or p.tenant_id is null)
  )
  select gp.id
    into v_guardian_id
  from target t
  join public.members m
    on (v_tenant is null or m.tenant_id = v_tenant)
   and upper(trim(coalesce(m.family_id, ''))) = t.family_id
  join public.profiles gp
    on (v_tenant is null or gp.tenant_id = v_tenant or gp.tenant_id is null)
   and public.directory_person_matches_member(m.full_name, m.phone, gp.full_name, gp.phone)
  where t.family_id is not null
    and public.is_family_guardian_relationship(m.relationship)
    and gp.id <> t.id
  order by public.family_relationship_display_rank(m.relationship) asc, gp.full_name asc
  limit 1;

  return v_guardian_id;
end;
$$;

grant execute on function public.resolve_profile_guardian_profile_id(uuid) to anon, authenticated;


-- ---------------------------------------------------------------------------
-- 14. _maintenance_resolve_profile_guardian_profile_id
-- ---------------------------------------------------------------------------
-- SKIP: função não encontrada nos scripts/ (só resolve_profile_guardian_profile_id).


-- ---------------------------------------------------------------------------
-- 15. resolve_current_access_event_id
-- Fonte: profile-access-insights-screen-visits-patch.sql
-- ---------------------------------------------------------------------------
create or replace function public.resolve_current_access_event_id(
  p_profile_id uuid,
  p_profile_session_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $resolve_current_access_event_id$
declare
  v_tenant uuid := coalesce(
    public.current_session_tenant_id(),
    (select p.tenant_id from public.profiles p where p.id = p_profile_id),
    public.resolve_default_tenant_id()
  );
  v_access_event_id uuid;
begin
  if p_profile_id is null or v_tenant is null then
    return null;
  end if;

  if p_profile_session_id is not null then
    select e.id
      into v_access_event_id
      from public.profile_app_access_events e
     where e.tenant_id = v_tenant
       and e.profile_session_id = p_profile_session_id
     order by e.accessed_at desc
     limit 1;

    if v_access_event_id is not null then
      return v_access_event_id;
    end if;

    insert into public.profile_app_access_events (profile_id, profile_session_id, accessed_at, tenant_id)
    select ps.profile_id, ps.id, ps.created_at, v_tenant
      from public.profile_sessions ps
     where ps.id = p_profile_session_id
       and (ps.tenant_id = v_tenant or ps.tenant_id is null)
     returning id into v_access_event_id;

    return v_access_event_id;
  end if;

  select e.id
    into v_access_event_id
    from public.profile_app_access_events e
   where e.tenant_id = v_tenant
     and e.profile_id = p_profile_id
   order by e.accessed_at desc
   limit 1;

  return v_access_event_id;
end;
$resolve_current_access_event_id$;


-- ---------------------------------------------------------------------------
-- 16. resolve_profile_id_for_media_authorization
-- Fonte: media-authorization-rpc.sql
-- ---------------------------------------------------------------------------
create or replace function public.resolve_profile_id_for_media_authorization()
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_tenant uuid := coalesce(
    public.current_session_tenant_id(),
    public.resolve_default_tenant_id()
  );
  v_headers text;
  v_token text;
  v_raw text;
  v_profile_id uuid;
begin
  begin
    v_headers := current_setting('request.headers', true);
  exception
    when others then
      return null;
  end;

  if v_headers is null or v_headers = '' then
    return null;
  end if;

  v_token := nullif(trim(coalesce((v_headers::json ->> 'x-session-token'), '')), '');

  if v_token is not null then
    v_profile_id := public.resolve_profile_session_token(v_token);

    if v_profile_id is not null then
      if v_tenant is null
         or exists (
           select 1 from public.profiles p
            where p.id = v_profile_id
              and (p.tenant_id = v_tenant or p.tenant_id is null)
         )
      then
        return v_profile_id;
      end if;
      return null;
    end if;
  end if;

  v_raw := nullif(trim(coalesce((v_headers::json ->> 'x-profile-id'), '')), '');

  if v_raw is null then
    return null;
  end if;

  begin
    v_profile_id := v_raw::uuid;
  exception
    when invalid_text_representation then
      return null;
  end;

  if exists (
    select 1 from public.profiles p
     where p.id = v_profile_id
       and (v_tenant is null or p.tenant_id = v_tenant or p.tenant_id is null)
  ) then
    return v_profile_id;
  end if;

  return null;
end;
$$;


-- ---------------------------------------------------------------------------
-- 17. garantir_ordem_sequencial_voluntario
-- Fonte: access-control-lider-escala.sql
-- ---------------------------------------------------------------------------
create or replace function public.garantir_ordem_sequencial_voluntario(
  p_tipo_escala_id uuid,
  p_voluntario_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
  v_ordem integer;
  v_proxima integer;
begin
  if not public.profile_has_scale_type_access(public.current_session_profile_id(), p_tipo_escala_id, 'update') then
    return jsonb_build_object('success', false, 'message', 'Sem permissão para este tipo de escala.');
  end if;

  if p_tipo_escala_id is null or p_voluntario_id is null then
    return jsonb_build_object('success', false, 'message', 'Parâmetros inválidos.');
  end if;

  select ve.ordem_sequencial
    into v_ordem
    from public.voluntarios_escala ve
   where ve.tenant_id = v_tenant
     and ve.id = p_voluntario_id
     and ve.tipo_escala_id = p_tipo_escala_id;

  if not found then
    return jsonb_build_object('success', false, 'message', 'Servo não encontrado.');
  end if;

  if v_ordem is not null then
    return jsonb_build_object('success', true, 'ordem_sequencial', v_ordem, 'message', 'Ordem sequencial já definida.');
  end if;

  select coalesce(max(ve.ordem_sequencial), 0) + 1
    into v_proxima
    from public.voluntarios_escala ve
   where ve.tenant_id = v_tenant
     and ve.tipo_escala_id = p_tipo_escala_id;

  update public.voluntarios_escala ve
  set ordem_sequencial = v_proxima
  where ve.tenant_id = v_tenant
    and ve.id = p_voluntario_id
    and ve.tipo_escala_id = p_tipo_escala_id;

  return jsonb_build_object('success', true, 'ordem_sequencial', v_proxima, 'message', 'Ordem sequencial atribuída.');
end;
$$;

grant execute on function public.garantir_ordem_sequencial_voluntario(uuid, uuid) to anon, authenticated;


-- ---------------------------------------------------------------------------
-- 18. geo_checkin_hours_before
-- Fonte: geo-checkin-geofence-tempo-patch.sql
-- ---------------------------------------------------------------------------
create or replace function public.geo_checkin_hours_before()
returns integer
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_tenant uuid := coalesce(
    public.current_session_tenant_id(),
    public.resolve_default_tenant_id()
  );
  v_value integer;
begin
  if v_tenant is null then
    return 0;
  end if;

  select case
    when trim(ap.value) ~ '^\d+$' then trim(ap.value)::integer
    else null
  end
    into v_value
  from public.app_parameters ap
  where ap.tenant_id = v_tenant
    and lower(ap.parameter) = 'check_in_geofence_tempo'
  limit 1;

  return coalesce(v_value, 0);
end;
$$;

grant execute on function public.geo_checkin_hours_before() to anon, authenticated;


-- ---------------------------------------------------------------------------
-- 19. geo_checkin_radius_meters
-- Fonte: geo-checkin-automatic.sql
-- ---------------------------------------------------------------------------
create or replace function public.geo_checkin_radius_meters()
returns double precision
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_tenant uuid := coalesce(
    public.current_session_tenant_id(),
    public.resolve_default_tenant_id()
  );
  v_value double precision;
begin
  if v_tenant is null then
    return 30.0;
  end if;

  select case
    when trim(ap.value) ~ '^\d+(\.\d+)?$' then trim(ap.value)::double precision
    else null
  end
    into v_value
  from public.app_parameters ap
  where ap.tenant_id = v_tenant
    and lower(ap.parameter) = 'check_in_geofence_raio_metros'
  limit 1;

  return coalesce(v_value, 30.0);
end;
$$;

grant execute on function public.geo_checkin_radius_meters() to anon, authenticated;


-- ---------------------------------------------------------------------------
-- 20. get_family_id_prefix
-- Fonte: register-member-atomic.sql
-- ---------------------------------------------------------------------------
create or replace function public.get_family_id_prefix()
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_tenant uuid := coalesce(
    public.current_session_tenant_id(),
    public.resolve_default_tenant_id()
  );
  v_raw text;
  v_clean text;
begin
  if v_tenant is not null then
    select trim(ap.value)
    into v_raw
    from public.app_parameters ap
    where ap.tenant_id = v_tenant
      and lower(ap.parameter) = 'parm_entidade'
    limit 1;
  end if;

  v_clean := upper(regexp_replace(coalesce(v_raw, ''), '[^A-Za-z0-9]', '', 'g'));
  if v_clean is null or v_clean = '' then
    return 'IBN';
  end if;

  return v_clean;
end;
$$;

grant execute on function public.get_family_id_prefix() to anon;
grant execute on function public.get_family_id_prefix() to authenticated;


-- ---------------------------------------------------------------------------
-- 21. resolve_kids_status_from_birth_date
-- Fonte: member-birth-date-kids-teens-sync.sql / register-member-atomic.sql
-- ---------------------------------------------------------------------------
create or replace function public.resolve_kids_status_from_birth_date(p_birth_date date)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_tenant uuid := coalesce(
    public.current_session_tenant_id(),
    public.resolve_default_tenant_id()
  );
  v_age_years integer;
  v_idade_kids integer;
  v_idade_teens integer;
begin
  if p_birth_date is null then
    return null;
  end if;

  if v_tenant is not null then
    select
      case when trim(ap.value) ~ '^\d+$' then trim(ap.value)::integer else null end
      into v_idade_kids
    from public.app_parameters ap
    where ap.tenant_id = v_tenant
      and lower(ap.parameter) = 'idade_kids'
    limit 1;

    select
      case when trim(ap.value) ~ '^\d+$' then trim(ap.value)::integer else null end
      into v_idade_teens
    from public.app_parameters ap
    where ap.tenant_id = v_tenant
      and lower(ap.parameter) = 'idade_teens'
    limit 1;
  end if;

  v_age_years := extract(year from age(current_date, p_birth_date::date))::integer;

  if v_idade_kids is not null and v_age_years <= v_idade_kids then
    return 'KIDS';
  end if;

  if
    v_idade_kids is not null
    and v_idade_teens is not null
    and v_age_years > v_idade_kids
    and v_age_years <= v_idade_teens
  then
    return 'TEENS';
  end if;

  return null;
end;
$$;

grant execute on function public.resolve_kids_status_from_birth_date(date) to anon, authenticated;


-- ---------------------------------------------------------------------------
-- 22–25. E-mail helpers
-- Fonte: media-authorization-rpc.sql
-- Leituras de app_parameters via get_app_parameter_value (já tenant em wave2c).
-- send_resend / gmail: leitura direta com coalesce(session, default).
-- ---------------------------------------------------------------------------
create or replace function public.send_resend_transactional_email(
  p_to_email text,
  p_subject text,
  p_text text
)
returns jsonb
language plpgsql
security definer
set search_path = http, extensions, public, pg_temp
as $$
declare
  v_tenant uuid := coalesce(
    public.current_session_tenant_id(),
    public.resolve_default_tenant_id()
  );
  v_api_key text;
  v_from text;
  v_body text;
  v_status integer;
  v_content text;
  v_recipient text;
  v_payload jsonb;
begin
  if v_tenant is null then
    raise exception 'Tenant padrão não encontrado.';
  end if;

  v_recipient := public.normalize_profile_email(p_to_email);

  select nullif(trim(ap.value), '')
    into v_api_key
  from public.app_parameters ap
  where ap.tenant_id = v_tenant
    and lower(trim(ap.parameter)) = 'recovery_email_api_key'
  limit 1;

  select nullif(trim(ap.value), '')
    into v_from
  from public.app_parameters ap
  where ap.tenant_id = v_tenant
    and lower(trim(ap.parameter)) = 'recovery_email_from'
  limit 1;

  if v_api_key is null or v_from is null then
    raise exception
      'Resend não configurado. Cadastre recovery_email_api_key e recovery_email_from em app_parameters.';
  end if;

  v_body := json_build_object(
    'from', v_from,
    'to', json_build_array(v_recipient),
    'subject', trim(p_subject),
    'text', p_text
  )::text;

  select p.p_status, p.p_content
    into v_status, v_content
    from public.password_recovery_http_post(
      'https://api.resend.com/emails',
      jsonb_build_object(
        'authorization', 'Bearer ' || v_api_key,
        'content-type', 'application/json'
      ),
      v_body
    ) as p;

  if coalesce(v_status, 0) not between 200 and 299 then
    raise exception
      'Não foi possível enviar o e-mail (HTTP %). %',
      coalesce(v_status, 0),
      coalesce(nullif(trim(v_content), ''), 'Verifique recovery_email_api_key e recovery_email_from no Resend.');
  end if;

  begin
    v_payload := v_content::jsonb;
  exception
    when others then
      v_payload := jsonb_build_object('raw', v_content);
  end;

  return jsonb_build_object(
    'ok', true,
    'provider', 'resend',
    'resendId', coalesce(v_payload->>'id', null),
    'to', v_recipient
  );
end;
$$;


create or replace function public.send_media_authorization_confirm_email_via_gmail(
  p_to_email text,
  p_full_name text,
  p_confirm_url text
)
returns jsonb
language plpgsql
security definer
set search_path = http, extensions, public, pg_temp
as $$
declare
  v_tenant uuid := coalesce(
    public.current_session_tenant_id(),
    public.resolve_default_tenant_id()
  );
  v_smtp_user text;
  v_smtp_password text;
  v_from text;
  v_function_url text;
  v_function_secret text;
  v_body text;
  v_status integer;
  v_content text;
  v_recipient text;
  v_payload jsonb;
begin
  if v_tenant is null then
    raise exception 'Tenant padrão não encontrado.';
  end if;

  v_recipient := public.normalize_profile_email(p_to_email);

  select nullif(trim(ap.value), '') into v_smtp_user
    from public.app_parameters ap
   where ap.tenant_id = v_tenant and lower(trim(ap.parameter)) = 'recovery_email_smtp_user'
   limit 1;
  select nullif(trim(ap.value), '') into v_smtp_password
    from public.app_parameters ap
   where ap.tenant_id = v_tenant and lower(trim(ap.parameter)) = 'recovery_email_smtp_password'
   limit 1;
  select nullif(trim(ap.value), '') into v_from
    from public.app_parameters ap
   where ap.tenant_id = v_tenant and lower(trim(ap.parameter)) = 'recovery_email_from'
   limit 1;
  select nullif(trim(ap.value), '') into v_function_url
    from public.app_parameters ap
   where ap.tenant_id = v_tenant and lower(trim(ap.parameter)) = 'recovery_email_function_url'
   limit 1;
  select nullif(trim(ap.value), '') into v_function_secret
    from public.app_parameters ap
   where ap.tenant_id = v_tenant and lower(trim(ap.parameter)) = 'recovery_email_function_secret'
   limit 1;

  if v_smtp_user is null
     or v_smtp_password is null
     or v_from is null
     or v_function_url is null
     or v_function_secret is null then
    raise exception
      'Gmail não configurado. Cadastre recovery_email_smtp_user, recovery_email_smtp_password, recovery_email_from, recovery_email_function_url e recovery_email_function_secret em app_parameters.';
  end if;

  v_body := json_build_object(
    'secret', v_function_secret,
    'smtp_user', v_smtp_user,
    'smtp_password', v_smtp_password,
    'from', v_from,
    'to', v_recipient,
    'subject', public.media_authorization_confirm_email_subject(),
    'text', public.media_authorization_confirm_email_text(p_full_name, p_confirm_url)
  )::text;

  select p.p_status, p.p_content
    into v_status, v_content
    from public.password_recovery_http_post(
      v_function_url,
      jsonb_build_object('content-type', 'application/json'),
      v_body
    ) as p;

  if coalesce(v_status, 0) not between 200 and 299 then
    raise exception
      'Não foi possível acionar o envio Gmail (HTTP %). %',
      coalesce(v_status, 0),
      coalesce(nullif(trim(v_content), ''), 'Verifique a Edge Function send-password-recovery-email.');
  end if;

  begin
    v_payload := v_content::jsonb;
  exception
    when others then
      raise exception
        'Resposta inválida da Edge Function Gmail: %',
        coalesce(nullif(trim(v_content), ''), 'sem conteúdo');
  end;

  if coalesce(v_payload->>'ok', '') <> 'true' then
    raise exception
      'Não foi possível enviar o e-mail de autorização via Gmail. %',
      coalesce(nullif(trim(v_payload->>'message'), ''), v_content);
  end if;

  return jsonb_build_object(
    'ok', true,
    'provider', 'gmail',
    'to', v_recipient
  );
end;
$$;


create or replace function public.send_media_authorization_confirm_email(
  p_to_email text,
  p_full_name text,
  p_confirm_url text
)
returns jsonb
language plpgsql
security definer
set search_path = http, extensions, public, pg_temp
as $$
declare
  v_tenant uuid := coalesce(
    public.current_session_tenant_id(),
    public.resolve_default_tenant_id()
  );
  v_recipient text;
  v_provider text;
  v_has_gmail boolean;
  v_has_resend boolean;
  v_result jsonb;
begin
  if v_tenant is null then
    raise exception 'Tenant padrão não encontrado.';
  end if;

  v_recipient := public.normalize_profile_email(p_to_email);

  if v_recipient is null or not public.is_valid_profile_email(v_recipient) then
    raise exception 'E-mail inválido para envio.';
  end if;

  -- get_app_parameter_value (wave2c) já filtra por coalesce(session, default).
  v_provider := lower(nullif(trim(public.get_app_parameter_value('recovery_email_provider')), ''));

  v_has_gmail :=
    nullif(trim(public.get_app_parameter_value('recovery_email_smtp_user')), '') is not null
    and nullif(trim(public.get_app_parameter_value('recovery_email_smtp_password')), '') is not null
    and nullif(trim(public.get_app_parameter_value('recovery_email_from')), '') is not null
    and nullif(trim(public.get_app_parameter_value('recovery_email_function_url')), '') is not null
    and nullif(trim(public.get_app_parameter_value('recovery_email_function_secret')), '') is not null;

  v_has_resend :=
    nullif(trim(public.get_app_parameter_value('recovery_email_api_key')), '') is not null
    and nullif(trim(public.get_app_parameter_value('recovery_email_from')), '') is not null;

  if v_provider is null then
    if v_has_gmail then
      v_provider := 'gmail';
    elsif v_has_resend then
      v_provider := 'resend';
    else
      raise exception
        'Envio de e-mail não configurado. Defina recovery_email_provider=gmail ou resend e os parâmetros correspondentes em app_parameters.';
    end if;
  end if;

  if v_provider = 'gmail' then
    v_result := public.send_media_authorization_confirm_email_via_gmail(p_to_email, p_full_name, p_confirm_url);
    return v_result;
  end if;

  if v_provider = 'resend' then
    v_result := public.send_media_authorization_confirm_email_via_resend(p_to_email, p_full_name, p_confirm_url);
    return v_result;
  end if;

  raise exception
    'recovery_email_provider inválido: %. Use gmail ou resend.',
    v_provider;
end;
$$;

grant execute on function public.send_media_authorization_confirm_email(text, text, text) to anon, authenticated;


create or replace function public.send_media_authorization_pending_email(
  p_to_email text,
  p_full_name text,
  p_confirm_url text
)
returns jsonb
language plpgsql
security definer
set search_path = http, extensions, public, pg_temp
as $$
declare
  v_tenant uuid := coalesce(
    public.current_session_tenant_id(),
    public.resolve_default_tenant_id()
  );
  v_recipient text;
  v_provider text;
  v_has_gmail boolean;
  v_has_resend boolean;
begin
  if v_tenant is null then
    raise exception 'Tenant padrão não encontrado.';
  end if;

  v_recipient := public.normalize_profile_email(p_to_email);

  if v_recipient is null or not public.is_valid_profile_email(v_recipient) then
    raise exception 'E-mail inválido para envio.';
  end if;

  v_provider := lower(nullif(trim(public.get_app_parameter_value('recovery_email_provider')), ''));

  v_has_gmail :=
    nullif(trim(public.get_app_parameter_value('recovery_email_smtp_user')), '') is not null
    and nullif(trim(public.get_app_parameter_value('recovery_email_smtp_password')), '') is not null
    and nullif(trim(public.get_app_parameter_value('recovery_email_from')), '') is not null
    and nullif(trim(public.get_app_parameter_value('recovery_email_function_url')), '') is not null
    and nullif(trim(public.get_app_parameter_value('recovery_email_function_secret')), '') is not null;

  v_has_resend :=
    nullif(trim(public.get_app_parameter_value('recovery_email_api_key')), '') is not null
    and nullif(trim(public.get_app_parameter_value('recovery_email_from')), '') is not null;

  if v_provider is null then
    if v_has_resend then
      v_provider := 'resend';
    elsif v_has_gmail then
      v_provider := 'gmail';
    else
      raise exception
        'Envio de e-mail não configurado. Defina recovery_email_provider=gmail ou resend e os parâmetros correspondentes em app_parameters.';
    end if;
  end if;

  if v_provider = 'gmail' then
    return public.send_media_authorization_confirm_email_via_gmail(p_to_email, p_full_name, p_confirm_url);
  end if;

  if v_has_resend then
    return public.send_resend_transactional_email(
      p_to_email,
      public.media_authorization_confirm_email_subject(),
      public.media_authorization_confirm_email_text(p_full_name, p_confirm_url)
    );
  end if;

  raise exception
    'recovery_email_provider inválido: %. Use gmail ou resend.',
    v_provider;
end;
$$;

grant execute on function public.send_media_authorization_pending_email(text, text, text) to anon, authenticated;


-- ---------------------------------------------------------------------------
-- 26. _report_demographic_family(p_params)
-- ---------------------------------------------------------------------------
-- SKIP: não existe em maintenance-reports; só _report_demographic_family_size
-- (já patchado em multi-tenant-wave2d-reports.sql).


-- ---------------------------------------------------------------------------
-- 27. list_profiles_visitantes_only_flags
-- Fonte: access-control-security-hardening.sql
-- ---------------------------------------------------------------------------
create or replace function public.list_profiles_visitantes_only_flags()
returns table (
  profile_id uuid,
  is_visitantes_only boolean,
  role_label text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
begin
  if not public.session_has_screen_access('/mapa-geolocalizacao', 'view') then
    return;
  end if;

  return query
  select
    p.id as profile_id,
    public.profile_is_visitantes_only(p.id) as is_visitantes_only,
    public.profile_map_role_label(p.id) as role_label
  from public.profiles p
  where p.tenant_id = v_tenant;
end;
$$;

grant execute on function public.list_profiles_visitantes_only_flags() to anon, authenticated;


-- ---------------------------------------------------------------------------
-- 28. listar_datas_membresia_modelo_preditivo
-- Fonte: access-control-predictive-insights.sql
-- ---------------------------------------------------------------------------
create or replace function public.listar_datas_membresia_modelo_preditivo(
  p_actor_profile_id uuid
)
returns table (
  membership_date date,
  membership_out date
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
begin
  perform public.assert_predictive_insights_actor(p_actor_profile_id);

  return query
  select p.membership_date, p.membership_out
    from public.profiles p
   where p.tenant_id = v_tenant
     and (p.membership_date is not null or p.membership_out is not null);
end;
$$;

grant execute on function public.listar_datas_membresia_modelo_preditivo(uuid) to anon, authenticated;


-- ---------------------------------------------------------------------------
-- 29. listar_receita_ordinaria_modelo_preditivo
-- Fonte: access-control-predictive-insights.sql
-- ---------------------------------------------------------------------------
create or replace function public.listar_receita_ordinaria_modelo_preditivo(
  p_actor_profile_id uuid,
  p_end_date date default current_date
)
returns table (
  id uuid,
  transaction_date date,
  account text,
  amount numeric,
  ministry text,
  transaction_kind text,
  movement text,
  budget_version text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
begin
  perform public.assert_predictive_insights_actor(p_actor_profile_id);

  return query
  select
    f.id,
    f.transaction_date,
    f.account,
    f.amount,
    f.ministry,
    f.transaction_kind,
    f.movement,
    f.budget_version
    from public.financials f
   where f.tenant_id = v_tenant
     and f.transaction_date <= coalesce(p_end_date, current_date)
     and upper(trim(coalesce(f.budget_version, ''))) like '%REALIZ%'
     and upper(translate(trim(coalesce(f.transaction_kind, '')), 'ÁÀÂÃÉÈÊÍÌÎÓÒÔÕÚÙÛÇ', 'AAAAEEEIIIOOOOUUUC')) in ('ENTRADAS', 'ENTRADA')
     and upper(translate(trim(coalesce(f.movement, '')), 'ÁÀÂÃÉÈÊÍÌÎÓÒÔÕÚÙÛÇ', 'AAAAEEEIIIOOOOUUUC')) like '%ORDIN%'
     and upper(translate(trim(coalesce(f.movement, '')), 'ÁÀÂÃÉÈÊÍÌÎÓÒÔÕÚÙÛÇ', 'AAAAEEEIIIOOOOUUUC')) not like '%EXTRAORDIN%'
     and (
       upper(translate(trim(coalesce(f.ministry, '')), 'ÁÀÂÃÉÈÊÍÌÎÓÒÔÕÚÙÛÇ', 'AAAAEEEIIIOOOOUUUC')) = 'OFERTAS'
       or upper(translate(trim(coalesce(f.ministry, '')), 'ÁÀÂÃÉÈÊÍÌÎÓÒÔÕÚÙÛÇ', 'AAAAEEEIIIOOOOUUUC')) like '%DIZIM%'
     )
   order by f.transaction_date asc;
end;
$$;

grant execute on function public.listar_receita_ordinaria_modelo_preditivo(uuid, date) to anon, authenticated;


-- ---------------------------------------------------------------------------
-- 30. get_scale_cycle_context
-- ---------------------------------------------------------------------------
-- SKIP: já patchado em multi-tenant-wave4b-geofence-quorum.sql.


-- ---------------------------------------------------------------------------
-- 31. set_active_paleta / set_active_paleta_by_nome
-- Fonte: paletas-table.sql
-- ---------------------------------------------------------------------------
create or replace function public.set_active_paleta(p_paleta_id uuid)
returns public.paletas
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
  v_row public.paletas%rowtype;
begin
  if p_paleta_id is null then
    raise exception 'Informe o id da paleta.';
  end if;

  select *
    into v_row
    from public.paletas p
   where p.tenant_id = v_tenant
     and p.id = p_paleta_id;

  if not found then
    raise exception 'Paleta não encontrada.';
  end if;

  update public.paletas
     set is_active = false
   where tenant_id = v_tenant
     and is_active;

  update public.paletas
     set is_active = true
   where tenant_id = v_tenant
     and id = p_paleta_id
  returning * into v_row;

  return v_row;
end;
$$;

create or replace function public.set_active_paleta_by_nome(p_nome text)
returns public.paletas
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
  v_id uuid;
begin
  select p.id
    into v_id
    from public.paletas p
   where p.tenant_id = v_tenant
     and lower(trim(p.nome)) = lower(trim(coalesce(p_nome, '')))
   limit 1;

  if v_id is null then
    raise exception 'Paleta "%" não encontrada.', coalesce(p_nome, '');
  end if;

  return public.set_active_paleta(v_id);
end;
$$;

grant execute on function public.set_active_paleta(uuid) to anon, authenticated;
grant execute on function public.set_active_paleta_by_nome(text) to anon, authenticated;


-- ---------------------------------------------------------------------------
-- 32. sync_scale_type_access_resource / sync_all_scale_type_access_resources
-- Fonte: access-control-lider-escala.sql
-- access_resources é catálogo global; access_grants é por tenant.
-- ---------------------------------------------------------------------------
create or replace function public.sync_scale_type_access_resource(
  p_codigo text,
  p_nome text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid := coalesce(
    public.current_session_tenant_id(),
    public.resolve_default_tenant_id()
  );
  v_codigo text;
  v_key text;
begin
  v_codigo := lower(trim(coalesce(p_codigo, '')));

  if v_codigo = '' then
    return;
  end if;

  v_key := public.scale_type_resource_key(v_codigo);

  if v_codigo like 'tstmax%' then
    if v_tenant is not null then
      delete from public.access_grants g
       using public.access_resources res
       where g.tenant_id = v_tenant
         and g.resource_id = res.id
         and res.resource_type = 'screen'
         and res.resource_key = v_key;
    end if;

    -- Catálogo global: desativa o recurso de tela do tipo tstmax.
    update public.access_resources
       set is_active = false
     where resource_type = 'screen'
       and resource_key = v_key;

    return;
  end if;

  insert into public.access_resources (resource_type, resource_key, label, description)
  values (
    'screen',
    v_key,
    'Escala: ' || coalesce(nullif(trim(p_nome), ''), v_codigo),
    'Permissão por tipo de escala'
  )
  on conflict (resource_type, resource_key) do update
    set label = excluded.label,
        description = excluded.description,
        is_active = true;
end;
$$;

create or replace function public.sync_all_scale_type_access_resources()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid := coalesce(
    public.current_session_tenant_id(),
    public.resolve_default_tenant_id()
  );
  v_row record;
begin
  for v_row in
    select te.codigo, te.nome
      from public.tipos_escala te
     where v_tenant is null or te.tenant_id = v_tenant
  loop
    perform public.sync_scale_type_access_resource(v_row.codigo, v_row.nome);
  end loop;
end;
$$;


-- ---------------------------------------------------------------------------
-- 33. can_view_maintenance_support_request
-- Fonte: maintenance-support-suggestions.sql
-- ---------------------------------------------------------------------------
create or replace function public.can_view_maintenance_support_request(p_request_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.maintenance_support_requests r
     where r.id = p_request_id
       and r.tenant_id = public.require_session_tenant_id()
       and (
         r.requester_profile_id = public.current_session_profile_id()
         or public.can_manage_maintenance_support()
         or public.session_has_screen_access('maintenance.card.suggestions_improvements', 'view')
       )
  );
$$;

grant execute on function public.can_view_maintenance_support_request(uuid) to anon, authenticated;


-- ---------------------------------------------------------------------------
-- 34. record_profile_app_access(p_profile_id) overload
-- ---------------------------------------------------------------------------
-- SKIP: overload único (uuid, uuid default null, timestamptz default now())
-- já patchado com tenant em multi-tenant-wave3a-acl-ghost.sql.


notify pgrst, 'reload schema';

commit;
