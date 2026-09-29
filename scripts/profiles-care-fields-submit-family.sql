CREATE OR REPLACE FUNCTION public.submit_family_registration_public(p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_code text;
  v_tenant uuid;
  v_submission_id uuid;
  v_informant jsonb;
  v_dependent jsonb;
  v_informant_name text;
  v_informant_birth date;
  v_informant_marriage date;
  v_dependent_name text;
  v_birth date;
  v_marriage date;
  v_phone text;
  v_phone_store text;
  v_relationship text;
  v_cep text;
  v_address_number text;
  v_address_complement text;
  v_address_street text;
  v_address_neighborhood text;
  v_address_city text;
  v_address_state text;
  v_food_alerts text;
  v_additional_care_notes text;
  v_special_needs text;
  v_member_count int := 0;
  v_detected_family_id text;
  v_person_family_id text;
  v_matched_profile_id uuid;
  v_matched_member_id uuid;
  v_distinct_family_count int;
  v_phone_family_distinct_count int;
  v_form_phones text[] := array[]::text[];
  v_family_id_from_phones text;
  v_allowed_relationships text[] := array[
    'C├┤njuge', 'Filho(a)', 'Representante Legal', 'Pai', 'M├úe', 'Outros'
  ];
begin
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    return jsonb_build_object('success', false, 'message', 'Payload inv├ílido.');
  end if;

  v_code := upper(trim(regexp_replace(
    coalesce(
      p_payload ->> 'tenant_code',
      p_payload ->> 'tenant',
      p_payload ->> 'igreja',
      ''
    ),
    '[^A-Za-z0-9_-]',
    '',
    'g'
  )));

  if v_code = '' then
    return jsonb_build_object(
      'success', false,
      'message',
      'Este link de cadastro est├í incompleto. Pe├ºa ├á Secretaria o convite com o c├│digo da igreja.'
    );
  end if;

  select i.id
    into v_tenant
    from public.igrejas i
   where i.is_active = true
     and upper(trim(i.code)) = v_code
   limit 1;

  if v_tenant is null then
    return jsonb_build_object(
      'success', false,
      'message',
      'Igreja n├úo encontrada ou inativa. Confira o c├│digo da inst├óncia no link.'
    );
  end if;

  v_informant := p_payload -> 'informant';

  if v_informant is null or jsonb_typeof(v_informant) <> 'object' then
    return jsonb_build_object('success', false, 'message', 'Informe os dados do representante legal.');
  end if;

  v_informant_name := nullif(trim(coalesce(v_informant ->> 'full_name', '')), '');

  if v_informant_name is null then
    return jsonb_build_object('success', false, 'message', 'Informe o nome do representante legal.');
  end if;

  begin
    v_informant_birth := nullif(trim(coalesce(v_informant ->> 'birth_date', '')), '')::date;
  exception
    when others then
      return jsonb_build_object('success', false, 'message', 'Data de nascimento do representante legal inv├ílida.');
  end;

  if v_informant_birth is null then
    return jsonb_build_object('success', false, 'message', 'Informe a data de nascimento do representante legal.');
  end if;

  begin
    v_informant_marriage := nullif(trim(coalesce(v_informant ->> 'marriage_date', '')), '')::date;
  exception
    when others then
      return jsonb_build_object('success', false, 'message', 'Data de casamento do representante legal inv├ílida.');
  end;

  v_phone := nullif(trim(coalesce(v_informant ->> 'phone', '')), '');

  if v_phone is null or not public.recepcao_is_valid_mobile_phone(v_phone) then
    return jsonb_build_object(
      'success', false,
      'message',
      'Verifique e corrija o celular do representante legal: informe exatamente 11 d├¡gitos (DDD + n├║mero com 9 na frente, ex.: (11) 98765-4321).'
    );
  end if;

  v_cep := nullif(trim(coalesce(v_informant ->> 'cep', '')), '');
  v_address_number := nullif(trim(coalesce(v_informant ->> 'address_number', '')), '');
  v_address_complement := nullif(trim(coalesce(v_informant ->> 'address_complement', '')), '');
  v_address_street := nullif(trim(coalesce(v_informant ->> 'address_street', '')), '');
  v_address_neighborhood := nullif(trim(coalesce(v_informant ->> 'address_neighborhood', '')), '');
  v_address_city := nullif(trim(coalesce(v_informant ->> 'address_city', '')), '');
  v_address_state := nullif(trim(coalesce(v_informant ->> 'address_state', '')), '');
  v_food_alerts := nullif(trim(coalesce(v_informant ->> 'medical_food_alerts', '')), '');
  v_additional_care_notes := nullif(trim(coalesce(v_informant ->> 'additional_care_notes', '')), '');
  v_special_needs := nullif(trim(coalesce(v_informant ->> 'special_needs', '')), '');

  if length(public.recepcao_cep_digits(v_cep)) <> 8 then
    return jsonb_build_object('success', false, 'message', 'Informe um CEP v├ílido com 8 d├¡gitos.');
  end if;

  if v_address_number is null then
    return jsonb_build_object('success', false, 'message', 'Informe o n├║mero do endere├ºo.');
  end if;

  v_form_phones := array_append(v_form_phones, v_phone);

  for v_dependent in
    select value
      from jsonb_array_elements(coalesce(p_payload -> 'dependents', '[]'::jsonb))
  loop
    v_dependent_name := nullif(trim(coalesce(v_dependent ->> 'full_name', '')), '');

    if v_dependent_name is null then
      continue;
    end if;

    if nullif(trim(coalesce(v_dependent ->> 'phone', '')), '') is not null
       and not public.recepcao_is_valid_mobile_phone(v_dependent ->> 'phone') then
      return jsonb_build_object(
        'success', false,
        'message',
        format(
          'Verifique e corrija o celular do dependente "%s": informe exatamente 11 d├¡gitos (DDD + n├║mero com 9 na frente, ex.: (11) 98765-4321).',
          v_dependent_name
        )
      );
    end if;

    if nullif(trim(coalesce(v_dependent ->> 'phone', '')), '') is not null then
      v_form_phones := array_append(
        v_form_phones,
        nullif(trim(coalesce(v_dependent ->> 'phone', '')), '')
      );
    end if;

    begin
      perform nullif(trim(coalesce(v_dependent ->> 'birth_date', '')), '')::date;
    exception
      when others then
        return jsonb_build_object(
          'success', false,
          'message',
          format('Data de nascimento inv├ílida para o dependente "%s".', v_dependent_name)
        );
    end;

    begin
      perform nullif(trim(coalesce(v_dependent ->> 'marriage_date', '')), '')::date;
    exception
      when others then
        return jsonb_build_object(
          'success', false,
          'message',
          format('Data de casamento inv├ílida para o dependente "%s".', v_dependent_name)
        );
    end;

    v_relationship := nullif(trim(coalesce(v_dependent ->> 'relationship', '')), '');

    if v_relationship is null or not (v_relationship = any (v_allowed_relationships)) then
      return jsonb_build_object(
        'success', false,
        'message',
        format('V├¡nculo familiar inv├ílido para o dependente "%s".', v_dependent_name)
      );
    end if;

    if v_relationship = 'Representante Legal' then
      return jsonb_build_object(
        'success', false,
        'message',
        'Apenas o informante pode ser Representante Legal.'
      );
    end if;
  end loop;

  insert into public.recepcao_cadastro_familiar_lote (status, member_count, tenant_id)
  values ('pending', 0, v_tenant)
  returning id into v_submission_id;

  select
    r.matched_profile_id,
    r.matched_member_id,
    r.detected_family_id
  into v_matched_profile_id, v_matched_member_id, v_person_family_id
  from public.resolve_family_id_for_recepcao_person(v_phone, v_informant_name) r;

  if v_matched_profile_id is not null
     and not exists (
       select 1 from public.profiles p
        where p.id = v_matched_profile_id
          and p.tenant_id = v_tenant
     ) then
    v_matched_profile_id := null;
    v_person_family_id := null;
  end if;

  if v_matched_member_id is not null
     and not exists (
       select 1 from public.members m
        where m.id = v_matched_member_id
          and m.tenant_id = v_tenant
     ) then
    v_matched_member_id := null;
  end if;

  if exists (
    select 1
      from public.profiles p
     where p.tenant_id = v_tenant
       and public.normalize_phone_for_sync(p.phone) = public.normalize_phone_for_sync(v_phone)
       and lower(trim(coalesce(p.full_name, ''))) <> lower(v_informant_name)
  ) then
    v_phone_store := null;
    v_matched_profile_id := null;
    v_matched_member_id := null;
  else
    v_phone_store := v_phone;
  end if;

  insert into public.recepcao_cadastro_familiar (
    submission_id,
    is_informant,
    full_name,
    birth_date,
    marriage_date,
    phone,
    relationship,
    cep,
    address_number,
    address_complement,
    address_street,
    address_neighborhood,
    address_city,
    address_state,
    medical_food_alerts,
    additional_care_notes,
    special_needs,
    detected_family_id,
    matched_profile_id,
    matched_member_id,
    tenant_id
  ) values (
    v_submission_id,
    true,
    v_informant_name,
    v_informant_birth,
    v_informant_marriage,
    v_phone_store,
    'Representante Legal',
    v_cep,
    v_address_number,
    v_address_complement,
    v_address_street,
    v_address_neighborhood,
    v_address_city,
    v_address_state,
    v_food_alerts,
    v_additional_care_notes,
    v_special_needs,
    v_person_family_id,
    v_matched_profile_id,
    v_matched_member_id,
    v_tenant
  );

  v_member_count := v_member_count + 1;

  for v_dependent in
    select value
      from jsonb_array_elements(coalesce(p_payload -> 'dependents', '[]'::jsonb))
  loop
    v_dependent_name := nullif(trim(coalesce(v_dependent ->> 'full_name', '')), '');

    if v_dependent_name is null then
      continue;
    end if;

    begin
      v_birth := nullif(trim(coalesce(v_dependent ->> 'birth_date', '')), '')::date;
    exception
      when others then
        return jsonb_build_object(
          'success', false,
          'message',
          format('Data de nascimento inv├ílida para o dependente "%s".', v_dependent_name)
        );
    end;

    begin
      v_marriage := nullif(trim(coalesce(v_dependent ->> 'marriage_date', '')), '')::date;
    exception
      when others then
        return jsonb_build_object(
          'success', false,
          'message',
          format('Data de casamento inv├ílida para o dependente "%s".', v_dependent_name)
        );
    end;

    v_relationship := nullif(trim(coalesce(v_dependent ->> 'relationship', '')), '');
    v_phone := nullif(trim(coalesce(v_dependent ->> 'phone', '')), '');
    v_food_alerts := nullif(trim(coalesce(v_dependent ->> 'medical_food_alerts', '')), '');
    v_additional_care_notes := nullif(trim(coalesce(v_dependent ->> 'additional_care_notes', '')), '');
    v_special_needs := nullif(trim(coalesce(v_dependent ->> 'special_needs', '')), '');

    select
      r.matched_profile_id,
      r.matched_member_id,
      r.detected_family_id
    into v_matched_profile_id, v_matched_member_id, v_person_family_id
    from public.resolve_family_id_for_recepcao_person(v_phone, v_dependent_name) r;

    if v_matched_profile_id is not null
       and not exists (
         select 1 from public.profiles p
          where p.id = v_matched_profile_id
            and p.tenant_id = v_tenant
       ) then
      v_matched_profile_id := null;
      v_person_family_id := null;
    end if;

    if v_matched_member_id is not null
       and not exists (
         select 1 from public.members m
          where m.id = v_matched_member_id
            and m.tenant_id = v_tenant
       ) then
      v_matched_member_id := null;
    end if;

    if v_phone is not null and exists (
      select 1
        from public.profiles p
       where p.tenant_id = v_tenant
         and public.normalize_phone_for_sync(p.phone) = public.normalize_phone_for_sync(v_phone)
         and lower(trim(coalesce(p.full_name, ''))) <> lower(v_dependent_name)
    ) then
      v_phone_store := null;
      v_matched_profile_id := null;
      v_matched_member_id := null;
    else
      v_phone_store := v_phone;
    end if;

    insert into public.recepcao_cadastro_familiar (
      submission_id,
      is_informant,
      full_name,
      birth_date,
      marriage_date,
      phone,
      relationship,
      cep,
      address_number,
      address_complement,
      address_street,
      address_neighborhood,
      address_city,
      address_state,
      medical_food_alerts,
      additional_care_notes,
      special_needs,
      detected_family_id,
      matched_profile_id,
      matched_member_id,
      tenant_id
    ) values (
      v_submission_id,
      false,
      v_dependent_name,
      v_birth,
      v_marriage,
      v_phone_store,
      v_relationship,
      v_cep,
      v_address_number,
      v_address_complement,
      v_address_street,
      v_address_neighborhood,
      v_address_city,
      v_address_state,
      v_food_alerts,
      v_additional_care_notes,
      v_special_needs,
      v_person_family_id,
      v_matched_profile_id,
      v_matched_member_id,
      v_tenant
    );

    v_member_count := v_member_count + 1;
  end loop;

  v_family_id_from_phones := public.find_family_id_by_phones_in_tenant(v_form_phones, v_tenant);
  v_phone_family_distinct_count := public.count_distinct_family_ids_by_phones_in_tenant(v_form_phones, v_tenant);

  v_detected_family_id := public.resolve_recepcao_lote_family_id(v_submission_id);

  if v_detected_family_id is not null then
    update public.recepcao_cadastro_familiar
       set detected_family_id = v_detected_family_id
     where tenant_id = v_tenant
       and submission_id = v_submission_id;
  elsif v_family_id_from_phones is not null then
    update public.recepcao_cadastro_familiar
       set detected_family_id = v_family_id_from_phones
     where tenant_id = v_tenant
       and submission_id = v_submission_id;
    v_detected_family_id := v_family_id_from_phones;
  end if;

  select count(distinct nullif(trim(detected_family_id), ''))
    into v_distinct_family_count
    from public.recepcao_cadastro_familiar
   where tenant_id = v_tenant
     and submission_id = v_submission_id;

  select nullif(trim(detected_family_id), '')
    into v_detected_family_id
    from public.recepcao_cadastro_familiar
   where tenant_id = v_tenant
     and submission_id = v_submission_id
     and detected_family_id is not null
   order by is_informant desc, created_at
   limit 1;

  v_distinct_family_count := greatest(
    coalesce(v_distinct_family_count, 0),
    coalesce(v_phone_family_distinct_count, 0)
  );

  update public.recepcao_cadastro_familiar_lote
     set member_count = v_member_count,
         detected_family_id = coalesce(v_detected_family_id, v_family_id_from_phones),
         has_family_conflict = v_distinct_family_count > 1
   where tenant_id = v_tenant
     and id = v_submission_id;

  v_detected_family_id := coalesce(v_detected_family_id, v_family_id_from_phones);

  return jsonb_build_object(
    'success', true,
    'submission_id', v_submission_id,
    'member_count', v_member_count,
    'detected_family_id', v_detected_family_id,
    'has_family_conflict', v_distinct_family_count > 1,
    'awaiting_review', true,
    'tenant_code', v_code,
    'message',
      case
        when v_distinct_family_count > 1 then
          'Cadastro recebido. H├í diverg├¬ncia de c├│digos familiares entre integrantes ÔÇö a equipe analisar├í antes de gravar.'
        when v_detected_family_id is not null then
          format(
            'Cadastro recebido e aguardando an├ílise. C├│digo familiar detectado nas tabelas finais: %s.',
            v_detected_family_id
          )
        else
          'Cadastro recebido e aguardando an├ílise da equipe antes de gravar nas tabelas finais.'
      end
  );
exception
  when others then
    return jsonb_build_object(
      'success', false,
      'message',
      coalesce(sqlerrm, 'N├úo foi poss├¡vel registrar o cadastro na recep├º├úo.')
    );
end;
$function$

