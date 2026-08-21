-- =============================================================================
-- Transferência: origem continua vendo o membro como inativo/desligado
-- =============================================================================
-- Após a transferência, profiles.tenant_id aponta para o destino e
-- profiles.membership_out permanece NULL (para o membro aparecer ativo lá).
-- Na origem a saída fica em profile_igreja_vinculos (status Transferido +
-- membership_out = data da transferência).
--
-- Este patch:
--   - lista transferidos em Membros Inativos na igreja de origem
--   - inclui os mesmos perfis em Mudança de Papéis, com data de desligamento
--     da transferência (nome vermelho no app)
--   - NÃO grava profiles.membership_out (isso esconderia o membro no destino)
-- =============================================================================

begin;

-- ---------------------------------------------------------------------------
-- Backfill: origem com transferência concluída sem data/status no vínculo
-- ---------------------------------------------------------------------------

update public.profile_igreja_vinculos v
   set membership_out = coalesce(
         v.membership_out,
         (v.transferred_at at time zone 'America/Sao_Paulo')::date,
         (r.decided_at at time zone 'America/Sao_Paulo')::date
       ),
       membership_status = case
         when coalesce(nullif(trim(v.membership_status), ''), '') = '' then 'Transferido'
         else v.membership_status
       end,
       updated_at = now()
  from public.igreja_transfer_people tp
  join public.igreja_transfer_requests r on r.id = tp.request_id
 where v.profile_id = tp.profile_id
   and v.tenant_id = r.origin_tenant_id
   and r.status = 'completed'
   and (
     v.membership_out is null
     or coalesce(nullif(trim(v.membership_status), ''), '') = ''
   );

-- ---------------------------------------------------------------------------
-- Helpers de visibilidade e data na igreja da sessão
-- ---------------------------------------------------------------------------

create or replace function public.profile_transferred_out_of_session(p_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.profile_igreja_vinculos v
     where v.profile_id = p_profile_id
       and v.tenant_id = public.current_session_tenant_id()
       and (
         coalesce(v.membership_status, '') = 'Transferido'
         or v.transferred_to_tenant_id is not null
         or v.membership_out is not null
       )
  );
$$;

comment on function public.profile_transferred_out_of_session(uuid) is
  'Verdadeiro quando o perfil saiu desta igreja (vínculo Transferido / membership_out no tenant da sessão).';

create or replace function public.profile_visible_in_session_church(p_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.profiles p
     where p.id = p_profile_id
       and p.tenant_id = public.current_session_tenant_id()
  )
  or exists (
    select 1
      from public.profile_igreja_vinculos v
     where v.profile_id = p_profile_id
       and v.tenant_id = public.current_session_tenant_id()
  );
$$;

comment on function public.profile_visible_in_session_church(uuid) is
  'Perfil da igreja da sessão: tenant atual ou qualquer vínculo (ativo ou transferido) neste tenant.';

create or replace function public.profile_session_membership_out(p_profile_id uuid)
returns date
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select coalesce(
               v.membership_out,
               (v.transferred_at at time zone 'America/Sao_Paulo')::date
             )
        from public.profile_igreja_vinculos v
       where v.profile_id = p_profile_id
         and v.tenant_id = public.current_session_tenant_id()
         and (
           coalesce(v.membership_status, '') = 'Transferido'
           or v.transferred_to_tenant_id is not null
           or v.membership_out is not null
         )
       limit 1
    ),
    (
      select p.membership_out
        from public.profiles p
       where p.id = p_profile_id
         and p.tenant_id = public.current_session_tenant_id()
    )
  );
$$;

comment on function public.profile_session_membership_out(uuid) is
  'Data de desligamento nesta igreja: vínculo de transferência/saída, senão profiles.membership_out do tenant atual.';

