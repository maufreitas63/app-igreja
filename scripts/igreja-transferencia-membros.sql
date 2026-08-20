-- =============================================================================
-- Transferência de membro/família entre instâncias (igrejas)
-- =============================================================================
-- Uma base Supabase + tenants em public.igrejas. A identidade (profiles.id,
-- telefone e CPF) é global. A transferência NÃO duplica o perfil: registra
-- saída no vínculo de origem, gera novo código de família no destino e zera
-- cargos/privilégios. O usuário entra como membro ou congregado comum.
-- =============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1. Auditoria no vínculo origem
-- ---------------------------------------------------------------------------

alter table public.profile_igreja_vinculos
  add column if not exists membership_out date,
  add column if not exists membership_status text,
  add column if not exists transferred_to_tenant_id uuid references public.igrejas (id) on delete set null,
  add column if not exists transferred_at timestamptz;

comment on column public.profile_igreja_vinculos.membership_status is
  'Status do vínculo nesta igreja. Transferido preserva o histórico sem apagar o registro.';

-- ---------------------------------------------------------------------------
-- 2. Pedidos de transferência
-- ---------------------------------------------------------------------------

create table if not exists public.igreja_transfer_requests (
  id uuid primary key default gen_random_uuid(),
  origin_tenant_id uuid not null references public.igrejas (id) on delete restrict,
  destination_tenant_id uuid not null references public.igrejas (id) on delete restrict,
  request_source text not null,
  scope text not null,
  primary_profile_id uuid references public.profiles (id) on delete set null,
  origin_family_id text,
  dest_family_id text,
  phone text,
  cpf text,
  note text,
  status text not null default 'pending_origin',
  requested_by_profile_id uuid references public.profiles (id) on delete set null,
  decided_by_profile_id uuid references public.profiles (id) on delete set null,
  decided_at timestamptz,
  decision_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint igreja_transfer_requests_source_chk
    check (request_source in ('member_login', 'destination_pastoral')),
  constraint igreja_transfer_requests_scope_chk
    check (scope in ('person', 'family')),
  constraint igreja_transfer_requests_status_chk
    check (status in ('pending_origin', 'rejected', 'completed', 'cancelled')),
  constraint igreja_transfer_requests_tenants_distinct_chk
    check (origin_tenant_id <> destination_tenant_id)
);

