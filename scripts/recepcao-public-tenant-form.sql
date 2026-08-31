-- =============================================================================
-- Recepção familiar — formulário público por tenant, CEP, placeholder 1900
-- =============================================================================
-- Aplica: npx supabase db query --linked -f scripts/recepcao-public-tenant-form.sql
-- =============================================================================

create or replace function public.recepcao_cep_digits(p_cep text)
returns text
language sql
immutable
as $$
  select regexp_replace(coalesce(p_cep, ''), '\D', '', 'g');
$$;

create or replace function public.recepcao_lote_process_block_reason(p_lote_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_lote public.recepcao_cadastro_familiar_lote;
  v_names text;
begin
  select * into v_lote
    from public.recepcao_cadastro_familiar_lote l
   where l.id = p_lote_id;

  if v_lote.id is null then
    return 'Lote não encontrado.';
  end if;

  if v_lote.has_family_conflict then
    return format(
      'Lote %s travado: códigos familiares divergentes. Revise manualmente antes de gravar.',
      v_lote.id
    );
  end if;

  select string_agg(r.full_name, ', ' order by r.is_informant desc, r.full_name)
    into v_names
    from public.recepcao_cadastro_familiar r
   where r.submission_id = p_lote_id
     and r.status = 'pending'
     and r.birth_date = date '1900-01-01';

  if v_names is not null then
    return format(
      'Lote %s travado: corrija a data de nascimento (placeholder 01/01/1900) de: %s.',
      v_lote.id,
      v_names
    );
  end if;

  if exists (
    select 1
      from public.recepcao_cadastro_familiar r
     where r.submission_id = p_lote_id
       and r.status = 'pending'
       and r.is_informant
       and length(public.recepcao_cep_digits(r.cep)) <> 8
  ) then
    return format(
      'Lote %s travado: o representante legal precisa de um CEP válido (8 dígitos) antes de gravar.',
      v_lote.id
    );
  end if;

  return null;
end;
$$;

create or replace function public.find_family_id_by_phones_in_tenant(
  p_phones text[],
  p_tenant_id uuid
)
returns text
language sql
stable
security definer
set search_path = public
as $$
  with input_phones as (
    select distinct public.normalize_phone_for_sync(nullif(trim(phone), '')) as phone_digits
      from unnest(coalesce(p_phones, array[]::text[])) as phone
     where nullif(trim(phone), '') is not null
       and length(public.normalize_phone_for_sync(nullif(trim(phone), ''))) >= 10
  ),
  matched as (
    select distinct nullif(trim(coalesce(p.family_id, p.codigo_membro, '')), '') as family_id
      from public.profiles p
      join input_phones ip
        on public.normalize_phone_for_sync(p.phone) = ip.phone_digits
     where p.tenant_id = p_tenant_id
       and nullif(trim(coalesce(p.family_id, p.codigo_membro, '')), '') is not null
  )
  select family_id
    from matched
   where (select count(*) from matched) = 1
   limit 1;
$$;

create or replace function public.count_distinct_family_ids_by_phones_in_tenant(
  p_phones text[],
  p_tenant_id uuid
)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  with input_phones as (
    select distinct public.normalize_phone_for_sync(nullif(trim(phone), '')) as phone_digits
      from unnest(coalesce(p_phones, array[]::text[])) as phone
     where nullif(trim(phone), '') is not null
       and length(public.normalize_phone_for_sync(nullif(trim(phone), ''))) >= 10
  )
  select count(distinct nullif(trim(coalesce(p.family_id, p.codigo_membro, '')), ''))::integer
    from public.profiles p
    join input_phones ip
      on public.normalize_phone_for_sync(p.phone) = ip.phone_digits
   where p.tenant_id = p_tenant_id
     and nullif(trim(coalesce(p.family_id, p.codigo_membro, '')), '') is not null;
$$;

-- ---------------------------------------------------------------------------
-- Envio público: tenant obrigatório (código da instância)
-- ---------------------------------------------------------------------------

create or replace function public.submit_family_registration_public(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
  v_tenant uuid;
  v_submission_id uuid;
  v_informant jsonb;
  v_dependent jsonb;
  v_informant_name text;
  v_informant_birth date;
  v_dependent_name text;
  v_birth date;
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
    'Cônjuge', 'Filho(a)', 'Representante Legal', 'Pai', 'Mãe', 'Outros'
  ];
begin
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    return jsonb_build_object('success', false, 'message', 'Payload inválido.');
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
      'Este link de cadastro está incompleto. Peça à Secretaria o convite com o código da igreja.'
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
      'Igreja não encontrada ou inativa. Confira o código da instância no link.'
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
      return jsonb_build_object('success', false, 'message', 'Data de nascimento do representante legal inválida.');
  end;

  if v_informant_birth is null then
    return jsonb_build_object('success', false, 'message', 'Informe a data de nascimento do representante legal.');
  end if;

  v_phone := nullif(trim(coalesce(v_informant ->> 'phone', '')), '');

  if v_phone is null or not public.recepcao_is_valid_mobile_phone(v_phone) then
    return jsonb_build_object(
      'success', false,
      'message',
      'Verifique e corrija o celular do representante legal: informe exatamente 11 dígitos (DDD + número com 9 na frente, ex.: (11) 98765-4321).'
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

  if length(public.recepcao_cep_digits(v_cep)) <> 8 then
    return jsonb_build_object('success', false, 'message', 'Informe um CEP válido com 8 dígitos.');
  end if;

  if v_address_number is null then
    return jsonb_build_object('success', false, 'message', 'Informe o número do endereço.');
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
          'Verifique e corrija o celular do dependente "%s": informe exatamente 11 dígitos (DDD + número com 9 na frente, ex.: (11) 98765-4321).',
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
          format('Data de nascimento inválida para o dependente "%s".', v_dependent_name)
        );
    end;

    v_relationship := nullif(trim(coalesce(v_dependent ->> 'relationship', '')), '');

    if v_relationship is null or not (v_relationship = any (v_allowed_relationships)) then
      return jsonb_build_object(
        'success', false,
        'message',
        format('Vínculo familiar inválido para o dependente "%s".', v_dependent_name)
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
    detected_family_id,
    matched_profile_id,
    matched_member_id,
    tenant_id
  ) values (
    v_submission_id,
    true,
    v_informant_name,
    v_informant_birth,
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
          format('Data de nascimento inválida para o dependente "%s".', v_dependent_name)
        );
    end;

    v_relationship := nullif(trim(coalesce(v_dependent ->> 'relationship', '')), '');
    v_phone := nullif(trim(coalesce(v_dependent ->> 'phone', '')), '');
    v_food_alerts := nullif(trim(coalesce(v_dependent ->> 'medical_food_alerts', '')), '');

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
      detected_family_id,
      matched_profile_id,
      matched_member_id,
      tenant_id
    ) values (
      v_submission_id,
      false,
      v_dependent_name,
      v_birth,
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
          'Cadastro recebido. Há divergência de códigos familiares entre integrantes — a equipe analisará antes de gravar.'
        when v_detected_family_id is not null then
          format(
            'Cadastro recebido e aguardando análise. Código familiar detectado nas tabelas finais: %s.',
            v_detected_family_id
          )
        else
          'Cadastro recebido e aguardando análise da equipe antes de gravar nas tabelas finais.'
      end
  );