create or replace function public.profile_session_origin_family_id(p_profile_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.current_session_tenant_id();
  v_family text;
begin
  if v_tenant is null or p_profile_id is null then
    return null;
  end if;

  select upper(nullif(trim(m.family_id), ''))
    into v_family
    from public.profiles p
    join public.members m
      on m.tenant_id = v_tenant
     and nullif(trim(coalesce(m.family_id, '')), '') is not null
     and (
       public.phones_match_for_sync(m.phone, p.phone)
       or (
         length(trim(coalesce(p.full_name, ''))) > 0
         and lower(trim(m.full_name)) = lower(trim(p.full_name))
       )
     )
   where p.id = p_profile_id
   order by
     case when m.accepted is true then 0 else 1 end,
     m.created_at desc nulls last,
     m.id
   limit 1;

  if v_family is not null then
    return v_family;
  end if;

  select upper(nullif(trim(tp.origin_family_id), ''))
    into v_family
    from public.igreja_transfer_people tp
    join public.igreja_transfer_requests r on r.id = tp.request_id
   where tp.profile_id = p_profile_id
     and r.origin_tenant_id = v_tenant
     and r.status = 'completed'
   order by r.decided_at desc nulls last, r.created_at desc
   limit 1;

  return v_family;
end;
$$;

create or replace function public.profile_session_directory_family_id(
  p_profile_id uuid,
  p_phone text,
  p_full_name text
)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    public.resolve_member_family_id_for_directory_person(p_phone, p_full_name),
    public.profile_session_origin_family_id(p_profile_id),
    case
      when exists (
        select 1
          from public.profiles p
         where p.id = p_profile_id
           and p.tenant_id = public.current_session_tenant_id()
      )
        then (
          select public.profile_directory_family_code(p.family_id, p.codigo_membro)
            from public.profiles p
           where p.id = p_profile_id
        )
      else null
    end
  );
$$;

