-- =============================================================================
-- Multi-tenancy — Passo 5: índice dos blocos de auditoria
-- =============================================================================
-- Os blocos foram separados para o SQL Editor do Supabase (1 SELECT por arquivo).
--
-- Execute nesta ordem:
--   05a  multi-tenant-05a-inventory-security-definer.sql
--   05b  multi-tenant-05b-risk-missing-tenant-filter.sql   ← o mais importante
--   05c  multi-tenant-05c-priority-checklist.sql
--   05d  multi-tenant-05d-patch-pattern.sql                (referência)
--   05e  multi-tenant-05e-smoke-tenant.sql
--
-- Detalhes: MULTI_TENANT_DEPLOY.md (Passo 5)
-- =============================================================================

select
  '05a' as bloco,
  'multi-tenant-05a-inventory-security-definer.sql' as arquivo,
  'Inventário SECURITY DEFINER' as descricao
union all
select
  '05b',
  'multi-tenant-05b-risk-missing-tenant-filter.sql',
  'Risco: falta filtro de tenant'
union all
select
  '05c',
  'multi-tenant-05c-priority-checklist.sql',
  'Checklist priorizado'
union all
select
  '05d',
  'multi-tenant-05d-patch-pattern.sql',
  'Padrão de correção (referência)'
union all
select
  '05e',
  'multi-tenant-05e-smoke-tenant.sql',
  'Smoke tenant/vínculos'
order by 1;
