-- Parte 3/5 — verificar_login com session_token (aguarde ~30s antes da parte 4)

drop function if exists public.verificar_login(text, text);

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
  v_profile_id uuid;
  v_password text;
begin
  v_password := nullif(trim(coalesce(p_password, '')), '');

  if v_password is null or v_password !~ '^[0-9]{4}$' then
    return;
  end if;

  v_profile_id := public.find_profile_id_by_phone(p_phone);

  if v_profile_id is null then
    return;
  end if;

  return query
  select
    p.id,
    p.phone,
    p.full_name,
    p.birth_date,
    p.lgpd_accepted,
    p.cpf,
    p.email,
    p.cep,
    p.address_street,
    p.address_number,
    p.address_neighborhood,
    p.address_city,
    p.address_state,
    public.issue_profile_session(p.id) as session_token
  from public.profiles p
  where p.id = v_profile_id
    and p.access_pin is not null
    and p.access_pin = v_password;
end;
$$;

grant execute on function public.verificar_login(text, text) to anon, authenticated;
