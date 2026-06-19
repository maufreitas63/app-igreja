-- Corrige escalonamento indevido para super_admin no login / recuperação de senha.
-- Causa: find_profile_id_by_phone priorizava super_admin com telefones duplicados;
-- regenerate_profile_access_pin gravava o PIN no gestor e verificar_login autenticava como gestor.
--
-- Execute no SQL Editor do Supabase (substitui find-profile-prefer-super-admin.sql).
-- Depois: hard refresh no PWA.

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
   order by
     case
       when public.is_super_admin_profile(p.id) then 1
       else 0
     end,
     p.updated_at desc nulls last
   limit 1;

  return v_id;
end;
$$;

grant execute on function public.find_profile_id_by_phone(text) to anon, authenticated;

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
  v_digits text;
  v_local text;
  v_password text;
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
  where (
      public.normalize_profile_phone(p.phone) = v_digits
      or public.normalize_profile_phone(p.phone) = v_local
      or public.normalize_profile_phone(p.phone) = '55' || v_local
      or p.phone = trim(coalesce(p_phone, ''))
    )
    and p.access_pin is not null
    and p.access_pin = v_password
  order by
    case
      when public.is_super_admin_profile(p.id) then 1
      else 0
    end,
    p.updated_at desc nulls last
  limit 1;
end;
$$;

grant execute on function public.verificar_login(text, text) to anon;
grant execute on function public.verificar_login(text, text) to authenticated;

notify pgrst, 'reload schema';