exception
  when others then
    return jsonb_build_object(
      'success', false,
      'message',
      coalesce(sqlerrm, 'Não foi possível registrar o cadastro na recepção.')
    );
end;
$$;

grant execute on function public.submit_family_registration_public(jsonb) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Correção de nascimento placeholder (célula) antes de gravar
-- ---------------------------------------------------------------------------

create or replace function public.update_recepcao_pending_birth_date(
  p_id uuid,
  p_birth_date date
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
  v_row public.recepcao_cadastro_familiar;
begin
  if p_id is null or p_birth_date is null then
    return jsonb_build_object('success', false, 'message', 'Informe a data de nascimento.');
  end if;

  if p_birth_date = date '1900-01-01' then
    return jsonb_build_object('success', false, 'message', 'Informe a data real de nascimento, não o placeholder.');
  end if;

  if p_birth_date > (timezone('America/Sao_Paulo', now()))::date then
    return jsonb_build_object('success', false, 'message', 'A data de nascimento não pode ser futura.');
  end if;

  select * into v_row
    from public.recepcao_cadastro_familiar r
   where r.id = p_id
     and r.tenant_id = v_tenant
     and r.status = 'pending';

  if v_row.id is null then
    return jsonb_build_object('success', false, 'message', 'Registro pendente não encontrado nesta igreja.');
  end if;

  update public.recepcao_cadastro_familiar
     set birth_date = p_birth_date
   where id = p_id
     and tenant_id = v_tenant;

  return jsonb_build_object('success', true, 'message', 'Data de nascimento atualizada.');
end;
$$;

grant execute on function public.update_recepcao_pending_birth_date(uuid, date) to anon, authenticated;

create or replace function public.update_recepcao_pending_cep(
  p_id uuid,
  p_cep text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
  v_row public.recepcao_cadastro_familiar;
  v_cep text := public.recepcao_cep_digits(p_cep);
begin
  if p_id is null or length(coalesce(v_cep, '')) <> 8 then
    return jsonb_build_object('success', false, 'message', 'Informe um CEP válido com 8 dígitos.');
  end if;

  select * into v_row
    from public.recepcao_cadastro_familiar r
   where r.id = p_id
     and r.tenant_id = v_tenant
     and r.status = 'pending';

  if v_row.id is null then
    return jsonb_build_object('success', false, 'message', 'Registro pendente não encontrado nesta igreja.');
  end if;

  update public.recepcao_cadastro_familiar
     set cep = substr(v_cep, 1, 5) || '-' || substr(v_cep, 6, 3)
   where tenant_id = v_tenant
     and submission_id = v_row.submission_id
     and status = 'pending';

  return jsonb_build_object('success', true, 'message', 'CEP atualizado no lote.');
end;
$$;

grant execute on function public.update_recepcao_pending_cep(uuid, text) to anon, authenticated;

grant execute on function public.find_family_id_by_phones_in_tenant(text[], uuid) to anon, authenticated;
grant execute on function public.count_distinct_family_ids_by_phones_in_tenant(text[], uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Telefone reivindicado: só dentro da instância da sessão (processo da Secretaria)
-- ---------------------------------------------------------------------------

create or replace function public.recepcao_phone_claimed_by_other_profile(
  p_phone text,
  p_full_name text
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  with normalized as (
    select
      nullif(trim(coalesce(p_full_name, '')), '') as full_name,
      public.normalize_phone_for_sync(nullif(trim(coalesce(p_phone, '')), '')) as phone_digits,
      public.current_session_tenant_id() as tenant_id
  )
  select exists (
    select 1
      from public.profiles p
      cross join normalized n
     where n.phone_digits is not null
       and length(n.phone_digits) >= 10
       and public.normalize_phone_for_sync(p.phone) = n.phone_digits
       and (n.tenant_id is null or p.tenant_id = n.tenant_id)
       and (
         n.full_name is null
         or lower(trim(coalesce(p.full_name, ''))) <> lower(n.full_name)
       )
  );
$$;

-- ---------------------------------------------------------------------------
-- Tenant no lote (célula / fallback de sessão)
-- ---------------------------------------------------------------------------

create or replace function public.recepcao_lote_fill_tenant()
returns trigger
language plpgsql
as $$
begin
  if NEW.tenant_id is null then
    NEW.tenant_id := public.current_session_tenant_id();
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_recepcao_lote_fill_tenant on public.recepcao_cadastro_familiar_lote;
create trigger trg_recepcao_lote_fill_tenant
  before insert on public.recepcao_cadastro_familiar_lote
  for each row
  execute function public.recepcao_lote_fill_tenant();

create or replace function public.recepcao_pessoa_fill_tenant()
returns trigger
language plpgsql
as $$
begin
  if NEW.tenant_id is null and NEW.submission_id is not null then
    select l.tenant_id
      into NEW.tenant_id
      from public.recepcao_cadastro_familiar_lote l
     where l.id = NEW.submission_id;
  end if;

  if NEW.tenant_id is null then
    NEW.tenant_id := public.current_session_tenant_id();
  end if;

  return NEW;
end;
$$;

drop trigger if exists trg_recepcao_pessoa_fill_tenant on public.recepcao_cadastro_familiar;
create trigger trg_recepcao_pessoa_fill_tenant
  before insert on public.recepcao_cadastro_familiar
  for each row
  execute function public.recepcao_pessoa_fill_tenant();

create or replace function public.enqueue_small_group_visitor(
  p_group_id uuid,
  p_full_name text,
  p_phone text
)
returns jsonb
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
  v_actor uuid := public.current_session_profile_id();
  v_name text := nullif(trim(coalesce(p_full_name, '')), '');
  v_digits text := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  v_phone text;
  v_group_name text;
  v_lote uuid;
begin
  if v_actor is null or not public.is_small_group_operator(v_actor, p_group_id) then
    return jsonb_build_object('success', false, 'message', 'Sem permissão para registrar visitante.');
  end if;

  select g.name into v_group_name
    from public.small_groups g
   where g.id = p_group_id
     and g.tenant_id = v_tenant;

  if v_group_name is null then
    return jsonb_build_object('success', false, 'message', 'Grupo não encontrado.');
  end if;

  if v_name is null then
    return jsonb_build_object('success', false, 'message', 'Informe o nome do visitante.');
  end if;

  if length(v_digits) = 13 and v_digits like '55%' then
    v_digits := substr(v_digits, 3);
  end if;

  if length(v_digits) <> 11 then
    return jsonb_build_object(
      'success', false,
      'message', 'Informe um celular com 11 dígitos (DDD + número).'
    );
  end if;

  v_phone := '(' || substr(v_digits, 1, 2) || ') ' || substr(v_digits, 3, 5) || '-' || substr(v_digits, 8, 4);

  insert into public.recepcao_cadastro_familiar_lote (status, tenant_id)
  values ('pending', v_tenant)
  returning id into v_lote;

  insert into public.recepcao_cadastro_familiar (
    submission_id,
    is_informant,
    full_name,
    birth_date,
    phone,
    relationship,
    medical_food_alerts,
    tenant_id
  ) values (
    v_lote,
    true,
    v_name,
    date '1900-01-01',
    v_phone,
    'Visitante de célula',
    'Origem: pequeno grupo «' || v_group_name || '». Data de nascimento não informada na chamada.',
    v_tenant
  );

  return jsonb_build_object(
    'success', true,
    'message', 'Visitante enviado à fila de Recepção Familiar. Corrija a data de nascimento (01/01/1900) antes de gravar.'
  );
end;
$$;

grant execute on function public.enqueue_small_group_visitor(uuid, text, text)
  to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Listagem: inclui CEP para o alerta da Secretaria
-- ---------------------------------------------------------------------------

create or replace function public.list_recepcao_cadastro_familiar_pending(
  p_limit integer default 50
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
  v_rows jsonb;
begin
  select coalesce(jsonb_agg(row_data order by created_at desc), '[]'::jsonb)
    into v_rows
    from (
      select jsonb_build_object(
        'submission_id', l.id,
        'created_at', l.created_at,
        'member_count', l.member_count,
        'detected_family_id', l.detected_family_id,
        'has_family_conflict', l.has_family_conflict,
        'members', (
          select coalesce(jsonb_agg(
            jsonb_build_object(
              'id', m.id,
              'full_name', m.full_name,
              'is_informant', m.is_informant,
              'relationship', m.relationship,
              'phone', m.phone,
              'birth_date', m.birth_date,
              'cep', m.cep,
              'detected_family_id', m.detected_family_id,
              'matched_profile_id', m.matched_profile_id,
              'matched_member_id', m.matched_member_id
            )
            order by m.is_informant desc, m.full_name
          ), '[]'::jsonb)
          from public.recepcao_cadastro_familiar m
          where m.tenant_id = v_tenant
            and m.submission_id = l.id
            and m.status = 'pending'
        )
      ) as row_data,
      l.created_at
      from public.recepcao_cadastro_familiar_lote l
      where l.tenant_id = v_tenant
        and l.status = 'pending'
      order by l.created_at desc
      limit greatest(coalesce(p_limit, 50), 1)
    ) q;

  return jsonb_build_object('success', true, 'submissions', v_rows);
end;
$$;

grant execute on function public.list_recepcao_cadastro_familiar_pending(integer) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Processo: trava conflito, placeholder 1900-01-01 e CEP inválido
-- ---------------------------------------------------------------------------

create or replace function public.process_recepcao_cadastro_familiar_batch(
  p_submission_ids uuid[] default null,
  p_actor_profile_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
  v_submission record;
  v_member record;
  v_family_id text;
  v_processed_submissions int := 0;
  v_processed_members int := 0;
  v_skipped_conflicts int := 0;
  v_messages text[] := array[]::text[];
  v_apply_profile_id uuid;
  v_apply_member_id uuid;
  v_existing_profile_name text;
  v_existing_member_name text;
  v_address_process_message text;
  v_block_reason text;
begin
  for v_submission in
    select l.*
      from public.recepcao_cadastro_familiar_lote l
     where l.tenant_id = v_tenant
       and l.status = 'pending'
       and (
         p_submission_ids is null
         or cardinality(p_submission_ids) = 0
         or l.id = any (p_submission_ids)
       )
     order by l.created_at
  loop
    v_block_reason := public.recepcao_lote_process_block_reason(v_submission.id);

    if v_block_reason is not null then
      v_skipped_conflicts := v_skipped_conflicts + 1;
      v_messages := array_append(v_messages, v_block_reason);
      continue;
    end if;

    v_family_id := public.resolve_recepcao_lote_family_id(v_submission.id);

    if v_family_id is null then
      v_family_id := public.reserve_next_family_id();
    end if;

    perform set_config('app.skip_family_sync_trigger', 'on', true);

    for v_member in
      select *
        from public.recepcao_cadastro_familiar r
       where r.tenant_id = v_tenant
         and r.submission_id = v_submission.id
         and r.status = 'pending'
       order by r.is_informant desc, r.created_at
    loop
      v_apply_profile_id := v_member.matched_profile_id;
      v_apply_member_id := v_member.matched_member_id;

      if public.recepcao_phone_claimed_by_other_profile(v_member.phone, v_member.full_name) then
        v_apply_profile_id := null;
        v_apply_member_id := null;
      end if;

      if v_apply_profile_id is not null then
        select nullif(trim(coalesce(p.full_name, '')), '')
          into v_existing_profile_name
          from public.profiles p
         where p.tenant_id = v_tenant
           and p.id = v_apply_profile_id;

        if v_existing_profile_name is null
           or lower(v_existing_profile_name) <> lower(trim(v_member.full_name)) then
          v_apply_profile_id := null;
        end if;
      end if;

      if v_apply_member_id is not null then
        select nullif(trim(coalesce(m.full_name, '')), '')
          into v_existing_member_name
          from public.members m
         where m.tenant_id = v_tenant
           and m.id = v_apply_member_id;

        if v_existing_member_name is null
           or lower(v_existing_member_name) <> lower(trim(v_member.full_name)) then
          v_apply_member_id := null;
        end if;
      end if;

      if v_apply_profile_id is not null then
        update public.profiles p
           set full_name = v_member.full_name,
               birth_date = v_member.birth_date,
               phone = coalesce(
                 public.recepcao_phone_for_storage(v_member.phone, v_member.full_name),
                 p.phone
               ),
               family_id = v_family_id,
               codigo_membro = v_family_id,
               medical_food_alerts = coalesce(v_member.medical_food_alerts, p.medical_food_alerts),
               is_active = false
         where p.id = v_apply_profile_id;
      else
        insert into public.profiles (
          full_name,
          birth_date,
          phone,
          family_id,
          codigo_membro,
          medical_food_alerts,
          is_active,
          tenant_id
        ) values (
          v_member.full_name,
          v_member.birth_date,
          public.recepcao_phone_for_storage(v_member.phone, v_member.full_name),
          v_family_id,
          v_family_id,
          v_member.medical_food_alerts,
          false,
          v_tenant
        )
        returning id into v_apply_profile_id;
      end if;

      v_address_process_message := null;

      if v_apply_profile_id is not null
         and (
           nullif(trim(coalesce(v_member.cep, '')), '') is not null
           or coalesce(
                nullif(trim(coalesce(v_member.address_street, '')), ''),
                nullif(trim(coalesce(v_member.address_city, '')), '')
              ) is not null
         ) then
        v_address_process_message := public.apply_recepcao_address_to_profile(
          v_apply_profile_id,
          v_member.cep,
          v_member.address_street,
          v_member.address_neighborhood,
          v_member.address_city,
          v_member.address_state,
          v_member.address_number,
          v_member.address_complement
        );
      end if;

      if v_apply_member_id is not null then
        update public.members m
           set full_name = v_member.full_name,
               birth_date = v_member.birth_date,
               phone = coalesce(
                 public.recepcao_phone_for_storage(v_member.phone, v_member.full_name),
                 m.phone
               ),
               relationship = v_member.relationship,
               family_id = v_family_id,
               accepted = true
         where m.id = v_apply_member_id;
      else
        insert into public.members (
          full_name,
          birth_date,
          phone,
          relationship,
          family_id,
          accepted,
          tenant_id
        ) values (
          v_member.full_name,
          v_member.birth_date,
          public.recepcao_phone_for_storage(v_member.phone, v_member.full_name),
          v_member.relationship,
          v_family_id,
          true,
          v_tenant
        )
        returning id into v_apply_member_id;
      end if;

      update public.recepcao_cadastro_familiar
         set status = 'processed',
             applied_family_id = v_family_id,
             applied_profile_id = v_apply_profile_id,
             applied_member_id = v_apply_member_id,
             processed_at = now(),
             process_message = coalesce(
               v_address_process_message,
               'Gravado em profiles e members.'
             )
       where tenant_id = v_tenant
         and id = v_member.id;

      v_processed_members := v_processed_members + 1;
    end loop;

    perform set_config('app.skip_family_sync_trigger', 'off', true);

    perform public.finalize_recepcao_lote_family_assignments(v_submission.id, v_family_id);

    update public.recepcao_cadastro_familiar_lote
       set status = 'processed',
           detected_family_id = v_family_id,
           processed_at = now(),
           process_message = format('Processado por lote. family_id=%s', v_family_id)
     where tenant_id = v_tenant
       and id = v_submission.id;

    v_processed_submissions := v_processed_submissions + 1;
  end loop;

  return jsonb_build_object(
    'success', true,
    'processed_submissions', v_processed_submissions,
    'processed_members', v_processed_members,
    'skipped_conflicts', v_skipped_conflicts,
    'messages', v_messages
  );
exception
  when others then
    perform set_config('app.skip_family_sync_trigger', 'off', true);
    return jsonb_build_object(
      'success', false,
      'message',
      coalesce(sqlerrm, 'Não foi possível processar a recepção em lote.')
    );
end;
$$;

grant execute on function public.process_recepcao_cadastro_familiar_batch(uuid[], uuid) to anon, authenticated;
