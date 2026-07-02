/**
 * Vincula comprovantes JPG locais aos lançamentos REALIZADO no Supabase.
 *
 * ⚠️ NÃO execute no SQL Editor do Supabase — este arquivo é JavaScript (Node.js).
 *    Rode no terminal/PowerShell, na pasta do projeto app-igreja.
 *
 * Padrões de arquivo:
 * - Único: aaaammdd + espaço + valor (nnnn,nn) + .jpg — ex.: 20260526 3825,00.jpg
 * - Múltiplo: aaaammdd + espaço + valor + espaço + posição (1 dígito) + .jpg — ex.: 20260608 1500,00 2.jpg
 * Aceita também aaaa.mm.dd e valores com sinal +/- antes do montante.
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
import {
  buildFinancialReferencia,
  getEntryReceiptUrls,
  isTreasuryReceiptFileName,
  parseTreasuryReceiptFileName,
  placeFinancialReceiptAtPosition,
  resolveTreasuryReceiptLinkPosition,
} from '../lib/treasuryReceiptBatchPath.mjs';

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

/** Usa public.financials.referencia quando disponível; senão recalcula localmente. */
const resolveReceiptFilename = (entry) => {
  const fromDb = entry.referencia?.trim();

  if (fromDb) {
    return fromDb;
  }

  return buildFinancialReferencia(entry.transaction_date, entry.amount);
};

const buildStoragePath = (financialId) => `receipts/${financialId}/${Date.now()}.jpg`;

const markLocalReceiptProcessed = (localFilePath) => {
  const fileName = path.basename(localFilePath);

  if (fileName.startsWith('updated_')) {
    return localFilePath;
  }

  const updatedPath = path.join(path.dirname(localFilePath), `updated_${fileName}`);
  fs.renameSync(localFilePath, updatedPath);

  return updatedPath;
};

const resolveStoragePath = (receiptUrl) => {
  const normalized = receiptUrl?.trim();

  if (!normalized) {
    return null;
  }

  return normalized.replace(new RegExp(`^${FINANCIAL_DOCS_BUCKET}/`, 'i'), '');
};

const FINANCIAL_MAX_RECEIPTS_PER_ENTRY = 3;

const buildReceiptFilenameIndex = (receiptsDir, { dryRun = false } = {}) => {
  const files = [];
  const normalizedNames = [];

  if (!fs.existsSync(receiptsDir)) {
    throw new Error(`Diretório de comprovantes não encontrado: ${receiptsDir}`);
  }

  for (const fileName of fs.readdirSync(receiptsDir)) {
    if (!isTreasuryReceiptFileName(fileName)) {
      continue;
    }

    const fullPath = path.join(receiptsDir, fileName);

    if (!fs.statSync(fullPath).isFile()) {
      continue;
    }

    const parsed = parseTreasuryReceiptFileName(fileName);

    if (!parsed) {
      continue;
    }

    const { referencia, canonicalFileName, position } = parsed;
    const linkPosition = resolveTreasuryReceiptLinkPosition(position);

    let effectivePath = fullPath;
    let effectiveName = fileName;

    if (canonicalFileName !== fileName) {
      const canonicalPath = path.join(receiptsDir, canonicalFileName);

      if (
        !dryRun &&
        fs.existsSync(canonicalPath) &&
        path.resolve(canonicalPath) !== path.resolve(fullPath)
      ) {
        console.warn(
          `Conflito ao normalizar "${fileName}": já existe "${canonicalFileName}" na pasta.`
        );
        continue;
      }

      if (!dryRun) {
        fs.renameSync(fullPath, canonicalPath);
        effectivePath = canonicalPath;
        effectiveName = canonicalFileName;
      } else {
        effectiveName = canonicalFileName;
      }

      normalizedNames.push({ from: fileName, to: canonicalFileName });
    } else {
      effectiveName = canonicalFileName;
    }

    files.push({
      referencia,
      position: linkPosition,
      fileName: effectiveName,
      localPath: effectivePath,
    });
  }

  files.sort((left, right) => {
    const referenciaOrder = left.referencia.localeCompare(right.referencia, 'pt-BR');

    if (referenciaOrder !== 0) {
      return referenciaOrder;
    }

    return left.position - right.position;
  });

  return { files, normalizedNames };
};

