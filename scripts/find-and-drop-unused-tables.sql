-- Identifica tabelas potencialmente nao utilizadas pelo app e permite exclusao opcional.
-- Uso:
-- 1) Rode este script como esta (perform_drop = false) para DRY-RUN.
-- 2) Revise a lista retornada em "candidate_unused_tables".
-- 3) Se estiver tudo certo, altere perform_drop para true e rode novamente.
--
-- ATENCAO:
-- - Exclusao usa DROP TABLE ... CASCADE.
-- - Sempre faca backup/snapshot antes.
-- - Esta lista "used_tables" foi derivada do codigo do app + scripts RPC.

do $$
declare
  perform_drop boolean := false; -- << mude para true para realmente excluir
  rec record;
begin
  create temporary table if not exists used_tables (
    table_name text primary key
  ) on commit drop;

  truncate used_tables;

  insert into used_tables (table_name) values
    ('profiles'),
    ('members'),
    ('events'),
    ('event_registrations'),
    ('checkins'),
    ('profile_vehicles'),
    ('pastoral_requests'),
    ('pastoral_reason_categories'),
    ('pastoral_reason_subcategories'),
    ('app_parameters'),
    ('tipos_escala'),
    ('voluntarios_escala'),
    ('escalas_log'),
    ('access_resources'),
    ('access_roles'),
    ('profile_access_roles'),
    ('access_grants'),
    ('families');

  create temporary table if not exists candidate_unused_tables (
    table_name text primary key
  ) on commit drop;

  truncate candidate_unused_tables;

  insert into candidate_unused_tables (table_name)
  select t.table_name
  from information_schema.tables t
  where t.table_schema = 'public'
    and t.table_type = 'BASE TABLE'
    and t.table_name not like 'pg_%'
    and t.table_name not like 'sql_%'
    and t.table_name not in (select table_name from used_tables)
  order by t.table_name;

  raise notice 'Tabelas candidatas a exclusao (dry-run):';
  for rec in
    select table_name from candidate_unused_tables order by table_name
  loop
    raise notice ' - %', rec.table_name;
  end loop;

  if perform_drop then
    for rec in
      select table_name from candidate_unused_tables order by table_name
    loop
      execute format('drop table if exists public.%I cascade', rec.table_name);
      raise notice 'Excluida: public.%', rec.table_name;
    end loop;
  else
    raise notice 'Dry-run concluido. Nenhuma tabela foi excluida.';
  end if;
end $$;

-- Resultado tabular para facilitar conferenca no SQL editor:
with used_tables(table_name) as (
  values
    ('profiles'),
    ('members'),
    ('events'),
    ('event_registrations'),
    ('checkins'),
    ('profile_vehicles'),
    ('pastoral_requests'),
    ('pastoral_reason_categories'),
    ('pastoral_reason_subcategories'),
    ('app_parameters'),
    ('tipos_escala'),
    ('voluntarios_escala'),
    ('escalas_log'),
    ('access_resources'),
    ('access_roles'),
    ('profile_access_roles'),
    ('access_grants'),
    ('families')
)
select t.table_name as candidate_unused_table
from information_schema.tables t
where t.table_schema = 'public'
  and t.table_type = 'BASE TABLE'
  and t.table_name not in (select table_name from used_tables)
order by t.table_name;
