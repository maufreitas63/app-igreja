-- Atualiza funções que leem `members` para considerar apenas accepted = true.
-- Execute no Supabase após members-accepted-column.sql.
--
-- Para register_member_atomic / unregister_member_atomic, prefira reaplicar
-- scripts/register-member-atomic.sql (já inclui o filtro accepted).

create or replace function public.find_member_id_for_profile_sync(
  p_phone text,
  p_full_name text
)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select m.id
  from public.members m
  where m.accepted is true
    and (
      (
        p_phone is not null
        and (
          m.phone = p_phone
          or public.normalize_phone_for_sync(m.phone) = public.normalize_phone_for_sync(p_phone)
        )
      )
      or (
        nullif(trim(coalesce(p_full_name, '')), '') is not null
        and lower(trim(coalesce(m.full_name, ''))) = lower(trim(p_full_name))
      )
    )
  order by
    case
      when p_phone is not null and m.phone = p_phone then 0
      when p_phone is not null and public.normalize_phone_for_sync(m.phone) = public.normalize_phone_for_sync(p_phone) then 1
      else 2
    end,
    m.id
  limit 1;
$$;
