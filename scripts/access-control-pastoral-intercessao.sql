-- Acesso a pastoral_requests por destino e escala de intercessão.
-- Regra:
--   • Equipe pastoral (papel pastoral) e super_admin: todos os pedidos (inclui Sigilo Pastoral).
--   • Servo cadastrado na escala de intercessão: só pedidos com destination_label de intercessão.
--   • Sigilo Pastoral: nunca para intercessão (exceto o próprio solicitante vendo o seu).
--   • Qualquer perfil: sempre vê os próprios pedidos.
--
-- Execute após: access-control-schema.sql, access-control-table-rls.sql,
--               escalas-volunteers-rpc.sql, pastoral-requests-fields.sql

-- ---------------------------------------------------------------------------
-- Recursos ACL (painel Cuidado Pastoral)
-- ---------------------------------------------------------------------------

insert into public.access_resources (resource_type, resource_key, label, description)
values
  ('screen', 'maintenance.card.pastoral_care', 'Manutenção: Cuidado Pastoral', 'Triagem de pedidos pastorais')
on conflict (resource_type, resource_key) do update
  set label = excluded.label,
      description = excluded.description;

-- Equipe pastoral: acesso completo ao painel e tabela
insert into public.access_grants (role_id, resource_id, can_view, can_update)
select r.id, res.id, true, true
  from public.access_roles r
 cross join public.access_resources res
 where r.code = 'pastoral'
   and (
     (res.resource_type = 'screen' and res.resource_key = 'maintenance.card.pastoral_care')
     or (res.resource_type = 'table' and res.resource_key = 'pastoral_requests')
   )
on conflict (role_id, resource_id) where (role_id is not null) do update
  set can_view = excluded.can_view,
      can_update = excluded.can_update,
      updated_at = now();

-- ---------------------------------------------------------------------------
-- Helpers: tipo de escala / destino pastoral
-- ---------------------------------------------------------------------------

create or replace function public.is_intercession_scale_type(p_codigo text, p_nome text)
returns boolean
language sql
immutable
as $$
  select
    lower(trim(coalesce(p_codigo, ''))) like '%intercess%'
    or lower(trim(coalesce(p_nome, ''))) like '%intercess%'
    or (
      lower(trim(coalesce(p_nome, ''))) like '%ministerio%'
      and lower(trim(coalesce(p_nome, ''))) like '%intercess%'
    )
    or (
      lower(trim(coalesce(p_nome, ''))) like '%ministério%'
      and lower(trim(coalesce(p_nome, ''))) like '%intercess%'
    );
$$;

create or replace function public.pastoral_destination_label_is_sigilo(p_label text)
returns boolean
language sql
immutable
as $$
  select
    lower(trim(coalesce(p_label, ''))) = 'sigilo pastoral'
    or lower(trim(coalesce(p_label, ''))) like 'sigilo%pastoral%';
$$;

create or replace function public.pastoral_destination_label_is_intercession(p_label text)
returns boolean
language sql
immutable
as $$
  select
    lower(trim(coalesce(p_label, ''))) in (
      'ministério de intercessão',
      'ministerio de intercessao',
      'ministerio de intercessão',
      'ministério de intercessao'
    )
    or (
      lower(trim(coalesce(p_label, ''))) like '%intercess%'
      and not public.pastoral_destination_label_is_sigilo(p_label)
    );
$$;

create or replace function public.profile_is_intercession_scale_volunteer(p_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.profiles p
      join public.voluntarios_escala ve
        on ve.is_ativo = true
       and lower(trim(ve.nome)) = lower(trim(p.full_name))
      join public.tipos_escala te
        on te.id = ve.tipo_escala_id
       and te.is_ativa = true
     where p.id = p_profile_id
       and nullif(trim(p.full_name), '') is not null
       and public.is_intercession_scale_type(te.codigo, te.nome)
  );
$$;

create or replace function public.session_profile_is_intercession_scale_volunteer()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.profile_is_intercession_scale_volunteer(public.current_session_profile_id());
$$;

create or replace function public.session_has_full_pastoral_requests_access()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_super_admin_profile(public.current_session_profile_id())
    or exists (
      select 1
        from public.profile_access_roles par
        join public.access_roles ar on ar.id = par.role_id
       where par.profile_id = public.current_session_profile_id()
         and ar.code = 'pastoral'
    );
$$;

