-- =============================================================================
-- Multi-tenant isolation hardening (P0/P1)
-- =============================================================================
-- Corrige regressões pós wave3a (scripts de Gestor sem filtro de tenant) e
-- isola Storage por tenant (legado via join nas linhas; novos paths com prefixo).
--
-- Proteção mantida: Gestor não vê Super Administrador
--   (profile_visible_to_access_actor / assert_gestor_super_admin_shield)
-- =============================================================================

begin;

-- ---------------------------------------------------------------------------
-- Helper: objeto Storage pertence ao tenant da sessão
-- ---------------------------------------------------------------------------
create or replace function public.storage_object_matches_session_tenant(
  p_bucket text,
  p_name text
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $fn$
declare
  v_tenant uuid := public.current_session_tenant_id();
  v_parts text[];
  v_fin uuid;
  v_report uuid;
begin
  if v_tenant is null or nullif(trim(coalesce(p_bucket, '')), '') is null
     or nullif(trim(coalesce(p_name, '')), '') is null then
    return false;
  end if;

  v_parts := storage.foldername(p_name);

  -- Novo padrão: {tenant_id}/...
  if coalesce(array_length(v_parts, 1), 0) >= 1
     and v_parts[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  then
    return v_parts[1]::uuid = v_tenant;
  end if;

  if p_bucket = 'financial-docs' then
    -- Legado: receipts/rd/{report_id}/...
    if coalesce(array_length(v_parts, 1), 0) >= 3
       and v_parts[1] = 'receipts'
       and v_parts[2] = 'rd'
    then
      begin
        v_report := v_parts[3]::uuid;
      exception
        when others then
          return false;
      end;

      return exists (
        select 1
          from public.expense_reports r
         where r.id = v_report
           and r.tenant_id = v_tenant
      );
    end if;

    -- Legado: receipts/{financial_id}/...
    if coalesce(array_length(v_parts, 1), 0) >= 2 and v_parts[1] = 'receipts' then
      begin
        v_fin := v_parts[2]::uuid;
      exception
        when others then
          return false;
      end;

      return exists (
        select 1
          from public.financials f
         where f.id = v_fin
           and f.tenant_id = v_tenant
      );
    end if;

    return false;
  end if;

  if p_bucket = 'assembly-minutes' then
    return exists (
      select 1
        from public.maintenance_assembly_minutes m
       where m.storage_path = p_name
         and m.tenant_id = v_tenant
    );
  end if;

  if p_bucket = 'maintenance-support' then
    return exists (
      select 1
        from public.maintenance_support_attachments a
       where a.storage_path = p_name
         and a.tenant_id = v_tenant
         and coalesce(a.is_active, true)
    );
  end if;

  return false;
end;
$fn$;

revoke all on function public.storage_object_matches_session_tenant(text, text) from public;
grant execute on function public.storage_object_matches_session_tenant(text, text)
  to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Storage policies (financial-docs)
-- ---------------------------------------------------------------------------
drop policy if exists financial_docs_select on storage.objects;
drop policy if exists financial_docs_insert on storage.objects;
drop policy if exists financial_docs_update on storage.objects;
drop policy if exists financial_docs_delete on storage.objects;
drop policy if exists "Finance-Docs-View-Policy" on storage.objects;
drop policy if exists "Finance-Docs-Upload-Policy" on storage.objects;
drop policy if exists "Finance-Docs-Delete-Policy" on storage.objects;

create policy financial_docs_select
  on storage.objects
  for select
  to anon, authenticated
  using (
    bucket_id = 'financial-docs'
    and public.session_has_resource_access('table', 'financials', 'view')
    and public.storage_object_matches_session_tenant(bucket_id, name)
  );

create policy financial_docs_insert
  on storage.objects
  for insert
  to anon, authenticated
  with check (
    bucket_id = 'financial-docs'
    and public.session_has_resource_access('table', 'financials', 'update')
    and public.storage_object_matches_session_tenant(bucket_id, name)
  );

create policy financial_docs_update
  on storage.objects
  for update
  to anon, authenticated
  using (
    bucket_id = 'financial-docs'
    and public.session_has_resource_access('table', 'financials', 'update')
    and public.storage_object_matches_session_tenant(bucket_id, name)
  )
  with check (
    bucket_id = 'financial-docs'
    and public.session_has_resource_access('table', 'financials', 'update')
    and public.storage_object_matches_session_tenant(bucket_id, name)
  );

create policy financial_docs_delete
  on storage.objects
  for delete
  to anon, authenticated
  using (
    bucket_id = 'financial-docs'
    and public.session_has_resource_access('table', 'financials', 'update')
    and public.storage_object_matches_session_tenant(bucket_id, name)
  );

-- ---------------------------------------------------------------------------
-- Storage policies (assembly-minutes)
-- ---------------------------------------------------------------------------
drop policy if exists assembly_minutes_storage_select on storage.objects;
drop policy if exists assembly_minutes_storage_insert on storage.objects;
drop policy if exists assembly_minutes_storage_update on storage.objects;
drop policy if exists assembly_minutes_storage_delete on storage.objects;

create policy assembly_minutes_storage_select
  on storage.objects
  for select
  to anon, authenticated
  using (
    bucket_id = 'assembly-minutes'
    and (
      public.session_has_screen_access('dashboard.card.administrativo', 'view')
      or public.session_has_screen_access('maintenance.card.financials', 'view')
      or public.can_manage_maintenance_support()
    )
    and (
      public.storage_object_matches_session_tenant(bucket_id, name)
      -- Upload inicial antes do insert na tabela: prefixo tenant obrigatório
      or (
        coalesce((storage.foldername(name))[1], '') = public.current_session_tenant_id()::text
      )
    )
  );

create policy assembly_minutes_storage_insert
  on storage.objects
  for insert
  to anon, authenticated
  with check (
    bucket_id = 'assembly-minutes'
    and (
      public.session_has_screen_access('maintenance.card.financials', 'update')
      or public.can_manage_maintenance_support()
    )
    and coalesce((storage.foldername(name))[1], '') = public.current_session_tenant_id()::text
  );

create policy assembly_minutes_storage_update
  on storage.objects
  for update
  to anon, authenticated
  using (
    bucket_id = 'assembly-minutes'
    and (
      public.session_has_screen_access('maintenance.card.financials', 'update')
      or public.can_manage_maintenance_support()
    )
    and public.storage_object_matches_session_tenant(bucket_id, name)
  )
  with check (
    bucket_id = 'assembly-minutes'
    and (
      public.session_has_screen_access('maintenance.card.financials', 'update')
      or public.can_manage_maintenance_support()
    )
    and (
      public.storage_object_matches_session_tenant(bucket_id, name)
      or coalesce((storage.foldername(name))[1], '') = public.current_session_tenant_id()::text
    )
  );

create policy assembly_minutes_storage_delete
  on storage.objects
  for delete
  to anon, authenticated
  using (
    bucket_id = 'assembly-minutes'
    and (
      public.session_has_screen_access('maintenance.card.financials', 'update')
      or public.can_manage_maintenance_support()
    )
    and public.storage_object_matches_session_tenant(bucket_id, name)
  );

-- ---------------------------------------------------------------------------
-- Storage policies (maintenance-support)
-- ---------------------------------------------------------------------------
drop policy if exists maintenance_support_storage_select on storage.objects;
drop policy if exists maintenance_support_storage_insert on storage.objects;
drop policy if exists maintenance_support_storage_update on storage.objects;
drop policy if exists maintenance_support_storage_delete on storage.objects;

create policy maintenance_support_storage_select
  on storage.objects
  for select
  to anon, authenticated
  using (
    bucket_id = 'maintenance-support'
    and (
      public.storage_object_matches_session_tenant(bucket_id, name)
      or coalesce((storage.foldername(name))[1], '') = public.current_session_tenant_id()::text
    )
  );

create policy maintenance_support_storage_insert
  on storage.objects
  for insert
  to anon, authenticated
  with check (
    bucket_id = 'maintenance-support'
    and coalesce((storage.foldername(name))[1], '') = public.current_session_tenant_id()::text
  );

create policy maintenance_support_storage_update
  on storage.objects
  for update
  to anon, authenticated
  using (
    bucket_id = 'maintenance-support'
    and public.storage_object_matches_session_tenant(bucket_id, name)
  )
  with check (
    bucket_id = 'maintenance-support'
    and (
      public.storage_object_matches_session_tenant(bucket_id, name)
      or coalesce((storage.foldername(name))[1], '') = public.current_session_tenant_id()::text
    )
  );

create policy maintenance_support_storage_delete
  on storage.objects
  for delete
  to anon, authenticated
  using (
    bucket_id = 'maintenance-support'
    and public.storage_object_matches_session_tenant(bucket_id, name)
  );

-- ---------------------------------------------------------------------------
-- Controle de Acesso — listagens/escritas com tenant + shield do Gestor
-- Proteção aplicada: Gestor não tem visibilidade do Super Administrador
-- ---------------------------------------------------------------------------

create or replace function public.buscar_perfis_access_admin(
  p_actor_profile_id uuid,
  p_query text,
  p_limit integer default 20
)
returns table (
  id uuid,
  full_name text,
  phone text,
  codigo_membro text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
  v_query text;
  v_digits text;
  v_limit integer;
begin
  perform public.assert_access_admin(p_actor_profile_id);

  v_query := trim(coalesce(p_query, ''));
  v_digits := regexp_replace(v_query, '\D', '', 'g');
  v_limit := greatest(1, least(coalesce(p_limit, 20), 50));

  if char_length(v_query) < 2 then
    return;
  end if;

  return query
  select
    p.id,
    coalesce(p.full_name, '') as full_name,
    coalesce(p.phone, '') as phone,
    coalesce(p.codigo_membro, '') as codigo_membro
  from public.profiles p
  where p.tenant_id = v_tenant
    and public.profile_visible_to_access_actor(p_actor_profile_id, p.id)
    and coalesce(p.full_name, '') <> ''
    and (
      p.full_name ilike '%' || v_query || '%'
      or (
        v_digits <> ''
        and regexp_replace(coalesce(p.phone, ''), '\D', '', 'g') like '%' || v_digits || '%'
      )
      or coalesce(p.codigo_membro, '') ilike '%' || v_query || '%'
    )
  order by p.full_name asc
  limit v_limit;
end;
$$;

create or replace function public.listar_perfis_access_admin(
  p_actor_profile_id uuid,
  p_limit integer default 5000
)
returns table (
  id uuid,
  full_name text,
  phone text,
  codigo_membro text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
  v_limit integer;
begin
  perform public.assert_access_admin(p_actor_profile_id);

  v_limit := greatest(1, least(coalesce(p_limit, 5000), 5000));

  return query
  select
    p.id,
    coalesce(nullif(trim(p.full_name), ''), nullif(trim(p.phone), ''), '(sem nome)') as full_name,
    coalesce(p.phone, '') as phone,
    coalesce(p.codigo_membro, '') as codigo_membro
  from public.profiles p
  where p.tenant_id = v_tenant
    and public.profile_visible_to_access_actor(p_actor_profile_id, p.id)
    and coalesce(
      nullif(trim(p.full_name), ''),
      nullif(trim(p.phone), ''),
      nullif(trim(p.codigo_membro), '')
    ) is not null
  order by p.full_name asc
  limit v_limit;
end;
$$;

create or replace function public.listar_papeis_perfil_access_admin(
  p_actor_profile_id uuid,
  p_target_profile_id uuid
)
returns table (
  role_id uuid,
  role_code text,
  role_name text,
  assigned boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
begin
  perform public.assert_access_admin(p_actor_profile_id);
  -- Proteção aplicada: Gestor não tem visibilidade do Super Administrador
  perform public.assert_gestor_super_admin_shield(
    p_actor_profile_id,
    p_target_profile_id,
    null,
    'list_roles'
  );

  if p_target_profile_id is null then
    raise exception 'Perfil não informado.';
  end if;

  if not exists (
    select 1
      from public.profiles p
     where p.id = p_target_profile_id
       and p.tenant_id = v_tenant
  ) then
    raise exception 'Perfil não encontrado.';
  end if;

  return query
  select
    ar.id as role_id,
    ar.code as role_code,
    ar.name as role_name,
    exists (
      select 1
        from public.profile_access_roles par
       where par.profile_id = p_target_profile_id
         and par.role_id = ar.id
         and (par.tenant_id is null or par.tenant_id = v_tenant)
    ) as assigned
  from public.access_roles ar
  where ar.code <> 'visitantes'
    and (
      public.is_super_admin_profile(p_actor_profile_id)
      or ar.code <> 'super_admin'
    )
  order by public.access_role_display_order(ar.code), ar.name asc;
end;
$$;

create or replace function public.atribuir_papel_perfil_access_admin(
  p_actor_profile_id uuid,
  p_target_profile_id uuid,
  p_role_code text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
  v_role_code text;
  v_role_id uuid;
begin
  perform public.assert_access_admin(p_actor_profile_id);

  v_role_code := lower(trim(coalesce(p_role_code, '')));

  -- Proteção aplicada: Gestor não tem visibilidade do Super Administrador
  begin
    perform public.assert_gestor_super_admin_shield(
      p_actor_profile_id,
      p_target_profile_id,
      v_role_code,
      'assign_role'
    );
  exception
    when others then
      return jsonb_build_object(
        'success', false,
        'http_status', 403,
        'message', SQLERRM
      );
  end;

  if p_target_profile_id is null then
    return jsonb_build_object('success', false, 'message', 'Perfil não informado.');
  end if;

  if not exists (
    select 1
      from public.profiles p
     where p.id = p_target_profile_id
       and p.tenant_id = v_tenant
  ) then
    return jsonb_build_object('success', false, 'message', 'Perfil não encontrado.');
  end if;

  if v_role_code = '' then
    return jsonb_build_object('success', false, 'message', 'Papel não informado.');
  end if;

  if v_role_code = 'visitantes' then
    return jsonb_build_object(
      'success', false,
      'message', 'O papel visitante é atribuído automaticamente na criação do perfil.'
    );
  end if;

  select ar.id
    into v_role_id
    from public.access_roles ar
   where ar.code = v_role_code;

  if v_role_id is null then
    return jsonb_build_object('success', false, 'message', 'Papel não encontrado.');
  end if;

  perform public.remove_profile_visitantes_role(p_target_profile_id);

  insert into public.profile_access_roles (profile_id, role_id, granted_by_profile_id, tenant_id)
  values (p_target_profile_id, v_role_id, p_actor_profile_id, v_tenant)
  on conflict (profile_id, role_id) do nothing;

  return jsonb_build_object('success', true, 'message', 'Papel atribuído.');
end;
$$;

create or replace function public.revogar_papel_perfil_access_admin(
  p_actor_profile_id uuid,
  p_target_profile_id uuid,
  p_role_code text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
  v_role_code text;
  v_role_id uuid;
  v_remaining_super_admins integer;
begin
  perform public.assert_access_admin(p_actor_profile_id);

  v_role_code := lower(trim(coalesce(p_role_code, '')));

  -- Proteção aplicada: Gestor não tem visibilidade do Super Administrador
  begin
    perform public.assert_gestor_super_admin_shield(
      p_actor_profile_id,
      p_target_profile_id,
      v_role_code,
      'revoke_role'
    );
  exception
    when others then
      return jsonb_build_object(
        'success', false,
        'http_status', 403,
        'message', SQLERRM
      );
  end;

  if p_target_profile_id is null then
    return jsonb_build_object('success', false, 'message', 'Perfil não informado.');
  end if;

  if not exists (
    select 1
      from public.profiles p
     where p.id = p_target_profile_id
       and p.tenant_id = v_tenant
  ) then
    return jsonb_build_object('success', false, 'message', 'Perfil não encontrado.');
  end if;

  if v_role_code = '' then
    return jsonb_build_object('success', false, 'message', 'Papel não informado.');
  end if;

  select ar.id
    into v_role_id
    from public.access_roles ar
   where ar.code = v_role_code;

  if v_role_id is null then
    return jsonb_build_object('success', false, 'message', 'Papel não encontrado.');
  end if;

  if v_role_code = 'super_admin' then
    select count(*)::integer
      into v_remaining_super_admins
      from public.profile_access_roles par
      join public.access_roles ar on ar.id = par.role_id
     where ar.code = 'super_admin'
       and (par.tenant_id is null or par.tenant_id = v_tenant)
       and par.profile_id <> p_target_profile_id;

    if coalesce(v_remaining_super_admins, 0) = 0 then
      return jsonb_build_object(
        'success', false,
        'message', 'Não é possível remover o último super administrador.'
      );
    end if;
  end if;

  delete from public.profile_access_roles par
   where par.profile_id = p_target_profile_id
     and par.role_id = v_role_id
     and (par.tenant_id is null or par.tenant_id = v_tenant);

  perform public.ensure_profile_visitantes_role(p_target_profile_id, p_actor_profile_id);

  return jsonb_build_object('success', true, 'message', 'Papel removido.');
end;
$$;

create or replace function public.list_profile_access_insights_admin(
  p_actor_profile_id uuid
)
returns table (
  profile_id uuid,
  full_name text,
  last_access_at timestamptz,
  access_count bigint
)
language plpgsql
security definer
set search_path = public
as $list_profile_access_insights_admin$
declare
  v_tenant uuid := public.require_session_tenant_id();
begin
  perform public.assert_access_admin(p_actor_profile_id);

  return query
  select
    p.id as profile_id,
    p.full_name,
    max(e.accessed_at) as last_access_at,
    count(e.id)::bigint as access_count
  from public.profiles p
  inner join public.profile_app_access_events e
    on e.profile_id = p.id
   and e.tenant_id = v_tenant
  where p.tenant_id = v_tenant
    and public.profile_visible_to_access_actor(p_actor_profile_id, p.id)
    and coalesce(trim(p.full_name), '') <> ''
    and lower(trim(p.full_name)) <> 'visitante'
  group by p.id, p.full_name
  having count(e.id) > 0
  order by max(e.accessed_at) desc, p.full_name asc;
end;
$list_profile_access_insights_admin$;

create or replace function public.list_profile_access_screen_visits_admin(
  p_actor_profile_id uuid,
  p_target_profile_id uuid
)
returns table (
  access_event_id uuid,
  accessed_at timestamptz,
  screen_key text,
  screen_label text,
  visited_at timestamptz,
  visit_order integer
)
language plpgsql
security definer
set search_path = public
as $list_profile_access_screen_visits_admin$
declare
  v_tenant uuid := public.require_session_tenant_id();
begin
  perform public.assert_access_admin(p_actor_profile_id);

  if p_target_profile_id is null then
    return;
  end if;

  if not public.profile_visible_to_access_actor(p_actor_profile_id, p_target_profile_id) then
    return;
  end if;

  if not exists (
    select 1
      from public.profiles p
     where p.id = p_target_profile_id
       and p.tenant_id = v_tenant
  ) then
    return;
  end if;

  return query
  select
    e.id as access_event_id,
    e.accessed_at,
    sv.screen_key,
    sv.screen_label,
    sv.visited_at,
    sv.visit_order
  from public.profile_app_access_events e
  left join public.profile_app_access_screen_visits sv
    on sv.access_event_id = e.id
   and sv.tenant_id = v_tenant
   and sv.screen_label not in ('Dashboard', 'Manutenção')
   and sv.screen_key not in ('/dashboard', '/maintenance-dashboard')
  where e.profile_id = p_target_profile_id
    and e.tenant_id = v_tenant
  order by e.accessed_at desc, sv.visit_order asc nulls last;
end;
$list_profile_access_screen_visits_admin$;

create or replace function public.clear_profile_access_insights_admin(
  p_actor_profile_id uuid
)
returns bigint
language plpgsql
security definer
set search_path = public
as $clear_profile_access_insights_admin$
declare
  v_tenant uuid := public.require_session_tenant_id();
  cnt_before bigint;
  cnt_after bigint;
begin
  perform public.assert_access_admin(p_actor_profile_id);

  select count(*)::bigint
    into cnt_before
    from public.profile_app_access_events e
   where e.tenant_id = v_tenant;

  delete from public.profile_app_access_screen_visits sv
   where sv.tenant_id = v_tenant;

  delete from public.profile_app_access_events e
   where e.tenant_id = v_tenant;

  select count(*)::bigint
    into cnt_after
    from public.profile_app_access_events e
   where e.tenant_id = v_tenant;

  if cnt_after > 0 then
    raise exception 'Falha ao limpar profile_app_access_events (% registros restantes).', cnt_after;
  end if;

  return coalesce(cnt_before, 0);
end;
$clear_profile_access_insights_admin$;

-- Diretório de membros inativos (espelha o ativo, com tenant)
create or replace function public.list_profiles_members_inactive_directory()
returns table (
  profile_id uuid,
  full_name text,
  phone text,
  family_id text,
  is_visitantes_only boolean,
  cep text,
  address_street text,
  address_number text,
  address_neighborhood text,
  address_city text,
  address_state text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
begin
  if not public.session_has_members_directory_access() then
    return;
  end if;

  return query
  select
    p.id as profile_id,
    trim(p.full_name) as full_name,
    nullif(trim(coalesce(p.phone, '')), '') as phone,
    coalesce(
      public.resolve_member_family_id_for_directory_person(p.phone, trim(p.full_name)),
      public.profile_directory_family_code(p.family_id, p.codigo_membro)
    ) as family_id,
    public.profile_is_visitantes_only(p.id) as is_visitantes_only,
    nullif(trim(coalesce(p.cep, '')), '') as cep,
    nullif(trim(coalesce(p.address_street, '')), '') as address_street,
    nullif(trim(coalesce(p.address_number, '')), '') as address_number,
    nullif(trim(coalesce(p.address_neighborhood, '')), '') as address_neighborhood,
    nullif(trim(coalesce(p.address_city, '')), '') as address_city,
    nullif(trim(coalesce(p.address_state, '')), '') as address_state
  from public.profiles p
  where p.tenant_id = v_tenant
    and p.full_name is not null
    and trim(p.full_name) <> ''
    and p.membership_out is not null
    and public.profile_is_members_list_member(p.id)
  order by trim(p.full_name) asc;
end;
$$;

-- ---------------------------------------------------------------------------
-- RESTRICTIVE extras (salas / discipulado)
-- ---------------------------------------------------------------------------
drop policy if exists church_room_settings_tenant_restrict on public.church_room_settings;
create policy church_room_settings_tenant_restrict
  on public.church_room_settings
  as restrictive
  for all
  to public
  using (public.session_tenant_matches(tenant_id))
  with check (public.session_tenant_matches(tenant_id));

drop policy if exists user_room_assignment_tenant_restrict on public.user_room_assignment;
create policy user_room_assignment_tenant_restrict
  on public.user_room_assignment
  as restrictive
  for all
  to public
  using (public.session_tenant_matches(tenant_id))
  with check (public.session_tenant_matches(tenant_id));

drop policy if exists discipleship_lessons_tenant_restrict on public.discipleship_lessons;
create policy discipleship_lessons_tenant_restrict
  on public.discipleship_lessons
  as restrictive
  for all
  to public
  using (public.session_tenant_matches(tenant_id))
  with check (public.session_tenant_matches(tenant_id));

drop policy if exists discipleship_modules_tenant_restrict on public.discipleship_modules;
create policy discipleship_modules_tenant_restrict
  on public.discipleship_modules
  as restrictive
  for all
  to public
  using (public.session_tenant_matches(tenant_id))
  with check (public.session_tenant_matches(tenant_id));

grant execute on function public.buscar_perfis_access_admin(uuid, text, integer) to anon, authenticated;
grant execute on function public.listar_perfis_access_admin(uuid, integer) to anon, authenticated;
grant execute on function public.listar_papeis_perfil_access_admin(uuid, uuid) to anon, authenticated;
grant execute on function public.atribuir_papel_perfil_access_admin(uuid, uuid, text) to anon, authenticated;
grant execute on function public.revogar_papel_perfil_access_admin(uuid, uuid, text) to anon, authenticated;
grant execute on function public.list_profile_access_insights_admin(uuid) to anon, authenticated;
grant execute on function public.list_profile_access_screen_visits_admin(uuid, uuid) to anon, authenticated;
grant execute on function public.clear_profile_access_insights_admin(uuid) to anon, authenticated;
grant execute on function public.list_profiles_members_inactive_directory() to anon, authenticated;

notify pgrst, 'reload schema';

commit;

select 'multi-tenant-isolation-hardening: ok' as status;
