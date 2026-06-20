-- Permite ao papel member editar integrantes da própria família (Gerenciar Família).
-- Execute no SQL Editor do Supabase se o representante legal não consegue editar membros.
-- A RLS em members já restringe alterações ao family_id da sessão.

insert into public.access_grants (role_id, resource_id, can_view, can_update)
select r.id, res.id, g.can_view, g.can_update
  from public.access_roles r
 cross join (
    values
      ('screen', '/manage-members', true, true),
      ('table', 'members', true, true)
  ) as g(resource_type, resource_key, can_view, can_update)
  join public.access_resources res
    on res.resource_type = g.resource_type
   and res.resource_key = g.resource_key
 where r.code = 'member'
on conflict (role_id, resource_id) where (role_id is not null) do update
  set can_view = excluded.can_view,
      can_update = excluded.can_update,
      updated_at = now();

notify pgrst, 'reload schema';
