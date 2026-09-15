select
  r.code as role_code,
  res.resource_key,
  ag.can_view
  from public.access_grants ag
  join public.access_roles r on r.id = ag.role_id
  join public.access_resources res on res.id = ag.resource_id
 where res.resource_key in (
   'maintenance.card.ai_assistant',
   'maintenance.card.ai_audit_logs'
 )
 order by res.resource_key, public.access_role_display_order(r.code), r.code;
