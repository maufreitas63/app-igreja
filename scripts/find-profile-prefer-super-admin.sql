-- Prioriza perfil com papel super_admin ao resolver telefone duplicado.
-- Execute no SQL Editor do Supabase (substitui find_profile_id_by_phone).

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
       when exists (
         select 1
           from public.profile_access_roles par
           join public.access_roles ar on ar.id = par.role_id
          where par.profile_id = p.id
            and ar.code = 'super_admin'
       ) then 0
       when exists (
         select 1
           from public.profile_access_roles par
          where par.profile_id = p.id
       ) then 1
       else 2
     end,
     p.updated_at desc nulls last
   limit 1;

  return v_id;
end;
$$;

grant execute on function public.find_profile_id_by_phone(text) to anon, authenticated;
