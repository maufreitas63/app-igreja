-- Módulo financeiro: tela e card no dashboard
-- Execute no SQL Editor do Supabase após access-control-schema.sql

insert into public.access_resources (resource_type, resource_key, label, description)
values
  ('screen', '/financial', 'Módulo Financeiro', null),
  ('screen', 'dashboard.card.financial', 'Card Financeiro', null)
on conflict (resource_type, resource_key) do update
  set label = excluded.label,
      description = excluded.description;

insert into public.access_grants (role_id, resource_id, can_view, can_update)
select r.id, res.id, true, false
  from public.access_roles r
 cross join public.access_resources res
 where r.code = 'member'
   and res.resource_type = 'screen'
   and res.resource_key in ('/financial', 'dashboard.card.financial')
on conflict (role_id, resource_id) where (role_id is not null) do update
  set can_view = excluded.can_view,
      can_update = excluded.can_update,
      updated_at = now();

insert into public.access_resources (resource_type, resource_key, label)
values ('table', 'financials', 'Lançamentos financeiros')
on conflict (resource_type, resource_key) do update
  set label = excluded.label;

-- Tesouraria / admin: ajuste grants no papel adequado quando existir role finance_admin
