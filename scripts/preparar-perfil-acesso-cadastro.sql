-- Visitante / celular novo na entrada: cria perfil mínimo em `profiles` e gera PIN de 4 dígitos.
-- Execute TODO este arquivo no SQL Editor do Supabase (uma vez).
-- O app chama `prepare_visitor_access_pin` ou `regenerate_profile_access_pin` (ambos criam o perfil se não existir).

create or replace function public.find_profile_id_by_phone(p_phone text)
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_digits text;
  v_local text;
  v_id uuid;
begin
  v_digits := public.normalize_profile_phone(p_phone);

  if v_digits is null then
    return null;
  end if;

  if v_digits like '55%' and length(v_digits) >= 12 then
    v_local := substring(v_digits from 3);
  else
    v_local := v_digits;
  end if;

  select p.id
    into v_id
    from public.profiles p
   where public.normalize_profile_phone(p.phone) = v_digits
      or public.normalize_profile_phone(p.phone) = v_local
      or public.normalize_profile_phone(p.phone) = '55' || v_local
      or p.phone = trim(coalesce(p_phone, ''))
   order by p.updated_at desc nulls last
   limit 1;

  return v_id;
end;
$$;

create or replace function public.ensure_profile_for_access_pin(p_phone text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid;
  v_formatted_phone text;
  v_digits text;
begin
  v_profile_id := public.find_profile_id_by_phone(p_phone);

  if v_profile_id is not null then
    return v_profile_id;
  end if;

  v_digits := public.normalize_profile_phone(p_phone);

  if v_digits is null or length(v_digits) < 10 then
    raise exception 'Celular inválido para preparar o cadastro.';
  end if;

  begin
    v_formatted_phone := public.format_phone_like_profiles(p_phone);
  exception
    when undefined_function then
      v_formatted_phone := null;
  end;

  if v_formatted_phone is null or v_formatted_phone = '' then
    if length(v_digits) = 11 then
      v_formatted_phone :=
        '(' || substring(v_digits from 1 for 2) || ') '
        || substring(v_digits from 3 for 5) || '-'
        || substring(v_digits from 8 for 4);
    elsif length(v_digits) = 10 then
      v_formatted_phone :=
        '(' || substring(v_digits from 1 for 2) || ') '
        || substring(v_digits from 3 for 4) || '-'
        || substring(v_digits from 7 for 4);
    else
      v_formatted_phone := v_digits;
    end if;
  end if;

  begin
    insert into public.profiles (phone, lgpd_accepted, is_active, full_name)
    values (v_formatted_phone, null, true, null)
    returning id into v_profile_id;
  exception
    when undefined_column then
      begin
        insert into public.profiles (phone, lgpd_accepted)
        values (v_formatted_phone, null)
        returning id into v_profile_id;
      exception
        when not_null_violation then
          insert into public.profiles (phone, lgpd_accepted, full_name)
          values (v_formatted_phone, null, 'Visitante')
          returning id into v_profile_id;
        when unique_violation then
          v_profile_id := null;
        when others then
          raise exception 'Falha ao criar perfil visitante: %', sqlerrm;
      end;
    when not_null_violation then
      begin
        insert into public.profiles (phone, lgpd_accepted, is_active, full_name)
        values (v_formatted_phone, null, true, 'Visitante')
        returning id into v_profile_id;
      exception
        when unique_violation then
          v_profile_id := null;
        when others then
          raise exception 'Falha ao criar perfil visitante: %', sqlerrm;
      end;
    when unique_violation then
      v_profile_id := null;
    when others then
      raise exception 'Falha ao criar perfil visitante: %', sqlerrm;
  end;

  if v_profile_id is null then
    v_profile_id := public.find_profile_id_by_phone(p_phone);
  end if;

  if v_profile_id is null then
    select p.id
      into v_profile_id
      from public.profiles p
     where public.normalize_profile_phone(p.phone) = v_digits
     order by p.updated_at desc nulls last
     limit 1;
  end if;

  if v_profile_id is null then
    raise exception 'Não foi possível preparar o perfil para este celular.';
  end if;

  return v_profile_id;
end;
$$;

create or replace function public.regenerate_profile_access_pin(p_phone text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid;
  v_pin text;
begin
  v_profile_id := public.ensure_profile_for_access_pin(p_phone);

  v_pin := public.random_access_pin();

  update public.profiles
     set access_pin = v_pin,
         updated_at = now()
   where id = v_profile_id;

  return v_pin;
end;
$$;

-- RPC preferida do app: cria visitante + PIN em uma chamada.
create or replace function public.prepare_visitor_access_pin(p_phone text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid;
  v_pin text;
  v_phone text;
begin
  v_profile_id := public.ensure_profile_for_access_pin(p_phone);
  v_pin := public.random_access_pin();

  update public.profiles
     set access_pin = v_pin,
         updated_at = now()
   where id = v_profile_id
  returning phone into v_phone;

  return jsonb_build_object(
    'ok', true,
    'pin', v_pin,
    'profile_id', v_profile_id,
    'phone', v_phone
  );
end;
$$;

grant execute on function public.ensure_profile_for_access_pin(text) to anon;
grant execute on function public.ensure_profile_for_access_pin(text) to authenticated;
grant execute on function public.regenerate_profile_access_pin(text) to anon;
grant execute on function public.regenerate_profile_access_pin(text) to authenticated;
grant execute on function public.prepare_visitor_access_pin(text) to anon;
grant execute on function public.prepare_visitor_access_pin(text) to authenticated;
