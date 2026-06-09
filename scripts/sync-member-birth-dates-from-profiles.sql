-- Sincroniza members.birth_date a partir de profiles.birth_date.
-- A fonte de verdade deve ser profiles.birth_date.

update public.members m
set birth_date = p.birth_date
from public.profiles p
where
  (
    m.phone is not null
    and regexp_replace(coalesce(m.phone, ''), '\D', '', 'g')
      = regexp_replace(coalesce(p.phone, ''), '\D', '', 'g')
  )
  or lower(trim(m.full_name)) = lower(trim(p.full_name));
