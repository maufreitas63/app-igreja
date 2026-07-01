/**
 * Vincula comprovantes JPG locais aos lançamentos REALIZADO no Supabase.
 *
 * ⚠️ NÃO execute no SQL Editor do Supabase — este arquivo é JavaScript (Node.js).
 *    Rode no terminal/PowerShell, na pasta do projeto app-igreja.
 *
 * Padrão de arquivo: aaaammdd + espaço + valor (nnnn,nn) + .jpg
 * Exemplo: 20260526 3825,00.jpg
 *
 * Uso (PowerShell, na raiz app-igreja):
 *   node scripts/link-treasury-receipts.mjs --dry-run
 *   node scripts/link-treasury-receipts.mjs
 *   node scripts/link-treasury-receipts.mjs --force
 *   node scripts/link-treasury-receipts.mjs --receipts-dir "D:\Outra\Pasta"
 *
 * Variáveis em .env / .env.local (app-igreja ou pasta ecossistema pai):
 *   EXPO_PUBLIC_SUPABASE_URL, SUPABASE_URL ou NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY (obrigatório para upload e update)
 *
 * Relatório: scripts/link-treasury-receipts-report.json (e .txt legível)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, '..');

const DEFAULT_RECEIPTS_DIR = 'C:\\IBN Tesouraria\\Comprovantes\\JPG';
const FINANCIAL_DOCS_BUCKET = 'financial-docs';
const PAGE_SIZE = 1000;

const DEFAULT_SUPABASE_URL = 'https://bldbrsuiwctoaxzcrjoc.supabase.co';

const loadEnvFile = (filePath) => {
  if (!fs.existsSync(filePath)) {
    return;
  }

  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const match = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(trimmed);

    if (!match || process.env[match[1]] !== undefined) {
      continue;
    }

    let value = match[2].trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    process.env[match[1]] = value;
  }
};

loadEnvFile(path.join(projectRoot, '.env'));
loadEnvFile(path.join(projectRoot, '.env.local'));
loadEnvFile(path.join(projectRoot, '..', '.env'));
loadEnvFile(path.join(projectRoot, '..', '.env.local'));

const resolveSupabaseUrl = () =>
  process.env.EXPO_PUBLIC_SUPABASE_URL?.trim() ||
  process.env.SUPABASE_URL?.trim() ||
  DEFAULT_SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
  null;

const resolveSupabaseServiceRoleKey = () => process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || null;

const formatErrorMessage = (error) => {
  if (error instanceof Error) {
    return error.message;
  }

  if (error && typeof error === 'object') {
    const record = error;
    const parts = [record.message, record.details, record.hint, record.code].filter(Boolean);

    if (parts.length) {
      return parts.join(' — ');
    }

    try {
      return JSON.stringify(error);
    } catch {
      return String(error);
    }
  }

  return String(error);
};

const parseArgs = () => {
  const args = process.argv.slice(2);
  const options = {
    dryRun: false,
    force: false,
    receiptsDir: DEFAULT_RECEIPTS_DIR,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === '--dry-run') {
      options.dryRun = true;
      continue;
    }

    if (arg === '--force') {
      options.force = true;
      continue;
    }

    if (arg === '--receipts-dir') {
      options.receiptsDir = args[index + 1] ?? options.receiptsDir;
      index += 1;
      continue;
    }
  }

  return options;
};

/** aaaammdd a partir de YYYY-MM-DD. */
const formatReceiptSearchDate = (isoDate) => {
  const match = String(isoDate ?? '').trim().match(/^(\d{4})-(\d{2})-(\d{2})/);

  if (!match) {
    return null;
  }

  const [, year, month, day] = match;
  return `${year}${month}${day}`;
};

/** Valor absoluto no formato nnnn,nn (sem separador de milhar). */
const formatReceiptSearchAmount = (amount) => {
  const absolute = Math.abs(Number(amount) || 0);
  return absolute.toFixed(2).replace('.', ',');
};

const buildReceiptSearchFilename = (entry) => {
  const datePart = formatReceiptSearchDate(entry.transaction_date);

  if (!datePart) {
    return null;
  }

  return `${datePart} ${formatReceiptSearchAmount(entry.amount)}.jpg`;
};

const buildStoragePath = (financialId) => `receipts/${financialId}/${Date.now()}.jpg`;

const resolveStoragePath = (receiptUrl) => {
  const normalized = receiptUrl?.trim();

  if (!normalized) {
    return null;
  }

  return normalized.replace(new RegExp(`^${FINANCIAL_DOCS_BUCKET}/`, 'i'), '');
};

const buildReceiptFilenameIndex = (receiptsDir) => {
  const index = new Map();

  if (!fs.existsSync(receiptsDir)) {
    throw new Error(`Diretório de comprovantes não encontrado: ${receiptsDir}`);
  }

  for (const fileName of fs.readdirSync(receiptsDir)) {
    if (!fileName.toLowerCase().endsWith('.jpg')) {
      continue;
    }

    const fullPath = path.join(receiptsDir, fileName);

    if (!fs.statSync(fullPath).isFile()) {
      continue;
    }

    index.set(fileName, fullPath);
  }

  return index;
};

