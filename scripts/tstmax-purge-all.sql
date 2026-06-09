-- =============================================================================
-- TstMax — remoção completa de dados de teste
-- =============================================================================
-- Execute o bloco inteiro de uma vez no SQL Editor do Supabase (postgres / service_role).
-- Usa um único DO $$ para evitar perda de temp tables entre statements (autocommit).
-- =============================================================================

do $$
begin
  drop table if exists _tstmax_profile_ids;
  drop table if exists _tstmax_event_ids;
  drop table if exists _tstmax_tipo_escala_ids;
  drop table if exists _tstmax_voluntario_ids;
  drop table if exists _tstmax_member_ids;
  drop table if exists _tstmax_registration_ids;
  drop table if exists _tstmax_expense_report_ids;

  create temp table _tstmax_profile_ids as
  select p.id
    from public.profiles p
   where trim(coalesce(p.full_name, '')) ilike 'TstMax%'
      or coalesce(p.family_id, '') like 'TstMax%'
      or coalesce(p.codigo_membro, '') like 'TstMax%'
      or lower(trim(coalesce(p.email, ''))) like '%@tstmax.demo'
      or regexp_replace(coalesce(p.phone, ''), '\D', '', 'g') like '1299900%'
      or regexp_replace(coalesce(p.phone, ''), '\D', '', 'g') like '1299005%';

  create temp table _tstmax_event_ids as
  select e.id
    from public.events e
   where e.name like 'TstMax%'
      or coalesce(e.event_local, '') like 'TstMax%';

  create temp table _tstmax_tipo_escala_ids as
  select te.id
    from public.tipos_escala te
   where te.codigo like 'tstmax%'
      or coalesce(te.nome, '') like 'TstMax%';

  create temp table _tstmax_voluntario_ids as
  select ve.id
    from public.voluntarios_escala ve
   where coalesce(ve.nome, '') like 'TstMax%'
      or ve.tipo_escala_id in (select id from _tstmax_tipo_escala_ids);

  create temp table _tstmax_member_ids as
  select m.id
    from public.members m
   where m.family_id like 'TstMax%'
      or coalesce(m.full_name, '') like 'TstMax%'
      or regexp_replace(coalesce(m.phone, ''), '\D', '', 'g') like '1299900%'
      or regexp_replace(coalesce(m.phone, ''), '\D', '', 'g') like '1299005%';

  create temp table _tstmax_registration_ids as
  select er.id
    from public.event_registrations er
   where er.family_id like 'TstMax%'
      or coalesce(er.full_name, '') ilike 'TstMax%'
      or er.event_id in (select id from _tstmax_event_ids);

  create temp table _tstmax_expense_report_ids as
  select er.id
    from public.expense_reports er
   where er.user_id in (select id from _tstmax_profile_ids)
      or coalesce(er.report_number, '') ilike 'TstMax%'
      or coalesce(er.pix_key, '') ilike 'TstMax%';

  -- 1. RD / despesas
  delete from public.expense_items ei
   where ei.report_id in (select id from _tstmax_expense_report_ids);

  update public.expense_reports er
     set financial_id = null
   where er.id in (select id from _tstmax_expense_report_ids)
     and er.financial_id is not null;

  delete from public.expense_reports er
   where er.id in (select id from _tstmax_expense_report_ids);

  delete from public.financials f
   where coalesce(f.comments, '') ilike '%TstMax%'
      or coalesce(f.account, '') ilike '%TstMax%'
      or coalesce(f.ministry, '') ilike '%TstMax%';

  -- 2. Check-in / quórum / inscrições / eventos
  delete from public.checkins c
   where c.family_id like 'TstMax%'
      or c.event_registration_id in (select id from _tstmax_registration_ids)
      or c.event_id in (select id from _tstmax_event_ids);

  delete from public.event_quorum_registry eqr
   where eqr.event_id in (select id from _tstmax_event_ids)
      or eqr.event_registration_id in (select id from _tstmax_registration_ids);

  delete from public.event_registrations er
   where er.id in (select id from _tstmax_registration_ids);

  delete from public.events e
   where e.id in (select id from _tstmax_event_ids);

  -- 3. Escalas
  delete from public.escalas_log el
   where el.tipo_escala_id in (select id from _tstmax_tipo_escala_ids)
      or el.voluntario_id in (select id from _tstmax_voluntario_ids);

  if to_regclass('public.profile_scale_leadership') is not null then
    delete from public.profile_scale_leadership psl
     where psl.profile_id in (select id from _tstmax_profile_ids)
        or psl.tipo_escala_id in (select id from _tstmax_tipo_escala_ids);
  end if;

  delete from public.voluntarios_escala ve
   where ve.id in (select id from _tstmax_voluntario_ids);

  delete from public.tipos_escala te
   where te.id in (select id from _tstmax_tipo_escala_ids);

  -- 4. Pastoral / veículos / ACL
  delete from public.pastoral_requests pr
   where pr.profile_id in (select id from _tstmax_profile_ids)
      or coalesce(pr.motivo, '') like 'TstMax%'
      or coalesce(pr.situacao, '') like 'TstMax%'
      or coalesce(pr.description, '') like 'TstMax%'
      or regexp_replace(coalesce(pr.phone, ''), '\D', '', 'g') like '1299900%'
      or regexp_replace(coalesce(pr.phone, ''), '\D', '', 'g') like '1299005%';

  if to_regclass('public.profile_vehicles') is not null then
    delete from public.profile_vehicles pv
     where upper(coalesce(pv.placa, '')) like 'TSTMAX%'
        or upper(coalesce(pv.placa, '')) ~ '^TST[0-9]{4}$'
        or pv.phone in (
          select p.phone
            from public.profiles p
           where p.id in (select id from _tstmax_profile_ids)
             and p.phone is not null
        );
  end if;

  if to_regclass('public.access_grants') is not null then
    delete from public.access_grants ag
     where ag.profile_id in (select id from _tstmax_profile_ids);
  end if;

  delete from public.profile_access_roles par
   where par.profile_id in (select id from _tstmax_profile_ids);

  -- 5. Membros e perfis
  delete from public.members m
   where m.id in (select id from _tstmax_member_ids);

  delete from public.profiles p
   where p.id in (select id from _tstmax_profile_ids);

  raise notice 'TstMax purge concluído.';
