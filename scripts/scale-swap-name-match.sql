-- Reconhece o servo mesmo com nome composto, apelido ou só o primeiro nome.

create or replace function public.scale_swap_norm_name(p_name text)
returns text
language sql
immutable
as $$
  select lower(
    translate(
      regexp_replace(trim(coalesce(p_name, '')), '\s+', ' ', 'g'),
      'ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇçÑñ',
      'AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCcNn'
    )
  );
$$;

create or replace function public.scale_swap_names_match(p_profile_name text, p_volunteer_name text)
returns boolean
language plpgsql
immutable
as $$
declare
  v_p text := public.scale_swap_norm_name(p_profile_name);
  v_v text := public.scale_swap_norm_name(p_volunteer_name);
  v_pp text[];
  v_vv text[];
begin
  if v_p = '' or v_v = '' then
    return false;
  end if;

  if v_p = v_v then
    return true;
  end if;

  v_pp := regexp_split_to_array(v_p, '\s+');
  v_vv := regexp_split_to_array(v_v, '\s+');

  if coalesce(array_length(v_pp, 1), 0) >= 2
     and (v_pp[1] || ' ' || v_pp[array_length(v_pp, 1)]) = v_v then
    return true;
  end if;

  if coalesce(array_length(v_vv, 1), 0) >= 2
     and (v_vv[1] || ' ' || v_vv[array_length(v_vv, 1)]) = v_p then
    return true;
  end if;

  if v_pp[1] = v_vv[1]
     and v_pp[array_length(v_pp, 1)] = v_vv[array_length(v_vv, 1)] then
    return true;
  end if;

  if coalesce(array_length(v_vv, 1), 0) = 1 and v_vv[1] = v_pp[1] then
    return true;
  end if;

  return false;
end;
$$;

create or replace function public.scale_swap_volunteer_id_for_profile(
  p_tenant_id uuid,
  p_profile_id uuid,
  p_tipo_escala_id uuid
)
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_name text;
  v_id uuid;
begin
  select trim(regexp_replace(coalesce(p.full_name, ''), '\s+', ' ', 'g'))
    into v_name
    from public.profiles p
   where p.id = p_profile_id
     and p.tenant_id = p_tenant_id;

  if v_name is null or v_name = '' then
    return null;
  end if;

  select ve.id
    into v_id
    from public.voluntarios_escala ve
   where ve.tenant_id = p_tenant_id
     and ve.tipo_escala_id = p_tipo_escala_id
     and ve.is_ativo is true
     and public.scale_swap_names_match(v_name, ve.nome)
   order by
     case
       when public.scale_swap_norm_name(ve.nome) = public.scale_swap_norm_name(v_name) then 0
       else 1
     end,
     ve.nome
   limit 1;

  return v_id;
end;
$$;

