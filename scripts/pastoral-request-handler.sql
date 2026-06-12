-- Responsável pelo acolhimento (Acolher) em pedidos pastorais.
-- Intercessão: após Acolher, só o responsável atualiza Apoiar/Acompanhar; demais ficam em leitura.
-- Equipe pastoral / super_admin: mantém permissão total.
--
-- Execute após: pastoral-requests-fields.sql, access-control-pastoral-intercessao.sql,
--               pastoral-maintenance-rpc.sql

alter table public.pastoral_requests
  add column if not exists handler_profile_id uuid references public.profiles (id) on delete set null,
  add column if not exists handler_name text;

create index if not exists idx_pastoral_requests_handler_profile_id
  on public.pastoral_requests (handler_profile_id);

drop function if exists public.session_can_update_pastoral_request(uuid, text);

create or replace function public.session_can_update_pastoral_request_row(
  p_request_id uuid,
  p_request_profile_id uuid,
  p_destination_label text,
  p_handler_profile_id uuid
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_session_id uuid;
begin
  v_session_id := public.current_session_profile_id();

  if v_session_id is null then
    return false;
  end if;

  if not public.session_can_view_pastoral_request(p_request_profile_id, p_destination_label) then
    return false;
  end if;

  if public.session_has_full_pastoral_requests_access() then
    return true;
  end if;

  if p_request_profile_id = v_session_id then
    return false;
  end if;

  if public.pastoral_destination_label_is_intercession(p_destination_label) then
    if not public.session_profile_is_intercession_scale_volunteer() then
      return false;
    end if;

    if p_handler_profile_id is null then
      return true;
    end if;

    return p_handler_profile_id = v_session_id;
  end if;

  return false;
end;
$$;

drop policy if exists pastoral_requests_update_acl on public.pastoral_requests;

create policy pastoral_requests_update_acl
  on public.pastoral_requests
  for update
  to anon, authenticated
  using (
    public.session_can_update_pastoral_request_row(
      id,
      profile_id,
      destination_label,
      handler_profile_id
    )
  )
  with check (
    public.session_can_update_pastoral_request_row(
      id,
      profile_id,
      destination_label,
      handler_profile_id
    )
  );

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
  handler_name text
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
    nullif(trim(coalesce(pr.handler_name, '')), '') as handler_name
  from public.pastoral_requests pr
  where pr.profile_id = p_profile_id
    and public.session_can_view_pastoral_request(pr.profile_id, pr.destination_label)
  order by pr.created_at desc;
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
  where pr.id = p_request_id;

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
     limit 1;

    update public.pastoral_requests pr
    set
      status = v_status,
      updated_at = now(),
      handler_profile_id = v_session_id,
      handler_name = coalesce(v_handler_name, 'Responsável')
    where pr.id = p_request_id
    returning pr.status::text, pr.updated_at, pr.handler_profile_id, pr.handler_name
      into v_status, v_updated_at, v_handler_profile_id, v_handler_name;
  else
    update public.pastoral_requests pr
    set
      status = v_status,
      updated_at = now()
    where pr.id = p_request_id
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

grant execute on function public.session_can_update_pastoral_request_row(uuid, uuid, text, uuid) to anon, authenticated;
grant execute on function public.listar_pedidos_pastoral_perfil(uuid) to anon, authenticated;
grant execute on function public.atualizar_status_pedido_pastoral(uuid, text) to anon, authenticated;

notify pgrst, 'reload schema';
