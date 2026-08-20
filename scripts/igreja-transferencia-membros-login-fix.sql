-- Corrige solicitação de transferência no login:
-- 1) aceita a igreja de destino informada pela tela (não depende só do header)
-- 2) remove overload antigo para o PostgREST não ambíguar a RPC

begin;

drop function if exists public.solicitar_transferencia_membro_login(text);
drop function if exists public.solicitar_transferencia_membro_login(text, text);
drop function if exists public.solicitar_transferencia_membro_login(text, text, uuid);

create function public.solicitar_transferencia_membro_login(
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

grant execute on function public.solicitar_transferencia_membro_login(text, text, uuid) to anon, authenticated;

notify pgrst, 'reload schema';

commit;
