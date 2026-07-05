-- Visitantes: Perfil & Identidade (card + telas filhas + colunas básicas de profiles).
-- Execute no SQL Editor do Supabase se visitantes não veem o atalho no Índice.
-- Idempotente.

insert into public.access_grants (role_id, resource_id, can_view, can_update)
select r.id, res.id, g.can_view, g.can_update
  from public.access_roles r
 cross join (
    values
      ('screen', '/manage-profile', true, true),
      ('screen', '/manage-members', true, true),
      ('screen', 'dashboard.card.grouped_manage', true, false),
      ('table', 'profiles', true, true),
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
 where r.code = 'visitantes'
on conflict (role_id, resource_id) where (role_id is not null) do update
  set can_view = excluded.can_view,
      can_update = excluded.can_update,
      updated_at = now();

notify pgrst, 'reload schema';