create table if not exists public.igreja_transfer_people (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.igreja_transfer_requests (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete restrict,
  origin_member_id uuid references public.members (id) on delete set null,
  dest_member_id uuid references public.members (id) on delete set null,
  full_name text,
  phone text,
  origin_family_id text,
  dest_family_id text,
  origin_roles jsonb not null default '[]'::jsonb,
  dest_basic_role text,
  created_at timestamptz not null default now(),
  constraint igreja_transfer_people_request_profile_unique unique (request_id, profile_id)
);

create index if not exists igreja_transfer_requests_origin_status_idx
  on public.igreja_transfer_requests (origin_tenant_id, status, created_at desc);

create index if not exists igreja_transfer_requests_dest_status_idx
  on public.igreja_transfer_requests (destination_tenant_id, status, created_at desc);

create index if not exists igreja_transfer_people_profile_idx
  on public.igreja_transfer_people (profile_id);

alter table public.igreja_transfer_requests enable row level security;
alter table public.igreja_transfer_people enable row level security;

revoke all on public.igreja_transfer_requests from anon, authenticated, public;
revoke all on public.igreja_transfer_people from anon, authenticated, public;

-- ---------------------------------------------------------------------------
-- 3. Recurso ACL do card pastoral
-- ---------------------------------------------------------------------------

insert into public.access_resources (resource_type, resource_key, label, description)
values
  (
    'screen',
    'maintenance.card.transferencia_igreja',
    'Manutenção: Transferência de Membro',
    'Equipe pastoral solicita e processa transferência de membro/família entre igrejas'
  )
on conflict (resource_type, resource_key) do update
  set label = excluded.label,
      description = excluded.description;

insert into public.access_grants (role_id, resource_id, can_view, can_update)
select r.id, res.id, true, true
  from public.access_roles r
  join public.access_resources res
    on res.resource_type = 'screen'
   and res.resource_key = 'maintenance.card.transferencia_igreja'
 where r.code in ('pastoral', 'super_admin')
on conflict (role_id, resource_id) where (role_id is not null) do update
  set can_view = excluded.can_view,
      can_update = excluded.can_update,
      updated_at = now();

-- ---------------------------------------------------------------------------
-- 4. Helpers
-- ---------------------------------------------------------------------------

create or replace function public.get_family_id_prefix_for_tenant(p_tenant_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_raw text;
  v_clean text;
begin
  if p_tenant_id is not null then
    select trim(ap.value)
      into v_raw
      from public.app_parameters ap
     where ap.tenant_id = p_tenant_id
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

create or replace function public.reserve_next_family_id_for_tenant(p_tenant_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prefix text;
  v_param_last int;
  v_family_ref_num int;
  v_max_suffix int;
  v_base int;
  v_next int;
  v_new_id text;
begin
  if p_tenant_id is null then
    raise exception 'Igreja de destino não encontrada.';
  end if;

  perform pg_advisory_xact_lock(hashtext('reserve_family:' || p_tenant_id::text), 4821901);

  v_prefix := public.get_family_id_prefix_for_tenant(p_tenant_id);

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
  where ap.tenant_id = p_tenant_id
    and lower(ap.parameter) = 'last_family_id'
  limit 1;

  select
    case
      when trim(ap.value) ~ '^\d+$' then trim(ap.value)::integer
      else null
    end
  into v_family_ref_num
  from public.app_parameters ap
  where ap.tenant_id = p_tenant_id
    and lower(ap.parameter) = 'family_ref'
  limit 1;

  select coalesce(max(t.n), 0)
  into v_max_suffix
  from (
    select substring(trim(m.family_id) from (v_prefix || '(\d+)$'))::integer as n
    from public.members m
    where m.tenant_id = p_tenant_id
      and trim(coalesce(m.family_id, '')) ~ ('^' || v_prefix || '\d+$')
    union all
    select substring(trim(m.family_id) from 'IBN(\d+)$')::integer as n
    from public.members m
    where m.tenant_id = p_tenant_id
      and v_prefix is distinct from 'IBN'
      and trim(coalesce(m.family_id, '')) ~ '^IBN\d+$'
    union all
    select substring(trim(p.family_id) from (v_prefix || '(\d+)$'))::integer as n
    from public.profiles p
    where p.tenant_id = p_tenant_id
      and trim(coalesce(p.family_id, '')) ~ ('^' || v_prefix || '\d+$')
    union all
    select substring(trim(p.family_id) from 'IBN(\d+)$')::integer as n
    from public.profiles p
    where p.tenant_id = p_tenant_id
      and v_prefix is distinct from 'IBN'
      and trim(coalesce(p.family_id, '')) ~ '^IBN\d+$'
  ) t;

  v_base := greatest(
    coalesce(v_param_last, case when v_family_ref_num is not null then v_family_ref_num - 1 else null end, 0),
    v_max_suffix
  );
  v_next := v_base + 1;
  v_new_id := v_prefix || lpad(v_next::text, 4, '0');

  update public.app_parameters
  set value = v_next::text
  where tenant_id = p_tenant_id
    and lower(parameter) = 'last_family_id';

  if not found then
    insert into public.app_parameters (parameter, value, tenant_id)
    values ('last_family_id', v_next::text, p_tenant_id);
  end if;

  update public.app_parameters
  set value = (v_next + 1)::text
  where tenant_id = p_tenant_id
    and lower(parameter) = 'family_ref';

  if not found then
    insert into public.app_parameters (parameter, value, tenant_id)
    values ('family_ref', (v_next + 1)::text, p_tenant_id);
  end if;

  return v_new_id;
end;
$$;

create or replace function public.find_profile_id_by_cpf(p_cpf text)
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_digits text := regexp_replace(coalesce(p_cpf, ''), '\D', '', 'g');
  v_id uuid;
begin
  if length(v_digits) <> 11 then
    return null;
  end if;

  select p.id
    into v_id
    from public.profiles p
   where regexp_replace(coalesce(p.cpf, ''), '\D', '', 'g') = v_digits
   order by
     case when public.is_super_admin_profile(p.id) then 1 else 0 end,
     p.updated_at desc nulls last
   limit 1;

  return v_id;
end;
$$;

create or replace function public.profile_origin_tenant_id(p_profile_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select v.tenant_id
        from public.profile_igreja_vinculos v
       where v.profile_id = p_profile_id
         and v.is_active = true
       order by v.is_primary desc, v.updated_at desc
       limit 1
    ),
    (select p.tenant_id from public.profiles p where p.id = p_profile_id)
  );
$$;

create or replace function public.assert_pastoral_transfer_actor(p_actor_profile_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_actor_profile_id is null then
    raise exception 'Sessão inválida. Saia e entre novamente no aplicativo.';
  end if;

  if public.is_super_admin_profile(p_actor_profile_id) then
    return;
  end if;

  if public.profile_has_role_code(p_actor_profile_id, 'pastoral') then
    return;
  end if;

  if public.profile_has_access(
    p_actor_profile_id,
    'screen',
    'maintenance.card.transferencia_igreja',
    'view'
  ) then
    return;
  end if;

  raise exception 'Apenas a Equipe Pastoral pode gerenciar transferências entre igrejas.';
end;
$$;

create or replace function public.transfer_dest_basic_role(p_profile_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case public.resolve_basic_role_code_for_profile(p_profile_id)
    when 'member' then 'member'
    else 'congregado'
  end;
$$;

create or replace function public.transfer_collect_people(
  p_origin_tenant_id uuid,
  p_profile_id uuid,
  p_include_family boolean
)
returns table (
  profile_id uuid,
  full_name text,
  phone text,
  origin_family_id text,
  origin_member_id uuid
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_family text;
begin
  select nullif(trim(coalesce(p.family_id, '')), '')
    into v_family
    from public.profiles p
   where p.id = p_profile_id;

  return query
  with seed as (
    select
      p.id as profile_id,
      trim(p.full_name) as full_name,
      nullif(trim(coalesce(p.phone, '')), '') as phone,
      nullif(trim(coalesce(p.family_id, '')), '') as origin_family_id,
      (
        select m.id
          from public.members m
         where m.tenant_id = p_origin_tenant_id
           and public.find_profile_id_by_phone(m.phone) = p.id
         order by m.accepted desc nulls last, m.created_at desc
         limit 1
      ) as origin_member_id
    from public.profiles p
    where p.id = p_profile_id
  ),
  family_profiles as (
    select
      p.id as profile_id,
      trim(p.full_name) as full_name,
      nullif(trim(coalesce(p.phone, '')), '') as phone,
      nullif(trim(coalesce(p.family_id, '')), '') as origin_family_id,
      (
        select m.id
          from public.members m
         where m.tenant_id = p_origin_tenant_id
           and public.find_profile_id_by_phone(m.phone) = p.id
         order by m.accepted desc nulls last, m.created_at desc
         limit 1
      ) as origin_member_id
    from public.profiles p
    where p_include_family
      and v_family is not null
      and (
        p.tenant_id = p_origin_tenant_id
        or exists (
          select 1
            from public.profile_igreja_vinculos v
           where v.profile_id = p.id
             and v.tenant_id = p_origin_tenant_id
             and v.is_active = true
        )
      )
      and (
        upper(trim(coalesce(p.family_id, ''))) = upper(v_family)
        or exists (
          select 1
            from public.members m
           where m.tenant_id = p_origin_tenant_id
             and upper(trim(coalesce(m.family_id, ''))) = upper(v_family)
             and public.find_profile_id_by_phone(m.phone) = p.id
        )
      )
  )
  select s.profile_id, s.full_name, s.phone, s.origin_family_id, s.origin_member_id
    from seed s
  union
  select f.profile_id, f.full_name, f.phone, f.origin_family_id, f.origin_member_id
    from family_profiles f
   where not public.is_super_admin_profile(f.profile_id);
end;
$$;

create or replace function public.transfer_request_to_json(p_request_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_req public.igreja_transfer_requests%rowtype;
  v_origin public.igrejas%rowtype;
  v_dest public.igrejas%rowtype;
begin
  select * into v_req from public.igreja_transfer_requests where id = p_request_id;
  if not found then
    return null;
  end if;

  select * into v_origin from public.igrejas where id = v_req.origin_tenant_id;
  select * into v_dest from public.igrejas where id = v_req.destination_tenant_id;

  return jsonb_build_object(
    'id', v_req.id,
    'status', v_req.status,
    'source', v_req.request_source,
    'scope', v_req.scope,
    'origin_tenant_id', v_req.origin_tenant_id,
    'origin_code', v_origin.code,
    'origin_name', v_origin.name,
    'destination_tenant_id', v_req.destination_tenant_id,
    'destination_code', v_dest.code,
    'destination_name', v_dest.name,
    'origin_family_id', v_req.origin_family_id,
    'dest_family_id', v_req.dest_family_id,
    'note', v_req.note,
    'decision_note', v_req.decision_note,
    'created_at', v_req.created_at,
    'decided_at', v_req.decided_at,
    'people', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'profile_id', tp.profile_id,
          'full_name', tp.full_name,
          'phone', tp.phone,
          'origin_family_id', tp.origin_family_id,
          'dest_family_id', tp.dest_family_id,
          'dest_basic_role', tp.dest_basic_role
        )
        order by tp.full_name
      )
      from public.igreja_transfer_people tp
      where tp.request_id = v_req.id
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.transfer_strip_leadership_roles(
  p_profile_id uuid,
  p_dest_tenant_id uuid,
  p_basic_role text,
  p_actor_profile_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role_id uuid;
  v_basic text := case when p_basic_role = 'member' then 'member' else 'congregado' end;
begin
  -- Regra de segurança: nenhum cargo/privilégio da origem segue para o destino.
  delete from public.profile_access_roles par
   using public.access_roles ar
   where par.profile_id = p_profile_id
     and par.role_id = ar.id
     and ar.code not in ('member', 'congregado');

  delete from public.profile_access_roles par
   using public.access_roles ar
   where par.profile_id = p_profile_id
     and par.role_id = ar.id
     and ar.code in ('member', 'congregado')
     and ar.code is distinct from v_basic;

  select ar.id into v_role_id from public.access_roles ar where ar.code = v_basic;

  if v_role_id is null then
    raise exception 'Papel básico % não encontrado.', v_basic;
  end if;

  insert into public.profile_access_roles (profile_id, role_id, granted_by_profile_id, tenant_id)
  values (p_profile_id, v_role_id, p_actor_profile_id, p_dest_tenant_id)
  on conflict (profile_id, role_id) do update
    set tenant_id = excluded.tenant_id,
        granted_by_profile_id = excluded.granted_by_profile_id,
        granted_at = now();

  update public.profile_access_roles
     set tenant_id = p_dest_tenant_id
   where profile_id = p_profile_id;
end;
$$;

create or replace function public.apply_igreja_transfer_request(
  p_request_id uuid,
  p_actor_profile_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_req public.igreja_transfer_requests%rowtype;
  v_dest_family text;
  v_person record;
  v_roles jsonb;
  v_basic text;
  v_dest_member_id uuid;
  v_origin_member public.members%rowtype;
  v_today date := (timezone('America/Sao_Paulo', now()))::date;
begin
  select * into v_req from public.igreja_transfer_requests where id = p_request_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'message', 'Pedido de transferência não encontrado.');
  end if;

  if v_req.status <> 'pending_origin' then
    return jsonb_build_object('ok', false, 'message', 'Este pedido já foi processado.');
  end if;

  v_dest_family := public.reserve_next_family_id_for_tenant(v_req.destination_tenant_id);

  for v_person in
    select *
      from public.igreja_transfer_people
     where request_id = p_request_id
  loop
    if public.is_super_admin_profile(v_person.profile_id) then
      raise exception 'Não é permitido transferir o Super Administrador.';
    end if;

    select coalesce(
      jsonb_agg(jsonb_build_object('code', ar.code, 'tenant_id', par.tenant_id) order by ar.code),
      '[]'::jsonb
    )
      into v_roles
      from public.profile_access_roles par
      join public.access_roles ar on ar.id = par.role_id
     where par.profile_id = v_person.profile_id;

    v_basic := public.transfer_dest_basic_role(v_person.profile_id);

    if v_person.origin_member_id is not null then
      select * into v_origin_member from public.members where id = v_person.origin_member_id;
    else
      v_origin_member := null;
    end if;

    update public.profile_igreja_vinculos
       set is_active = false,
           is_primary = false,
           membership_out = v_today,
           membership_status = 'Transferido',
           transferred_to_tenant_id = v_req.destination_tenant_id,
           transferred_at = now(),
           updated_at = now()
     where profile_id = v_person.profile_id
       and tenant_id = v_req.origin_tenant_id;

    if v_origin_member.id is not null then
      update public.members
         set accepted = false,
             "Accepted" = false
       where id = v_origin_member.id
         and tenant_id = v_req.origin_tenant_id;
    end if;

    update public.profiles
       set tenant_id = v_req.destination_tenant_id,
           family_id = v_dest_family,
           codigo_membro = v_dest_family,
           family_group_id = null,
           church_function = null,
           membership_out = null,
           "Membership_Out" = null
     where id = v_person.profile_id;

    insert into public.profile_igreja_vinculos (
      profile_id,
      tenant_id,
      is_primary,
      is_active,
      membership_out,
      membership_status,
      transferred_to_tenant_id,
      transferred_at,
      updated_at
    )
    values (
      v_person.profile_id,
      v_req.destination_tenant_id,
      true,
      true,
      null,
      'Ativo',
      null,
      null,
      now()
    )
    on conflict (profile_id, tenant_id) do update
      set is_primary = true,
          is_active = true,
          membership_out = null,
          membership_status = 'Ativo',
          transferred_to_tenant_id = null,
          transferred_at = null,
          updated_at = now();

    select m.id
      into v_dest_member_id
      from public.members m
     where m.tenant_id = v_req.destination_tenant_id
       and public.find_profile_id_by_phone(m.phone) = v_person.profile_id
     order by m.created_at desc
     limit 1;

    if v_dest_member_id is null then
      insert into public.members (
        full_name,
        is_responsavel,
        phone,
        birth_date,
        relationship,
        family_id,
        category,
        accepted,
        "Accepted",
        tenant_id
      )
      values (
        coalesce(nullif(trim(v_person.full_name), ''), (select trim(full_name) from public.profiles where id = v_person.profile_id)),
        coalesce(v_origin_member.is_responsavel, false),
        coalesce(
          v_person.phone,
          (select phone from public.profiles where id = v_person.profile_id)
        ),
        coalesce(
          v_origin_member.birth_date,
          (select birth_date from public.profiles where id = v_person.profile_id)
        ),
        coalesce(nullif(trim(v_origin_member.relationship), ''), 'Titular'),
        v_dest_family,
        coalesce(nullif(trim(v_origin_member.category), ''), 'member'),
        true,
        true,
        v_req.destination_tenant_id
      )
      returning id into v_dest_member_id;
    else
      update public.members
         set family_id = v_dest_family,
             accepted = true,
             "Accepted" = true,
             full_name = coalesce(nullif(trim(v_person.full_name), ''), full_name)
       where id = v_dest_member_id;
    end if;

    perform public.transfer_strip_leadership_roles(
      v_person.profile_id,
      v_req.destination_tenant_id,
      v_basic,
      p_actor_profile_id
    );

    update public.igreja_transfer_people
       set origin_roles = v_roles,
           dest_basic_role = v_basic,
           dest_family_id = v_dest_family,
           dest_member_id = v_dest_member_id
     where id = v_person.id;
  end loop;

  update public.igreja_transfer_requests
     set status = 'completed',
         dest_family_id = v_dest_family,
         decided_by_profile_id = p_actor_profile_id,
         decided_at = now(),
         updated_at = now()
   where id = p_request_id;

  return jsonb_build_object(
    'ok', true,
    'message', 'Transferência concluída. O(s) membro(s) ingressaram como congregado/membro comum.',
    'dest_family_id', v_dest_family,
    'request', public.transfer_request_to_json(p_request_id)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. Login / cadastro: conflito de celular ou CPF
-- ---------------------------------------------------------------------------

create or replace function public.lookup_login_phone_for_instance(p_phone text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.current_session_tenant_id();
  v_profile_id uuid;
  v_in_instance boolean := false;
  v_has_pin boolean := false;
  v_origin uuid;
  v_origin_igreja public.igrejas%rowtype;
  v_dest_igreja public.igrejas%rowtype;
  v_pending uuid;
begin
  if v_tenant is null then
    return jsonb_build_object(
      'ok', false,
      'error', 'no_instance',
      'message', 'Informe o código da instância da sua igreja para continuar.'
    );
  end if;

  v_profile_id := public.find_profile_id_by_phone(p_phone);

  if v_profile_id is null then
    return jsonb_build_object(
      'ok', true,
      'in_instance', false,
      'exists_elsewhere', false,
      'has_pin', false
    );
  end if;

  v_in_instance := public.profile_can_use_tenant(v_profile_id, v_tenant);

  select p.access_pin is not null
    into v_has_pin
    from public.profiles p
   where p.id = v_profile_id;

  v_origin := public.profile_origin_tenant_id(v_profile_id);
  select * into v_origin_igreja from public.igrejas where id = v_origin;
  select * into v_dest_igreja from public.igrejas where id = v_tenant;

  select r.id
    into v_pending
    from public.igreja_transfer_requests r
    join public.igreja_transfer_people tp on tp.request_id = r.id
   where tp.profile_id = v_profile_id
     and r.destination_tenant_id = v_tenant
     and r.status = 'pending_origin'
   order by r.created_at desc
   limit 1;

  return jsonb_build_object(
    'ok', true,
    'in_instance', v_in_instance,
    'exists_elsewhere', not v_in_instance,
    'has_pin', coalesce(v_has_pin, false),
    'can_request_transfer', (not v_in_instance) and v_origin is not null and v_origin is distinct from v_tenant,
    'pending_request_id', v_pending,
    'origin_tenant_id', v_origin,
    'origin_code', v_origin_igreja.code,
    'origin_name', v_origin_igreja.name,
    'destination_code', v_dest_igreja.code,
    'destination_name', v_dest_igreja.name
  );
end;
$$;

comment on function public.lookup_login_phone_for_instance(text) is
  'Indica se o celular está cadastrado na instância do x-tenant-id e se cabe solicitar transferência.';

create or replace function public.lookup_identity_conflict_for_instance(p_phone text, p_cpf text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_phone_lookup jsonb;
  v_tenant uuid := public.current_session_tenant_id();
  v_profile_id uuid;
  v_in_instance boolean := false;
  v_origin uuid;
  v_origin_igreja public.igrejas%rowtype;
  v_dest_igreja public.igrejas%rowtype;
  v_pending uuid;
begin
  if nullif(trim(coalesce(p_phone, '')), '') is not null then
    return public.lookup_login_phone_for_instance(p_phone);
  end if;

  if v_tenant is null then
    return jsonb_build_object(
      'ok', false,
      'error', 'no_instance',
      'message', 'Informe o código da instância da sua igreja para continuar.'
    );
  end if;

  v_profile_id := public.find_profile_id_by_cpf(p_cpf);

  if v_profile_id is null then
    return jsonb_build_object(
      'ok', true,
      'in_instance', false,
      'exists_elsewhere', false,
      'conflict_field', 'cpf'
    );
  end if;

  v_in_instance := public.profile_can_use_tenant(v_profile_id, v_tenant);
  v_origin := public.profile_origin_tenant_id(v_profile_id);
  select * into v_origin_igreja from public.igrejas where id = v_origin;
  select * into v_dest_igreja from public.igrejas where id = v_tenant;

  select r.id
    into v_pending
    from public.igreja_transfer_requests r
    join public.igreja_transfer_people tp on tp.request_id = r.id
   where tp.profile_id = v_profile_id
     and r.destination_tenant_id = v_tenant
     and r.status = 'pending_origin'
   order by r.created_at desc
   limit 1;

  return jsonb_build_object(
    'ok', true,
    'in_instance', v_in_instance,
    'exists_elsewhere', not v_in_instance,
    'conflict_field', 'cpf',
    'can_request_transfer', (not v_in_instance) and v_origin is not null and v_origin is distinct from v_tenant,
    'pending_request_id', v_pending,
    'origin_tenant_id', v_origin,
    'origin_code', v_origin_igreja.code,
    'origin_name', v_origin_igreja.name,
    'destination_code', v_dest_igreja.code,
    'destination_name', v_dest_igreja.name
  );
end;
$$;

drop function if exists public.solicitar_transferencia_membro_login(text);
drop function if exists public.solicitar_transferencia_membro_login(text, text);
drop function if exists public.solicitar_transferencia_membro_login(text, text, uuid);

create or replace function public.solicitar_transferencia_membro_login(
  p_phone text,
  p_note text default null,
  p_destination_tenant_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_dest uuid;
  v_profile_id uuid;
  v_origin uuid;
  v_request_id uuid;
  v_existing uuid;
  v_person record;
  v_family text;
begin
  v_dest := coalesce(p_destination_tenant_id, public.current_session_tenant_id());

  if v_dest is null or not exists (
    select 1 from public.igrejas i where i.id = v_dest and i.is_active = true
  ) then
    return jsonb_build_object(
      'ok', false,
      'message', 'Informe o código da instância da igreja de destino para solicitar a transferência.'
    );
  end if;

  v_profile_id := public.find_profile_id_by_phone(p_phone);
  if v_profile_id is null then
    return jsonb_build_object('ok', false, 'message', 'Celular não encontrado em nenhuma igreja.');
  end if;

  if public.is_super_admin_profile(v_profile_id) then
    return jsonb_build_object('ok', false, 'message', 'Este cadastro não pode ser transferido por este canal.');
  end if;

  if public.profile_can_use_tenant(v_profile_id, v_dest) then
    return jsonb_build_object('ok', false, 'message', 'Este celular já pertence a esta igreja.');
  end if;

  v_origin := public.profile_origin_tenant_id(v_profile_id);
  if v_origin is null or v_origin = v_dest then
    return jsonb_build_object('ok', false, 'message', 'Não foi possível identificar a igreja de origem.');
  end if;

  select r.id
    into v_existing
    from public.igreja_transfer_requests r
    join public.igreja_transfer_people tp on tp.request_id = r.id
   where tp.profile_id = v_profile_id
     and r.destination_tenant_id = v_dest
     and r.status = 'pending_origin'
   order by r.created_at desc
   limit 1;

  if v_existing is not null then
    return jsonb_build_object(
      'ok', true,
      'already_pending', true,
      'message', 'Já existe um pedido de transferência aguardando a igreja de origem.',
      'request', public.transfer_request_to_json(v_existing)
    );
  end if;

  select origin_family_id into v_family
    from public.transfer_collect_people(v_origin, v_profile_id, false)
   limit 1;

  insert into public.igreja_transfer_requests (
    origin_tenant_id,
    destination_tenant_id,
    request_source,
    scope,
    primary_profile_id,
    origin_family_id,
    phone,
    note,
    status
  )
  values (
    v_origin,
    v_dest,
    'member_login',
    'person',
    v_profile_id,
    v_family,
    p_phone,
    nullif(trim(coalesce(p_note, '')), ''),
    'pending_origin'
  )
  returning id into v_request_id;

  for v_person in
    select * from public.transfer_collect_people(v_origin, v_profile_id, false)
  loop
    insert into public.igreja_transfer_people (
      request_id, profile_id, origin_member_id, full_name, phone, origin_family_id
    )
    values (
      v_request_id,
      v_person.profile_id,
      v_person.origin_member_id,
      v_person.full_name,
      v_person.phone,
      v_person.origin_family_id
    );
  end loop;

  if not exists (
    select 1 from public.igreja_transfer_people tp where tp.request_id = v_request_id
  ) then
    raise exception 'Não foi possível vincular o membro ao pedido de transferência.';
  end if;

  return jsonb_build_object(
    'ok', true,
    'already_pending', false,
    'message', 'Pedido enviado à igreja de origem. Aguarde a confirmação pastoral.',
    'request', public.transfer_request_to_json(v_request_id)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. Painel pastoral (destino inicia / origem decide)
-- ---------------------------------------------------------------------------

create or replace function public.listar_igrejas_para_transferencia()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_actor uuid := public.current_session_profile_id();
  v_tenant uuid := public.current_session_tenant_id();
begin
  perform public.assert_pastoral_transfer_actor(v_actor);

  return coalesce((
    select jsonb_agg(
      jsonb_build_object('id', i.id, 'code', i.code, 'name', i.name)
      order by i.name
    )
    from public.igrejas i
    where i.is_active = true
      and i.id is distinct from v_tenant
  ), '[]'::jsonb);
end;
$$;

create or replace function public.pastoral_preview_transferencia_entrada(
  p_origin_tenant_id uuid,
  p_phone text default null,
  p_cpf text default null,
  p_family_code text default null,
  p_include_family boolean default false
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_actor uuid := public.current_session_profile_id();
  v_dest uuid := public.current_session_tenant_id();
  v_origin public.igrejas%rowtype;
  v_dest_igreja public.igrejas%rowtype;
  v_profile_id uuid;
  v_family text := upper(trim(coalesce(p_family_code, '')));
  v_include boolean := coalesce(p_include_family, false) or v_family <> '';
  v_people jsonb;
begin
  perform public.assert_pastoral_transfer_actor(v_actor);

  if v_dest is null then
    return jsonb_build_object('ok', false, 'message', 'Sessão sem igreja de destino.');
  end if;

  if p_origin_tenant_id is null or p_origin_tenant_id = v_dest then
    return jsonb_build_object('ok', false, 'message', 'Selecione a igreja de origem.');
  end if;

  select * into v_origin from public.igrejas where id = p_origin_tenant_id and is_active = true;
  if not found then
    return jsonb_build_object('ok', false, 'message', 'Igreja de origem não encontrada.');
  end if;

  select * into v_dest_igreja from public.igrejas where id = v_dest;

  if v_family <> '' then
    select p.id
      into v_profile_id
      from public.profiles p
     where (
        p.tenant_id = p_origin_tenant_id
        or exists (
          select 1
            from public.profile_igreja_vinculos v
           where v.profile_id = p.id
             and v.tenant_id = p_origin_tenant_id
             and v.is_active = true
        )
      )
       and (
         upper(trim(coalesce(p.family_id, ''))) = v_family
         or exists (
           select 1
             from public.members m
            where m.tenant_id = p_origin_tenant_id
              and upper(trim(coalesce(m.family_id, ''))) = v_family
              and public.find_profile_id_by_phone(m.phone) = p.id
         )
       )
       and not public.is_super_admin_profile(p.id)
     order by p.full_name
     limit 1;
  elsif nullif(trim(coalesce(p_phone, '')), '') is not null then
    v_profile_id := public.find_profile_id_by_phone(p_phone);
  else
    v_profile_id := public.find_profile_id_by_cpf(p_cpf);
  end if;

  if v_profile_id is null then
    return jsonb_build_object('ok', false, 'message', 'Nenhum membro encontrado com os dados informados.');
  end if;

  if public.is_super_admin_profile(v_profile_id) then
    return jsonb_build_object('ok', false, 'message', 'Este cadastro não pode ser transferido.');
  end if;

  if public.profile_origin_tenant_id(v_profile_id) is distinct from p_origin_tenant_id then
    return jsonb_build_object(
      'ok', false,
      'message', 'O cadastro encontrado não pertence à igreja de origem selecionada.'
    );
  end if;

  if public.profile_can_use_tenant(v_profile_id, v_dest) then
    return jsonb_build_object('ok', false, 'message', 'Este membro já está vinculado a esta igreja.');
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'profile_id', t.profile_id,
        'full_name', t.full_name,
        'phone', t.phone,
        'origin_family_id', t.origin_family_id,
        'dest_basic_role', public.transfer_dest_basic_role(t.profile_id)
      )
      order by t.full_name
    ),
    '[]'::jsonb
  )
    into v_people
    from public.transfer_collect_people(p_origin_tenant_id, v_profile_id, v_include) t;

  return jsonb_build_object(
    'ok', true,
    'origin_code', v_origin.code,
    'origin_name', v_origin.name,
    'destination_code', v_dest_igreja.code,
    'destination_name', v_dest_igreja.name,
    'primary_profile_id', v_profile_id,
    'include_family', v_include,
    'people', v_people
  );
end;
$$;

create or replace function public.pastoral_iniciar_transferencia_entrada(
  p_origin_tenant_id uuid,
  p_phone text default null,
  p_cpf text default null,
  p_family_code text default null,
  p_include_family boolean default false,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := public.current_session_profile_id();
  v_dest uuid := public.current_session_tenant_id();
  v_preview jsonb;
  v_profile_id uuid;
  v_include boolean;
  v_request_id uuid;
  v_existing uuid;
  v_person record;
  v_family text;
begin
  perform public.assert_pastoral_transfer_actor(v_actor);

  v_preview := public.pastoral_preview_transferencia_entrada(
    p_origin_tenant_id,
    p_phone,
    p_cpf,
    p_family_code,
    p_include_family
  );

  if coalesce((v_preview ->> 'ok')::boolean, false) is not true then
    return v_preview;
  end if;

  v_profile_id := (v_preview ->> 'primary_profile_id')::uuid;
  v_include := coalesce((v_preview ->> 'include_family')::boolean, false);

  select tp.request_id
    into v_existing
    from public.igreja_transfer_people tp
    join public.igreja_transfer_requests r on r.id = tp.request_id
   where tp.profile_id = v_profile_id
     and r.destination_tenant_id = v_dest
     and r.status = 'pending_origin'
   limit 1;

  if v_existing is not null then
    return jsonb_build_object(
      'ok', true,
      'already_pending', true,
      'message', 'Já existe um pedido pendente para este membro nesta igreja.',
      'request', public.transfer_request_to_json(v_existing)
    );
  end if;

  select t.origin_family_id
    into v_family
    from public.transfer_collect_people(p_origin_tenant_id, v_profile_id, v_include) t
   where t.origin_family_id is not null
   limit 1;

  insert into public.igreja_transfer_requests (
    origin_tenant_id,
    destination_tenant_id,
    request_source,
    scope,
    primary_profile_id,
    origin_family_id,
    phone,
    cpf,
    note,
    status,
    requested_by_profile_id
  )
  values (
    p_origin_tenant_id,
    v_dest,
    'destination_pastoral',
    case when v_include then 'family' else 'person' end,
    v_profile_id,
    v_family,
    nullif(trim(coalesce(p_phone, '')), ''),
    regexp_replace(coalesce(p_cpf, ''), '\D', '', 'g'),
    nullif(trim(coalesce(p_note, '')), ''),
    'pending_origin',
    v_actor
  )
  returning id into v_request_id;

  for v_person in
    select * from public.transfer_collect_people(p_origin_tenant_id, v_profile_id, v_include)
  loop
    insert into public.igreja_transfer_people (
      request_id, profile_id, origin_member_id, full_name, phone, origin_family_id
    )
    values (
      v_request_id,
      v_person.profile_id,
      v_person.origin_member_id,
      v_person.full_name,
      v_person.phone,
      v_person.origin_family_id
    )
    on conflict (request_id, profile_id) do nothing;
  end loop;

  return jsonb_build_object(
    'ok', true,
    'already_pending', false,
    'message', 'Pedido enviado à igreja de origem.',
    'request', public.transfer_request_to_json(v_request_id)
  );
end;
$$;

create or replace function public.listar_transferencias_pastoral()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_actor uuid := public.current_session_profile_id();
  v_tenant uuid := public.current_session_tenant_id();
begin
  perform public.assert_pastoral_transfer_actor(v_actor);

  return jsonb_build_object(
    'ok', true,
    'inbound', coalesce((
      select jsonb_agg(public.transfer_request_to_json(r.id) order by r.created_at desc)
        from public.igreja_transfer_requests r
       where r.origin_tenant_id = v_tenant
         and r.status in ('pending_origin', 'completed', 'rejected')
    ), '[]'::jsonb),
    'outbound', coalesce((
      select jsonb_agg(public.transfer_request_to_json(r.id) order by r.created_at desc)
        from public.igreja_transfer_requests r
       where r.destination_tenant_id = v_tenant
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.pastoral_decidir_transferencia_origem(
  p_request_id uuid,
  p_approve boolean,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := public.current_session_profile_id();
  v_tenant uuid := public.current_session_tenant_id();
  v_req public.igreja_transfer_requests%rowtype;
begin
  perform public.assert_pastoral_transfer_actor(v_actor);

  select * into v_req
    from public.igreja_transfer_requests
   where id = p_request_id
   for update;

  if not found then
    return jsonb_build_object('ok', false, 'message', 'Pedido não encontrado.');
  end if;

  if v_req.origin_tenant_id is distinct from v_tenant
     and not public.is_super_admin_profile(v_actor) then
    return jsonb_build_object('ok', false, 'message', 'Somente a igreja de origem pode decidir este pedido.');
  end if;

  if v_req.status <> 'pending_origin' then
    return jsonb_build_object('ok', false, 'message', 'Este pedido já foi processado.');
  end if;

  if coalesce(p_approve, false) then
    return public.apply_igreja_transfer_request(p_request_id, v_actor);
  end if;

  update public.igreja_transfer_requests
     set status = 'rejected',
         decided_by_profile_id = v_actor,
         decided_at = now(),
         decision_note = nullif(trim(coalesce(p_note, '')), ''),
         updated_at = now()
   where id = p_request_id;

  return jsonb_build_object(
    'ok', true,
    'message', 'Pedido recusado. O cadastro permanece na igreja de origem.',
    'request', public.transfer_request_to_json(p_request_id)
  );
end;
$$;

create or replace function public.pastoral_cancelar_transferencia_destino(p_request_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := public.current_session_profile_id();
  v_tenant uuid := public.current_session_tenant_id();
  v_req public.igreja_transfer_requests%rowtype;
begin
  perform public.assert_pastoral_transfer_actor(v_actor);

  select * into v_req
    from public.igreja_transfer_requests
   where id = p_request_id
   for update;

  if not found then
    return jsonb_build_object('ok', false, 'message', 'Pedido não encontrado.');
  end if;

  if v_req.destination_tenant_id is distinct from v_tenant
     and not public.is_super_admin_profile(v_actor) then
    return jsonb_build_object('ok', false, 'message', 'Somente a igreja de destino pode cancelar este pedido.');
  end if;

  if v_req.status <> 'pending_origin' then
    return jsonb_build_object('ok', false, 'message', 'Este pedido já foi processado.');
  end if;

  update public.igreja_transfer_requests
     set status = 'cancelled',
         decided_by_profile_id = v_actor,
         decided_at = now(),
         updated_at = now()
   where id = p_request_id;

  return jsonb_build_object(
    'ok', true,
    'message', 'Pedido cancelado.',
    'request', public.transfer_request_to_json(p_request_id)
  );
end;
$$;

grant execute on function public.get_family_id_prefix_for_tenant(uuid) to anon, authenticated;
grant execute on function public.reserve_next_family_id_for_tenant(uuid) to anon, authenticated;
grant execute on function public.find_profile_id_by_cpf(text) to anon, authenticated;
grant execute on function public.profile_origin_tenant_id(uuid) to anon, authenticated;
grant execute on function public.assert_pastoral_transfer_actor(uuid) to anon, authenticated;
grant execute on function public.transfer_dest_basic_role(uuid) to anon, authenticated;
grant execute on function public.transfer_collect_people(uuid, uuid, boolean) to anon, authenticated;
grant execute on function public.transfer_request_to_json(uuid) to anon, authenticated;
grant execute on function public.transfer_strip_leadership_roles(uuid, uuid, text, uuid) to anon, authenticated;
grant execute on function public.apply_igreja_transfer_request(uuid, uuid) to anon, authenticated;
grant execute on function public.lookup_login_phone_for_instance(text) to anon, authenticated;
grant execute on function public.lookup_identity_conflict_for_instance(text, text) to anon, authenticated;
grant execute on function public.solicitar_transferencia_membro_login(text, text, uuid) to anon, authenticated;
grant execute on function public.listar_igrejas_para_transferencia() to anon, authenticated;
grant execute on function public.pastoral_preview_transferencia_entrada(uuid, text, text, text, boolean) to anon, authenticated;
grant execute on function public.pastoral_iniciar_transferencia_entrada(uuid, text, text, text, boolean, text) to anon, authenticated;
grant execute on function public.listar_transferencias_pastoral() to anon, authenticated;
grant execute on function public.pastoral_decidir_transferencia_origem(uuid, boolean, text) to anon, authenticated;
grant execute on function public.pastoral_cancelar_transferencia_destino(uuid) to anon, authenticated;

commit;
