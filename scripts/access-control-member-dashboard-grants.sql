-- Grants de cards do dashboard para o papel member (atualização incremental).
-- Execute se o Passo 9b já estiver no app mas o seed antigo não incluía todos os cards.

insert into public.access_grants (role_id, resource_id, can_view, can_update)
select r.id, res.id, g.can_view, g.can_update
  from public.access_roles r
 cross join (
    values
      ('screen', 'dashboard.card.qr', true, false),
      ('screen', 'dashboard.card.offerings', true, false),
      ('screen', 'dashboard.card.members_list', true, false),
      ('screen', 'dashboard.card.birthdays', true, false),
      ('screen', 'dashboard.card.vigilance_scales', true, false),
      ('screen', 'dashboard.card.parking_vehicle_v2', true, false)
  ) as g(resource_type, resource_key, can_view, can_update)
  join public.access_resources res
    on res.resource_type = g.resource_type
   and res.resource_key = g.resource_key
 where r.code = 'member'
on conflict (role_id, resource_id) where (role_id is not null) do update
  set can_view = excluded.can_view,
      can_update = excluded.can_update,
      updated_at = now();
