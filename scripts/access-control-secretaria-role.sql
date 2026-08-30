-- Papel Secretaria: operação da igreja (eventos, escalas, salas, totem, células,
-- recepção familiar e avisos), sem Cuidado Pastoral nem finanças globais.
-- Isolamento por tenant_id permanece nas RPCs/RLS da sessão (sem curinga `*`).
-- Super_admin não é alterado.
--
-- Execute após access-control-schema.sql e os scripts de salas/escalas/orquestrador.

-- ---------------------------------------------------------------------------
-- Papel
-- ---------------------------------------------------------------------------

insert into public.access_roles (code, name, description, is_system)
values (
  'secretaria',
  'Secretaria',
  'Operação da igreja: eventos, escalas, salas, totem, pequenos grupos, recepção familiar e avisos. Sem Cuidado Pastoral nem finanças globais.',
  true
)
on conflict (code) do update
  set name = excluded.name,
      description = excluded.description,
      is_system = excluded.is_system;

-- ---------------------------------------------------------------------------
-- Recursos usados pelo papel (idempotente)
-- ---------------------------------------------------------------------------

insert into public.access_resources (resource_type, resource_key, label, description, is_active)
values
  ('screen', '/maintenance-dashboard', 'Manutenção', null, true),
  ('screen', '/configuracao-salas', 'Configuração de salas', null, true),
  ('screen', '/totem-checkin', 'Totem de check-in', null, true),
  ('screen', '/admin/orquestrador', 'Orquestrador do evento', null, true),
  ('screen', '/autorizacao-midia', 'Autorização de imagem e voz', null, true),
  ('screen', 'maintenance.card.events', 'Manutenção — Programação de eventos', null, true),
  ('screen', 'maintenance.card.events_gantt', 'Manutenção — Cronograma de eventos', null, true),
  ('screen', 'maintenance.card.sala_servidor', 'Manutenção — Servidor de salas', null, true),
  ('screen', 'maintenance.card.quorum_presence', 'Manutenção — Lista de presença (quórum)', null, true),
  ('screen', 'maintenance.card.scale_types', 'Manutenção: Tipos de Escala', null, true),
  ('screen', 'maintenance.card.scale_volunteers', 'Manutenção: Servos em Disponibilidade', null, true),
  ('screen', 'maintenance.card.scales', 'Manutenção: Programação de Escalas', null, true),
  ('screen', 'maintenance.card.small_groups_management', 'Gestão de Pequenos Grupos', null, true),
  ('screen', 'maintenance.card.profile_cadastro', 'Manutenção — Cadastro / Recepção familiar', null, true),
  ('screen', 'maintenance.card.event_orchestration', 'Manutenção — Orquestração do Evento', null, true),
  ('screen', 'dashboard.card.vigilance_scales', 'Card Escalas', null, true),
  ('screen', 'dashboard.card.small_group', 'Card Pequeno Grupo', null, true),
  ('table', 'events', 'Eventos', null, true),
  ('table', 'event_registrations', 'Inscrições em eventos', null, true),
  ('table', 'church_room_settings', 'Configuração de salas', null, true),
  ('table', 'user_room_assignment', 'Atribuição de membros às salas', null, true),
  ('table', 'tipos_escala', 'Tipos de escala', null, true),
  ('table', 'voluntarios_escala', 'Voluntários de escala', null, true),
  ('table', 'escalas_log', 'Registro de escalas', null, true),
  ('table', 'small_groups', 'Pequenos grupos', null, true),
  ('table', 'event_control', 'Orquestração do evento (event_control)', null, true),
  ('table', 'event_avisos', 'Avisos do culto (event_avisos)', null, true)
on conflict (resource_type, resource_key) do update
  set label = coalesce(excluded.label, public.access_resources.label),
      description = coalesce(excluded.description, public.access_resources.description),
      is_active = true;

-- ---------------------------------------------------------------------------
-- Navegação do app (espelha member), sem finanças globais nem Cuidado Pastoral
-- ---------------------------------------------------------------------------

insert into public.access_grants (role_id, resource_id, can_view, can_update)
select secretaria.id, member_grant.resource_id, member_grant.can_view, member_grant.can_update
  from public.access_roles secretaria
  join public.access_roles member_role on member_role.code = 'member'
  join public.access_grants member_grant on member_grant.role_id = member_role.id
  join public.access_resources res on res.id = member_grant.resource_id
 where secretaria.code = 'secretaria'
   and not (
     (res.resource_type = 'screen' and res.resource_key in (
       '/financial',
       '/expense-report',
       'dashboard.card.financial',
       'maintenance.card.financials',
       'maintenance.card.pastoral_care',
       'maintenance.pastoral.agenda',
       'dashboard.pastoral.schedule'
     ))
     or (res.resource_type = 'table' and res.resource_key in (
       'financials',
       'pastoral_reason_categories',
       'pastoral_reason_subcategories'
     ))
   )
on conflict (role_id, resource_id) where (role_id is not null) do update
  set can_view = excluded.can_view,
      can_update = excluded.can_update,
      updated_at = now();

-- ---------------------------------------------------------------------------
-- Grants operacionais exclusivos da Secretaria
-- ---------------------------------------------------------------------------

