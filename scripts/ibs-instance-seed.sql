-- =============================================================================
-- Carga exclusiva da instância IBS (Igreja Batista Semeadores da Verdade)
-- Gerado por scripts/generate-ibs-seed.mjs em 2026-09-10
-- Isolamento: todas as escritas usam tenant_id IBS. IBN e IBEP permanecem intactos.
-- Reexecutável: remove apenas family_id IBS9xxx, e-mails @ibs.conectamais.app e
-- dados operacionais já existentes na IBS (hoje vazios, além de KIDS/TEENS).
-- =============================================================================
begin;
set local row_security = off;
select set_config('app.bypass_tenant_guard', 'on', true);

do $seed$
declare
  v_ibs uuid := '81295e39-9167-40b4-a524-702439905e75'::uuid;
  v_ibn uuid := 'a0000000-0000-4000-8000-000000000001'::uuid;
  v_mauricio uuid := '04b919ba-38b4-4fe5-a371-2e98e9acbc0d'::uuid;
begin
  if not exists (select 1 from public.igrejas i where i.id = v_ibs and i.code = 'IBS') then
    raise exception 'Tenant IBS não encontrado';
  end if;
end;
$seed$;

-- ---------------------------------------------------------------------------
-- 0. Limpeza idempotente (somente IBS / marcadores desta carga)
-- ---------------------------------------------------------------------------
delete from public.scale_swap_notices n
 where n.tenant_id = '81295e39-9167-40b4-a524-702439905e75'::uuid;
delete from public.scale_swap_audit a
 where a.tenant_id = '81295e39-9167-40b4-a524-702439905e75'::uuid;
delete from public.scale_swap_requests r
 where r.tenant_id = '81295e39-9167-40b4-a524-702439905e75'::uuid;
delete from public.escalas_log el
 where el.tenant_id = '81295e39-9167-40b4-a524-702439905e75'::uuid;
delete from public.voluntarios_escala ve
 where ve.tenant_id = '81295e39-9167-40b4-a524-702439905e75'::uuid;
delete from public.tipos_escala te
 where te.tenant_id = '81295e39-9167-40b4-a524-702439905e75'::uuid;

delete from public.pastoral_slot_notices n
 where n.tenant_id = '81295e39-9167-40b4-a524-702439905e75'::uuid;
delete from public.pastoral_slots s
 where s.tenant_id = '81295e39-9167-40b4-a524-702439905e75'::uuid;
delete from public.pastoral_requests pr
 where pr.tenant_id = '81295e39-9167-40b4-a524-702439905e75'::uuid;

delete from public.small_group_attendance a
 where a.tenant_id = '81295e39-9167-40b4-a524-702439905e75'::uuid;
delete from public.small_group_members m
 where m.tenant_id = '81295e39-9167-40b4-a524-702439905e75'::uuid;
delete from public.small_groups g
 where g.tenant_id = '81295e39-9167-40b4-a524-702439905e75'::uuid;

delete from public.event_avisos a
 where a.tenant_id = '81295e39-9167-40b4-a524-702439905e75'::uuid;
delete from public.event_registrations er
 where er.tenant_id = '81295e39-9167-40b4-a524-702439905e75'::uuid;
delete from public.events e
 where e.tenant_id = '81295e39-9167-40b4-a524-702439905e75'::uuid;

delete from public.campaign_contribution_intents i
 where i.tenant_id = '81295e39-9167-40b4-a524-702439905e75'::uuid;
delete from public.campaign_milestone_notices n
 where n.tenant_id = '81295e39-9167-40b4-a524-702439905e75'::uuid;
delete from public.financials f
 where f.tenant_id = '81295e39-9167-40b4-a524-702439905e75'::uuid;
delete from public.campaign_projects c
 where c.tenant_id = '81295e39-9167-40b4-a524-702439905e75'::uuid;

delete from public.volunteer_opportunity_interests i
 where i.tenant_id = '81295e39-9167-40b4-a524-702439905e75'::uuid;
delete from public.volunteer_opportunities o
 where o.tenant_id = '81295e39-9167-40b4-a524-702439905e75'::uuid;
delete from public.generosity_interests gi
 where gi.tenant_id = '81295e39-9167-40b4-a524-702439905e75'::uuid;
delete from public.generosity_notices gn
 where gn.tenant_id = '81295e39-9167-40b4-a524-702439905e75'::uuid;
delete from public.generosity_posts gp
 where gp.tenant_id = '81295e39-9167-40b4-a524-702439905e75'::uuid;

delete from public.recepcao_cadastro_familiar r
 where r.tenant_id = '81295e39-9167-40b4-a524-702439905e75'::uuid;
delete from public.recepcao_cadastro_familiar_lote l
 where l.tenant_id = '81295e39-9167-40b4-a524-702439905e75'::uuid;

delete from public.livros l
 where l.tenant_id = '81295e39-9167-40b4-a524-702439905e75'::uuid;

delete from public.profile_access_roles par
 where par.profile_id in (
   select p.id from public.profiles p
    where p.family_id ~ '^IBS9[0-9]{3}$'
       or lower(coalesce(p.email, '')) like '%@ibs.conectamais.app'
 );
delete from public.profile_igreja_vinculos v
 where v.profile_id in (
   select p.id from public.profiles p
    where p.family_id ~ '^IBS9[0-9]{3}$'
       or lower(coalesce(p.email, '')) like '%@ibs.conectamais.app'
 );
delete from public.members m
 where m.tenant_id = '81295e39-9167-40b4-a524-702439905e75'::uuid
   and m.family_id ~ '^IBS9[0-9]{3}$';
delete from public.profiles p
 where p.id <> '04b919ba-38b4-4fe5-a371-2e98e9acbc0d'::uuid
   and (p.family_id ~ '^IBS9[0-9]{3}$'
        or lower(coalesce(p.email, '')) like '%@ibs.conectamais.app');

-- ---------------------------------------------------------------------------
-- 1. Superadministrador Maurício de Freitas na IBS
-- ---------------------------------------------------------------------------
insert into public.profile_igreja_vinculos (profile_id, tenant_id, is_primary, is_active)
values ('04b919ba-38b4-4fe5-a371-2e98e9acbc0d'::uuid, '81295e39-9167-40b4-a524-702439905e75'::uuid, true, true)
on conflict (profile_id, tenant_id) do update
  set is_active = true, updated_at = now();

insert into public.profile_access_roles (profile_id, role_id, tenant_id, granted_by_profile_id)
select '04b919ba-38b4-4fe5-a371-2e98e9acbc0d'::uuid, r.id, '81295e39-9167-40b4-a524-702439905e75'::uuid, '04b919ba-38b4-4fe5-a371-2e98e9acbc0d'::uuid
  from public.access_roles r
 where r.code in ('super_admin', 'member', 'pastoral', 'secretaria', 'tesoureiro', 'family_acceptor')
on conflict (profile_id, role_id) do update
  set tenant_id = coalesce(public.profile_access_roles.tenant_id, excluded.tenant_id);

-- ---------------------------------------------------------------------------
-- 2. Salas: réplica da configuração IBN (chaves, tipos, datas)
-- ---------------------------------------------------------------------------
insert into public.church_room_settings (
  tenant_id, room_key, display_label, badge_label, color_hex, is_enabled,
  sort_order, is_system, room_kind, start_date, end_date
)
select '81295e39-9167-40b4-a524-702439905e75'::uuid, r.room_key, r.display_label, r.badge_label, r.color_hex, r.is_enabled,
       r.sort_order, r.is_system, r.room_kind, r.start_date, r.end_date
  from public.church_room_settings r
 where r.tenant_id = 'a0000000-0000-4000-8000-000000000001'::uuid
on conflict (tenant_id, room_key) do update
  set display_label = excluded.display_label,
      badge_label = excluded.badge_label,
      color_hex = excluded.color_hex,
      is_enabled = excluded.is_enabled,
      sort_order = excluded.sort_order,
      is_system = excluded.is_system,
      room_kind = excluded.room_kind,
      start_date = excluded.start_date,
      end_date = excluded.end_date,
      updated_at = now();

-- ---------------------------------------------------------------------------
-- 3. Pessoas, famílias, papéis e vínculos (somente IBS)
-- ---------------------------------------------------------------------------
insert into public.profiles (id, tenant_id, full_name, email, phone, birth_date, family_id, codigo_membro,
          lgpd_accepted, lgpd_accepted_at, is_active, access_pin,
          cep, address_street, address_number, address_neighborhood, address_city, address_state,
          first_visit_date) values
  ('c81295e3-9167-40b4-8524-000000000001', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Ricardo Almeida Menezes', 'adriano.oliveira.queiroz.2@ibs.conectamais.app', '(11) 98810-0001', '1988-01-10'::date, 'IBS9001', 'IBS9001', true, now(), true, '4100', '09780-220', 'Rua Nova Petrópolis', '112', 'Nova Petrópolis', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000002', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Isabela Queiroz Oliveira', 'isabela.queiroz.oliveira.3@ibs.conectamais.app', '(11) 98810-0002', '1989-04-14'::date, 'IBS9001', 'IBS9001', true, now(), true, '4101', '09780-220', 'Rua Nova Petrópolis', '112', 'Nova Petrópolis', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000003', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Valentina Oliveira Queiroz', null, null, '2010-11-12'::date, 'IBS9001', 'IBS9001', true, now(), false, null, '09780-220', 'Rua Nova Petrópolis', '112', 'Nova Petrópolis', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000004', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Laura Oliveira Queiroz', null, null, '2012-09-27'::date, 'IBS9001', 'IBS9001', true, now(), false, null, '09780-220', 'Rua Nova Petrópolis', '112', 'Nova Petrópolis', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000005', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Eduardo Nogueira Camargo', 'cesar.peixoto.queiroz.6@ibs.conectamais.app', '(11) 98810-0003', '1987-04-06'::date, 'IBS9002', 'IBS9002', true, now(), true, '4102', '09890-210', 'Rua Assunção', '297', 'Assunção', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000006', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Maria Queiroz Peixoto', 'maria.queiroz.peixoto.7@ibs.conectamais.app', '(11) 98810-0004', '1992-08-09'::date, 'IBS9002', 'IBS9002', true, now(), true, '4103', '09890-210', 'Rua Assunção', '297', 'Assunção', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000007', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Laura Peixoto Queiroz', null, null, '2012-10-16'::date, 'IBS9002', 'IBS9002', true, now(), false, null, '09890-210', 'Rua Assunção', '297', 'Assunção', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000008', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Heitor Peixoto Queiroz', null, null, '2014-10-07'::date, 'IBS9002', 'IBS9002', true, now(), false, null, '09890-210', 'Rua Assunção', '297', 'Assunção', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000009', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Henrique Azevedo Pereira', 'henrique.azevedo.pereira.10@ibs.conectamais.app', '(11) 98810-0005', '1991-09-01'::date, 'IBS9003', 'IBS9003', true, now(), true, '4104', '09750-240', 'Rua Marechal Deodoro', '469', 'Centro', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000010', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Sabrina Pereira Azevedo', 'sabrina.pereira.azevedo.11@ibs.conectamais.app', '(11) 98810-0006', '1996-11-18'::date, 'IBS9003', 'IBS9003', true, now(), true, '4105', '09750-240', 'Rua Marechal Deodoro', '469', 'Centro', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000011', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Arthur Azevedo Pereira', null, null, '2016-12-25'::date, 'IBS9003', 'IBS9003', true, now(), false, null, '09750-240', 'Rua Marechal Deodoro', '469', 'Centro', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000012', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Lorena Azevedo Pereira', null, null, '2019-08-16'::date, 'IBS9003', 'IBS9003', true, now(), false, null, '09750-240', 'Rua Marechal Deodoro', '469', 'Centro', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000013', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'José Rodrigues Vieira', 'jose.rodrigues.vieira.14@ibs.conectamais.app', '(11) 98810-0007', '1981-01-08'::date, 'IBS9004', 'IBS9004', true, now(), true, '4106', '09890-210', 'Rua Assunção', '335', 'Assunção', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000014', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Lúcia Vieira Rodrigues', 'lucia.vieira.rodrigues.15@ibs.conectamais.app', '(11) 98810-0008', '1981-11-12'::date, 'IBS9004', 'IBS9004', true, now(), true, '4107', '09890-210', 'Rua Assunção', '335', 'Assunção', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000015', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Cecília Rodrigues Vieira', null, null, '2010-10-05'::date, 'IBS9004', 'IBS9004', true, now(), false, null, '09890-210', 'Rua Assunção', '335', 'Assunção', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000016', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Heloísa Rodrigues Vieira', null, null, '2014-11-20'::date, 'IBS9004', 'IBS9004', true, now(), false, null, '09890-210', 'Rua Assunção', '335', 'Assunção', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000017', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Wagner Oliveira Almeida', 'wagner.oliveira.almeida.18@ibs.conectamais.app', '(11) 98810-0009', '1976-07-20'::date, 'IBS9005', 'IBS9005', true, now(), true, '4108', '09600-010', 'Avenida Kennedy', '94', 'Rudge Ramos', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000018', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Lívia Almeida Oliveira', 'livia.almeida.oliveira.19@ibs.conectamais.app', '(11) 98810-0010', '1981-02-28'::date, 'IBS9005', 'IBS9005', true, now(), true, '4109', '09600-010', 'Avenida Kennedy', '94', 'Rudge Ramos', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000019', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Ravi Oliveira Almeida', null, null, '2010-09-09'::date, 'IBS9005', 'IBS9005', true, now(), false, null, '09600-010', 'Avenida Kennedy', '94', 'Rudge Ramos', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000020', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Nicolas Oliveira Almeida', null, null, '2012-02-06'::date, 'IBS9005', 'IBS9005', true, now(), false, null, '09600-010', 'Avenida Kennedy', '94', 'Rudge Ramos', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000021', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Ricardo Lima Macedo', 'ricardo.lima.macedo.22@ibs.conectamais.app', '(11) 98810-0011', '1990-04-19'::date, 'IBS9006', 'IBS9006', true, now(), true, '4110', '09715-140', 'Rua Jurubatuba', '494', 'Centro', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000022', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Ingrid Macedo Lima', 'ingrid.macedo.lima.23@ibs.conectamais.app', '(11) 98810-0012', '1991-09-01'::date, 'IBS9006', 'IBS9006', true, now(), true, '4111', '09715-140', 'Rua Jurubatuba', '494', 'Centro', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000023', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Davi Lima Macedo', null, null, '2011-01-24'::date, 'IBS9006', 'IBS9006', true, now(), false, null, '09715-140', 'Rua Jurubatuba', '494', 'Centro', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000024', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Samuel Lima Macedo', null, null, '2014-06-27'::date, 'IBS9006', 'IBS9006', true, now(), false, null, '09715-140', 'Rua Jurubatuba', '494', 'Centro', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000025', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Pedro Barros Ribeiro', 'pedro.barros.ribeiro.26@ibs.conectamais.app', '(11) 98810-0013', '1976-10-24'::date, 'IBS9007', 'IBS9007', true, now(), true, '4112', '09780-220', 'Rua Nova Petrópolis', '267', 'Nova Petrópolis', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000026', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Beatriz Ribeiro Barros', 'beatriz.ribeiro.barros.27@ibs.conectamais.app', '(11) 98810-0014', '1977-12-15'::date, 'IBS9007', 'IBS9007', true, now(), true, '4113', '09780-220', 'Rua Nova Petrópolis', '267', 'Nova Petrópolis', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000027', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Isis Barros Ribeiro', null, null, '2010-12-08'::date, 'IBS9007', 'IBS9007', true, now(), false, null, '09780-220', 'Rua Nova Petrópolis', '267', 'Nova Petrópolis', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000028', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Maya Barros Ribeiro', null, null, '2013-12-17'::date, 'IBS9007', 'IBS9007', true, now(), false, null, '09780-220', 'Rua Nova Petrópolis', '267', 'Nova Petrópolis', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000029', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Carlos Oliveira Correia', 'carlos.oliveira.correia.30@ibs.conectamais.app', '(11) 98810-0015', '1980-02-07'::date, 'IBS9008', 'IBS9008', true, now(), true, '4114', '09606-000', 'Rua Tamandaré', '744', 'Rudge Ramos', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000030', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Eliane Correia Oliveira', 'eliane.correia.oliveira.31@ibs.conectamais.app', '(11) 98810-0016', '1983-12-11'::date, 'IBS9008', 'IBS9008', true, now(), true, '4115', '09606-000', 'Rua Tamandaré', '744', 'Rudge Ramos', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000031', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Manuela Oliveira Correia', null, null, '2010-05-03'::date, 'IBS9008', 'IBS9008', true, now(), false, null, '09606-000', 'Rua Tamandaré', '744', 'Rudge Ramos', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000032', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Maya Oliveira Correia', null, null, '2012-05-19'::date, 'IBS9008', 'IBS9008', true, now(), false, null, '09606-000', 'Rua Tamandaré', '744', 'Rudge Ramos', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000033', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Samuel Farias Barbosa', 'samuel.farias.barbosa.34@ibs.conectamais.app', '(11) 98810-0017', '1981-04-06'::date, 'IBS9009', 'IBS9009', true, now(), true, '4116', '09820-130', 'Rua Ferrazópolis', '689', 'Ferrazópolis', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000034', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Ingrid Barbosa Farias', 'ingrid.barbosa.farias.35@ibs.conectamais.app', '(11) 98810-0018', '1984-07-14'::date, 'IBS9009', 'IBS9009', true, now(), true, '4117', '09820-130', 'Rua Ferrazópolis', '689', 'Ferrazópolis', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000035', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Nicolas Farias Barbosa', null, null, '2010-02-16'::date, 'IBS9009', 'IBS9009', true, now(), false, null, '09820-130', 'Rua Ferrazópolis', '689', 'Ferrazópolis', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000036', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Luna Farias Barbosa', null, null, '2013-09-09'::date, 'IBS9009', 'IBS9009', true, now(), false, null, '09820-130', 'Rua Ferrazópolis', '689', 'Ferrazópolis', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000037', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Júlio Carvalho Vasconcelos', 'julio.carvalho.vasconcelos.38@ibs.conectamais.app', '(11) 98810-0019', '1981-07-26'::date, 'IBS9010', 'IBS9010', true, now(), true, '4118', '09750-500', 'Rua Silva Jardim', '288', 'Centro', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000038', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Carolina Vasconcelos Carvalho', 'carolina.vasconcelos.carvalho.39@ibs.conectamais.app', '(11) 98810-0020', '1984-03-16'::date, 'IBS9010', 'IBS9010', true, now(), true, '4119', '09750-500', 'Rua Silva Jardim', '288', 'Centro', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000039', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Manuela Carvalho Vasconcelos', null, null, '2010-10-08'::date, 'IBS9010', 'IBS9010', true, now(), false, null, '09750-500', 'Rua Silva Jardim', '288', 'Centro', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000040', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Sophia Carvalho Vasconcelos', null, null, '2013-10-07'::date, 'IBS9010', 'IBS9010', true, now(), false, null, '09750-500', 'Rua Silva Jardim', '288', 'Centro', 'São Bernardo do Campo', 'SP', null);

insert into public.profiles (id, tenant_id, full_name, email, phone, birth_date, family_id, codigo_membro,
          lgpd_accepted, lgpd_accepted_at, is_active, access_pin,
          cep, address_street, address_number, address_neighborhood, address_city, address_state,
          first_visit_date) values
  ('c81295e3-9167-40b4-8524-000000000041', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Gabriel Guimarães Machado', 'gabriel.guimaraes.machado.42@ibs.conectamais.app', '(11) 98810-0021', '1979-10-26'::date, 'IBS9011', 'IBS9011', true, now(), true, '4120', '09635-000', 'Rua dos Vianas', '624', 'Rudge Ramos', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000042', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Natália Machado Guimarães', 'natalia.machado.guimaraes.43@ibs.conectamais.app', '(11) 98810-0022', '1981-04-26'::date, 'IBS9011', 'IBS9011', true, now(), true, '4121', '09635-000', 'Rua dos Vianas', '624', 'Rudge Ramos', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000043', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Valentina Guimarães Machado', null, null, '2010-07-04'::date, 'IBS9011', 'IBS9011', true, now(), false, null, '09635-000', 'Rua dos Vianas', '624', 'Rudge Ramos', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000044', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Miguel Guimarães Machado', null, null, '2012-06-26'::date, 'IBS9011', 'IBS9011', true, now(), false, null, '09635-000', 'Rua dos Vianas', '624', 'Rudge Ramos', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000045', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Samuel Rezende Araujo', 'samuel.rezende.araujo.46@ibs.conectamais.app', '(11) 98810-0023', '1978-08-19'::date, 'IBS9012', 'IBS9012', true, now(), true, '4122', '09750-240', 'Rua Marechal Deodoro', '697', 'Centro', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000046', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Aparecida Araujo Rezende', 'aparecida.araujo.rezende.47@ibs.conectamais.app', '(11) 98810-0024', '1984-02-16'::date, 'IBS9012', 'IBS9012', true, now(), true, '4123', '09750-240', 'Rua Marechal Deodoro', '697', 'Centro', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000047', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Davi Rezende Araujo', null, null, '2010-08-08'::date, 'IBS9012', 'IBS9012', true, now(), false, null, '09750-240', 'Rua Marechal Deodoro', '697', 'Centro', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000048', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Alice Rezende Araujo', null, null, '2012-02-07'::date, 'IBS9012', 'IBS9012', true, now(), false, null, '09750-240', 'Rua Marechal Deodoro', '697', 'Centro', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000049', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'André Aguiar Rezende', 'andre.aguiar.rezende.50@ibs.conectamais.app', '(11) 98810-0025', '1984-01-10'::date, 'IBS9013', 'IBS9013', true, now(), true, '4124', '09811-150', 'Rua dos Otonis', '333', 'Assunção', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000050', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Helena Rezende Aguiar', 'helena.rezende.aguiar.51@ibs.conectamais.app', '(11) 98810-0026', '1988-02-13'::date, 'IBS9013', 'IBS9013', true, now(), true, '4125', '09811-150', 'Rua dos Otonis', '333', 'Assunção', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000051', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Manuela Aguiar Rezende', null, null, '2010-04-01'::date, 'IBS9013', 'IBS9013', true, now(), false, null, '09811-150', 'Rua dos Otonis', '333', 'Assunção', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000052', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Caleb Aguiar Rezende', null, null, '2013-01-04'::date, 'IBS9013', 'IBS9013', true, now(), false, null, '09811-150', 'Rua dos Otonis', '333', 'Assunção', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000053', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Felipe Castro Gomes', 'felipe.castro.gomes.54@ibs.conectamais.app', '(11) 98810-0027', '1990-01-21'::date, 'IBS9014', 'IBS9014', true, now(), true, '4126', '09861-040', 'Avenida Demarchi', '526', 'Demarchi', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000054', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Simone Gomes Castro', 'simone.gomes.castro.55@ibs.conectamais.app', '(11) 98810-0028', '1993-11-13'::date, 'IBS9014', 'IBS9014', true, now(), true, '4127', '09861-040', 'Avenida Demarchi', '526', 'Demarchi', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000055', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Samuel Castro Gomes', null, null, '2013-08-10'::date, 'IBS9014', 'IBS9014', true, now(), false, null, '09861-040', 'Avenida Demarchi', '526', 'Demarchi', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000056', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Gael Castro Gomes', null, null, '2016-10-23'::date, 'IBS9014', 'IBS9014', true, now(), false, null, '09861-040', 'Avenida Demarchi', '526', 'Demarchi', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000057', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Marcelo Nunes Ferreira', 'marcelo.nunes.ferreira.58@ibs.conectamais.app', '(11) 98810-0029', '1988-01-23'::date, 'IBS9015', 'IBS9015', true, now(), true, '4128', '09890-210', 'Rua Assunção', '478', 'Assunção', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000058', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Priscila Ferreira Nunes', 'priscila.ferreira.nunes.59@ibs.conectamais.app', '(11) 98810-0030', '1990-04-23'::date, 'IBS9015', 'IBS9015', true, now(), true, '4129', '09890-210', 'Rua Assunção', '478', 'Assunção', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000059', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Miguel Nunes Ferreira', null, null, '2010-05-10'::date, 'IBS9015', 'IBS9015', true, now(), false, null, '09890-210', 'Rua Assunção', '478', 'Assunção', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000060', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Laura Nunes Ferreira', null, null, '2014-09-18'::date, 'IBS9015', 'IBS9015', true, now(), false, null, '09890-210', 'Rua Assunção', '478', 'Assunção', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000061', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Felipe Cunha Moreira', 'felipe.cunha.moreira.62@ibs.conectamais.app', '(11) 98810-0031', '1992-12-22'::date, 'IBS9016', 'IBS9016', true, now(), true, '4130', '09715-140', 'Rua Jurubatuba', '499', 'Centro', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000062', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Eliane Moreira Cunha', 'eliane.moreira.cunha.63@ibs.conectamais.app', '(11) 98810-0032', '1996-07-24'::date, 'IBS9016', 'IBS9016', true, now(), true, '4131', '09715-140', 'Rua Jurubatuba', '499', 'Centro', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000063', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Sophia Cunha Moreira', null, null, '2016-02-14'::date, 'IBS9016', 'IBS9016', true, now(), false, null, '09715-140', 'Rua Jurubatuba', '499', 'Centro', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000064', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Cecília Cunha Moreira', null, null, '2020-05-08'::date, 'IBS9016', 'IBS9016', true, now(), false, null, '09715-140', 'Rua Jurubatuba', '499', 'Centro', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000065', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'João Barbosa Oliveira', 'joao.barbosa.oliveira.66@ibs.conectamais.app', '(11) 98810-0033', '1985-04-10'::date, 'IBS9017', 'IBS9017', true, now(), true, '4132', '09750-500', 'Rua Silva Jardim', '327', 'Centro', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000066', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Fabiana Oliveira Barbosa', 'fabiana.oliveira.barbosa.67@ibs.conectamais.app', '(11) 98810-0034', '1989-04-06'::date, 'IBS9017', 'IBS9017', true, now(), true, '4133', '09750-500', 'Rua Silva Jardim', '327', 'Centro', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000067', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Caleb Barbosa Oliveira', null, null, '2010-01-16'::date, 'IBS9017', 'IBS9017', true, now(), false, null, '09750-500', 'Rua Silva Jardim', '327', 'Centro', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000068', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Valentina Barbosa Oliveira', null, null, '2012-05-19'::date, 'IBS9017', 'IBS9017', true, now(), false, null, '09750-500', 'Rua Silva Jardim', '327', 'Centro', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000069', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Murilo Monteiro Machado', 'murilo.monteiro.machado.70@ibs.conectamais.app', '(11) 98810-0035', '1974-06-14'::date, 'IBS9018', 'IBS9018', true, now(), true, '4134', '09811-150', 'Rua dos Otonis', '869', 'Assunção', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000070', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Bianca Machado Monteiro', 'bianca.machado.monteiro.71@ibs.conectamais.app', '(11) 98810-0036', '1976-10-09'::date, 'IBS9018', 'IBS9018', true, now(), true, '4135', '09811-150', 'Rua dos Otonis', '869', 'Assunção', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000071', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Theo Monteiro Machado', null, null, '2010-11-03'::date, 'IBS9018', 'IBS9018', true, now(), false, null, '09811-150', 'Rua dos Otonis', '869', 'Assunção', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000072', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Liz Monteiro Machado', null, null, '2013-12-09'::date, 'IBS9018', 'IBS9018', true, now(), false, null, '09811-150', 'Rua dos Otonis', '869', 'Assunção', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000073', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Rafael Teixeira Correia', 'rafael.teixeira.correia.74@ibs.conectamais.app', '(11) 98810-0037', '1990-12-11'::date, 'IBS9019', 'IBS9019', true, now(), true, '4136', '09890-210', 'Rua Assunção', '677', 'Assunção', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000074', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Amanda Correia Teixeira', 'amanda.correia.teixeira.75@ibs.conectamais.app', '(11) 98810-0038', '1990-02-23'::date, 'IBS9019', 'IBS9019', true, now(), true, '4137', '09890-210', 'Rua Assunção', '677', 'Assunção', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000075', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Benício Teixeira Correia', null, null, '2010-12-17'::date, 'IBS9019', 'IBS9019', true, now(), false, null, '09890-210', 'Rua Assunção', '677', 'Assunção', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000076', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Luna Teixeira Correia', null, null, '2014-05-06'::date, 'IBS9019', 'IBS9019', true, now(), false, null, '09890-210', 'Rua Assunção', '677', 'Assunção', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000077', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'José Cardoso Machado', 'jose.cardoso.machado.78@ibs.conectamais.app', '(11) 98810-0039', '1987-09-20'::date, 'IBS9020', 'IBS9020', true, now(), true, '4138', '09770-310', 'Rua Baeta Neves', '859', 'Baeta Neves', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000078', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Maria Machado Cardoso', 'maria.machado.cardoso.79@ibs.conectamais.app', '(11) 98810-0040', '1990-09-07'::date, 'IBS9020', 'IBS9020', true, now(), true, '4139', '09770-310', 'Rua Baeta Neves', '859', 'Baeta Neves', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000079', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Laura Cardoso Machado', null, null, '2010-10-24'::date, 'IBS9020', 'IBS9020', true, now(), false, null, '09770-310', 'Rua Baeta Neves', '859', 'Baeta Neves', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000080', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Isis Cardoso Machado', null, null, '2013-01-27'::date, 'IBS9020', 'IBS9020', true, now(), false, null, '09770-310', 'Rua Baeta Neves', '859', 'Baeta Neves', 'São Bernardo do Campo', 'SP', null);

insert into public.profiles (id, tenant_id, full_name, email, phone, birth_date, family_id, codigo_membro,
          lgpd_accepted, lgpd_accepted_at, is_active, access_pin,
          cep, address_street, address_number, address_neighborhood, address_city, address_state,
          first_visit_date) values
  ('c81295e3-9167-40b4-8524-000000000081', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Daniel Cardoso Farias', 'daniel.cardoso.farias.82@ibs.conectamais.app', '(11) 98810-0041', '1981-02-26'::date, 'IBS9021', 'IBS9021', true, now(), true, '4140', '09751-020', 'Rua Brás Cubas', '225', 'Centro', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000082', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Bruna Farias Cardoso', 'bruna.farias.cardoso.83@ibs.conectamais.app', '(11) 98810-0042', '1984-07-09'::date, 'IBS9021', 'IBS9021', true, now(), true, '4141', '09751-020', 'Rua Brás Cubas', '225', 'Centro', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000083', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Heitor Cardoso Farias', null, null, '2010-04-15'::date, 'IBS9021', 'IBS9021', true, now(), false, null, '09751-020', 'Rua Brás Cubas', '225', 'Centro', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000084', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Ravi Cardoso Farias', null, null, '2014-01-23'::date, 'IBS9021', 'IBS9021', true, now(), false, null, '09751-020', 'Rua Brás Cubas', '225', 'Centro', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000085', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'José Almeida Leal', 'jose.almeida.leal.86@ibs.conectamais.app', '(11) 98810-0043', '1987-02-21'::date, 'IBS9022', 'IBS9022', true, now(), true, '4142', '09715-140', 'Rua Jurubatuba', '638', 'Centro', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000086', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Patrícia Leal Almeida', 'patricia.leal.almeida.87@ibs.conectamais.app', '(11) 98810-0044', '1990-04-27'::date, 'IBS9022', 'IBS9022', true, now(), true, '4143', '09715-140', 'Rua Jurubatuba', '638', 'Centro', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000087', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Laura Almeida Leal', null, null, '2010-03-07'::date, 'IBS9022', 'IBS9022', true, now(), false, null, '09715-140', 'Rua Jurubatuba', '638', 'Centro', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000088', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Valentina Almeida Leal', null, null, '2014-09-07'::date, 'IBS9022', 'IBS9022', true, now(), false, null, '09715-140', 'Rua Jurubatuba', '638', 'Centro', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000089', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Caio Siqueira Santos', 'caio.siqueira.santos.90@ibs.conectamais.app', '(11) 98810-0045', '1974-06-18'::date, 'IBS9023', 'IBS9023', true, now(), true, '4144', '09811-150', 'Rua dos Otonis', '492', 'Assunção', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000090', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Eliane Santos Siqueira', 'eliane.santos.siqueira.91@ibs.conectamais.app', '(11) 98810-0046', '1974-12-20'::date, 'IBS9023', 'IBS9023', true, now(), true, '4145', '09811-150', 'Rua dos Otonis', '492', 'Assunção', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000091', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Maria Clara Siqueira Santos', null, null, '2010-05-06'::date, 'IBS9023', 'IBS9023', true, now(), false, null, '09811-150', 'Rua dos Otonis', '492', 'Assunção', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000092', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Ravi Siqueira Santos', null, null, '2012-12-04'::date, 'IBS9023', 'IBS9023', true, now(), false, null, '09811-150', 'Rua dos Otonis', '492', 'Assunção', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000093', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Leandro Araujo Moreira', 'leandro.araujo.moreira.94@ibs.conectamais.app', '(11) 98810-0047', '1989-07-05'::date, 'IBS9024', 'IBS9024', true, now(), true, '4146', '09890-210', 'Rua Assunção', '750', 'Assunção', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000094', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Tereza Moreira Araujo', 'tereza.moreira.araujo.95@ibs.conectamais.app', '(11) 98810-0048', '1995-06-23'::date, 'IBS9024', 'IBS9024', true, now(), true, '4147', '09890-210', 'Rua Assunção', '750', 'Assunção', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000095', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Heitor Araujo Moreira', null, null, '2015-04-13'::date, 'IBS9024', 'IBS9024', true, now(), false, null, '09890-210', 'Rua Assunção', '750', 'Assunção', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000096', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Benício Araujo Moreira', null, null, '2017-04-13'::date, 'IBS9024', 'IBS9024', true, now(), false, null, '09890-210', 'Rua Assunção', '750', 'Assunção', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000097', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Carlos Carvalho Duarte', 'carlos.carvalho.duarte.98@ibs.conectamais.app', '(11) 98810-0049', '1977-02-22'::date, 'IBS9025', 'IBS9025', true, now(), true, '4148', '09726-000', 'Avenida Pereira Barreto', '783', 'Jardim do Mar', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000098', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Cristina Duarte Carvalho', 'cristina.duarte.carvalho.99@ibs.conectamais.app', '(11) 98810-0050', '1981-06-26'::date, 'IBS9025', 'IBS9025', true, now(), true, '4149', '09726-000', 'Avenida Pereira Barreto', '783', 'Jardim do Mar', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000099', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Sophia Carvalho Duarte', null, null, '2010-09-19'::date, 'IBS9025', 'IBS9025', true, now(), false, null, '09726-000', 'Avenida Pereira Barreto', '783', 'Jardim do Mar', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000100', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Cecília Carvalho Duarte', null, null, '2014-01-14'::date, 'IBS9025', 'IBS9025', true, now(), false, null, '09726-000', 'Avenida Pereira Barreto', '783', 'Jardim do Mar', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000101', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Daniel Barbosa Vasconcelos', 'daniel.barbosa.vasconcelos.102@ibs.conectamais.app', '(11) 98810-0051', '1982-12-19'::date, 'IBS9026', 'IBS9026', true, now(), true, '4150', '09820-130', 'Rua Ferrazópolis', '921', 'Ferrazópolis', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000102', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Larissa Vasconcelos Barbosa', 'larissa.vasconcelos.barbosa.103@ibs.conectamais.app', '(11) 98810-0052', '1983-09-01'::date, 'IBS9026', 'IBS9026', true, now(), true, '4151', '09820-130', 'Rua Ferrazópolis', '921', 'Ferrazópolis', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000103', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Laura Barbosa Vasconcelos', null, null, '2010-08-10'::date, 'IBS9026', 'IBS9026', true, now(), false, null, '09820-130', 'Rua Ferrazópolis', '921', 'Ferrazópolis', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000104', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Valentina Barbosa Vasconcelos', null, null, '2014-07-09'::date, 'IBS9026', 'IBS9026', true, now(), false, null, '09820-130', 'Rua Ferrazópolis', '921', 'Ferrazópolis', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000105', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Enzo Moreira Barros', 'enzo.moreira.barros.106@ibs.conectamais.app', '(11) 98810-0053', '1989-11-06'::date, 'IBS9027', 'IBS9027', true, now(), true, '4152', '09890-210', 'Rua Assunção', '708', 'Assunção', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000106', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Vanessa Barros Moreira', 'vanessa.barros.moreira.107@ibs.conectamais.app', '(11) 98810-0054', '1992-10-16'::date, 'IBS9027', 'IBS9027', true, now(), true, '4153', '09890-210', 'Rua Assunção', '708', 'Assunção', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000107', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Isadora Moreira Barros', null, null, '2012-07-06'::date, 'IBS9027', 'IBS9027', true, now(), false, null, '09890-210', 'Rua Assunção', '708', 'Assunção', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000108', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Lorena Moreira Barros', null, null, '2014-07-12'::date, 'IBS9027', 'IBS9027', true, now(), false, null, '09890-210', 'Rua Assunção', '708', 'Assunção', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000109', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Antônio Gomes Carvalho', 'antonio.gomes.carvalho.110@ibs.conectamais.app', '(11) 98810-0055', '1975-01-16'::date, 'IBS9028', 'IBS9028', true, now(), true, '4154', '09811-150', 'Rua dos Otonis', '389', 'Assunção', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000110', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Gabriela Carvalho Gomes', 'gabriela.carvalho.gomes.111@ibs.conectamais.app', '(11) 98810-0056', '1977-08-21'::date, 'IBS9028', 'IBS9028', true, now(), true, '4155', '09811-150', 'Rua dos Otonis', '389', 'Assunção', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000111', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Alice Gomes Carvalho', null, null, '2010-10-02'::date, 'IBS9028', 'IBS9028', true, now(), false, null, '09811-150', 'Rua dos Otonis', '389', 'Assunção', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000112', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Noah Gomes Carvalho', null, null, '2013-09-12'::date, 'IBS9028', 'IBS9028', true, now(), false, null, '09811-150', 'Rua dos Otonis', '389', 'Assunção', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000113', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Otávio Cardoso Teixeira', 'otavio.cardoso.teixeira.114@ibs.conectamais.app', '(11) 98810-0057', '1974-08-20'::date, 'IBS9029', 'IBS9029', true, now(), true, '4156', '09890-210', 'Rua Assunção', '918', 'Assunção', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000114', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Mônica Teixeira Cardoso', 'monica.teixeira.cardoso.115@ibs.conectamais.app', '(11) 98810-0058', '1979-07-22'::date, 'IBS9029', 'IBS9029', true, now(), true, '4157', '09890-210', 'Rua Assunção', '918', 'Assunção', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000115', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Cecília Cardoso Teixeira', null, null, '2010-09-20'::date, 'IBS9029', 'IBS9029', true, now(), false, null, '09890-210', 'Rua Assunção', '918', 'Assunção', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000116', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Noah Cardoso Teixeira', null, null, '2012-10-08'::date, 'IBS9029', 'IBS9029', true, now(), false, null, '09890-210', 'Rua Assunção', '918', 'Assunção', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000117', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Gustavo Queiroz Nogueira', 'gustavo.queiroz.nogueira.118@ibs.conectamais.app', '(11) 98810-0059', '1992-05-06'::date, 'IBS9030', 'IBS9030', true, now(), true, '4158', '09750-240', 'Rua Marechal Deodoro', '230', 'Centro', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000118', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Sônia Nogueira Queiroz', 'sonia.nogueira.queiroz.119@ibs.conectamais.app', '(11) 98810-0060', '1994-05-22'::date, 'IBS9030', 'IBS9030', true, now(), true, '4159', '09750-240', 'Rua Marechal Deodoro', '230', 'Centro', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000119', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Theo Queiroz Nogueira', null, null, '2014-09-06'::date, 'IBS9030', 'IBS9030', true, now(), false, null, '09750-240', 'Rua Marechal Deodoro', '230', 'Centro', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000120', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Samuel Queiroz Nogueira', null, null, '2016-10-25'::date, 'IBS9030', 'IBS9030', true, now(), false, null, '09750-240', 'Rua Marechal Deodoro', '230', 'Centro', 'São Bernardo do Campo', 'SP', null);

insert into public.profiles (id, tenant_id, full_name, email, phone, birth_date, family_id, codigo_membro,
          lgpd_accepted, lgpd_accepted_at, is_active, access_pin,
          cep, address_street, address_number, address_neighborhood, address_city, address_state,
          first_visit_date) values
  ('c81295e3-9167-40b4-8524-000000000121', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Sérgio Macedo Nogueira', 'sergio.macedo.nogueira.122@ibs.conectamais.app', '(11) 98810-0061', '1991-10-01'::date, 'IBS9031', 'IBS9031', true, now(), true, '4160', '09770-310', 'Rua Baeta Neves', '740', 'Baeta Neves', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000122', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Renata Nogueira Macedo', 'renata.nogueira.macedo.123@ibs.conectamais.app', '(11) 98810-0062', '1994-06-24'::date, 'IBS9031', 'IBS9031', true, now(), true, '4161', '09770-310', 'Rua Baeta Neves', '740', 'Baeta Neves', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000123', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Isis Macedo Nogueira', null, null, '2014-06-11'::date, 'IBS9031', 'IBS9031', true, now(), false, null, '09770-310', 'Rua Baeta Neves', '740', 'Baeta Neves', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000124', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Caleb Macedo Nogueira', null, null, '2018-10-03'::date, 'IBS9031', 'IBS9031', true, now(), false, null, '09770-310', 'Rua Baeta Neves', '740', 'Baeta Neves', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000125', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Carlos Mendes Barros', 'carlos.mendes.barros.126@ibs.conectamais.app', '(11) 98810-0063', '1986-01-05'::date, 'IBS9032', 'IBS9032', true, now(), true, '4162', '09780-220', 'Rua Nova Petrópolis', '668', 'Nova Petrópolis', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000126', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Larissa Barros Mendes', 'larissa.barros.mendes.127@ibs.conectamais.app', '(11) 98810-0064', '1986-05-03'::date, 'IBS9032', 'IBS9032', true, now(), true, '4163', '09780-220', 'Rua Nova Petrópolis', '668', 'Nova Petrópolis', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000127', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Davi Mendes Barros', null, null, '2010-09-26'::date, 'IBS9032', 'IBS9032', true, now(), false, null, '09780-220', 'Rua Nova Petrópolis', '668', 'Nova Petrópolis', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000128', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Davi Mendes Batista', null, null, '2012-12-28'::date, 'IBS9032', 'IBS9032', true, now(), false, null, '09780-220', 'Rua Nova Petrópolis', '668', 'Nova Petrópolis', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000129', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'João Pinto Rodrigues', 'joao.pinto.rodrigues.130@ibs.conectamais.app', '(11) 98810-0065', '1986-12-24'::date, 'IBS9033', 'IBS9033', true, now(), true, '4164', '09635-000', 'Rua dos Vianas', '286', 'Rudge Ramos', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000130', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Lúcia Rodrigues Pinto', 'lucia.rodrigues.pinto.131@ibs.conectamais.app', '(11) 98810-0066', '1991-03-27'::date, 'IBS9033', 'IBS9033', true, now(), true, '4165', '09635-000', 'Rua dos Vianas', '286', 'Rudge Ramos', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000131', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Isadora Pinto Rodrigues', null, null, '2011-05-28'::date, 'IBS9033', 'IBS9033', true, now(), false, null, '09635-000', 'Rua dos Vianas', '286', 'Rudge Ramos', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000132', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Maya Pinto Rodrigues', null, null, '2013-11-12'::date, 'IBS9033', 'IBS9033', true, now(), false, null, '09635-000', 'Rua dos Vianas', '286', 'Rudge Ramos', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000133', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Eduardo Oliveira Alves', 'eduardo.oliveira.alves.134@ibs.conectamais.app', '(11) 98810-0067', '1991-01-24'::date, 'IBS9034', 'IBS9034', true, now(), true, '4166', '09715-140', 'Rua Jurubatuba', '408', 'Centro', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000134', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Heloísa Alves Oliveira', 'heloisa.alves.oliveira.135@ibs.conectamais.app', '(11) 98810-0068', '1992-04-07'::date, 'IBS9034', 'IBS9034', true, now(), true, '4167', '09715-140', 'Rua Jurubatuba', '408', 'Centro', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000135', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Manuela Oliveira Alves', null, null, '2012-11-18'::date, 'IBS9034', 'IBS9034', true, now(), false, null, '09715-140', 'Rua Jurubatuba', '408', 'Centro', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000136', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Davi Oliveira Alves', null, null, '2016-01-23'::date, 'IBS9034', 'IBS9034', true, now(), false, null, '09715-140', 'Rua Jurubatuba', '408', 'Centro', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000137', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Cristiano Alves Almeida', 'cristiano.alves.almeida.138@ibs.conectamais.app', '(11) 98810-0069', '1992-05-07'::date, 'IBS9035', 'IBS9035', true, now(), true, '4168', '09770-310', 'Rua Baeta Neves', '600', 'Baeta Neves', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000138', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Juliana Almeida Alves', 'juliana.almeida.alves.139@ibs.conectamais.app', '(11) 98810-0070', '1996-12-11'::date, 'IBS9035', 'IBS9035', true, now(), true, '4169', '09770-310', 'Rua Baeta Neves', '600', 'Baeta Neves', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000139', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Maria Clara Alves Almeida', null, null, '2016-04-18'::date, 'IBS9035', 'IBS9035', true, now(), false, null, '09770-310', 'Rua Baeta Neves', '600', 'Baeta Neves', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000140', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Nicolas Alves Almeida', null, null, '2020-03-13'::date, 'IBS9035', 'IBS9035', true, now(), false, null, '09770-310', 'Rua Baeta Neves', '600', 'Baeta Neves', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000141', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'João Moura Queiroz', 'joao.moura.queiroz.142@ibs.conectamais.app', '(11) 98810-0071', '1982-12-19'::date, 'IBS9036', 'IBS9036', true, now(), true, '4170', '09726-000', 'Avenida Pereira Barreto', '234', 'Jardim do Mar', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000142', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Tatiane Queiroz Moura', 'tatiane.queiroz.moura.143@ibs.conectamais.app', '(11) 98810-0072', '1985-05-04'::date, 'IBS9036', 'IBS9036', true, now(), true, '4171', '09726-000', 'Avenida Pereira Barreto', '234', 'Jardim do Mar', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000143', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Laura Moura Queiroz', null, null, '2010-06-02'::date, 'IBS9036', 'IBS9036', true, now(), false, null, '09726-000', 'Avenida Pereira Barreto', '234', 'Jardim do Mar', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000144', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Maria Clara Moura Queiroz', null, null, '2012-03-16'::date, 'IBS9036', 'IBS9036', true, now(), false, null, '09726-000', 'Avenida Pereira Barreto', '234', 'Jardim do Mar', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000145', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'João Cavalcanti Moura', 'joao.cavalcanti.moura.146@ibs.conectamais.app', '(11) 98810-0073', '1990-02-20'::date, 'IBS9037', 'IBS9037', true, now(), true, '4172', '09751-020', 'Rua Brás Cubas', '644', 'Centro', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000146', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Olivia Moura Cavalcanti', 'olivia.moura.cavalcanti.147@ibs.conectamais.app', '(11) 98810-0074', '1993-10-11'::date, 'IBS9037', 'IBS9037', true, now(), true, '4173', '09751-020', 'Rua Brás Cubas', '644', 'Centro', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000147', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Arthur Cavalcanti Moura', null, null, '2013-02-04'::date, 'IBS9037', 'IBS9037', true, now(), false, null, '09751-020', 'Rua Brás Cubas', '644', 'Centro', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000148', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Bernardo Cavalcanti Moura', null, null, '2016-06-27'::date, 'IBS9037', 'IBS9037', true, now(), false, null, '09751-020', 'Rua Brás Cubas', '644', 'Centro', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000149', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Fábio Ribeiro Castro', 'fabio.ribeiro.castro.150@ibs.conectamais.app', '(11) 98810-0075', '1979-05-04'::date, 'IBS9038', 'IBS9038', true, now(), true, '4174', '09780-220', 'Rua Nova Petrópolis', '838', 'Nova Petrópolis', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000150', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Fabiana Castro Ribeiro', 'fabiana.castro.ribeiro.151@ibs.conectamais.app', '(11) 98810-0076', '1985-10-24'::date, 'IBS9038', 'IBS9038', true, now(), true, '4175', '09780-220', 'Rua Nova Petrópolis', '838', 'Nova Petrópolis', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000151', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Maria Clara Ribeiro Castro', null, null, '2010-05-10'::date, 'IBS9038', 'IBS9038', true, now(), false, null, '09780-220', 'Rua Nova Petrópolis', '838', 'Nova Petrópolis', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000152', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'João Pedro Ribeiro Castro', null, null, '2014-09-21'::date, 'IBS9038', 'IBS9038', true, now(), false, null, '09780-220', 'Rua Nova Petrópolis', '838', 'Nova Petrópolis', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000153', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Rafael Monteiro Ferreira', 'rafael.monteiro.ferreira.154@ibs.conectamais.app', '(11) 98810-0077', '1975-02-15'::date, 'IBS9039', 'IBS9039', true, now(), true, '4176', '09820-130', 'Rua Ferrazópolis', '470', 'Ferrazópolis', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000154', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Júlia Ferreira Monteiro', 'julia.ferreira.monteiro.155@ibs.conectamais.app', '(11) 98810-0078', '1979-04-06'::date, 'IBS9039', 'IBS9039', true, now(), true, '4177', '09820-130', 'Rua Ferrazópolis', '470', 'Ferrazópolis', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000155', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Arthur Monteiro Ferreira', null, null, '2010-10-20'::date, 'IBS9039', 'IBS9039', true, now(), false, null, '09820-130', 'Rua Ferrazópolis', '470', 'Ferrazópolis', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000156', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Luna Monteiro Ferreira', null, null, '2012-11-07'::date, 'IBS9039', 'IBS9039', true, now(), false, null, '09820-130', 'Rua Ferrazópolis', '470', 'Ferrazópolis', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000157', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Fernando Vasconcelos Mendes', 'fernando.vasconcelos.mendes.158@ibs.conectamais.app', '(11) 98810-0079', '1985-07-01'::date, 'IBS9040', 'IBS9040', true, now(), true, '4178', '09750-240', 'Rua Marechal Deodoro', '43', 'Centro', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000158', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Larissa Mendes Vasconcelos', 'larissa.mendes.vasconcelos.159@ibs.conectamais.app', '(11) 98810-0080', '1986-01-08'::date, 'IBS9040', 'IBS9040', true, now(), true, '4179', '09750-240', 'Rua Marechal Deodoro', '43', 'Centro', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000159', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Ravi Vasconcelos Mendes', null, null, '2010-06-13'::date, 'IBS9040', 'IBS9040', true, now(), false, null, '09750-240', 'Rua Marechal Deodoro', '43', 'Centro', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000160', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Maya Vasconcelos Mendes', null, null, '2014-07-06'::date, 'IBS9040', 'IBS9040', true, now(), false, null, '09750-240', 'Rua Marechal Deodoro', '43', 'Centro', 'São Bernardo do Campo', 'SP', null);

insert into public.profiles (id, tenant_id, full_name, email, phone, birth_date, family_id, codigo_membro,
          lgpd_accepted, lgpd_accepted_at, is_active, access_pin,
          cep, address_street, address_number, address_neighborhood, address_city, address_state,
          first_visit_date) values
  ('c81295e3-9167-40b4-8524-000000000161', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'César Ferreira Cunha', 'cesar.ferreira.cunha.162@ibs.conectamais.app', '(11) 98810-0081', '1979-07-08'::date, 'IBS9041', 'IBS9041', true, now(), true, '4180', '09751-020', 'Rua Brás Cubas', '67', 'Centro', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000162', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Tereza Cunha Ferreira', 'tereza.cunha.ferreira.163@ibs.conectamais.app', '(11) 98810-0082', '1979-12-27'::date, 'IBS9041', 'IBS9041', true, now(), true, '4181', '09751-020', 'Rua Brás Cubas', '67', 'Centro', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000163', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Sophia Ferreira Cunha', null, null, '2010-07-26'::date, 'IBS9041', 'IBS9041', true, now(), false, null, '09751-020', 'Rua Brás Cubas', '67', 'Centro', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000164', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Bernardo Ferreira Cunha', null, null, '2012-11-18'::date, 'IBS9041', 'IBS9041', true, now(), false, null, '09751-020', 'Rua Brás Cubas', '67', 'Centro', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000165', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Rafael Batista Moura', 'rafael.batista.moura.166@ibs.conectamais.app', '(11) 98810-0083', '1975-08-06'::date, 'IBS9042', 'IBS9042', true, now(), true, '4182', '09751-020', 'Rua Brás Cubas', '935', 'Centro', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000166', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Letícia Moura Batista', 'leticia.moura.batista.167@ibs.conectamais.app', '(11) 98810-0084', '1975-11-20'::date, 'IBS9042', 'IBS9042', true, now(), true, '4183', '09751-020', 'Rua Brás Cubas', '935', 'Centro', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000167', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Benício Batista Moura', null, null, '2010-10-11'::date, 'IBS9042', 'IBS9042', true, now(), false, null, '09751-020', 'Rua Brás Cubas', '935', 'Centro', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000168', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Benício Batista Ribeiro', null, null, '2014-09-12'::date, 'IBS9042', 'IBS9042', true, now(), false, null, '09751-020', 'Rua Brás Cubas', '935', 'Centro', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000169', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Daniel Dias Nogueira', 'daniel.dias.nogueira.170@ibs.conectamais.app', '(11) 98810-0085', '1992-09-06'::date, 'IBS9043', 'IBS9043', true, now(), true, '4184', '09780-220', 'Rua Nova Petrópolis', '453', 'Nova Petrópolis', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000170', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Aline Nogueira Dias', 'aline.nogueira.dias.171@ibs.conectamais.app', '(11) 98810-0086', '1997-08-25'::date, 'IBS9043', 'IBS9043', true, now(), true, '4185', '09780-220', 'Rua Nova Petrópolis', '453', 'Nova Petrópolis', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000171', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Maya Dias Nogueira', null, null, '2017-08-05'::date, 'IBS9043', 'IBS9043', true, now(), false, null, '09780-220', 'Rua Nova Petrópolis', '453', 'Nova Petrópolis', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000172', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Arthur Dias Nogueira', null, null, '2021-07-13'::date, 'IBS9043', 'IBS9043', true, now(), false, null, '09780-220', 'Rua Nova Petrópolis', '453', 'Nova Petrópolis', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000173', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Rafael Mendes Nunes', 'rafael.mendes.nunes.174@ibs.conectamais.app', '(11) 98810-0087', '1986-11-09'::date, 'IBS9044', 'IBS9044', true, now(), true, '4186', '09750-500', 'Rua Silva Jardim', '199', 'Centro', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000174', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Daniela Nunes Mendes', 'daniela.nunes.mendes.175@ibs.conectamais.app', '(11) 98810-0088', '1992-07-09'::date, 'IBS9044', 'IBS9044', true, now(), true, '4187', '09750-500', 'Rua Silva Jardim', '199', 'Centro', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000175', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Lorenzo Mendes Nunes', null, null, '2012-09-26'::date, 'IBS9044', 'IBS9044', true, now(), false, null, '09750-500', 'Rua Silva Jardim', '199', 'Centro', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000176', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Nicolas Mendes Nunes', null, null, '2016-01-11'::date, 'IBS9044', 'IBS9044', true, now(), false, null, '09750-500', 'Rua Silva Jardim', '199', 'Centro', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000177', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Murilo Correia Carvalho', 'murilo.correia.carvalho.178@ibs.conectamais.app', '(11) 98810-0089', '1980-09-05'::date, 'IBS9045', 'IBS9045', true, now(), true, '4188', '09606-000', 'Rua Tamandaré', '707', 'Rudge Ramos', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000178', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Carolina Carvalho Correia', 'carolina.carvalho.correia.179@ibs.conectamais.app', '(11) 98810-0090', '1984-01-12'::date, 'IBS9045', 'IBS9045', true, now(), true, '4189', '09606-000', 'Rua Tamandaré', '707', 'Rudge Ramos', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000179', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Sophia Correia Carvalho', null, null, '2010-08-07'::date, 'IBS9045', 'IBS9045', true, now(), false, null, '09606-000', 'Rua Tamandaré', '707', 'Rudge Ramos', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000180', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Manuela Correia Carvalho', null, null, '2012-05-04'::date, 'IBS9045', 'IBS9045', true, now(), false, null, '09606-000', 'Rua Tamandaré', '707', 'Rudge Ramos', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000181', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Ricardo Pacheco Almeida', 'ricardo.pacheco.almeida.182@ibs.conectamais.app', '(11) 98810-0091', '1987-02-04'::date, 'IBS9046', 'IBS9046', true, now(), true, '4190', '09780-220', 'Rua Nova Petrópolis', '507', 'Nova Petrópolis', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000182', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Maria Almeida Pacheco', 'maria.almeida.pacheco.183@ibs.conectamais.app', '(11) 98810-0092', '1989-10-19'::date, 'IBS9046', 'IBS9046', true, now(), true, '4191', '09780-220', 'Rua Nova Petrópolis', '507', 'Nova Petrópolis', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000183', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Caleb Pacheco Almeida', null, null, '2010-02-25'::date, 'IBS9046', 'IBS9046', true, now(), false, null, '09780-220', 'Rua Nova Petrópolis', '507', 'Nova Petrópolis', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000184', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Miguel Pacheco Almeida', null, null, '2012-01-07'::date, 'IBS9046', 'IBS9046', true, now(), false, null, '09780-220', 'Rua Nova Petrópolis', '507', 'Nova Petrópolis', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000185', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Igor Castro Guimarães', 'igor.castro.guimaraes.186@ibs.conectamais.app', '(11) 98810-0093', '1987-02-15'::date, 'IBS9047', 'IBS9047', true, now(), true, '4192', '09606-000', 'Rua Tamandaré', '516', 'Rudge Ramos', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000186', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Patrícia Guimarães Castro', 'patricia.guimaraes.castro.187@ibs.conectamais.app', '(11) 98810-0094', '1993-10-22'::date, 'IBS9047', 'IBS9047', true, now(), true, '4193', '09606-000', 'Rua Tamandaré', '516', 'Rudge Ramos', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000187', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Theo Castro Guimarães', null, null, '2013-11-17'::date, 'IBS9047', 'IBS9047', true, now(), false, null, '09606-000', 'Rua Tamandaré', '516', 'Rudge Ramos', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000188', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Samuel Castro Guimarães', null, null, '2015-01-05'::date, 'IBS9047', 'IBS9047', true, now(), false, null, '09606-000', 'Rua Tamandaré', '516', 'Rudge Ramos', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000189', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Ricardo Rodrigues Nunes', 'ricardo.rodrigues.nunes.190@ibs.conectamais.app', '(11) 98810-0095', '1990-07-22'::date, 'IBS9048', 'IBS9048', true, now(), true, '4194', '09606-000', 'Rua Tamandaré', '345', 'Rudge Ramos', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000190', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Ana Nunes Rodrigues', 'ana.nunes.rodrigues.191@ibs.conectamais.app', '(11) 98810-0096', '1995-02-22'::date, 'IBS9048', 'IBS9048', true, now(), true, '4195', '09606-000', 'Rua Tamandaré', '345', 'Rudge Ramos', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000191', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Miguel Rodrigues Nunes', null, null, '2015-11-03'::date, 'IBS9048', 'IBS9048', true, now(), false, null, '09606-000', 'Rua Tamandaré', '345', 'Rudge Ramos', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000192', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Caleb Rodrigues Nunes', null, null, '2017-03-10'::date, 'IBS9048', 'IBS9048', true, now(), false, null, '09606-000', 'Rua Tamandaré', '345', 'Rudge Ramos', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000193', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Igor Barros Araujo', 'igor.barros.araujo.194@ibs.conectamais.app', '(11) 98810-0097', '1977-10-07'::date, 'IBS9049', 'IBS9049', true, now(), true, '4196', '09750-500', 'Rua Silva Jardim', '276', 'Centro', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000194', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Larissa Araujo Barros', 'larissa.araujo.barros.195@ibs.conectamais.app', '(11) 98810-0098', '1983-01-21'::date, 'IBS9049', 'IBS9049', true, now(), true, '4197', '09750-500', 'Rua Silva Jardim', '276', 'Centro', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000195', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Isis Barros Araujo', null, null, '2010-01-11'::date, 'IBS9049', 'IBS9049', true, now(), false, null, '09750-500', 'Rua Silva Jardim', '276', 'Centro', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000196', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Heitor Barros Araujo', null, null, '2013-01-01'::date, 'IBS9049', 'IBS9049', true, now(), false, null, '09750-500', 'Rua Silva Jardim', '276', 'Centro', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000197', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'César Campos Pacheco', 'cesar.campos.pacheco.198@ibs.conectamais.app', '(11) 98810-0099', '1986-12-21'::date, 'IBS9050', 'IBS9050', true, now(), true, '4198', '09606-000', 'Rua Tamandaré', '299', 'Rudge Ramos', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000198', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Karina Pacheco Campos', 'karina.pacheco.campos.199@ibs.conectamais.app', '(11) 98810-0100', '1989-09-15'::date, 'IBS9050', 'IBS9050', true, now(), true, '4199', '09606-000', 'Rua Tamandaré', '299', 'Rudge Ramos', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000199', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Isadora Campos Pacheco', null, null, '2010-09-08'::date, 'IBS9050', 'IBS9050', true, now(), false, null, '09606-000', 'Rua Tamandaré', '299', 'Rudge Ramos', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000200', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Maria Clara Campos Pacheco', null, null, '2013-01-25'::date, 'IBS9050', 'IBS9050', true, now(), false, null, '09606-000', 'Rua Tamandaré', '299', 'Rudge Ramos', 'São Bernardo do Campo', 'SP', null);

insert into public.profiles (id, tenant_id, full_name, email, phone, birth_date, family_id, codigo_membro,
          lgpd_accepted, lgpd_accepted_at, is_active, access_pin,
          cep, address_street, address_number, address_neighborhood, address_city, address_state,
          first_visit_date) values
  ('c81295e3-9167-40b4-8524-000000000201', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Fernando Aguiar Vasconcelos', 'fernando.aguiar.vasconcelos.202@ibs.conectamais.app', '(11) 98810-0101', '1980-08-18'::date, 'IBS9051', 'IBS9051', true, now(), true, '4200', '09635-000', 'Rua dos Vianas', '186', 'Rudge Ramos', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000202', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Cristina Vasconcelos Aguiar', 'cristina.vasconcelos.aguiar.203@ibs.conectamais.app', '(11) 98810-0102', '1985-10-04'::date, 'IBS9051', 'IBS9051', true, now(), true, '4201', '09635-000', 'Rua dos Vianas', '186', 'Rudge Ramos', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000203', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Manuela Aguiar Vasconcelos', null, null, '2010-07-14'::date, 'IBS9051', 'IBS9051', true, now(), false, null, '09635-000', 'Rua dos Vianas', '186', 'Rudge Ramos', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000204', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Gael Aguiar Vasconcelos', null, null, '2013-06-19'::date, 'IBS9051', 'IBS9051', true, now(), false, null, '09635-000', 'Rua dos Vianas', '186', 'Rudge Ramos', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000205', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Antônio Nunes Peixoto', 'antonio.nunes.peixoto.206@ibs.conectamais.app', '(11) 98810-0103', '1987-09-18'::date, 'IBS9052', 'IBS9052', true, now(), true, '4202', '09750-240', 'Rua Marechal Deodoro', '685', 'Centro', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000206', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Juliana Peixoto Nunes', 'juliana.peixoto.nunes.207@ibs.conectamais.app', '(11) 98810-0104', '1993-03-03'::date, 'IBS9052', 'IBS9052', true, now(), true, '4203', '09750-240', 'Rua Marechal Deodoro', '685', 'Centro', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000207', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Caleb Nunes Peixoto', null, null, '2013-03-24'::date, 'IBS9052', 'IBS9052', true, now(), false, null, '09750-240', 'Rua Marechal Deodoro', '685', 'Centro', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000208', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Theo Nunes Peixoto', null, null, '2017-05-17'::date, 'IBS9052', 'IBS9052', true, now(), false, null, '09750-240', 'Rua Marechal Deodoro', '685', 'Centro', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000209', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'André Duarte Vasconcelos', 'andre.duarte.vasconcelos.210@ibs.conectamais.app', '(11) 98810-0105', '1987-02-05'::date, 'IBS9053', 'IBS9053', true, now(), true, '4204', '09635-000', 'Rua dos Vianas', '731', 'Rudge Ramos', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000210', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Fabiana Vasconcelos Duarte', 'fabiana.vasconcelos.duarte.211@ibs.conectamais.app', '(11) 98810-0106', '1989-12-23'::date, 'IBS9053', 'IBS9053', true, now(), true, '4205', '09635-000', 'Rua dos Vianas', '731', 'Rudge Ramos', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000211', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Caleb Duarte Vasconcelos', null, null, '2010-02-04'::date, 'IBS9053', 'IBS9053', true, now(), false, null, '09635-000', 'Rua dos Vianas', '731', 'Rudge Ramos', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000212', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Liz Duarte Vasconcelos', null, null, '2014-09-24'::date, 'IBS9053', 'IBS9053', true, now(), false, null, '09635-000', 'Rua dos Vianas', '731', 'Rudge Ramos', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000213', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Cristiano Pacheco Almeida', 'cristiano.pacheco.almeida.214@ibs.conectamais.app', '(11) 98810-0107', '1988-09-09'::date, 'IBS9054', 'IBS9054', true, now(), true, '4206', '09635-000', 'Rua dos Vianas', '712', 'Rudge Ramos', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000214', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Cristina Almeida Pacheco', 'cristina.almeida.pacheco.215@ibs.conectamais.app', '(11) 98810-0108', '1989-11-21'::date, 'IBS9054', 'IBS9054', true, now(), true, '4207', '09635-000', 'Rua dos Vianas', '712', 'Rudge Ramos', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000215', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Isaac Pacheco Almeida', null, null, '2010-06-04'::date, 'IBS9054', 'IBS9054', true, now(), false, null, '09635-000', 'Rua dos Vianas', '712', 'Rudge Ramos', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000216', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'João Pedro Pacheco Almeida', null, null, '2013-09-03'::date, 'IBS9054', 'IBS9054', true, now(), false, null, '09635-000', 'Rua dos Vianas', '712', 'Rudge Ramos', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000217', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Renato Guimarães Aguiar', 'renato.guimaraes.aguiar.218@ibs.conectamais.app', '(11) 98810-0109', '1985-01-06'::date, 'IBS9055', 'IBS9055', true, now(), true, '4208', '09820-130', 'Rua Ferrazópolis', '132', 'Ferrazópolis', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000218', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Bruna Aguiar Guimarães', 'bruna.aguiar.guimaraes.219@ibs.conectamais.app', '(11) 98810-0110', '1991-01-28'::date, 'IBS9055', 'IBS9055', true, now(), true, '4209', '09820-130', 'Rua Ferrazópolis', '132', 'Ferrazópolis', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000219', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Laura Guimarães Aguiar', null, null, '2011-03-20'::date, 'IBS9055', 'IBS9055', true, now(), false, null, '09820-130', 'Rua Ferrazópolis', '132', 'Ferrazópolis', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000220', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Theo Guimarães Aguiar', null, null, '2014-11-28'::date, 'IBS9055', 'IBS9055', true, now(), false, null, '09820-130', 'Rua Ferrazópolis', '132', 'Ferrazópolis', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000221', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Cláudio Fernandes Almeida', 'claudio.fernandes.almeida.222@ibs.conectamais.app', '(11) 98810-0111', '1978-06-22'::date, 'IBS9056', 'IBS9056', true, now(), true, '4210', '09820-130', 'Rua Ferrazópolis', '839', 'Ferrazópolis', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000222', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Daniela Almeida Fernandes', 'daniela.almeida.fernandes.223@ibs.conectamais.app', '(11) 98810-0112', '1978-01-06'::date, 'IBS9056', 'IBS9056', true, now(), true, '4211', '09820-130', 'Rua Ferrazópolis', '839', 'Ferrazópolis', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000223', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Luna Fernandes Almeida', null, null, '2010-01-19'::date, 'IBS9056', 'IBS9056', true, now(), false, null, '09820-130', 'Rua Ferrazópolis', '839', 'Ferrazópolis', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000224', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Lorenzo Fernandes Almeida', null, null, '2014-10-26'::date, 'IBS9056', 'IBS9056', true, now(), false, null, '09820-130', 'Rua Ferrazópolis', '839', 'Ferrazópolis', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000225', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Fernando Machado Cardoso', 'fernando.machado.cardoso.226@ibs.conectamais.app', '(11) 98810-0113', '1985-10-05'::date, 'IBS9057', 'IBS9057', true, now(), true, '4212', '09770-310', 'Rua Baeta Neves', '558', 'Baeta Neves', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000226', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Bianca Cardoso Machado', 'bianca.cardoso.machado.227@ibs.conectamais.app', '(11) 98810-0114', '1987-06-27'::date, 'IBS9057', 'IBS9057', true, now(), true, '4213', '09770-310', 'Rua Baeta Neves', '558', 'Baeta Neves', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000227', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Alice Machado Cardoso', null, null, '2010-05-23'::date, 'IBS9057', 'IBS9057', true, now(), false, null, '09770-310', 'Rua Baeta Neves', '558', 'Baeta Neves', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000228', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Theo Machado Cardoso', null, null, '2013-01-16'::date, 'IBS9057', 'IBS9057', true, now(), false, null, '09770-310', 'Rua Baeta Neves', '558', 'Baeta Neves', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000229', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Eduardo Almeida Sampaio', 'eduardo.almeida.sampaio.230@ibs.conectamais.app', '(11) 98810-0115', '1984-07-24'::date, 'IBS9058', 'IBS9058', true, now(), true, '4214', '09750-500', 'Rua Silva Jardim', '960', 'Centro', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000230', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Olivia Sampaio Almeida', 'olivia.sampaio.almeida.231@ibs.conectamais.app', '(11) 98810-0116', '1990-04-16'::date, 'IBS9058', 'IBS9058', true, now(), true, '4215', '09750-500', 'Rua Silva Jardim', '960', 'Centro', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000231', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Miguel Almeida Sampaio', null, null, '2010-02-05'::date, 'IBS9058', 'IBS9058', true, now(), false, null, '09750-500', 'Rua Silva Jardim', '960', 'Centro', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000232', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Cecília Almeida Sampaio', null, null, '2012-02-26'::date, 'IBS9058', 'IBS9058', true, now(), false, null, '09750-500', 'Rua Silva Jardim', '960', 'Centro', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000233', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Júlio Oliveira Vasconcelos', 'julio.oliveira.vasconcelos.234@ibs.conectamais.app', '(11) 98810-0117', '1989-11-27'::date, 'IBS9059', 'IBS9059', true, now(), true, '4216', '09726-000', 'Avenida Pereira Barreto', '407', 'Jardim do Mar', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000234', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Paula Vasconcelos Oliveira', 'paula.vasconcelos.oliveira.235@ibs.conectamais.app', '(11) 98810-0118', '1995-03-09'::date, 'IBS9059', 'IBS9059', true, now(), true, '4217', '09726-000', 'Avenida Pereira Barreto', '407', 'Jardim do Mar', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000235', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Laura Oliveira Vasconcelos', null, null, '2015-09-15'::date, 'IBS9059', 'IBS9059', true, now(), false, null, '09726-000', 'Avenida Pereira Barreto', '407', 'Jardim do Mar', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000236', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Maya Oliveira Vasconcelos', null, null, '2018-11-14'::date, 'IBS9059', 'IBS9059', true, now(), false, null, '09726-000', 'Avenida Pereira Barreto', '407', 'Jardim do Mar', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000237', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Fábio Duarte Carvalho', 'fabio.duarte.carvalho.238@ibs.conectamais.app', '(11) 98810-0119', '1978-01-28'::date, 'IBS9060', 'IBS9060', true, now(), true, '4218', '09751-020', 'Rua Brás Cubas', '775', 'Centro', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000238', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Renata Carvalho Duarte', 'renata.carvalho.duarte.239@ibs.conectamais.app', '(11) 98810-0120', '1980-01-16'::date, 'IBS9060', 'IBS9060', true, now(), true, '4219', '09751-020', 'Rua Brás Cubas', '775', 'Centro', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000239', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Eloá Duarte Carvalho', null, null, '2010-09-20'::date, 'IBS9060', 'IBS9060', true, now(), false, null, '09751-020', 'Rua Brás Cubas', '775', 'Centro', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000240', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Liz Duarte Carvalho', null, null, '2014-05-12'::date, 'IBS9060', 'IBS9060', true, now(), false, null, '09751-020', 'Rua Brás Cubas', '775', 'Centro', 'São Bernardo do Campo', 'SP', null);

insert into public.profiles (id, tenant_id, full_name, email, phone, birth_date, family_id, codigo_membro,
          lgpd_accepted, lgpd_accepted_at, is_active, access_pin,
          cep, address_street, address_number, address_neighborhood, address_city, address_state,
          first_visit_date) values
  ('c81295e3-9167-40b4-8524-000000000241', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Marcelo Macedo Lima', 'marcelo.macedo.lima.242@ibs.conectamais.app', '(11) 98810-0121', '1984-10-25'::date, 'IBS9061', 'IBS9061', true, now(), true, '4220', '09635-000', 'Rua dos Vianas', '395', 'Rudge Ramos', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000242', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Sônia Lima Macedo', 'sonia.lima.macedo.243@ibs.conectamais.app', '(11) 98810-0122', '1985-06-05'::date, 'IBS9061', 'IBS9061', true, now(), true, '4221', '09635-000', 'Rua dos Vianas', '395', 'Rudge Ramos', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000243', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Bernardo Macedo Lima', null, null, '2010-01-24'::date, 'IBS9061', 'IBS9061', true, now(), false, null, '09635-000', 'Rua dos Vianas', '395', 'Rudge Ramos', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000244', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Alice Macedo Lima', null, null, '2013-09-20'::date, 'IBS9061', 'IBS9061', true, now(), false, null, '09635-000', 'Rua dos Vianas', '395', 'Rudge Ramos', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000245', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Leandro Moura Queiroz', 'leandro.moura.queiroz.246@ibs.conectamais.app', '(11) 98810-0123', '1983-01-28'::date, 'IBS9062', 'IBS9062', true, now(), true, '4222', '09635-000', 'Rua dos Vianas', '306', 'Rudge Ramos', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000246', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Patrícia Queiroz Moura', 'patricia.queiroz.moura.247@ibs.conectamais.app', '(11) 98810-0124', '1987-02-15'::date, 'IBS9062', 'IBS9062', true, now(), true, '4223', '09635-000', 'Rua dos Vianas', '306', 'Rudge Ramos', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000247', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Samuel Moura Queiroz', null, null, '2010-03-19'::date, 'IBS9062', 'IBS9062', true, now(), false, null, '09635-000', 'Rua dos Vianas', '306', 'Rudge Ramos', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000248', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Laura Moura Santos', null, null, '2013-05-02'::date, 'IBS9062', 'IBS9062', true, now(), false, null, '09635-000', 'Rua dos Vianas', '306', 'Rudge Ramos', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000249', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Rogério Gomes Farias', 'rogerio.gomes.farias.250@ibs.conectamais.app', '(11) 98810-0125', '1984-03-28'::date, 'IBS9063', 'IBS9063', true, now(), true, '4224', '09600-010', 'Avenida Kennedy', '172', 'Rudge Ramos', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000250', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Aline Farias Gomes', 'aline.farias.gomes.251@ibs.conectamais.app', '(11) 98810-0126', '1989-02-28'::date, 'IBS9063', 'IBS9063', true, now(), true, '4225', '09600-010', 'Avenida Kennedy', '172', 'Rudge Ramos', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000251', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Arthur Gomes Farias', null, null, '2010-09-12'::date, 'IBS9063', 'IBS9063', true, now(), false, null, '09600-010', 'Avenida Kennedy', '172', 'Rudge Ramos', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000252', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Bernardo Gomes Farias', null, null, '2014-10-10'::date, 'IBS9063', 'IBS9063', true, now(), false, null, '09600-010', 'Avenida Kennedy', '172', 'Rudge Ramos', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000253', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Murilo Moreira Rezende', 'murilo.moreira.rezende.254@ibs.conectamais.app', '(11) 98810-0127', '1981-04-25'::date, 'IBS9064', 'IBS9064', true, now(), true, '4226', '09890-210', 'Rua Assunção', '820', 'Assunção', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000254', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Simone Rezende Moreira', 'simone.rezende.moreira.255@ibs.conectamais.app', '(11) 98810-0128', '1981-08-18'::date, 'IBS9064', 'IBS9064', true, now(), true, '4227', '09890-210', 'Rua Assunção', '820', 'Assunção', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000255', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Eloá Moreira Rezende', null, null, '2010-11-21'::date, 'IBS9064', 'IBS9064', true, now(), false, null, '09890-210', 'Rua Assunção', '820', 'Assunção', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000256', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Valentina Moreira Rezende', null, null, '2012-06-07'::date, 'IBS9064', 'IBS9064', true, now(), false, null, '09890-210', 'Rua Assunção', '820', 'Assunção', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000257', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Otávio Monteiro Pereira', 'otavio.monteiro.pereira.258@ibs.conectamais.app', '(11) 98810-0129', '1974-01-22'::date, 'IBS9065', 'IBS9065', true, now(), true, '4228', '09606-000', 'Rua Tamandaré', '510', 'Rudge Ramos', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000258', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Amanda Pereira Monteiro', 'amanda.pereira.monteiro.259@ibs.conectamais.app', '(11) 98810-0130', '1979-09-08'::date, 'IBS9065', 'IBS9065', true, now(), true, '4229', '09606-000', 'Rua Tamandaré', '510', 'Rudge Ramos', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000259', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Maria Clara Monteiro Pereira', null, null, '2010-06-02'::date, 'IBS9065', 'IBS9065', true, now(), false, null, '09606-000', 'Rua Tamandaré', '510', 'Rudge Ramos', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000260', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Gael Monteiro Pereira', null, null, '2012-08-03'::date, 'IBS9065', 'IBS9065', true, now(), false, null, '09606-000', 'Rua Tamandaré', '510', 'Rudge Ramos', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000261', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Marcelo Barbosa Farias', 'marcelo.barbosa.farias.262@ibs.conectamais.app', '(11) 98810-0131', '1976-12-13'::date, 'IBS9066', 'IBS9066', true, now(), true, '4230', '09780-220', 'Rua Nova Petrópolis', '408', 'Nova Petrópolis', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000262', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Larissa Farias Barbosa', 'larissa.farias.barbosa.263@ibs.conectamais.app', '(11) 98810-0132', '1981-09-27'::date, 'IBS9066', 'IBS9066', true, now(), true, '4231', '09780-220', 'Rua Nova Petrópolis', '408', 'Nova Petrópolis', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000263', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'João Pedro Barbosa Farias', null, null, '2010-11-27'::date, 'IBS9066', 'IBS9066', true, now(), false, null, '09780-220', 'Rua Nova Petrópolis', '408', 'Nova Petrópolis', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000264', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Lorenzo Barbosa Farias', null, null, '2014-10-28'::date, 'IBS9066', 'IBS9066', true, now(), false, null, '09780-220', 'Rua Nova Petrópolis', '408', 'Nova Petrópolis', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000265', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'José Teixeira Alves', 'jose.teixeira.alves.266@ibs.conectamais.app', '(11) 98810-0133', '1984-01-12'::date, 'IBS9067', 'IBS9067', true, now(), true, '4232', '09725-150', 'Avenida Senador Vergueiro', '243', 'Jardim do Mar', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000266', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Ingrid Alves Teixeira', 'ingrid.alves.teixeira.267@ibs.conectamais.app', '(11) 98810-0134', '1985-12-05'::date, 'IBS9067', 'IBS9067', true, now(), true, '4233', '09725-150', 'Avenida Senador Vergueiro', '243', 'Jardim do Mar', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000267', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Theo Teixeira Alves', null, null, '2010-12-25'::date, 'IBS9067', 'IBS9067', true, now(), false, null, '09725-150', 'Avenida Senador Vergueiro', '243', 'Jardim do Mar', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000268', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'João Pedro Teixeira Alves', null, null, '2012-09-21'::date, 'IBS9067', 'IBS9067', true, now(), false, null, '09725-150', 'Avenida Senador Vergueiro', '243', 'Jardim do Mar', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000269', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Ricardo Monteiro Batista', 'ricardo.monteiro.batista.270@ibs.conectamais.app', '(11) 98810-0135', '1982-01-23'::date, 'IBS9068', 'IBS9068', true, now(), true, '4234', '09780-220', 'Rua Nova Petrópolis', '710', 'Nova Petrópolis', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000270', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Sabrina Batista Monteiro', 'sabrina.batista.monteiro.271@ibs.conectamais.app', '(11) 98810-0136', '1987-09-01'::date, 'IBS9068', 'IBS9068', true, now(), true, '4235', '09780-220', 'Rua Nova Petrópolis', '710', 'Nova Petrópolis', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000271', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Alice Monteiro Batista', null, null, '2010-01-06'::date, 'IBS9068', 'IBS9068', true, now(), false, null, '09780-220', 'Rua Nova Petrópolis', '710', 'Nova Petrópolis', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000272', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Maria Clara Monteiro Batista', null, null, '2014-10-03'::date, 'IBS9068', 'IBS9068', true, now(), false, null, '09780-220', 'Rua Nova Petrópolis', '710', 'Nova Petrópolis', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000273', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'André Moura Gomes', 'andre.moura.gomes.274@ibs.conectamais.app', '(11) 98810-0137', '1990-10-12'::date, 'IBS9069', 'IBS9069', true, now(), true, '4236', '09820-130', 'Rua Ferrazópolis', '666', 'Ferrazópolis', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000274', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Lúcia Gomes Moura', 'lucia.gomes.moura.275@ibs.conectamais.app', '(11) 98810-0138', '1993-07-05'::date, 'IBS9069', 'IBS9069', true, now(), true, '4237', '09820-130', 'Rua Ferrazópolis', '666', 'Ferrazópolis', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000275', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Noah Moura Gomes', null, null, '2013-01-22'::date, 'IBS9069', 'IBS9069', true, now(), false, null, '09820-130', 'Rua Ferrazópolis', '666', 'Ferrazópolis', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000276', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Nicolas Moura Gomes', null, null, '2015-04-18'::date, 'IBS9069', 'IBS9069', true, now(), false, null, '09820-130', 'Rua Ferrazópolis', '666', 'Ferrazópolis', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000277', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Fábio Rocha Leal', 'fabio.rocha.leal.278@ibs.conectamais.app', '(11) 98810-0139', '1991-03-26'::date, 'IBS9070', 'IBS9070', true, now(), true, '4238', '09750-240', 'Rua Marechal Deodoro', '679', 'Centro', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000278', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Elisa Leal Rocha', 'elisa.leal.rocha.279@ibs.conectamais.app', '(11) 98810-0140', '1997-11-02'::date, 'IBS9070', 'IBS9070', true, now(), true, '4239', '09750-240', 'Rua Marechal Deodoro', '679', 'Centro', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000279', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Liz Rocha Leal', null, null, '2017-07-05'::date, 'IBS9070', 'IBS9070', true, now(), false, null, '09750-240', 'Rua Marechal Deodoro', '679', 'Centro', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000280', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Isadora Rocha Leal', null, null, '2021-11-23'::date, 'IBS9070', 'IBS9070', true, now(), false, null, '09750-240', 'Rua Marechal Deodoro', '679', 'Centro', 'São Bernardo do Campo', 'SP', null);

insert into public.profiles (id, tenant_id, full_name, email, phone, birth_date, family_id, codigo_membro,
          lgpd_accepted, lgpd_accepted_at, is_active, access_pin,
          cep, address_street, address_number, address_neighborhood, address_city, address_state,
          first_visit_date) values
  ('c81295e3-9167-40b4-8524-000000000281', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'César Rocha Peixoto', 'cesar.rocha.peixoto.282@ibs.conectamais.app', '(11) 98810-0141', '1974-09-09'::date, 'IBS9071', 'IBS9071', true, now(), true, '4240', '09820-130', 'Rua Ferrazópolis', '878', 'Ferrazópolis', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000282', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Gabriela Peixoto Rocha', 'gabriela.peixoto.rocha.283@ibs.conectamais.app', '(11) 98810-0142', '1974-10-06'::date, 'IBS9071', 'IBS9071', true, now(), true, '4241', '09820-130', 'Rua Ferrazópolis', '878', 'Ferrazópolis', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000283', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Sophia Rocha Peixoto', null, null, '2010-04-07'::date, 'IBS9071', 'IBS9071', true, now(), false, null, '09820-130', 'Rua Ferrazópolis', '878', 'Ferrazópolis', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000284', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Lorenzo Rocha Peixoto', null, null, '2014-03-04'::date, 'IBS9071', 'IBS9071', true, now(), false, null, '09820-130', 'Rua Ferrazópolis', '878', 'Ferrazópolis', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000285', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Adriano Fernandes Moura', 'adriano.fernandes.moura.286@ibs.conectamais.app', '(11) 98810-0143', '1990-09-03'::date, 'IBS9072', 'IBS9072', true, now(), true, '4242', '09770-310', 'Rua Baeta Neves', '818', 'Baeta Neves', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000286', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Júlia Moura Fernandes', 'julia.moura.fernandes.287@ibs.conectamais.app', '(11) 98810-0144', '1992-03-20'::date, 'IBS9072', 'IBS9072', true, now(), true, '4243', '09770-310', 'Rua Baeta Neves', '818', 'Baeta Neves', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000287', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Luna Fernandes Moura', null, null, '2012-06-21'::date, 'IBS9072', 'IBS9072', true, now(), false, null, '09770-310', 'Rua Baeta Neves', '818', 'Baeta Neves', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000288', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Cecília Fernandes Moura', null, null, '2016-04-20'::date, 'IBS9072', 'IBS9072', true, now(), false, null, '09770-310', 'Rua Baeta Neves', '818', 'Baeta Neves', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000289', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Leandro Azevedo Lima', 'leandro.azevedo.lima.290@ibs.conectamais.app', '(11) 98810-0145', '1978-03-12'::date, 'IBS9073', 'IBS9073', true, now(), true, '4244', '09600-010', 'Avenida Kennedy', '339', 'Rudge Ramos', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000290', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Cristina Lima Azevedo', 'cristina.lima.azevedo.291@ibs.conectamais.app', '(11) 98810-0146', '1981-02-26'::date, 'IBS9073', 'IBS9073', true, now(), true, '4245', '09600-010', 'Avenida Kennedy', '339', 'Rudge Ramos', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000291', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Eloá Azevedo Lima', null, null, '2010-05-20'::date, 'IBS9073', 'IBS9073', true, now(), false, null, '09600-010', 'Avenida Kennedy', '339', 'Rudge Ramos', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000292', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'João Pedro Azevedo Lima', null, null, '2012-01-12'::date, 'IBS9073', 'IBS9073', true, now(), false, null, '09600-010', 'Avenida Kennedy', '339', 'Rudge Ramos', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000293', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Felipe Leal Vasconcelos', 'felipe.leal.vasconcelos.294@ibs.conectamais.app', '(11) 98810-0147', '1983-01-22'::date, 'IBS9074', 'IBS9074', true, now(), true, '4246', '09861-040', 'Avenida Demarchi', '900', 'Demarchi', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000294', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Tatiane Vasconcelos Leal', 'tatiane.vasconcelos.leal.295@ibs.conectamais.app', '(11) 98810-0148', '1984-01-28'::date, 'IBS9074', 'IBS9074', true, now(), true, '4247', '09861-040', 'Avenida Demarchi', '900', 'Demarchi', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000295', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Isadora Leal Vasconcelos', null, null, '2010-06-01'::date, 'IBS9074', 'IBS9074', true, now(), false, null, '09861-040', 'Avenida Demarchi', '900', 'Demarchi', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000296', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Maria Clara Leal Vasconcelos', null, null, '2012-09-15'::date, 'IBS9074', 'IBS9074', true, now(), false, null, '09861-040', 'Avenida Demarchi', '900', 'Demarchi', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000297', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'José Pacheco Duarte', 'jose.pacheco.duarte.298@ibs.conectamais.app', '(11) 98810-0149', '1989-12-22'::date, 'IBS9075', 'IBS9075', true, now(), true, '4248', '09606-000', 'Rua Tamandaré', '724', 'Rudge Ramos', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000298', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Elisa Duarte Pacheco', 'elisa.duarte.pacheco.299@ibs.conectamais.app', '(11) 98810-0150', '1991-02-03'::date, 'IBS9075', 'IBS9075', true, now(), true, '4249', '09606-000', 'Rua Tamandaré', '724', 'Rudge Ramos', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000299', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Laura Pacheco Duarte', null, null, '2011-11-22'::date, 'IBS9075', 'IBS9075', true, now(), false, null, '09606-000', 'Rua Tamandaré', '724', 'Rudge Ramos', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000300', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Isis Pacheco Duarte', null, null, '2013-12-15'::date, 'IBS9075', 'IBS9075', true, now(), false, null, '09606-000', 'Rua Tamandaré', '724', 'Rudge Ramos', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000301', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Diego Duarte Fernandes', 'diego.duarte.fernandes.302@ibs.conectamais.app', '(11) 98810-0151', '1983-10-28'::date, 'IBS9076', 'IBS9076', true, now(), true, '4250', '09635-000', 'Rua dos Vianas', '89', 'Rudge Ramos', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000302', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Heloísa Fernandes Duarte', 'heloisa.fernandes.duarte.303@ibs.conectamais.app', '(11) 98810-0152', '1986-04-16'::date, 'IBS9076', 'IBS9076', true, now(), true, '4251', '09635-000', 'Rua dos Vianas', '89', 'Rudge Ramos', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000303', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Arthur Duarte Fernandes', null, null, '2010-09-07'::date, 'IBS9076', 'IBS9076', true, now(), false, null, '09635-000', 'Rua dos Vianas', '89', 'Rudge Ramos', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000304', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Alice Duarte Fernandes', null, null, '2012-10-23'::date, 'IBS9076', 'IBS9076', true, now(), false, null, '09635-000', 'Rua dos Vianas', '89', 'Rudge Ramos', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000305', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Fábio Rodrigues Nogueira', 'fabio.rodrigues.nogueira.306@ibs.conectamais.app', '(11) 98810-0153', '1988-11-13'::date, 'IBS9077', 'IBS9077', true, now(), true, '4252', '09811-150', 'Rua dos Otonis', '797', 'Assunção', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000306', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Priscila Nogueira Rodrigues', 'priscila.nogueira.rodrigues.307@ibs.conectamais.app', '(11) 98810-0154', '1991-03-07'::date, 'IBS9077', 'IBS9077', true, now(), true, '4253', '09811-150', 'Rua dos Otonis', '797', 'Assunção', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000307', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Manuela Rodrigues Nogueira', null, null, '2011-04-26'::date, 'IBS9077', 'IBS9077', true, now(), false, null, '09811-150', 'Rua dos Otonis', '797', 'Assunção', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000308', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Maria Clara Rodrigues Nogueira', null, null, '2014-11-01'::date, 'IBS9077', 'IBS9077', true, now(), false, null, '09811-150', 'Rua dos Otonis', '797', 'Assunção', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000309', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Bruno Mendes Machado', 'bruno.mendes.machado.310@ibs.conectamais.app', '(11) 98810-0155', '1982-11-14'::date, 'IBS9078', 'IBS9078', true, now(), true, '4254', '09780-220', 'Rua Nova Petrópolis', '607', 'Nova Petrópolis', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000310', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Gabriela Machado Mendes', 'gabriela.machado.mendes.311@ibs.conectamais.app', '(11) 98810-0156', '1983-05-23'::date, 'IBS9078', 'IBS9078', true, now(), true, '4255', '09780-220', 'Rua Nova Petrópolis', '607', 'Nova Petrópolis', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000311', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Benício Mendes Machado', null, null, '2010-12-21'::date, 'IBS9078', 'IBS9078', true, now(), false, null, '09780-220', 'Rua Nova Petrópolis', '607', 'Nova Petrópolis', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000312', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Manuela Mendes Machado', null, null, '2014-06-10'::date, 'IBS9078', 'IBS9078', true, now(), false, null, '09780-220', 'Rua Nova Petrópolis', '607', 'Nova Petrópolis', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000313', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Murilo Pinto Nogueira', 'murilo.pinto.nogueira.314@ibs.conectamais.app', '(11) 98810-0157', '1983-09-11'::date, 'IBS9079', 'IBS9079', true, now(), true, '4256', '09820-130', 'Rua Ferrazópolis', '576', 'Ferrazópolis', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000314', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Sabrina Nogueira Pinto', 'sabrina.nogueira.pinto.315@ibs.conectamais.app', '(11) 98810-0158', '1985-04-04'::date, 'IBS9079', 'IBS9079', true, now(), true, '4257', '09820-130', 'Rua Ferrazópolis', '576', 'Ferrazópolis', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000315', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Arthur Pinto Nogueira', null, null, '2010-11-17'::date, 'IBS9079', 'IBS9079', true, now(), false, null, '09820-130', 'Rua Ferrazópolis', '576', 'Ferrazópolis', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000316', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Maya Pinto Nogueira', null, null, '2014-06-16'::date, 'IBS9079', 'IBS9079', true, now(), false, null, '09820-130', 'Rua Ferrazópolis', '576', 'Ferrazópolis', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000317', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'João Oliveira Sampaio', 'joao.oliveira.sampaio.318@ibs.conectamais.app', '(11) 98810-0159', '1975-01-20'::date, 'IBS9080', 'IBS9080', true, now(), true, '4258', '09890-210', 'Rua Assunção', '858', 'Assunção', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000318', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Camila Sampaio Oliveira', 'camila.sampaio.oliveira.319@ibs.conectamais.app', '(11) 98810-0160', '1981-03-24'::date, 'IBS9080', 'IBS9080', true, now(), true, '4259', '09890-210', 'Rua Assunção', '858', 'Assunção', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000319', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Helena Oliveira Sampaio', null, null, '2010-06-25'::date, 'IBS9080', 'IBS9080', true, now(), false, null, '09890-210', 'Rua Assunção', '858', 'Assunção', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000320', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Miguel Oliveira Sampaio', null, null, '2014-01-13'::date, 'IBS9080', 'IBS9080', true, now(), false, null, '09890-210', 'Rua Assunção', '858', 'Assunção', 'São Bernardo do Campo', 'SP', null);

insert into public.profiles (id, tenant_id, full_name, email, phone, birth_date, family_id, codigo_membro,
          lgpd_accepted, lgpd_accepted_at, is_active, access_pin,
          cep, address_street, address_number, address_neighborhood, address_city, address_state,
          first_visit_date) values
  ('c81295e3-9167-40b4-8524-000000000321', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'César Ferreira Rocha', 'cesar.ferreira.rocha.322@ibs.conectamais.app', '(11) 98810-0161', '1989-11-16'::date, 'IBS9081', 'IBS9081', true, now(), true, '4260', '09635-000', 'Rua dos Vianas', '303', 'Rudge Ramos', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000322', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Tereza Rocha Ferreira', 'tereza.rocha.ferreira.323@ibs.conectamais.app', '(11) 98810-0162', '1993-10-24'::date, 'IBS9081', 'IBS9081', true, now(), true, '4261', '09635-000', 'Rua dos Vianas', '303', 'Rudge Ramos', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000323', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Isaac Ferreira Rocha', null, null, '2013-07-05'::date, 'IBS9081', 'IBS9081', true, now(), false, null, '09635-000', 'Rua dos Vianas', '303', 'Rudge Ramos', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000324', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Ravi Ferreira Rocha', null, null, '2017-01-10'::date, 'IBS9081', 'IBS9081', true, now(), false, null, '09635-000', 'Rua dos Vianas', '303', 'Rudge Ramos', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000325', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Henrique Neves Barbosa', 'henrique.neves.barbosa.326@ibs.conectamais.app', '(11) 98810-0163', '1977-07-02'::date, 'IBS9082', 'IBS9082', true, now(), true, '4262', '09890-210', 'Rua Assunção', '872', 'Assunção', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000326', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Priscila Barbosa Neves', 'priscila.barbosa.neves.327@ibs.conectamais.app', '(11) 98810-0164', '1981-08-27'::date, 'IBS9082', 'IBS9082', true, now(), true, '4263', '09890-210', 'Rua Assunção', '872', 'Assunção', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000327', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Isadora Neves Barbosa', null, null, '2010-10-27'::date, 'IBS9082', 'IBS9082', true, now(), false, null, '09890-210', 'Rua Assunção', '872', 'Assunção', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000328', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Gael Neves Barbosa', null, null, '2012-01-24'::date, 'IBS9082', 'IBS9082', true, now(), false, null, '09890-210', 'Rua Assunção', '872', 'Assunção', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000329', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Igor Queiroz Correia', 'igor.queiroz.correia.330@ibs.conectamais.app', '(11) 98810-0165', '1984-01-04'::date, 'IBS9083', 'IBS9083', true, now(), true, '4264', '09750-500', 'Rua Silva Jardim', '335', 'Centro', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000330', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Heloísa Correia Queiroz', 'heloisa.correia.queiroz.331@ibs.conectamais.app', '(11) 98810-0166', '1987-01-26'::date, 'IBS9083', 'IBS9083', true, now(), true, '4265', '09750-500', 'Rua Silva Jardim', '335', 'Centro', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000331', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Ravi Queiroz Correia', null, null, '2010-12-14'::date, 'IBS9083', 'IBS9083', true, now(), false, null, '09750-500', 'Rua Silva Jardim', '335', 'Centro', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000332', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Sophia Queiroz Correia', null, null, '2012-07-10'::date, 'IBS9083', 'IBS9083', true, now(), false, null, '09750-500', 'Rua Silva Jardim', '335', 'Centro', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000333', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Gustavo Ribeiro Farias', 'gustavo.ribeiro.farias.334@ibs.conectamais.app', '(11) 98810-0167', '1988-05-28'::date, 'IBS9084', 'IBS9084', true, now(), true, '4266', '09750-500', 'Rua Silva Jardim', '257', 'Centro', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000334', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Juliana Farias Ribeiro', 'juliana.farias.ribeiro.335@ibs.conectamais.app', '(11) 98810-0168', '1988-07-10'::date, 'IBS9084', 'IBS9084', true, now(), true, '4267', '09750-500', 'Rua Silva Jardim', '257', 'Centro', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000335', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Lorena Ribeiro Farias', null, null, '2010-04-04'::date, 'IBS9084', 'IBS9084', true, now(), false, null, '09750-500', 'Rua Silva Jardim', '257', 'Centro', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000336', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Bernardo Ribeiro Farias', null, null, '2013-01-14'::date, 'IBS9084', 'IBS9084', true, now(), false, null, '09750-500', 'Rua Silva Jardim', '257', 'Centro', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000337', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Cristiano Cavalcanti Rocha', 'cristiano.cavalcanti.rocha.338@ibs.conectamais.app', '(11) 98810-0169', '1976-01-11'::date, 'IBS9085', 'IBS9085', true, now(), true, '4268', '09820-130', 'Rua Ferrazópolis', '972', 'Ferrazópolis', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000338', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Cristina Rocha Cavalcanti', 'cristina.rocha.cavalcanti.339@ibs.conectamais.app', '(11) 98810-0170', '1981-10-13'::date, 'IBS9085', 'IBS9085', true, now(), true, '4269', '09820-130', 'Rua Ferrazópolis', '972', 'Ferrazópolis', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000339', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Isaac Cavalcanti Rocha', null, null, '2010-01-22'::date, 'IBS9085', 'IBS9085', true, now(), false, null, '09820-130', 'Rua Ferrazópolis', '972', 'Ferrazópolis', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000340', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Isaac Cavalcanti Sampaio', null, null, '2013-03-15'::date, 'IBS9085', 'IBS9085', true, now(), false, null, '09820-130', 'Rua Ferrazópolis', '972', 'Ferrazópolis', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000341', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Leandro Gomes Fernandes', 'leandro.gomes.fernandes.342@ibs.conectamais.app', '(11) 98810-0171', '1980-04-13'::date, 'IBS9086', 'IBS9086', true, now(), true, '4270', '09635-000', 'Rua dos Vianas', '261', 'Rudge Ramos', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000342', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Flávia Fernandes Gomes', 'flavia.fernandes.gomes.343@ibs.conectamais.app', '(11) 98810-0172', '1981-01-09'::date, 'IBS9086', 'IBS9086', true, now(), true, '4271', '09635-000', 'Rua dos Vianas', '261', 'Rudge Ramos', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000343', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Alice Gomes Fernandes', null, null, '2010-12-06'::date, 'IBS9086', 'IBS9086', true, now(), false, null, '09635-000', 'Rua dos Vianas', '261', 'Rudge Ramos', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000344', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Gael Gomes Fernandes', null, null, '2013-03-25'::date, 'IBS9086', 'IBS9086', true, now(), false, null, '09635-000', 'Rua dos Vianas', '261', 'Rudge Ramos', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000345', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Antônio Siqueira Barros', 'antonio.siqueira.barros.346@ibs.conectamais.app', '(11) 98810-0173', '1983-05-22'::date, 'IBS9087', 'IBS9087', true, now(), true, '4272', '09750-500', 'Rua Silva Jardim', '674', 'Centro', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000346', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Jéssica Barros Siqueira', 'jessica.barros.siqueira.347@ibs.conectamais.app', '(11) 98810-0174', '1985-08-09'::date, 'IBS9087', 'IBS9087', true, now(), true, '4273', '09750-500', 'Rua Silva Jardim', '674', 'Centro', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000347', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Benício Siqueira Barros', null, null, '2010-10-26'::date, 'IBS9087', 'IBS9087', true, now(), false, null, '09750-500', 'Rua Silva Jardim', '674', 'Centro', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000348', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Miguel Siqueira Barros', null, null, '2013-06-06'::date, 'IBS9087', 'IBS9087', true, now(), false, null, '09750-500', 'Rua Silva Jardim', '674', 'Centro', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000349', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Rodrigo Dias Rezende', 'rodrigo.dias.rezende.350@ibs.conectamais.app', '(11) 98810-0175', '1979-05-13'::date, 'IBS9088', 'IBS9088', true, now(), true, '4274', '09715-140', 'Rua Jurubatuba', '551', 'Centro', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000350', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Sônia Rezende Dias', 'sonia.rezende.dias.351@ibs.conectamais.app', '(11) 98810-0176', '1979-07-03'::date, 'IBS9088', 'IBS9088', true, now(), true, '4275', '09715-140', 'Rua Jurubatuba', '551', 'Centro', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000351', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Isadora Dias Rezende', null, null, '2010-02-03'::date, 'IBS9088', 'IBS9088', true, now(), false, null, '09715-140', 'Rua Jurubatuba', '551', 'Centro', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000352', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Miguel Dias Rezende', null, null, '2013-03-13'::date, 'IBS9088', 'IBS9088', true, now(), false, null, '09715-140', 'Rua Jurubatuba', '551', 'Centro', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000353', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Felipe Teixeira Macedo', 'felipe.teixeira.macedo.354@ibs.conectamais.app', '(11) 98810-0177', '1977-03-09'::date, 'IBS9089', 'IBS9089', true, now(), true, '4276', '09715-140', 'Rua Jurubatuba', '512', 'Centro', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000354', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Mariana Macedo Teixeira', 'mariana.macedo.teixeira.355@ibs.conectamais.app', '(11) 98810-0178', '1981-11-08'::date, 'IBS9089', 'IBS9089', true, now(), true, '4277', '09715-140', 'Rua Jurubatuba', '512', 'Centro', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000355', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Cecília Teixeira Macedo', null, null, '2010-03-05'::date, 'IBS9089', 'IBS9089', true, now(), false, null, '09715-140', 'Rua Jurubatuba', '512', 'Centro', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000356', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Lorena Teixeira Macedo', null, null, '2012-10-18'::date, 'IBS9089', 'IBS9089', true, now(), false, null, '09715-140', 'Rua Jurubatuba', '512', 'Centro', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000357', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Thiago Nunes Rocha', 'thiago.nunes.rocha.358@ibs.conectamais.app', '(11) 98810-0179', '1990-10-18'::date, 'IBS9090', 'IBS9090', true, now(), true, '4278', '09635-000', 'Rua dos Vianas', '583', 'Rudge Ramos', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000358', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Amanda Rocha Nunes', 'amanda.rocha.nunes.359@ibs.conectamais.app', '(11) 98810-0180', '1996-04-14'::date, 'IBS9090', 'IBS9090', true, now(), true, '4279', '09635-000', 'Rua dos Vianas', '583', 'Rudge Ramos', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000359', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Lorena Nunes Rocha', null, null, '2016-07-27'::date, 'IBS9090', 'IBS9090', true, now(), false, null, '09635-000', 'Rua dos Vianas', '583', 'Rudge Ramos', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000360', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Heitor Nunes Rocha', null, null, '2020-05-01'::date, 'IBS9090', 'IBS9090', true, now(), false, null, '09635-000', 'Rua dos Vianas', '583', 'Rudge Ramos', 'São Bernardo do Campo', 'SP', null);

insert into public.profiles (id, tenant_id, full_name, email, phone, birth_date, family_id, codigo_membro,
          lgpd_accepted, lgpd_accepted_at, is_active, access_pin,
          cep, address_street, address_number, address_neighborhood, address_city, address_state,
          first_visit_date) values
  ('c81295e3-9167-40b4-8524-000000000361', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Henrique Farias Rodrigues', 'henrique.farias.rodrigues.362@ibs.conectamais.app', '(11) 98810-0181', '1989-07-04'::date, 'IBS9091', 'IBS9091', true, now(), true, '4280', '09726-000', 'Avenida Pereira Barreto', '651', 'Jardim do Mar', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000362', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Olivia Rodrigues Farias', 'olivia.rodrigues.farias.363@ibs.conectamais.app', '(11) 98810-0182', '1992-02-06'::date, 'IBS9091', 'IBS9091', true, now(), true, '4281', '09726-000', 'Avenida Pereira Barreto', '651', 'Jardim do Mar', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000363', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Miguel Farias Rodrigues', null, null, '2012-04-25'::date, 'IBS9091', 'IBS9091', true, now(), false, null, '09726-000', 'Avenida Pereira Barreto', '651', 'Jardim do Mar', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000364', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Theo Farias Rodrigues', null, null, '2016-12-26'::date, 'IBS9091', 'IBS9091', true, now(), false, null, '09726-000', 'Avenida Pereira Barreto', '651', 'Jardim do Mar', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000365', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Ricardo Macedo Dias', 'ricardo.macedo.dias.366@ibs.conectamais.app', '(11) 98810-0183', '1980-01-11'::date, 'IBS9092', 'IBS9092', true, now(), true, '4282', '09820-130', 'Rua Ferrazópolis', '676', 'Ferrazópolis', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000366', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Heloísa Dias Macedo', 'heloisa.dias.macedo.367@ibs.conectamais.app', '(11) 98810-0184', '1982-07-10'::date, 'IBS9092', 'IBS9092', true, now(), true, '4283', '09820-130', 'Rua Ferrazópolis', '676', 'Ferrazópolis', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000367', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Cecília Macedo Dias', null, null, '2010-09-25'::date, 'IBS9092', 'IBS9092', true, now(), false, null, '09820-130', 'Rua Ferrazópolis', '676', 'Ferrazópolis', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000368', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Lorena Macedo Dias', null, null, '2013-02-27'::date, 'IBS9092', 'IBS9092', true, now(), false, null, '09820-130', 'Rua Ferrazópolis', '676', 'Ferrazópolis', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000369', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'César Leal Monteiro', 'cesar.leal.monteiro.370@ibs.conectamais.app', '(11) 98810-0185', '1981-07-09'::date, 'IBS9093', 'IBS9093', true, now(), true, '4284', '09751-020', 'Rua Brás Cubas', '625', 'Centro', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000370', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Maria Monteiro Leal', 'maria.monteiro.leal.371@ibs.conectamais.app', '(11) 98810-0186', '1987-10-20'::date, 'IBS9093', 'IBS9093', true, now(), true, '4285', '09751-020', 'Rua Brás Cubas', '625', 'Centro', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000371', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Gael Leal Monteiro', null, null, '2010-09-17'::date, 'IBS9093', 'IBS9093', true, now(), false, null, '09751-020', 'Rua Brás Cubas', '625', 'Centro', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000372', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Caleb Leal Monteiro', null, null, '2012-07-23'::date, 'IBS9093', 'IBS9093', true, now(), false, null, '09751-020', 'Rua Brás Cubas', '625', 'Centro', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000373', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Alexandre Dias Macedo', 'alexandre.dias.macedo.374@ibs.conectamais.app', '(11) 98810-0187', '1988-05-12'::date, 'IBS9094', 'IBS9094', true, now(), true, '4286', '09600-010', 'Avenida Kennedy', '334', 'Rudge Ramos', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000374', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Heloísa Macedo Dias', 'heloisa.macedo.dias.375@ibs.conectamais.app', '(11) 98810-0188', '1991-08-07'::date, 'IBS9094', 'IBS9094', true, now(), true, '4287', '09600-010', 'Avenida Kennedy', '334', 'Rudge Ramos', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000375', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Manuela Dias Macedo', null, null, '2011-03-08'::date, 'IBS9094', 'IBS9094', true, now(), false, null, '09600-010', 'Avenida Kennedy', '334', 'Rudge Ramos', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000376', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Laura Dias Macedo', null, null, '2015-07-19'::date, 'IBS9094', 'IBS9094', true, now(), false, null, '09600-010', 'Avenida Kennedy', '334', 'Rudge Ramos', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000377', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Leandro Gomes Guimarães', 'leandro.gomes.guimaraes.378@ibs.conectamais.app', '(11) 98810-0189', '1980-02-13'::date, 'IBS9095', 'IBS9095', true, now(), true, '4288', '09811-150', 'Rua dos Otonis', '793', 'Assunção', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000378', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Sabrina Guimarães Gomes', 'sabrina.guimaraes.gomes.379@ibs.conectamais.app', '(11) 98810-0190', '1985-09-19'::date, 'IBS9095', 'IBS9095', true, now(), true, '4289', '09811-150', 'Rua dos Otonis', '793', 'Assunção', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000379', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Valentina Gomes Guimarães', null, null, '2010-05-16'::date, 'IBS9095', 'IBS9095', true, now(), false, null, '09811-150', 'Rua dos Otonis', '793', 'Assunção', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000380', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Arthur Gomes Guimarães', null, null, '2012-08-12'::date, 'IBS9095', 'IBS9095', true, now(), false, null, '09811-150', 'Rua dos Otonis', '793', 'Assunção', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000381', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Carlos Gomes Queiroz', 'carlos.gomes.queiroz.382@ibs.conectamais.app', '(11) 98810-0191', '1984-04-10'::date, 'IBS9096', 'IBS9096', true, now(), true, '4290', '09750-240', 'Rua Marechal Deodoro', '573', 'Centro', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000382', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Lúcia Queiroz Gomes', 'lucia.queiroz.gomes.383@ibs.conectamais.app', '(11) 98810-0192', '1984-09-06'::date, 'IBS9096', 'IBS9096', true, now(), true, '4291', '09750-240', 'Rua Marechal Deodoro', '573', 'Centro', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000383', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Nicolas Gomes Queiroz', null, null, '2010-12-10'::date, 'IBS9096', 'IBS9096', true, now(), false, null, '09750-240', 'Rua Marechal Deodoro', '573', 'Centro', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000384', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Liz Gomes Queiroz', null, null, '2013-07-21'::date, 'IBS9096', 'IBS9096', true, now(), false, null, '09750-240', 'Rua Marechal Deodoro', '573', 'Centro', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000385', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Júlio Cardoso Monteiro', 'julio.cardoso.monteiro.386@ibs.conectamais.app', '(11) 98810-0193', '1984-08-06'::date, 'IBS9097', 'IBS9097', true, now(), true, '4292', '09861-040', 'Avenida Demarchi', '76', 'Demarchi', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000386', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Olivia Monteiro Cardoso', 'olivia.monteiro.cardoso.387@ibs.conectamais.app', '(11) 98810-0194', '1990-02-14'::date, 'IBS9097', 'IBS9097', true, now(), true, '4293', '09861-040', 'Avenida Demarchi', '76', 'Demarchi', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000387', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Noah Cardoso Monteiro', null, null, '2010-11-10'::date, 'IBS9097', 'IBS9097', true, now(), false, null, '09861-040', 'Avenida Demarchi', '76', 'Demarchi', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000388', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Alice Cardoso Monteiro', null, null, '2012-07-01'::date, 'IBS9097', 'IBS9097', true, now(), false, null, '09861-040', 'Avenida Demarchi', '76', 'Demarchi', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000389', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Davi Farias Nogueira', 'davi.farias.nogueira.390@ibs.conectamais.app', '(11) 98810-0195', '1984-10-28'::date, 'IBS9098', 'IBS9098', true, now(), true, '4294', '09750-240', 'Rua Marechal Deodoro', '65', 'Centro', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000390', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Vanessa Nogueira Farias', 'vanessa.nogueira.farias.391@ibs.conectamais.app', '(11) 98810-0196', '1989-11-18'::date, 'IBS9098', 'IBS9098', true, now(), true, '4295', '09750-240', 'Rua Marechal Deodoro', '65', 'Centro', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000391', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Nicolas Farias Nogueira', null, null, '2010-03-15'::date, 'IBS9098', 'IBS9098', true, now(), false, null, '09750-240', 'Rua Marechal Deodoro', '65', 'Centro', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000392', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Theo Farias Nogueira', null, null, '2014-05-21'::date, 'IBS9098', 'IBS9098', true, now(), false, null, '09750-240', 'Rua Marechal Deodoro', '65', 'Centro', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000393', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Adriano Santos Cunha', 'adriano.santos.cunha.394@ibs.conectamais.app', '(11) 98810-0197', '1986-02-09'::date, 'IBS9099', 'IBS9099', true, now(), true, '4296', '09750-500', 'Rua Silva Jardim', '433', 'Centro', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000394', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Simone Cunha Santos', 'simone.cunha.santos.395@ibs.conectamais.app', '(11) 98810-0198', '1989-10-06'::date, 'IBS9099', 'IBS9099', true, now(), true, '4297', '09750-500', 'Rua Silva Jardim', '433', 'Centro', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000395', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Isis Santos Cunha', null, null, '2010-10-22'::date, 'IBS9099', 'IBS9099', true, now(), false, null, '09750-500', 'Rua Silva Jardim', '433', 'Centro', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000396', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Arthur Santos Cunha', null, null, '2013-09-06'::date, 'IBS9099', 'IBS9099', true, now(), false, null, '09750-500', 'Rua Silva Jardim', '433', 'Centro', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000397', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Vitor Pinto Cardoso', 'vitor.pinto.cardoso.398@ibs.conectamais.app', '(11) 98810-0199', '1974-06-09'::date, 'IBS9100', 'IBS9100', true, now(), true, '4298', '09600-010', 'Avenida Kennedy', '377', 'Rudge Ramos', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000398', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Aline Cardoso Pinto', 'aline.cardoso.pinto.399@ibs.conectamais.app', '(11) 98810-0200', '1974-12-03'::date, 'IBS9100', 'IBS9100', true, now(), true, '4299', '09600-010', 'Avenida Kennedy', '377', 'Rudge Ramos', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000399', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Miguel Pinto Cardoso', null, null, '2010-04-05'::date, 'IBS9100', 'IBS9100', true, now(), false, null, '09600-010', 'Avenida Kennedy', '377', 'Rudge Ramos', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000400', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Liz Pinto Cardoso', null, null, '2013-07-06'::date, 'IBS9100', 'IBS9100', true, now(), false, null, '09600-010', 'Avenida Kennedy', '377', 'Rudge Ramos', 'São Bernardo do Campo', 'SP', null);

insert into public.profiles (id, tenant_id, full_name, email, phone, birth_date, family_id, codigo_membro,
          lgpd_accepted, lgpd_accepted_at, is_active, access_pin,
          cep, address_street, address_number, address_neighborhood, address_city, address_state,
          first_visit_date) values
  ('c81295e3-9167-40b4-8524-000000000401', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'João Batista Rodrigues', 'joao.batista.rodrigues.402@ibs.conectamais.app', '(11) 98810-0201', '1990-10-18'::date, 'IBS9101', 'IBS9101', true, now(), true, '4300', '09635-000', 'Rua dos Vianas', '132', 'Rudge Ramos', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000402', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Helena Rodrigues Batista', 'helena.rodrigues.batista.403@ibs.conectamais.app', '(11) 98810-0202', '1990-09-20'::date, 'IBS9101', 'IBS9101', true, now(), true, '4301', '09635-000', 'Rua dos Vianas', '132', 'Rudge Ramos', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000403', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Samuel Batista Rodrigues', null, null, '2010-07-21'::date, 'IBS9101', 'IBS9101', true, now(), false, null, '09635-000', 'Rua dos Vianas', '132', 'Rudge Ramos', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000404', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Bernardo Batista Rodrigues', null, null, '2014-11-24'::date, 'IBS9101', 'IBS9101', true, now(), false, null, '09635-000', 'Rua dos Vianas', '132', 'Rudge Ramos', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000405', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Caio Araujo Castro', 'caio.araujo.castro.406@ibs.conectamais.app', '(11) 98810-0203', '1996-12-10'::date, 'IBS9102', 'IBS9102', true, now(), true, '4302', '09635-000', 'Rua dos Vianas', '58', 'Rudge Ramos', 'São Bernardo do Campo', 'SP', '2026-08-19'),
  ('c81295e3-9167-40b4-8524-000000000406', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Lívia Castro Araujo', 'livia.castro.araujo.407@ibs.conectamais.app', '(11) 98810-0204', '2000-07-24'::date, 'IBS9102', 'IBS9102', true, now(), true, '4303', '09635-000', 'Rua dos Vianas', '58', 'Rudge Ramos', 'São Bernardo do Campo', 'SP', '2026-09-06'),
  ('c81295e3-9167-40b4-8524-000000000407', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Samuel Araujo Castro', null, null, '2020-02-02'::date, 'IBS9102', 'IBS9102', true, now(), false, null, '09635-000', 'Rua dos Vianas', '58', 'Rudge Ramos', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000408', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Pedro Siqueira Araujo', 'pedro.siqueira.araujo.409@ibs.conectamais.app', '(11) 98810-0205', '1996-02-24'::date, 'IBS9103', 'IBS9103', true, now(), true, '4304', '09725-150', 'Avenida Senador Vergueiro', '845', 'Jardim do Mar', 'São Bernardo do Campo', 'SP', '2026-08-23'),
  ('c81295e3-9167-40b4-8524-000000000409', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Raquel Araujo Siqueira', 'raquel.araujo.siqueira.410@ibs.conectamais.app', '(11) 98810-0206', '2000-04-01'::date, 'IBS9103', 'IBS9103', true, now(), true, '4305', '09725-150', 'Avenida Senador Vergueiro', '845', 'Jardim do Mar', 'São Bernardo do Campo', 'SP', '2026-09-04'),
  ('c81295e3-9167-40b4-8524-000000000410', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Sophia Siqueira Araujo', null, null, '2020-09-02'::date, 'IBS9103', 'IBS9103', true, now(), false, null, '09725-150', 'Avenida Senador Vergueiro', '845', 'Jardim do Mar', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000411', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Lucas Lima Dias', 'lucas.lima.dias.412@ibs.conectamais.app', '(11) 98810-0207', '1996-04-02'::date, 'IBS9104', 'IBS9104', true, now(), true, '4306', '09600-010', 'Avenida Kennedy', '857', 'Rudge Ramos', 'São Bernardo do Campo', 'SP', '2026-08-27'),
  ('c81295e3-9167-40b4-8524-000000000412', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Júlia Dias Lima', 'julia.dias.lima.413@ibs.conectamais.app', '(11) 98810-0208', '1998-12-02'::date, 'IBS9104', 'IBS9104', true, now(), true, '4307', '09600-010', 'Avenida Kennedy', '857', 'Rudge Ramos', 'São Bernardo do Campo', 'SP', '2026-09-05'),
  ('c81295e3-9167-40b4-8524-000000000413', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Ravi Lima Dias', null, null, '2018-07-22'::date, 'IBS9104', 'IBS9104', true, now(), false, null, '09600-010', 'Avenida Kennedy', '857', 'Rudge Ramos', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000414', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Pedro Rezende Almeida', 'pedro.rezende.almeida.415@ibs.conectamais.app', '(11) 98810-0209', '1995-06-04'::date, 'IBS9105', 'IBS9105', true, now(), true, '4308', '09600-010', 'Avenida Kennedy', '955', 'Rudge Ramos', 'São Bernardo do Campo', 'SP', '2026-08-19'),
  ('c81295e3-9167-40b4-8524-000000000415', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Olivia Almeida Rezende', 'olivia.almeida.rezende.416@ibs.conectamais.app', '(11) 98810-0210', '1996-09-17'::date, 'IBS9105', 'IBS9105', true, now(), true, '4309', '09600-010', 'Avenida Kennedy', '955', 'Rudge Ramos', 'São Bernardo do Campo', 'SP', '2026-09-03'),
  ('c81295e3-9167-40b4-8524-000000000416', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Gael Rezende Almeida', null, null, '2016-12-23'::date, 'IBS9105', 'IBS9105', true, now(), false, null, '09600-010', 'Avenida Kennedy', '955', 'Rudge Ramos', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000417', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Heitor Campos Lima', 'heitor.campos.lima.418@ibs.conectamais.app', '(11) 98810-0211', '1990-04-12'::date, 'IBS9106', 'IBS9106', true, now(), true, '4310', '09726-000', 'Avenida Pereira Barreto', '336', 'Jardim do Mar', 'São Bernardo do Campo', 'SP', '2026-08-18'),
  ('c81295e3-9167-40b4-8524-000000000418', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Mariana Lima Campos', 'mariana.lima.campos.419@ibs.conectamais.app', '(11) 98810-0212', '1992-06-15'::date, 'IBS9106', 'IBS9106', true, now(), true, '4311', '09726-000', 'Avenida Pereira Barreto', '336', 'Jardim do Mar', 'São Bernardo do Campo', 'SP', '2026-08-05'),
  ('c81295e3-9167-40b4-8524-000000000419', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Cecília Campos Lima', null, null, '2012-02-03'::date, 'IBS9106', 'IBS9106', true, now(), false, null, '09726-000', 'Avenida Pereira Barreto', '336', 'Jardim do Mar', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000420', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Antônio Dias Pinto', 'antonio.dias.pinto.421@ibs.conectamais.app', '(11) 98810-0213', '1991-01-24'::date, 'IBS9107', 'IBS9107', true, now(), true, '4312', '09861-040', 'Avenida Demarchi', '73', 'Demarchi', 'São Bernardo do Campo', 'SP', '2026-08-29'),
  ('c81295e3-9167-40b4-8524-000000000421', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Mariana Pinto Dias', 'mariana.pinto.dias.422@ibs.conectamais.app', '(11) 98810-0214', '1995-02-28'::date, 'IBS9107', 'IBS9107', true, now(), true, '4313', '09861-040', 'Avenida Demarchi', '73', 'Demarchi', 'São Bernardo do Campo', 'SP', '2026-09-07'),
  ('c81295e3-9167-40b4-8524-000000000422', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Sophia Dias Pinto', null, null, '2015-05-01'::date, 'IBS9107', 'IBS9107', true, now(), false, null, '09861-040', 'Avenida Demarchi', '73', 'Demarchi', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000423', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Gabriel Pereira Batista', 'gabriel.pereira.batista.424@ibs.conectamais.app', '(11) 98810-0215', '1999-11-05'::date, 'IBS9108', 'IBS9108', true, now(), true, '4314', '09770-310', 'Rua Baeta Neves', '96', 'Baeta Neves', 'São Bernardo do Campo', 'SP', '2026-08-22'),
  ('c81295e3-9167-40b4-8524-000000000424', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Gabriela Batista Pereira', 'gabriela.batista.pereira.425@ibs.conectamais.app', '(11) 98810-0216', '1999-02-16'::date, 'IBS9108', 'IBS9108', true, now(), true, '4315', '09770-310', 'Rua Baeta Neves', '96', 'Baeta Neves', 'São Bernardo do Campo', 'SP', '2026-09-07'),
  ('c81295e3-9167-40b4-8524-000000000425', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Arthur Pereira Batista', null, null, '2019-12-23'::date, 'IBS9108', 'IBS9108', true, now(), false, null, '09770-310', 'Rua Baeta Neves', '96', 'Baeta Neves', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000426', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Carlos Rocha Leal', 'carlos.rocha.leal.427@ibs.conectamais.app', '(11) 98810-0217', '1998-06-28'::date, 'IBS9109', 'IBS9109', true, now(), true, '4316', '09726-000', 'Avenida Pereira Barreto', '169', 'Jardim do Mar', 'São Bernardo do Campo', 'SP', '2026-08-02'),
  ('c81295e3-9167-40b4-8524-000000000427', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Heloísa Leal Rocha', 'heloisa.leal.rocha.428@ibs.conectamais.app', '(11) 98810-0218', '1998-03-19'::date, 'IBS9109', 'IBS9109', true, now(), true, '4317', '09726-000', 'Avenida Pereira Barreto', '169', 'Jardim do Mar', 'São Bernardo do Campo', 'SP', '2026-08-23'),
  ('c81295e3-9167-40b4-8524-000000000428', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Theo Rocha Leal', null, null, '2018-06-03'::date, 'IBS9109', 'IBS9109', true, now(), false, null, '09726-000', 'Avenida Pereira Barreto', '169', 'Jardim do Mar', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000429', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Vinícius Dias Farias', 'vinicius.dias.farias.430@ibs.conectamais.app', '(11) 98810-0219', '1991-04-02'::date, 'IBS9110', 'IBS9110', true, now(), true, '4318', '09715-140', 'Rua Jurubatuba', '673', 'Centro', 'São Bernardo do Campo', 'SP', '2026-08-06'),
  ('c81295e3-9167-40b4-8524-000000000430', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Raquel Farias Dias', 'raquel.farias.dias.431@ibs.conectamais.app', '(11) 98810-0220', '1995-02-14'::date, 'IBS9110', 'IBS9110', true, now(), true, '4319', '09715-140', 'Rua Jurubatuba', '673', 'Centro', 'São Bernardo do Campo', 'SP', '2026-08-23'),
  ('c81295e3-9167-40b4-8524-000000000431', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Bernardo Dias Farias', null, null, '2015-05-08'::date, 'IBS9110', 'IBS9110', true, now(), false, null, '09715-140', 'Rua Jurubatuba', '673', 'Centro', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000432', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Fábio Tavares Barros', 'fabio.tavares.barros.433@ibs.conectamais.app', '(11) 98810-0221', '1993-06-08'::date, 'IBS9111', 'IBS9111', true, now(), true, '4320', '09750-500', 'Rua Silva Jardim', '823', 'Centro', 'São Bernardo do Campo', 'SP', '2026-08-18'),
  ('c81295e3-9167-40b4-8524-000000000433', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Amanda Barros Tavares', 'amanda.barros.tavares.434@ibs.conectamais.app', '(11) 98810-0222', '1995-06-26'::date, 'IBS9111', 'IBS9111', true, now(), true, '4321', '09750-500', 'Rua Silva Jardim', '823', 'Centro', 'São Bernardo do Campo', 'SP', '2026-08-07'),
  ('c81295e3-9167-40b4-8524-000000000434', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Bernardo Tavares Barros', null, null, '2015-01-17'::date, 'IBS9111', 'IBS9111', true, now(), false, null, '09750-500', 'Rua Silva Jardim', '823', 'Centro', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000435', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Wagner Teixeira Fernandes', 'wagner.teixeira.fernandes.436@ibs.conectamais.app', '(11) 98810-0223', '1991-05-19'::date, 'IBS9112', 'IBS9112', true, now(), true, '4322', '09820-130', 'Rua Ferrazópolis', '731', 'Ferrazópolis', 'São Bernardo do Campo', 'SP', '2026-08-14'),
  ('c81295e3-9167-40b4-8524-000000000436', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Heloísa Fernandes Teixeira', 'heloisa.fernandes.teixeira.437@ibs.conectamais.app', '(11) 98810-0224', '1994-11-16'::date, 'IBS9112', 'IBS9112', true, now(), true, '4323', '09820-130', 'Rua Ferrazópolis', '731', 'Ferrazópolis', 'São Bernardo do Campo', 'SP', '2026-08-23'),
  ('c81295e3-9167-40b4-8524-000000000437', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Lorena Teixeira Fernandes', null, null, '2014-04-23'::date, 'IBS9112', 'IBS9112', true, now(), false, null, '09820-130', 'Rua Ferrazópolis', '731', 'Ferrazópolis', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000438', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Caio Queiroz Lima', 'caio.queiroz.lima.439@ibs.conectamais.app', '(11) 98810-0225', '1993-10-12'::date, 'IBS9113', 'IBS9113', true, now(), true, '4324', '09750-500', 'Rua Silva Jardim', '71', 'Centro', 'São Bernardo do Campo', 'SP', '2026-09-06'),
  ('c81295e3-9167-40b4-8524-000000000439', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Sônia Lima Queiroz', 'sonia.lima.queiroz.440@ibs.conectamais.app', '(11) 98810-0226', '1995-12-11'::date, 'IBS9113', 'IBS9113', true, now(), true, '4325', '09750-500', 'Rua Silva Jardim', '71', 'Centro', 'São Bernardo do Campo', 'SP', '2026-09-02'),
  ('c81295e3-9167-40b4-8524-000000000440', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Maya Queiroz Lima', null, null, '2015-01-18'::date, 'IBS9113', 'IBS9113', true, now(), false, null, '09750-500', 'Rua Silva Jardim', '71', 'Centro', 'São Bernardo do Campo', 'SP', null);

insert into public.profiles (id, tenant_id, full_name, email, phone, birth_date, family_id, codigo_membro,
          lgpd_accepted, lgpd_accepted_at, is_active, access_pin,
          cep, address_street, address_number, address_neighborhood, address_city, address_state,
          first_visit_date) values
  ('c81295e3-9167-40b4-8524-000000000441', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Murilo Moreira Gomes', 'murilo.moreira.gomes.442@ibs.conectamais.app', '(11) 98810-0227', '1997-07-14'::date, 'IBS9114', 'IBS9114', true, now(), true, '4326', '09890-210', 'Rua Assunção', '874', 'Assunção', 'São Bernardo do Campo', 'SP', '2026-08-14'),
  ('c81295e3-9167-40b4-8524-000000000442', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Lívia Gomes Moreira', 'livia.gomes.moreira.443@ibs.conectamais.app', '(11) 98810-0228', '1999-06-24'::date, 'IBS9114', 'IBS9114', true, now(), true, '4327', '09890-210', 'Rua Assunção', '874', 'Assunção', 'São Bernardo do Campo', 'SP', '2026-08-01'),
  ('c81295e3-9167-40b4-8524-000000000443', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Davi Moreira Gomes', null, null, '2019-06-06'::date, 'IBS9114', 'IBS9114', true, now(), false, null, '09890-210', 'Rua Assunção', '874', 'Assunção', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000444', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Rogério Cunha Macedo', 'rogerio.cunha.macedo.445@ibs.conectamais.app', '(11) 98810-0229', '2000-06-09'::date, 'IBS9115', 'IBS9115', true, now(), true, '4328', '09726-000', 'Avenida Pereira Barreto', '302', 'Jardim do Mar', 'São Bernardo do Campo', 'SP', '2026-08-11'),
  ('c81295e3-9167-40b4-8524-000000000445', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Daniela Macedo Cunha', 'daniela.macedo.cunha.446@ibs.conectamais.app', '(11) 98810-0230', '2001-09-26'::date, 'IBS9115', 'IBS9115', true, now(), true, '4329', '09726-000', 'Avenida Pereira Barreto', '302', 'Jardim do Mar', 'São Bernardo do Campo', 'SP', '2026-09-07'),
  ('c81295e3-9167-40b4-8524-000000000446', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Isis Cunha Macedo', null, null, '2021-09-06'::date, 'IBS9115', 'IBS9115', true, now(), false, null, '09726-000', 'Avenida Pereira Barreto', '302', 'Jardim do Mar', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000447', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Rafael Pinto Vieira', 'rafael.pinto.vieira.448@ibs.conectamais.app', '(11) 98810-0231', '1993-10-10'::date, 'IBS9116', 'IBS9116', true, now(), true, '4330', '09726-000', 'Avenida Pereira Barreto', '575', 'Jardim do Mar', 'São Bernardo do Campo', 'SP', '2026-08-31'),
  ('c81295e3-9167-40b4-8524-000000000448', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Heloísa Vieira Pinto', 'heloisa.vieira.pinto.449@ibs.conectamais.app', '(11) 98810-0232', '1996-09-05'::date, 'IBS9116', 'IBS9116', true, now(), true, '4331', '09726-000', 'Avenida Pereira Barreto', '575', 'Jardim do Mar', 'São Bernardo do Campo', 'SP', '2026-08-03'),
  ('c81295e3-9167-40b4-8524-000000000449', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Helena Pinto Vieira', null, null, '2016-03-01'::date, 'IBS9116', 'IBS9116', true, now(), false, null, '09726-000', 'Avenida Pereira Barreto', '575', 'Jardim do Mar', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000450', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Thiago Rocha Farias', 'thiago.rocha.farias.451@ibs.conectamais.app', '(11) 98810-0233', '1993-11-07'::date, 'IBS9117', 'IBS9117', true, now(), true, '4332', '09725-150', 'Avenida Senador Vergueiro', '80', 'Jardim do Mar', 'São Bernardo do Campo', 'SP', '2026-08-16'),
  ('c81295e3-9167-40b4-8524-000000000451', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Simone Farias Rocha', 'simone.farias.rocha.452@ibs.conectamais.app', '(11) 98810-0234', '1995-06-11'::date, 'IBS9117', 'IBS9117', true, now(), true, '4333', '09725-150', 'Avenida Senador Vergueiro', '80', 'Jardim do Mar', 'São Bernardo do Campo', 'SP', '2026-08-20'),
  ('c81295e3-9167-40b4-8524-000000000452', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Caleb Rocha Farias', null, null, '2015-02-17'::date, 'IBS9117', 'IBS9117', true, now(), false, null, '09725-150', 'Avenida Senador Vergueiro', '80', 'Jardim do Mar', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000453', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Davi Santos Machado', 'davi.santos.machado.454@ibs.conectamais.app', '(11) 98810-0235', '1999-07-23'::date, 'IBS9118', 'IBS9118', true, now(), true, '4334', '09820-130', 'Rua Ferrazópolis', '733', 'Ferrazópolis', 'São Bernardo do Campo', 'SP', '2026-08-02'),
  ('c81295e3-9167-40b4-8524-000000000454', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Letícia Machado Santos', 'leticia.machado.santos.455@ibs.conectamais.app', '(11) 98810-0236', '2000-01-23'::date, 'IBS9118', 'IBS9118', true, now(), true, '4335', '09820-130', 'Rua Ferrazópolis', '733', 'Ferrazópolis', 'São Bernardo do Campo', 'SP', '2026-08-06'),
  ('c81295e3-9167-40b4-8524-000000000455', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Laura Santos Machado', null, null, '2020-10-25'::date, 'IBS9118', 'IBS9118', true, now(), false, null, '09820-130', 'Rua Ferrazópolis', '733', 'Ferrazópolis', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000456', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'José Peixoto Barros', 'jose.peixoto.barros.457@ibs.conectamais.app', '(11) 98810-0237', '1995-06-05'::date, 'IBS9119', 'IBS9119', true, now(), true, '4336', '09750-240', 'Rua Marechal Deodoro', '190', 'Centro', 'São Bernardo do Campo', 'SP', '2026-08-25'),
  ('c81295e3-9167-40b4-8524-000000000457', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Karina Barros Peixoto', 'karina.barros.peixoto.458@ibs.conectamais.app', '(11) 98810-0238', '1997-12-08'::date, 'IBS9119', 'IBS9119', true, now(), true, '4337', '09750-240', 'Rua Marechal Deodoro', '190', 'Centro', 'São Bernardo do Campo', 'SP', '2026-08-01'),
  ('c81295e3-9167-40b4-8524-000000000458', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'João Pedro Peixoto Barros', null, null, '2017-03-27'::date, 'IBS9119', 'IBS9119', true, now(), false, null, '09750-240', 'Rua Marechal Deodoro', '190', 'Centro', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000459', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Lucas Nunes Guimarães', 'lucas.nunes.guimaraes.460@ibs.conectamais.app', '(11) 98810-0239', '1992-04-12'::date, 'IBS9120', 'IBS9120', true, now(), true, '4338', '09750-500', 'Rua Silva Jardim', '78', 'Centro', 'São Bernardo do Campo', 'SP', '2026-09-02'),
  ('c81295e3-9167-40b4-8524-000000000460', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Amanda Guimarães Nunes', 'amanda.guimaraes.nunes.461@ibs.conectamais.app', '(11) 98810-0240', '1993-02-27'::date, 'IBS9120', 'IBS9120', true, now(), true, '4339', '09750-500', 'Rua Silva Jardim', '78', 'Centro', 'São Bernardo do Campo', 'SP', '2026-08-03'),
  ('c81295e3-9167-40b4-8524-000000000461', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Helena Nunes Guimarães', null, null, '2013-02-05'::date, 'IBS9120', 'IBS9120', true, now(), false, null, '09750-500', 'Rua Silva Jardim', '78', 'Centro', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000462', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Gabriel Farias Barros', 'gabriel.farias.barros.463@ibs.conectamais.app', '(11) 98810-0241', '1999-02-27'::date, 'IBS9121', 'IBS9121', true, now(), true, '4340', '09600-010', 'Avenida Kennedy', '327', 'Rudge Ramos', 'São Bernardo do Campo', 'SP', '2026-08-11'),
  ('c81295e3-9167-40b4-8524-000000000463', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Carolina Barros Farias', 'carolina.barros.farias.464@ibs.conectamais.app', '(11) 98810-0242', '2002-06-16'::date, 'IBS9121', 'IBS9121', true, now(), true, '4341', '09600-010', 'Avenida Kennedy', '327', 'Rudge Ramos', 'São Bernardo do Campo', 'SP', '2026-08-09'),
  ('c81295e3-9167-40b4-8524-000000000464', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Lorena Farias Barros', null, null, '2022-10-10'::date, 'IBS9121', 'IBS9121', true, now(), false, null, '09600-010', 'Avenida Kennedy', '327', 'Rudge Ramos', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000465', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Felipe Carvalho Duarte', 'felipe.carvalho.duarte.466@ibs.conectamais.app', '(11) 98810-0243', '1991-09-24'::date, 'IBS9122', 'IBS9122', true, now(), true, '4342', '09770-310', 'Rua Baeta Neves', '557', 'Baeta Neves', 'São Bernardo do Campo', 'SP', '2026-08-07'),
  ('c81295e3-9167-40b4-8524-000000000466', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Mônica Duarte Carvalho', 'monica.duarte.carvalho.467@ibs.conectamais.app', '(11) 98810-0244', '1991-04-18'::date, 'IBS9122', 'IBS9122', true, now(), true, '4343', '09770-310', 'Rua Baeta Neves', '557', 'Baeta Neves', 'São Bernardo do Campo', 'SP', '2026-08-31'),
  ('c81295e3-9167-40b4-8524-000000000467', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Sophia Carvalho Monteiro', null, null, '2011-01-18'::date, 'IBS9122', 'IBS9122', true, now(), false, null, '09770-310', 'Rua Baeta Neves', '557', 'Baeta Neves', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000468', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Samuel Macedo Peixoto', 'samuel.macedo.peixoto.469@ibs.conectamais.app', '(11) 98810-0245', '2000-05-13'::date, 'IBS9123', 'IBS9123', true, now(), true, '4344', '09606-000', 'Rua Tamandaré', '907', 'Rudge Ramos', 'São Bernardo do Campo', 'SP', '2026-08-28'),
  ('c81295e3-9167-40b4-8524-000000000469', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Raquel Peixoto Macedo', 'raquel.peixoto.macedo.470@ibs.conectamais.app', '(11) 98810-0246', '2000-11-13'::date, 'IBS9123', 'IBS9123', true, now(), true, '4345', '09606-000', 'Rua Tamandaré', '907', 'Rudge Ramos', 'São Bernardo do Campo', 'SP', '2026-09-01'),
  ('c81295e3-9167-40b4-8524-000000000470', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Liz Macedo Peixoto', null, null, '2020-10-19'::date, 'IBS9123', 'IBS9123', true, now(), false, null, '09606-000', 'Rua Tamandaré', '907', 'Rudge Ramos', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000471', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Fábio Sampaio Pacheco', 'fabio.sampaio.pacheco.472@ibs.conectamais.app', '(11) 98810-0247', '1992-03-12'::date, 'IBS9124', 'IBS9124', true, now(), true, '4346', '09780-220', 'Rua Nova Petrópolis', '570', 'Nova Petrópolis', 'São Bernardo do Campo', 'SP', '2026-08-21'),
  ('c81295e3-9167-40b4-8524-000000000472', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Vanessa Pacheco Sampaio', 'vanessa.pacheco.sampaio.473@ibs.conectamais.app', '(11) 98810-0248', '1994-06-06'::date, 'IBS9124', 'IBS9124', true, now(), true, '4347', '09780-220', 'Rua Nova Petrópolis', '570', 'Nova Petrópolis', 'São Bernardo do Campo', 'SP', '2026-08-09'),
  ('c81295e3-9167-40b4-8524-000000000473', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Miguel Sampaio Pacheco', null, null, '2014-10-04'::date, 'IBS9124', 'IBS9124', true, now(), false, null, '09780-220', 'Rua Nova Petrópolis', '570', 'Nova Petrópolis', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000474', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Henrique Dias Cavalcanti', 'henrique.dias.cavalcanti.475@ibs.conectamais.app', '(11) 98810-0249', '1994-07-08'::date, 'IBS9125', 'IBS9125', true, now(), true, '4348', '09606-000', 'Rua Tamandaré', '508', 'Rudge Ramos', 'São Bernardo do Campo', 'SP', '2026-08-05'),
  ('c81295e3-9167-40b4-8524-000000000475', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Débora Cavalcanti Dias', 'debora.cavalcanti.dias.476@ibs.conectamais.app', '(11) 98810-0250', '1997-01-07'::date, 'IBS9125', 'IBS9125', true, now(), true, '4349', '09606-000', 'Rua Tamandaré', '508', 'Rudge Ramos', 'São Bernardo do Campo', 'SP', '2026-08-08'),
  ('c81295e3-9167-40b4-8524-000000000476', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Miguel Dias Cavalcanti', null, null, '2017-12-28'::date, 'IBS9125', 'IBS9125', true, now(), false, null, '09606-000', 'Rua Tamandaré', '508', 'Rudge Ramos', 'São Bernardo do Campo', 'SP', null),
  ('c81295e3-9167-40b4-8524-000000000477', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Samuel Campos Barbosa', 'samuel.campos.barbosa.478@ibs.conectamais.app', '(11) 98810-0251', '1997-07-03'::date, 'IBS9126', 'IBS9126', true, now(), true, '4350', '09606-000', 'Rua Tamandaré', '950', 'Rudge Ramos', 'São Bernardo do Campo', 'SP', '2026-08-04'),
  ('c81295e3-9167-40b4-8524-000000000478', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Vanessa Barbosa Campos', 'vanessa.barbosa.campos.479@ibs.conectamais.app', '(11) 98810-0252', '1998-02-04'::date, 'IBS9126', 'IBS9126', true, now(), true, '4351', '09606-000', 'Rua Tamandaré', '950', 'Rudge Ramos', 'São Bernardo do Campo', 'SP', '2026-09-06'),
  ('c81295e3-9167-40b4-8524-000000000479', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Alice Campos Barbosa', null, null, '2018-08-09'::date, 'IBS9126', 'IBS9126', true, now(), false, null, '09606-000', 'Rua Tamandaré', '950', 'Rudge Ramos', 'São Bernardo do Campo', 'SP', null);

insert into public.members (id, tenant_id, full_name, phone, birth_date, relationship, family_id, is_responsavel, accepted, category)
values
  ('c81295e3-9167-40b4-8524-000000008000', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Ricardo Almeida Menezes', '(11) 98810-0001', '1988-01-10'::date, 'Representante Legal', 'IBS9001', true, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008001', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Isabela Queiroz Oliveira', '(11) 98810-0002', '1989-04-14'::date, 'Cônjuge', 'IBS9001', false, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008002', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Valentina Oliveira Queiroz', null, '2010-11-12'::date, 'Filho(a)', 'IBS9001', false, true, 'child'),
  ('c81295e3-9167-40b4-8524-000000008003', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Laura Oliveira Queiroz', null, '2012-09-27'::date, 'Filho(a)', 'IBS9001', false, true, 'child'),
  ('c81295e3-9167-40b4-8524-000000008004', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Eduardo Nogueira Camargo', '(11) 98810-0003', '1987-04-06'::date, 'Representante Legal', 'IBS9002', true, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008005', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Maria Queiroz Peixoto', '(11) 98810-0004', '1992-08-09'::date, 'Cônjuge', 'IBS9002', false, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008006', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Laura Peixoto Queiroz', null, '2012-10-16'::date, 'Filho(a)', 'IBS9002', false, true, 'child'),
  ('c81295e3-9167-40b4-8524-000000008007', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Heitor Peixoto Queiroz', null, '2014-10-07'::date, 'Filho(a)', 'IBS9002', false, true, 'child'),
  ('c81295e3-9167-40b4-8524-000000008008', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Henrique Azevedo Pereira', '(11) 98810-0005', '1991-09-01'::date, 'Representante Legal', 'IBS9003', true, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008009', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Sabrina Pereira Azevedo', '(11) 98810-0006', '1996-11-18'::date, 'Cônjuge', 'IBS9003', false, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008010', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Arthur Azevedo Pereira', null, '2016-12-25'::date, 'Filho(a)', 'IBS9003', false, true, 'child'),
  ('c81295e3-9167-40b4-8524-000000008011', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Lorena Azevedo Pereira', null, '2019-08-16'::date, 'Filho(a)', 'IBS9003', false, true, 'child'),
  ('c81295e3-9167-40b4-8524-000000008012', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'José Rodrigues Vieira', '(11) 98810-0007', '1981-01-08'::date, 'Representante Legal', 'IBS9004', true, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008013', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Lúcia Vieira Rodrigues', '(11) 98810-0008', '1981-11-12'::date, 'Cônjuge', 'IBS9004', false, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008014', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Cecília Rodrigues Vieira', null, '2010-10-05'::date, 'Filho(a)', 'IBS9004', false, true, 'child'),
  ('c81295e3-9167-40b4-8524-000000008015', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Heloísa Rodrigues Vieira', null, '2014-11-20'::date, 'Filho(a)', 'IBS9004', false, true, 'child'),
  ('c81295e3-9167-40b4-8524-000000008016', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Wagner Oliveira Almeida', '(11) 98810-0009', '1976-07-20'::date, 'Representante Legal', 'IBS9005', true, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008017', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Lívia Almeida Oliveira', '(11) 98810-0010', '1981-02-28'::date, 'Cônjuge', 'IBS9005', false, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008018', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Ravi Oliveira Almeida', null, '2010-09-09'::date, 'Filho(a)', 'IBS9005', false, true, 'child'),
  ('c81295e3-9167-40b4-8524-000000008019', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Nicolas Oliveira Almeida', null, '2012-02-06'::date, 'Filho(a)', 'IBS9005', false, true, 'child'),
  ('c81295e3-9167-40b4-8524-000000008020', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Ricardo Lima Macedo', '(11) 98810-0011', '1990-04-19'::date, 'Representante Legal', 'IBS9006', true, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008021', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Ingrid Macedo Lima', '(11) 98810-0012', '1991-09-01'::date, 'Cônjuge', 'IBS9006', false, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008022', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Davi Lima Macedo', null, '2011-01-24'::date, 'Filho(a)', 'IBS9006', false, true, 'child'),
  ('c81295e3-9167-40b4-8524-000000008023', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Samuel Lima Macedo', null, '2014-06-27'::date, 'Filho(a)', 'IBS9006', false, true, 'child'),
  ('c81295e3-9167-40b4-8524-000000008024', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Pedro Barros Ribeiro', '(11) 98810-0013', '1976-10-24'::date, 'Representante Legal', 'IBS9007', true, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008025', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Beatriz Ribeiro Barros', '(11) 98810-0014', '1977-12-15'::date, 'Cônjuge', 'IBS9007', false, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008026', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Isis Barros Ribeiro', null, '2010-12-08'::date, 'Filho(a)', 'IBS9007', false, true, 'child'),
  ('c81295e3-9167-40b4-8524-000000008027', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Maya Barros Ribeiro', null, '2013-12-17'::date, 'Filho(a)', 'IBS9007', false, true, 'child'),
  ('c81295e3-9167-40b4-8524-000000008028', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Carlos Oliveira Correia', '(11) 98810-0015', '1980-02-07'::date, 'Representante Legal', 'IBS9008', true, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008029', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Eliane Correia Oliveira', '(11) 98810-0016', '1983-12-11'::date, 'Cônjuge', 'IBS9008', false, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008030', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Manuela Oliveira Correia', null, '2010-05-03'::date, 'Filho(a)', 'IBS9008', false, true, 'child'),
  ('c81295e3-9167-40b4-8524-000000008031', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Maya Oliveira Correia', null, '2012-05-19'::date, 'Filho(a)', 'IBS9008', false, true, 'child'),
  ('c81295e3-9167-40b4-8524-000000008032', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Samuel Farias Barbosa', '(11) 98810-0017', '1981-04-06'::date, 'Representante Legal', 'IBS9009', true, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008033', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Ingrid Barbosa Farias', '(11) 98810-0018', '1984-07-14'::date, 'Cônjuge', 'IBS9009', false, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008034', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Nicolas Farias Barbosa', null, '2010-02-16'::date, 'Filho(a)', 'IBS9009', false, true, 'child'),
  ('c81295e3-9167-40b4-8524-000000008035', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Luna Farias Barbosa', null, '2013-09-09'::date, 'Filho(a)', 'IBS9009', false, true, 'child'),
  ('c81295e3-9167-40b4-8524-000000008036', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Júlio Carvalho Vasconcelos', '(11) 98810-0019', '1981-07-26'::date, 'Representante Legal', 'IBS9010', true, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008037', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Carolina Vasconcelos Carvalho', '(11) 98810-0020', '1984-03-16'::date, 'Cônjuge', 'IBS9010', false, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008038', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Manuela Carvalho Vasconcelos', null, '2010-10-08'::date, 'Filho(a)', 'IBS9010', false, true, 'child'),
  ('c81295e3-9167-40b4-8524-000000008039', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Sophia Carvalho Vasconcelos', null, '2013-10-07'::date, 'Filho(a)', 'IBS9010', false, true, 'child'),
  ('c81295e3-9167-40b4-8524-000000008040', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Gabriel Guimarães Machado', '(11) 98810-0021', '1979-10-26'::date, 'Representante Legal', 'IBS9011', true, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008041', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Natália Machado Guimarães', '(11) 98810-0022', '1981-04-26'::date, 'Cônjuge', 'IBS9011', false, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008042', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Valentina Guimarães Machado', null, '2010-07-04'::date, 'Filho(a)', 'IBS9011', false, true, 'child'),
  ('c81295e3-9167-40b4-8524-000000008043', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Miguel Guimarães Machado', null, '2012-06-26'::date, 'Filho(a)', 'IBS9011', false, true, 'child'),
  ('c81295e3-9167-40b4-8524-000000008044', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Samuel Rezende Araujo', '(11) 98810-0023', '1978-08-19'::date, 'Representante Legal', 'IBS9012', true, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008045', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Aparecida Araujo Rezende', '(11) 98810-0024', '1984-02-16'::date, 'Cônjuge', 'IBS9012', false, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008046', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Davi Rezende Araujo', null, '2010-08-08'::date, 'Filho(a)', 'IBS9012', false, true, 'child'),
  ('c81295e3-9167-40b4-8524-000000008047', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Alice Rezende Araujo', null, '2012-02-07'::date, 'Filho(a)', 'IBS9012', false, true, 'child'),
  ('c81295e3-9167-40b4-8524-000000008048', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'André Aguiar Rezende', '(11) 98810-0025', '1984-01-10'::date, 'Representante Legal', 'IBS9013', true, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008049', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Helena Rezende Aguiar', '(11) 98810-0026', '1988-02-13'::date, 'Cônjuge', 'IBS9013', false, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008050', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Manuela Aguiar Rezende', null, '2010-04-01'::date, 'Filho(a)', 'IBS9013', false, true, 'child'),
  ('c81295e3-9167-40b4-8524-000000008051', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Caleb Aguiar Rezende', null, '2013-01-04'::date, 'Filho(a)', 'IBS9013', false, true, 'child'),
  ('c81295e3-9167-40b4-8524-000000008052', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Felipe Castro Gomes', '(11) 98810-0027', '1990-01-21'::date, 'Representante Legal', 'IBS9014', true, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008053', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Simone Gomes Castro', '(11) 98810-0028', '1993-11-13'::date, 'Cônjuge', 'IBS9014', false, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008054', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Samuel Castro Gomes', null, '2013-08-10'::date, 'Filho(a)', 'IBS9014', false, true, 'child'),
  ('c81295e3-9167-40b4-8524-000000008055', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Gael Castro Gomes', null, '2016-10-23'::date, 'Filho(a)', 'IBS9014', false, true, 'child'),
  ('c81295e3-9167-40b4-8524-000000008056', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Marcelo Nunes Ferreira', '(11) 98810-0029', '1988-01-23'::date, 'Representante Legal', 'IBS9015', true, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008057', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Priscila Ferreira Nunes', '(11) 98810-0030', '1990-04-23'::date, 'Cônjuge', 'IBS9015', false, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008058', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Miguel Nunes Ferreira', null, '2010-05-10'::date, 'Filho(a)', 'IBS9015', false, true, 'child'),
  ('c81295e3-9167-40b4-8524-000000008059', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Laura Nunes Ferreira', null, '2014-09-18'::date, 'Filho(a)', 'IBS9015', false, true, 'child'),
  ('c81295e3-9167-40b4-8524-000000008060', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Felipe Cunha Moreira', '(11) 98810-0031', '1992-12-22'::date, 'Representante Legal', 'IBS9016', true, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008061', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Eliane Moreira Cunha', '(11) 98810-0032', '1996-07-24'::date, 'Cônjuge', 'IBS9016', false, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008062', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Sophia Cunha Moreira', null, '2016-02-14'::date, 'Filho(a)', 'IBS9016', false, true, 'child'),
  ('c81295e3-9167-40b4-8524-000000008063', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Cecília Cunha Moreira', null, '2020-05-08'::date, 'Filho(a)', 'IBS9016', false, true, 'child'),
  ('c81295e3-9167-40b4-8524-000000008064', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'João Barbosa Oliveira', '(11) 98810-0033', '1985-04-10'::date, 'Representante Legal', 'IBS9017', true, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008065', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Fabiana Oliveira Barbosa', '(11) 98810-0034', '1989-04-06'::date, 'Cônjuge', 'IBS9017', false, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008066', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Caleb Barbosa Oliveira', null, '2010-01-16'::date, 'Filho(a)', 'IBS9017', false, true, 'child'),
  ('c81295e3-9167-40b4-8524-000000008067', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Valentina Barbosa Oliveira', null, '2012-05-19'::date, 'Filho(a)', 'IBS9017', false, true, 'child'),
  ('c81295e3-9167-40b4-8524-000000008068', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Murilo Monteiro Machado', '(11) 98810-0035', '1974-06-14'::date, 'Representante Legal', 'IBS9018', true, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008069', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Bianca Machado Monteiro', '(11) 98810-0036', '1976-10-09'::date, 'Cônjuge', 'IBS9018', false, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008070', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Theo Monteiro Machado', null, '2010-11-03'::date, 'Filho(a)', 'IBS9018', false, true, 'child'),
  ('c81295e3-9167-40b4-8524-000000008071', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Liz Monteiro Machado', null, '2013-12-09'::date, 'Filho(a)', 'IBS9018', false, true, 'child'),
  ('c81295e3-9167-40b4-8524-000000008072', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Rafael Teixeira Correia', '(11) 98810-0037', '1990-12-11'::date, 'Representante Legal', 'IBS9019', true, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008073', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Amanda Correia Teixeira', '(11) 98810-0038', '1990-02-23'::date, 'Cônjuge', 'IBS9019', false, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008074', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Benício Teixeira Correia', null, '2010-12-17'::date, 'Filho(a)', 'IBS9019', false, true, 'child'),
  ('c81295e3-9167-40b4-8524-000000008075', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Luna Teixeira Correia', null, '2014-05-06'::date, 'Filho(a)', 'IBS9019', false, true, 'child'),
  ('c81295e3-9167-40b4-8524-000000008076', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'José Cardoso Machado', '(11) 98810-0039', '1987-09-20'::date, 'Representante Legal', 'IBS9020', true, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008077', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Maria Machado Cardoso', '(11) 98810-0040', '1990-09-07'::date, 'Cônjuge', 'IBS9020', false, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008078', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Laura Cardoso Machado', null, '2010-10-24'::date, 'Filho(a)', 'IBS9020', false, true, 'child'),
  ('c81295e3-9167-40b4-8524-000000008079', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Isis Cardoso Machado', null, '2013-01-27'::date, 'Filho(a)', 'IBS9020', false, true, 'child'),
  ('c81295e3-9167-40b4-8524-000000008080', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Daniel Cardoso Farias', '(11) 98810-0041', '1981-02-26'::date, 'Representante Legal', 'IBS9021', true, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008081', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Bruna Farias Cardoso', '(11) 98810-0042', '1984-07-09'::date, 'Cônjuge', 'IBS9021', false, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008082', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Heitor Cardoso Farias', null, '2010-04-15'::date, 'Filho(a)', 'IBS9021', false, true, 'child'),
  ('c81295e3-9167-40b4-8524-000000008083', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Ravi Cardoso Farias', null, '2014-01-23'::date, 'Filho(a)', 'IBS9021', false, true, 'child'),
  ('c81295e3-9167-40b4-8524-000000008084', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'José Almeida Leal', '(11) 98810-0043', '1987-02-21'::date, 'Representante Legal', 'IBS9022', true, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008085', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Patrícia Leal Almeida', '(11) 98810-0044', '1990-04-27'::date, 'Cônjuge', 'IBS9022', false, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008086', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Laura Almeida Leal', null, '2010-03-07'::date, 'Filho(a)', 'IBS9022', false, true, 'child'),
  ('c81295e3-9167-40b4-8524-000000008087', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Valentina Almeida Leal', null, '2014-09-07'::date, 'Filho(a)', 'IBS9022', false, true, 'child'),
  ('c81295e3-9167-40b4-8524-000000008088', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Caio Siqueira Santos', '(11) 98810-0045', '1974-06-18'::date, 'Representante Legal', 'IBS9023', true, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008089', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Eliane Santos Siqueira', '(11) 98810-0046', '1974-12-20'::date, 'Cônjuge', 'IBS9023', false, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008090', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Maria Clara Siqueira Santos', null, '2010-05-06'::date, 'Filho(a)', 'IBS9023', false, true, 'child'),
  ('c81295e3-9167-40b4-8524-000000008091', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Ravi Siqueira Santos', null, '2012-12-04'::date, 'Filho(a)', 'IBS9023', false, true, 'child'),
  ('c81295e3-9167-40b4-8524-000000008092', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Leandro Araujo Moreira', '(11) 98810-0047', '1989-07-05'::date, 'Representante Legal', 'IBS9024', true, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008093', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Tereza Moreira Araujo', '(11) 98810-0048', '1995-06-23'::date, 'Cônjuge', 'IBS9024', false, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008094', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Heitor Araujo Moreira', null, '2015-04-13'::date, 'Filho(a)', 'IBS9024', false, true, 'child'),
  ('c81295e3-9167-40b4-8524-000000008095', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Benício Araujo Moreira', null, '2017-04-13'::date, 'Filho(a)', 'IBS9024', false, true, 'child'),
  ('c81295e3-9167-40b4-8524-000000008096', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Carlos Carvalho Duarte', '(11) 98810-0049', '1977-02-22'::date, 'Representante Legal', 'IBS9025', true, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008097', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Cristina Duarte Carvalho', '(11) 98810-0050', '1981-06-26'::date, 'Cônjuge', 'IBS9025', false, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008098', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Sophia Carvalho Duarte', null, '2010-09-19'::date, 'Filho(a)', 'IBS9025', false, true, 'child'),
  ('c81295e3-9167-40b4-8524-000000008099', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Cecília Carvalho Duarte', null, '2014-01-14'::date, 'Filho(a)', 'IBS9025', false, true, 'child'),
  ('c81295e3-9167-40b4-8524-000000008100', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Daniel Barbosa Vasconcelos', '(11) 98810-0051', '1982-12-19'::date, 'Representante Legal', 'IBS9026', true, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008101', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Larissa Vasconcelos Barbosa', '(11) 98810-0052', '1983-09-01'::date, 'Cônjuge', 'IBS9026', false, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008102', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Laura Barbosa Vasconcelos', null, '2010-08-10'::date, 'Filho(a)', 'IBS9026', false, true, 'child'),
  ('c81295e3-9167-40b4-8524-000000008103', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Valentina Barbosa Vasconcelos', null, '2014-07-09'::date, 'Filho(a)', 'IBS9026', false, true, 'child'),
  ('c81295e3-9167-40b4-8524-000000008104', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Enzo Moreira Barros', '(11) 98810-0053', '1989-11-06'::date, 'Representante Legal', 'IBS9027', true, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008105', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Vanessa Barros Moreira', '(11) 98810-0054', '1992-10-16'::date, 'Cônjuge', 'IBS9027', false, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008106', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Isadora Moreira Barros', null, '2012-07-06'::date, 'Filho(a)', 'IBS9027', false, true, 'child'),
  ('c81295e3-9167-40b4-8524-000000008107', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Lorena Moreira Barros', null, '2014-07-12'::date, 'Filho(a)', 'IBS9027', false, true, 'child'),
  ('c81295e3-9167-40b4-8524-000000008108', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Antônio Gomes Carvalho', '(11) 98810-0055', '1975-01-16'::date, 'Representante Legal', 'IBS9028', true, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008109', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Gabriela Carvalho Gomes', '(11) 98810-0056', '1977-08-21'::date, 'Cônjuge', 'IBS9028', false, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008110', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Alice Gomes Carvalho', null, '2010-10-02'::date, 'Filho(a)', 'IBS9028', false, true, 'child'),
  ('c81295e3-9167-40b4-8524-000000008111', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Noah Gomes Carvalho', null, '2013-09-12'::date, 'Filho(a)', 'IBS9028', false, true, 'child'),
  ('c81295e3-9167-40b4-8524-000000008112', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Otávio Cardoso Teixeira', '(11) 98810-0057', '1974-08-20'::date, 'Representante Legal', 'IBS9029', true, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008113', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Mônica Teixeira Cardoso', '(11) 98810-0058', '1979-07-22'::date, 'Cônjuge', 'IBS9029', false, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008114', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Cecília Cardoso Teixeira', null, '2010-09-20'::date, 'Filho(a)', 'IBS9029', false, true, 'child'),
  ('c81295e3-9167-40b4-8524-000000008115', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Noah Cardoso Teixeira', null, '2012-10-08'::date, 'Filho(a)', 'IBS9029', false, true, 'child'),
  ('c81295e3-9167-40b4-8524-000000008116', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Gustavo Queiroz Nogueira', '(11) 98810-0059', '1992-05-06'::date, 'Representante Legal', 'IBS9030', true, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008117', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Sônia Nogueira Queiroz', '(11) 98810-0060', '1994-05-22'::date, 'Cônjuge', 'IBS9030', false, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008118', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Theo Queiroz Nogueira', null, '2014-09-06'::date, 'Filho(a)', 'IBS9030', false, true, 'child'),
  ('c81295e3-9167-40b4-8524-000000008119', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Samuel Queiroz Nogueira', null, '2016-10-25'::date, 'Filho(a)', 'IBS9030', false, true, 'child'),
  ('c81295e3-9167-40b4-8524-000000008120', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Sérgio Macedo Nogueira', '(11) 98810-0061', '1991-10-01'::date, 'Representante Legal', 'IBS9031', true, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008121', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Renata Nogueira Macedo', '(11) 98810-0062', '1994-06-24'::date, 'Cônjuge', 'IBS9031', false, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008122', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Isis Macedo Nogueira', null, '2014-06-11'::date, 'Filho(a)', 'IBS9031', false, true, 'child'),
  ('c81295e3-9167-40b4-8524-000000008123', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Caleb Macedo Nogueira', null, '2018-10-03'::date, 'Filho(a)', 'IBS9031', false, true, 'child'),
  ('c81295e3-9167-40b4-8524-000000008124', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Carlos Mendes Barros', '(11) 98810-0063', '1986-01-05'::date, 'Representante Legal', 'IBS9032', true, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008125', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Larissa Barros Mendes', '(11) 98810-0064', '1986-05-03'::date, 'Cônjuge', 'IBS9032', false, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008126', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Davi Mendes Barros', null, '2010-09-26'::date, 'Filho(a)', 'IBS9032', false, true, 'child'),
  ('c81295e3-9167-40b4-8524-000000008127', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Davi Mendes Batista', null, '2012-12-28'::date, 'Filho(a)', 'IBS9032', false, true, 'child'),
  ('c81295e3-9167-40b4-8524-000000008128', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'João Pinto Rodrigues', '(11) 98810-0065', '1986-12-24'::date, 'Representante Legal', 'IBS9033', true, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008129', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Lúcia Rodrigues Pinto', '(11) 98810-0066', '1991-03-27'::date, 'Cônjuge', 'IBS9033', false, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008130', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Isadora Pinto Rodrigues', null, '2011-05-28'::date, 'Filho(a)', 'IBS9033', false, true, 'child'),
  ('c81295e3-9167-40b4-8524-000000008131', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Maya Pinto Rodrigues', null, '2013-11-12'::date, 'Filho(a)', 'IBS9033', false, true, 'child'),
  ('c81295e3-9167-40b4-8524-000000008132', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Eduardo Oliveira Alves', '(11) 98810-0067', '1991-01-24'::date, 'Representante Legal', 'IBS9034', true, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008133', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Heloísa Alves Oliveira', '(11) 98810-0068', '1992-04-07'::date, 'Cônjuge', 'IBS9034', false, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008134', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Manuela Oliveira Alves', null, '2012-11-18'::date, 'Filho(a)', 'IBS9034', false, true, 'child'),
  ('c81295e3-9167-40b4-8524-000000008135', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Davi Oliveira Alves', null, '2016-01-23'::date, 'Filho(a)', 'IBS9034', false, true, 'child'),
  ('c81295e3-9167-40b4-8524-000000008136', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Cristiano Alves Almeida', '(11) 98810-0069', '1992-05-07'::date, 'Representante Legal', 'IBS9035', true, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008137', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Juliana Almeida Alves', '(11) 98810-0070', '1996-12-11'::date, 'Cônjuge', 'IBS9035', false, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008138', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Maria Clara Alves Almeida', null, '2016-04-18'::date, 'Filho(a)', 'IBS9035', false, true, 'child'),
  ('c81295e3-9167-40b4-8524-000000008139', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Nicolas Alves Almeida', null, '2020-03-13'::date, 'Filho(a)', 'IBS9035', false, true, 'child'),
  ('c81295e3-9167-40b4-8524-000000008140', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'João Moura Queiroz', '(11) 98810-0071', '1982-12-19'::date, 'Representante Legal', 'IBS9036', true, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008141', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Tatiane Queiroz Moura', '(11) 98810-0072', '1985-05-04'::date, 'Cônjuge', 'IBS9036', false, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008142', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Laura Moura Queiroz', null, '2010-06-02'::date, 'Filho(a)', 'IBS9036', false, true, 'child'),
  ('c81295e3-9167-40b4-8524-000000008143', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Maria Clara Moura Queiroz', null, '2012-03-16'::date, 'Filho(a)', 'IBS9036', false, true, 'child'),
  ('c81295e3-9167-40b4-8524-000000008144', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'João Cavalcanti Moura', '(11) 98810-0073', '1990-02-20'::date, 'Representante Legal', 'IBS9037', true, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008145', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Olivia Moura Cavalcanti', '(11) 98810-0074', '1993-10-11'::date, 'Cônjuge', 'IBS9037', false, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008146', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Arthur Cavalcanti Moura', null, '2013-02-04'::date, 'Filho(a)', 'IBS9037', false, true, 'child'),
  ('c81295e3-9167-40b4-8524-000000008147', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Bernardo Cavalcanti Moura', null, '2016-06-27'::date, 'Filho(a)', 'IBS9037', false, true, 'child'),
  ('c81295e3-9167-40b4-8524-000000008148', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Fábio Ribeiro Castro', '(11) 98810-0075', '1979-05-04'::date, 'Representante Legal', 'IBS9038', true, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008149', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Fabiana Castro Ribeiro', '(11) 98810-0076', '1985-10-24'::date, 'Cônjuge', 'IBS9038', false, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008150', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Maria Clara Ribeiro Castro', null, '2010-05-10'::date, 'Filho(a)', 'IBS9038', false, true, 'child'),
  ('c81295e3-9167-40b4-8524-000000008151', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'João Pedro Ribeiro Castro', null, '2014-09-21'::date, 'Filho(a)', 'IBS9038', false, true, 'child'),
  ('c81295e3-9167-40b4-8524-000000008152', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Rafael Monteiro Ferreira', '(11) 98810-0077', '1975-02-15'::date, 'Representante Legal', 'IBS9039', true, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008153', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Júlia Ferreira Monteiro', '(11) 98810-0078', '1979-04-06'::date, 'Cônjuge', 'IBS9039', false, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008154', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Arthur Monteiro Ferreira', null, '2010-10-20'::date, 'Filho(a)', 'IBS9039', false, true, 'child'),
  ('c81295e3-9167-40b4-8524-000000008155', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Luna Monteiro Ferreira', null, '2012-11-07'::date, 'Filho(a)', 'IBS9039', false, true, 'child'),
  ('c81295e3-9167-40b4-8524-000000008156', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Fernando Vasconcelos Mendes', '(11) 98810-0079', '1985-07-01'::date, 'Representante Legal', 'IBS9040', true, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008157', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Larissa Mendes Vasconcelos', '(11) 98810-0080', '1986-01-08'::date, 'Cônjuge', 'IBS9040', false, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008158', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Ravi Vasconcelos Mendes', null, '2010-06-13'::date, 'Filho(a)', 'IBS9040', false, true, 'child'),
  ('c81295e3-9167-40b4-8524-000000008159', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Maya Vasconcelos Mendes', null, '2014-07-06'::date, 'Filho(a)', 'IBS9040', false, true, 'child'),
  ('c81295e3-9167-40b4-8524-000000008160', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'César Ferreira Cunha', '(11) 98810-0081', '1979-07-08'::date, 'Representante Legal', 'IBS9041', true, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008161', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Tereza Cunha Ferreira', '(11) 98810-0082', '1979-12-27'::date, 'Cônjuge', 'IBS9041', false, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008162', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Sophia Ferreira Cunha', null, '2010-07-26'::date, 'Filho(a)', 'IBS9041', false, true, 'child'),
  ('c81295e3-9167-40b4-8524-000000008163', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Bernardo Ferreira Cunha', null, '2012-11-18'::date, 'Filho(a)', 'IBS9041', false, true, 'child'),
  ('c81295e3-9167-40b4-8524-000000008164', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Rafael Batista Moura', '(11) 98810-0083', '1975-08-06'::date, 'Representante Legal', 'IBS9042', true, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008165', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Letícia Moura Batista', '(11) 98810-0084', '1975-11-20'::date, 'Cônjuge', 'IBS9042', false, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008166', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Benício Batista Moura', null, '2010-10-11'::date, 'Filho(a)', 'IBS9042', false, true, 'child'),
  ('c81295e3-9167-40b4-8524-000000008167', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Benício Batista Ribeiro', null, '2014-09-12'::date, 'Filho(a)', 'IBS9042', false, true, 'child'),
  ('c81295e3-9167-40b4-8524-000000008168', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Daniel Dias Nogueira', '(11) 98810-0085', '1992-09-06'::date, 'Representante Legal', 'IBS9043', true, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008169', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Aline Nogueira Dias', '(11) 98810-0086', '1997-08-25'::date, 'Cônjuge', 'IBS9043', false, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008170', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Maya Dias Nogueira', null, '2017-08-05'::date, 'Filho(a)', 'IBS9043', false, true, 'child'),
  ('c81295e3-9167-40b4-8524-000000008171', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Arthur Dias Nogueira', null, '2021-07-13'::date, 'Filho(a)', 'IBS9043', false, true, 'child'),
  ('c81295e3-9167-40b4-8524-000000008172', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Rafael Mendes Nunes', '(11) 98810-0087', '1986-11-09'::date, 'Representante Legal', 'IBS9044', true, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008173', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Daniela Nunes Mendes', '(11) 98810-0088', '1992-07-09'::date, 'Cônjuge', 'IBS9044', false, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008174', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Lorenzo Mendes Nunes', null, '2012-09-26'::date, 'Filho(a)', 'IBS9044', false, true, 'child'),
  ('c81295e3-9167-40b4-8524-000000008175', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Nicolas Mendes Nunes', null, '2016-01-11'::date, 'Filho(a)', 'IBS9044', false, true, 'child'),
  ('c81295e3-9167-40b4-8524-000000008176', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Murilo Correia Carvalho', '(11) 98810-0089', '1980-09-05'::date, 'Representante Legal', 'IBS9045', true, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008177', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Carolina Carvalho Correia', '(11) 98810-0090', '1984-01-12'::date, 'Cônjuge', 'IBS9045', false, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008178', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Sophia Correia Carvalho', null, '2010-08-07'::date, 'Filho(a)', 'IBS9045', false, true, 'child'),
  ('c81295e3-9167-40b4-8524-000000008179', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Manuela Correia Carvalho', null, '2012-05-04'::date, 'Filho(a)', 'IBS9045', false, true, 'child'),
  ('c81295e3-9167-40b4-8524-000000008180', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Ricardo Pacheco Almeida', '(11) 98810-0091', '1987-02-04'::date, 'Representante Legal', 'IBS9046', true, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008181', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Maria Almeida Pacheco', '(11) 98810-0092', '1989-10-19'::date, 'Cônjuge', 'IBS9046', false, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008182', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Caleb Pacheco Almeida', null, '2010-02-25'::date, 'Filho(a)', 'IBS9046', false, true, 'child'),
  ('c81295e3-9167-40b4-8524-000000008183', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Miguel Pacheco Almeida', null, '2012-01-07'::date, 'Filho(a)', 'IBS9046', false, true, 'child'),
  ('c81295e3-9167-40b4-8524-000000008184', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Igor Castro Guimarães', '(11) 98810-0093', '1987-02-15'::date, 'Representante Legal', 'IBS9047', true, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008185', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Patrícia Guimarães Castro', '(11) 98810-0094', '1993-10-22'::date, 'Cônjuge', 'IBS9047', false, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008186', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Theo Castro Guimarães', null, '2013-11-17'::date, 'Filho(a)', 'IBS9047', false, true, 'child'),
  ('c81295e3-9167-40b4-8524-000000008187', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Samuel Castro Guimarães', null, '2015-01-05'::date, 'Filho(a)', 'IBS9047', false, true, 'child'),
  ('c81295e3-9167-40b4-8524-000000008188', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Ricardo Rodrigues Nunes', '(11) 98810-0095', '1990-07-22'::date, 'Representante Legal', 'IBS9048', true, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008189', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Ana Nunes Rodrigues', '(11) 98810-0096', '1995-02-22'::date, 'Cônjuge', 'IBS9048', false, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008190', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Miguel Rodrigues Nunes', null, '2015-11-03'::date, 'Filho(a)', 'IBS9048', false, true, 'child'),
  ('c81295e3-9167-40b4-8524-000000008191', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Caleb Rodrigues Nunes', null, '2017-03-10'::date, 'Filho(a)', 'IBS9048', false, true, 'child'),
  ('c81295e3-9167-40b4-8524-000000008192', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Igor Barros Araujo', '(11) 98810-0097', '1977-10-07'::date, 'Representante Legal', 'IBS9049', true, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008193', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Larissa Araujo Barros', '(11) 98810-0098', '1983-01-21'::date, 'Cônjuge', 'IBS9049', false, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008194', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Isis Barros Araujo', null, '2010-01-11'::date, 'Filho(a)', 'IBS9049', false, true, 'child'),
  ('c81295e3-9167-40b4-8524-000000008195', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Heitor Barros Araujo', null, '2013-01-01'::date, 'Filho(a)', 'IBS9049', false, true, 'child'),
  ('c81295e3-9167-40b4-8524-000000008196', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'César Campos Pacheco', '(11) 98810-0099', '1986-12-21'::date, 'Representante Legal', 'IBS9050', true, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008197', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Karina Pacheco Campos', '(11) 98810-0100', '1989-09-15'::date, 'Cônjuge', 'IBS9050', false, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008198', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Isadora Campos Pacheco', null, '2010-09-08'::date, 'Filho(a)', 'IBS9050', false, true, 'child'),
  ('c81295e3-9167-40b4-8524-000000008199', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Maria Clara Campos Pacheco', null, '2013-01-25'::date, 'Filho(a)', 'IBS9050', false, true, 'child'),
  ('c81295e3-9167-40b4-8524-000000008200', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Fernando Aguiar Vasconcelos', '(11) 98810-0101', '1980-08-18'::date, 'Representante Legal', 'IBS9051', true, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008201', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Cristina Vasconcelos Aguiar', '(11) 98810-0102', '1985-10-04'::date, 'Cônjuge', 'IBS9051', false, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008202', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Manuela Aguiar Vasconcelos', null, '2010-07-14'::date, 'Filho(a)', 'IBS9051', false, true, 'child'),
  ('c81295e3-9167-40b4-8524-000000008203', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Gael Aguiar Vasconcelos', null, '2013-06-19'::date, 'Filho(a)', 'IBS9051', false, true, 'child'),
  ('c81295e3-9167-40b4-8524-000000008204', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Antônio Nunes Peixoto', '(11) 98810-0103', '1987-09-18'::date, 'Representante Legal', 'IBS9052', true, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008205', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Juliana Peixoto Nunes', '(11) 98810-0104', '1993-03-03'::date, 'Cônjuge', 'IBS9052', false, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008206', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Caleb Nunes Peixoto', null, '2013-03-24'::date, 'Filho(a)', 'IBS9052', false, true, 'child'),
  ('c81295e3-9167-40b4-8524-000000008207', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Theo Nunes Peixoto', null, '2017-05-17'::date, 'Filho(a)', 'IBS9052', false, true, 'child'),
  ('c81295e3-9167-40b4-8524-000000008208', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'André Duarte Vasconcelos', '(11) 98810-0105', '1987-02-05'::date, 'Representante Legal', 'IBS9053', true, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008209', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Fabiana Vasconcelos Duarte', '(11) 98810-0106', '1989-12-23'::date, 'Cônjuge', 'IBS9053', false, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008210', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Caleb Duarte Vasconcelos', null, '2010-02-04'::date, 'Filho(a)', 'IBS9053', false, true, 'child'),
  ('c81295e3-9167-40b4-8524-000000008211', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Liz Duarte Vasconcelos', null, '2014-09-24'::date, 'Filho(a)', 'IBS9053', false, true, 'child'),
  ('c81295e3-9167-40b4-8524-000000008212', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Cristiano Pacheco Almeida', '(11) 98810-0107', '1988-09-09'::date, 'Representante Legal', 'IBS9054', true, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008213', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Cristina Almeida Pacheco', '(11) 98810-0108', '1989-11-21'::date, 'Cônjuge', 'IBS9054', false, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008214', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Isaac Pacheco Almeida', null, '2010-06-04'::date, 'Filho(a)', 'IBS9054', false, true, 'child'),
  ('c81295e3-9167-40b4-8524-000000008215', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'João Pedro Pacheco Almeida', null, '2013-09-03'::date, 'Filho(a)', 'IBS9054', false, true, 'child'),
  ('c81295e3-9167-40b4-8524-000000008216', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Renato Guimarães Aguiar', '(11) 98810-0109', '1985-01-06'::date, 'Representante Legal', 'IBS9055', true, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008217', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Bruna Aguiar Guimarães', '(11) 98810-0110', '1991-01-28'::date, 'Cônjuge', 'IBS9055', false, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008218', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Laura Guimarães Aguiar', null, '2011-03-20'::date, 'Filho(a)', 'IBS9055', false, true, 'child'),
  ('c81295e3-9167-40b4-8524-000000008219', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Theo Guimarães Aguiar', null, '2014-11-28'::date, 'Filho(a)', 'IBS9055', false, true, 'child'),
  ('c81295e3-9167-40b4-8524-000000008220', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Cláudio Fernandes Almeida', '(11) 98810-0111', '1978-06-22'::date, 'Representante Legal', 'IBS9056', true, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008221', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Daniela Almeida Fernandes', '(11) 98810-0112', '1978-01-06'::date, 'Cônjuge', 'IBS9056', false, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008222', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Luna Fernandes Almeida', null, '2010-01-19'::date, 'Filho(a)', 'IBS9056', false, true, 'child'),
  ('c81295e3-9167-40b4-8524-000000008223', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Lorenzo Fernandes Almeida', null, '2014-10-26'::date, 'Filho(a)', 'IBS9056', false, true, 'child'),
  ('c81295e3-9167-40b4-8524-000000008224', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Fernando Machado Cardoso', '(11) 98810-0113', '1985-10-05'::date, 'Representante Legal', 'IBS9057', true, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008225', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Bianca Cardoso Machado', '(11) 98810-0114', '1987-06-27'::date, 'Cônjuge', 'IBS9057', false, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008226', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Alice Machado Cardoso', null, '2010-05-23'::date, 'Filho(a)', 'IBS9057', false, true, 'child'),
  ('c81295e3-9167-40b4-8524-000000008227', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Theo Machado Cardoso', null, '2013-01-16'::date, 'Filho(a)', 'IBS9057', false, true, 'child'),
  ('c81295e3-9167-40b4-8524-000000008228', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Eduardo Almeida Sampaio', '(11) 98810-0115', '1984-07-24'::date, 'Representante Legal', 'IBS9058', true, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008229', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Olivia Sampaio Almeida', '(11) 98810-0116', '1990-04-16'::date, 'Cônjuge', 'IBS9058', false, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008230', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Miguel Almeida Sampaio', null, '2010-02-05'::date, 'Filho(a)', 'IBS9058', false, true, 'child'),
  ('c81295e3-9167-40b4-8524-000000008231', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Cecília Almeida Sampaio', null, '2012-02-26'::date, 'Filho(a)', 'IBS9058', false, true, 'child'),
  ('c81295e3-9167-40b4-8524-000000008232', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Júlio Oliveira Vasconcelos', '(11) 98810-0117', '1989-11-27'::date, 'Representante Legal', 'IBS9059', true, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008233', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Paula Vasconcelos Oliveira', '(11) 98810-0118', '1995-03-09'::date, 'Cônjuge', 'IBS9059', false, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008234', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Laura Oliveira Vasconcelos', null, '2015-09-15'::date, 'Filho(a)', 'IBS9059', false, true, 'child'),
  ('c81295e3-9167-40b4-8524-000000008235', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Maya Oliveira Vasconcelos', null, '2018-11-14'::date, 'Filho(a)', 'IBS9059', false, true, 'child'),
  ('c81295e3-9167-40b4-8524-000000008236', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Fábio Duarte Carvalho', '(11) 98810-0119', '1978-01-28'::date, 'Representante Legal', 'IBS9060', true, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008237', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Renata Carvalho Duarte', '(11) 98810-0120', '1980-01-16'::date, 'Cônjuge', 'IBS9060', false, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008238', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Eloá Duarte Carvalho', null, '2010-09-20'::date, 'Filho(a)', 'IBS9060', false, true, 'child'),
  ('c81295e3-9167-40b4-8524-000000008239', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Liz Duarte Carvalho', null, '2014-05-12'::date, 'Filho(a)', 'IBS9060', false, true, 'child'),
  ('c81295e3-9167-40b4-8524-000000008240', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Marcelo Macedo Lima', '(11) 98810-0121', '1984-10-25'::date, 'Representante Legal', 'IBS9061', true, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008241', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Sônia Lima Macedo', '(11) 98810-0122', '1985-06-05'::date, 'Cônjuge', 'IBS9061', false, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008242', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Bernardo Macedo Lima', null, '2010-01-24'::date, 'Filho(a)', 'IBS9061', false, true, 'child'),
  ('c81295e3-9167-40b4-8524-000000008243', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Alice Macedo Lima', null, '2013-09-20'::date, 'Filho(a)', 'IBS9061', false, true, 'child'),
  ('c81295e3-9167-40b4-8524-000000008244', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Leandro Moura Queiroz', '(11) 98810-0123', '1983-01-28'::date, 'Representante Legal', 'IBS9062', true, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008245', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Patrícia Queiroz Moura', '(11) 98810-0124', '1987-02-15'::date, 'Cônjuge', 'IBS9062', false, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008246', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Samuel Moura Queiroz', null, '2010-03-19'::date, 'Filho(a)', 'IBS9062', false, true, 'child'),
  ('c81295e3-9167-40b4-8524-000000008247', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Laura Moura Santos', null, '2013-05-02'::date, 'Filho(a)', 'IBS9062', false, true, 'child'),
  ('c81295e3-9167-40b4-8524-000000008248', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Rogério Gomes Farias', '(11) 98810-0125', '1984-03-28'::date, 'Representante Legal', 'IBS9063', true, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008249', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Aline Farias Gomes', '(11) 98810-0126', '1989-02-28'::date, 'Cônjuge', 'IBS9063', false, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008250', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Arthur Gomes Farias', null, '2010-09-12'::date, 'Filho(a)', 'IBS9063', false, true, 'child'),
  ('c81295e3-9167-40b4-8524-000000008251', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Bernardo Gomes Farias', null, '2014-10-10'::date, 'Filho(a)', 'IBS9063', false, true, 'child'),
  ('c81295e3-9167-40b4-8524-000000008252', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Murilo Moreira Rezende', '(11) 98810-0127', '1981-04-25'::date, 'Representante Legal', 'IBS9064', true, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008253', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Simone Rezende Moreira', '(11) 98810-0128', '1981-08-18'::date, 'Cônjuge', 'IBS9064', false, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008254', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Eloá Moreira Rezende', null, '2010-11-21'::date, 'Filho(a)', 'IBS9064', false, true, 'child'),
  ('c81295e3-9167-40b4-8524-000000008255', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Valentina Moreira Rezende', null, '2012-06-07'::date, 'Filho(a)', 'IBS9064', false, true, 'child'),
  ('c81295e3-9167-40b4-8524-000000008256', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Otávio Monteiro Pereira', '(11) 98810-0129', '1974-01-22'::date, 'Representante Legal', 'IBS9065', true, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008257', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Amanda Pereira Monteiro', '(11) 98810-0130', '1979-09-08'::date, 'Cônjuge', 'IBS9065', false, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008258', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Maria Clara Monteiro Pereira', null, '2010-06-02'::date, 'Filho(a)', 'IBS9065', false, true, 'child'),
  ('c81295e3-9167-40b4-8524-000000008259', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Gael Monteiro Pereira', null, '2012-08-03'::date, 'Filho(a)', 'IBS9065', false, true, 'child'),
  ('c81295e3-9167-40b4-8524-000000008260', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Marcelo Barbosa Farias', '(11) 98810-0131', '1976-12-13'::date, 'Representante Legal', 'IBS9066', true, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008261', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Larissa Farias Barbosa', '(11) 98810-0132', '1981-09-27'::date, 'Cônjuge', 'IBS9066', false, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008262', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'João Pedro Barbosa Farias', null, '2010-11-27'::date, 'Filho(a)', 'IBS9066', false, true, 'child'),
  ('c81295e3-9167-40b4-8524-000000008263', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Lorenzo Barbosa Farias', null, '2014-10-28'::date, 'Filho(a)', 'IBS9066', false, true, 'child'),
  ('c81295e3-9167-40b4-8524-000000008264', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'José Teixeira Alves', '(11) 98810-0133', '1984-01-12'::date, 'Representante Legal', 'IBS9067', true, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008265', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Ingrid Alves Teixeira', '(11) 98810-0134', '1985-12-05'::date, 'Cônjuge', 'IBS9067', false, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008266', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Theo Teixeira Alves', null, '2010-12-25'::date, 'Filho(a)', 'IBS9067', false, true, 'child'),
  ('c81295e3-9167-40b4-8524-000000008267', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'João Pedro Teixeira Alves', null, '2012-09-21'::date, 'Filho(a)', 'IBS9067', false, true, 'child'),
  ('c81295e3-9167-40b4-8524-000000008268', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Ricardo Monteiro Batista', '(11) 98810-0135', '1982-01-23'::date, 'Representante Legal', 'IBS9068', true, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008269', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Sabrina Batista Monteiro', '(11) 98810-0136', '1987-09-01'::date, 'Cônjuge', 'IBS9068', false, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008270', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Alice Monteiro Batista', null, '2010-01-06'::date, 'Filho(a)', 'IBS9068', false, true, 'child'),
  ('c81295e3-9167-40b4-8524-000000008271', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Maria Clara Monteiro Batista', null, '2014-10-03'::date, 'Filho(a)', 'IBS9068', false, true, 'child'),
  ('c81295e3-9167-40b4-8524-000000008272', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'André Moura Gomes', '(11) 98810-0137', '1990-10-12'::date, 'Representante Legal', 'IBS9069', true, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008273', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Lúcia Gomes Moura', '(11) 98810-0138', '1993-07-05'::date, 'Cônjuge', 'IBS9069', false, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008274', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Noah Moura Gomes', null, '2013-01-22'::date, 'Filho(a)', 'IBS9069', false, true, 'child'),
  ('c81295e3-9167-40b4-8524-000000008275', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Nicolas Moura Gomes', null, '2015-04-18'::date, 'Filho(a)', 'IBS9069', false, true, 'child'),
  ('c81295e3-9167-40b4-8524-000000008276', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Fábio Rocha Leal', '(11) 98810-0139', '1991-03-26'::date, 'Representante Legal', 'IBS9070', true, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008277', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Elisa Leal Rocha', '(11) 98810-0140', '1997-11-02'::date, 'Cônjuge', 'IBS9070', false, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008278', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Liz Rocha Leal', null, '2017-07-05'::date, 'Filho(a)', 'IBS9070', false, true, 'child'),
  ('c81295e3-9167-40b4-8524-000000008279', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Isadora Rocha Leal', null, '2021-11-23'::date, 'Filho(a)', 'IBS9070', false, true, 'child'),
  ('c81295e3-9167-40b4-8524-000000008280', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'César Rocha Peixoto', '(11) 98810-0141', '1974-09-09'::date, 'Representante Legal', 'IBS9071', true, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008281', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Gabriela Peixoto Rocha', '(11) 98810-0142', '1974-10-06'::date, 'Cônjuge', 'IBS9071', false, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008282', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Sophia Rocha Peixoto', null, '2010-04-07'::date, 'Filho(a)', 'IBS9071', false, true, 'child'),
  ('c81295e3-9167-40b4-8524-000000008283', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Lorenzo Rocha Peixoto', null, '2014-03-04'::date, 'Filho(a)', 'IBS9071', false, true, 'child'),
  ('c81295e3-9167-40b4-8524-000000008284', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Adriano Fernandes Moura', '(11) 98810-0143', '1990-09-03'::date, 'Representante Legal', 'IBS9072', true, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008285', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Júlia Moura Fernandes', '(11) 98810-0144', '1992-03-20'::date, 'Cônjuge', 'IBS9072', false, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008286', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Luna Fernandes Moura', null, '2012-06-21'::date, 'Filho(a)', 'IBS9072', false, true, 'child'),
  ('c81295e3-9167-40b4-8524-000000008287', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Cecília Fernandes Moura', null, '2016-04-20'::date, 'Filho(a)', 'IBS9072', false, true, 'child'),
  ('c81295e3-9167-40b4-8524-000000008288', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Leandro Azevedo Lima', '(11) 98810-0145', '1978-03-12'::date, 'Representante Legal', 'IBS9073', true, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008289', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Cristina Lima Azevedo', '(11) 98810-0146', '1981-02-26'::date, 'Cônjuge', 'IBS9073', false, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008290', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Eloá Azevedo Lima', null, '2010-05-20'::date, 'Filho(a)', 'IBS9073', false, true, 'child'),
  ('c81295e3-9167-40b4-8524-000000008291', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'João Pedro Azevedo Lima', null, '2012-01-12'::date, 'Filho(a)', 'IBS9073', false, true, 'child'),
  ('c81295e3-9167-40b4-8524-000000008292', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Felipe Leal Vasconcelos', '(11) 98810-0147', '1983-01-22'::date, 'Representante Legal', 'IBS9074', true, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008293', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Tatiane Vasconcelos Leal', '(11) 98810-0148', '1984-01-28'::date, 'Cônjuge', 'IBS9074', false, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008294', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Isadora Leal Vasconcelos', null, '2010-06-01'::date, 'Filho(a)', 'IBS9074', false, true, 'child'),
  ('c81295e3-9167-40b4-8524-000000008295', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Maria Clara Leal Vasconcelos', null, '2012-09-15'::date, 'Filho(a)', 'IBS9074', false, true, 'child'),
  ('c81295e3-9167-40b4-8524-000000008296', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'José Pacheco Duarte', '(11) 98810-0149', '1989-12-22'::date, 'Representante Legal', 'IBS9075', true, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008297', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Elisa Duarte Pacheco', '(11) 98810-0150', '1991-02-03'::date, 'Cônjuge', 'IBS9075', false, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008298', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Laura Pacheco Duarte', null, '2011-11-22'::date, 'Filho(a)', 'IBS9075', false, true, 'child'),
  ('c81295e3-9167-40b4-8524-000000008299', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Isis Pacheco Duarte', null, '2013-12-15'::date, 'Filho(a)', 'IBS9075', false, true, 'child'),
  ('c81295e3-9167-40b4-8524-000000008300', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Diego Duarte Fernandes', '(11) 98810-0151', '1983-10-28'::date, 'Representante Legal', 'IBS9076', true, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008301', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Heloísa Fernandes Duarte', '(11) 98810-0152', '1986-04-16'::date, 'Cônjuge', 'IBS9076', false, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008302', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Arthur Duarte Fernandes', null, '2010-09-07'::date, 'Filho(a)', 'IBS9076', false, true, 'child'),
  ('c81295e3-9167-40b4-8524-000000008303', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Alice Duarte Fernandes', null, '2012-10-23'::date, 'Filho(a)', 'IBS9076', false, true, 'child'),
  ('c81295e3-9167-40b4-8524-000000008304', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Fábio Rodrigues Nogueira', '(11) 98810-0153', '1988-11-13'::date, 'Representante Legal', 'IBS9077', true, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008305', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Priscila Nogueira Rodrigues', '(11) 98810-0154', '1991-03-07'::date, 'Cônjuge', 'IBS9077', false, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008306', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Manuela Rodrigues Nogueira', null, '2011-04-26'::date, 'Filho(a)', 'IBS9077', false, true, 'child'),
  ('c81295e3-9167-40b4-8524-000000008307', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Maria Clara Rodrigues Nogueira', null, '2014-11-01'::date, 'Filho(a)', 'IBS9077', false, true, 'child'),
  ('c81295e3-9167-40b4-8524-000000008308', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Bruno Mendes Machado', '(11) 98810-0155', '1982-11-14'::date, 'Representante Legal', 'IBS9078', true, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008309', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Gabriela Machado Mendes', '(11) 98810-0156', '1983-05-23'::date, 'Cônjuge', 'IBS9078', false, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008310', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Benício Mendes Machado', null, '2010-12-21'::date, 'Filho(a)', 'IBS9078', false, true, 'child'),
  ('c81295e3-9167-40b4-8524-000000008311', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Manuela Mendes Machado', null, '2014-06-10'::date, 'Filho(a)', 'IBS9078', false, true, 'child'),
  ('c81295e3-9167-40b4-8524-000000008312', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Murilo Pinto Nogueira', '(11) 98810-0157', '1983-09-11'::date, 'Representante Legal', 'IBS9079', true, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008313', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Sabrina Nogueira Pinto', '(11) 98810-0158', '1985-04-04'::date, 'Cônjuge', 'IBS9079', false, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008314', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Arthur Pinto Nogueira', null, '2010-11-17'::date, 'Filho(a)', 'IBS9079', false, true, 'child'),
  ('c81295e3-9167-40b4-8524-000000008315', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Maya Pinto Nogueira', null, '2014-06-16'::date, 'Filho(a)', 'IBS9079', false, true, 'child'),
  ('c81295e3-9167-40b4-8524-000000008316', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'João Oliveira Sampaio', '(11) 98810-0159', '1975-01-20'::date, 'Representante Legal', 'IBS9080', true, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008317', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Camila Sampaio Oliveira', '(11) 98810-0160', '1981-03-24'::date, 'Cônjuge', 'IBS9080', false, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008318', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Helena Oliveira Sampaio', null, '2010-06-25'::date, 'Filho(a)', 'IBS9080', false, true, 'child'),
  ('c81295e3-9167-40b4-8524-000000008319', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Miguel Oliveira Sampaio', null, '2014-01-13'::date, 'Filho(a)', 'IBS9080', false, true, 'child'),
  ('c81295e3-9167-40b4-8524-000000008320', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'César Ferreira Rocha', '(11) 98810-0161', '1989-11-16'::date, 'Representante Legal', 'IBS9081', true, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008321', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Tereza Rocha Ferreira', '(11) 98810-0162', '1993-10-24'::date, 'Cônjuge', 'IBS9081', false, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008322', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Isaac Ferreira Rocha', null, '2013-07-05'::date, 'Filho(a)', 'IBS9081', false, true, 'child'),
  ('c81295e3-9167-40b4-8524-000000008323', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Ravi Ferreira Rocha', null, '2017-01-10'::date, 'Filho(a)', 'IBS9081', false, true, 'child'),
  ('c81295e3-9167-40b4-8524-000000008324', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Henrique Neves Barbosa', '(11) 98810-0163', '1977-07-02'::date, 'Representante Legal', 'IBS9082', true, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008325', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Priscila Barbosa Neves', '(11) 98810-0164', '1981-08-27'::date, 'Cônjuge', 'IBS9082', false, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008326', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Isadora Neves Barbosa', null, '2010-10-27'::date, 'Filho(a)', 'IBS9082', false, true, 'child'),
  ('c81295e3-9167-40b4-8524-000000008327', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Gael Neves Barbosa', null, '2012-01-24'::date, 'Filho(a)', 'IBS9082', false, true, 'child'),
  ('c81295e3-9167-40b4-8524-000000008328', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Igor Queiroz Correia', '(11) 98810-0165', '1984-01-04'::date, 'Representante Legal', 'IBS9083', true, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008329', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Heloísa Correia Queiroz', '(11) 98810-0166', '1987-01-26'::date, 'Cônjuge', 'IBS9083', false, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008330', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Ravi Queiroz Correia', null, '2010-12-14'::date, 'Filho(a)', 'IBS9083', false, true, 'child'),
  ('c81295e3-9167-40b4-8524-000000008331', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Sophia Queiroz Correia', null, '2012-07-10'::date, 'Filho(a)', 'IBS9083', false, true, 'child'),
  ('c81295e3-9167-40b4-8524-000000008332', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Gustavo Ribeiro Farias', '(11) 98810-0167', '1988-05-28'::date, 'Representante Legal', 'IBS9084', true, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008333', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Juliana Farias Ribeiro', '(11) 98810-0168', '1988-07-10'::date, 'Cônjuge', 'IBS9084', false, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008334', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Lorena Ribeiro Farias', null, '2010-04-04'::date, 'Filho(a)', 'IBS9084', false, true, 'child'),
  ('c81295e3-9167-40b4-8524-000000008335', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Bernardo Ribeiro Farias', null, '2013-01-14'::date, 'Filho(a)', 'IBS9084', false, true, 'child'),
  ('c81295e3-9167-40b4-8524-000000008336', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Cristiano Cavalcanti Rocha', '(11) 98810-0169', '1976-01-11'::date, 'Representante Legal', 'IBS9085', true, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008337', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Cristina Rocha Cavalcanti', '(11) 98810-0170', '1981-10-13'::date, 'Cônjuge', 'IBS9085', false, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008338', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Isaac Cavalcanti Rocha', null, '2010-01-22'::date, 'Filho(a)', 'IBS9085', false, true, 'child'),
  ('c81295e3-9167-40b4-8524-000000008339', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Isaac Cavalcanti Sampaio', null, '2013-03-15'::date, 'Filho(a)', 'IBS9085', false, true, 'child'),
  ('c81295e3-9167-40b4-8524-000000008340', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Leandro Gomes Fernandes', '(11) 98810-0171', '1980-04-13'::date, 'Representante Legal', 'IBS9086', true, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008341', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Flávia Fernandes Gomes', '(11) 98810-0172', '1981-01-09'::date, 'Cônjuge', 'IBS9086', false, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008342', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Alice Gomes Fernandes', null, '2010-12-06'::date, 'Filho(a)', 'IBS9086', false, true, 'child'),
  ('c81295e3-9167-40b4-8524-000000008343', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Gael Gomes Fernandes', null, '2013-03-25'::date, 'Filho(a)', 'IBS9086', false, true, 'child'),
  ('c81295e3-9167-40b4-8524-000000008344', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Antônio Siqueira Barros', '(11) 98810-0173', '1983-05-22'::date, 'Representante Legal', 'IBS9087', true, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008345', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Jéssica Barros Siqueira', '(11) 98810-0174', '1985-08-09'::date, 'Cônjuge', 'IBS9087', false, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008346', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Benício Siqueira Barros', null, '2010-10-26'::date, 'Filho(a)', 'IBS9087', false, true, 'child'),
  ('c81295e3-9167-40b4-8524-000000008347', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Miguel Siqueira Barros', null, '2013-06-06'::date, 'Filho(a)', 'IBS9087', false, true, 'child'),
  ('c81295e3-9167-40b4-8524-000000008348', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Rodrigo Dias Rezende', '(11) 98810-0175', '1979-05-13'::date, 'Representante Legal', 'IBS9088', true, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008349', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Sônia Rezende Dias', '(11) 98810-0176', '1979-07-03'::date, 'Cônjuge', 'IBS9088', false, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008350', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Isadora Dias Rezende', null, '2010-02-03'::date, 'Filho(a)', 'IBS9088', false, true, 'child'),
  ('c81295e3-9167-40b4-8524-000000008351', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Miguel Dias Rezende', null, '2013-03-13'::date, 'Filho(a)', 'IBS9088', false, true, 'child'),
  ('c81295e3-9167-40b4-8524-000000008352', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Felipe Teixeira Macedo', '(11) 98810-0177', '1977-03-09'::date, 'Representante Legal', 'IBS9089', true, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008353', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Mariana Macedo Teixeira', '(11) 98810-0178', '1981-11-08'::date, 'Cônjuge', 'IBS9089', false, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008354', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Cecília Teixeira Macedo', null, '2010-03-05'::date, 'Filho(a)', 'IBS9089', false, true, 'child'),
  ('c81295e3-9167-40b4-8524-000000008355', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Lorena Teixeira Macedo', null, '2012-10-18'::date, 'Filho(a)', 'IBS9089', false, true, 'child'),
  ('c81295e3-9167-40b4-8524-000000008356', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Thiago Nunes Rocha', '(11) 98810-0179', '1990-10-18'::date, 'Representante Legal', 'IBS9090', true, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008357', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Amanda Rocha Nunes', '(11) 98810-0180', '1996-04-14'::date, 'Cônjuge', 'IBS9090', false, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008358', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Lorena Nunes Rocha', null, '2016-07-27'::date, 'Filho(a)', 'IBS9090', false, true, 'child'),
  ('c81295e3-9167-40b4-8524-000000008359', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Heitor Nunes Rocha', null, '2020-05-01'::date, 'Filho(a)', 'IBS9090', false, true, 'child'),
  ('c81295e3-9167-40b4-8524-000000008360', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Henrique Farias Rodrigues', '(11) 98810-0181', '1989-07-04'::date, 'Representante Legal', 'IBS9091', true, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008361', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Olivia Rodrigues Farias', '(11) 98810-0182', '1992-02-06'::date, 'Cônjuge', 'IBS9091', false, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008362', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Miguel Farias Rodrigues', null, '2012-04-25'::date, 'Filho(a)', 'IBS9091', false, true, 'child'),
  ('c81295e3-9167-40b4-8524-000000008363', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Theo Farias Rodrigues', null, '2016-12-26'::date, 'Filho(a)', 'IBS9091', false, true, 'child'),
  ('c81295e3-9167-40b4-8524-000000008364', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Ricardo Macedo Dias', '(11) 98810-0183', '1980-01-11'::date, 'Representante Legal', 'IBS9092', true, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008365', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Heloísa Dias Macedo', '(11) 98810-0184', '1982-07-10'::date, 'Cônjuge', 'IBS9092', false, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008366', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Cecília Macedo Dias', null, '2010-09-25'::date, 'Filho(a)', 'IBS9092', false, true, 'child'),
  ('c81295e3-9167-40b4-8524-000000008367', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Lorena Macedo Dias', null, '2013-02-27'::date, 'Filho(a)', 'IBS9092', false, true, 'child'),
  ('c81295e3-9167-40b4-8524-000000008368', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'César Leal Monteiro', '(11) 98810-0185', '1981-07-09'::date, 'Representante Legal', 'IBS9093', true, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008369', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Maria Monteiro Leal', '(11) 98810-0186', '1987-10-20'::date, 'Cônjuge', 'IBS9093', false, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008370', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Gael Leal Monteiro', null, '2010-09-17'::date, 'Filho(a)', 'IBS9093', false, true, 'child'),
  ('c81295e3-9167-40b4-8524-000000008371', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Caleb Leal Monteiro', null, '2012-07-23'::date, 'Filho(a)', 'IBS9093', false, true, 'child'),
  ('c81295e3-9167-40b4-8524-000000008372', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Alexandre Dias Macedo', '(11) 98810-0187', '1988-05-12'::date, 'Representante Legal', 'IBS9094', true, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008373', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Heloísa Macedo Dias', '(11) 98810-0188', '1991-08-07'::date, 'Cônjuge', 'IBS9094', false, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008374', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Manuela Dias Macedo', null, '2011-03-08'::date, 'Filho(a)', 'IBS9094', false, true, 'child'),
  ('c81295e3-9167-40b4-8524-000000008375', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Laura Dias Macedo', null, '2015-07-19'::date, 'Filho(a)', 'IBS9094', false, true, 'child'),
  ('c81295e3-9167-40b4-8524-000000008376', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Leandro Gomes Guimarães', '(11) 98810-0189', '1980-02-13'::date, 'Representante Legal', 'IBS9095', true, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008377', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Sabrina Guimarães Gomes', '(11) 98810-0190', '1985-09-19'::date, 'Cônjuge', 'IBS9095', false, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008378', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Valentina Gomes Guimarães', null, '2010-05-16'::date, 'Filho(a)', 'IBS9095', false, true, 'child'),
  ('c81295e3-9167-40b4-8524-000000008379', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Arthur Gomes Guimarães', null, '2012-08-12'::date, 'Filho(a)', 'IBS9095', false, true, 'child'),
  ('c81295e3-9167-40b4-8524-000000008380', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Carlos Gomes Queiroz', '(11) 98810-0191', '1984-04-10'::date, 'Representante Legal', 'IBS9096', true, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008381', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Lúcia Queiroz Gomes', '(11) 98810-0192', '1984-09-06'::date, 'Cônjuge', 'IBS9096', false, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008382', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Nicolas Gomes Queiroz', null, '2010-12-10'::date, 'Filho(a)', 'IBS9096', false, true, 'child'),
  ('c81295e3-9167-40b4-8524-000000008383', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Liz Gomes Queiroz', null, '2013-07-21'::date, 'Filho(a)', 'IBS9096', false, true, 'child'),
  ('c81295e3-9167-40b4-8524-000000008384', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Júlio Cardoso Monteiro', '(11) 98810-0193', '1984-08-06'::date, 'Representante Legal', 'IBS9097', true, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008385', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Olivia Monteiro Cardoso', '(11) 98810-0194', '1990-02-14'::date, 'Cônjuge', 'IBS9097', false, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008386', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Noah Cardoso Monteiro', null, '2010-11-10'::date, 'Filho(a)', 'IBS9097', false, true, 'child'),
  ('c81295e3-9167-40b4-8524-000000008387', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Alice Cardoso Monteiro', null, '2012-07-01'::date, 'Filho(a)', 'IBS9097', false, true, 'child'),
  ('c81295e3-9167-40b4-8524-000000008388', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Davi Farias Nogueira', '(11) 98810-0195', '1984-10-28'::date, 'Representante Legal', 'IBS9098', true, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008389', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Vanessa Nogueira Farias', '(11) 98810-0196', '1989-11-18'::date, 'Cônjuge', 'IBS9098', false, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008390', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Nicolas Farias Nogueira', null, '2010-03-15'::date, 'Filho(a)', 'IBS9098', false, true, 'child'),
  ('c81295e3-9167-40b4-8524-000000008391', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Theo Farias Nogueira', null, '2014-05-21'::date, 'Filho(a)', 'IBS9098', false, true, 'child'),
  ('c81295e3-9167-40b4-8524-000000008392', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Adriano Santos Cunha', '(11) 98810-0197', '1986-02-09'::date, 'Representante Legal', 'IBS9099', true, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008393', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Simone Cunha Santos', '(11) 98810-0198', '1989-10-06'::date, 'Cônjuge', 'IBS9099', false, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008394', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Isis Santos Cunha', null, '2010-10-22'::date, 'Filho(a)', 'IBS9099', false, true, 'child'),
  ('c81295e3-9167-40b4-8524-000000008395', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Arthur Santos Cunha', null, '2013-09-06'::date, 'Filho(a)', 'IBS9099', false, true, 'child'),
  ('c81295e3-9167-40b4-8524-000000008396', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Vitor Pinto Cardoso', '(11) 98810-0199', '1974-06-09'::date, 'Representante Legal', 'IBS9100', true, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008397', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Aline Cardoso Pinto', '(11) 98810-0200', '1974-12-03'::date, 'Cônjuge', 'IBS9100', false, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008398', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Miguel Pinto Cardoso', null, '2010-04-05'::date, 'Filho(a)', 'IBS9100', false, true, 'child'),
  ('c81295e3-9167-40b4-8524-000000008399', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Liz Pinto Cardoso', null, '2013-07-06'::date, 'Filho(a)', 'IBS9100', false, true, 'child'),
  ('c81295e3-9167-40b4-8524-000000008400', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'João Batista Rodrigues', '(11) 98810-0201', '1990-10-18'::date, 'Representante Legal', 'IBS9101', true, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008401', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Helena Rodrigues Batista', '(11) 98810-0202', '1990-09-20'::date, 'Cônjuge', 'IBS9101', false, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008402', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Samuel Batista Rodrigues', null, '2010-07-21'::date, 'Filho(a)', 'IBS9101', false, true, 'child'),
  ('c81295e3-9167-40b4-8524-000000008403', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Bernardo Batista Rodrigues', null, '2014-11-24'::date, 'Filho(a)', 'IBS9101', false, true, 'child'),
  ('c81295e3-9167-40b4-8524-000000008404', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Caio Araujo Castro', '(11) 98810-0203', '1996-12-10'::date, 'Representante Legal', 'IBS9102', true, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008405', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Lívia Castro Araujo', '(11) 98810-0204', '2000-07-24'::date, 'Cônjuge', 'IBS9102', false, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008406', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Samuel Araujo Castro', null, '2020-02-02'::date, 'Filho(a)', 'IBS9102', false, true, 'child'),
  ('c81295e3-9167-40b4-8524-000000008407', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Pedro Siqueira Araujo', '(11) 98810-0205', '1996-02-24'::date, 'Representante Legal', 'IBS9103', true, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008408', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Raquel Araujo Siqueira', '(11) 98810-0206', '2000-04-01'::date, 'Cônjuge', 'IBS9103', false, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008409', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Sophia Siqueira Araujo', null, '2020-09-02'::date, 'Filho(a)', 'IBS9103', false, true, 'child'),
  ('c81295e3-9167-40b4-8524-000000008410', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Lucas Lima Dias', '(11) 98810-0207', '1996-04-02'::date, 'Representante Legal', 'IBS9104', true, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008411', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Júlia Dias Lima', '(11) 98810-0208', '1998-12-02'::date, 'Cônjuge', 'IBS9104', false, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008412', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Ravi Lima Dias', null, '2018-07-22'::date, 'Filho(a)', 'IBS9104', false, true, 'child'),
  ('c81295e3-9167-40b4-8524-000000008413', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Pedro Rezende Almeida', '(11) 98810-0209', '1995-06-04'::date, 'Representante Legal', 'IBS9105', true, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008414', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Olivia Almeida Rezende', '(11) 98810-0210', '1996-09-17'::date, 'Cônjuge', 'IBS9105', false, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008415', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Gael Rezende Almeida', null, '2016-12-23'::date, 'Filho(a)', 'IBS9105', false, true, 'child'),
  ('c81295e3-9167-40b4-8524-000000008416', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Heitor Campos Lima', '(11) 98810-0211', '1990-04-12'::date, 'Representante Legal', 'IBS9106', true, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008417', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Mariana Lima Campos', '(11) 98810-0212', '1992-06-15'::date, 'Cônjuge', 'IBS9106', false, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008418', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Cecília Campos Lima', null, '2012-02-03'::date, 'Filho(a)', 'IBS9106', false, true, 'child'),
  ('c81295e3-9167-40b4-8524-000000008419', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Antônio Dias Pinto', '(11) 98810-0213', '1991-01-24'::date, 'Representante Legal', 'IBS9107', true, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008420', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Mariana Pinto Dias', '(11) 98810-0214', '1995-02-28'::date, 'Cônjuge', 'IBS9107', false, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008421', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Sophia Dias Pinto', null, '2015-05-01'::date, 'Filho(a)', 'IBS9107', false, true, 'child'),
  ('c81295e3-9167-40b4-8524-000000008422', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Gabriel Pereira Batista', '(11) 98810-0215', '1999-11-05'::date, 'Representante Legal', 'IBS9108', true, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008423', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Gabriela Batista Pereira', '(11) 98810-0216', '1999-02-16'::date, 'Cônjuge', 'IBS9108', false, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008424', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Arthur Pereira Batista', null, '2019-12-23'::date, 'Filho(a)', 'IBS9108', false, true, 'child'),
  ('c81295e3-9167-40b4-8524-000000008425', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Carlos Rocha Leal', '(11) 98810-0217', '1998-06-28'::date, 'Representante Legal', 'IBS9109', true, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008426', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Heloísa Leal Rocha', '(11) 98810-0218', '1998-03-19'::date, 'Cônjuge', 'IBS9109', false, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008427', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Theo Rocha Leal', null, '2018-06-03'::date, 'Filho(a)', 'IBS9109', false, true, 'child'),
  ('c81295e3-9167-40b4-8524-000000008428', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Vinícius Dias Farias', '(11) 98810-0219', '1991-04-02'::date, 'Representante Legal', 'IBS9110', true, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008429', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Raquel Farias Dias', '(11) 98810-0220', '1995-02-14'::date, 'Cônjuge', 'IBS9110', false, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008430', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Bernardo Dias Farias', null, '2015-05-08'::date, 'Filho(a)', 'IBS9110', false, true, 'child'),
  ('c81295e3-9167-40b4-8524-000000008431', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Fábio Tavares Barros', '(11) 98810-0221', '1993-06-08'::date, 'Representante Legal', 'IBS9111', true, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008432', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Amanda Barros Tavares', '(11) 98810-0222', '1995-06-26'::date, 'Cônjuge', 'IBS9111', false, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008433', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Bernardo Tavares Barros', null, '2015-01-17'::date, 'Filho(a)', 'IBS9111', false, true, 'child'),
  ('c81295e3-9167-40b4-8524-000000008434', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Wagner Teixeira Fernandes', '(11) 98810-0223', '1991-05-19'::date, 'Representante Legal', 'IBS9112', true, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008435', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Heloísa Fernandes Teixeira', '(11) 98810-0224', '1994-11-16'::date, 'Cônjuge', 'IBS9112', false, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008436', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Lorena Teixeira Fernandes', null, '2014-04-23'::date, 'Filho(a)', 'IBS9112', false, true, 'child'),
  ('c81295e3-9167-40b4-8524-000000008437', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Caio Queiroz Lima', '(11) 98810-0225', '1993-10-12'::date, 'Representante Legal', 'IBS9113', true, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008438', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Sônia Lima Queiroz', '(11) 98810-0226', '1995-12-11'::date, 'Cônjuge', 'IBS9113', false, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008439', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Maya Queiroz Lima', null, '2015-01-18'::date, 'Filho(a)', 'IBS9113', false, true, 'child'),
  ('c81295e3-9167-40b4-8524-000000008440', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Murilo Moreira Gomes', '(11) 98810-0227', '1997-07-14'::date, 'Representante Legal', 'IBS9114', true, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008441', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Lívia Gomes Moreira', '(11) 98810-0228', '1999-06-24'::date, 'Cônjuge', 'IBS9114', false, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008442', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Davi Moreira Gomes', null, '2019-06-06'::date, 'Filho(a)', 'IBS9114', false, true, 'child'),
  ('c81295e3-9167-40b4-8524-000000008443', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Rogério Cunha Macedo', '(11) 98810-0229', '2000-06-09'::date, 'Representante Legal', 'IBS9115', true, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008444', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Daniela Macedo Cunha', '(11) 98810-0230', '2001-09-26'::date, 'Cônjuge', 'IBS9115', false, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008445', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Isis Cunha Macedo', null, '2021-09-06'::date, 'Filho(a)', 'IBS9115', false, true, 'child'),
  ('c81295e3-9167-40b4-8524-000000008446', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Rafael Pinto Vieira', '(11) 98810-0231', '1993-10-10'::date, 'Representante Legal', 'IBS9116', true, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008447', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Heloísa Vieira Pinto', '(11) 98810-0232', '1996-09-05'::date, 'Cônjuge', 'IBS9116', false, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008448', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Helena Pinto Vieira', null, '2016-03-01'::date, 'Filho(a)', 'IBS9116', false, true, 'child'),
  ('c81295e3-9167-40b4-8524-000000008449', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Thiago Rocha Farias', '(11) 98810-0233', '1993-11-07'::date, 'Representante Legal', 'IBS9117', true, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008450', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Simone Farias Rocha', '(11) 98810-0234', '1995-06-11'::date, 'Cônjuge', 'IBS9117', false, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008451', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Caleb Rocha Farias', null, '2015-02-17'::date, 'Filho(a)', 'IBS9117', false, true, 'child'),
  ('c81295e3-9167-40b4-8524-000000008452', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Davi Santos Machado', '(11) 98810-0235', '1999-07-23'::date, 'Representante Legal', 'IBS9118', true, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008453', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Letícia Machado Santos', '(11) 98810-0236', '2000-01-23'::date, 'Cônjuge', 'IBS9118', false, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008454', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Laura Santos Machado', null, '2020-10-25'::date, 'Filho(a)', 'IBS9118', false, true, 'child'),
  ('c81295e3-9167-40b4-8524-000000008455', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'José Peixoto Barros', '(11) 98810-0237', '1995-06-05'::date, 'Representante Legal', 'IBS9119', true, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008456', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Karina Barros Peixoto', '(11) 98810-0238', '1997-12-08'::date, 'Cônjuge', 'IBS9119', false, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008457', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'João Pedro Peixoto Barros', null, '2017-03-27'::date, 'Filho(a)', 'IBS9119', false, true, 'child'),
  ('c81295e3-9167-40b4-8524-000000008458', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Lucas Nunes Guimarães', '(11) 98810-0239', '1992-04-12'::date, 'Representante Legal', 'IBS9120', true, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008459', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Amanda Guimarães Nunes', '(11) 98810-0240', '1993-02-27'::date, 'Cônjuge', 'IBS9120', false, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008460', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Helena Nunes Guimarães', null, '2013-02-05'::date, 'Filho(a)', 'IBS9120', false, true, 'child'),
  ('c81295e3-9167-40b4-8524-000000008461', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Gabriel Farias Barros', '(11) 98810-0241', '1999-02-27'::date, 'Representante Legal', 'IBS9121', true, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008462', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Carolina Barros Farias', '(11) 98810-0242', '2002-06-16'::date, 'Cônjuge', 'IBS9121', false, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008463', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Lorena Farias Barros', null, '2022-10-10'::date, 'Filho(a)', 'IBS9121', false, true, 'child'),
  ('c81295e3-9167-40b4-8524-000000008464', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Felipe Carvalho Duarte', '(11) 98810-0243', '1991-09-24'::date, 'Representante Legal', 'IBS9122', true, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008465', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Mônica Duarte Carvalho', '(11) 98810-0244', '1991-04-18'::date, 'Cônjuge', 'IBS9122', false, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008466', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Sophia Carvalho Monteiro', null, '2011-01-18'::date, 'Filho(a)', 'IBS9122', false, true, 'child'),
  ('c81295e3-9167-40b4-8524-000000008467', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Samuel Macedo Peixoto', '(11) 98810-0245', '2000-05-13'::date, 'Representante Legal', 'IBS9123', true, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008468', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Raquel Peixoto Macedo', '(11) 98810-0246', '2000-11-13'::date, 'Cônjuge', 'IBS9123', false, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008469', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Liz Macedo Peixoto', null, '2020-10-19'::date, 'Filho(a)', 'IBS9123', false, true, 'child'),
  ('c81295e3-9167-40b4-8524-000000008470', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Fábio Sampaio Pacheco', '(11) 98810-0247', '1992-03-12'::date, 'Representante Legal', 'IBS9124', true, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008471', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Vanessa Pacheco Sampaio', '(11) 98810-0248', '1994-06-06'::date, 'Cônjuge', 'IBS9124', false, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008472', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Miguel Sampaio Pacheco', null, '2014-10-04'::date, 'Filho(a)', 'IBS9124', false, true, 'child'),
  ('c81295e3-9167-40b4-8524-000000008473', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Henrique Dias Cavalcanti', '(11) 98810-0249', '1994-07-08'::date, 'Representante Legal', 'IBS9125', true, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008474', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Débora Cavalcanti Dias', '(11) 98810-0250', '1997-01-07'::date, 'Cônjuge', 'IBS9125', false, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008475', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Miguel Dias Cavalcanti', null, '2017-12-28'::date, 'Filho(a)', 'IBS9125', false, true, 'child'),
  ('c81295e3-9167-40b4-8524-000000008476', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Samuel Campos Barbosa', '(11) 98810-0251', '1997-07-03'::date, 'Representante Legal', 'IBS9126', true, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008477', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Vanessa Barbosa Campos', '(11) 98810-0252', '1998-02-04'::date, 'Cônjuge', 'IBS9126', false, true, 'member'),
  ('c81295e3-9167-40b4-8524-000000008478', '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Alice Campos Barbosa', null, '2018-08-09'::date, 'Filho(a)', 'IBS9126', false, true, 'child');

insert into public.profile_igreja_vinculos (profile_id, tenant_id, is_primary, is_active, membership_status)
select p.id, '81295e39-9167-40b4-a524-702439905e75'::uuid, true, true, 'Ativo'
  from public.profiles p
 where p.family_id ~ '^IBS9[0-9]{3}$'
on conflict (profile_id, tenant_id) do update set is_active = true, membership_status = 'Ativo';

insert into public.profile_access_roles (profile_id, role_id, tenant_id, granted_by_profile_id)
select x.profile_id, r.id, '81295e39-9167-40b4-a524-702439905e75'::uuid, '04b919ba-38b4-4fe5-a371-2e98e9acbc0d'::uuid
  from (values
    ('c81295e3-9167-40b4-8524-000000000001'::uuid, 'pastoral'),
    ('c81295e3-9167-40b4-8524-000000000002'::uuid, 'member'),
    ('c81295e3-9167-40b4-8524-000000000005'::uuid, 'pastoral'),
    ('c81295e3-9167-40b4-8524-000000000006'::uuid, 'member'),
    ('c81295e3-9167-40b4-8524-000000000009'::uuid, 'member'),
    ('c81295e3-9167-40b4-8524-000000000009'::uuid, 'secretaria'),
    ('c81295e3-9167-40b4-8524-000000000010'::uuid, 'member'),
    ('c81295e3-9167-40b4-8524-000000000013'::uuid, 'member'),
    ('c81295e3-9167-40b4-8524-000000000013'::uuid, 'tesoureiro'),
    ('c81295e3-9167-40b4-8524-000000000014'::uuid, 'member'),
    ('c81295e3-9167-40b4-8524-000000000017'::uuid, 'member'),
    ('c81295e3-9167-40b4-8524-000000000017'::uuid, 'family_acceptor'),
    ('c81295e3-9167-40b4-8524-000000000018'::uuid, 'member'),
    ('c81295e3-9167-40b4-8524-000000000021'::uuid, 'member'),
    ('c81295e3-9167-40b4-8524-000000000022'::uuid, 'member'),
    ('c81295e3-9167-40b4-8524-000000000025'::uuid, 'member'),
    ('c81295e3-9167-40b4-8524-000000000026'::uuid, 'member'),
    ('c81295e3-9167-40b4-8524-000000000029'::uuid, 'member'),
    ('c81295e3-9167-40b4-8524-000000000030'::uuid, 'member'),
    ('c81295e3-9167-40b4-8524-000000000033'::uuid, 'member'),
    ('c81295e3-9167-40b4-8524-000000000034'::uuid, 'member'),
    ('c81295e3-9167-40b4-8524-000000000037'::uuid, 'member'),
    ('c81295e3-9167-40b4-8524-000000000038'::uuid, 'member'),
    ('c81295e3-9167-40b4-8524-000000000041'::uuid, 'member'),
    ('c81295e3-9167-40b4-8524-000000000042'::uuid, 'member'),
    ('c81295e3-9167-40b4-8524-000000000045'::uuid, 'member'),
    ('c81295e3-9167-40b4-8524-000000000046'::uuid, 'member'),
    ('c81295e3-9167-40b4-8524-000000000049'::uuid, 'member'),
    ('c81295e3-9167-40b4-8524-000000000050'::uuid, 'member'),
    ('c81295e3-9167-40b4-8524-000000000053'::uuid, 'member'),
    ('c81295e3-9167-40b4-8524-000000000054'::uuid, 'member'),
    ('c81295e3-9167-40b4-8524-000000000057'::uuid, 'member'),
    ('c81295e3-9167-40b4-8524-000000000058'::uuid, 'member'),
    ('c81295e3-9167-40b4-8524-000000000061'::uuid, 'member'),
    ('c81295e3-9167-40b4-8524-000000000062'::uuid, 'member'),
    ('c81295e3-9167-40b4-8524-000000000065'::uuid, 'member'),
    ('c81295e3-9167-40b4-8524-000000000066'::uuid, 'member'),
    ('c81295e3-9167-40b4-8524-000000000069'::uuid, 'member'),
    ('c81295e3-9167-40b4-8524-000000000070'::uuid, 'member'),
    ('c81295e3-9167-40b4-8524-000000000073'::uuid, 'member'),
    ('c81295e3-9167-40b4-8524-000000000074'::uuid, 'member'),
    ('c81295e3-9167-40b4-8524-000000000077'::uuid, 'member'),
    ('c81295e3-9167-40b4-8524-000000000078'::uuid, 'member'),
    ('c81295e3-9167-40b4-8524-000000000081'::uuid, 'member'),
    ('c81295e3-9167-40b4-8524-000000000082'::uuid, 'member'),
    ('c81295e3-9167-40b4-8524-000000000085'::uuid, 'member'),
    ('c81295e3-9167-40b4-8524-000000000086'::uuid, 'member'),
    ('c81295e3-9167-40b4-8524-000000000089'::uuid, 'member'),
    ('c81295e3-9167-40b4-8524-000000000090'::uuid, 'member'),
    ('c81295e3-9167-40b4-8524-000000000093'::uuid, 'member'),
    ('c81295e3-9167-40b4-8524-000000000094'::uuid, 'member'),
    ('c81295e3-9167-40b4-8524-000000000097'::uuid, 'member'),
    ('c81295e3-9167-40b4-8524-000000000098'::uuid, 'member'),
    ('c81295e3-9167-40b4-8524-000000000101'::uuid, 'member'),
    ('c81295e3-9167-40b4-8524-000000000102'::uuid, 'member'),
    ('c81295e3-9167-40b4-8524-000000000105'::uuid, 'member'),
    ('c81295e3-9167-40b4-8524-000000000106'::uuid, 'member'),
    ('c81295e3-9167-40b4-8524-000000000109'::uuid, 'member'),
    ('c81295e3-9167-40b4-8524-000000000110'::uuid, 'member'),
    ('c81295e3-9167-40b4-8524-000000000113'::uuid, 'member'),
    ('c81295e3-9167-40b4-8524-000000000114'::uuid, 'member'),
    ('c81295e3-9167-40b4-8524-000000000117'::uuid, 'member'),
    ('c81295e3-9167-40b4-8524-000000000118'::uuid, 'member'),
    ('c81295e3-9167-40b4-8524-000000000121'::uuid, 'member'),
    ('c81295e3-9167-40b4-8524-000000000122'::uuid, 'member'),
    ('c81295e3-9167-40b4-8524-000000000125'::uuid, 'member'),
    ('c81295e3-9167-40b4-8524-000000000126'::uuid, 'member'),
    ('c81295e3-9167-40b4-8524-000000000129'::uuid, 'member'),
    ('c81295e3-9167-40b4-8524-000000000130'::uuid, 'member'),
    ('c81295e3-9167-40b4-8524-000000000133'::uuid, 'member'),
    ('c81295e3-9167-40b4-8524-000000000134'::uuid, 'member'),
    ('c81295e3-9167-40b4-8524-000000000137'::uuid, 'member'),
    ('c81295e3-9167-40b4-8524-000000000138'::uuid, 'member'),
    ('c81295e3-9167-40b4-8524-000000000141'::uuid, 'member'),
    ('c81295e3-9167-40b4-8524-000000000142'::uuid, 'member'),
    ('c81295e3-9167-40b4-8524-000000000145'::uuid, 'member'),
    ('c81295e3-9167-40b4-8524-000000000146'::uuid, 'member'),
    ('c81295e3-9167-40b4-8524-000000000149'::uuid, 'member'),
    ('c81295e3-9167-40b4-8524-000000000150'::uuid, 'member'),
    ('c81295e3-9167-40b4-8524-000000000153'::uuid, 'member'),
    ('c81295e3-9167-40b4-8524-000000000154'::uuid, 'member'),
    ('c81295e3-9167-40b4-8524-000000000157'::uuid, 'member'),
    ('c81295e3-9167-40b4-8524-000000000158'::uuid, 'member'),
    ('c81295e3-9167-40b4-8524-000000000161'::uuid, 'member'),
    ('c81295e3-9167-40b4-8524-000000000162'::uuid, 'member'),
    ('c81295e3-9167-40b4-8524-000000000165'::uuid, 'member'),
    ('c81295e3-9167-40b4-8524-000000000166'::uuid, 'member'),
    ('c81295e3-9167-40b4-8524-000000000169'::uuid, 'member'),
    ('c81295e3-9167-40b4-8524-000000000170'::uuid, 'member'),
    ('c81295e3-9167-40b4-8524-000000000173'::uuid, 'member'),
    ('c81295e3-9167-40b4-8524-000000000174'::uuid, 'member'),
    ('c81295e3-9167-40b4-8524-000000000177'::uuid, 'member'),
    ('c81295e3-9167-40b4-8524-000000000178'::uuid, 'member'),
    ('c81295e3-9167-40b4-8524-000000000181'::uuid, 'member'),
    ('c81295e3-9167-40b4-8524-000000000182'::uuid, 'member'),
    ('c81295e3-9167-40b4-8524-000000000185'::uuid, 'member'),
    ('c81295e3-9167-40b4-8524-000000000186'::uuid, 'member'),
    ('c81295e3-9167-40b4-8524-000000000189'::uuid, 'member'),
    ('c81295e3-9167-40b4-8524-000000000190'::uuid, 'member'),
    ('c81295e3-9167-40b4-8524-000000000193'::uuid, 'member'),
    ('c81295e3-9167-40b4-8524-000000000194'::uuid, 'member'),
    ('c81295e3-9167-40b4-8524-000000000197'::uuid, 'member'),
    ('c81295e3-9167-40b4-8524-000000000198'::uuid, 'member'),
    ('c81295e3-9167-40b4-8524-000000000201'::uuid, 'member'),
    ('c81295e3-9167-40b4-8524-000000000202'::uuid, 'member'),
    ('c81295e3-9167-40b4-8524-000000000205'::uuid, 'congregado'),
    ('c81295e3-9167-40b4-8524-000000000206'::uuid, 'congregado'),
    ('c81295e3-9167-40b4-8524-000000000209'::uuid, 'congregado'),
    ('c81295e3-9167-40b4-8524-000000000210'::uuid, 'congregado'),
    ('c81295e3-9167-40b4-8524-000000000213'::uuid, 'congregado'),
    ('c81295e3-9167-40b4-8524-000000000214'::uuid, 'congregado'),
    ('c81295e3-9167-40b4-8524-000000000217'::uuid, 'congregado'),
    ('c81295e3-9167-40b4-8524-000000000218'::uuid, 'congregado'),
    ('c81295e3-9167-40b4-8524-000000000221'::uuid, 'congregado'),
    ('c81295e3-9167-40b4-8524-000000000222'::uuid, 'congregado'),
    ('c81295e3-9167-40b4-8524-000000000225'::uuid, 'congregado'),
    ('c81295e3-9167-40b4-8524-000000000226'::uuid, 'congregado'),
    ('c81295e3-9167-40b4-8524-000000000229'::uuid, 'congregado'),
    ('c81295e3-9167-40b4-8524-000000000230'::uuid, 'congregado'),
    ('c81295e3-9167-40b4-8524-000000000233'::uuid, 'congregado'),
    ('c81295e3-9167-40b4-8524-000000000234'::uuid, 'congregado'),
    ('c81295e3-9167-40b4-8524-000000000237'::uuid, 'congregado'),
    ('c81295e3-9167-40b4-8524-000000000238'::uuid, 'congregado'),
    ('c81295e3-9167-40b4-8524-000000000241'::uuid, 'congregado'),
    ('c81295e3-9167-40b4-8524-000000000242'::uuid, 'congregado'),
    ('c81295e3-9167-40b4-8524-000000000245'::uuid, 'congregado'),
    ('c81295e3-9167-40b4-8524-000000000246'::uuid, 'congregado'),
    ('c81295e3-9167-40b4-8524-000000000249'::uuid, 'congregado'),
    ('c81295e3-9167-40b4-8524-000000000250'::uuid, 'congregado'),
    ('c81295e3-9167-40b4-8524-000000000253'::uuid, 'congregado'),
    ('c81295e3-9167-40b4-8524-000000000254'::uuid, 'congregado'),
    ('c81295e3-9167-40b4-8524-000000000257'::uuid, 'congregado'),
    ('c81295e3-9167-40b4-8524-000000000258'::uuid, 'congregado'),
    ('c81295e3-9167-40b4-8524-000000000261'::uuid, 'congregado'),
    ('c81295e3-9167-40b4-8524-000000000262'::uuid, 'congregado'),
    ('c81295e3-9167-40b4-8524-000000000265'::uuid, 'congregado'),
    ('c81295e3-9167-40b4-8524-000000000266'::uuid, 'congregado'),
    ('c81295e3-9167-40b4-8524-000000000269'::uuid, 'congregado'),
    ('c81295e3-9167-40b4-8524-000000000270'::uuid, 'congregado'),
    ('c81295e3-9167-40b4-8524-000000000273'::uuid, 'congregado'),
    ('c81295e3-9167-40b4-8524-000000000274'::uuid, 'congregado'),
    ('c81295e3-9167-40b4-8524-000000000277'::uuid, 'congregado'),
    ('c81295e3-9167-40b4-8524-000000000278'::uuid, 'congregado'),
    ('c81295e3-9167-40b4-8524-000000000281'::uuid, 'congregado'),
    ('c81295e3-9167-40b4-8524-000000000282'::uuid, 'congregado'),
    ('c81295e3-9167-40b4-8524-000000000285'::uuid, 'congregado'),
    ('c81295e3-9167-40b4-8524-000000000286'::uuid, 'congregado'),
    ('c81295e3-9167-40b4-8524-000000000289'::uuid, 'congregado'),
    ('c81295e3-9167-40b4-8524-000000000290'::uuid, 'congregado'),
    ('c81295e3-9167-40b4-8524-000000000293'::uuid, 'congregado'),
    ('c81295e3-9167-40b4-8524-000000000294'::uuid, 'congregado'),
    ('c81295e3-9167-40b4-8524-000000000297'::uuid, 'congregado'),
    ('c81295e3-9167-40b4-8524-000000000298'::uuid, 'congregado'),
    ('c81295e3-9167-40b4-8524-000000000301'::uuid, 'congregado'),
    ('c81295e3-9167-40b4-8524-000000000302'::uuid, 'congregado'),
    ('c81295e3-9167-40b4-8524-000000000305'::uuid, 'congregado'),
    ('c81295e3-9167-40b4-8524-000000000306'::uuid, 'congregado'),
    ('c81295e3-9167-40b4-8524-000000000309'::uuid, 'congregado'),
    ('c81295e3-9167-40b4-8524-000000000310'::uuid, 'congregado'),
    ('c81295e3-9167-40b4-8524-000000000313'::uuid, 'congregado'),
    ('c81295e3-9167-40b4-8524-000000000314'::uuid, 'congregado'),
    ('c81295e3-9167-40b4-8524-000000000317'::uuid, 'congregado'),
    ('c81295e3-9167-40b4-8524-000000000318'::uuid, 'congregado'),
    ('c81295e3-9167-40b4-8524-000000000321'::uuid, 'congregado'),
    ('c81295e3-9167-40b4-8524-000000000322'::uuid, 'congregado'),
    ('c81295e3-9167-40b4-8524-000000000325'::uuid, 'congregado'),
    ('c81295e3-9167-40b4-8524-000000000326'::uuid, 'congregado'),
    ('c81295e3-9167-40b4-8524-000000000329'::uuid, 'congregado'),
    ('c81295e3-9167-40b4-8524-000000000330'::uuid, 'congregado'),
    ('c81295e3-9167-40b4-8524-000000000333'::uuid, 'congregado'),
    ('c81295e3-9167-40b4-8524-000000000334'::uuid, 'congregado'),
    ('c81295e3-9167-40b4-8524-000000000337'::uuid, 'congregado'),
    ('c81295e3-9167-40b4-8524-000000000338'::uuid, 'congregado'),
    ('c81295e3-9167-40b4-8524-000000000341'::uuid, 'congregado'),
    ('c81295e3-9167-40b4-8524-000000000342'::uuid, 'congregado'),
    ('c81295e3-9167-40b4-8524-000000000345'::uuid, 'congregado'),
    ('c81295e3-9167-40b4-8524-000000000346'::uuid, 'congregado'),
    ('c81295e3-9167-40b4-8524-000000000349'::uuid, 'congregado'),
    ('c81295e3-9167-40b4-8524-000000000350'::uuid, 'congregado'),
    ('c81295e3-9167-40b4-8524-000000000353'::uuid, 'congregado'),
    ('c81295e3-9167-40b4-8524-000000000354'::uuid, 'congregado'),
    ('c81295e3-9167-40b4-8524-000000000357'::uuid, 'congregado'),
    ('c81295e3-9167-40b4-8524-000000000358'::uuid, 'congregado'),
    ('c81295e3-9167-40b4-8524-000000000361'::uuid, 'congregado'),
    ('c81295e3-9167-40b4-8524-000000000362'::uuid, 'congregado'),
    ('c81295e3-9167-40b4-8524-000000000365'::uuid, 'congregado'),
    ('c81295e3-9167-40b4-8524-000000000366'::uuid, 'congregado'),
    ('c81295e3-9167-40b4-8524-000000000369'::uuid, 'congregado'),
    ('c81295e3-9167-40b4-8524-000000000370'::uuid, 'congregado'),
    ('c81295e3-9167-40b4-8524-000000000373'::uuid, 'congregado'),
    ('c81295e3-9167-40b4-8524-000000000374'::uuid, 'congregado'),
    ('c81295e3-9167-40b4-8524-000000000377'::uuid, 'congregado'),
    ('c81295e3-9167-40b4-8524-000000000378'::uuid, 'congregado'),
    ('c81295e3-9167-40b4-8524-000000000381'::uuid, 'congregado'),
    ('c81295e3-9167-40b4-8524-000000000382'::uuid, 'congregado'),
    ('c81295e3-9167-40b4-8524-000000000385'::uuid, 'congregado'),
    ('c81295e3-9167-40b4-8524-000000000386'::uuid, 'congregado'),
    ('c81295e3-9167-40b4-8524-000000000389'::uuid, 'congregado'),
    ('c81295e3-9167-40b4-8524-000000000390'::uuid, 'congregado'),
    ('c81295e3-9167-40b4-8524-000000000393'::uuid, 'congregado'),
    ('c81295e3-9167-40b4-8524-000000000394'::uuid, 'congregado'),
    ('c81295e3-9167-40b4-8524-000000000397'::uuid, 'congregado'),
    ('c81295e3-9167-40b4-8524-000000000398'::uuid, 'congregado'),
    ('c81295e3-9167-40b4-8524-000000000401'::uuid, 'congregado'),
    ('c81295e3-9167-40b4-8524-000000000402'::uuid, 'congregado'),
    ('c81295e3-9167-40b4-8524-000000000405'::uuid, 'visitantes'),
    ('c81295e3-9167-40b4-8524-000000000406'::uuid, 'visitantes'),
    ('c81295e3-9167-40b4-8524-000000000408'::uuid, 'visitantes'),
    ('c81295e3-9167-40b4-8524-000000000409'::uuid, 'visitantes'),
    ('c81295e3-9167-40b4-8524-000000000411'::uuid, 'visitantes'),
    ('c81295e3-9167-40b4-8524-000000000412'::uuid, 'visitantes'),
    ('c81295e3-9167-40b4-8524-000000000414'::uuid, 'visitantes'),
    ('c81295e3-9167-40b4-8524-000000000415'::uuid, 'visitantes'),
    ('c81295e3-9167-40b4-8524-000000000417'::uuid, 'visitantes'),
    ('c81295e3-9167-40b4-8524-000000000418'::uuid, 'visitantes'),
    ('c81295e3-9167-40b4-8524-000000000420'::uuid, 'visitantes'),
    ('c81295e3-9167-40b4-8524-000000000421'::uuid, 'visitantes'),
    ('c81295e3-9167-40b4-8524-000000000423'::uuid, 'visitantes'),
    ('c81295e3-9167-40b4-8524-000000000424'::uuid, 'visitantes'),
    ('c81295e3-9167-40b4-8524-000000000426'::uuid, 'visitantes'),
    ('c81295e3-9167-40b4-8524-000000000427'::uuid, 'visitantes'),
    ('c81295e3-9167-40b4-8524-000000000429'::uuid, 'visitantes'),
    ('c81295e3-9167-40b4-8524-000000000430'::uuid, 'visitantes'),
    ('c81295e3-9167-40b4-8524-000000000432'::uuid, 'visitantes'),
    ('c81295e3-9167-40b4-8524-000000000433'::uuid, 'visitantes'),
    ('c81295e3-9167-40b4-8524-000000000435'::uuid, 'visitantes'),
    ('c81295e3-9167-40b4-8524-000000000436'::uuid, 'visitantes'),
    ('c81295e3-9167-40b4-8524-000000000438'::uuid, 'visitantes'),
    ('c81295e3-9167-40b4-8524-000000000439'::uuid, 'visitantes'),
    ('c81295e3-9167-40b4-8524-000000000441'::uuid, 'visitantes'),
    ('c81295e3-9167-40b4-8524-000000000442'::uuid, 'visitantes'),
    ('c81295e3-9167-40b4-8524-000000000444'::uuid, 'visitantes'),
    ('c81295e3-9167-40b4-8524-000000000445'::uuid, 'visitantes'),
    ('c81295e3-9167-40b4-8524-000000000447'::uuid, 'visitantes'),
    ('c81295e3-9167-40b4-8524-000000000448'::uuid, 'visitantes'),
    ('c81295e3-9167-40b4-8524-000000000450'::uuid, 'visitantes'),
    ('c81295e3-9167-40b4-8524-000000000451'::uuid, 'visitantes'),
    ('c81295e3-9167-40b4-8524-000000000453'::uuid, 'visitantes'),
    ('c81295e3-9167-40b4-8524-000000000454'::uuid, 'visitantes'),
    ('c81295e3-9167-40b4-8524-000000000456'::uuid, 'visitantes'),
    ('c81295e3-9167-40b4-8524-000000000457'::uuid, 'visitantes'),
    ('c81295e3-9167-40b4-8524-000000000459'::uuid, 'visitantes'),
    ('c81295e3-9167-40b4-8524-000000000460'::uuid, 'visitantes'),
    ('c81295e3-9167-40b4-8524-000000000462'::uuid, 'visitantes'),
    ('c81295e3-9167-40b4-8524-000000000463'::uuid, 'visitantes'),
    ('c81295e3-9167-40b4-8524-000000000465'::uuid, 'visitantes'),
    ('c81295e3-9167-40b4-8524-000000000466'::uuid, 'visitantes'),
    ('c81295e3-9167-40b4-8524-000000000468'::uuid, 'visitantes'),
    ('c81295e3-9167-40b4-8524-000000000469'::uuid, 'visitantes'),
    ('c81295e3-9167-40b4-8524-000000000471'::uuid, 'visitantes'),
    ('c81295e3-9167-40b4-8524-000000000472'::uuid, 'visitantes'),
    ('c81295e3-9167-40b4-8524-000000000474'::uuid, 'visitantes'),
    ('c81295e3-9167-40b4-8524-000000000475'::uuid, 'visitantes'),
    ('c81295e3-9167-40b4-8524-000000000477'::uuid, 'visitantes'),
    ('c81295e3-9167-40b4-8524-000000000478'::uuid, 'visitantes')
  ) as x(profile_id, role_code)
  join public.access_roles r on r.code = x.role_code
on conflict (profile_id, role_id) do nothing;

-- Trigger de cadastro atribui Visitantes a todo perfil novo; manter só nos 50 visitantes.
delete from public.profile_access_roles par
 using public.access_roles ar, public.profiles p
 where par.role_id = ar.id
   and ar.code = 'visitantes'
   and par.profile_id = p.id
   and p.family_id ~ '^IBS9[0-9]{3}$'
   and (
     coalesce(p.is_active, false) is not true
     or exists (
       select 1
         from public.profile_access_roles par2
         join public.access_roles ar2 on ar2.id = par2.role_id
        where par2.profile_id = p.id
          and ar2.code in ('member', 'congregado', 'pastoral')
     )
   );

-- ---------------------------------------------------------------------------
-- 4. Pequenos grupos (5 células) com líder e anfitrião
-- ---------------------------------------------------------------------------
insert into public.small_groups (
  id, tenant_id, name, meeting_weekday, meeting_time, host_profile_id, leader_profile_id, notes, is_active, created_by_profile_id
) values (
  'c81295e3-9167-40b4-8524-000000005000'::uuid, '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Célula Rudge Ramos', 3, time '19:30',
  'c81295e3-9167-40b4-8524-000000000205'::uuid, 'c81295e3-9167-40b4-8524-000000000009'::uuid, 'Reunião semanal na casa do anfitrião, bairro Rudge Ramos.', true, '04b919ba-38b4-4fe5-a371-2e98e9acbc0d'::uuid
);
insert into public.small_group_members (tenant_id, small_group_id, profile_id)
values
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, 'c81295e3-9167-40b4-8524-000000005000'::uuid, 'c81295e3-9167-40b4-8524-000000000009'::uuid),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, 'c81295e3-9167-40b4-8524-000000005000'::uuid, 'c81295e3-9167-40b4-8524-000000000205'::uuid),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, 'c81295e3-9167-40b4-8524-000000005000'::uuid, 'c81295e3-9167-40b4-8524-000000000002'::uuid),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, 'c81295e3-9167-40b4-8524-000000005000'::uuid, 'c81295e3-9167-40b4-8524-000000000006'::uuid),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, 'c81295e3-9167-40b4-8524-000000005000'::uuid, 'c81295e3-9167-40b4-8524-000000000010'::uuid),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, 'c81295e3-9167-40b4-8524-000000005000'::uuid, 'c81295e3-9167-40b4-8524-000000000013'::uuid),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, 'c81295e3-9167-40b4-8524-000000005000'::uuid, 'c81295e3-9167-40b4-8524-000000000014'::uuid),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, 'c81295e3-9167-40b4-8524-000000005000'::uuid, 'c81295e3-9167-40b4-8524-000000000017'::uuid),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, 'c81295e3-9167-40b4-8524-000000005000'::uuid, 'c81295e3-9167-40b4-8524-000000000018'::uuid),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, 'c81295e3-9167-40b4-8524-000000005000'::uuid, 'c81295e3-9167-40b4-8524-000000000021'::uuid),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, 'c81295e3-9167-40b4-8524-000000005000'::uuid, 'c81295e3-9167-40b4-8524-000000000022'::uuid),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, 'c81295e3-9167-40b4-8524-000000005000'::uuid, 'c81295e3-9167-40b4-8524-000000000025'::uuid);

insert into public.small_groups (
  id, tenant_id, name, meeting_weekday, meeting_time, host_profile_id, leader_profile_id, notes, is_active, created_by_profile_id
) values (
  'c81295e3-9167-40b4-8524-000000005001'::uuid, '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Célula Centro', 4, time '20:00',
  'c81295e3-9167-40b4-8524-000000000209'::uuid, 'c81295e3-9167-40b4-8524-000000000013'::uuid, 'Pequeno grupo no Centro de São Bernardo do Campo.', true, '04b919ba-38b4-4fe5-a371-2e98e9acbc0d'::uuid
);
insert into public.small_group_members (tenant_id, small_group_id, profile_id)
values
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, 'c81295e3-9167-40b4-8524-000000005001'::uuid, 'c81295e3-9167-40b4-8524-000000000209'::uuid),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, 'c81295e3-9167-40b4-8524-000000005001'::uuid, 'c81295e3-9167-40b4-8524-000000000026'::uuid),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, 'c81295e3-9167-40b4-8524-000000005001'::uuid, 'c81295e3-9167-40b4-8524-000000000029'::uuid),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, 'c81295e3-9167-40b4-8524-000000005001'::uuid, 'c81295e3-9167-40b4-8524-000000000030'::uuid),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, 'c81295e3-9167-40b4-8524-000000005001'::uuid, 'c81295e3-9167-40b4-8524-000000000033'::uuid),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, 'c81295e3-9167-40b4-8524-000000005001'::uuid, 'c81295e3-9167-40b4-8524-000000000034'::uuid),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, 'c81295e3-9167-40b4-8524-000000005001'::uuid, 'c81295e3-9167-40b4-8524-000000000037'::uuid),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, 'c81295e3-9167-40b4-8524-000000005001'::uuid, 'c81295e3-9167-40b4-8524-000000000038'::uuid),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, 'c81295e3-9167-40b4-8524-000000005001'::uuid, 'c81295e3-9167-40b4-8524-000000000041'::uuid),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, 'c81295e3-9167-40b4-8524-000000005001'::uuid, 'c81295e3-9167-40b4-8524-000000000042'::uuid),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, 'c81295e3-9167-40b4-8524-000000005001'::uuid, 'c81295e3-9167-40b4-8524-000000000045'::uuid),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, 'c81295e3-9167-40b4-8524-000000005001'::uuid, 'c81295e3-9167-40b4-8524-000000000046'::uuid);

insert into public.small_groups (
  id, tenant_id, name, meeting_weekday, meeting_time, host_profile_id, leader_profile_id, notes, is_active, created_by_profile_id
) values (
  'c81295e3-9167-40b4-8524-000000005002'::uuid, '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Célula Assunção', 2, time '19:45',
  'c81295e3-9167-40b4-8524-000000000213'::uuid, 'c81295e3-9167-40b4-8524-000000000017'::uuid, 'Encontro de discipulado no bairro Assunção.', true, '04b919ba-38b4-4fe5-a371-2e98e9acbc0d'::uuid
);
insert into public.small_group_members (tenant_id, small_group_id, profile_id)
values
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, 'c81295e3-9167-40b4-8524-000000005002'::uuid, 'c81295e3-9167-40b4-8524-000000000213'::uuid),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, 'c81295e3-9167-40b4-8524-000000005002'::uuid, 'c81295e3-9167-40b4-8524-000000000049'::uuid),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, 'c81295e3-9167-40b4-8524-000000005002'::uuid, 'c81295e3-9167-40b4-8524-000000000050'::uuid),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, 'c81295e3-9167-40b4-8524-000000005002'::uuid, 'c81295e3-9167-40b4-8524-000000000053'::uuid),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, 'c81295e3-9167-40b4-8524-000000005002'::uuid, 'c81295e3-9167-40b4-8524-000000000054'::uuid),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, 'c81295e3-9167-40b4-8524-000000005002'::uuid, 'c81295e3-9167-40b4-8524-000000000057'::uuid),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, 'c81295e3-9167-40b4-8524-000000005002'::uuid, 'c81295e3-9167-40b4-8524-000000000058'::uuid),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, 'c81295e3-9167-40b4-8524-000000005002'::uuid, 'c81295e3-9167-40b4-8524-000000000061'::uuid),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, 'c81295e3-9167-40b4-8524-000000005002'::uuid, 'c81295e3-9167-40b4-8524-000000000062'::uuid),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, 'c81295e3-9167-40b4-8524-000000005002'::uuid, 'c81295e3-9167-40b4-8524-000000000065'::uuid),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, 'c81295e3-9167-40b4-8524-000000005002'::uuid, 'c81295e3-9167-40b4-8524-000000000066'::uuid),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, 'c81295e3-9167-40b4-8524-000000005002'::uuid, 'c81295e3-9167-40b4-8524-000000000069'::uuid);

insert into public.small_groups (
  id, tenant_id, name, meeting_weekday, meeting_time, host_profile_id, leader_profile_id, notes, is_active, created_by_profile_id
) values (
  'c81295e3-9167-40b4-8524-000000005003'::uuid, '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Célula Baeta Neves', 5, time '20:00',
  'c81295e3-9167-40b4-8524-000000000217'::uuid, 'c81295e3-9167-40b4-8524-000000000021'::uuid, 'Célula familiar em Baeta Neves.', true, '04b919ba-38b4-4fe5-a371-2e98e9acbc0d'::uuid
);
insert into public.small_group_members (tenant_id, small_group_id, profile_id)
values
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, 'c81295e3-9167-40b4-8524-000000005003'::uuid, 'c81295e3-9167-40b4-8524-000000000217'::uuid),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, 'c81295e3-9167-40b4-8524-000000005003'::uuid, 'c81295e3-9167-40b4-8524-000000000070'::uuid),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, 'c81295e3-9167-40b4-8524-000000005003'::uuid, 'c81295e3-9167-40b4-8524-000000000073'::uuid),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, 'c81295e3-9167-40b4-8524-000000005003'::uuid, 'c81295e3-9167-40b4-8524-000000000074'::uuid),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, 'c81295e3-9167-40b4-8524-000000005003'::uuid, 'c81295e3-9167-40b4-8524-000000000077'::uuid),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, 'c81295e3-9167-40b4-8524-000000005003'::uuid, 'c81295e3-9167-40b4-8524-000000000078'::uuid),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, 'c81295e3-9167-40b4-8524-000000005003'::uuid, 'c81295e3-9167-40b4-8524-000000000081'::uuid),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, 'c81295e3-9167-40b4-8524-000000005003'::uuid, 'c81295e3-9167-40b4-8524-000000000082'::uuid),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, 'c81295e3-9167-40b4-8524-000000005003'::uuid, 'c81295e3-9167-40b4-8524-000000000085'::uuid),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, 'c81295e3-9167-40b4-8524-000000005003'::uuid, 'c81295e3-9167-40b4-8524-000000000086'::uuid),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, 'c81295e3-9167-40b4-8524-000000005003'::uuid, 'c81295e3-9167-40b4-8524-000000000089'::uuid),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, 'c81295e3-9167-40b4-8524-000000005003'::uuid, 'c81295e3-9167-40b4-8524-000000000090'::uuid);

insert into public.small_groups (
  id, tenant_id, name, meeting_weekday, meeting_time, host_profile_id, leader_profile_id, notes, is_active, created_by_profile_id
) values (
  'c81295e3-9167-40b4-8524-000000005004'::uuid, '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Célula Ferrazópolis', 3, time '19:00',
  'c81295e3-9167-40b4-8524-000000000221'::uuid, 'c81295e3-9167-40b4-8524-000000000025'::uuid, 'Grupo de comunhão em Ferrazópolis.', true, '04b919ba-38b4-4fe5-a371-2e98e9acbc0d'::uuid
);
insert into public.small_group_members (tenant_id, small_group_id, profile_id)
values
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, 'c81295e3-9167-40b4-8524-000000005004'::uuid, 'c81295e3-9167-40b4-8524-000000000221'::uuid),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, 'c81295e3-9167-40b4-8524-000000005004'::uuid, 'c81295e3-9167-40b4-8524-000000000093'::uuid),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, 'c81295e3-9167-40b4-8524-000000005004'::uuid, 'c81295e3-9167-40b4-8524-000000000094'::uuid),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, 'c81295e3-9167-40b4-8524-000000005004'::uuid, 'c81295e3-9167-40b4-8524-000000000097'::uuid),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, 'c81295e3-9167-40b4-8524-000000005004'::uuid, 'c81295e3-9167-40b4-8524-000000000098'::uuid),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, 'c81295e3-9167-40b4-8524-000000005004'::uuid, 'c81295e3-9167-40b4-8524-000000000101'::uuid),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, 'c81295e3-9167-40b4-8524-000000005004'::uuid, 'c81295e3-9167-40b4-8524-000000000102'::uuid),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, 'c81295e3-9167-40b4-8524-000000005004'::uuid, 'c81295e3-9167-40b4-8524-000000000105'::uuid),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, 'c81295e3-9167-40b4-8524-000000005004'::uuid, 'c81295e3-9167-40b4-8524-000000000106'::uuid),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, 'c81295e3-9167-40b4-8524-000000005004'::uuid, 'c81295e3-9167-40b4-8524-000000000109'::uuid),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, 'c81295e3-9167-40b4-8524-000000005004'::uuid, 'c81295e3-9167-40b4-8524-000000000110'::uuid),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, 'c81295e3-9167-40b4-8524-000000005004'::uuid, 'c81295e3-9167-40b4-8524-000000000113'::uuid);

-- ---------------------------------------------------------------------------
-- 5. Acervo de livros doados (cópia integral IBN → IBS)
-- ---------------------------------------------------------------------------
insert into public.livros (tenant_id, isbn, titulo, autor, editora, ano, capa)
select '81295e39-9167-40b4-a524-702439905e75'::uuid, l.isbn, l.titulo, l.autor, l.editora, l.ano, l.capa
  from public.livros l
 where l.tenant_id = 'a0000000-0000-4000-8000-000000000001'::uuid;

-- ---------------------------------------------------------------------------
-- 6. Mural de voluntários, generosidade e recepção (3 famílias pendentes)
-- ---------------------------------------------------------------------------
insert into public.volunteer_opportunities (
  tenant_id, titulo, descricao, leader_profile_id, required_gifts, status, created_by
) values (
  '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Acolhimento no culto da manhã', 'Equipe para receber famílias no acesso principal, com cordialidade e orientação de salas.', 'c81295e3-9167-40b4-8524-000000000001'::uuid,
  array['acolhimento','servico'], 'aberta', '04b919ba-38b4-4fe5-a371-2e98e9acbc0d'::uuid
);
insert into public.volunteer_opportunities (
  tenant_id, titulo, descricao, leader_profile_id, required_gifts, status, created_by
) values (
  '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Apoio ao Ministério Infantil', 'Voluntários para acolher crianças de 0 a 11 anos durante o culto, com ficha de alergias em mãos.', 'c81295e3-9167-40b4-8524-000000000001'::uuid,
  array['acolhimento','servico'], 'aberta', '04b919ba-38b4-4fe5-a371-2e98e9acbc0d'::uuid
);
insert into public.volunteer_opportunities (
  tenant_id, titulo, descricao, leader_profile_id, required_gifts, status, created_by
) values (
  '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Intercessão pelos enfermos', 'Grupo de oração que visita irmãos hospitalizados na região do ABC.', 'c81295e3-9167-40b4-8524-000000000001'::uuid,
  array['acolhimento','servico'], 'aberta', '04b919ba-38b4-4fe5-a371-2e98e9acbc0d'::uuid
);
insert into public.volunteer_opportunities (
  tenant_id, titulo, descricao, leader_profile_id, required_gifts, status, created_by
) values (
  '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Ação solidária de cestas', 'Separação e entrega de alimentos do estoque solidário às famílias acompanhadas pela igreja.', 'c81295e3-9167-40b4-8524-000000000001'::uuid,
  array['acolhimento','servico'], 'aberta', '04b919ba-38b4-4fe5-a371-2e98e9acbc0d'::uuid
);

insert into public.generosity_posts (tenant_id, user_id, tipo, categoria, titulo, descricao, status)
values ('81295e39-9167-40b4-a524-702439905e75'::uuid, 'c81295e3-9167-40b4-8524-000000000021'::uuid, 'doacao', 'moveis', 'Berço e cômoda em bom estado', 'Família da Célula Centro disponibiliza berço de madeira e cômoda para uma mãe recente da congregação.', 'ativo');
insert into public.generosity_posts (tenant_id, user_id, tipo, categoria, titulo, descricao, status)
values ('81295e39-9167-40b4-a524-702439905e75'::uuid, 'c81295e3-9167-40b4-8524-000000000025'::uuid, 'pedido', 'saude_equipamentos', 'Cadeira de banho para idosa', 'Irmã da Célula Assunção precisa emprestar cadeira de banho por oito semanas após cirurgia.', 'ativo');
insert into public.generosity_posts (tenant_id, user_id, tipo, categoria, titulo, descricao, status)
values ('81295e39-9167-40b4-a524-702439905e75'::uuid, 'c81295e3-9167-40b4-8524-000000000029'::uuid, 'doacao', 'vestuario', 'Agasalhos infantis (4 a 10 anos)', 'Peças lavadas e em ótimo estado para o inverno, retiradas no templo após o culto.', 'ativo');
insert into public.generosity_posts (tenant_id, user_id, tipo, categoria, titulo, descricao, status)
values ('81295e39-9167-40b4-a524-702439905e75'::uuid, 'c81295e3-9167-40b4-8524-000000000033'::uuid, 'doacao', 'livros', 'Bíblias de estudo para novos convertidos', 'Lote de Bíblias para presentear visitantes que concluírem o curso de batismo.', 'ativo');

insert into public.recepcao_cadastro_familiar_lote (id, status, member_count, tenant_id)
values ('c81295e3-9167-40b4-8524-000000006000'::uuid, 'pending', 3, '81295e39-9167-40b4-a524-702439905e75'::uuid);
insert into public.recepcao_cadastro_familiar (
  submission_id, is_informant, status, full_name, birth_date, phone, relationship,
  cep, address_number, address_street, address_neighborhood, address_city, address_state, tenant_id
) values (
  'c81295e3-9167-40b4-8524-000000006000'::uuid, true, 'pending', 'Rogério Pacheco Vasconcelos', '1986-03-12'::date, '(11) 97710-0001', 'Representante Legal',
  '09750-240', '412', 'Rua Marechal Deodoro', 'Centro', 'São Bernardo do Campo', 'SP', '81295e39-9167-40b4-a524-702439905e75'::uuid
);
insert into public.recepcao_cadastro_familiar (
  submission_id, is_informant, status, full_name, birth_date, phone, relationship,
  cep, address_number, address_street, address_neighborhood, address_city, address_state, tenant_id
) values (
  'c81295e3-9167-40b4-8524-000000006000'::uuid, false, 'pending', 'Tatiane Pacheco Vasconcelos', '1988-07-22'::date, null, 'Cônjuge',
  '09750-240', '412', 'Rua Marechal Deodoro', 'Centro', 'São Bernardo do Campo', 'SP', '81295e39-9167-40b4-a524-702439905e75'::uuid
);
insert into public.recepcao_cadastro_familiar (
  submission_id, is_informant, status, full_name, birth_date, phone, relationship,
  cep, address_number, address_street, address_neighborhood, address_city, address_state, tenant_id
) values (
  'c81295e3-9167-40b4-8524-000000006000'::uuid, false, 'pending', 'Lara Pacheco Vasconcelos', '2016-11-03'::date, null, 'Filho(a)',
  '09750-240', '412', 'Rua Marechal Deodoro', 'Centro', 'São Bernardo do Campo', 'SP', '81295e39-9167-40b4-a524-702439905e75'::uuid
);
insert into public.recepcao_cadastro_familiar_lote (id, status, member_count, tenant_id)
values ('c81295e3-9167-40b4-8524-000000006001'::uuid, 'pending', 2, '81295e39-9167-40b4-a524-702439905e75'::uuid);
insert into public.recepcao_cadastro_familiar (
  submission_id, is_informant, status, full_name, birth_date, phone, relationship,
  cep, address_number, address_street, address_neighborhood, address_city, address_state, tenant_id
) values (
  'c81295e3-9167-40b4-8524-000000006001'::uuid, true, 'pending', 'Sílvia Guimarães Leal', '1979-01-30'::date, '(11) 97710-0011', 'Representante Legal',
  '09600-010', '1550', 'Avenida Kennedy', 'Rudge Ramos', 'São Bernardo do Campo', 'SP', '81295e39-9167-40b4-a524-702439905e75'::uuid
);
insert into public.recepcao_cadastro_familiar (
  submission_id, is_informant, status, full_name, birth_date, phone, relationship,
  cep, address_number, address_street, address_neighborhood, address_city, address_state, tenant_id
) values (
  'c81295e3-9167-40b4-8524-000000006001'::uuid, false, 'pending', 'Caio Guimarães Leal', '2012-05-18'::date, null, 'Filho(a)',
  '09600-010', '1550', 'Avenida Kennedy', 'Rudge Ramos', 'São Bernardo do Campo', 'SP', '81295e39-9167-40b4-a524-702439905e75'::uuid
);
insert into public.recepcao_cadastro_familiar_lote (id, status, member_count, tenant_id)
values ('c81295e3-9167-40b4-8524-000000006002'::uuid, 'pending', 2, '81295e39-9167-40b4-a524-702439905e75'::uuid);
insert into public.recepcao_cadastro_familiar (
  submission_id, is_informant, status, full_name, birth_date, phone, relationship,
  cep, address_number, address_street, address_neighborhood, address_city, address_state, tenant_id
) values (
  'c81295e3-9167-40b4-8524-000000006002'::uuid, true, 'pending', 'Benedito Sampaio Queiroz', '1954-09-09'::date, '(11) 97710-0021', 'Representante Legal',
  '09890-210', '88', 'Rua Assunção', 'Assunção', 'São Bernardo do Campo', 'SP', '81295e39-9167-40b4-a524-702439905e75'::uuid
);
insert into public.recepcao_cadastro_familiar (
  submission_id, is_informant, status, full_name, birth_date, phone, relationship,
  cep, address_number, address_street, address_neighborhood, address_city, address_state, tenant_id
) values (
  'c81295e3-9167-40b4-8524-000000006002'::uuid, false, 'pending', 'Irene Sampaio Queiroz', '1957-04-14'::date, null, 'Cônjuge',
  '09890-210', '88', 'Rua Assunção', 'Assunção', 'São Bernardo do Campo', 'SP', '81295e39-9167-40b4-a524-702439905e75'::uuid
);

-- ---------------------------------------------------------------------------
-- 7. Agenda de eventos (próximos 60 dias)
-- ---------------------------------------------------------------------------
insert into public.events (
  tenant_id, name, event_local, event_date, max_capacity, kids_room, teens_room,
  parm_ofertas, totem_ativo, requer_quorum, is_locked, enabled_room_keys
) values (
  '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Culto da manhã', 'Salão de Eventos IBS',
  timestamptz '2026-09-13 10:00:00-03', 280, true, true,
  true, true, false, false, array['KIDS', 'TEENS']::text[]
);
insert into public.events (
  tenant_id, name, event_local, event_date, max_capacity, kids_room, teens_room,
  parm_ofertas, totem_ativo, requer_quorum, is_locked, enabled_room_keys
) values (
  '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Culto da noite', 'Salão de Eventos IBS',
  timestamptz '2026-09-13 18:30:00-03', 220, false, true,
  true, true, false, false, array['TEENS']::text[]
);
insert into public.events (
  tenant_id, name, event_local, event_date, max_capacity, kids_room, teens_room,
  parm_ofertas, totem_ativo, requer_quorum, is_locked, enabled_room_keys
) values (
  '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Culto de oração e palavra', 'Salão de Eventos IBS',
  timestamptz '2026-09-16 19:30:00-03', 120, false, false,
  true, true, false, false, '{}'::text[]
);
insert into public.events (
  tenant_id, name, event_local, event_date, max_capacity, kids_room, teens_room,
  parm_ofertas, totem_ativo, requer_quorum, is_locked, enabled_room_keys
) values (
  '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Culto da manhã', 'Salão de Eventos IBS',
  timestamptz '2026-09-20 10:00:00-03', 280, true, true,
  true, true, false, false, array['KIDS', 'TEENS']::text[]
);
insert into public.events (
  tenant_id, name, event_local, event_date, max_capacity, kids_room, teens_room,
  parm_ofertas, totem_ativo, requer_quorum, is_locked, enabled_room_keys
) values (
  '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Culto da noite', 'Salão de Eventos IBS',
  timestamptz '2026-09-20 18:30:00-03', 220, false, true,
  true, true, false, false, array['TEENS']::text[]
);
insert into public.events (
  tenant_id, name, event_local, event_date, max_capacity, kids_room, teens_room,
  parm_ofertas, totem_ativo, requer_quorum, is_locked, enabled_room_keys
) values (
  '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Curso de batismo', 'Curso de Batismo',
  timestamptz '2026-09-22 20:00:00-03', 40, false, false,
  true, true, false, false, array['CURSO_DE_BATISMO']::text[]
);
insert into public.events (
  tenant_id, name, event_local, event_date, max_capacity, kids_room, teens_room,
  parm_ofertas, totem_ativo, requer_quorum, is_locked, enabled_room_keys
) values (
  '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Culto de oração e palavra', 'Salão de Eventos IBS',
  timestamptz '2026-09-23 19:30:00-03', 120, false, false,
  true, true, false, false, '{}'::text[]
);
insert into public.events (
  tenant_id, name, event_local, event_date, max_capacity, kids_room, teens_room,
  parm_ofertas, totem_ativo, requer_quorum, is_locked, enabled_room_keys
) values (
  '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Culto da manhã', 'Salão de Eventos IBS',
  timestamptz '2026-09-27 10:00:00-03', 280, true, true,
  true, true, false, false, array['KIDS', 'TEENS']::text[]
);
insert into public.events (
  tenant_id, name, event_local, event_date, max_capacity, kids_room, teens_room,
  parm_ofertas, totem_ativo, requer_quorum, is_locked, enabled_room_keys
) values (
  '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Culto da noite', 'Salão de Eventos IBS',
  timestamptz '2026-09-27 18:30:00-03', 220, false, true,
  true, true, false, false, array['TEENS']::text[]
);
insert into public.events (
  tenant_id, name, event_local, event_date, max_capacity, kids_room, teens_room,
  parm_ofertas, totem_ativo, requer_quorum, is_locked, enabled_room_keys
) values (
  '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Curso de batismo', 'Curso de Batismo',
  timestamptz '2026-09-29 20:00:00-03', 40, false, false,
  true, true, false, false, array['CURSO_DE_BATISMO']::text[]
);
insert into public.events (
  tenant_id, name, event_local, event_date, max_capacity, kids_room, teens_room,
  parm_ofertas, totem_ativo, requer_quorum, is_locked, enabled_room_keys
) values (
  '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Culto de oração e palavra', 'Salão de Eventos IBS',
  timestamptz '2026-09-30 19:30:00-03', 120, false, false,
  true, true, false, false, '{}'::text[]
);
insert into public.events (
  tenant_id, name, event_local, event_date, max_capacity, kids_room, teens_room,
  parm_ofertas, totem_ativo, requer_quorum, is_locked, enabled_room_keys
) values (
  '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Culto da manhã', 'Salão de Eventos IBS',
  timestamptz '2026-10-04 10:00:00-03', 280, true, true,
  true, true, false, false, array['KIDS', 'TEENS']::text[]
);
insert into public.events (
  tenant_id, name, event_local, event_date, max_capacity, kids_room, teens_room,
  parm_ofertas, totem_ativo, requer_quorum, is_locked, enabled_room_keys
) values (
  '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Culto da noite', 'Salão de Eventos IBS',
  timestamptz '2026-10-04 18:30:00-03', 220, false, true,
  true, true, false, false, array['TEENS']::text[]
);
insert into public.events (
  tenant_id, name, event_local, event_date, max_capacity, kids_room, teens_room,
  parm_ofertas, totem_ativo, requer_quorum, is_locked, enabled_room_keys
) values (
  '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Curso de batismo', 'Curso de Batismo',
  timestamptz '2026-10-06 20:00:00-03', 40, false, false,
  true, true, false, false, array['CURSO_DE_BATISMO']::text[]
);
insert into public.events (
  tenant_id, name, event_local, event_date, max_capacity, kids_room, teens_room,
  parm_ofertas, totem_ativo, requer_quorum, is_locked, enabled_room_keys
) values (
  '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Culto de oração e palavra', 'Salão de Eventos IBS',
  timestamptz '2026-10-07 19:30:00-03', 120, false, false,
  true, true, false, false, '{}'::text[]
);
insert into public.events (
  tenant_id, name, event_local, event_date, max_capacity, kids_room, teens_room,
  parm_ofertas, totem_ativo, requer_quorum, is_locked, enabled_room_keys
) values (
  '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Culto da manhã', 'Salão de Eventos IBS',
  timestamptz '2026-10-11 10:00:00-03', 280, true, true,
  true, true, false, false, array['KIDS', 'TEENS']::text[]
);
insert into public.events (
  tenant_id, name, event_local, event_date, max_capacity, kids_room, teens_room,
  parm_ofertas, totem_ativo, requer_quorum, is_locked, enabled_room_keys
) values (
  '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Culto da noite', 'Salão de Eventos IBS',
  timestamptz '2026-10-11 18:30:00-03', 220, false, true,
  true, true, false, false, array['TEENS']::text[]
);
insert into public.events (
  tenant_id, name, event_local, event_date, max_capacity, kids_room, teens_room,
  parm_ofertas, totem_ativo, requer_quorum, is_locked, enabled_room_keys
) values (
  '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Curso de batismo', 'Curso de Batismo',
  timestamptz '2026-10-13 20:00:00-03', 40, false, false,
  true, true, false, false, array['CURSO_DE_BATISMO']::text[]
);
insert into public.events (
  tenant_id, name, event_local, event_date, max_capacity, kids_room, teens_room,
  parm_ofertas, totem_ativo, requer_quorum, is_locked, enabled_room_keys
) values (
  '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Culto de oração e palavra', 'Salão de Eventos IBS',
  timestamptz '2026-10-14 19:30:00-03', 120, false, false,
  true, true, false, false, '{}'::text[]
);
insert into public.events (
  tenant_id, name, event_local, event_date, max_capacity, kids_room, teens_room,
  parm_ofertas, totem_ativo, requer_quorum, is_locked, enabled_room_keys
) values (
  '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Culto da manhã', 'Salão de Eventos IBS',
  timestamptz '2026-10-18 10:00:00-03', 280, true, true,
  true, true, false, false, array['KIDS', 'TEENS']::text[]
);
insert into public.events (
  tenant_id, name, event_local, event_date, max_capacity, kids_room, teens_room,
  parm_ofertas, totem_ativo, requer_quorum, is_locked, enabled_room_keys
) values (
  '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Culto da noite', 'Salão de Eventos IBS',
  timestamptz '2026-10-18 18:30:00-03', 220, false, true,
  true, true, false, false, array['TEENS']::text[]
);
insert into public.events (
  tenant_id, name, event_local, event_date, max_capacity, kids_room, teens_room,
  parm_ofertas, totem_ativo, requer_quorum, is_locked, enabled_room_keys
) values (
  '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Curso de batismo', 'Curso de Batismo',
  timestamptz '2026-10-20 20:00:00-03', 40, false, false,
  true, true, false, false, array['CURSO_DE_BATISMO']::text[]
);
insert into public.events (
  tenant_id, name, event_local, event_date, max_capacity, kids_room, teens_room,
  parm_ofertas, totem_ativo, requer_quorum, is_locked, enabled_room_keys
) values (
  '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Culto de oração e palavra', 'Salão de Eventos IBS',
  timestamptz '2026-10-21 19:30:00-03', 120, false, false,
  true, true, false, false, '{}'::text[]
);
insert into public.events (
  tenant_id, name, event_local, event_date, max_capacity, kids_room, teens_room,
  parm_ofertas, totem_ativo, requer_quorum, is_locked, enabled_room_keys
) values (
  '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Culto da manhã', 'Salão de Eventos IBS',
  timestamptz '2026-10-25 10:00:00-03', 280, true, true,
  true, true, false, false, array['KIDS', 'TEENS']::text[]
);
insert into public.events (
  tenant_id, name, event_local, event_date, max_capacity, kids_room, teens_room,
  parm_ofertas, totem_ativo, requer_quorum, is_locked, enabled_room_keys
) values (
  '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Culto da noite', 'Salão de Eventos IBS',
  timestamptz '2026-10-25 18:30:00-03', 220, false, true,
  true, true, false, false, array['TEENS']::text[]
);
insert into public.events (
  tenant_id, name, event_local, event_date, max_capacity, kids_room, teens_room,
  parm_ofertas, totem_ativo, requer_quorum, is_locked, enabled_room_keys
) values (
  '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Curso de batismo', 'Curso de Batismo',
  timestamptz '2026-10-27 20:00:00-03', 40, false, false,
  true, true, false, false, array['CURSO_DE_BATISMO']::text[]
);
insert into public.events (
  tenant_id, name, event_local, event_date, max_capacity, kids_room, teens_room,
  parm_ofertas, totem_ativo, requer_quorum, is_locked, enabled_room_keys
) values (
  '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Culto de oração e palavra', 'Salão de Eventos IBS',
  timestamptz '2026-10-28 19:30:00-03', 120, false, false,
  true, true, false, false, '{}'::text[]
);
insert into public.events (
  tenant_id, name, event_local, event_date, max_capacity, kids_room, teens_room,
  parm_ofertas, totem_ativo, requer_quorum, is_locked, enabled_room_keys
) values (
  '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Culto da manhã', 'Salão de Eventos IBS',
  timestamptz '2026-11-01 10:00:00-03', 280, true, true,
  true, true, false, false, array['KIDS', 'TEENS']::text[]
);
insert into public.events (
  tenant_id, name, event_local, event_date, max_capacity, kids_room, teens_room,
  parm_ofertas, totem_ativo, requer_quorum, is_locked, enabled_room_keys
) values (
  '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Culto da noite', 'Salão de Eventos IBS',
  timestamptz '2026-11-01 18:30:00-03', 220, false, true,
  true, true, false, false, array['TEENS']::text[]
);
insert into public.events (
  tenant_id, name, event_local, event_date, max_capacity, kids_room, teens_room,
  parm_ofertas, totem_ativo, requer_quorum, is_locked, enabled_room_keys
) values (
  '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Culto de oração e palavra', 'Salão de Eventos IBS',
  timestamptz '2026-11-04 19:30:00-03', 120, false, false,
  true, true, false, false, '{}'::text[]
);
insert into public.events (
  tenant_id, name, event_local, event_date, max_capacity, kids_room, teens_room,
  parm_ofertas, totem_ativo, requer_quorum, is_locked, enabled_room_keys
) values (
  '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Culto da manhã', 'Salão de Eventos IBS',
  timestamptz '2026-11-08 10:00:00-03', 280, true, true,
  true, true, false, false, array['KIDS', 'TEENS']::text[]
);
insert into public.events (
  tenant_id, name, event_local, event_date, max_capacity, kids_room, teens_room,
  parm_ofertas, totem_ativo, requer_quorum, is_locked, enabled_room_keys
) values (
  '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Culto da noite', 'Salão de Eventos IBS',
  timestamptz '2026-11-08 18:30:00-03', 220, false, true,
  true, true, false, false, array['TEENS']::text[]
);
insert into public.events (
  tenant_id, name, event_local, event_date, max_capacity, kids_room, teens_room,
  parm_ofertas, totem_ativo, requer_quorum, is_locked, enabled_room_keys
) values (
  '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Conferência de missões IBS', 'Salão de Eventos IBS',
  timestamptz '2026-10-01 19:00:00-03', 300, true, true,
  true, true, false, false, array['KIDS', 'TEENS']::text[]
);
insert into public.events (
  tenant_id, name, event_local, event_date, max_capacity, kids_room, teens_room,
  parm_ofertas, totem_ativo, requer_quorum, is_locked, enabled_room_keys
) values (
  '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Ação solidária — entrega de cestas', 'Salão de Eventos IBS',
  timestamptz '2026-10-15 09:00:00-03', 90, false, false,
  true, true, false, false, '{}'::text[]
);
insert into public.events (
  tenant_id, name, event_local, event_date, max_capacity, kids_room, teens_room,
  parm_ofertas, totem_ativo, requer_quorum, is_locked, enabled_room_keys
) values (
  '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Retiro de jovens IBS', 'IBS Jovens',
  timestamptz '2026-10-22 08:00:00-03', 60, false, true,
  true, true, false, false, array['TEENS']::text[]
);

-- ---------------------------------------------------------------------------
-- 8. Campanhas (centavos distintos para digitação da direita para a esquerda)
-- ---------------------------------------------------------------------------
insert into public.campaign_projects (
  id, tenant_id, titulo, descricao, meta_financeira, valor_arrecadado, data_inicio, data_fim,
  status, centavos_referencia, created_by_profile_id
) values (
  'c81295e3-9167-40b4-8524-000000007001'::uuid, '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Reforma do templo', 'Cobertura e climatização do Salão de Eventos IBS.', 85000.17, 12450.17,
  date '2026-07-01', date '2026-12-31', 'ativo', 0.17, '04b919ba-38b4-4fe5-a371-2e98e9acbc0d'::uuid
);
insert into public.campaign_projects (
  id, tenant_id, titulo, descricao, meta_financeira, valor_arrecadado, data_inicio, data_fim,
  status, centavos_referencia, created_by_profile_id
) values (
  'c81295e3-9167-40b4-8524-000000007002'::uuid, '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Missões transculturais', 'Sustento de missionários e viagens de curta duração.', 42000.31, 8670.31,
  date '2026-07-01', date '2026-12-31', 'ativo', 0.31, '04b919ba-38b4-4fe5-a371-2e98e9acbc0d'::uuid
);
insert into public.campaign_projects (
  id, tenant_id, titulo, descricao, meta_financeira, valor_arrecadado, data_inicio, data_fim,
  status, centavos_referencia, created_by_profile_id
) values (
  'c81295e3-9167-40b4-8524-000000007003'::uuid, '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Natal solidário do ABC', 'Cestas, higiene e brinquedos para famílias acompanhadas.', 18000.48, 4320.48,
  date '2026-07-01', date '2026-12-31', 'ativo', 0.48, '04b919ba-38b4-4fe5-a371-2e98e9acbc0d'::uuid
);
insert into public.campaign_projects (
  id, tenant_id, titulo, descricao, meta_financeira, valor_arrecadado, data_inicio, data_fim,
  status, centavos_referencia, created_by_profile_id
) values (
  'c81295e3-9167-40b4-8524-000000007004'::uuid, '81295e39-9167-40b4-a524-702439905e75'::uuid, 'Van do Ministério Infantil', 'Aquisição de van para buscar crianças da periferia.', 95000.62, 15120.62,
  date '2026-07-01', date '2026-12-31', 'ativo', 0.62, '04b919ba-38b4-4fe5-a371-2e98e9acbc0d'::uuid
);
do $p$ begin perform public.ensure_primicias_defaults('81295e39-9167-40b4-a524-702439905e75'::uuid); end; $p$;

-- ---------------------------------------------------------------------------
-- 9. Avisos do mural (6 comunicados publicados)
-- ---------------------------------------------------------------------------
insert into public.event_avisos (tenant_id, title, body, sort_order, is_published, audience, created_by_profile_id)
values ('81295e39-9167-40b4-a524-702439905e75'::uuid, 'Comunicado pastoral — mês da família', 'Durante setembro, os cultos da noite terão uma palavra especial às famílias da IBS. Tragam os filhos para o momento de bênção.', 1, true, 'all', '04b919ba-38b4-4fe5-a371-2e98e9acbc0d'::uuid);
insert into public.event_avisos (tenant_id, title, body, sort_order, is_published, audience, created_by_profile_id)
values ('81295e39-9167-40b4-a524-702439905e75'::uuid, 'Batismo comunitário', 'Inscrições abertas para o curso de batismo às terças, 20h, na sala Curso de Batismo. Fale com a secretaria após o culto.', 2, true, 'all', '04b919ba-38b4-4fe5-a371-2e98e9acbc0d'::uuid);
insert into public.event_avisos (tenant_id, title, body, sort_order, is_published, audience, created_by_profile_id)
values ('81295e39-9167-40b4-a524-702439905e75'::uuid, 'Reunião de ministérios', 'Líderes de acolhimento, infantil e louvor reúnem-se na quinta, 20h, na sala de Discipulado para alinhar as escalas de outubro.', 3, true, 'all', '04b919ba-38b4-4fe5-a371-2e98e9acbc0d'::uuid);
insert into public.event_avisos (tenant_id, title, body, sort_order, is_published, audience, created_by_profile_id)
values ('81295e39-9167-40b4-a524-702439905e75'::uuid, 'Manutenção da agenda de eventos', 'O culto de oração da quarta passa a começar às 19h30. Confiram a grade no aplicativo antes de sair de casa.', 4, true, 'all', '04b919ba-38b4-4fe5-a371-2e98e9acbc0d'::uuid);
insert into public.event_avisos (tenant_id, title, body, sort_order, is_published, audience, created_by_profile_id)
values ('81295e39-9167-40b4-a524-702439905e75'::uuid, 'Mutirão de limpeza do templo', 'Sábado, 8h, mutirão voluntário para preparar o Salão de Eventos IBS à conferência de missões. Tragam produtos de limpeza se puderem.', 5, true, 'all', '04b919ba-38b4-4fe5-a371-2e98e9acbc0d'::uuid);
insert into public.event_avisos (tenant_id, title, body, sort_order, is_published, audience, created_by_profile_id)
values ('81295e39-9167-40b4-a524-702439905e75'::uuid, 'Células no ABC', 'Novos pequenos grupos em Rudge Ramos, Centro, Assunção, Baeta Neves e Ferrazópolis. Procurem os líderes para encaixe de horário.', 6, true, 'all', '04b919ba-38b4-4fe5-a371-2e98e9acbc0d'::uuid);

-- ---------------------------------------------------------------------------
-- 10. Histórico financeiro de 12 meses (dízimos, ofertas, campanhas)
-- ---------------------------------------------------------------------------
insert into public.financials (tenant_id, transaction_date, account, amount, ministry, transaction_kind, movement, budget_version, comments, campaign_project_id)
values
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2025-09-07'::date, 'SICREDI', 3534.90, 'OFERTAS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Oferta do culto — IBS', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2025-09-14'::date, 'SICREDI', 3407.77, 'OFERTAS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Oferta do culto — IBS', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2025-09-21'::date, 'SICREDI', 3916.26, 'OFERTAS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Oferta do culto — IBS', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2025-09-28'::date, 'SICREDI', 3835.09, 'OFERTAS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Oferta do culto — IBS', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2025-09-05'::date, 'SICREDI', 180.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Henrique Azevedo Pereira / IBS9003', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2025-09-06'::date, 'SICREDI', 197.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — José Rodrigues Vieira / IBS9004', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2025-09-07'::date, 'SICREDI', 214.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Wagner Oliveira Almeida / IBS9005', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2025-09-08'::date, 'SICREDI', 231.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Ricardo Lima Macedo / IBS9006', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2025-09-09'::date, 'SICREDI', 248.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Pedro Barros Ribeiro / IBS9007', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2025-09-10'::date, 'SICREDI', 265.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Carlos Oliveira Correia / IBS9008', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2025-09-11'::date, 'SICREDI', 282.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Samuel Farias Barbosa / IBS9009', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2025-09-12'::date, 'SICREDI', 299.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Júlio Carvalho Vasconcelos / IBS9010', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2025-09-13'::date, 'SICREDI', 316.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Gabriel Guimarães Machado / IBS9011', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2025-09-14'::date, 'SICREDI', 333.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Samuel Rezende Araujo / IBS9012', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2025-09-15'::date, 'SICREDI', 350.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — André Aguiar Rezende / IBS9013', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2025-09-16'::date, 'SICREDI', 367.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Felipe Castro Gomes / IBS9014', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2025-09-17'::date, 'SICREDI', 384.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Marcelo Nunes Ferreira / IBS9015', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2025-09-18'::date, 'SICREDI', 401.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Felipe Cunha Moreira / IBS9016', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2025-09-19'::date, 'SICREDI', 418.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — João Barbosa Oliveira / IBS9017', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2025-09-20'::date, 'SICREDI', 435.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Murilo Monteiro Machado / IBS9018', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2025-09-21'::date, 'SICREDI', 452.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Rafael Teixeira Correia / IBS9019', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2025-09-22'::date, 'SICREDI', 469.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — José Cardoso Machado / IBS9020', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2025-09-23'::date, 'SICREDI', 486.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Daniel Cardoso Farias / IBS9021', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2025-09-24'::date, 'SICREDI', 503.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — José Almeida Leal / IBS9022', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2025-09-05'::date, 'SICREDI', 520.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Caio Siqueira Santos / IBS9023', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2025-09-06'::date, 'SICREDI', 537.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Leandro Araujo Moreira / IBS9024', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2025-09-07'::date, 'SICREDI', 554.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Carlos Carvalho Duarte / IBS9025', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2025-09-08'::date, 'SICREDI', 571.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Daniel Barbosa Vasconcelos / IBS9026', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2025-09-09'::date, 'SICREDI', 588.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Enzo Moreira Barros / IBS9027', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2025-09-10'::date, 'SICREDI', 185.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Antônio Gomes Carvalho / IBS9028', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2025-09-11'::date, 'SICREDI', 202.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Otávio Cardoso Teixeira / IBS9029', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2025-09-12'::date, 'SICREDI', 219.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Gustavo Queiroz Nogueira / IBS9030', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2025-09-13'::date, 'SICREDI', 236.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Sérgio Macedo Nogueira / IBS9031', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2025-09-14'::date, 'SICREDI', 253.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Carlos Mendes Barros / IBS9032', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2025-09-15'::date, 'SICREDI', 270.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — João Pinto Rodrigues / IBS9033', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2025-09-16'::date, 'SICREDI', 287.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Eduardo Oliveira Alves / IBS9034', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2025-09-17'::date, 'SICREDI', 304.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Cristiano Alves Almeida / IBS9035', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2025-09-18'::date, 'SICREDI', 321.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — João Moura Queiroz / IBS9036', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2025-09-19'::date, 'SICREDI', 338.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — João Cavalcanti Moura / IBS9037', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2025-09-20'::date, 'SICREDI', 355.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Fábio Ribeiro Castro / IBS9038', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2025-09-10'::date, 'SICREDI', 4200.00, 'ALUGUEL', 'SAÍDAS', 'ORDINÁRIO', 'REALIZADO', 'Aluguel do templo IBS', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2025-10-05'::date, 'SICREDI', 3701.15, 'OFERTAS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Oferta do culto — IBS', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2025-10-12'::date, 'SICREDI', 3750.10, 'OFERTAS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Oferta do culto — IBS', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2025-10-19'::date, 'SICREDI', 3701.84, 'OFERTAS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Oferta do culto — IBS', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2025-10-26'::date, 'SICREDI', 3334.04, 'OFERTAS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Oferta do culto — IBS', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2025-10-05'::date, 'SICREDI', 180.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Henrique Azevedo Pereira / IBS9003', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2025-10-06'::date, 'SICREDI', 197.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — José Rodrigues Vieira / IBS9004', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2025-10-07'::date, 'SICREDI', 214.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Wagner Oliveira Almeida / IBS9005', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2025-10-08'::date, 'SICREDI', 231.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Ricardo Lima Macedo / IBS9006', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2025-10-09'::date, 'SICREDI', 248.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Pedro Barros Ribeiro / IBS9007', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2025-10-10'::date, 'SICREDI', 265.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Carlos Oliveira Correia / IBS9008', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2025-10-11'::date, 'SICREDI', 282.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Samuel Farias Barbosa / IBS9009', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2025-10-12'::date, 'SICREDI', 299.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Júlio Carvalho Vasconcelos / IBS9010', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2025-10-13'::date, 'SICREDI', 316.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Gabriel Guimarães Machado / IBS9011', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2025-10-14'::date, 'SICREDI', 333.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Samuel Rezende Araujo / IBS9012', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2025-10-15'::date, 'SICREDI', 350.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — André Aguiar Rezende / IBS9013', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2025-10-16'::date, 'SICREDI', 367.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Felipe Castro Gomes / IBS9014', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2025-10-17'::date, 'SICREDI', 384.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Marcelo Nunes Ferreira / IBS9015', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2025-10-18'::date, 'SICREDI', 401.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Felipe Cunha Moreira / IBS9016', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2025-10-19'::date, 'SICREDI', 418.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — João Barbosa Oliveira / IBS9017', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2025-10-20'::date, 'SICREDI', 435.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Murilo Monteiro Machado / IBS9018', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2025-10-21'::date, 'SICREDI', 452.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Rafael Teixeira Correia / IBS9019', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2025-10-22'::date, 'SICREDI', 469.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — José Cardoso Machado / IBS9020', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2025-10-23'::date, 'SICREDI', 486.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Daniel Cardoso Farias / IBS9021', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2025-10-24'::date, 'SICREDI', 503.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — José Almeida Leal / IBS9022', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2025-10-05'::date, 'SICREDI', 520.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Caio Siqueira Santos / IBS9023', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2025-10-06'::date, 'SICREDI', 537.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Leandro Araujo Moreira / IBS9024', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2025-10-07'::date, 'SICREDI', 554.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Carlos Carvalho Duarte / IBS9025', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2025-10-08'::date, 'SICREDI', 571.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Daniel Barbosa Vasconcelos / IBS9026', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2025-10-09'::date, 'SICREDI', 588.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Enzo Moreira Barros / IBS9027', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2025-10-10'::date, 'SICREDI', 185.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Antônio Gomes Carvalho / IBS9028', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2025-10-11'::date, 'SICREDI', 202.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Otávio Cardoso Teixeira / IBS9029', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2025-10-12'::date, 'SICREDI', 219.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Gustavo Queiroz Nogueira / IBS9030', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2025-10-13'::date, 'SICREDI', 236.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Sérgio Macedo Nogueira / IBS9031', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2025-10-14'::date, 'SICREDI', 253.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Carlos Mendes Barros / IBS9032', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2025-10-15'::date, 'SICREDI', 270.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — João Pinto Rodrigues / IBS9033', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2025-10-16'::date, 'SICREDI', 287.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Eduardo Oliveira Alves / IBS9034', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2025-10-17'::date, 'SICREDI', 304.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Cristiano Alves Almeida / IBS9035', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2025-10-18'::date, 'SICREDI', 321.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — João Moura Queiroz / IBS9036', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2025-10-19'::date, 'SICREDI', 338.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — João Cavalcanti Moura / IBS9037', null);

insert into public.financials (tenant_id, transaction_date, account, amount, ministry, transaction_kind, movement, budget_version, comments, campaign_project_id)
values
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2025-10-20'::date, 'SICREDI', 355.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Fábio Ribeiro Castro / IBS9038', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2025-11-02'::date, 'SICREDI', 3298.16, 'OFERTAS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Oferta do culto — IBS', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2025-11-09'::date, 'SICREDI', 3782.50, 'OFERTAS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Oferta do culto — IBS', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2025-11-16'::date, 'SICREDI', 3738.24, 'OFERTAS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Oferta do culto — IBS', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2025-11-23'::date, 'SICREDI', 3282.10, 'OFERTAS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Oferta do culto — IBS', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2025-11-30'::date, 'SICREDI', 3641.57, 'OFERTAS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Oferta do culto — IBS', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2025-11-05'::date, 'SICREDI', 180.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Henrique Azevedo Pereira / IBS9003', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2025-11-06'::date, 'SICREDI', 197.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — José Rodrigues Vieira / IBS9004', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2025-11-07'::date, 'SICREDI', 214.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Wagner Oliveira Almeida / IBS9005', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2025-11-08'::date, 'SICREDI', 231.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Ricardo Lima Macedo / IBS9006', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2025-11-09'::date, 'SICREDI', 248.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Pedro Barros Ribeiro / IBS9007', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2025-11-10'::date, 'SICREDI', 265.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Carlos Oliveira Correia / IBS9008', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2025-11-11'::date, 'SICREDI', 282.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Samuel Farias Barbosa / IBS9009', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2025-11-12'::date, 'SICREDI', 299.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Júlio Carvalho Vasconcelos / IBS9010', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2025-11-13'::date, 'SICREDI', 316.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Gabriel Guimarães Machado / IBS9011', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2025-11-14'::date, 'SICREDI', 333.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Samuel Rezende Araujo / IBS9012', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2025-11-15'::date, 'SICREDI', 350.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — André Aguiar Rezende / IBS9013', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2025-11-16'::date, 'SICREDI', 367.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Felipe Castro Gomes / IBS9014', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2025-11-17'::date, 'SICREDI', 384.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Marcelo Nunes Ferreira / IBS9015', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2025-11-18'::date, 'SICREDI', 401.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Felipe Cunha Moreira / IBS9016', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2025-11-19'::date, 'SICREDI', 418.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — João Barbosa Oliveira / IBS9017', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2025-11-20'::date, 'SICREDI', 435.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Murilo Monteiro Machado / IBS9018', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2025-11-21'::date, 'SICREDI', 452.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Rafael Teixeira Correia / IBS9019', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2025-11-22'::date, 'SICREDI', 469.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — José Cardoso Machado / IBS9020', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2025-11-23'::date, 'SICREDI', 486.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Daniel Cardoso Farias / IBS9021', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2025-11-24'::date, 'SICREDI', 503.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — José Almeida Leal / IBS9022', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2025-11-05'::date, 'SICREDI', 520.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Caio Siqueira Santos / IBS9023', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2025-11-06'::date, 'SICREDI', 537.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Leandro Araujo Moreira / IBS9024', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2025-11-07'::date, 'SICREDI', 554.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Carlos Carvalho Duarte / IBS9025', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2025-11-08'::date, 'SICREDI', 571.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Daniel Barbosa Vasconcelos / IBS9026', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2025-11-09'::date, 'SICREDI', 588.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Enzo Moreira Barros / IBS9027', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2025-11-10'::date, 'SICREDI', 185.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Antônio Gomes Carvalho / IBS9028', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2025-11-11'::date, 'SICREDI', 202.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Otávio Cardoso Teixeira / IBS9029', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2025-11-12'::date, 'SICREDI', 219.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Gustavo Queiroz Nogueira / IBS9030', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2025-11-13'::date, 'SICREDI', 236.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Sérgio Macedo Nogueira / IBS9031', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2025-11-14'::date, 'SICREDI', 253.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Carlos Mendes Barros / IBS9032', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2025-11-15'::date, 'SICREDI', 270.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — João Pinto Rodrigues / IBS9033', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2025-11-16'::date, 'SICREDI', 287.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Eduardo Oliveira Alves / IBS9034', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2025-11-17'::date, 'SICREDI', 304.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Cristiano Alves Almeida / IBS9035', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2025-11-18'::date, 'SICREDI', 321.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — João Moura Queiroz / IBS9036', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2025-11-19'::date, 'SICREDI', 338.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — João Cavalcanti Moura / IBS9037', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2025-11-20'::date, 'SICREDI', 355.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Fábio Ribeiro Castro / IBS9038', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2025-11-10'::date, 'SICREDI', 4200.00, 'ALUGUEL', 'SAÍDAS', 'ORDINÁRIO', 'REALIZADO', 'Aluguel do templo IBS', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2025-12-07'::date, 'SICREDI', 3354.74, 'OFERTAS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Oferta do culto — IBS', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2025-12-14'::date, 'SICREDI', 3375.78, 'OFERTAS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Oferta do culto — IBS', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2025-12-21'::date, 'SICREDI', 3300.04, 'OFERTAS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Oferta do culto — IBS', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2025-12-28'::date, 'SICREDI', 3930.91, 'OFERTAS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Oferta do culto — IBS', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2025-12-05'::date, 'SICREDI', 180.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Henrique Azevedo Pereira / IBS9003', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2025-12-06'::date, 'SICREDI', 197.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — José Rodrigues Vieira / IBS9004', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2025-12-07'::date, 'SICREDI', 214.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Wagner Oliveira Almeida / IBS9005', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2025-12-08'::date, 'SICREDI', 231.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Ricardo Lima Macedo / IBS9006', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2025-12-09'::date, 'SICREDI', 248.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Pedro Barros Ribeiro / IBS9007', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2025-12-10'::date, 'SICREDI', 265.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Carlos Oliveira Correia / IBS9008', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2025-12-11'::date, 'SICREDI', 282.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Samuel Farias Barbosa / IBS9009', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2025-12-12'::date, 'SICREDI', 299.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Júlio Carvalho Vasconcelos / IBS9010', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2025-12-13'::date, 'SICREDI', 316.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Gabriel Guimarães Machado / IBS9011', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2025-12-14'::date, 'SICREDI', 333.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Samuel Rezende Araujo / IBS9012', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2025-12-15'::date, 'SICREDI', 350.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — André Aguiar Rezende / IBS9013', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2025-12-16'::date, 'SICREDI', 367.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Felipe Castro Gomes / IBS9014', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2025-12-17'::date, 'SICREDI', 384.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Marcelo Nunes Ferreira / IBS9015', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2025-12-18'::date, 'SICREDI', 401.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Felipe Cunha Moreira / IBS9016', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2025-12-19'::date, 'SICREDI', 418.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — João Barbosa Oliveira / IBS9017', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2025-12-20'::date, 'SICREDI', 435.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Murilo Monteiro Machado / IBS9018', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2025-12-21'::date, 'SICREDI', 452.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Rafael Teixeira Correia / IBS9019', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2025-12-22'::date, 'SICREDI', 469.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — José Cardoso Machado / IBS9020', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2025-12-23'::date, 'SICREDI', 486.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Daniel Cardoso Farias / IBS9021', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2025-12-24'::date, 'SICREDI', 503.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — José Almeida Leal / IBS9022', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2025-12-05'::date, 'SICREDI', 520.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Caio Siqueira Santos / IBS9023', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2025-12-06'::date, 'SICREDI', 537.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Leandro Araujo Moreira / IBS9024', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2025-12-07'::date, 'SICREDI', 554.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Carlos Carvalho Duarte / IBS9025', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2025-12-08'::date, 'SICREDI', 571.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Daniel Barbosa Vasconcelos / IBS9026', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2025-12-09'::date, 'SICREDI', 588.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Enzo Moreira Barros / IBS9027', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2025-12-10'::date, 'SICREDI', 185.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Antônio Gomes Carvalho / IBS9028', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2025-12-11'::date, 'SICREDI', 202.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Otávio Cardoso Teixeira / IBS9029', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2025-12-12'::date, 'SICREDI', 219.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Gustavo Queiroz Nogueira / IBS9030', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2025-12-13'::date, 'SICREDI', 236.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Sérgio Macedo Nogueira / IBS9031', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2025-12-14'::date, 'SICREDI', 253.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Carlos Mendes Barros / IBS9032', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2025-12-15'::date, 'SICREDI', 270.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — João Pinto Rodrigues / IBS9033', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2025-12-16'::date, 'SICREDI', 287.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Eduardo Oliveira Alves / IBS9034', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2025-12-17'::date, 'SICREDI', 304.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Cristiano Alves Almeida / IBS9035', null);

insert into public.financials (tenant_id, transaction_date, account, amount, ministry, transaction_kind, movement, budget_version, comments, campaign_project_id)
values
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2025-12-18'::date, 'SICREDI', 321.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — João Moura Queiroz / IBS9036', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2025-12-19'::date, 'SICREDI', 338.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — João Cavalcanti Moura / IBS9037', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2025-12-20'::date, 'SICREDI', 355.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Fábio Ribeiro Castro / IBS9038', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-01-04'::date, 'SICREDI', 3406.93, 'OFERTAS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Oferta do culto — IBS', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-01-11'::date, 'SICREDI', 3387.16, 'OFERTAS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Oferta do culto — IBS', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-01-18'::date, 'SICREDI', 4076.20, 'OFERTAS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Oferta do culto — IBS', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-01-25'::date, 'SICREDI', 3316.21, 'OFERTAS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Oferta do culto — IBS', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-01-05'::date, 'SICREDI', 180.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Henrique Azevedo Pereira / IBS9003', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-01-06'::date, 'SICREDI', 197.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — José Rodrigues Vieira / IBS9004', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-01-07'::date, 'SICREDI', 214.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Wagner Oliveira Almeida / IBS9005', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-01-08'::date, 'SICREDI', 231.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Ricardo Lima Macedo / IBS9006', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-01-09'::date, 'SICREDI', 248.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Pedro Barros Ribeiro / IBS9007', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-01-10'::date, 'SICREDI', 265.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Carlos Oliveira Correia / IBS9008', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-01-11'::date, 'SICREDI', 282.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Samuel Farias Barbosa / IBS9009', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-01-12'::date, 'SICREDI', 299.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Júlio Carvalho Vasconcelos / IBS9010', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-01-13'::date, 'SICREDI', 316.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Gabriel Guimarães Machado / IBS9011', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-01-14'::date, 'SICREDI', 333.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Samuel Rezende Araujo / IBS9012', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-01-15'::date, 'SICREDI', 350.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — André Aguiar Rezende / IBS9013', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-01-16'::date, 'SICREDI', 367.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Felipe Castro Gomes / IBS9014', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-01-17'::date, 'SICREDI', 384.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Marcelo Nunes Ferreira / IBS9015', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-01-18'::date, 'SICREDI', 401.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Felipe Cunha Moreira / IBS9016', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-01-19'::date, 'SICREDI', 418.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — João Barbosa Oliveira / IBS9017', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-01-20'::date, 'SICREDI', 435.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Murilo Monteiro Machado / IBS9018', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-01-21'::date, 'SICREDI', 452.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Rafael Teixeira Correia / IBS9019', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-01-22'::date, 'SICREDI', 469.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — José Cardoso Machado / IBS9020', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-01-23'::date, 'SICREDI', 486.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Daniel Cardoso Farias / IBS9021', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-01-24'::date, 'SICREDI', 503.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — José Almeida Leal / IBS9022', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-01-05'::date, 'SICREDI', 520.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Caio Siqueira Santos / IBS9023', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-01-06'::date, 'SICREDI', 537.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Leandro Araujo Moreira / IBS9024', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-01-07'::date, 'SICREDI', 554.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Carlos Carvalho Duarte / IBS9025', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-01-08'::date, 'SICREDI', 571.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Daniel Barbosa Vasconcelos / IBS9026', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-01-09'::date, 'SICREDI', 588.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Enzo Moreira Barros / IBS9027', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-01-10'::date, 'SICREDI', 185.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Antônio Gomes Carvalho / IBS9028', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-01-11'::date, 'SICREDI', 202.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Otávio Cardoso Teixeira / IBS9029', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-01-12'::date, 'SICREDI', 219.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Gustavo Queiroz Nogueira / IBS9030', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-01-13'::date, 'SICREDI', 236.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Sérgio Macedo Nogueira / IBS9031', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-01-14'::date, 'SICREDI', 253.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Carlos Mendes Barros / IBS9032', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-01-15'::date, 'SICREDI', 270.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — João Pinto Rodrigues / IBS9033', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-01-16'::date, 'SICREDI', 287.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Eduardo Oliveira Alves / IBS9034', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-01-17'::date, 'SICREDI', 304.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Cristiano Alves Almeida / IBS9035', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-01-18'::date, 'SICREDI', 321.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — João Moura Queiroz / IBS9036', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-01-19'::date, 'SICREDI', 338.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — João Cavalcanti Moura / IBS9037', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-01-20'::date, 'SICREDI', 355.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Fábio Ribeiro Castro / IBS9038', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-01-10'::date, 'SICREDI', 4200.00, 'ALUGUEL', 'SAÍDAS', 'ORDINÁRIO', 'REALIZADO', 'Aluguel do templo IBS', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-02-01'::date, 'SICREDI', 3892.67, 'OFERTAS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Oferta do culto — IBS', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-02-08'::date, 'SICREDI', 3961.65, 'OFERTAS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Oferta do culto — IBS', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-02-15'::date, 'SICREDI', 3888.25, 'OFERTAS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Oferta do culto — IBS', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-02-22'::date, 'SICREDI', 3429.16, 'OFERTAS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Oferta do culto — IBS', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-02-05'::date, 'SICREDI', 180.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Henrique Azevedo Pereira / IBS9003', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-02-06'::date, 'SICREDI', 197.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — José Rodrigues Vieira / IBS9004', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-02-07'::date, 'SICREDI', 214.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Wagner Oliveira Almeida / IBS9005', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-02-08'::date, 'SICREDI', 231.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Ricardo Lima Macedo / IBS9006', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-02-09'::date, 'SICREDI', 248.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Pedro Barros Ribeiro / IBS9007', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-02-10'::date, 'SICREDI', 265.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Carlos Oliveira Correia / IBS9008', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-02-11'::date, 'SICREDI', 282.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Samuel Farias Barbosa / IBS9009', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-02-12'::date, 'SICREDI', 299.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Júlio Carvalho Vasconcelos / IBS9010', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-02-13'::date, 'SICREDI', 316.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Gabriel Guimarães Machado / IBS9011', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-02-14'::date, 'SICREDI', 333.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Samuel Rezende Araujo / IBS9012', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-02-15'::date, 'SICREDI', 350.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — André Aguiar Rezende / IBS9013', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-02-16'::date, 'SICREDI', 367.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Felipe Castro Gomes / IBS9014', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-02-17'::date, 'SICREDI', 384.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Marcelo Nunes Ferreira / IBS9015', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-02-18'::date, 'SICREDI', 401.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Felipe Cunha Moreira / IBS9016', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-02-19'::date, 'SICREDI', 418.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — João Barbosa Oliveira / IBS9017', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-02-20'::date, 'SICREDI', 435.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Murilo Monteiro Machado / IBS9018', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-02-21'::date, 'SICREDI', 452.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Rafael Teixeira Correia / IBS9019', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-02-22'::date, 'SICREDI', 469.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — José Cardoso Machado / IBS9020', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-02-23'::date, 'SICREDI', 486.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Daniel Cardoso Farias / IBS9021', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-02-24'::date, 'SICREDI', 503.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — José Almeida Leal / IBS9022', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-02-05'::date, 'SICREDI', 520.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Caio Siqueira Santos / IBS9023', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-02-06'::date, 'SICREDI', 537.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Leandro Araujo Moreira / IBS9024', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-02-07'::date, 'SICREDI', 554.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Carlos Carvalho Duarte / IBS9025', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-02-08'::date, 'SICREDI', 571.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Daniel Barbosa Vasconcelos / IBS9026', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-02-09'::date, 'SICREDI', 588.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Enzo Moreira Barros / IBS9027', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-02-10'::date, 'SICREDI', 185.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Antônio Gomes Carvalho / IBS9028', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-02-11'::date, 'SICREDI', 202.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Otávio Cardoso Teixeira / IBS9029', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-02-12'::date, 'SICREDI', 219.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Gustavo Queiroz Nogueira / IBS9030', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-02-13'::date, 'SICREDI', 236.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Sérgio Macedo Nogueira / IBS9031', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-02-14'::date, 'SICREDI', 253.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Carlos Mendes Barros / IBS9032', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-02-15'::date, 'SICREDI', 270.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — João Pinto Rodrigues / IBS9033', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-02-16'::date, 'SICREDI', 287.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Eduardo Oliveira Alves / IBS9034', null);

insert into public.financials (tenant_id, transaction_date, account, amount, ministry, transaction_kind, movement, budget_version, comments, campaign_project_id)
values
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-02-17'::date, 'SICREDI', 304.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Cristiano Alves Almeida / IBS9035', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-02-18'::date, 'SICREDI', 321.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — João Moura Queiroz / IBS9036', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-02-19'::date, 'SICREDI', 338.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — João Cavalcanti Moura / IBS9037', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-02-20'::date, 'SICREDI', 355.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Fábio Ribeiro Castro / IBS9038', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-03-01'::date, 'SICREDI', 3396.94, 'OFERTAS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Oferta do culto — IBS', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-03-08'::date, 'SICREDI', 3965.50, 'OFERTAS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Oferta do culto — IBS', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-03-15'::date, 'SICREDI', 3365.76, 'OFERTAS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Oferta do culto — IBS', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-03-22'::date, 'SICREDI', 3980.37, 'OFERTAS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Oferta do culto — IBS', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-03-29'::date, 'SICREDI', 3726.87, 'OFERTAS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Oferta do culto — IBS', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-03-05'::date, 'SICREDI', 180.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Henrique Azevedo Pereira / IBS9003', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-03-06'::date, 'SICREDI', 197.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — José Rodrigues Vieira / IBS9004', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-03-07'::date, 'SICREDI', 214.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Wagner Oliveira Almeida / IBS9005', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-03-08'::date, 'SICREDI', 231.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Ricardo Lima Macedo / IBS9006', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-03-09'::date, 'SICREDI', 248.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Pedro Barros Ribeiro / IBS9007', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-03-10'::date, 'SICREDI', 265.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Carlos Oliveira Correia / IBS9008', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-03-11'::date, 'SICREDI', 282.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Samuel Farias Barbosa / IBS9009', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-03-12'::date, 'SICREDI', 299.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Júlio Carvalho Vasconcelos / IBS9010', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-03-13'::date, 'SICREDI', 316.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Gabriel Guimarães Machado / IBS9011', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-03-14'::date, 'SICREDI', 333.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Samuel Rezende Araujo / IBS9012', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-03-15'::date, 'SICREDI', 350.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — André Aguiar Rezende / IBS9013', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-03-16'::date, 'SICREDI', 367.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Felipe Castro Gomes / IBS9014', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-03-17'::date, 'SICREDI', 384.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Marcelo Nunes Ferreira / IBS9015', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-03-18'::date, 'SICREDI', 401.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Felipe Cunha Moreira / IBS9016', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-03-19'::date, 'SICREDI', 418.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — João Barbosa Oliveira / IBS9017', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-03-20'::date, 'SICREDI', 435.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Murilo Monteiro Machado / IBS9018', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-03-21'::date, 'SICREDI', 452.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Rafael Teixeira Correia / IBS9019', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-03-22'::date, 'SICREDI', 469.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — José Cardoso Machado / IBS9020', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-03-23'::date, 'SICREDI', 486.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Daniel Cardoso Farias / IBS9021', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-03-24'::date, 'SICREDI', 503.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — José Almeida Leal / IBS9022', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-03-05'::date, 'SICREDI', 520.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Caio Siqueira Santos / IBS9023', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-03-06'::date, 'SICREDI', 537.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Leandro Araujo Moreira / IBS9024', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-03-07'::date, 'SICREDI', 554.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Carlos Carvalho Duarte / IBS9025', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-03-08'::date, 'SICREDI', 571.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Daniel Barbosa Vasconcelos / IBS9026', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-03-09'::date, 'SICREDI', 588.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Enzo Moreira Barros / IBS9027', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-03-10'::date, 'SICREDI', 185.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Antônio Gomes Carvalho / IBS9028', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-03-11'::date, 'SICREDI', 202.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Otávio Cardoso Teixeira / IBS9029', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-03-12'::date, 'SICREDI', 219.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Gustavo Queiroz Nogueira / IBS9030', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-03-13'::date, 'SICREDI', 236.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Sérgio Macedo Nogueira / IBS9031', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-03-14'::date, 'SICREDI', 253.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Carlos Mendes Barros / IBS9032', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-03-15'::date, 'SICREDI', 270.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — João Pinto Rodrigues / IBS9033', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-03-16'::date, 'SICREDI', 287.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Eduardo Oliveira Alves / IBS9034', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-03-17'::date, 'SICREDI', 304.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Cristiano Alves Almeida / IBS9035', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-03-18'::date, 'SICREDI', 321.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — João Moura Queiroz / IBS9036', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-03-19'::date, 'SICREDI', 338.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — João Cavalcanti Moura / IBS9037', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-03-20'::date, 'SICREDI', 355.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Fábio Ribeiro Castro / IBS9038', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-03-10'::date, 'SICREDI', 4200.00, 'ALUGUEL', 'SAÍDAS', 'ORDINÁRIO', 'REALIZADO', 'Aluguel do templo IBS', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-04-05'::date, 'SICREDI', 3969.71, 'OFERTAS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Oferta do culto — IBS', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-04-12'::date, 'SICREDI', 3754.64, 'OFERTAS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Oferta do culto — IBS', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-04-19'::date, 'SICREDI', 3750.10, 'OFERTAS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Oferta do culto — IBS', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-04-26'::date, 'SICREDI', 3886.28, 'OFERTAS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Oferta do culto — IBS', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-04-05'::date, 'SICREDI', 180.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Henrique Azevedo Pereira / IBS9003', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-04-06'::date, 'SICREDI', 197.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — José Rodrigues Vieira / IBS9004', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-04-07'::date, 'SICREDI', 214.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Wagner Oliveira Almeida / IBS9005', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-04-08'::date, 'SICREDI', 231.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Ricardo Lima Macedo / IBS9006', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-04-09'::date, 'SICREDI', 248.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Pedro Barros Ribeiro / IBS9007', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-04-10'::date, 'SICREDI', 265.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Carlos Oliveira Correia / IBS9008', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-04-11'::date, 'SICREDI', 282.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Samuel Farias Barbosa / IBS9009', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-04-12'::date, 'SICREDI', 299.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Júlio Carvalho Vasconcelos / IBS9010', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-04-13'::date, 'SICREDI', 316.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Gabriel Guimarães Machado / IBS9011', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-04-14'::date, 'SICREDI', 333.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Samuel Rezende Araujo / IBS9012', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-04-15'::date, 'SICREDI', 350.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — André Aguiar Rezende / IBS9013', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-04-16'::date, 'SICREDI', 367.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Felipe Castro Gomes / IBS9014', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-04-17'::date, 'SICREDI', 384.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Marcelo Nunes Ferreira / IBS9015', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-04-18'::date, 'SICREDI', 401.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Felipe Cunha Moreira / IBS9016', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-04-19'::date, 'SICREDI', 418.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — João Barbosa Oliveira / IBS9017', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-04-20'::date, 'SICREDI', 435.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Murilo Monteiro Machado / IBS9018', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-04-21'::date, 'SICREDI', 452.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Rafael Teixeira Correia / IBS9019', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-04-22'::date, 'SICREDI', 469.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — José Cardoso Machado / IBS9020', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-04-23'::date, 'SICREDI', 486.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Daniel Cardoso Farias / IBS9021', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-04-24'::date, 'SICREDI', 503.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — José Almeida Leal / IBS9022', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-04-05'::date, 'SICREDI', 520.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Caio Siqueira Santos / IBS9023', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-04-06'::date, 'SICREDI', 537.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Leandro Araujo Moreira / IBS9024', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-04-07'::date, 'SICREDI', 554.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Carlos Carvalho Duarte / IBS9025', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-04-08'::date, 'SICREDI', 571.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Daniel Barbosa Vasconcelos / IBS9026', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-04-09'::date, 'SICREDI', 588.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Enzo Moreira Barros / IBS9027', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-04-10'::date, 'SICREDI', 185.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Antônio Gomes Carvalho / IBS9028', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-04-11'::date, 'SICREDI', 202.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Otávio Cardoso Teixeira / IBS9029', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-04-12'::date, 'SICREDI', 219.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Gustavo Queiroz Nogueira / IBS9030', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-04-13'::date, 'SICREDI', 236.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Sérgio Macedo Nogueira / IBS9031', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-04-14'::date, 'SICREDI', 253.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Carlos Mendes Barros / IBS9032', null);

insert into public.financials (tenant_id, transaction_date, account, amount, ministry, transaction_kind, movement, budget_version, comments, campaign_project_id)
values
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-04-15'::date, 'SICREDI', 270.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — João Pinto Rodrigues / IBS9033', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-04-16'::date, 'SICREDI', 287.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Eduardo Oliveira Alves / IBS9034', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-04-17'::date, 'SICREDI', 304.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Cristiano Alves Almeida / IBS9035', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-04-18'::date, 'SICREDI', 321.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — João Moura Queiroz / IBS9036', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-04-19'::date, 'SICREDI', 338.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — João Cavalcanti Moura / IBS9037', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-04-20'::date, 'SICREDI', 355.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Fábio Ribeiro Castro / IBS9038', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-05-03'::date, 'SICREDI', 3972.13, 'OFERTAS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Oferta do culto — IBS', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-05-10'::date, 'SICREDI', 3581.32, 'OFERTAS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Oferta do culto — IBS', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-05-17'::date, 'SICREDI', 3685.19, 'OFERTAS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Oferta do culto — IBS', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-05-24'::date, 'SICREDI', 3952.07, 'OFERTAS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Oferta do culto — IBS', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-05-31'::date, 'SICREDI', 4060.79, 'OFERTAS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Oferta do culto — IBS', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-05-05'::date, 'SICREDI', 180.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Henrique Azevedo Pereira / IBS9003', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-05-06'::date, 'SICREDI', 197.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — José Rodrigues Vieira / IBS9004', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-05-07'::date, 'SICREDI', 214.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Wagner Oliveira Almeida / IBS9005', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-05-08'::date, 'SICREDI', 231.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Ricardo Lima Macedo / IBS9006', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-05-09'::date, 'SICREDI', 248.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Pedro Barros Ribeiro / IBS9007', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-05-10'::date, 'SICREDI', 265.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Carlos Oliveira Correia / IBS9008', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-05-11'::date, 'SICREDI', 282.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Samuel Farias Barbosa / IBS9009', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-05-12'::date, 'SICREDI', 299.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Júlio Carvalho Vasconcelos / IBS9010', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-05-13'::date, 'SICREDI', 316.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Gabriel Guimarães Machado / IBS9011', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-05-14'::date, 'SICREDI', 333.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Samuel Rezende Araujo / IBS9012', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-05-15'::date, 'SICREDI', 350.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — André Aguiar Rezende / IBS9013', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-05-16'::date, 'SICREDI', 367.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Felipe Castro Gomes / IBS9014', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-05-17'::date, 'SICREDI', 384.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Marcelo Nunes Ferreira / IBS9015', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-05-18'::date, 'SICREDI', 401.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Felipe Cunha Moreira / IBS9016', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-05-19'::date, 'SICREDI', 418.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — João Barbosa Oliveira / IBS9017', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-05-20'::date, 'SICREDI', 435.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Murilo Monteiro Machado / IBS9018', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-05-21'::date, 'SICREDI', 452.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Rafael Teixeira Correia / IBS9019', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-05-22'::date, 'SICREDI', 469.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — José Cardoso Machado / IBS9020', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-05-23'::date, 'SICREDI', 486.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Daniel Cardoso Farias / IBS9021', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-05-24'::date, 'SICREDI', 503.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — José Almeida Leal / IBS9022', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-05-05'::date, 'SICREDI', 520.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Caio Siqueira Santos / IBS9023', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-05-06'::date, 'SICREDI', 537.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Leandro Araujo Moreira / IBS9024', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-05-07'::date, 'SICREDI', 554.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Carlos Carvalho Duarte / IBS9025', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-05-08'::date, 'SICREDI', 571.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Daniel Barbosa Vasconcelos / IBS9026', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-05-09'::date, 'SICREDI', 588.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Enzo Moreira Barros / IBS9027', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-05-10'::date, 'SICREDI', 185.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Antônio Gomes Carvalho / IBS9028', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-05-11'::date, 'SICREDI', 202.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Otávio Cardoso Teixeira / IBS9029', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-05-12'::date, 'SICREDI', 219.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Gustavo Queiroz Nogueira / IBS9030', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-05-13'::date, 'SICREDI', 236.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Sérgio Macedo Nogueira / IBS9031', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-05-14'::date, 'SICREDI', 253.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Carlos Mendes Barros / IBS9032', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-05-15'::date, 'SICREDI', 270.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — João Pinto Rodrigues / IBS9033', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-05-16'::date, 'SICREDI', 287.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Eduardo Oliveira Alves / IBS9034', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-05-17'::date, 'SICREDI', 304.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Cristiano Alves Almeida / IBS9035', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-05-18'::date, 'SICREDI', 321.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — João Moura Queiroz / IBS9036', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-05-19'::date, 'SICREDI', 338.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — João Cavalcanti Moura / IBS9037', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-05-20'::date, 'SICREDI', 355.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Fábio Ribeiro Castro / IBS9038', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-05-10'::date, 'SICREDI', 4200.00, 'ALUGUEL', 'SAÍDAS', 'ORDINÁRIO', 'REALIZADO', 'Aluguel do templo IBS', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-06-07'::date, 'SICREDI', 3582.81, 'OFERTAS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Oferta do culto — IBS', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-06-14'::date, 'SICREDI', 3881.40, 'OFERTAS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Oferta do culto — IBS', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-06-21'::date, 'SICREDI', 4073.39, 'OFERTAS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Oferta do culto — IBS', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-06-28'::date, 'SICREDI', 3881.63, 'OFERTAS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Oferta do culto — IBS', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-06-05'::date, 'SICREDI', 180.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Henrique Azevedo Pereira / IBS9003', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-06-06'::date, 'SICREDI', 197.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — José Rodrigues Vieira / IBS9004', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-06-07'::date, 'SICREDI', 214.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Wagner Oliveira Almeida / IBS9005', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-06-08'::date, 'SICREDI', 231.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Ricardo Lima Macedo / IBS9006', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-06-09'::date, 'SICREDI', 248.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Pedro Barros Ribeiro / IBS9007', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-06-10'::date, 'SICREDI', 265.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Carlos Oliveira Correia / IBS9008', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-06-11'::date, 'SICREDI', 282.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Samuel Farias Barbosa / IBS9009', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-06-12'::date, 'SICREDI', 299.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Júlio Carvalho Vasconcelos / IBS9010', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-06-13'::date, 'SICREDI', 316.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Gabriel Guimarães Machado / IBS9011', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-06-14'::date, 'SICREDI', 333.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Samuel Rezende Araujo / IBS9012', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-06-15'::date, 'SICREDI', 350.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — André Aguiar Rezende / IBS9013', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-06-16'::date, 'SICREDI', 367.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Felipe Castro Gomes / IBS9014', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-06-17'::date, 'SICREDI', 384.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Marcelo Nunes Ferreira / IBS9015', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-06-18'::date, 'SICREDI', 401.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Felipe Cunha Moreira / IBS9016', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-06-19'::date, 'SICREDI', 418.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — João Barbosa Oliveira / IBS9017', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-06-20'::date, 'SICREDI', 435.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Murilo Monteiro Machado / IBS9018', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-06-21'::date, 'SICREDI', 452.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Rafael Teixeira Correia / IBS9019', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-06-22'::date, 'SICREDI', 469.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — José Cardoso Machado / IBS9020', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-06-23'::date, 'SICREDI', 486.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Daniel Cardoso Farias / IBS9021', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-06-24'::date, 'SICREDI', 503.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — José Almeida Leal / IBS9022', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-06-05'::date, 'SICREDI', 520.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Caio Siqueira Santos / IBS9023', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-06-06'::date, 'SICREDI', 537.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Leandro Araujo Moreira / IBS9024', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-06-07'::date, 'SICREDI', 554.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Carlos Carvalho Duarte / IBS9025', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-06-08'::date, 'SICREDI', 571.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Daniel Barbosa Vasconcelos / IBS9026', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-06-09'::date, 'SICREDI', 588.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Enzo Moreira Barros / IBS9027', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-06-10'::date, 'SICREDI', 185.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Antônio Gomes Carvalho / IBS9028', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-06-11'::date, 'SICREDI', 202.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Otávio Cardoso Teixeira / IBS9029', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-06-12'::date, 'SICREDI', 219.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Gustavo Queiroz Nogueira / IBS9030', null);

insert into public.financials (tenant_id, transaction_date, account, amount, ministry, transaction_kind, movement, budget_version, comments, campaign_project_id)
values
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-06-13'::date, 'SICREDI', 236.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Sérgio Macedo Nogueira / IBS9031', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-06-14'::date, 'SICREDI', 253.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Carlos Mendes Barros / IBS9032', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-06-15'::date, 'SICREDI', 270.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — João Pinto Rodrigues / IBS9033', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-06-16'::date, 'SICREDI', 287.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Eduardo Oliveira Alves / IBS9034', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-06-17'::date, 'SICREDI', 304.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Cristiano Alves Almeida / IBS9035', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-06-18'::date, 'SICREDI', 321.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — João Moura Queiroz / IBS9036', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-06-19'::date, 'SICREDI', 338.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — João Cavalcanti Moura / IBS9037', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-06-20'::date, 'SICREDI', 355.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Fábio Ribeiro Castro / IBS9038', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-07-05'::date, 'SICREDI', 3466.48, 'OFERTAS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Oferta do culto — IBS', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-07-12'::date, 'SICREDI', 3496.96, 'OFERTAS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Oferta do culto — IBS', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-07-19'::date, 'SICREDI', 3523.62, 'OFERTAS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Oferta do culto — IBS', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-07-26'::date, 'SICREDI', 3403.52, 'OFERTAS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Oferta do culto — IBS', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-07-05'::date, 'SICREDI', 180.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Henrique Azevedo Pereira / IBS9003', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-07-06'::date, 'SICREDI', 197.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — José Rodrigues Vieira / IBS9004', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-07-07'::date, 'SICREDI', 214.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Wagner Oliveira Almeida / IBS9005', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-07-08'::date, 'SICREDI', 231.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Ricardo Lima Macedo / IBS9006', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-07-09'::date, 'SICREDI', 248.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Pedro Barros Ribeiro / IBS9007', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-07-10'::date, 'SICREDI', 265.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Carlos Oliveira Correia / IBS9008', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-07-11'::date, 'SICREDI', 282.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Samuel Farias Barbosa / IBS9009', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-07-12'::date, 'SICREDI', 299.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Júlio Carvalho Vasconcelos / IBS9010', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-07-13'::date, 'SICREDI', 316.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Gabriel Guimarães Machado / IBS9011', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-07-14'::date, 'SICREDI', 333.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Samuel Rezende Araujo / IBS9012', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-07-15'::date, 'SICREDI', 350.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — André Aguiar Rezende / IBS9013', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-07-16'::date, 'SICREDI', 367.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Felipe Castro Gomes / IBS9014', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-07-17'::date, 'SICREDI', 384.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Marcelo Nunes Ferreira / IBS9015', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-07-18'::date, 'SICREDI', 401.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Felipe Cunha Moreira / IBS9016', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-07-19'::date, 'SICREDI', 418.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — João Barbosa Oliveira / IBS9017', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-07-20'::date, 'SICREDI', 435.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Murilo Monteiro Machado / IBS9018', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-07-21'::date, 'SICREDI', 452.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Rafael Teixeira Correia / IBS9019', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-07-22'::date, 'SICREDI', 469.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — José Cardoso Machado / IBS9020', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-07-23'::date, 'SICREDI', 486.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Daniel Cardoso Farias / IBS9021', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-07-24'::date, 'SICREDI', 503.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — José Almeida Leal / IBS9022', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-07-05'::date, 'SICREDI', 520.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Caio Siqueira Santos / IBS9023', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-07-06'::date, 'SICREDI', 537.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Leandro Araujo Moreira / IBS9024', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-07-07'::date, 'SICREDI', 554.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Carlos Carvalho Duarte / IBS9025', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-07-08'::date, 'SICREDI', 571.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Daniel Barbosa Vasconcelos / IBS9026', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-07-09'::date, 'SICREDI', 588.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Enzo Moreira Barros / IBS9027', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-07-10'::date, 'SICREDI', 185.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Antônio Gomes Carvalho / IBS9028', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-07-11'::date, 'SICREDI', 202.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Otávio Cardoso Teixeira / IBS9029', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-07-12'::date, 'SICREDI', 219.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Gustavo Queiroz Nogueira / IBS9030', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-07-13'::date, 'SICREDI', 236.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Sérgio Macedo Nogueira / IBS9031', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-07-14'::date, 'SICREDI', 253.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Carlos Mendes Barros / IBS9032', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-07-15'::date, 'SICREDI', 270.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — João Pinto Rodrigues / IBS9033', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-07-16'::date, 'SICREDI', 287.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Eduardo Oliveira Alves / IBS9034', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-07-17'::date, 'SICREDI', 304.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Cristiano Alves Almeida / IBS9035', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-07-18'::date, 'SICREDI', 321.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — João Moura Queiroz / IBS9036', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-07-19'::date, 'SICREDI', 338.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — João Cavalcanti Moura / IBS9037', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-07-20'::date, 'SICREDI', 355.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Fábio Ribeiro Castro / IBS9038', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-07-10'::date, 'SICREDI', 4200.00, 'ALUGUEL', 'SAÍDAS', 'ORDINÁRIO', 'REALIZADO', 'Aluguel do templo IBS', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-08-02'::date, 'SICREDI', 3670.77, 'OFERTAS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Oferta do culto — IBS', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-08-09'::date, 'SICREDI', 3587.54, 'OFERTAS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Oferta do culto — IBS', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-08-16'::date, 'SICREDI', 3911.19, 'OFERTAS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Oferta do culto — IBS', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-08-23'::date, 'SICREDI', 3313.56, 'OFERTAS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Oferta do culto — IBS', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-08-30'::date, 'SICREDI', 3865.63, 'OFERTAS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Oferta do culto — IBS', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-08-05'::date, 'SICREDI', 180.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Henrique Azevedo Pereira / IBS9003', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-08-06'::date, 'SICREDI', 197.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — José Rodrigues Vieira / IBS9004', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-08-07'::date, 'SICREDI', 214.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Wagner Oliveira Almeida / IBS9005', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-08-08'::date, 'SICREDI', 231.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Ricardo Lima Macedo / IBS9006', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-08-09'::date, 'SICREDI', 248.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Pedro Barros Ribeiro / IBS9007', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-08-10'::date, 'SICREDI', 265.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Carlos Oliveira Correia / IBS9008', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-08-11'::date, 'SICREDI', 282.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Samuel Farias Barbosa / IBS9009', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-08-12'::date, 'SICREDI', 299.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Júlio Carvalho Vasconcelos / IBS9010', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-08-13'::date, 'SICREDI', 316.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Gabriel Guimarães Machado / IBS9011', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-08-14'::date, 'SICREDI', 333.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Samuel Rezende Araujo / IBS9012', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-08-15'::date, 'SICREDI', 350.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — André Aguiar Rezende / IBS9013', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-08-16'::date, 'SICREDI', 367.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Felipe Castro Gomes / IBS9014', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-08-17'::date, 'SICREDI', 384.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Marcelo Nunes Ferreira / IBS9015', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-08-18'::date, 'SICREDI', 401.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Felipe Cunha Moreira / IBS9016', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-08-19'::date, 'SICREDI', 418.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — João Barbosa Oliveira / IBS9017', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-08-20'::date, 'SICREDI', 435.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Murilo Monteiro Machado / IBS9018', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-08-21'::date, 'SICREDI', 452.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Rafael Teixeira Correia / IBS9019', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-08-22'::date, 'SICREDI', 469.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — José Cardoso Machado / IBS9020', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-08-23'::date, 'SICREDI', 486.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Daniel Cardoso Farias / IBS9021', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-08-24'::date, 'SICREDI', 503.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — José Almeida Leal / IBS9022', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-08-05'::date, 'SICREDI', 520.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Caio Siqueira Santos / IBS9023', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-08-06'::date, 'SICREDI', 537.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Leandro Araujo Moreira / IBS9024', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-08-07'::date, 'SICREDI', 554.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Carlos Carvalho Duarte / IBS9025', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-08-08'::date, 'SICREDI', 571.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Daniel Barbosa Vasconcelos / IBS9026', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-08-09'::date, 'SICREDI', 588.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Enzo Moreira Barros / IBS9027', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-08-10'::date, 'SICREDI', 185.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Antônio Gomes Carvalho / IBS9028', null);

insert into public.financials (tenant_id, transaction_date, account, amount, ministry, transaction_kind, movement, budget_version, comments, campaign_project_id)
values
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-08-11'::date, 'SICREDI', 202.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Otávio Cardoso Teixeira / IBS9029', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-08-12'::date, 'SICREDI', 219.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Gustavo Queiroz Nogueira / IBS9030', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-08-13'::date, 'SICREDI', 236.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Sérgio Macedo Nogueira / IBS9031', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-08-14'::date, 'SICREDI', 253.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Carlos Mendes Barros / IBS9032', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-08-15'::date, 'SICREDI', 270.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — João Pinto Rodrigues / IBS9033', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-08-16'::date, 'SICREDI', 287.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Eduardo Oliveira Alves / IBS9034', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-08-17'::date, 'SICREDI', 304.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Cristiano Alves Almeida / IBS9035', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-08-18'::date, 'SICREDI', 321.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — João Moura Queiroz / IBS9036', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-08-19'::date, 'SICREDI', 338.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — João Cavalcanti Moura / IBS9037', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-08-20'::date, 'SICREDI', 355.00, 'DÍZIMOS', 'ENTRADAS', 'ORDINÁRIO', 'REALIZADO', 'Dízimo — Fábio Ribeiro Castro / IBS9038', null),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-07-15'::date, 'MPAGO', 150.17, 'CAMPANHAS', 'ENTRADAS', 'EXTRAORDINÁRIO', 'REALIZADO', 'Doação campanha Reforma do templo — Henrique Azevedo Pereira', 'c81295e3-9167-40b4-8524-000000007001'::uuid),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-07-16'::date, 'MPAGO', 190.17, 'CAMPANHAS', 'ENTRADAS', 'EXTRAORDINÁRIO', 'REALIZADO', 'Doação campanha Reforma do templo — José Rodrigues Vieira', 'c81295e3-9167-40b4-8524-000000007001'::uuid),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-07-17'::date, 'MPAGO', 230.17, 'CAMPANHAS', 'ENTRADAS', 'EXTRAORDINÁRIO', 'REALIZADO', 'Doação campanha Reforma do templo — Wagner Oliveira Almeida', 'c81295e3-9167-40b4-8524-000000007001'::uuid),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-07-18'::date, 'MPAGO', 270.17, 'CAMPANHAS', 'ENTRADAS', 'EXTRAORDINÁRIO', 'REALIZADO', 'Doação campanha Reforma do templo — Ricardo Lima Macedo', 'c81295e3-9167-40b4-8524-000000007001'::uuid),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-07-19'::date, 'MPAGO', 310.17, 'CAMPANHAS', 'ENTRADAS', 'EXTRAORDINÁRIO', 'REALIZADO', 'Doação campanha Reforma do templo — Pedro Barros Ribeiro', 'c81295e3-9167-40b4-8524-000000007001'::uuid),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-07-20'::date, 'MPAGO', 350.17, 'CAMPANHAS', 'ENTRADAS', 'EXTRAORDINÁRIO', 'REALIZADO', 'Doação campanha Reforma do templo — Carlos Oliveira Correia', 'c81295e3-9167-40b4-8524-000000007001'::uuid),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-07-22'::date, 'MPAGO', 175.31, 'CAMPANHAS', 'ENTRADAS', 'EXTRAORDINÁRIO', 'REALIZADO', 'Doação campanha Missões transculturais — Pedro Barros Ribeiro', 'c81295e3-9167-40b4-8524-000000007002'::uuid),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-07-23'::date, 'MPAGO', 215.31, 'CAMPANHAS', 'ENTRADAS', 'EXTRAORDINÁRIO', 'REALIZADO', 'Doação campanha Missões transculturais — Carlos Oliveira Correia', 'c81295e3-9167-40b4-8524-000000007002'::uuid),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-07-24'::date, 'MPAGO', 255.31, 'CAMPANHAS', 'ENTRADAS', 'EXTRAORDINÁRIO', 'REALIZADO', 'Doação campanha Missões transculturais — Samuel Farias Barbosa', 'c81295e3-9167-40b4-8524-000000007002'::uuid),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-07-25'::date, 'MPAGO', 295.31, 'CAMPANHAS', 'ENTRADAS', 'EXTRAORDINÁRIO', 'REALIZADO', 'Doação campanha Missões transculturais — Júlio Carvalho Vasconcelos', 'c81295e3-9167-40b4-8524-000000007002'::uuid),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-07-26'::date, 'MPAGO', 335.31, 'CAMPANHAS', 'ENTRADAS', 'EXTRAORDINÁRIO', 'REALIZADO', 'Doação campanha Missões transculturais — Gabriel Guimarães Machado', 'c81295e3-9167-40b4-8524-000000007002'::uuid),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-07-27'::date, 'MPAGO', 375.31, 'CAMPANHAS', 'ENTRADAS', 'EXTRAORDINÁRIO', 'REALIZADO', 'Doação campanha Missões transculturais — Samuel Rezende Araujo', 'c81295e3-9167-40b4-8524-000000007002'::uuid),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-07-29'::date, 'MPAGO', 200.48, 'CAMPANHAS', 'ENTRADAS', 'EXTRAORDINÁRIO', 'REALIZADO', 'Doação campanha Natal solidário do ABC — Gabriel Guimarães Machado', 'c81295e3-9167-40b4-8524-000000007003'::uuid),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-07-30'::date, 'MPAGO', 240.48, 'CAMPANHAS', 'ENTRADAS', 'EXTRAORDINÁRIO', 'REALIZADO', 'Doação campanha Natal solidário do ABC — Samuel Rezende Araujo', 'c81295e3-9167-40b4-8524-000000007003'::uuid),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-07-31'::date, 'MPAGO', 280.48, 'CAMPANHAS', 'ENTRADAS', 'EXTRAORDINÁRIO', 'REALIZADO', 'Doação campanha Natal solidário do ABC — André Aguiar Rezende', 'c81295e3-9167-40b4-8524-000000007003'::uuid),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-08-01'::date, 'MPAGO', 320.48, 'CAMPANHAS', 'ENTRADAS', 'EXTRAORDINÁRIO', 'REALIZADO', 'Doação campanha Natal solidário do ABC — Felipe Castro Gomes', 'c81295e3-9167-40b4-8524-000000007003'::uuid),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-08-02'::date, 'MPAGO', 360.48, 'CAMPANHAS', 'ENTRADAS', 'EXTRAORDINÁRIO', 'REALIZADO', 'Doação campanha Natal solidário do ABC — Marcelo Nunes Ferreira', 'c81295e3-9167-40b4-8524-000000007003'::uuid),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-08-03'::date, 'MPAGO', 400.48, 'CAMPANHAS', 'ENTRADAS', 'EXTRAORDINÁRIO', 'REALIZADO', 'Doação campanha Natal solidário do ABC — Felipe Cunha Moreira', 'c81295e3-9167-40b4-8524-000000007003'::uuid),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-08-05'::date, 'MPAGO', 225.62, 'CAMPANHAS', 'ENTRADAS', 'EXTRAORDINÁRIO', 'REALIZADO', 'Doação campanha Van do Ministério Infantil — Marcelo Nunes Ferreira', 'c81295e3-9167-40b4-8524-000000007004'::uuid),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-08-06'::date, 'MPAGO', 265.62, 'CAMPANHAS', 'ENTRADAS', 'EXTRAORDINÁRIO', 'REALIZADO', 'Doação campanha Van do Ministério Infantil — Felipe Cunha Moreira', 'c81295e3-9167-40b4-8524-000000007004'::uuid),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-08-07'::date, 'MPAGO', 305.62, 'CAMPANHAS', 'ENTRADAS', 'EXTRAORDINÁRIO', 'REALIZADO', 'Doação campanha Van do Ministério Infantil — João Barbosa Oliveira', 'c81295e3-9167-40b4-8524-000000007004'::uuid),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-08-08'::date, 'MPAGO', 345.62, 'CAMPANHAS', 'ENTRADAS', 'EXTRAORDINÁRIO', 'REALIZADO', 'Doação campanha Van do Ministério Infantil — Murilo Monteiro Machado', 'c81295e3-9167-40b4-8524-000000007004'::uuid),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-08-09'::date, 'MPAGO', 385.62, 'CAMPANHAS', 'ENTRADAS', 'EXTRAORDINÁRIO', 'REALIZADO', 'Doação campanha Van do Ministério Infantil — Rafael Teixeira Correia', 'c81295e3-9167-40b4-8524-000000007004'::uuid),
  ('81295e39-9167-40b4-a524-702439905e75'::uuid, '2026-08-10'::date, 'MPAGO', 425.62, 'CAMPANHAS', 'ENTRADAS', 'EXTRAORDINÁRIO', 'REALIZADO', 'Doação campanha Van do Ministério Infantil — José Cardoso Machado', 'c81295e3-9167-40b4-8524-000000007004'::uuid);

-- ---------------------------------------------------------------------------
-- 11. Escalas com troca, pedidos de oração e agenda pastoral
-- ---------------------------------------------------------------------------
insert into public.tipos_escala (id, tenant_id, codigo, nome, is_ativa, vagas_por_servico, modo_ciclo, allow_swap)
values ('c81295e3-9167-40b4-8524-000000007100'::uuid, '81295e39-9167-40b4-a524-702439905e75'::uuid, 'ibs_acolhimento_estacionamento', 'Acolhimento / Estacionamento', true, 4, 'equipe', true);
insert into public.voluntarios_escala (id, tenant_id, tipo_escala_id, nome, is_ativo, ordem_sequencial)
values ('c81295e3-9167-40b4-8524-000000007200'::uuid, '81295e39-9167-40b4-a524-702439905e75'::uuid, 'c81295e3-9167-40b4-8524-000000007100'::uuid, 'Pedro Barros Ribeiro', true, 1);
insert into public.escalas_log (tenant_id, tipo_escala_id, voluntario_id, data_servico)
values ('81295e39-9167-40b4-a524-702439905e75'::uuid, 'c81295e3-9167-40b4-8524-000000007100'::uuid, 'c81295e3-9167-40b4-8524-000000007200'::uuid, '2026-09-13'::date);
insert into public.voluntarios_escala (id, tenant_id, tipo_escala_id, nome, is_ativo, ordem_sequencial)
values ('c81295e3-9167-40b4-8524-000000007201'::uuid, '81295e39-9167-40b4-a524-702439905e75'::uuid, 'c81295e3-9167-40b4-8524-000000007100'::uuid, 'Beatriz Ribeiro Barros', true, 2);
insert into public.escalas_log (tenant_id, tipo_escala_id, voluntario_id, data_servico)
values ('81295e39-9167-40b4-a524-702439905e75'::uuid, 'c81295e3-9167-40b4-8524-000000007100'::uuid, 'c81295e3-9167-40b4-8524-000000007201'::uuid, '2026-09-13'::date);
insert into public.voluntarios_escala (id, tenant_id, tipo_escala_id, nome, is_ativo, ordem_sequencial)
values ('c81295e3-9167-40b4-8524-000000007202'::uuid, '81295e39-9167-40b4-a524-702439905e75'::uuid, 'c81295e3-9167-40b4-8524-000000007100'::uuid, 'Carlos Oliveira Correia', true, 3);
insert into public.escalas_log (tenant_id, tipo_escala_id, voluntario_id, data_servico)
values ('81295e39-9167-40b4-a524-702439905e75'::uuid, 'c81295e3-9167-40b4-8524-000000007100'::uuid, 'c81295e3-9167-40b4-8524-000000007202'::uuid, '2026-09-13'::date);
insert into public.voluntarios_escala (id, tenant_id, tipo_escala_id, nome, is_ativo, ordem_sequencial)
values ('c81295e3-9167-40b4-8524-000000007203'::uuid, '81295e39-9167-40b4-a524-702439905e75'::uuid, 'c81295e3-9167-40b4-8524-000000007100'::uuid, 'Eliane Correia Oliveira', true, 4);
insert into public.escalas_log (tenant_id, tipo_escala_id, voluntario_id, data_servico)
values ('81295e39-9167-40b4-a524-702439905e75'::uuid, 'c81295e3-9167-40b4-8524-000000007100'::uuid, 'c81295e3-9167-40b4-8524-000000007203'::uuid, '2026-09-13'::date);
insert into public.voluntarios_escala (id, tenant_id, tipo_escala_id, nome, is_ativo, ordem_sequencial)
values ('c81295e3-9167-40b4-8524-000000007204'::uuid, '81295e39-9167-40b4-a524-702439905e75'::uuid, 'c81295e3-9167-40b4-8524-000000007100'::uuid, 'Samuel Farias Barbosa', true, 5);
insert into public.voluntarios_escala (id, tenant_id, tipo_escala_id, nome, is_ativo, ordem_sequencial)
values ('c81295e3-9167-40b4-8524-000000007205'::uuid, '81295e39-9167-40b4-a524-702439905e75'::uuid, 'c81295e3-9167-40b4-8524-000000007100'::uuid, 'Ingrid Barbosa Farias', true, 6);
insert into public.voluntarios_escala (id, tenant_id, tipo_escala_id, nome, is_ativo, ordem_sequencial)
values ('c81295e3-9167-40b4-8524-000000007206'::uuid, '81295e39-9167-40b4-a524-702439905e75'::uuid, 'c81295e3-9167-40b4-8524-000000007100'::uuid, 'Júlio Carvalho Vasconcelos', true, 7);
insert into public.voluntarios_escala (id, tenant_id, tipo_escala_id, nome, is_ativo, ordem_sequencial)
values ('c81295e3-9167-40b4-8524-000000007207'::uuid, '81295e39-9167-40b4-a524-702439905e75'::uuid, 'c81295e3-9167-40b4-8524-000000007100'::uuid, 'Carolina Vasconcelos Carvalho', true, 8);

insert into public.tipos_escala (id, tenant_id, codigo, nome, is_ativa, vagas_por_servico, modo_ciclo, allow_swap)
values ('c81295e3-9167-40b4-8524-000000007101'::uuid, '81295e39-9167-40b4-a524-702439905e75'::uuid, 'ibs_ministerio_infantil', 'Ministério Infantil', true, 3, 'equipe', true);
insert into public.voluntarios_escala (id, tenant_id, tipo_escala_id, nome, is_ativo, ordem_sequencial)
values ('c81295e3-9167-40b4-8524-000000007210'::uuid, '81295e39-9167-40b4-a524-702439905e75'::uuid, 'c81295e3-9167-40b4-8524-000000007101'::uuid, 'Gabriel Guimarães Machado', true, 1);
insert into public.escalas_log (tenant_id, tipo_escala_id, voluntario_id, data_servico)
values ('81295e39-9167-40b4-a524-702439905e75'::uuid, 'c81295e3-9167-40b4-8524-000000007101'::uuid, 'c81295e3-9167-40b4-8524-000000007210'::uuid, '2026-09-13'::date);
insert into public.voluntarios_escala (id, tenant_id, tipo_escala_id, nome, is_ativo, ordem_sequencial)
values ('c81295e3-9167-40b4-8524-000000007211'::uuid, '81295e39-9167-40b4-a524-702439905e75'::uuid, 'c81295e3-9167-40b4-8524-000000007101'::uuid, 'Natália Machado Guimarães', true, 2);
insert into public.escalas_log (tenant_id, tipo_escala_id, voluntario_id, data_servico)
values ('81295e39-9167-40b4-a524-702439905e75'::uuid, 'c81295e3-9167-40b4-8524-000000007101'::uuid, 'c81295e3-9167-40b4-8524-000000007211'::uuid, '2026-09-13'::date);
insert into public.voluntarios_escala (id, tenant_id, tipo_escala_id, nome, is_ativo, ordem_sequencial)
values ('c81295e3-9167-40b4-8524-000000007212'::uuid, '81295e39-9167-40b4-a524-702439905e75'::uuid, 'c81295e3-9167-40b4-8524-000000007101'::uuid, 'Samuel Rezende Araujo', true, 3);
insert into public.escalas_log (tenant_id, tipo_escala_id, voluntario_id, data_servico)
values ('81295e39-9167-40b4-a524-702439905e75'::uuid, 'c81295e3-9167-40b4-8524-000000007101'::uuid, 'c81295e3-9167-40b4-8524-000000007212'::uuid, '2026-09-13'::date);
insert into public.voluntarios_escala (id, tenant_id, tipo_escala_id, nome, is_ativo, ordem_sequencial)
values ('c81295e3-9167-40b4-8524-000000007213'::uuid, '81295e39-9167-40b4-a524-702439905e75'::uuid, 'c81295e3-9167-40b4-8524-000000007101'::uuid, 'Aparecida Araujo Rezende', true, 4);
insert into public.voluntarios_escala (id, tenant_id, tipo_escala_id, nome, is_ativo, ordem_sequencial)
values ('c81295e3-9167-40b4-8524-000000007214'::uuid, '81295e39-9167-40b4-a524-702439905e75'::uuid, 'c81295e3-9167-40b4-8524-000000007101'::uuid, 'André Aguiar Rezende', true, 5);
insert into public.voluntarios_escala (id, tenant_id, tipo_escala_id, nome, is_ativo, ordem_sequencial)
values ('c81295e3-9167-40b4-8524-000000007215'::uuid, '81295e39-9167-40b4-a524-702439905e75'::uuid, 'c81295e3-9167-40b4-8524-000000007101'::uuid, 'Helena Rezende Aguiar', true, 6);
insert into public.voluntarios_escala (id, tenant_id, tipo_escala_id, nome, is_ativo, ordem_sequencial)
values ('c81295e3-9167-40b4-8524-000000007216'::uuid, '81295e39-9167-40b4-a524-702439905e75'::uuid, 'c81295e3-9167-40b4-8524-000000007101'::uuid, 'Felipe Castro Gomes', true, 7);
insert into public.voluntarios_escala (id, tenant_id, tipo_escala_id, nome, is_ativo, ordem_sequencial)
values ('c81295e3-9167-40b4-8524-000000007217'::uuid, '81295e39-9167-40b4-a524-702439905e75'::uuid, 'c81295e3-9167-40b4-8524-000000007101'::uuid, 'Simone Gomes Castro', true, 8);

insert into public.tipos_escala (id, tenant_id, codigo, nome, is_ativa, vagas_por_servico, modo_ciclo, allow_swap)
values ('c81295e3-9167-40b4-8524-000000007102'::uuid, '81295e39-9167-40b4-a524-702439905e75'::uuid, 'ibs_louvor', 'Ministério de Louvor', true, 1, 'individual', true);
insert into public.voluntarios_escala (id, tenant_id, tipo_escala_id, nome, is_ativo, ordem_sequencial)
values ('c81295e3-9167-40b4-8524-000000007220'::uuid, '81295e39-9167-40b4-a524-702439905e75'::uuid, 'c81295e3-9167-40b4-8524-000000007102'::uuid, 'Marcelo Nunes Ferreira', true, 1);
insert into public.escalas_log (tenant_id, tipo_escala_id, voluntario_id, data_servico)
values ('81295e39-9167-40b4-a524-702439905e75'::uuid, 'c81295e3-9167-40b4-8524-000000007102'::uuid, 'c81295e3-9167-40b4-8524-000000007220'::uuid, '2026-09-13'::date);
insert into public.voluntarios_escala (id, tenant_id, tipo_escala_id, nome, is_ativo, ordem_sequencial)
values ('c81295e3-9167-40b4-8524-000000007221'::uuid, '81295e39-9167-40b4-a524-702439905e75'::uuid, 'c81295e3-9167-40b4-8524-000000007102'::uuid, 'Priscila Ferreira Nunes', true, 2);
insert into public.voluntarios_escala (id, tenant_id, tipo_escala_id, nome, is_ativo, ordem_sequencial)
values ('c81295e3-9167-40b4-8524-000000007222'::uuid, '81295e39-9167-40b4-a524-702439905e75'::uuid, 'c81295e3-9167-40b4-8524-000000007102'::uuid, 'Felipe Cunha Moreira', true, 3);
insert into public.voluntarios_escala (id, tenant_id, tipo_escala_id, nome, is_ativo, ordem_sequencial)
values ('c81295e3-9167-40b4-8524-000000007223'::uuid, '81295e39-9167-40b4-a524-702439905e75'::uuid, 'c81295e3-9167-40b4-8524-000000007102'::uuid, 'Eliane Moreira Cunha', true, 4);
insert into public.voluntarios_escala (id, tenant_id, tipo_escala_id, nome, is_ativo, ordem_sequencial)
values ('c81295e3-9167-40b4-8524-000000007224'::uuid, '81295e39-9167-40b4-a524-702439905e75'::uuid, 'c81295e3-9167-40b4-8524-000000007102'::uuid, 'João Barbosa Oliveira', true, 5);
insert into public.voluntarios_escala (id, tenant_id, tipo_escala_id, nome, is_ativo, ordem_sequencial)
values ('c81295e3-9167-40b4-8524-000000007225'::uuid, '81295e39-9167-40b4-a524-702439905e75'::uuid, 'c81295e3-9167-40b4-8524-000000007102'::uuid, 'Fabiana Oliveira Barbosa', true, 6);
insert into public.voluntarios_escala (id, tenant_id, tipo_escala_id, nome, is_ativo, ordem_sequencial)
values ('c81295e3-9167-40b4-8524-000000007226'::uuid, '81295e39-9167-40b4-a524-702439905e75'::uuid, 'c81295e3-9167-40b4-8524-000000007102'::uuid, 'Murilo Monteiro Machado', true, 7);
insert into public.voluntarios_escala (id, tenant_id, tipo_escala_id, nome, is_ativo, ordem_sequencial)
values ('c81295e3-9167-40b4-8524-000000007227'::uuid, '81295e39-9167-40b4-a524-702439905e75'::uuid, 'c81295e3-9167-40b4-8524-000000007102'::uuid, 'Bianca Machado Monteiro', true, 8);

insert into public.scale_swap_requests (
  tenant_id, tipo_escala_id, data_servico, solicitante_profile_id, substituto_profile_id,
  voluntario_id_origem, voluntario_id_substituto, status, motivo
)
select '81295e39-9167-40b4-a524-702439905e75'::uuid, te.id, el.data_servico,
       p1.id, p2.id, el.voluntario_id, v2.id, 'pendente',
       'Viagem familiar no fim de semana; peço cobertura no Acolhimento.'
  from public.tipos_escala te
  join public.escalas_log el on el.tipo_escala_id = te.id
  join public.voluntarios_escala v1 on v1.id = el.voluntario_id
  join public.profiles p1 on p1.full_name = v1.nome and p1.tenant_id = '81295e39-9167-40b4-a524-702439905e75'::uuid
  join public.voluntarios_escala v2 on v2.tipo_escala_id = te.id and v2.id <> v1.id
  join public.profiles p2 on p2.full_name = v2.nome and p2.tenant_id = '81295e39-9167-40b4-a524-702439905e75'::uuid
 where te.codigo = 'ibs_acolhimento_estacionamento'
 order by v2.ordem_sequencial
 limit 1;

insert into public.pastoral_requests (
  tenant_id, profile_id, phone, motivo, situacao, description, category_id, subcategory_id,
  destination_label, confidential, request_for, status, urgency_level, target_role, contact_preference
) values (
  '81295e39-9167-40b4-a524-702439905e75'::uuid, 'c81295e3-9167-40b4-8524-000000000002'::uuid, '(11) 98810-0002', 'Cirurgia de joelho da esposa', 'Fila do SUS com data marcada para outubro',
  'Fila do SUS com data marcada para outubro', '10000000-0000-4000-8000-000000000001'::uuid, '20000000-0000-4000-8000-000000000002'::uuid, 'Equipe pastoral', true, 'family',
  'new', 2, 'pastor', 'message'
);
insert into public.pastoral_requests (
  tenant_id, profile_id, phone, motivo, situacao, description, category_id, subcategory_id,
  destination_label, confidential, request_for, status, urgency_level, target_role, contact_preference
) values (
  '81295e39-9167-40b4-a524-702439905e75'::uuid, 'c81295e3-9167-40b4-8524-000000000006'::uuid, '(11) 98810-0004', 'Desemprego prolongado', 'Três meses sem renda fixa, aluguel atrasado',
  'Três meses sem renda fixa, aluguel atrasado', '10000000-0000-4000-8000-000000000003'::uuid, '20000000-0000-4000-8000-000000000022'::uuid, 'Equipe pastoral', true, 'self',
  'new', 2, 'pastor', 'message'
);
insert into public.pastoral_requests (
  tenant_id, profile_id, phone, motivo, situacao, description, category_id, subcategory_id,
  destination_label, confidential, request_for, status, urgency_level, target_role, contact_preference
) values (
  '81295e39-9167-40b4-a524-702439905e75'::uuid, 'c81295e3-9167-40b4-8524-000000000009'::uuid, '(11) 98810-0005', 'Filho adolescente afastado da fé', 'Conflitos em casa e recusa em vir aos cultos',
  'Conflitos em casa e recusa em vir aos cultos', '10000000-0000-4000-8000-000000000002'::uuid, '20000000-0000-4000-8000-000000000017'::uuid, 'Equipe pastoral', false, 'family',
  'new', 1, 'pastor', 'message'
);
insert into public.pastoral_requests (
  tenant_id, profile_id, phone, motivo, situacao, description, category_id, subcategory_id,
  destination_label, confidential, request_for, status, urgency_level, target_role, contact_preference
) values (
  '81295e39-9167-40b4-a524-702439905e75'::uuid, 'c81295e3-9167-40b4-8524-000000000010'::uuid, '(11) 98810-0006', 'Ansiedade e insônia', 'Acompanhamento médico iniciado, pede intercessão',
  'Acompanhamento médico iniciado, pede intercessão', '10000000-0000-4000-8000-000000000001'::uuid, '20000000-0000-4000-8000-000000000006'::uuid, 'Equipe pastoral', true, 'self',
  'new', 1, 'pastor', 'message'
);
insert into public.pastoral_requests (
  tenant_id, profile_id, phone, motivo, situacao, description, category_id, subcategory_id,
  destination_label, confidential, request_for, status, urgency_level, target_role, contact_preference
) values (
  '81295e39-9167-40b4-a524-702439905e75'::uuid, 'c81295e3-9167-40b4-8524-000000000013'::uuid, '(11) 98810-0007', 'Ações de graças pelo emprego novo', 'Contrato assinado na última sexta-feira',
  'Contrato assinado na última sexta-feira', '10000000-0000-4000-8000-000000000005'::uuid, '20000000-0000-4000-8000-000000000046'::uuid, 'Equipe pastoral', false, 'self',
  'new', 1, 'pastor', 'message'
);
insert into public.pastoral_requests (
  tenant_id, profile_id, phone, motivo, situacao, description, category_id, subcategory_id,
  destination_label, confidential, request_for, status, urgency_level, target_role, contact_preference
) values (
  '81295e39-9167-40b4-a524-702439905e75'::uuid, 'c81295e3-9167-40b4-8524-000000000014'::uuid, '(11) 98810-0008', 'Proteção na viagem missionária', 'Equipe saindo para o interior no próximo mês',
  'Equipe saindo para o interior no próximo mês', '10000000-0000-4000-8000-000000000004'::uuid, '20000000-0000-4000-8000-000000000042'::uuid, 'Equipe pastoral', false, 'self',
  'new', 1, 'pastor', 'message'
);

-- Agenda pastoral: seg–sex, 08h–21h, próximos 21 dias úteis
insert into public.pastoral_slots (
  tenant_id, pastor_id, data_hora_inicio, data_hora_fim, status, tipo_atendimento, is_published, created_by_profile_id
)
select '81295e39-9167-40b4-a524-702439905e75'::uuid, p.id,
       ts, ts + interval '50 minutes', 'disponivel',
       case when extract(hour from ts) >= 18 then 'online' else 'presencial' end,
       true, '04b919ba-38b4-4fe5-a371-2e98e9acbc0d'::uuid
  from (values
    ('c81295e3-9167-40b4-8524-000000000001'::uuid),
    ('c81295e3-9167-40b4-8524-000000000005'::uuid)
  ) as p(id)
  cross join generate_series(
    date '2026-09-11', date '2026-10-09', interval '1 day'
  ) as d(day)
  cross join (values (time '08:00'), (time '10:30'), (time '14:00'), (time '16:30'), (time '19:00')) as h(hh)
  cross join lateral (
    select (d.day + h.hh) at time zone 'America/Sao_Paulo' as ts
  ) x
 where extract(isodow from d.day) between 1 and 5
   and mod(abs(hashtext(p.id::text || d.day::text || h.hh::text)), 3) = 0;

commit;

-- Conferência (não altera dados)
select 'IBS_profiles_login' as metric, count(*)::text as value
  from public.profiles p
  join public.profile_igreja_vinculos v on v.profile_id = p.id and v.tenant_id = '81295e39-9167-40b4-a524-702439905e75'::uuid and v.is_active
 where p.is_active and p.family_id ~ '^IBS9[0-9]{3}$'
union all select 'IBS_members', count(*)::text from public.members m where m.tenant_id = '81295e39-9167-40b4-a524-702439905e75'::uuid
union all select 'IBS_rooms', count(*)::text from public.church_room_settings r where r.tenant_id = '81295e39-9167-40b4-a524-702439905e75'::uuid
union all select 'IBS_livros', count(*)::text from public.livros l where l.tenant_id = '81295e39-9167-40b4-a524-702439905e75'::uuid
union all select 'IBS_events', count(*)::text from public.events e where e.tenant_id = '81295e39-9167-40b4-a524-702439905e75'::uuid
union all select 'IBS_campaigns', count(*)::text from public.campaign_projects c where c.tenant_id = '81295e39-9167-40b4-a524-702439905e75'::uuid
union all select 'IBS_avisos', count(*)::text from public.event_avisos a where a.tenant_id = '81295e39-9167-40b4-a524-702439905e75'::uuid
union all select 'IBS_celulas', count(*)::text from public.small_groups g where g.tenant_id = '81295e39-9167-40b4-a524-702439905e75'::uuid
union all select 'IBS_recepcao_pending', count(*)::text from public.recepcao_cadastro_familiar_lote l where l.tenant_id = '81295e39-9167-40b4-a524-702439905e75'::uuid and l.status = 'pending'
union all select 'IBS_financials', count(*)::text from public.financials f where f.tenant_id = '81295e39-9167-40b4-a524-702439905e75'::uuid
union all select 'IBN_vinculos', count(*)::text from public.profile_igreja_vinculos v where v.tenant_id = 'a0000000-0000-4000-8000-000000000001'::uuid and v.is_active
union all select 'IBN_financials', count(*)::text from public.financials f where f.tenant_id = 'a0000000-0000-4000-8000-000000000001'::uuid
union all select 'IBEP_vinculos', count(*)::text from public.profile_igreja_vinculos v where v.tenant_id = '68b9e46e-a5e9-45b5-9124-ffa3447d14f4'::uuid and v.is_active;
