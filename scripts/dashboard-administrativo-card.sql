-- Card Administrativo no dashboard principal (índice).
-- Visível via ACL; o app restringe ainda a perfis com membresia ativa.

insert into public.access_resources (resource_type, resource_key, label, description, is_active)
values (
  'screen',
  'dashboard.card.administrativo',
  'Card — Administrativo',
  'Atas de assembleias e documentos administrativos no dashboard principal.',
  true
)
on conflict (resource_type, resource_key) do update
  set label = excluded.label,
      description = excluded.description,
      is_active = true;

insert into public.access_grants (role_id, resource_id, can_view, can_update)
select r.id, res.id, true, r.code = 'super_admin'
  from public.access_roles r
  join public.access_resources res
    on res.resource_type = 'screen'
   and res.resource_key = 'dashboard.card.administrativo'
 where r.code in ('super_admin', 'events_admin', 'pastoral', 'tesoureiro', 'member', 'congregado')
on conflict (role_id, resource_id) where (role_id is not null) do update
  set can_view = excluded.can_view,
      can_update = excluded.can_update,
      updated_at = now();

notify pgrst, 'reload schema';
