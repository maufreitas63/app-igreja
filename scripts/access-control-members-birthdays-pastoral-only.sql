-- Lista de Membros e Aniversariantes: apenas pastoral (e super_admin via curingas).
-- Remove visibilidade dos papéis member e congregado.
-- Execute no SQL Editor do Supabase. Depois: Settings → API → Reload schema.

-- Revoga member
update public.access_grants ag
   set can_view = false,
       can_update = false,
       updated_at = now()
  from public.access_roles r
  join public.access_resources res on res.id = ag.resource_id
 where ag.role_id = r.id
   and r.code = 'member'
   and res.resource_type = 'screen'
   and res.resource_key in ('dashboard.card.members_list', 'dashboard.card.birthdays');

-- Revoga congregado
update public.access_grants ag
   set can_view = false,
       can_update = false,
       updated_at = now()
  from public.access_roles r
  join public.access_resources res on res.id = ag.resource_id
 where ag.role_id = r.id
   and r.code = 'congregado'
   and res.resource_type = 'screen'
   and res.resource_key in ('dashboard.card.members_list', 'dashboard.card.birthdays');

-- Garante pastoral com view nos dois cards (pastoral herda member; se member perdeu, pastoral precisa grant explícito)
insert into public.access_grants (role_id, resource_id, can_view, can_update)
select r.id, res.id, true, false
  from public.access_roles r
 cross join (
    values
      ('screen', 'dashboard.card.members_list'),
      ('screen', 'dashboard.card.birthdays')
  ) as g(resource_type, resource_key)
  join public.access_resources res
    on res.resource_type = g.resource_type
   and res.resource_key = g.resource_key
 where r.code = 'pastoral'
on conflict (role_id, resource_id) where (role_id is not null) do update
  set can_view = true,
      can_update = excluded.can_update,
      updated_at = now();

notify pgrst, 'reload schema';