create or replace function public.session_can_view_pastoral_request(
  p_request_profile_id uuid,
  p_destination_label text
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    p_request_profile_id::text = public.current_session_profile_id()::text
    or public.session_has_full_pastoral_requests_access()
    or (
      public.session_profile_is_intercession_scale_volunteer()
      and public.pastoral_destination_label_is_intercession(p_destination_label)
      and not public.pastoral_destination_label_is_sigilo(p_destination_label)
    );
$$;

create or replace function public.session_can_update_pastoral_request(
  p_request_profile_id uuid,
  p_destination_label text
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.session_can_view_pastoral_request(p_request_profile_id, p_destination_label)
     and (
       public.session_has_full_pastoral_requests_access()
       or public.session_profile_is_intercession_scale_volunteer()
       or p_request_profile_id::text = public.current_session_profile_id()::text
     );
$$;

create or replace function public.session_can_access_pastoral_care_panel()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.session_has_full_pastoral_requests_access()
    or public.session_profile_is_intercession_scale_volunteer()
    or public.session_has_resource_access('screen', 'maintenance.card.pastoral_care', 'view');
$$;

-- ---------------------------------------------------------------------------
-- RLS: pastoral_requests
-- ---------------------------------------------------------------------------

alter table public.pastoral_requests enable row level security;

drop policy if exists pastoral_requests_select_acl on public.pastoral_requests;
create policy pastoral_requests_select_acl
  on public.pastoral_requests
  for select
  to anon, authenticated
  using (
    public.session_can_view_pastoral_request(profile_id, destination_label)
  );

drop policy if exists pastoral_requests_insert_acl on public.pastoral_requests;
create policy pastoral_requests_insert_acl
  on public.pastoral_requests
  for insert
  to anon, authenticated
  with check (
    profile_id::text = public.current_session_profile_id()::text
    and (
      not public.acl_enforcement_enabled()
      or public.session_has_resource_access('table', 'pastoral_requests', 'update')
    )
  );

drop policy if exists pastoral_requests_update_policy on public.pastoral_requests;
drop policy if exists pastoral_requests_update_acl on public.pastoral_requests;
create policy pastoral_requests_update_acl
  on public.pastoral_requests
  for update
  to anon, authenticated
  using (
    public.session_can_update_pastoral_request(profile_id, destination_label)
  )
  with check (
    public.session_can_update_pastoral_request(profile_id, destination_label)
  );

grant select, insert, update on public.pastoral_requests to anon, authenticated;

-- ---------------------------------------------------------------------------
-- RPCs de manutenção pastoral
-- ---------------------------------------------------------------------------

drop function if exists public.listar_solicitantes_pedido_pastoral();

create or replace function public.listar_solicitantes_pedido_pastoral()
returns table (
  profile_id uuid,
  full_name text,
  phone text,
  request_count bigint
)
language sql
security definer
set search_path = public
as $$
  select
    p.id as profile_id,
    trim(p.full_name) as full_name,
    nullif(trim(coalesce(p.phone, '')), '') as phone,
    count(pr.id)::bigint as request_count
  from public.profiles p
  inner join public.pastoral_requests pr on pr.profile_id = p.id
  where p.full_name is not null
    and trim(p.full_name) <> ''
    and public.session_can_view_pastoral_request(pr.profile_id, pr.destination_label)
  group by p.id, p.full_name, p.phone
  order by trim(p.full_name) asc;
$$;

drop function if exists public.atualizar_status_pedido_pastoral(uuid, text);

create or replace function public.atualizar_status_pedido_pastoral(
  p_request_id uuid,
  p_status text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
  v_current text;
  v_current_idx integer;
  v_target_idx integer;
  v_updated_at timestamptz;
  v_profile_id uuid;
  v_destination_label text;
begin
  if p_request_id is null then
    return jsonb_build_object('success', false, 'message', 'Pedido não informado.');
  end if;

  v_status := case lower(trim(coalesce(p_status, '')))
    when 'acolher' then 'Acolher'
    when 'apoiar' then 'Apoiar'
    when 'acompanhar' then 'Acompanhar'
    else ''
  end;

  if v_status = '' then
    return jsonb_build_object(
      'success', false,
      'message', 'Status inválido. Use Acolher, Apoiar ou Acompanhar.'
    );
  end if;

  select
    pr.profile_id,
    pr.destination_label,
    trim(coalesce(pr.status::text, ''))
  into v_profile_id, v_destination_label, v_current
  from public.pastoral_requests pr
  where pr.id = p_request_id;

  if not found then
    return jsonb_build_object('success', false, 'message', 'Pedido pastoral não encontrado.');
  end if;

  if not public.session_can_update_pastoral_request(v_profile_id, v_destination_label) then
    return jsonb_build_object(
      'success', false,
      'message', 'Sem permissão para atualizar este pedido pastoral.'
    );
  end if;

  v_current_idx := public.pastoral_follow_up_stage_index(v_current);
  v_target_idx := public.pastoral_follow_up_stage_index(v_status);

  if v_target_idx <> v_current_idx + 1 then
    if v_target_idx = 0 and v_current_idx >= 0 then
      return jsonb_build_object(
        'success', false,
        'message', 'Este pedido já está em acompanhamento pastoral.'
      );
    end if;

    if v_target_idx = 1 then
      return jsonb_build_object(
        'success', false,
        'message', 'Marque Acolher antes de Apoiar.'
      );
    end if;

    return jsonb_build_object(
      'success', false,
      'message', 'Marque Apoiar antes de Acompanhar.'
    );
  end if;

  update public.pastoral_requests pr
  set
    status = v_status,
    updated_at = now()
  where pr.id = p_request_id
  returning pr.status::text, pr.updated_at into v_status, v_updated_at;

  if not found then
    return jsonb_build_object('success', false, 'message', 'Pedido pastoral não encontrado.');
  end if;

  return jsonb_build_object(
    'success', true,
    'message', 'Estágio de acompanhamento atualizado.',
    'status', v_status,
    'updated_at', v_updated_at
  );
end;
$$;

grant execute on function public.is_intercession_scale_type(text, text) to anon, authenticated;
grant execute on function public.pastoral_destination_label_is_intercession(text) to anon, authenticated;
grant execute on function public.pastoral_destination_label_is_sigilo(text) to anon, authenticated;
grant execute on function public.profile_is_intercession_scale_volunteer(uuid) to anon, authenticated;
grant execute on function public.session_profile_is_intercession_scale_volunteer() to anon, authenticated;
grant execute on function public.session_has_full_pastoral_requests_access() to anon, authenticated;
grant execute on function public.session_can_view_pastoral_request(uuid, text) to anon, authenticated;
grant execute on function public.session_can_update_pastoral_request(uuid, text) to anon, authenticated;
grant execute on function public.session_can_access_pastoral_care_panel() to anon, authenticated;
grant execute on function public.listar_solicitantes_pedido_pastoral() to anon, authenticated;
grant execute on function public.atualizar_status_pedido_pastoral(uuid, text) to anon, authenticated;

notify pgrst, 'reload schema';
