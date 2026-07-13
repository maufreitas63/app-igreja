-- Corrige login quando o PIN no e-mail confere no banco mas a entrada falha.
-- Causas cobertas:
-- 1) verificar_login achava o perfil só pelo telefone e depois checava o PIN
--    (com telefones duplicados, recuperava o PIN num perfil e autenticava outro).
-- 2) Falha em issue_profile_session derrubava o login mesmo com PIN correto.
--
-- Execute no SQL Editor do Supabase. Depois: hard refresh no PWA.

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

  -- Telefone + PIN juntos (evita autenticar perfil “errado” com o mesmo número).
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

grant execute on function public.verificar_login(text, text) to anon;
grant execute on function public.verificar_login(text, text) to authenticated;

notify pgrst, 'reload schema';

-- Diagnóstico (substitua telefone e PIN):
-- select id, phone, access_pin, trim(access_pin) as pin_trim
--   from public.profiles
--  where public.normalize_profile_phone(phone) in ('11999999999', '5511999999999')
--     or phone ilike '%999999999%';
--
-- select * from public.verificar_login('11999999999', '1234');
