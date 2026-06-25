-- Renomeia ACL do card Sala(s) - Check In: monitor → servidor.
-- Execute no SQL Editor do Supabase após access-control-schema.sql.

update public.access_resources
   set resource_key = 'maintenance.card.sala_servidor',
       label = 'Manutenção — Servidor de salas',
       description = 'Check-in nas salas Kids/Teens por servidores escalados.'
 where resource_type = 'screen'
   and resource_key = 'maintenance.card.sala_monitor';

insert into public.access_resources (resource_type, resource_key, label, description, is_active)
values (
  'screen',
  'maintenance.card.sala_servidor',
  'Manutenção — Servidor de salas',
  'Check-in nas salas Kids/Teens por servidores escalados.',
  true
)
on conflict (resource_type, resource_key) do update
  set label = excluded.label,
      description = excluded.description,
      is_active = true;

-- Copia grants do recurso legado, se existir.
insert into public.access_grants (role_id, resource_id, can_view, can_update)
select g.role_id, novo.id, g.can_view, g.can_update
  from public.access_grants g
  join public.access_resources legado
    on legado.id = g.resource_id
   and legado.resource_type = 'screen'
   and legado.resource_key = 'maintenance.card.sala_monitor'
  join public.access_resources novo
    on novo.resource_type = 'screen'
   and novo.resource_key = 'maintenance.card.sala_servidor'
 where g.role_id is not null
on conflict (role_id, resource_id) where (role_id is not null) do update
  set can_view = excluded.can_view,
      can_update = excluded.can_update,
      updated_at = now();

delete from public.access_grants g
 using public.access_resources legado
 where g.resource_id = legado.id
   and legado.resource_type = 'screen'
   and legado.resource_key = 'maintenance.card.sala_monitor';

delete from public.access_resources
 where resource_type = 'screen'
   and resource_key = 'maintenance.card.sala_monitor';

notify pgrst, 'reload schema';
