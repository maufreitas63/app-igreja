/**
 * Gera scripts/financials-import-seed.sql a partir do CSV da tesouraria.
 *
 * Uso:
 *   node scripts/generate-financials-import.mjs
 *   node scripts/generate-financials-import.mjs "C:\Users\maufr\Documents\financeiro.csv"
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const defaultCsvCandidates = [
  path.join(__dirname, 'data', 'financeiro.csv'),
  'C:\\Users\\maufr\\Documents\\financeiro.csv',
  'C:\\Users\\maufr\\documentos\\financeiro.csv',
];

const csvPath = process.argv[2] ?? defaultCsvCandidates.find((candidate) => fs.existsSync(candidate));

if (!csvPath || !fs.existsSync(csvPath)) {
  console.error('CSV não encontrado. Informe o caminho:');
  console.error('  node scripts/generate-financials-import.mjs "C:\\caminho\\financeiro.csv"');
  process.exit(1);
}

const outPath = path.join(__dirname, 'financials-import-seed.sql');
const raw = fs.readFileSync(csvPath, 'utf8').replace(/^\uFEFF/, '');
const lines = raw.split(/\r?\n/);

const parseCsvDate = (value) => {
  const match = /^(\d{4})\/(\d{1,2})\/(\d{1,2})$/.exec(value.trim());
  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const iso = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

  if (Number.isNaN(Date.parse(`${iso}T12:00:00Z`))) {
    return null;
  }

  return iso;
};

const parseAmount = (value) => {
  const normalized = value.trim().replace(/\s/g, '').replace(',', '.');
  if (!normalized) {
    return null;
  }

  const amount = Number(normalized);
  return Number.isFinite(amount) ? amount : null;
};

const sqlText = (value) => `'${String(value).replace(/'/g, "''")}'`;

const rows = [];

for (let index = 0; index < lines.length; index += 1) {
  const line = lines[index];
  if (!line.trim()) {
    continue;
  }

  const parts = line.split(';').map((part) => part.trim());
  if (parts.length < 7) {
    continue;
  }

  const [dateRaw, account, amountRaw, ministry, transactionKind, movement, budgetVersion] = parts;
  if (!/^\d{4}\//.test(dateRaw)) {
    continue;
  }

  const transactionDate = parseCsvDate(dateRaw);
  const amount = parseAmount(amountRaw);

  if (!transactionDate || amount === null || !account || !ministry || !transactionKind || !movement || !budgetVersion) {
    console.warn(`Linha ${index + 1} ignorada: dados inválidos`);
    continue;
  }

  rows.push({
    sourceRow: index + 1,
    transactionDate,
    account,
    amount,
    ministry,
    transactionKind,
    movement,
    budgetVersion,
  });
}

const BATCH_SIZE = 80;
const chunks = [];

for (let offset = 0; offset < rows.length; offset += BATCH_SIZE) {
  chunks.push(rows.slice(offset, offset + BATCH_SIZE));
}

const header = `-- Importação de ${rows.length} lançamentos
-- Origem: ${csvPath.replace(/\\/g, '/')}
-- Gerado em: ${new Date().toISOString()}
-- Pré-requisito: scripts/financials-schema.sql

truncate table public.financials;

`;

const valueLines = chunks.map((chunk, chunkIndex) => {
  const values = chunk
    .map(
      (row) =>
        `  (${sqlText(row.transactionDate)}::date, ${sqlText(row.account)}, ${row.amount}, ${sqlText(row.ministry)}, ${sqlText(row.transactionKind)}, ${sqlText(row.movement)}, ${sqlText(row.budgetVersion)}, ${row.sourceRow})`
    )
    .join(',\n');

  return `-- lote ${chunkIndex + 1}/${chunks.length}
insert into public.financials (
  transaction_date,
  account,
  amount,
  ministry,
  transaction_kind,
  movement,
  budget_version,
  source_row
)
values
${values};
`;
});

const footer = `
select
  count(*)::bigint as total_rows,
  min(transaction_date) as first_date,
  max(transaction_date) as last_date,
  count(distinct account) as accounts,
  count(distinct ministry) as ministries
from public.financials;
`;

fs.writeFileSync(outPath, header + valueLines.join('\n') + footer, 'utf8');

console.log(`CSV: ${csvPath}`);
console.log(`Linhas importáveis: ${rows.length}`);
console.log(`SQL: ${outPath}`);
