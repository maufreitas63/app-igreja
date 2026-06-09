-- Verificar lançamentos com observações em public.financials
-- Se der erro "column comments does not exist", use "Comments" (seção B)
-- ou execute antes: scripts/financials-comments-column-normalize.sql

-- 0) Qual nome da coluna existe?
select column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name = 'financials'
  and lower(column_name) in ('comments', 'comment')
order by column_name;

-- =============================================================================
-- A) Coluna padrão: comments (minúsculo) — após financials-comments-column-normalize.sql
-- =============================================================================

-- Resumo
select
  count(*) filter (where comments is not null and btrim(comments) <> '') as com_comentario,
  count(*) filter (where comments is null or btrim(comments) = '') as sem_comentario,
  count(*) as total
from public.financials;

-- Lista (REALIZADO com comentário — mesmo filtro do app)
select
  id,
  transaction_date,
  account,
  amount,
  ministry,
  transaction_kind,
  movement,
  budget_version,
  comments,
  updated_at
from public.financials
where comments is not null
  and btrim(comments) <> ''
  and upper(btrim(budget_version)) like '%REALIZ%'
order by transaction_date desc, ministry, account;

-- =============================================================================
-- B) Coluna legada: "Comments" (PascalCase) — use se a seção A falhar
-- =============================================================================

/*
select
  count(*) filter (where "Comments" is not null and btrim("Comments") <> '') as com_comentario,
  count(*) as total
from public.financials;

select
  id,
  transaction_date,
  account,
  amount,
  ministry,
  transaction_kind,
  movement,
  budget_version,
  "Comments" as comments,
  updated_at
from public.financials
where "Comments" is not null
  and btrim("Comments") <> ''
  and upper(btrim(budget_version)) like '%REALIZ%'
order by transaction_date desc, ministry, account;
*/
