-- Papel Orquestrador de Evento: guia membros em tempo real via /admin/orquestrador.
-- Execute no SQL Editor do Supabase após access-control-schema.sql e event-control-orchestration.sql.

-- ---------------------------------------------------------------------------
-- Papel orquestrador_evento
-- ---------------------------------------------------------------------------

insert into public.access_roles (code, name, description, is_system)
values (
  'orquestrador_evento',
  'Orquestrador de Evento',
  'Conduz o culto em tempo real: altera a rota ativa no orquestrador e guia os membros conectados',
  true
)
on conflict (code) do update
  set name = excluded.name,
      description = excluded.description,
      is_system = excluded.is_system;

insert into public.access_resources (resource_type, resource_key, label, description, is_active)
values
  (
    'screen',
    '/admin/orquestrador',
    'Orquestrador do evento (/admin/orquestrador)',
    'Painel para alterar a rota ativa e guiar membros em tempo real',
    true
  ),
  (
    'screen',
    'maintenance.card.event_orchestration',
    'Manutenção — Orquestração do Evento',
    'Card na manutenção para conduzir membros em tempo real durante o culto',
    true
  ),
  (
    'table',
    'event_control',
    'Orquestração do evento (event_control)',
    'Sinal em tempo real da rota ativa do culto',
    true
  )
on conflict (resource_type, resource_key) do update
  set label = coalesce(excluded.label, public.access_resources.label),
      description = coalesce(excluded.description, public.access_resources.description),
      is_active = true;

insert into public.access_grants (role_id, resource_id, can_view, can_update)
select r.id, res.id, g.can_view, g.can_update
  from public.access_roles r
 cross join (
    values
      ('screen', '/admin/orquestrador', true, true),
      ('screen', 'maintenance.card.event_orchestration', true, true),
      ('table', 'event_control', true, true)
  ) as g(resource_type, resource_key, can_view, can_update)
  join public.access_resources res
    on res.resource_type = g.resource_type
   and res.resource_key = g.resource_key
 where r.code = 'orquestrador_evento'
on conflict (role_id, resource_id) where (role_id is not null) do update
  set can_view = excluded.can_view,
      can_update = excluded.can_update,
      updated_at = now();

-- ---------------------------------------------------------------------------
-- Permissão de gerenciamento (RPC event_control)
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
    or public.profile_has_role_code(p_profile_id, 'orquestrador_evento');
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
    when 'lider' then 45
    when 'events_admin' then 50
    when 'orquestrador_evento' then 52
    when 'tesoureiro' then 55
    when 'pastoral' then 60
    when 'super_admin' then 70
    else 100
  end;
$$;

grant execute on function public.access_role_display_order(text) to anon, authenticated;

notify pgrst, 'reload schema';