create or replace function public.profile_session_basic_role_code(p_profile_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.current_session_tenant_id();
  v_roles jsonb;
begin
  if public.profile_transferred_out_of_session(p_profile_id) then
    select tp.origin_roles
      into v_roles
      from public.igreja_transfer_people tp
      join public.igreja_transfer_requests r on r.id = tp.request_id
     where tp.profile_id = p_profile_id
       and r.origin_tenant_id = v_tenant
       and r.status = 'completed'
     order by r.decided_at desc nulls last, r.created_at desc
     limit 1;

    if exists (
      select 1
        from jsonb_array_elements(coalesce(v_roles, '[]'::jsonb)) elem
       where elem->>'code' = 'member'
    ) then
      return 'member';
    end if;

    if exists (
      select 1
        from jsonb_array_elements(coalesce(v_roles, '[]'::jsonb)) elem
       where elem->>'code' = 'congregado'
    ) then
      return 'congregado';
    end if;

    return 'member';
  end if;

  return public.resolve_basic_role_code_for_profile(p_profile_id);
end;
$$;

grant execute on function public.profile_transferred_out_of_session(uuid) to anon, authenticated;
grant execute on function public.profile_visible_in_session_church(uuid) to anon, authenticated;
grant execute on function public.profile_session_membership_out(uuid) to anon, authenticated;
grant execute on function public.profile_session_origin_family_id(uuid) to anon, authenticated;
grant execute on function public.profile_session_directory_family_id(uuid, text, text) to anon, authenticated;
grant execute on function public.profile_session_basic_role_code(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Datas efetivas: overlay da saída nesta igreja (sem exigir tenant atual)
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
  v_session_out date;
  v_guardian_id uuid;
begin
  select
    public.resolve_basic_role_code_for_profile(p.id),
    p.membership_date,
    p.membership_out
    into v_role, v_own_date, v_own_out
    from public.profiles p
   where p.id = p_profile_id;

  v_session_out := public.profile_session_membership_out(p_profile_id);

  if v_session_out is not null then
    return query
    select v_own_date, v_session_out, false, null::uuid, null::text;
    return;
  end if;

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

-- ---------------------------------------------------------------------------
-- Lista de membros: ativos excluem saída nesta igreja; inativos incluem
-- transferidos da origem
-- ---------------------------------------------------------------------------

create or replace function public.list_profiles_members_directory()
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
    and p.membership_out is null
    and not exists (
      select 1
        from public.profile_igreja_vinculos v
       where v.profile_id = p.id
         and v.tenant_id = v_tenant
         and (
           coalesce(v.membership_status, '') = 'Transferido'
           or v.transferred_to_tenant_id is not null
           or v.membership_out is not null
         )
    )
    and public.profile_is_members_list_member(p.id)
  order by trim(p.full_name) asc;
end;
$$;

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
  with transferred as (
    select v.profile_id
      from public.profile_igreja_vinculos v
     where v.tenant_id = v_tenant
       and (
         coalesce(v.membership_status, '') = 'Transferido'
         or v.transferred_to_tenant_id is not null
         or v.membership_out is not null
       )
  )
  select
    p.id as profile_id,
    trim(p.full_name) as full_name,
    nullif(trim(coalesce(p.phone, '')), '') as phone,
    coalesce(
      public.resolve_member_family_id_for_directory_person(p.phone, trim(p.full_name)),
      public.profile_session_origin_family_id(p.id),
      case
        when p.tenant_id = v_tenant
          then public.profile_directory_family_code(p.family_id, p.codigo_membro)
        else null
      end,
      '—'
    ) as family_id,
    public.profile_is_visitantes_only(p.id) as is_visitantes_only,
    nullif(trim(coalesce(p.cep, '')), '') as cep,
    nullif(trim(coalesce(p.address_street, '')), '') as address_street,
    nullif(trim(coalesce(p.address_number, '')), '') as address_number,
    nullif(trim(coalesce(p.address_neighborhood, '')), '') as address_neighborhood,
    nullif(trim(coalesce(p.address_city, '')), '') as address_city,
    nullif(trim(coalesce(p.address_state, '')), '') as address_state
  from public.profiles p
  left join transferred t on t.profile_id = p.id
  where p.full_name is not null
    and trim(p.full_name) <> ''
    and (
      (p.tenant_id = v_tenant and p.membership_out is not null)
      or t.profile_id is not null
    )
    and (
      public.profile_is_members_list_member(p.id)
      or t.profile_id is not null
    )
  order by trim(p.full_name) asc;
end;
$$;

grant execute on function public.list_profiles_members_directory() to anon, authenticated;
grant execute on function public.list_profiles_members_inactive_directory() to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Mudança de Papéis: inclui transferidos da origem com data de desligamento
-- ---------------------------------------------------------------------------

create or replace function public.listar_perfis_mudanca_papel_pastoral(
  p_actor_profile_id uuid,
  p_limit integer default 5000
)
returns table (
  id uuid,
  full_name text,
  phone text,
  codigo_membro text,
  membership_date date,
  membership_out date,
  own_membership_date date,
  own_membership_out date,
  family_id text,
  membership_inherited boolean,
  inherited_from_name text,
  current_role_code text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid;
  v_limit integer;
begin
  v_tenant := public.require_session_tenant_id();
  perform public.assert_pastoral_role_change_actor(p_actor_profile_id);

  v_limit := greatest(1, least(coalesce(p_limit, 5000), 5000));

  return query
  with transferred as (
    select
      v.profile_id,
      coalesce(
        v.membership_out,
        (v.transferred_at at time zone 'America/Sao_Paulo')::date
      ) as session_out
    from public.profile_igreja_vinculos v
    where v.tenant_id = v_tenant
      and (
        coalesce(v.membership_status, '') = 'Transferido'
        or v.transferred_to_tenant_id is not null
        or v.membership_out is not null
      )
  ),
  origin_family as (
    select distinct on (tp.profile_id)
      tp.profile_id,
      upper(nullif(trim(tp.origin_family_id), '')) as family_id,
      tp.origin_roles
    from public.igreja_transfer_people tp
    join public.igreja_transfer_requests r on r.id = tp.request_id
    where r.origin_tenant_id = v_tenant
      and r.status = 'completed'
    order by tp.profile_id, r.decided_at desc nulls last, r.created_at desc
  )
  select
    p.id,
    coalesce(nullif(trim(p.full_name), ''), nullif(trim(p.phone), ''), '(sem nome)'),
    coalesce(p.phone, ''),
    coalesce(ofam.family_id, nullif(trim(p.codigo_membro), ''), ''),
    case when t.session_out is not null then p.membership_date else eff.membership_date end,
    coalesce(t.session_out, eff.membership_out),
    p.membership_date,
    coalesce(t.session_out, case when p.tenant_id = v_tenant then p.membership_out end),
    coalesce(ofam.family_id, nullif(trim(p.family_id), ''), ''),
    case when t.session_out is not null then false else coalesce(eff.membership_inherited, false) end,
    case when t.session_out is not null then '' else coalesce(eff.inherited_from_name, '') end,
    case
      when t.profile_id is not null then
        case
          when exists (
            select 1
              from jsonb_array_elements(coalesce(ofam.origin_roles, '[]'::jsonb)) elem
             where elem->>'code' = 'member'
          ) then 'member'
          when exists (
            select 1
              from jsonb_array_elements(coalesce(ofam.origin_roles, '[]'::jsonb)) elem
             where elem->>'code' = 'congregado'
          ) then 'congregado'
          else 'member'
        end
      else public.resolve_basic_role_code_for_profile(p.id)
    end
  from public.profiles p
  left join transferred t on t.profile_id = p.id
  left join origin_family ofam on ofam.profile_id = p.id
  cross join lateral public.resolve_effective_membership_dates_for_profile(p.id) eff
  where (p.tenant_id = v_tenant or t.profile_id is not null)
    and coalesce(
      nullif(trim(p.full_name), ''),
      nullif(trim(p.phone), ''),
      nullif(trim(p.codigo_membro), ''),
      ofam.family_id
    ) is not null
  order by p.full_name asc
  limit v_limit;
end;
$$;

create or replace function public.buscar_perfis_mudanca_papel_pastoral(
  p_actor_profile_id uuid,
  p_query text,
  p_limit integer default 30
)
returns table (
  id uuid,
  full_name text,
  phone text,
  codigo_membro text,
  membership_date date,
  membership_out date,
  own_membership_date date,
  own_membership_out date,
  family_id text,
  membership_inherited boolean,
  inherited_from_name text,
  current_role_code text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid;
  v_query text;
  v_digits text;
  v_limit integer;
begin
  v_tenant := public.require_session_tenant_id();
  perform public.assert_pastoral_role_change_actor(p_actor_profile_id);

  v_query := trim(coalesce(p_query, ''));
  v_digits := regexp_replace(v_query, '\D', '', 'g');
  v_limit := greatest(1, least(coalesce(p_limit, 30), 50));

  if char_length(v_query) < 2 then
    return;
  end if;

  return query
  with transferred as (
    select
      v.profile_id,
      coalesce(
        v.membership_out,
        (v.transferred_at at time zone 'America/Sao_Paulo')::date
      ) as session_out
    from public.profile_igreja_vinculos v
    where v.tenant_id = v_tenant
      and (
        coalesce(v.membership_status, '') = 'Transferido'
        or v.transferred_to_tenant_id is not null
        or v.membership_out is not null
      )
  ),
  origin_family as (
    select distinct on (tp.profile_id)
      tp.profile_id,
      upper(nullif(trim(tp.origin_family_id), '')) as family_id,
      tp.origin_roles
    from public.igreja_transfer_people tp
    join public.igreja_transfer_requests r on r.id = tp.request_id
    where r.origin_tenant_id = v_tenant
      and r.status = 'completed'
    order by tp.profile_id, r.decided_at desc nulls last, r.created_at desc
  )
  select
    p.id,
    coalesce(nullif(trim(p.full_name), ''), nullif(trim(p.phone), ''), '(sem nome)'),
    coalesce(p.phone, ''),
    coalesce(ofam.family_id, nullif(trim(p.codigo_membro), ''), ''),
    case when t.session_out is not null then p.membership_date else eff.membership_date end,
    coalesce(t.session_out, eff.membership_out),
    p.membership_date,
    coalesce(t.session_out, case when p.tenant_id = v_tenant then p.membership_out end),
    coalesce(ofam.family_id, nullif(trim(p.family_id), ''), ''),
    case when t.session_out is not null then false else coalesce(eff.membership_inherited, false) end,
    case when t.session_out is not null then '' else coalesce(eff.inherited_from_name, '') end,
    case
      when t.profile_id is not null then
        case
          when exists (
            select 1
              from jsonb_array_elements(coalesce(ofam.origin_roles, '[]'::jsonb)) elem
             where elem->>'code' = 'member'
          ) then 'member'
          when exists (
            select 1
              from jsonb_array_elements(coalesce(ofam.origin_roles, '[]'::jsonb)) elem
             where elem->>'code' = 'congregado'
          ) then 'congregado'
          else 'member'
        end
      else public.resolve_basic_role_code_for_profile(p.id)
    end
  from public.profiles p
  left join transferred t on t.profile_id = p.id
  left join origin_family ofam on ofam.profile_id = p.id
  cross join lateral public.resolve_effective_membership_dates_for_profile(p.id) eff
  where (p.tenant_id = v_tenant or t.profile_id is not null)
    and (
      coalesce(nullif(trim(p.full_name), ''), nullif(trim(p.phone), ''), nullif(trim(p.codigo_membro), '')) is not null
      or ofam.family_id is not null
    )
    and (
      coalesce(p.full_name, '') ilike '%' || v_query || '%'
      or (
        v_digits <> ''
        and regexp_replace(coalesce(p.phone, ''), '\D', '', 'g') like '%' || v_digits || '%'
      )
      or coalesce(p.codigo_membro, '') ilike '%' || v_query || '%'
      or coalesce(ofam.family_id, '') ilike '%' || v_query || '%'
      or exists (
        select 1
          from public.profile_access_roles par
          join public.access_roles ar on ar.id = par.role_id
         where par.profile_id = p.id
           and ar.code in ('member', 'congregado')
           and (
             ar.code ilike '%' || lower(v_query) || '%'
             or ar.name ilike '%' || v_query || '%'
           )
      )
      or (
        lower(v_query) like 'visit%'
        and public.resolve_basic_role_code_for_profile(p.id) = 'visitante'
      )
      or (
        lower(v_query) in ('membro', 'member')
        and public.resolve_basic_role_code_for_profile(p.id) = 'member'
      )
      or (
        lower(v_query) like 'congreg%'
        and public.resolve_basic_role_code_for_profile(p.id) = 'congregado'
      )
    )
  order by p.full_name asc
  limit v_limit;
end;
$$;

create or replace function public.atualizar_membership_date_perfil_pastoral(
  p_actor_profile_id uuid,
  p_target_profile_id uuid,
  p_membership_date date,
  p_membership_out date default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
  v_role text;
  v_transferred boolean;
begin
  perform public.assert_pastoral_role_change_actor(p_actor_profile_id);

  if p_target_profile_id is null then
    return jsonb_build_object('success', false, 'message', 'Perfil não informado.');
  end if;

  if not public.profile_visible_in_session_church(p_target_profile_id) then
    return jsonb_build_object('success', false, 'message', 'Perfil não encontrado.');
  end if;

  if not public.is_super_admin_profile(p_actor_profile_id)
     and public.profile_has_protected_role_for_pastoral_change(p_target_profile_id) then
    return jsonb_build_object(
      'success',
      false,
      'message',
      'Este perfil possui papel protegido e não pode ser alterado por esta tela.'
    );
  end if;

  v_transferred := public.profile_transferred_out_of_session(p_target_profile_id);
  v_role := public.profile_session_basic_role_code(p_target_profile_id);

  if v_role not in ('member', 'congregado') then
    return jsonb_build_object(
      'success',
      false,
      'message',
      'As datas de membresia só podem ser editadas para perfis classificados como Membro ou Congregado.'
    );
  end if;

  if not v_transferred
     and v_role = 'congregado'
     and public.profile_membership_dates_are_inherited(p_target_profile_id) then
    return jsonb_build_object(
      'success',
      false,
      'message',
      'Este congregado herda as datas do responsável familiar. Edite o perfil do responsável legal, pai ou mãe.'
    );
  end if;

  if v_transferred then
    update public.profile_igreja_vinculos
       set membership_out = p_membership_out,
           updated_at = now()
     where profile_id = p_target_profile_id
       and tenant_id = v_tenant;

    update public.profiles
       set membership_date = p_membership_date,
           updated_at = now()
     where id = p_target_profile_id;
  else
    update public.profiles
       set membership_date = p_membership_date,
           membership_out = p_membership_out,
           updated_at = now()
     where id = p_target_profile_id
       and tenant_id = v_tenant;
  end if;

  return jsonb_build_object(
    'success',
    true,
    'message',
    case
      when p_membership_date is null and p_membership_out is null then 'Datas de membresia removidas.'
      else 'Datas de membresia atualizadas.'
    end,
    'membership_date', p_membership_date,
    'membership_out', p_membership_out
  );
end;
$$;

create or replace function public.definir_papel_basico_perfil_pastoral(
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
  v_current_role text;
begin
  perform public.assert_pastoral_role_change_actor(p_actor_profile_id);

  if p_target_profile_id is null then
    return jsonb_build_object('success', false, 'message', 'Perfil não informado.');
  end if;

  if not public.profile_visible_in_session_church(p_target_profile_id) then
    return jsonb_build_object('success', false, 'message', 'Perfil não encontrado.');
  end if;

  if public.profile_transferred_out_of_session(p_target_profile_id) then
    return jsonb_build_object(
      'success',
      false,
      'message',
      'Este membro foi transferido para outra igreja. O papel não pode ser alterado nesta instância.'
    );
  end if;

  if not exists (
    select 1 from public.profiles p
     where p.id = p_target_profile_id and p.tenant_id = v_tenant
  ) then
    return jsonb_build_object('success', false, 'message', 'Perfil não encontrado.');
  end if;

  if not public.is_super_admin_profile(p_actor_profile_id)
     and public.profile_has_protected_role_for_pastoral_change(p_target_profile_id) then
    return jsonb_build_object(
      'success',
      false,
      'message',
      'Este perfil possui papel protegido e não pode ser alterado por esta tela.'
    );
  end if;

  v_role_code := lower(trim(coalesce(p_role_code, '')));

  if v_role_code not in ('visitante', 'congregado', 'member') then
    return jsonb_build_object(
      'success',
      false,
      'message',
      'Papel inválido. Use visitante, congregado ou member.'
    );
  end if;

  v_current_role := public.resolve_basic_role_code_for_profile(p_target_profile_id);

  if v_current_role = v_role_code then
    return jsonb_build_object('success', true, 'message', 'Papel já estava definido.');
  end if;

  delete from public.profile_access_roles par
   using public.access_roles ar
   where par.role_id = ar.id
     and par.profile_id = p_target_profile_id
     and par.tenant_id = v_tenant
     and ar.code in ('member', 'congregado', 'visitantes');

  if v_role_code = 'visitante' then
    perform public.ensure_profile_visitantes_role(p_target_profile_id, p_actor_profile_id);

    return jsonb_build_object(
      'success',
      true,
      'message',
      'Perfil definido como visitante.'
    );
  end if;

  select ar.id
    into v_role_id
    from public.access_roles ar
   where ar.code = v_role_code;

  if v_role_id is null then
    return jsonb_build_object('success', false, 'message', 'Papel não encontrado no sistema.');
  end if;

  insert into public.profile_access_roles (profile_id, role_id, granted_by_profile_id, tenant_id)
  values (p_target_profile_id, v_role_id, p_actor_profile_id, v_tenant)
  on conflict (profile_id, role_id) do nothing;

  return jsonb_build_object(
    'success',
    true,
    'message',
    case v_role_code
      when 'member' then 'Papel alterado para Membro.'
      when 'congregado' then 'Papel alterado para Congregado.'
      else 'Papel atualizado.'
    end
  );
end;
$$;

grant execute on function public.listar_perfis_mudanca_papel_pastoral(uuid, integer) to anon, authenticated;
grant execute on function public.buscar_perfis_mudanca_papel_pastoral(uuid, text, integer) to anon, authenticated;
grant execute on function public.atualizar_membership_date_perfil_pastoral(uuid, uuid, date, date) to anon, authenticated;
grant execute on function public.definir_papel_basico_perfil_pastoral(uuid, uuid, text) to anon, authenticated;
grant execute on function public.resolve_effective_membership_dates_for_profile(uuid) to anon, authenticated;

notify pgrst, 'reload schema';

commit;

select 'igreja-transferencia-origem-inativos: ok' as status;