const fetchAllRealizadoEntries = async (supabase) => {
  const rows = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from('financials')
      .select(
        'id, transaction_date, amount, account, ministry, transaction_kind, movement, budget_version, receipt_url'
      )
      .ilike('budget_version', 'realizado')
      .order('transaction_date', { ascending: true })
      .order('id', { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    if (error) {
      throw error;
    }

    if (!data?.length) {
      break;
    }

    rows.push(...data);

    if (data.length < PAGE_SIZE) {
      break;
    }

    from += PAGE_SIZE;
  }

  return rows;
};

const deleteStorageObject = async (supabase, receiptUrl) => {
  const storagePath = resolveStoragePath(receiptUrl);

  if (!storagePath) {
    return;
  }

  const { error } = await supabase.storage.from(FINANCIAL_DOCS_BUCKET).remove([storagePath]);

  if (error) {
    console.warn(`  Aviso: não foi possível remover comprovante anterior (${storagePath}): ${error.message}`);
  }
};

const uploadAndLinkReceipt = async (supabase, entry, localFilePath, previousReceiptUrl) => {
  const storagePath = buildStoragePath(entry.id);
  const fileBuffer = fs.readFileSync(localFilePath);

  const { error: uploadError } = await supabase.storage
    .from(FINANCIAL_DOCS_BUCKET)
    .upload(storagePath, fileBuffer, {
      contentType: 'image/jpeg',
      upsert: false,
    });

  if (uploadError) {
    throw new Error(`Upload falhou: ${uploadError.message}`);
  }

  const { error: updateError } = await supabase
    .from('financials')
    .update({
      receipt_url: storagePath,
      updated_at: new Date().toISOString(),
    })
    .eq('id', entry.id);

  if (updateError) {
    await supabase.storage.from(FINANCIAL_DOCS_BUCKET).remove([storagePath]);
    throw new Error(`Update falhou: ${updateError.message}`);
  }

  if (previousReceiptUrl?.trim()) {
    await deleteStorageObject(supabase, previousReceiptUrl);
  }

  return storagePath;
};

const formatEntryLabel = (entry) => {
  const date = formatReceiptSearchDate(entry.transaction_date) ?? entry.transaction_date;
  const amount = formatReceiptSearchAmount(entry.amount);
  const account = entry.account?.trim() || '—';
  const ministry = entry.ministry?.trim() || '—';

  return `${date} · R$ ${amount} · ${entry.transaction_kind} · ${account} · ${ministry}`;
};

const writeReportFiles = (report) => {
  const jsonPath = path.join(__dirname, 'link-treasury-receipts-report.json');
  const txtPath = path.join(__dirname, 'link-treasury-receipts-report.txt');

  fs.writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  const lines = [
    'Relatório — Vinculação de Comprovantes de Tesouraria',
    `Executado em: ${report.runAt}`,
    `Modo: ${report.dryRun ? 'simulação (--dry-run)' : 'execução'}`,
    `Diretório local: ${report.receiptsDir}`,
    '',
    'Resumo',
    `  Lançamentos REALIZADO analisados: ${report.summary.totalRealizado}`,
    `  Já possuíam comprovante (ignorados): ${report.summary.skippedAlreadyLinked}`,
    `  Arquivo JPG não encontrado: ${report.summary.fileNotFound}`,
    `  Nome de arquivo inválido (data): ${report.summary.invalidFilename}`,
    `  Vinculados com sucesso: ${report.summary.linked}`,
    `  Erros: ${report.summary.errors}`,
    '',
  ];

  if (report.linked.length) {
    lines.push('Itens associados com sucesso', '─'.repeat(72));

    for (const item of report.linked) {
      lines.push(
        `[OK] ${item.label}`,
        `     ID: ${item.entryId}`,
        `     Arquivo local: ${item.localFile}`,
        `     Arquivo esperado: ${item.expectedFilename}`,
        `     Storage: ${item.storagePath ?? '(simulação)'}`,
        ''
      );
    }
  } else {
    lines.push('Nenhum item foi associado nesta execução.', '');
  }

  if (report.notFound.length) {
    lines.push('Lançamentos sem JPG correspondente', '─'.repeat(72));

    for (const item of report.notFound.slice(0, 200)) {
      lines.push(`[—] ${item.label} → esperado: ${item.expectedFilename}`);
    }

    if (report.notFound.length > 200) {
      lines.push(`... e mais ${report.notFound.length - 200} item(ns).`);
    }

    lines.push('');
  }

  if (report.errors.length) {
    lines.push('Erros', '─'.repeat(72));

    for (const item of report.errors) {
      lines.push(`[!] ${item.label}: ${item.error}`);
    }

    lines.push('');
  }

  fs.writeFileSync(txtPath, `${lines.join('\n')}\n`, 'utf8');

  return { jsonPath, txtPath };
};

const writeFailureReport = (message, details = {}) => {
  const report = {
    runAt: new Date().toISOString(),
    status: 'failed_before_processing',
    message,
    ...details,
  };

  const { jsonPath, txtPath } = writeReportFiles({
    runAt: report.runAt,
    dryRun: details.dryRun ?? false,
    force: details.force ?? false,
    receiptsDir: details.receiptsDir ?? DEFAULT_RECEIPTS_DIR,
    summary: {
      totalRealizado: 0,
      skippedAlreadyLinked: 0,
      fileNotFound: 0,
      invalidFilename: 0,
      linked: 0,
      errors: 1,
    },
    linked: [],
    skipped: [],
    notFound: [],
    errors: [{ label: 'Execução interrompida', error: message }],
  });

  console.error(message);
  console.error(`Relatório parcial JSON: ${jsonPath}`);
  console.error(`Relatório parcial TXT:  ${txtPath}`);
};

const main = async () => {
  const options = parseArgs();

  const supabaseUrl = resolveSupabaseUrl();
  const supabaseKey = resolveSupabaseServiceRoleKey();

  if (!supabaseUrl || !supabaseKey) {
    writeFailureReport(
      'Defina SUPABASE_SERVICE_ROLE_KEY e a URL do Supabase em .env.local (app-igreja ou ecossistema). Aceita EXPO_PUBLIC_SUPABASE_URL, SUPABASE_URL ou NEXT_PUBLIC_SUPABASE_URL.',
      options
    );
    process.exit(1);
  }

  let receiptIndex;

  try {
    receiptIndex = buildReceiptFilenameIndex(options.receiptsDir);
  } catch (error) {
    writeFailureReport(
      error instanceof Error ? error.message : formatErrorMessage(error),
      options
    );
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log(`Supabase: ${supabaseUrl}`);
  console.log(`Diretório de JPG: ${options.receiptsDir}`);
  console.log(`Arquivos JPG indexados: ${receiptIndex.size}`);
  console.log(options.dryRun ? 'Modo simulação (--dry-run)' : 'Modo execução');
  console.log('');

  let entries;

  try {
    entries = await fetchAllRealizadoEntries(supabase);
  } catch (error) {
    writeFailureReport(formatErrorMessage(error), options);
    process.exit(1);
  }

  const report = {
    runAt: new Date().toISOString(),
    dryRun: options.dryRun,
    force: options.force,
    receiptsDir: options.receiptsDir,
    summary: {
      totalRealizado: entries.length,
      skippedAlreadyLinked: 0,
      fileNotFound: 0,
      invalidFilename: 0,
      linked: 0,
      errors: 0,
    },
    linked: [],
    skipped: [],
    notFound: [],
    errors: [],
  };

  for (const entry of entries) {
    const label = formatEntryLabel(entry);
    const expectedFilename = buildReceiptSearchFilename(entry);

    if (!expectedFilename) {
      report.summary.invalidFilename += 1;
      report.errors.push({
        entryId: entry.id,
        label,
        error: 'Data de transação inválida para montar o nome do arquivo.',
      });
      continue;
    }

    if (entry.receipt_url?.trim() && !options.force) {
      report.summary.skippedAlreadyLinked += 1;
      report.skipped.push({
        entryId: entry.id,
        label,
        expectedFilename,
        receiptUrl: entry.receipt_url,
      });
      continue;
    }

    const localFile = receiptIndex.get(expectedFilename);

    if (!localFile) {
      report.summary.fileNotFound += 1;
      report.notFound.push({
        entryId: entry.id,
        label,
        expectedFilename,
      });
      continue;
    }

    if (options.dryRun) {
      report.summary.linked += 1;
      report.linked.push({
        entryId: entry.id,
        label,
        expectedFilename,
        localFile,
        storagePath: null,
        dryRun: true,
      });
      console.log(`[simulação] ${label} ← ${expectedFilename}`);
      continue;
    }

    try {
      const storagePath = await uploadAndLinkReceipt(
        supabase,
        entry,
        localFile,
        options.force ? entry.receipt_url : null
      );

      report.summary.linked += 1;
      report.linked.push({
        entryId: entry.id,
        label,
        expectedFilename,
        localFile,
        storagePath,
      });

      console.log(`[OK] ${label} ← ${expectedFilename}`);
    } catch (error) {
      report.summary.errors += 1;
      report.errors.push({
        entryId: entry.id,
        label,
        expectedFilename,
        localFile,
        error: error instanceof Error ? error.message : String(error),
      });
      console.error(`[ERRO] ${label}: ${error instanceof Error ? error.message : error}`);
    }
  }

  const { jsonPath, txtPath } = writeReportFiles(report);

  console.log('');
  console.log('Resumo:', JSON.stringify(report.summary, null, 2));
  console.log(`Relatório JSON: ${jsonPath}`);
  console.log(`Relatório TXT:  ${txtPath}`);

  if (report.summary.errors > 0) {
    process.exit(1);
  }
};

main().catch((error) => {
  try {
    writeFailureReport(formatErrorMessage(error));
  } catch {
    console.error(error);
  }
  process.exit(1);
});
