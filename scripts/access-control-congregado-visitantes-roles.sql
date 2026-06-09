-- Garante os papéis Congregado e Visitantes na UI (Manutenção → Controle de Acesso).
-- Execute no SQL Editor do Supabase se esses papéis não aparecerem na tela.
-- Idempotente: pode rodar mais de uma vez.

insert into public.access_roles (code, name, description, is_system)
values
  (
    'congregado',
    'Congregado',
    'Participante cadastrado com acesso básico; sem gerência familiar',
    true
  ),
  (
    'visitantes',
    'Visitantes',
    'Acesso público mínimo: login, cadastro e check-in; usado quando não há perfil/papéis na sessão',
    true
  )
on conflict (code) do update
  set name = excluded.name,
      description = excluded.description,
      is_system = excluded.is_system;

-- access_role_display_order: script canônico em access-control-role-display-order.sql

-- Grants Congregado (ajuste depois na UI admin)
insert into public.access_grants (role_id, resource_id, can_view, can_update)
select r.id, res.id, g.can_view, g.can_update
  from public.access_roles r
 cross join (
    values
      ('screen', '/dashboard', true, false),
      ('screen', '/manage-profile', true, true),
      ('screen', '/pastoral', true, true),
      ('screen', '/pastoral-history', true, false),
      ('screen', '/lgpd', true, true),
      ('screen', 'dashboard.card.event_alt', true, false),
      ('screen', 'dashboard.card.qr', true, false),
      ('screen', 'dashboard.card.kids_teens', true, false),
      ('screen', 'dashboard.card.offerings', true, false),
      ('screen', 'dashboard.card.pastoral', true, false),
      ('screen', 'dashboard.card.birthdays', true, false),
      ('screen', 'dashboard.card.grouped_manage', true, false),
      ('table', 'profiles', true, true),
      ('table', 'pastoral_requests', true, true),
      ('column', 'profiles.full_name', true, true),
      ('column', 'profiles.phone', true, true),
      ('column', 'profiles.birth_date', true, true),
      ('column', 'profiles.email', true, true),
      ('column', 'profiles.cep', true, true),
      ('column', 'profiles.address_street', true, true),
      ('column', 'profiles.address_number', true, true),
      ('column', 'profiles.address_complement', true, true),
      ('column', 'profiles.address_neighborhood', true, true),
      ('column', 'profiles.address_city', true, true),
      ('column', 'profiles.address_state', true, true)
  ) as g(resource_type, resource_key, can_view, can_update)
  join public.access_resources res
    on res.resource_type = g.resource_type
   and res.resource_key = g.resource_key
 where r.code = 'congregado'
on conflict (role_id, resource_id) where (role_id is not null) do update
  set can_view = excluded.can_view,
      can_update = excluded.can_update,
      updated_at = now();

-- Grants Visitantes
insert into public.access_grants (role_id, resource_id, can_view, can_update)
select r.id, res.id, g.can_view, g.can_update
  from public.access_roles r
 cross join (
    values
      ('screen', '/', true, false),
      ('screen', '/register', true, true),
      ('screen', '/lgpd', true, true),
      ('screen', 'dashboard.card.qr', true, false),
      ('screen', 'dashboard.card.event_alt', true, false),
      ('table', 'events', true, false),
      ('table', 'event_registrations', true, true),
      ('table', 'app_parameters', true, false),
      ('table', 'pastoral_reason_categories', true, false),
      ('table', 'pastoral_reason_subcategories', true, false)
  ) as g(resource_type, resource_key, can_view, can_update)
  join public.access_resources res
    on res.resource_type = g.resource_type
   and res.resource_key = g.resource_key
 where r.code = 'visitantes'
on conflict (role_id, resource_id) where (role_id is not null) do update
  set can_view = excluded.can_view,
      can_update = excluded.can_update,
      updated_at = now();

-- Confirme no SQL Editor:
-- select code, name from public.access_roles order by public.access_role_display_order(code);


notify pgrst, 'reload schema';
