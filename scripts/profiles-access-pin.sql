-- Senha de acesso de 4 dígitos em `public.profiles.access_pin`.
-- Celular novo na entrada: `ensure_profile_for_access_pin` cria perfil mínimo (só telefone) antes do PIN.
-- Parâmetros em `app_parameters`:
--   psw_user = sim  → abre WhatsApp para o celular digitado na tela (senha vai ao usuário).
--   psw_user <> sim (ex.: não) → abre WhatsApp para psw_mngr (gestor recebe o código).
--
-- Execute no SQL Editor do Supabase.

alter table public.profiles
  add column if not exists access_pin text;

alter table public.profiles
  drop constraint if exists profiles_access_pin_format;

alter table public.profiles
  add constraint profiles_access_pin_format
  check (access_pin is null or access_pin ~ '^[0-9]{4}$');

create or replace function public.random_access_pin()
returns text
language sql
stable
as $$
  select lpad((floor(random() * 10000))::int::text, 4, '0');
$$;

create or replace function public.normalize_profile_phone(p_phone text)
returns text
language sql
immutable
as $$
  select nullif(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), '');
$$;

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

-- Cria perfil mínimo (só telefone) para celular novo antes de gerar PIN.
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
grant execute on function public.prepare_visitor_access_pin(text) to anon;
grant execute on function public.prepare_visitor_access_pin(text) to authenticated;

create or replace function public.verify_profile_access_pin(p_phone text, p_pin text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_profile_id uuid;
  v_row public.profiles%rowtype;
  v_pin text;
begin
  v_pin := nullif(trim(coalesce(p_pin, '')), '');

  if v_pin is null or v_pin !~ '^[0-9]{4}$' then
    return null;
  end if;

  v_profile_id := public.find_profile_id_by_phone(p_phone);

  if v_profile_id is null then
    return null;
  end if;

  select *
    into v_row
    from public.profiles p
   where p.id = v_profile_id
   limit 1;

  if v_row.access_pin is null then
    return jsonb_build_object('verified', false, 'error', 'pin_not_set');
  end if;

  if v_row.access_pin <> v_pin then
    return jsonb_build_object('verified', false, 'error', 'pin_invalid');
  end if;

  return jsonb_build_object(
    'verified', true,
    'id', v_row.id,
    'phone', v_row.phone,
    'lgpd_accepted', v_row.lgpd_accepted,
    'cpf', v_row.cpf,
    'email', v_row.email,
    'cep', v_row.cep,
    'address_street', v_row.address_street,
    'address_number', v_row.address_number,
    'address_neighborhood', v_row.address_neighborhood,
    'address_city', v_row.address_city,
    'address_state', v_row.address_state
  );
end;
$$;

create or replace function public.update_profile_access_pin(
  p_phone text,
  p_current_pin text,
  p_new_pin text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid;
  v_current text;
  v_new text;
  v_stored text;
begin
  v_current := nullif(trim(coalesce(p_current_pin, '')), '');
  v_new := nullif(trim(coalesce(p_new_pin, '')), '');

  if v_current is null or v_current !~ '^[0-9]{4}$' then
    raise exception 'Informe a senha atual com 4 dígitos.';
  end if;

  if v_new is null or v_new !~ '^[0-9]{4}$' then
    raise exception 'A nova senha deve ter 4 dígitos.';
  end if;

  if v_current = v_new then
    raise exception 'A nova senha deve ser diferente da atual.';
  end if;

  v_profile_id := public.find_profile_id_by_phone(p_phone);

  if v_profile_id is null then
    raise exception 'Perfil não encontrado para este celular.';
  end if;

  if not public.profile_has_access(v_profile_id, 'column', 'profiles.access_pin', 'update') then
    raise exception 'Você não tem permissão para alterar a senha de acesso.';
  end if;

  select p.access_pin
    into v_stored
    from public.profiles p
   where p.id = v_profile_id;

  if v_stored is null then
    raise exception 'Senha ainda não definida. Solicite um código pelo WhatsApp na tela de entrada.';
  end if;

  if v_stored <> v_current then
    raise exception 'Senha atual incorreta.';
  end if;

  update public.profiles
     set access_pin = v_new,
         updated_at = now()
   where id = v_profile_id;
end;
$$;

create or replace function public.profile_has_access_pin(p_phone text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_profile_id uuid;
  v_pin text;
begin
  v_profile_id := public.find_profile_id_by_phone(p_phone);

  if v_profile_id is null then
    return false;
  end if;

  select p.access_pin
    into v_pin
    from public.profiles p
   where p.id = v_profile_id;

  return v_pin is not null;
end;
$$;

grant execute on function public.profile_has_access_pin(text) to anon;
grant execute on function public.profile_has_access_pin(text) to authenticated;
grant execute on function public.regenerate_profile_access_pin(text) to anon;
grant execute on function public.regenerate_profile_access_pin(text) to authenticated;
grant execute on function public.verify_profile_access_pin(text, text) to anon;
grant execute on function public.verify_profile_access_pin(text, text) to authenticated;
grant execute on function public.update_profile_access_pin(text, text, text) to anon;
grant execute on function public.update_profile_access_pin(text, text, text) to authenticated;

-- Parâmetros sugeridos (ajuste os valores conforme a igreja):
-- psw_user = sim  → senha temporária no WhatsApp do celular digitado na tela de login.
-- psw_user = nao  → senha temporária no WhatsApp do gestor (psw_mngr), não no celular do membro.
--
-- insert into public.app_parameters (parameter, value) values ('psw_user', 'nao')
--   on conflict (parameter) do update set value = excluded.value;
-- insert into public.app_parameters (parameter, value) values ('psw_mngr', '5511999999999')
--   on conflict (parameter) do update set value = excluded.value;