const fetchAllRealizadoEntries = async (supabase) => {
  const rows = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from('financials')
      .select(
        'id, transaction_date, amount, account, ministry, transaction_kind, movement, budget_version, receipt_url, receipt_urls, referencia'
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

const uploadAndLinkReceipt = async (
  supabase,
  entry,
  localFilePath,
  existingReceiptUrls,
  position
) => {
  const storagePath = buildStoragePath(entry.id);
  const fileBuffer = fs.readFileSync(localFilePath);
  const placed = placeFinancialReceiptAtPosition(existingReceiptUrls, position, storagePath);

  if (placed.error) {
    throw new Error(placed.error);
  }

  const { error: uploadError } = await supabase.storage
    .from(FINANCIAL_DOCS_BUCKET)
    .upload(storagePath, fileBuffer, {
      contentType: 'image/jpeg',
      upsert: false,
    });

  if (uploadError) {
    throw new Error(`Upload falhou: ${uploadError.message}`);
  }

  const nextReceiptUrls = placed.urls;

  const { error: updateError } = await supabase
    .from('financials')
    .update({
      receipt_urls: nextReceiptUrls,
      receipt_url: nextReceiptUrls[0] ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', entry.id);

  if (updateError) {
    await supabase.storage.from(FINANCIAL_DOCS_BUCKET).remove([storagePath]);
    throw new Error(`Update falhou: ${updateError.message}`);
  }

  if (placed.replacedUrl?.trim()) {
    await deleteStorageObject(supabase, placed.replacedUrl);
  }

  return { storagePath, receiptUrls: nextReceiptUrls };
};

const buildReferenciaLookup = (entries) => {
  const lookup = new Map();

  for (const entry of entries) {
    const referencia = resolveReceiptFilename(entry);

    if (!referencia) {
      continue;
    }

    const bucket = lookup.get(referencia) ?? [];
    bucket.push(entry);
    lookup.set(referencia, bucket);
  }

  return lookup;
};

const slotIsOccupied = (urls, position) => position - 1 < urls.length;

const formatEntryLabel = (entry) => {
  const referencia = resolveReceiptFilename(entry);
  const account = entry.account?.trim() || '—';
  const ministry = entry.ministry?.trim() || '—';

  return `${referencia ?? entry.transaction_date} · ${entry.transaction_kind} · ${account} · ${ministry}`;
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
    `  JPG com nome normalizado: ${report.summary.normalizedFileNames ?? 0}`,
    `  Já possuíam comprovante (sem JPG local): ${report.summary.skippedAlreadyLinked}`,
    `  JPG local renomeado (já anexados): ${report.summary.renamedOnly ?? 0}`,
    `  Arquivo JPG não encontrado: ${report.summary.fileNotFound}`,
    `  Nome de arquivo inválido (data): ${report.summary.invalidFilename}`,
    `  Vinculados com sucesso: ${report.summary.linked}`,
    `  Erros: ${report.summary.errors}`,
    '',
  ];

  if (report.normalizedReceiptNames?.length) {
    lines.push('Nomes de arquivo normalizados', '─'.repeat(72));

    for (const item of report.normalizedReceiptNames.slice(0, 200)) {
      lines.push(`[norm] ${item.from} → ${item.to}`);
    }

    if (report.normalizedReceiptNames.length > 200) {
      lines.push(`... e mais ${report.normalizedReceiptNames.length - 200} item(ns).`);
    }

    lines.push('');
  }

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

  if (report.renamedOnly?.length) {
    lines.push('JPG renomeados (comprovante já anexado)', '─'.repeat(72));

    for (const item of report.renamedOnly) {
      lines.push(
        `[rename] ${item.label}`,
        `     Arquivo: ${item.expectedFilename} → ${path.basename(item.localFile)}`,
        ''
      );
    }
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
      renamedOnly: 0,
      fileNotFound: 0,
      invalidFilename: 0,
      linked: 0,
      errors: 1,
    },
    linked: [],
    renamedOnly: [],
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

  let receiptFiles;
  let normalizedReceiptNames = [];

  try {
    const built = buildReceiptFilenameIndex(options.receiptsDir, { dryRun: options.dryRun });
    receiptFiles = built.files;
    normalizedReceiptNames = built.normalizedNames;
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
  console.log(`Arquivos JPG indexados: ${receiptFiles.length}`);
  if (normalizedReceiptNames.length) {
    console.log(`Nomes normalizados para referencia: ${normalizedReceiptNames.length}`);
  }
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
    normalizedReceiptNames,
    summary: {
      totalRealizado: entries.length,
      skippedAlreadyLinked: 0,
      renamedOnly: 0,
      normalizedFileNames: normalizedReceiptNames.length,
      fileNotFound: 0,
      invalidFilename: 0,
      linked: 0,
      errors: 0,
    },
    linked: [],
    renamedOnly: [],
    skipped: [],
    notFound: [],
    errors: [],
  };

  const referenciaLookup = buildReferenciaLookup(entries);
  const receiptUrlsByEntryId = new Map(
    entries.map((entry) => [entry.id, getEntryReceiptUrls(entry)])
  );
  const matchedEntryIds = new Set();

  for (const file of receiptFiles) {
    const candidates = referenciaLookup.get(file.referencia);

    if (!candidates?.length) {
      report.summary.fileNotFound += 1;
      report.notFound.push({
        label: file.fileName,
        expectedFilename: file.referencia,
        position: file.position,
      });
      continue;
    }

    const entry = candidates[0];
    const label = formatEntryLabel(entry);
    const existingReceiptUrls = receiptUrlsByEntryId.get(entry.id) ?? [];

    if (!options.force && slotIsOccupied(existingReceiptUrls, file.position)) {
      if (options.dryRun) {
        report.summary.renamedOnly = (report.summary.renamedOnly ?? 0) + 1;
        (report.renamedOnly ??= []).push({
          entryId: entry.id,
          label,
          expectedFilename: file.fileName,
          referencia: file.referencia,
          position: file.position,
          localFile: file.localPath,
          dryRun: true,
        });
        console.log(`[simulação rename] ${label} ← ${file.fileName} (posição ${file.position})`);
        continue;
      }

      try {
        const processedLocalFile = markLocalReceiptProcessed(file.localPath);
        report.summary.renamedOnly = (report.summary.renamedOnly ?? 0) + 1;
        (report.renamedOnly ??= []).push({
          entryId: entry.id,
          label,
          expectedFilename: file.fileName,
          referencia: file.referencia,
          position: file.position,
          localFile: processedLocalFile,
        });
        matchedEntryIds.add(entry.id);
        console.log(
          `[OK rename] ${label} ← ${file.fileName} (posição ${file.position}) → ${path.basename(processedLocalFile)}`
        );
      } catch (renameError) {
        report.summary.errors += 1;
        report.errors.push({
          entryId: entry.id,
          label,
          expectedFilename: file.fileName,
          position: file.position,
          localFile: file.localPath,
          error: `Posição ${file.position} já possui comprovante, mas falha ao renomear: ${
            renameError instanceof Error ? renameError.message : String(renameError)
          }`,
        });
        console.error(`[ERRO rename] ${label}: ${renameError instanceof Error ? renameError.message : renameError}`);
      }

      continue;
    }

    if (existingReceiptUrls.length >= FINANCIAL_MAX_RECEIPTS_PER_ENTRY && !options.force) {
      report.summary.errors += 1;
      report.errors.push({
        entryId: entry.id,
        label,
        expectedFilename: file.fileName,
        position: file.position,
        error: `Lançamento já possui ${FINANCIAL_MAX_RECEIPTS_PER_ENTRY} comprovantes.`,
      });
      continue;
    }

    if (options.dryRun) {
      report.summary.linked += 1;
      report.linked.push({
        entryId: entry.id,
        label,
        expectedFilename: file.fileName,
        referencia: file.referencia,
        position: file.position,
        localFile: file.localPath,
        storagePath: null,
        dryRun: true,
      });
      console.log(`[simulação] ${label} ← ${file.fileName} (posição ${file.position})`);
      continue;
    }

    try {
      const { storagePath, receiptUrls } = await uploadAndLinkReceipt(
        supabase,
        entry,
        file.localPath,
        existingReceiptUrls,
        file.position
      );

      receiptUrlsByEntryId.set(entry.id, receiptUrls);

      let processedLocalFile = file.localPath;

      try {
        processedLocalFile = markLocalReceiptProcessed(file.localPath);
      } catch (renameError) {
        report.summary.errors += 1;
        report.errors.push({
          entryId: entry.id,
          label,
          expectedFilename: file.fileName,
          position: file.position,
          localFile: file.localPath,
          error: `Comprovante anexado, mas falha ao renomear: ${
            renameError instanceof Error ? renameError.message : String(renameError)
          }`,
        });
        console.warn(`[AVISO] ${label}: comprovante anexado, rename falhou`);
        continue;
      }

      report.summary.linked += 1;
      report.linked.push({
        entryId: entry.id,
        label,
        expectedFilename: file.fileName,
        referencia: file.referencia,
        position: file.position,
        localFile: processedLocalFile,
        storagePath,
      });
      matchedEntryIds.add(entry.id);

      console.log(
        `[OK] ${label} ← ${file.fileName} (posição ${file.position}) → ${path.basename(processedLocalFile)}`
      );
    } catch (error) {
      report.summary.errors += 1;
      report.errors.push({
        entryId: entry.id,
        label,
        expectedFilename: file.fileName,
        position: file.position,
        localFile: file.localPath,
        error: error instanceof Error ? error.message : String(error),
      });
      console.error(`[ERRO] ${label}: ${error instanceof Error ? error.message : error}`);
    }
  }

  for (const [, bucket] of referenciaLookup.entries()) {
    for (const entry of bucket) {
      const urls = receiptUrlsByEntryId.get(entry.id) ?? [];

      if (urls.length > 0 || matchedEntryIds.has(entry.id)) {
        continue;
      }

      report.summary.fileNotFound += 1;
      report.notFound.push({
        entryId: entry.id,
        label: formatEntryLabel(entry),
        expectedFilename: resolveReceiptFilename(entry),
      });
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
