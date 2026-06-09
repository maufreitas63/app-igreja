-- Sincroniza perfis fictícios [GEO] da tabela profiles para members.
-- Objetivo: fazer os 50 registros aparecerem na "Lista de Membros" do dashboard,
-- que consulta public.members (accepted = true), não public.profiles.
--
-- Regras:
-- - Atualiza membros já existentes quando casar por family_id + full_name.
-- - Insere membros faltantes com accepted = true.
-- - Mantém dados alinhados: full_name, phone, birth_date, family_id.

-- 1) Atualiza registros existentes com base no par (family_id, full_name).
update public.members m
set
  phone = p.phone,
  birth_date = p.birth_date,
  relationship = coalesce(nullif(m.relationship, ''), 'Representante Legal'),
  accepted = true
from public.profiles p
where p.full_name like '[GEO]%'
  and p.family_id is not null
  and m.family_id = p.family_id
  and lower(trim(m.full_name)) = lower(trim(p.full_name));

-- 2) Insere os que ainda não existem em members.
insert into public.members (
  full_name,
  phone,
  birth_date,
  relationship,
  family_id,
  accepted
)
select
  p.full_name,
  p.phone,
  p.birth_date,
  'Representante Legal' as relationship,
  p.family_id,
  true as accepted
from public.profiles p
where p.full_name like '[GEO]%'
  and p.family_id is not null
  and not exists (
    select 1
    from public.members m
    where m.family_id = p.family_id
      and lower(trim(m.full_name)) = lower(trim(p.full_name))
  );

-- Conferência rápida.
select
  m.id,
  m.full_name,
  m.family_id,
  m.phone,
  m.birth_date,
  m.relationship,
  m.accepted
from public.members m
where m.full_name like '[GEO]%'
order by m.full_name;

