-- Equipe Pastoral (code: pastoral): mesmos privilégios de Membro + manutenção Cuidado Pastoral.
-- Execute no SQL Editor do Supabase quando o papel pastoral estiver sem telas/cards de membro.
-- Pré-requisito: access-control-schema.sql (papel member com grants completos).

update public.access_roles
   set name = 'Equipe Pastoral',
       description = 'Mesmos privilégios de Membro, mais manutenção Cuidado Pastoral'
 where code = 'pastoral';

-- Herda todos os grants atuais de member
insert into public.access_grants (role_id, resource_id, can_view, can_update)
select pastoral.id, member_grant.resource_id, member_grant.can_view, member_grant.can_update
  from public.access_roles pastoral
  join public.access_roles member_role on member_role.code = 'member'
  join public.access_grants member_grant on member_grant.role_id = member_role.id
 where pastoral.code = 'pastoral'
on conflict (role_id, resource_id) where (role_id is not null) do update
  set can_view = excluded.can_view,
      can_update = excluded.can_update,
      updated_at = now();

-- Recursos de manutenção pastoral (além do que member já possui)
insert into public.access_resources (resource_type, resource_key, label, description)
values
  ('screen', 'maintenance.card.pastoral_care', 'Manutenção: Cuidado Pastoral', 'Triagem de pedidos pastorais')
on conflict (resource_type, resource_key) do update
  set label = excluded.label,
      description = excluded.description;

insert into public.access_grants (role_id, resource_id, can_view, can_update)
select r.id, res.id, g.can_view, g.can_update
  from public.access_roles r
 cross join (
    values
      ('screen', '/maintenance-dashboard', true, false),
      ('screen', 'maintenance.card.pastoral_care', true, true),
      ('table', 'pastoral_requests', true, true)
  ) as g(resource_type, resource_key, can_view, can_update)
  join public.access_resources res
    on res.resource_type = g.resource_type
   and res.resource_key = g.resource_key
 where r.code = 'pastoral'
on conflict (role_id, resource_id) where (role_id is not null) do update
  set can_view = excluded.can_view,
      can_update = excluded.can_update,
      updated_at = now();

-- Conferência: pastoral deve ter pelo menos os mesmos recursos que member
select
  member_res.resource_type,
  member_res.resource_key,
  member_res.label,
  mg.can_view as member_view,
  pg.can_view as pastoral_view
  from public.access_roles member_role
  join public.access_grants mg on mg.role_id = member_role.id
  join public.access_resources member_res on member_res.id = mg.resource_id
  left join public.access_roles pastoral_role on pastoral_role.code = 'pastoral'
  left join public.access_grants pg
    on pg.role_id = pastoral_role.id
   and pg.resource_id = member_res.id
 where member_role.code = 'member'
 order by member_res.resource_type, member_res.resource_key;

notify pgrst, 'reload schema';
