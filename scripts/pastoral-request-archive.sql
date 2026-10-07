-- =============================================================================
-- Arquivar pedido pastoral em vez de excluir
-- =============================================================================
-- O solicitante deixa de ver o pedido. O Cuidado Pastoral mantém o histórico.
-- Aplica: npx supabase db query --linked -f scripts/pastoral-request-archive.sql
-- =============================================================================

begin;

alter table public.pastoral_requests
  add column if not exists archived_at timestamptz;

comment on column public.pastoral_requests.archived_at is
  'Quando o Cuidado Pastoral arquivou o pedido. Some da lista de quem solicitou e permanece no histórico pastoral.';

create index if not exists idx_pastoral_requests_archived_at
  on public.pastoral_requests (archived_at)
  where archived_at is not null;

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
      'message', 'Nenhuma solicitação de arquivamento para este pedido.'
    );
  end if;

  if not public.is_super_admin_profile(v_session_id) then
    return jsonb_build_object(
      'success', false,
      'message', 'Apenas super administradores podem arquivar pedidos pastorais.'
    );
  end if;

  if v_request.archived_at is not null then
    return jsonb_build_object(
      'success', true,
      'message', 'Pedido já arquivado.',
      'archived_at', v_request.archived_at
    );
  end if;

  update public.pastoral_requests pr
     set archived_at = now(),
         updated_at = now()
   where pr.id = p_request_id
     and pr.tenant_id = v_tenant
     and pr.archived_at is null
  returning pr.archived_at
  into v_request.archived_at;

  return jsonb_build_object(
    'success', true,
    'message', 'Pedido arquivado. O solicitante não vê mais este pedido.',
    'archived_at', v_request.archived_at
  );
end;
$$;

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
stable
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
    and pr.archived_at is null
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

drop function if exists public.listar_pedidos_pastoral_perfil(uuid);

create function public.listar_pedidos_pastoral_perfil(p_profile_id uuid)
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
  cancellation_request_reason text,
  archived_at timestamptz
)
language plpgsql
stable
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
    nullif(trim(coalesce(pr.cancellation_request_reason, '')), '') as cancellation_request_reason,
    pr.archived_at
  from public.pastoral_requests pr
  where pr.tenant_id = v_tenant
    and pr.profile_id = p_profile_id
    and public.session_can_view_pastoral_request(pr.profile_id, pr.destination_label)
  order by pr.created_at desc;
end;
$$;

grant execute on function public.approve_pastoral_cancellation(uuid) to anon, authenticated;
grant execute on function public.list_my_pastoral_requests(uuid) to anon, authenticated;
grant execute on function public.listar_pedidos_pastoral_perfil(uuid) to anon, authenticated;

notify pgrst, 'reload schema';

commit;
