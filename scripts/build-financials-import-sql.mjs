/**
 * Monta scripts/financials-import.sql = RPC + chamada de importação.
 * Uso: node scripts/build-financials-import-sql.mjs [caminho-csv]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, '..');

const defaultCsv = path.join(projectRoot, 'csv', 'financeiro.csv');
const csvPath = process.argv[2] ?? defaultCsv;
const sqlPath = path.join(__dirname, 'financials-import.sql');
const rpcPath = path.join(__dirname, 'financials-import-rpc.sql');

if (!fs.existsSync(rpcPath)) {
  console.error(`Arquivo não encontrado: ${rpcPath}`);
  process.exit(1);
}

const sqlPathForDb = csvPath.replace(/\\/g, '/').replace(/'/g, "''");

const rpcBody = fs
  .readFileSync(rpcPath, 'utf8')
  .replace(/^(?:--[^\n]*\n)+/, '')
  .trimStart();

const sql = `-- Importação dinâmica de lançamentos financeiros (somente INSERT, sem DELETE).
-- Pré-requisito: scripts/financials-schema.sql
-- Este arquivo instala as funções (idempotente) e executa a importação.
--
-- Supabase hospedado: o servidor NÃO lê disco local — use:
--   node scripts/run-financials-import.mjs "${csvPath.replace(/\\/g, '/')}"
--
-- Rodar duas vezes pode duplicar lançamentos.
-- Para zerar antes: scripts/financials-reset-all.sql

${rpcBody}

-- === ALTERE O CAMINHO ABAIXO (visível ao servidor Postgres) ===
select public.importar_lancamentos_financeiros_de_arquivo(
  '${sqlPathForDb}'::text,
  false
) as resultado;
-- ==============================================================

select
  count(*)::bigint as total_rows,
  min(transaction_date) as first_date,
  max(transaction_date) as last_date,
  count(*) filter (where upper(trim(budget_version)) like '%REALIZ%') as realizados,
  count(*) filter (where upper(trim(budget_version)) like '%PLANEJ%') as planejados
from public.financials;
`;

fs.writeFileSync(sqlPath, sql, 'utf8');

console.log(`Gerado: ${sqlPath}`);
console.log(`Caminho: ${sqlPathForDb}`);
