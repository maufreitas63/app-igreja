-- Transferência origem → destino: a sessão permanece na igreja de origem,
-- mas o processamento grava família/vínculo/membro no tenant de destino.
-- Sem o bypass, tg_set_tenant_id_from_session bloqueia:
--   tenant_id (destino) diverge do tenant da sessão (origem)

begin;

create or replace function public.apply_igreja_transfer_request(
  p_request_id uuid,
  p_actor_profile_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
set row_security = off
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

  perform set_config('app.bypass_tenant_guard', 'on', true);

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

grant execute on function public.apply_igreja_transfer_request(uuid, uuid) to anon, authenticated;

notify pgrst, 'reload schema';

commit;
