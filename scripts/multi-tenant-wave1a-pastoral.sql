-- =============================================================================
-- Multi-tenancy — onda 1a: RPCs de pedidos pastorais (tenant isolation)
-- =============================================================================
-- Pré-requisito: scripts/multi-tenant-wave0-helper.sql (require_session_tenant_id).
-- Fontes canônicas:
--   pastoral-maintenance-rpc.sql          → listar_solicitantes_pedido_pastoral
--   pastoral-request-cancellation.sql     → request_my_pastoral_cancellation,
--                                           approve_pastoral_cancellation,
--                                           list_my_pastoral_requests,
--                                           listar_pedidos_pastoral_perfil
--   pastoral-request-handler.sql          → atualizar_status_pedido_pastoral
--   pastoral-request-delete-rpc.sql       → delete_my_pastoral_request
--   pastoral-requests-fields.sql          → insert_pastoral_request
-- =============================================================================

begin;

-- ---------------------------------------------------------------------------
-- listar_solicitantes_pedido_pastoral
-- ---------------------------------------------------------------------------
create or replace function public.listar_solicitantes_pedido_pastoral()
returns table (
  profile_id uuid,
  full_name text,
  phone text,
  request_count bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
begin
  return query
  select
    p.id as profile_id,
    trim(p.full_name) as full_name,
    nullif(trim(coalesce(p.phone, '')), '') as phone,
    count(pr.id)::bigint as request_count
  from public.profiles p
  inner join public.pastoral_requests pr
    on pr.profile_id = p.id
   and pr.tenant_id = v_tenant
  where p.tenant_id = v_tenant
    and p.full_name is not null
    and trim(p.full_name) <> ''
    and public.session_can_view_pastoral_request(pr.profile_id, pr.destination_label)
  group by p.id, p.full_name, p.phone
  order by trim(p.full_name) asc;
end;
$$;

grant execute on function public.listar_solicitantes_pedido_pastoral() to anon;
grant execute on function public.listar_solicitantes_pedido_pastoral() to authenticated;

-- ---------------------------------------------------------------------------
-- request_my_pastoral_cancellation
-- ---------------------------------------------------------------------------
create or replace function public.request_my_pastoral_cancellation(
  p_request_id uuid,
  p_profile_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
  v_profile_phone_digits text;
  v_request public.pastoral_requests%rowtype;
  v_status text;
  v_follow_up_idx integer;
  v_reason text;
begin
  perform public.assert_session_profile_matches(p_profile_id);

  if p_request_id is null then
    return jsonb_build_object('success', false, 'message', 'Pedido não informado.');
  end if;

  select regexp_replace(coalesce(p.phone, ''), '\D', '', 'g')
  into v_profile_phone_digits
  from public.profiles p
  where p.id = p_profile_id
    and p.tenant_id = v_tenant;

  if not found then
    return jsonb_build_object('success', false, 'message', 'Perfil não encontrado.');
  end if;

  select *
  into v_request
  from public.pastoral_requests pr
  where pr.id = p_request_id
    and pr.tenant_id = v_tenant
    and (
      pr.profile_id = p_profile_id
      or (
        v_profile_phone_digits <> ''
        and regexp_replace(coalesce(pr.phone, ''), '\D', '', 'g') = v_profile_phone_digits
      )
    );

  if not found then
    return jsonb_build_object('success', false, 'message', 'Pedido não encontrado.');
  end if;

  v_status := lower(trim(coalesce(v_request.status::text, '')));
  v_follow_up_idx := public.pastoral_follow_up_stage_index(v_request.status::text);

  if v_follow_up_idx < 0 and v_status not in ('in_progress', 'closed', 'cancelled') then
    return jsonb_build_object(
      'success', false,
      'message', 'Este pedido ainda pode ser excluído diretamente, sem solicitar cancelamento.'
    );
  end if;

  v_reason := nullif(trim(coalesce(p_reason, '')), '');

  if v_reason is null or length(v_reason) < 3 then
    return jsonb_build_object(
      'success', false,
      'message', 'Informe uma justificativa com pelo menos 3 caracteres.'
    );
  end if;

  if v_request.cancellation_requested_at is not null then
    return jsonb_build_object(
      'success', true,
      'message', 'Cancelamento já solicitado. Aguarde o Cuidado Pastoral.',
      'cancellation_requested_at', v_request.cancellation_requested_at,
      'cancellation_request_reason', v_request.cancellation_request_reason
    );
  end if;

  update public.pastoral_requests pr
  set cancellation_requested_at = now(),
      cancellation_request_reason = v_reason,
      updated_at = now()
  where pr.id = p_request_id
    and pr.tenant_id = v_tenant
  returning pr.cancellation_requested_at, pr.cancellation_request_reason
  into v_request.cancellation_requested_at, v_request.cancellation_request_reason;

  return jsonb_build_object(
    'success', true,
    'message', 'Solicitação de cancelamento enviada ao Cuidado Pastoral.',
    'cancellation_requested_at', v_request.cancellation_requested_at,
    'cancellation_request_reason', v_request.cancellation_request_reason
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- approve_pastoral_cancellation
-- ---------------------------------------------------------------------------
create or replace function public.approve_pastoral_cancellation(p_request_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
  v_session_id uuid;
  v_request public.pastoral_requests%rowtype;
begin
  if p_request_id is null then
    return jsonb_build_object('success', false, 'message', 'Pedido não informado.');
  end if;

  v_session_id := public.current_session_profile_id();

  if v_session_id is null then
    return jsonb_build_object(
      'success', false,
      'message', 'Sessão inválida. Saia e entre novamente no aplicativo.'
    );
  end if;

  select *
  into v_request
  from public.pastoral_requests pr
  where pr.id = p_request_id
    and pr.tenant_id = v_tenant;

  if not found then
    return jsonb_build_object('success', false, 'message', 'Pedido pastoral não encontrado.');
  end if;

  if v_request.cancellation_requested_at is null then
    return jsonb_build_object(
      'success', false,
      'message', 'Nenhuma solicitação de cancelamento para este pedido.'
    );
  end if;

  if not public.is_super_admin_profile(v_session_id) then
    return jsonb_build_object(
      'success', false,
      'message', 'Apenas super administradores podem confirmar o cancelamento de pedidos pastorais.'
    );
  end if;

  delete from public.pastoral_requests pr
  where pr.id = p_request_id
    and pr.tenant_id = v_tenant;

  return jsonb_build_object(
    'success', true,
    'message', 'Pedido pastoral cancelado e removido.'
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- list_my_pastoral_requests
-- ---------------------------------------------------------------------------
create or replace function public.list_my_pastoral_requests(p_profile_id uuid)
returns table (
  id uuid,
  created_at timestamptz,
  motivo text,
  situacao text,
  description text,
  destination_label text,
  request_for text,
  beneficiary_name text,
  beneficiary_relationship text,
  beneficiary_details text,
  status text,
  confidential boolean,
  handler_profile_id uuid,
  handler_name text,
  cancellation_requested_at timestamptz,
  cancellation_request_reason text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
  v_profile_phone_digits text;
begin
  perform public.assert_session_profile_matches(p_profile_id);

  select regexp_replace(coalesce(p.phone, ''), '\D', '', 'g')
  into v_profile_phone_digits
  from public.profiles p
  where p.id = p_profile_id
    and p.tenant_id = v_tenant;

  if not found then
    raise exception 'Perfil não encontrado.';
  end if;

  return query
  select
    pr.id,
    pr.created_at,
    pr.motivo,
    pr.situacao,
    pr.description,
    pr.destination_label,
    pr.request_for,
    pr.beneficiary_name,
    pr.beneficiary_relationship,
    pr.beneficiary_details,
    pr.status::text,
    coalesce(pr.confidential, false),
    pr.handler_profile_id,
    nullif(trim(coalesce(pr.handler_name, '')), '') as handler_name,
    pr.cancellation_requested_at,
    nullif(trim(coalesce(pr.cancellation_request_reason, '')), '') as cancellation_request_reason
  from public.pastoral_requests pr
  where pr.tenant_id = v_tenant
    and (
      pr.profile_id = p_profile_id
      or (
        v_profile_phone_digits <> ''
        and regexp_replace(coalesce(pr.phone, ''), '\D', '', 'g') = v_profile_phone_digits
      )
    )
  order by pr.created_at desc;
end;
$$;

-- ---------------------------------------------------------------------------
-- listar_pedidos_pastoral_perfil
-- ---------------------------------------------------------------------------
create or replace function public.listar_pedidos_pastoral_perfil(p_profile_id uuid)
returns table (
  id uuid,
  created_at timestamptz,
  motivo text,
  situacao text,
  description text,
  destination_label text,
  request_for text,
  beneficiary_name text,
  beneficiary_relationship text,
  beneficiary_details text,
  status text,
  confidential boolean,
  updated_at timestamptz,
  handler_profile_id uuid,
  handler_name text,
  cancellation_requested_at timestamptz,
  cancellation_request_reason text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
begin
  return query
  select
    pr.id,
    pr.created_at,
    pr.motivo,
    pr.situacao,
    pr.description,
    pr.destination_label,
    pr.request_for,
    pr.beneficiary_name,
    pr.beneficiary_relationship,
    pr.beneficiary_details,
    pr.status::text,
    pr.confidential,
    pr.updated_at,
    pr.handler_profile_id,
    nullif(trim(coalesce(pr.handler_name, '')), '') as handler_name,
    pr.cancellation_requested_at,
    nullif(trim(coalesce(pr.cancellation_request_reason, '')), '') as cancellation_request_reason
  from public.pastoral_requests pr
  where pr.tenant_id = v_tenant
    and pr.profile_id = p_profile_id
    and public.session_can_view_pastoral_request(pr.profile_id, pr.destination_label)
  order by pr.created_at desc;
end;
$$;

-- ---------------------------------------------------------------------------
-- atualizar_status_pedido_pastoral (versão completa com handler)
-- ---------------------------------------------------------------------------
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
  v_tenant uuid := public.require_session_tenant_id();
  v_status text;
  v_current text;
  v_current_idx integer;
  v_target_idx integer;
  v_updated_at timestamptz;
  v_profile_id uuid;
  v_destination_label text;
  v_handler_profile_id uuid;
  v_handler_name text;
  v_session_id uuid;
begin
  if p_request_id is null then
    return jsonb_build_object('success', false, 'message', 'Pedido não informado.');
  end if;

  v_session_id := public.current_session_profile_id();

  if v_session_id is null then
    return jsonb_build_object(
      'success', false,
      'message', 'Sessão inválida. Saia e entre novamente no aplicativo.'
    );
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
    trim(coalesce(pr.status::text, '')),
    pr.handler_profile_id
  into v_profile_id, v_destination_label, v_current, v_handler_profile_id
  from public.pastoral_requests pr
  where pr.id = p_request_id
    and pr.tenant_id = v_tenant;

  if not found then
    return jsonb_build_object('success', false, 'message', 'Pedido pastoral não encontrado.');
  end if;

  if not public.session_can_update_pastoral_request_row(
    p_request_id,
    v_profile_id,
    v_destination_label,
    v_handler_profile_id
  ) then
    return jsonb_build_object(
      'success', false,
      'message',
      case
        when public.pastoral_destination_label_is_intercession(v_destination_label)
          and v_handler_profile_id is not null
          and v_handler_profile_id <> v_session_id
        then 'Este pedido já está em acompanhamento por outra pessoa (somente leitura).'
        else 'Sem permissão para atualizar este pedido pastoral.'
      end
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

  if v_status = 'Acolher' and v_handler_profile_id is null then
    select nullif(trim(coalesce(p.full_name, '')), '')
      into v_handler_name
      from public.profiles p
     where p.id = v_session_id
       and p.tenant_id = v_tenant
     limit 1;

    update public.pastoral_requests pr
    set
      status = v_status,
      updated_at = now(),
      handler_profile_id = v_session_id,
      handler_name = coalesce(v_handler_name, 'Responsável')
    where pr.id = p_request_id
      and pr.tenant_id = v_tenant
    returning pr.status::text, pr.updated_at, pr.handler_profile_id, pr.handler_name
      into v_status, v_updated_at, v_handler_profile_id, v_handler_name;
  else
    update public.pastoral_requests pr
    set
      status = v_status,
      updated_at = now()
    where pr.id = p_request_id
      and pr.tenant_id = v_tenant
    returning pr.status::text, pr.updated_at, pr.handler_profile_id, pr.handler_name
      into v_status, v_updated_at, v_handler_profile_id, v_handler_name;
  end if;

  if not found then
    return jsonb_build_object('success', false, 'message', 'Pedido pastoral não encontrado.');
  end if;

  return jsonb_build_object(
    'success', true,
    'message', 'Estágio de acompanhamento atualizado.',
    'status', v_status,
    'updated_at', v_updated_at,
    'handler_profile_id', v_handler_profile_id,
    'handler_name', v_handler_name
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- delete_my_pastoral_request
-- ---------------------------------------------------------------------------
create or replace function public.delete_my_pastoral_request(
  p_request_id uuid,
  p_profile_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
  v_profile_phone_digits text;
  v_request public.pastoral_requests%rowtype;
  v_status text;
  v_follow_up_idx integer;
begin
  if p_request_id is null then
    return jsonb_build_object('success', false, 'message', 'Pedido não informado.');
  end if;

  if p_profile_id is null then
    return jsonb_build_object('success', false, 'message', 'Perfil não informado.');
  end if;

  select regexp_replace(coalesce(p.phone, ''), '\D', '', 'g')
  into v_profile_phone_digits
  from public.profiles p
  where p.id = p_profile_id
    and p.tenant_id = v_tenant;

  if not found then
    return jsonb_build_object('success', false, 'message', 'Perfil não encontrado.');
  end if;

  select *
  into v_request
  from public.pastoral_requests pr
  where pr.id = p_request_id
    and pr.tenant_id = v_tenant
    and (
      pr.profile_id = p_profile_id
      or (
        v_profile_phone_digits <> ''
        and regexp_replace(coalesce(pr.phone, ''), '\D', '', 'g') = v_profile_phone_digits
      )
    );

  if not found then
    return jsonb_build_object('success', false, 'message', 'Pedido não encontrado.');
  end if;

  v_status := lower(trim(coalesce(v_request.status::text, '')));
  v_follow_up_idx := public.pastoral_follow_up_stage_index(v_request.status::text);

  if v_follow_up_idx >= 0 then
    return jsonb_build_object(
      'success', false,
      'message', 'Este pedido já foi iniciado pelo Cuidado Pastoral e não pode ser excluído.'
    );
  end if;

  if v_status in ('in_progress', 'closed', 'cancelled') then
    return jsonb_build_object(
      'success', false,
      'message', 'Este pedido já foi iniciado pelo Cuidado Pastoral e não pode ser excluído.'
    );
  end if;

  delete from public.pastoral_requests pr
  where pr.id = p_request_id
    and pr.tenant_id = v_tenant;

  return jsonb_build_object('success', true);
end;
$$;

-- ---------------------------------------------------------------------------
-- insert_pastoral_request
-- ---------------------------------------------------------------------------
create or replace function public.insert_pastoral_request(
  p_user_id uuid,
  p_phone text,
  p_motivo text,
  p_situacao text,
  p_description text,
  p_category_id uuid,
  p_subcategory_id uuid,
  p_destination_label text,
  p_confidential boolean,
  p_request_for text default 'self',
  p_beneficiary_name text default null,
  p_beneficiary_relationship text default null,
  p_beneficiary_details text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
  v_id uuid;
  v_profile_id uuid;
  v_auth_user_id uuid;
  v_category_id uuid;
  v_subcategory_id uuid;
  v_request_for text;
  v_beneficiary_name text;
  v_beneficiary_relationship text;
  v_beneficiary_details text;
begin
  -- p_user_id = profiles.id (enviado pelo app)
  perform public.assert_session_profile_matches(p_user_id);
  v_profile_id := p_user_id;

  select p.auth_user_id
  into v_auth_user_id
  from public.profiles p
  where p.id = v_profile_id
    and p.tenant_id = v_tenant;

  if not found then
    raise exception 'Perfil não encontrado para este usuário.';
  end if;

  if nullif(trim(coalesce(p_phone, '')), '') is null then
    raise exception 'Celular não informado.';
  end if;

  if nullif(trim(coalesce(p_motivo, '')), '') is null then
    raise exception 'Motivo não informado.';
  end if;

  if nullif(trim(coalesce(p_situacao, '')), '') is null then
    raise exception 'Situação não informada.';
  end if;

  if nullif(trim(coalesce(p_description, '')), '') is null then
    raise exception 'Descrição não informada.';
  end if;

  v_request_for := coalesce(trim(p_request_for), 'self');

  if v_request_for not in ('self', 'family', 'third_party') then
    raise exception 'Tipo de beneficiário inválido.';
  end if;

  if v_request_for = 'self' then
    v_beneficiary_name := null;
    v_beneficiary_relationship := null;
    v_beneficiary_details := null;
  elsif v_request_for = 'family' then
    v_beneficiary_name := nullif(trim(coalesce(p_beneficiary_name, '')), '');
    v_beneficiary_relationship := nullif(trim(coalesce(p_beneficiary_relationship, '')), '');
    v_beneficiary_details := null;

    if v_beneficiary_name is null then
      raise exception 'Informe o nome do familiar.';
    end if;

    if v_beneficiary_relationship is null then
      raise exception 'Informe o grau de parentesco.';
    end if;
  else
    v_beneficiary_name := nullif(trim(coalesce(p_beneficiary_name, '')), '');
    v_beneficiary_relationship := null;
    v_beneficiary_details := nullif(trim(coalesce(p_beneficiary_details, '')), '');

    if v_beneficiary_name is null then
      raise exception 'Informe o nome do necessitado.';
    end if;

    if v_beneficiary_details is null then
      raise exception 'Especifique quem é o necessitado (terceiros).';
    end if;
  end if;

  v_category_id := p_category_id;
  v_subcategory_id := p_subcategory_id;

  if v_category_id is not null
    and not exists (
      select 1 from public.pastoral_reason_categories where id = v_category_id
    ) then
    v_category_id := null;
  end if;

  if v_subcategory_id is not null
    and not exists (
      select 1 from public.pastoral_reason_subcategories where id = v_subcategory_id
    ) then
    v_subcategory_id := null;
  end if;

  insert into public.pastoral_requests (
    tenant_id,
    user_id,
    profile_id,
    phone,
    motivo,
    situacao,
    description,
    category_id,
    subcategory_id,
    destination_label,
    confidential,
    request_for,
    beneficiary_name,
    beneficiary_relationship,
    beneficiary_details,
    urgency_level,
    status
  )
  values (
    v_tenant,
    v_auth_user_id,
    v_profile_id,
    trim(p_phone),
    trim(p_motivo),
    trim(p_situacao),
    trim(p_description),
    v_category_id,
    v_subcategory_id,
    nullif(trim(coalesce(p_destination_label, '')), ''),
    coalesce(p_confidential, false),
    v_request_for,
    v_beneficiary_name,
    v_beneficiary_relationship,
    v_beneficiary_details,
    1,
    'new'
  )
  returning id into v_id;

  return v_id;
end;
$$;

grant execute on function public.request_my_pastoral_cancellation(uuid, uuid, text) to anon, authenticated;
grant execute on function public.approve_pastoral_cancellation(uuid) to anon, authenticated;
grant execute on function public.list_my_pastoral_requests(uuid) to anon, authenticated;
grant execute on function public.listar_pedidos_pastoral_perfil(uuid) to anon, authenticated;
grant execute on function public.atualizar_status_pedido_pastoral(uuid, text) to anon, authenticated;
grant execute on function public.delete_my_pastoral_request(uuid, uuid) to anon;
grant execute on function public.delete_my_pastoral_request(uuid, uuid) to authenticated;
grant execute on function public.insert_pastoral_request(
  uuid,
  text,
  text,
  text,
  text,
  uuid,
  uuid,
  text,
  boolean,
  text,
  text,
  text,
  text
) to anon;
grant execute on function public.insert_pastoral_request(
  uuid,
  text,
  text,
  text,
  text,
  uuid,
  uuid,
  text,
  boolean,
  text,
  text,
  text,
  text
) to authenticated;

notify pgrst, 'reload schema';

commit;
