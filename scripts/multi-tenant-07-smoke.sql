-- =============================================================================
-- Multi-tenancy — Passo 7: índice dos smokes
-- =============================================================================
-- Execute um arquivo por vez:
--   07a  multi-tenant-07a-vinculos.sql
--   07b  multi-tenant-07b-null-tenant.sql
--   07c  multi-tenant-07c-amostra-ibn.sql
--   07d  multi-tenant-07d-session-helper.sql  (opcional)
-- =============================================================================

select
  '07a' as bloco,
  'multi-tenant-07a-vinculos.sql' as arquivo,
  'Tenant padrão e vínculos' as descricao
union all
select '07b', 'multi-tenant-07b-null-tenant.sql', 'Sem tenant_id nulo'
union all
select '07c', 'multi-tenant-07c-amostra-ibn.sql', 'Amostra dados IBN'
union all
select '07d', 'multi-tenant-07d-session-helper.sql', 'Helper de sessão (opcional)'
order by 1;
