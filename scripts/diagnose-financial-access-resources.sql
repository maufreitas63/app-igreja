-- Diagnóstico: recursos financeiros no Controle de Acesso (Papéis → Telas)
-- Execute no SQL Editor do Supabase.

-- 1) Catálogo (deve retornar 3 linhas em screen)
select resource_type, resource_key, label, is_active
  from public.access_resources
 where (
     (resource_type = 'screen' and resource_key in (
       'dashboard.card.financial',
       '/financial',
       '/expense-report'
     ))
     or (resource_type = 'table' and resource_key = 'financials')
   )
 order by resource_type, resource_key;

-- 2) RPC de sincronização instalada?
select proname
  from pg_proc
 where proname = 'garantir_recursos_financeiro_admin';

-- 3) Grants do papel member (exemplo)
select ar.code as role_code, res.resource_key, res.label, g.can_view, g.can_update
  from public.access_roles ar
  join public.access_grants g on g.role_id = ar.id
  join public.access_resources res on res.id = g.resource_id
 where ar.code = 'member'
   and (
     res.resource_key in ('dashboard.card.financial', '/financial', '/expense-report')
     or res.resource_key = 'financials'
   )
 order by res.resource_key;