create or replace function public.create_scale_swap_request(
  p_escala_log_id uuid,
  p_substituto_profile_id uuid,
  p_motivo text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
  v_me uuid := public.current_session_profile_id();
  v_log public.escalas_log%rowtype;
  v_allow boolean;
  v_my_vol uuid;
  v_sub_vol uuid;
  v_id uuid;
  v_me_name text;
  v_vol_name text;
  v_type_name text;
begin
  if v_me is null then
    return jsonb_build_object('success', false, 'message', 'Sessão inválida.');
  end if;
  if not public.scale_swap_can_member() then
    return jsonb_build_object('success', false, 'message', 'Sem permissão para solicitar troca nesta escala.');
  end if;
  if p_substituto_profile_id is null then
    return jsonb_build_object('success', false, 'message', 'Selecione um substituto.');
  end if;
  if p_substituto_profile_id = v_me then
    return jsonb_build_object('success', false, 'message', 'Não é possível trocar consigo mesmo.');
  end if;

  select * into v_log
    from public.escalas_log el
   where el.id = p_escala_log_id
     and el.tenant_id = v_tenant
   for update;

  if not found then
    return jsonb_build_object('success', false, 'message', 'Escala de origem não encontrada.');
  end if;

  if v_log.data_servico < (timezone('America/Sao_Paulo', now()))::date then
    return jsonb_build_object('success', false, 'message', 'Não é possível trocar uma escala já realizada.');
  end if;

  select coalesce(te.allow_swap, true), te.nome
    into v_allow, v_type_name
    from public.tipos_escala te
   where te.id = v_log.tipo_escala_id
     and te.tenant_id = v_tenant;

  if v_allow is not true then
    return jsonb_build_object('success', false, 'message', 'Esta escala não permite troca autônoma.');
  end if;

  select trim(coalesce(full_name, '')) into v_me_name
    from public.profiles where id = v_me;

  select trim(coalesce(ve.nome, '')) into v_vol_name
    from public.voluntarios_escala ve
   where ve.id = v_log.voluntario_id;

  v_my_vol := public.scale_swap_volunteer_id_for_profile(v_tenant, v_me, v_log.tipo_escala_id);

  if not public.scale_swap_names_match(v_me_name, v_vol_name)
     and (v_my_vol is null or v_my_vol is distinct from v_log.voluntario_id) then
    return jsonb_build_object('success', false, 'message', 'Só o servo escalado nesta data pode solicitar a troca.');
  end if;

  v_sub_vol := public.scale_swap_volunteer_id_for_profile(v_tenant, p_substituto_profile_id, v_log.tipo_escala_id);
  if v_sub_vol is null then
    return jsonb_build_object('success', false, 'message', 'O substituto precisa ser do mesmo tipo de escala.');
  end if;

  if exists (
    select 1 from public.escalas_log busy
     where busy.tenant_id = v_tenant
       and busy.data_servico = v_log.data_servico
       and busy.voluntario_id = v_sub_vol
  ) then
    return jsonb_build_object('success', false, 'message', 'Este servo já está escalado nesta data.');
  end if;

  if exists (
    select 1 from public.scale_swap_requests r
     where r.tenant_id = v_tenant
       and r.escala_id_origem = v_log.id
       and r.status = 'pendente'
  ) then
    return jsonb_build_object('success', false, 'message', 'Já existe um pedido de troca pendente para esta data.');
  end if;

  insert into public.scale_swap_requests (
    tenant_id, escala_id_origem, tipo_escala_id, data_servico,
    solicitante_profile_id, substituto_profile_id,
    voluntario_id_origem, voluntario_id_substituto, status, motivo
  ) values (
    v_tenant, v_log.id, v_log.tipo_escala_id, v_log.data_servico,
    v_me, p_substituto_profile_id,
    v_log.voluntario_id, v_sub_vol, 'pendente', nullif(trim(coalesce(p_motivo, '')), '')
  )
  returning id into v_id;

  if v_me_name is null or v_me_name = '' then
    v_me_name := 'Um servo';
  end if;

  perform public.scale_swap_insert_notice(
    v_tenant,
    p_substituto_profile_id,
    v_id,
    'Pedido de troca de escala',
    v_me_name || ' pediu para você cobrir ' || coalesce(v_type_name, 'a escala')
      || ' em ' || to_char(v_log.data_servico, 'DD/MM/YYYY') || '.'
  );
  perform public.scale_swap_insert_audit(
    v_tenant, v_id, v_log.id, v_me, 'solicitado', v_log.voluntario_id, v_sub_vol,
    jsonb_build_object('motivo', nullif(trim(coalesce(p_motivo, '')), ''))
  );

  return jsonb_build_object('success', true, 'id', v_id, 'message', 'Proposta enviada.');
end;
$$;

grant execute on function public.scale_swap_norm_name(text) to anon, authenticated, service_role;
grant execute on function public.scale_swap_names_match(text, text) to anon, authenticated, service_role;
grant execute on function public.scale_swap_volunteer_id_for_profile(uuid, uuid, uuid) to anon, authenticated, service_role;
grant execute on function public.create_scale_swap_request(uuid, uuid, text) to anon, authenticated, service_role;
