/**
 * Gera scripts/financials-import-seed.sql a partir do CSV da tesouraria.
 *
 * Layout esperado (mesmo da carga em lote do app):
 *   DATA;CONTA;MINISTÉRIO;TRANSAÇÃO;MOVIMENTO;VERSÃO;COMENTÁRIOS;VALOR
 *   Data: DD/MM/AA ou DD/MM/AAAA
 *
 * Uso:
 *   node scripts/generate-financials-import.mjs
 *   node scripts/generate-financials-import.mjs csv/financeiro.csv
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, '..');
const defaultCsvCandidates = [
  path.join(projectRoot, 'csv', 'financeiro.csv'),
  path.join(__dirname, 'data', 'financeiro.csv'),
  'C:\\Users\\maufr\\Documents\\financeiro.csv',
  'C:\\Users\\maufr\\documentos\\financeiro.csv',
];

const csvPath = process.argv[2] ?? defaultCsvCandidates.find((candidate) => fs.existsSync(candidate));

if (!csvPath || !fs.existsSync(csvPath)) {
  console.error('CSV não encontrado. Informe o caminho:');
  console.error('  node scripts/generate-financials-import.mjs csv/financeiro.csv');
  process.exit(1);
}

const outPath = path.join(__dirname, 'financials-import-seed.sql');
const raw = fs.readFileSync(csvPath, 'utf8').replace(/^\uFEFF/, '');
const lines = raw.split(/\r?\n/);

const normalizeLine = (line) => line.trim().replace(/^["']|["']$/g, '');

const parseCsvDate = (value) => {
  const trimmed = value.trim();

  const fourYearMatch = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(trimmed);

  if (fourYearMatch) {
    const day = Number.parseInt(fourYearMatch[1], 10);
    const month = Number.parseInt(fourYearMatch[2], 10);
    const year = Number.parseInt(fourYearMatch[3], 10);

    if (month < 1 || month > 12 || day < 1 || day > 31) {
      return null;
    }

    const iso = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

    return Number.isNaN(Date.parse(`${iso}T12:00:00Z`)) ? null : iso;
  }

  const shortYearMatch = /^(\d{1,2})\/(\d{1,2})\/(\d{2})$/.exec(trimmed);

  if (!shortYearMatch) {
    return null;
  }

  const day = Number.parseInt(shortYearMatch[1], 10);
  const month = Number.parseInt(shortYearMatch[2], 10);
  const yearShort = Number.parseInt(shortYearMatch[3], 10);
  const year = yearShort >= 70 ? 1900 + yearShort : 2000 + yearShort;

  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }

  const iso = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

  return Number.isNaN(Date.parse(`${iso}T12:00:00Z`)) ? null : iso;
};

const parseAmount = (value) => {
  const normalized = value.trim().replace(/\s/g, '').replace(',', '.');

  if (!normalized) {
    return null;
  }

  const amount = Number(normalized);

  return Number.isFinite(amount) ? amount : null;
};

const sqlText = (value) => {
  if (value === null || value === undefined || value === '') {
    return 'null';
  }

  return `'${String(value).replace(/'/g, "''")}'`;
};

const mapCsvParts = (parts) => {
  if (parts.length >= 8) {
    const [dateRaw, account, ministry, transactionKind, movement, budgetVersion, comments, amountRaw] =
      parts;

    return {
      dateRaw,
      account,
      ministry,
      transactionKind,
      movement,
      budgetVersion,
      comments,
      amountRaw,
    };
  }

  const [dateRaw, account, ministry, transactionKind, movement, budgetVersion, amountRaw] = parts;

  return {
    dateRaw,
    account,
    ministry,
    transactionKind,
    movement,
    budgetVersion,
    comments: null,
    amountRaw,
  };
};

const rows = [];

for (let index = 0; index < lines.length; index += 1) {
  const line = normalizeLine(lines[index]);

  if (!line) {
    continue;
  }

  const parts = line.split(';').map((part) => part.trim());

  if (parts.length < 7) {
    continue;
  }

  const mapped = mapCsvParts(parts);
  const transactionDate = parseCsvDate(mapped.dateRaw);
  const amount = parseAmount(mapped.amountRaw);

  if (
    !transactionDate ||
    amount === null ||
    !mapped.account ||
    !mapped.ministry ||
    !mapped.transactionKind ||
    !mapped.movement ||
    !mapped.budgetVersion
  ) {
    console.warn(`Linha ${index + 1} ignorada: dados inválidos`);
    continue;
  }

  const comments = mapped.comments?.trim() || null;

  rows.push({
    sourceRow: index + 1,
    transactionDate,
    account: mapped.account,
    amount,
    ministry: mapped.ministry,
    transactionKind: mapped.transactionKind,
    movement: mapped.movement,
    budgetVersion: mapped.budgetVersion,
    comments,
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
-- Limpeza segura (desvincula RDs antes de apagar lançamentos):

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

`;

const valueLines = chunks.map((chunk, chunkIndex) => {
  const values = chunk
    .map(
      (row) =>
        `  (${sqlText(row.transactionDate)}::date, ${sqlText(row.account)}, ${row.amount}, ${sqlText(row.ministry)}, ${sqlText(row.transactionKind)}, ${sqlText(row.movement)}, ${sqlText(row.budgetVersion)}, ${sqlText(row.comments)}, ${row.sourceRow})`
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
  comments,
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
