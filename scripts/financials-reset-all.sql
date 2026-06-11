-- Zera todos os lançamentos em public.financials para recarga completa.
-- Execute no Supabase SQL Editor ANTES de scripts/financials-import-seed.sql
-- ou antes de uma nova carga em lote pelo app.
-- CSV de origem (regenerar seed): csv/financeiro.csv
--   node scripts/generate-financials-import.mjs
--
-- Efeitos:
-- - Remove todos os lançamentos financeiros
-- - RDs conciliados voltam para status 'pending' (vínculo removido)
-- - Comprovantes no Storage (bucket financial-docs) NÃO são apagados automaticamente

begin;

update public.expense_reports er
set
  status = 'pending',
  financial_id = null,
  updated_at = now()
where er.financial_id is not null
   or er.status = 'reconciled';

delete from public.financials;

commit;

select
  (select count(*)::bigint from public.financials) as financials_restantes,
  (select count(*)::bigint from public.expense_reports where financial_id is not null) as rds_ainda_vinculados,
  (select count(*)::bigint from public.expense_reports where status = 'reconciled') as rds_status_conciliado;
