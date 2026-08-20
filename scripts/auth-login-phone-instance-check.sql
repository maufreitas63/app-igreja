-- =============================================================================
-- Login: celular deve pertencer à instância escolhida
-- =============================================================================
-- Sem isso, um número com PIN em outra igreja (ex.: IBN) ia para "Sua senha"
-- ao informar o código IBEP.
--
-- 1) lookup_login_phone_for_instance — checagem no "Continuar"
-- 2) profile_has_access_pin — PIN só conta se o perfil pode usar o tenant
-- 3) verificar_login — não autentica perfil de outra instância
-- =============================================================================

begin;

create or replace function public.lookup_login_phone_for_instance(p_phone text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.current_session_tenant_id();
  v_profile_id uuid;
  v_in_instance boolean := false;
  v_has_pin boolean := false;
begin
  if v_tenant is null then
    return jsonb_build_object(
      'ok', false,
      'error', 'no_instance',
      'message', 'Informe o código da instância da sua igreja para continuar.'
    );
  end if;

  v_profile_id := public.find_profile_id_by_phone(p_phone);

  if v_profile_id is null then
    return jsonb_build_object(
      'ok', true,
      'in_instance', false,
      'exists_elsewhere', false,
      'has_pin', false
    );
  end if;

  v_in_instance := public.profile_can_use_tenant(v_profile_id, v_tenant);

  select p.access_pin is not null
    into v_has_pin
    from public.profiles p
   where p.id = v_profile_id;

  return jsonb_build_object(
    'ok', true,
    'in_instance', v_in_instance,
    'exists_elsewhere', not v_in_instance,
    'has_pin', coalesce(v_has_pin, false)
  );
end;
$$;

comment on function public.lookup_login_phone_for_instance(text) is
  'Indica se o celular está cadastrado na instância do x-tenant-id (tela de login).';

grant execute on function public.lookup_login_phone_for_instance(text) to anon, authenticated;

create or replace function public.profile_has_access_pin(p_phone text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_profile_id uuid;
  v_tenant uuid;
  v_pin text;
begin
  v_profile_id := public.find_profile_id_by_phone(p_phone);

  if v_profile_id is null then
    return false;
  end if;

  v_tenant := public.current_session_tenant_id();
  if v_tenant is not null and not public.profile_can_use_tenant(v_profile_id, v_tenant) then
    return false;
  end if;

  select p.access_pin
    into v_pin
    from public.profiles p
   where p.id = v_profile_id;

  return v_pin is not null;
end;
$$;

grant execute on function public.profile_has_access_pin(text) to anon, authenticated;

create or replace function public.verificar_login(
  p_phone text,
  p_password text
)
returns table (
  id uuid,
  phone text,
  full_name text,
  birth_date date,
  lgpd_accepted boolean,
  cpf text,
  email text,
  cep text,
  address_street text,
  address_number text,
  address_neighborhood text,
  address_city text,
  address_state text,
  session_token text
)
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_digits text;
  v_local text;
  v_password text;
  v_profile public.profiles%rowtype;
  v_session_token text;
  v_tenant uuid;
begin
  v_password := nullif(trim(coalesce(p_password, '')), '');

  if v_password is null or v_password !~ '^[0-9]{4}$' then
    return;
  end if;

  v_digits := public.normalize_profile_phone(p_phone);

  if v_digits is null then
    return;
  end if;

  if v_digits like '55%' and length(v_digits) >= 12 then
    v_local := substring(v_digits from 3);
  else
    v_local := v_digits;
  end if;

  select p.*
    into v_profile
    from public.profiles p
   where (
       public.normalize_profile_phone(p.phone) = v_digits
       or public.normalize_profile_phone(p.phone) = v_local
       or public.normalize_profile_phone(p.phone) = '55' || v_local
       or p.phone = trim(coalesce(p_phone, ''))
     )
     and p.access_pin is not null
     and trim(p.access_pin) = v_password
   order by
     case
       when public.is_super_admin_profile(p.id) then 1
       else 0
     end,
     p.updated_at desc nulls last
   limit 1;

  if v_profile.id is null then
    return;
  end if;

  v_tenant := public.current_session_tenant_id();
  if v_tenant is not null and not public.profile_can_use_tenant(v_profile.id, v_tenant) then
    return;
  end if;

  begin
    v_session_token := public.issue_profile_session(v_profile.id);
  exception
    when others then
      v_session_token := null;
  end;

  id := v_profile.id;
  phone := v_profile.phone;
  full_name := v_profile.full_name;
  birth_date := v_profile.birth_date;
  lgpd_accepted := v_profile.lgpd_accepted;
  cpf := v_profile.cpf;
  email := v_profile.email;
  cep := v_profile.cep;
  address_street := v_profile.address_street;
  address_number := v_profile.address_number;
  address_neighborhood := v_profile.address_neighborhood;
  address_city := v_profile.address_city;
  address_state := v_profile.address_state;
  session_token := v_session_token;
  return next;
end;
$$;

grant execute on function public.verificar_login(text, text) to anon, authenticated;

notify pgrst, 'reload schema';

commit;
