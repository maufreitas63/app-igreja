-- I12: tela /mapa-geolocalizacao no controle de acesso.
-- Execute após scripts/access-control-schema.sql

insert into public.access_resources (resource_type, resource_key, label, description)
values ('screen', '/mapa-geolocalizacao', 'Mapa de geolocalização', null)
on conflict (resource_type, resource_key) do update
  set label = excluded.label,
      description = excluded.description;

insert into public.access_grants (role_id, resource_id, can_view, can_update)
select r.id, res.id, true, false
  from public.access_roles r
 cross join public.access_resources res
 where r.code in ('super_admin', 'member', 'congregado', 'pastoral')
   and res.resource_type = 'screen'
   and res.resource_key = '/mapa-geolocalizacao'
on conflict (role_id, resource_id) where (role_id is not null) do update
  set can_view = excluded.can_view,
      can_update = excluded.can_update,
      updated_at = now();

notify pgrst, 'reload schema';