insert into public.access_grants (role_id, resource_id, can_view, can_update)
select r.id, res.id, g.can_view, g.can_update
  from public.access_roles r
 cross join (
    values
      ('screen', '/maintenance-dashboard', true, false),
      ('screen', '/configuracao-salas', true, true),
      ('screen', '/totem-checkin', true, true),
      ('screen', '/admin/orquestrador', true, true),
      ('screen', '/autorizacao-midia', true, true),
      ('screen', 'maintenance.card.events', true, true),
      ('screen', 'maintenance.card.events_gantt', true, true),
      ('screen', 'maintenance.card.sala_servidor', true, true),
      ('screen', 'maintenance.card.quorum_presence', true, true),
      ('screen', 'maintenance.card.scale_types', true, true),
      ('screen', 'maintenance.card.scale_volunteers', true, true),
      ('screen', 'maintenance.card.scales', true, true),
      ('screen', 'maintenance.card.small_groups_management', true, true),
      ('screen', 'maintenance.card.profile_cadastro', true, true),
      ('screen', 'maintenance.card.event_orchestration', true, true),
      ('screen', 'dashboard.card.vigilance_scales', true, false),
      ('screen', 'dashboard.card.small_group', true, false),
      ('table', 'events', true, true),
      ('table', 'event_registrations', true, true),
      ('table', 'church_room_settings', true, true),
      ('table', 'user_room_assignment', true, true),
      ('table', 'tipos_escala', true, true),
      ('table', 'voluntarios_escala', true, true),
      ('table', 'escalas_log', true, true),
      ('table', 'small_groups', true, true),
      ('table', 'event_control', true, true),
      ('table', 'event_avisos', true, true)
  ) as g(resource_type, resource_key, can_view, can_update)
  join public.access_resources res
    on res.resource_type = g.resource_type
   and res.resource_key = g.resource_key
 where r.code = 'secretaria'
on conflict (role_id, resource_id) where (role_id is not null) do update
  set can_view = excluded.can_view,
      can_update = excluded.can_update,
      updated_at = now();

-- Autorização de mídia: Secretaria (absorveu liderança de eventos) e Equipe Pastoral.
insert into public.access_grants (role_id, resource_id, can_view, can_update)
select r.id, res.id, true, true
  from public.access_roles r
  join public.access_resources res
    on res.resource_type = 'screen'
   and res.resource_key = '/autorizacao-midia'
 where r.code in ('secretaria', 'pastoral')
on conflict (role_id, resource_id) where (role_id is not null) do update
  set can_view = true,
      can_update = true,
      updated_at = now();

-- Garante que Secretaria não receba Cuidado Pastoral nem finanças globais
-- (inclusive se um grant tiver sido copiado de member no passado).
delete from public.access_grants ag
 using public.access_roles r,
       public.access_resources res
 where ag.role_id = r.id
   and ag.resource_id = res.id
   and r.code = 'secretaria'
   and (
     (res.resource_type = 'screen' and res.resource_key in (
       'maintenance.card.pastoral_care',
       'maintenance.pastoral.agenda',
       'dashboard.pastoral.schedule',
       'maintenance.card.financials',
       'maintenance.card.predictive_insights',
       'maintenance.card.relatorios',
       '/financial',
       '/expense-report',
       'dashboard.card.financial',
       'maintenance.card.access_control',
       'maintenance.card.auditor',
       'maintenance.card.mudanca_papeis'
     ))
     or (res.resource_type = 'table' and res.resource_key = 'financials')
   );

-- ---------------------------------------------------------------------------
-- Avisos / orquestrador: grant de tela passa a autorizar (além do papel dedicado)
-- ---------------------------------------------------------------------------

create or replace function public.profile_is_event_control_admin(p_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_super_admin_profile(p_profile_id)
    or public.profile_has_role_code(p_profile_id, 'secretaria')
    or public.profile_has_access(p_profile_id, 'screen', 'maintenance.card.event_orchestration', 'update');
$$;

create or replace function public.profile_can_manage_event_control(p_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.profile_is_event_control_admin(p_profile_id);
$$;

grant execute on function public.profile_is_event_control_admin(uuid) to anon, authenticated;
grant execute on function public.profile_can_manage_event_control(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Mudança de papéis pastoral: não alterar Secretaria / Super Admin / Equipe Pastoral
-- ---------------------------------------------------------------------------

create or replace function public.profile_has_protected_role_for_pastoral_change(p_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.profile_access_roles par
      join public.access_roles ar on ar.id = par.role_id
     where par.profile_id = p_profile_id
       and ar.code in ('super_admin', 'pastoral', 'secretaria')
  );
$$;

-- ---------------------------------------------------------------------------
-- Ordem no painel Papéis
-- ---------------------------------------------------------------------------

create or replace function public.access_role_display_order(p_code text)
returns integer
language sql
immutable
as $$
  select case lower(trim(coalesce(p_code, '')))
    when 'visitantes' then 10
    when 'congregado' then 20
    when 'member' then 30
    when 'family_acceptor' then 40
    when 'secretaria' then 50
    when 'tesoureiro' then 55
    when 'pastoral' then 60
    when 'gestor_controle_acesso' then 65
    when 'super_admin' then 70
    else 100
  end;
$$;

grant execute on function public.access_role_display_order(text) to anon, authenticated;
grant execute on function public.profile_has_protected_role_for_pastoral_change(uuid) to anon, authenticated;

notify pgrst, 'reload schema';
