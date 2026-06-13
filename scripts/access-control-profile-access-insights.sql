-- Card Acessos de Usuários no carrossel de manutenção (etiqueta → maintenance.card.profile_access_insights).
-- Execute no SQL Editor do Supabase após access-control-admin-rpc.sql.
-- Complementa scripts/profile-access-insights.sql (dados de acesso).

insert into public.access_resources (resource_type, resource_key, label, description, is_active)
values
  (
    'screen',
    'maintenance.card.profile_access_insights',
    'Acessos de Usuários',
    'Card de manutenção com histórico de logins (exclusivo super_admin)',
    true
  )
on conflict (resource_type, resource_key) do update
  set label = excluded.label,
      description = excluded.description,
      is_active = true;

insert into public.access_grants (role_id, resource_id, can_view, can_update)
select r.id, res.id, true, true
  from public.access_roles r
  join public.access_resources res
    on res.resource_type = 'screen'
   and res.resource_key = 'maintenance.card.profile_access_insights'
 where r.code = 'super_admin'
on conflict (role_id, resource_id) where (role_id is not null) do update
  set can_view = excluded.can_view,
      can_update = excluded.can_update,
      updated_at = now();