end $$;

-- Conferência (esperado: 0 em todas as linhas)
select 'profiles' as entidade, count(*) as restantes
  from public.profiles p
 where trim(coalesce(p.full_name, '')) ilike 'TstMax%'
    or coalesce(p.family_id, '') like 'TstMax%'
    or lower(trim(coalesce(p.email, ''))) like '%@tstmax.demo'
union all
select 'members', count(*)
  from public.members m
 where m.family_id like 'TstMax%'
    or coalesce(m.full_name, '') like 'TstMax%'
union all
select 'events', count(*)
  from public.events e
 where e.name like 'TstMax%'
union all
select 'event_registrations', count(*)
  from public.event_registrations er
 where er.family_id like 'TstMax%'
    or coalesce(er.full_name, '') ilike 'TstMax%'
union all
select 'checkins', count(*)
  from public.checkins c
 where c.family_id like 'TstMax%'
union all
select 'tipos_escala', count(*)
  from public.tipos_escala te
 where te.codigo like 'tstmax%'
    or coalesce(te.nome, '') like 'TstMax%'
union all
select 'voluntarios_escala', count(*)
  from public.voluntarios_escala ve
 where coalesce(ve.nome, '') like 'TstMax%'
union all
select 'escalas_log', count(*)
  from public.escalas_log el
  join public.tipos_escala te on te.id = el.tipo_escala_id
 where te.codigo like 'tstmax%'
    or coalesce(te.nome, '') like 'TstMax%'
union all
select 'pastoral_requests', count(*)
  from public.pastoral_requests pr
 where coalesce(pr.motivo, '') like 'TstMax%'
    or coalesce(pr.description, '') like 'TstMax%'
union all
select 'profile_vehicles', count(*)
  from public.profile_vehicles pv
 where upper(coalesce(pv.placa, '')) like 'TSTMAX%'
    or upper(coalesce(pv.placa, '')) ~ '^TST[0-9]{4}$'
union all
select 'expense_reports', count(*)
  from public.expense_reports er
 where coalesce(er.report_number, '') ilike 'TstMax%'
union all
select 'profile_access_roles', count(*)
  from public.profile_access_roles par
  join public.profiles p on p.id = par.profile_id
 where trim(coalesce(p.full_name, '')) ilike 'TstMax%'
    or coalesce(p.family_id, '') like 'TstMax%'
union all
select 'financials_tstmax', count(*)
  from public.financials f
 where coalesce(f.comments, '') ilike '%TstMax%'
order by entidade;

notify pgrst, 'reload schema';
