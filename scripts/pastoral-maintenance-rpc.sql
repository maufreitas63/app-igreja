-- Manutenção: lista de quem enviou pedido pastoral (Cuidado Pastoral).
-- Execute após scripts/pastoral-requests-fields.sql

drop function if exists public.buscar_solicitantes_pedido_pastoral(text, integer);
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

grant execute on function public.listar_solicitantes_pedido_pastoral() to anon;
grant execute on function public.listar_solicitantes_pedido_pastoral() to authenticated;

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
  updated_at timestamptz
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
    pr.updated_at
  from public.pastoral_requests pr
  where pr.profile_id = p_profile_id
    and public.session_can_view_pastoral_request(pr.profile_id, pr.destination_label)
  order by pr.created_at desc;
$$;

grant execute on function public.listar_pedidos_pastoral_perfil(uuid) to anon;
grant execute on function public.listar_pedidos_pastoral_perfil(uuid) to authenticated;

alter table public.pastoral_requests
  add column if not exists updated_at timestamptz not null default now();

-- Permite estágios Acolher / Apoiar / Acompanhar no campo status (remove check legado, se existir).
alter table public.pastoral_requests
  drop constraint if exists pastoral_requests_status_check;

-- Garante texto livre (enum legado pode bloquear "Acompanhar").
alter table public.pastoral_requests
  alter column status type text using status::text;

drop function if exists public.pastoral_follow_up_stage_index(text);

create or replace function public.pastoral_follow_up_stage_index(p_status text)
returns integer
language sql
immutable
as $$
  select case lower(trim(coalesce(p_status, '')))
    when 'acolher' then 0
    when 'apoiar' then 1
    when 'acompanhar' then 2
    else -1
  end;
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

grant execute on function public.atualizar_status_pedido_pastoral(uuid, text) to anon;
grant execute on function public.atualizar_status_pedido_pastoral(uuid, text) to authenticated;

-- Políticas RLS: scripts/access-control-table-rls.sql + access-control-pastoral-intercessao.sql
drop policy if exists pastoral_requests_update_policy on public.pastoral_requests;

notify pgrst, 'reload schema';
