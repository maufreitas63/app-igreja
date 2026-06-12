/**
 * Gera scripts/financials-import.sql a partir do CSV (INSERT embutido, sem DELETE).
 *
 * Layout (carga em lote do app):
 *   DATA;CONTA;MINISTÉRIO;TRANSAÇÃO;MOVIMENTO;VERSÃO;COMENTÁRIOS;VALOR
 *   Data: DD/MM/AA, DD/MM/AAAA ou AAAA/MM/DD
 *
 * Aceita qualquer VERSÃO (REALIZADO, PLANEJADO, etc.) no mesmo arquivo.
 *
 * Uso:
 *   node scripts/generate-financials-import.mjs
 *   node scripts/generate-financials-import.mjs csv/financeiro.csv
 *   node scripts/generate-financials-import.mjs "C:\caminho\arquivo.csv"
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, '..');
const defaultCsvCandidates = [
  path.join(projectRoot, 'csv', 'financeiro.csv'),
  path.join(__dirname, 'data', 'financeiro.csv'),
];

const csvPath = process.argv[2] ?? defaultCsvCandidates.find((candidate) => fs.existsSync(candidate));
const outPath = path.join(__dirname, 'financials-import.sql');

if (!csvPath || !fs.existsSync(csvPath)) {
  console.error('CSV não encontrado. Informe o caminho:');
  console.error('  node scripts/generate-financials-import.mjs csv/financeiro.csv');
  process.exit(1);
}

const raw = fs.readFileSync(csvPath, 'utf8').replace(/^\uFEFF/, '');
const lines = raw.split(/\r?\n/);

const normalizeLine = (line) => line.trim().replace(/^["']|["']$/g, '');

const parseCsvDate = (value) => {
  const trimmed = value.trim();

  const isoSlashMatch = /^(\d{4})\/(\d{1,2})\/(\d{1,2})$/.exec(trimmed);

  if (isoSlashMatch) {
    const year = Number.parseInt(isoSlashMatch[1], 10);
    const month = Number.parseInt(isoSlashMatch[2], 10);
    const day = Number.parseInt(isoSlashMatch[3], 10);

    if (month < 1 || month > 12 || day < 1 || day > 31) {
      return null;
    }

    const iso = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

    return Number.isNaN(Date.parse(`${iso}T12:00:00Z`)) ? null : iso;
  }

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

const sqlAmount = (value) => {
  if (!Number.isFinite(value)) {
    return 'null';
  }

  if (Number.isInteger(value)) {
    return String(value);
  }

  return value.toFixed(20).replace(/0+$/, '').replace(/\.$/, '') || '0';
};

const detectColumnLayout = (parts) => {
  if (parts.length >= 8) {
    const seventhIsAmount = parseAmount(parts[6]) !== null;
    const eighthIsAmount = parseAmount(parts[7]) !== null;

    if (eighthIsAmount && !seventhIsAmount) {
      return 'standard';
    }

    if (seventhIsAmount && !eighthIsAmount) {
      return 'legacy_comments_last';
    }
  }

  if (parts.length === 7) {
    if (parseAmount(parts[6]) !== null) {
      return 'standard';
    }

    if (parseAmount(parts[2]) !== null) {
      return 'valor_third';
    }
  }

  return 'standard';
};

const mapCsvParts = (parts, layout) => {
  if (layout === 'valor_third') {
    const [dateRaw, account, amountRaw, ministry, transactionKind, movement, budgetVersion] = parts;

    return {
      dateRaw,
      account,
      ministry,
      transactionKind,
      movement,
      budgetVersion,
      comments: parts[7] ?? null,
      amountRaw,
    };
  }

  if (layout === 'legacy_comments_last') {
    const [dateRaw, account, ministry, transactionKind, movement, budgetVersion, amountRaw] = parts;

    return {
      dateRaw,
      account,
      ministry,
      transactionKind,
      movement,
      budgetVersion,
      comments: parts[7] ?? null,
      amountRaw,
    };
  }

  const [dateRaw, account, ministry, transactionKind, movement, budgetVersion] = parts;
  const amountRaw = parts[parts.length - 1];
  const comments = parts.length >= 8 ? parts[6] : null;

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
};

const isDateHeaderLine = (value) => /^(data|date)$/i.test(value.trim());

const isExcelPlaceholderBulkRow = (parts) => {
  const dateRaw = parts[0]?.trim() ?? '';

  if (!/^0{1,2}\/0{1,2}\/1900$/.test(dateRaw)) {
    return false;
  }

  return parts.slice(1).every((part) => !part.trim());
};

const rows = [];

for (let index = 0; index < lines.length; index += 1) {
  const line = normalizeLine(lines[index]);

  if (!line) {
    continue;
  }

  const parts = line.split(';').map((part) => part.trim());

  if (isExcelPlaceholderBulkRow(parts)) {
    continue;
  }

  if (parts.length < 7) {
    continue;
  }

  if (parts.length > 8) {
    console.warn(`Linha ${index + 1} ignorada: mais de 8 colunas`);
    continue;
  }

  const layout = detectColumnLayout(parts);
  const mapped = mapCsvParts(parts, layout);

  if (isDateHeaderLine(mapped.dateRaw)) {
    continue;
  }

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

const versionCounts = rows.reduce((counts, row) => {
  const key = row.budgetVersion.trim().toUpperCase();
  counts[key] = (counts[key] ?? 0) + 1;
  return counts;
}, {});

const versionSummary = Object.entries(versionCounts)
  .sort(([left], [right]) => left.localeCompare(right))
  .map(([version, count]) => `${version}: ${count}`)
  .join(' · ');

const BATCH_SIZE = 80;
const chunks = [];

for (let offset = 0; offset < rows.length; offset += BATCH_SIZE) {
  chunks.push(rows.slice(offset, offset + BATCH_SIZE));
}

const header = `-- Importação de ${rows.length} lançamento(s) — somente INSERT (sem DELETE)
-- Origem: ${csvPath.replace(/\\/g, '/')}
-- Gerado em: ${new Date().toISOString()}
-- Pré-requisito: scripts/financials-schema.sql
-- Versões no arquivo: ${versionSummary || 'nenhuma'}
--
-- Regenerar após alterar o CSV:
--   node scripts/generate-financials-import.mjs "${csvPath.replace(/\\/g, '/')}"
--
-- Rodar duas vezes pode duplicar lançamentos.
-- Para zerar antes: scripts/financials-reset-all.sql

`;

const valueLines = chunks.map((chunk, chunkIndex) => {
  const values = chunk
    .map(
      (row) =>
        `  (${sqlText(row.transactionDate)}::date, ${sqlText(row.account)}, ${sqlAmount(row.amount)}, ${sqlText(row.ministry)}, ${sqlText(row.transactionKind)}, ${sqlText(row.movement)}, ${sqlText(row.budgetVersion)}, ${sqlText(row.comments)}, ${row.sourceRow})`
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
  count(*) filter (where upper(trim(budget_version)) like '%REALIZ%') as realizados,
  count(*) filter (where upper(trim(budget_version)) like '%PLANEJ%') as planejados
from public.financials;
`;

fs.writeFileSync(outPath, header + valueLines.join('\n') + footer, 'utf8');

console.log(`CSV: ${csvPath}`);
console.log(`Linhas importáveis: ${rows.length}`);
if (versionSummary) {
  console.log(`Versões: ${versionSummary}`);
}
console.log(`SQL: ${outPath}`);
