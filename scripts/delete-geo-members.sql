-- Remove membros fictícios de teste (prefixo [GEO] em full_name).
-- Execute no SQL Editor do Supabase.
--
-- Relacionado: profiles [GEO] → scripts/profiles-geo-caraguatatuba-seed.sql
--              sync profiles → members → scripts/sync-geo-profiles-to-members.sql

-- Prévia: quantos serão removidos
select count(*) as total_a_remover
  from public.members m
 where m.full_name like '[GEO]%';

-- Opcional: listar antes de apagar
select m.id, m.full_name, m.family_id, m.phone, m.accepted
  from public.members m
 where m.full_name like '[GEO]%'
 order by m.full_name;

delete from public.members m
 where m.full_name like '[GEO]%';

-- Conferência (deve retornar 0 linhas)
select count(*) as restantes_geo
  from public.members m
 where m.full_name like '[GEO]%';
