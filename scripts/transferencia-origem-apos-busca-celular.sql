-- A igreja de origem não é listada na tela: localiza pelo celular e só então
-- devolve a identificação da origem do cadastro encontrado.

create or replace function public.pastoral_preview_transferencia_entrada(
  p_origin_tenant_id uuid default null,
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
  v_origin_id uuid;
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

  if nullif(trim(coalesce(p_phone, '')), '') is null
     and nullif(trim(coalesce(p_cpf, '')), '') is null then
    return jsonb_build_object(
      'ok', false,
      'message', 'Informe o celular para localizar o cadastro.'
    );
  end if;

  if v_family <> '' and p_origin_tenant_id is not null then
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

  v_origin_id := coalesce(p_origin_tenant_id, public.profile_origin_tenant_id(v_profile_id));

  if v_origin_id is null then
    return jsonb_build_object('ok', false, 'message', 'Não foi possível identificar a igreja de origem.');
  end if;

  if v_origin_id = v_dest then
    return jsonb_build_object('ok', false, 'message', 'Este membro já está vinculado a esta igreja.');
  end if;

  select * into v_origin from public.igrejas where id = v_origin_id and is_active = true;
  if not found then
    return jsonb_build_object('ok', false, 'message', 'Igreja de origem não encontrada.');
  end if;

  select * into v_dest_igreja from public.igrejas where id = v_dest;

  if public.profile_origin_tenant_id(v_profile_id) is distinct from v_origin_id then
    return jsonb_build_object(
      'ok', false,
      'message', 'O cadastro encontrado não pertence à igreja de origem.'
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
    from public.transfer_collect_people(v_origin_id, v_profile_id, v_include) t;

  return jsonb_build_object(
    'ok', true,
    'origin_id', v_origin_id,
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
  p_origin_tenant_id uuid default null,
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
  v_origin_id uuid;
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

  v_origin_id := coalesce(p_origin_tenant_id, (v_preview ->> 'origin_id')::uuid);
  v_profile_id := (v_preview ->> 'primary_profile_id')::uuid;
  v_include := coalesce((v_preview ->> 'include_family')::boolean, false);

  if v_origin_id is null then
    return jsonb_build_object('ok', false, 'message', 'Não foi possível identificar a igreja de origem.');
  end if;

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
    from public.transfer_collect_people(v_origin_id, v_profile_id, v_include) t
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
    v_origin_id,
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
    select * from public.transfer_collect_people(v_origin_id, v_profile_id, v_include)
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

grant execute on function public.pastoral_preview_transferencia_entrada(uuid, text, text, text, boolean) to anon, authenticated;
grant execute on function public.pastoral_iniciar_transferencia_entrada(uuid, text, text, text, boolean, text) to anon, authenticated;
