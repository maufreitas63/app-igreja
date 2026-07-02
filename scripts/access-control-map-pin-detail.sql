-- Detalhe de pin no mapa: ver endereço/telefone de outros perfis ao clicar no pin.
-- Membros e congregados podem abrir o mapa geral (/mapa-geolocalizacao), mas não este recurso.
-- Execute após scripts/access-control-map-screen.sql

insert into public.access_resources (resource_type, resource_key, label, description, is_active)
values (
  'screen',
  '/mapa-geolocalizacao/detalhe-pin',
  'Mapa — detalhe do pin',
  'Permite abrir a localização e contato de outros perfis ao clicar em um pin do mapa geral',
  true
)
on conflict (resource_type, resource_key) do update
  set label = excluded.label,
      description = excluded.description,
      is_active = true;

insert into public.access_grants (role_id, resource_id, can_view, can_update)
select r.id, res.id, true, false
  from public.access_roles r
  join public.access_resources res
    on res.resource_type = 'screen'
   and res.resource_key = '/mapa-geolocalizacao/detalhe-pin'
 where r.code in ('super_admin', 'pastoral')
on conflict (role_id, resource_id) where (role_id is not null) do update
  set can_view = excluded.can_view,
      can_update = excluded.can_update,
      updated_at = now();

notify pgrst, 'reload schema';
