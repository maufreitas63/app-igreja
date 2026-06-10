-- Cadastro familiar público (formulário standalone) — transação atômica com código IBN.
-- Execute no SQL Editor do Supabase após register-member-atomic.sql.
--
-- Gera family_id via reserve_next_family_id(), grava profiles + members em uma única RPC
-- (security definer), contornando RLS de tabela quando ACL está ativo.

create or replace function public.submit_family_registration_public(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_family_id text;
  v_informant jsonb;
  v_dependent jsonb;
  v_name text;
  v_birth text;
  v_phone text;
  v_relationship text;
  v_cep text;
  v_address_number text;
  v_address_complement text;
  v_food_alerts text;
  v_inserted int := 0;
  v_allowed_relationships text[] := array[
    'Cônjuge', 'Filho(a)', 'Representante Legal', 'Pai', 'Mãe', 'Outros'
  ];
begin
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    return jsonb_build_object('success', false, 'message', 'Payload inválido.');
  end if;

  v_informant := p_payload -> 'informant';

  if v_informant is null or jsonb_typeof(v_informant) <> 'object' then
    return jsonb_build_object('success', false, 'message', 'Informe os dados do representante legal.');
  end if;

  v_name := nullif(trim(coalesce(v_informant ->> 'full_name', '')), '');

  if v_name is null then
    return jsonb_build_object('success', false, 'message', 'Informe o nome do representante legal.');
  end if;

  v_birth := nullif(trim(coalesce(v_informant ->> 'birth_date', '')), '');

  if v_birth is null then
    return jsonb_build_object('success', false, 'message', 'Informe a data de nascimento do representante legal.');
  end if;

  v_family_id := public.reserve_next_family_id();

  v_phone := nullif(trim(coalesce(v_informant ->> 'phone', '')), '');
  v_cep := nullif(trim(coalesce(v_informant ->> 'cep', '')), '');
  v_address_number := nullif(trim(coalesce(v_informant ->> 'address_number', '')), '');
  v_address_complement := nullif(trim(coalesce(v_informant ->> 'address_complement', '')), '');
  v_food_alerts := nullif(trim(coalesce(v_informant ->> 'medical_food_alerts', '')), '');

  insert into public.profiles (
    full_name,
    birth_date,
    phone,
    family_id,
    codigo_membro,
    cep,
    address_number,
    address_complement,
    medical_food_alerts,
    is_active
  ) values (
    v_name,
    v_birth::date,
    v_phone,
    v_family_id,
    v_family_id,
    v_cep,
    v_address_number,
    v_address_complement,
    v_food_alerts,
    false
  );

  insert into public.members (
    full_name,
    birth_date,
    phone,
    relationship,
    family_id,
    accepted
  ) values (
    v_name,
    v_birth::date,
    v_phone,
    'Representante Legal',
    v_family_id,
    false
  );

  v_inserted := v_inserted + 1;

  for v_dependent in
    select value
      from jsonb_array_elements(coalesce(p_payload -> 'dependents', '[]'::jsonb))
  loop
    v_name := nullif(trim(coalesce(v_dependent ->> 'full_name', '')), '');

    if v_name is null then
      continue;
    end if;

    v_birth := nullif(trim(coalesce(v_dependent ->> 'birth_date', '')), '');

    if v_birth is null then
      return jsonb_build_object(
        'success', false,
        'message',
        format('Data de nascimento inválida para o dependente "%s".', v_name)
      );
    end if;

    v_relationship := nullif(trim(coalesce(v_dependent ->> 'relationship', '')), '');

    if v_relationship is null or not (v_relationship = any (v_allowed_relationships)) then
      return jsonb_build_object(
        'success', false,
        'message',
        format('Vínculo familiar inválido para o dependente "%s".', v_name)
      );
    end if;

    if v_relationship = 'Representante Legal' then
      return jsonb_build_object(
        'success', false,
        'message',
        'Apenas o informante pode ser Representante Legal.'
      );
    end if;

    v_phone := nullif(trim(coalesce(v_dependent ->> 'phone', '')), '');
    v_food_alerts := nullif(trim(coalesce(v_dependent ->> 'medical_food_alerts', '')), '');

    insert into public.profiles (
      full_name,
      birth_date,
      phone,
      family_id,
      codigo_membro,
      cep,
      address_number,
      address_complement,
      medical_food_alerts,
      is_active
    ) values (
      v_name,
      v_birth::date,
      v_phone,
      v_family_id,
      v_family_id,
      v_cep,
      v_address_number,
      v_address_complement,
      v_food_alerts,
      false
    );

    insert into public.members (
      full_name,
      birth_date,
      phone,
      relationship,
      family_id,
      accepted
    ) values (
      v_name,
      v_birth::date,
      v_phone,
      v_relationship,
      v_family_id,
      false
    );

    v_inserted := v_inserted + 1;
  end loop;

  return jsonb_build_object(
    'success', true,
    'family_id', v_family_id,
    'inserted_count', v_inserted
  );
exception
  when others then
    return jsonb_build_object(
      'success', false,
      'message',
      coalesce(sqlerrm, 'Não foi possível gravar o cadastro familiar.')
    );
end;
$$;

grant execute on function public.submit_family_registration_public(jsonb) to anon;
grant execute on function public.submit_family_registration_public(jsonb) to authenticated;
