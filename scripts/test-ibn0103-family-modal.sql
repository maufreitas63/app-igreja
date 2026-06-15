-- Validação do botão Família (modal) para IBN0103.
-- Execute no SQL Editor do Supabase após members-list-family-sync.sql.
--
-- Se aparecer: role_has_access does not exist
--   → reaplique members-list-family-sync.sql (inclui role_has_access)
--   → ou execute scripts/access-control-role-has-access-fix.sql
--
-- Resultado esperado em cada RPC abaixo: 4 integrantes (com sessão/perfil com ACL do card).

-- 0) Funções existem?
select proname as rpc_name
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public'
   and proname in (
     'list_members_family_directory',
     'list_profiles_family_directory_by_code',
     'list_profiles_family_directory',
     'resolve_member_family_id_for_directory_person',
     'session_has_members_directory_access'
   )
 order by proname;

-- 1) Dados em members (fonte canônica)
select
  upper(trim(m.family_id)) as family_id,
  m.id as member_id,
  trim(m.full_name) as full_name,
  nullif(trim(coalesce(m.relationship, '')), '') as relationship,
  m.accepted
from public.members m
where upper(trim(m.family_id)) = 'IBN0103'
order by trim(m.full_name);

-- 2) RPC direto por código (o app chama com p_family_id = 'IBN0103')
-- No SQL Editor não há x-profile-id: papel Visitantes não tem members_list → pode retornar 0 linhas (não é erro).
-- Os dados em members (seção 1) são a prova de que o agrupamento IBN0103 está correto.
select * from public.list_members_family_directory('IBN0103');
select * from public.list_profiles_family_directory_by_code('IBN0103', false);

-- 3) Por perfil (simula clique no card: usa profile_id + family_id da linha)
-- Troque :profile_id por um UUID real da família IBN0103 (query abaixo lista opções).
with ibn0103_profiles as (
  select distinct
    p.id as profile_id,
    trim(p.full_name) as full_name,
    coalesce(
      public.resolve_member_family_id_for_directory_person(p.phone, trim(p.full_name)),
      public.profile_directory_family_code(p.family_id, p.codigo_membro)
    ) as family_id_no_card
  from public.profiles p
  join public.members m
    on public.directory_person_matches_member(
      trim(m.full_name),
      m.phone,
      trim(p.full_name),
      p.phone
    )
 where upper(trim(m.family_id)) = 'IBN0103'
)
select * from ibn0103_profiles;

-- Exemplo (substitua o UUID):
-- select * from public.list_profiles_family_directory(
--   '00000000-0000-0000-0000-000000000000'::uuid,
--   'IBN0103',
--   false
-- );

-- 4) ACL: sem sessão os RPCs retornam vazio (comportamento esperado no SQL Editor).
-- No app, o header x-session-token / x-profile-id precisa estar presente.

notify pgrst, 'reload schema';
