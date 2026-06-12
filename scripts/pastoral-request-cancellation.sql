-- Solicitação de cancelamento de pedido pastoral (membro) e exclusão pelo Cuidado Pastoral.
-- Execute após: pastoral-requests-fields.sql, pastoral-request-delete-rpc.sql,
--               pastoral-request-handler.sql

alter table public.pastoral_requests
  add column if not exists cancellation_requested_at timestamptz;

create index if not exists idx_pastoral_requests_cancellation_requested_at
  on public.pastoral_requests (cancellation_requested_at)
  where cancellation_requested_at is not null;

drop function if exists public.request_my_pastoral_cancellation(uuid, uuid);

create or replace function public.request_my_pastoral_cancellation(
  p_request_id uuid,
  p_profile_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
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
  where p.id = p_profile_id;

  if not found then
    return jsonb_build_object('success', false, 'message', 'Perfil não encontrado.');
  end if;

  select *
  into v_request
  from public.pastoral_requests pr
  where pr.id = p_request_id
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

  if v_request.cancellation_requested_at is not null then
    return jsonb_build_object(
      'success', true,
      'message', 'Cancelamento já solicitado. Aguarde o Cuidado Pastoral.',
      'cancellation_requested_at', v_request.cancellation_requested_at
    );
  end if;

  update public.pastoral_requests pr
  set cancellation_requested_at = now(),
      updated_at = now()
  where pr.id = p_request_id
  returning pr.cancellation_requested_at into v_request.cancellation_requested_at;

  return jsonb_build_object(
    'success', true,
    'message', 'Solicitação de cancelamento enviada ao Cuidado Pastoral.',
    'cancellation_requested_at', v_request.cancellation_requested_at
  );
end;
$$;

drop function if exists public.approve_pastoral_cancellation(uuid);

create or replace function public.approve_pastoral_cancellation(p_request_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
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
  where pr.id = p_request_id;

  if not found then
    return jsonb_build_object('success', false, 'message', 'Pedido pastoral não encontrado.');
  end if;

  if v_request.cancellation_requested_at is null then
    return jsonb_build_object(
      'success', false,
      'message', 'Nenhuma solicitação de cancelamento para este pedido.'
    );
  end if;

  if v_request.profile_id = v_session_id then
    return jsonb_build_object(
      'success', false,
      'message', 'O solicitante não pode confirmar o próprio cancelamento pelo painel de manutenção.'
    );
  end if;

  if not public.session_can_view_pastoral_request(v_request.profile_id, v_request.destination_label) then
    return jsonb_build_object(
      'success', false,
      'message', 'Sem permissão para cancelar este pedido pastoral.'
    );
  end if;

  delete from public.pastoral_requests pr
  where pr.id = p_request_id;

  return jsonb_build_object(
    'success', true,
    'message', 'Pedido pastoral cancelado e removido.'
  );
end;
$$;

-- Histórico do membro
drop function if exists public.list_my_pastoral_requests(uuid);

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
  cancellation_requested_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_phone_digits text;
begin
  if p_profile_id is null then
    raise exception 'Perfil não informado.';
  end if;

  select regexp_replace(coalesce(p.phone, ''), '\D', '', 'g')
  into v_profile_phone_digits
  from public.profiles p
  where p.id = p_profile_id;

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
    pr.cancellation_requested_at
  from public.pastoral_requests pr
  where pr.profile_id = p_profile_id
    or (
      v_profile_phone_digits <> ''
      and regexp_replace(coalesce(pr.phone, ''), '\D', '', 'g') = v_profile_phone_digits
    )
  order by pr.created_at desc;
end;
$$;

-- Manutenção Cuidado Pastoral
drop function if exists public.listar_pedidos_pastoral_perfil(uuid);

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
  cancellation_requested_at timestamptz
)
language sql
security definer
set search_path = public
as $$
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
    pr.cancellation_requested_at
  from public.pastoral_requests pr
  where pr.profile_id = p_profile_id
    and public.session_can_view_pastoral_request(pr.profile_id, pr.destination_label)
  order by pr.created_at desc;
$$;

grant execute on function public.request_my_pastoral_cancellation(uuid, uuid) to anon, authenticated;
grant execute on function public.approve_pastoral_cancellation(uuid) to anon, authenticated;
grant execute on function public.list_my_pastoral_requests(uuid) to anon, authenticated;
grant execute on function public.listar_pedidos_pastoral_perfil(uuid) to anon, authenticated;

notify pgrst, 'reload schema';
