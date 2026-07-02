import {
  buildFinancialReferencia,
  parseTreasuryReceiptFileName,
} from './treasuryReceiptBatchPath.mjs';

const FINANCIAL_MAX_RECEIPTS_PER_ENTRY = 3;

const isFinancialRealizado = (budgetVersion) =>
  String(budgetVersion ?? '')
    .trim()
    .toLowerCase() === 'realizado';

const referenciaFromEntry = (entry) =>
  entry.referencia?.trim() || buildFinancialReferencia(entry.transaction_date, entry.amount);

export const buildReferenciaLookup = (entries) => {
  const lookup = new Map();

  for (const entry of entries) {
    if (!isFinancialRealizado(entry.budget_version)) {
      continue;
    }

    const referencia = referenciaFromEntry(entry);

    if (!referencia) {
      continue;
    }

    const bucket = lookup.get(referencia) ?? [];
    bucket.push(entry);
    lookup.set(referencia, bucket);
  }

  return lookup;
};

export const listAmbiguousReferencias = (lookup) => {
  const ambiguous = [];

  for (const [referencia, bucket] of lookup.entries()) {
    if (bucket.length > 1) {
      ambiguous.push({ referencia, entries: bucket });
    }
  }

  return ambiguous.sort((left, right) => left.referencia.localeCompare(right.referencia, 'pt-BR'));
};

export const pickUniqueEntryForReferencia = (lookup, referencia) => {
  const bucket = lookup.get(referencia);

  if (!bucket?.length) {
    return { entry: null, ambiguous: false };
  }

  if (bucket.length > 1) {
    return { entry: null, ambiguous: true };
  }

  return { entry: bucket[0] ?? null, ambiguous: false };
};

const isoDateFromReferencia = (referencia) => {
  const match = referencia.match(/^(\d{4})(\d{2})(\d{2}) /);

  if (!match) {
    return null;
  }

  const [, year, month, day] = match;

  return `${year}-${month}-${day}`;
};

export const extractReceiptBatchDateRange = (files) => {
  const isoDates = files
    .map((file) => isoDateFromReferencia(file.referencia))
    .filter(Boolean)
    .sort();

  if (!isoDates.length) {
    return null;
  }

  return {
    minIso: isoDates[0],
    maxIso: isoDates[isoDates.length - 1],
  };
};

export const filterEntriesByReceiptDateRange = (entries, dateRange) => {
  if (!dateRange) {
    return entries;
  }

  return entries.filter((entry) => {
    const iso = entry.transaction_date?.slice(0, 10);

    if (!iso) {
      return false;
    }

    return iso >= dateRange.minIso && iso <= dateRange.maxIso;
  });
};

const validatePositionSequence = (files, issues) => {
  const byReferencia = new Map();

  for (const file of files) {
    const bucket = byReferencia.get(file.referencia) ?? [];
    bucket.push(file);
    byReferencia.set(file.referencia, bucket);
  }

  for (const [referencia, bucket] of byReferencia.entries()) {
    const positions = [...new Set(bucket.map((file) => file.position))].sort((a, b) => a - b);

    for (let index = 0; index < positions.length; index += 1) {
      const expected = index + 1;
      const actual = positions[index];

      if (actual !== expected) {
        for (const file of bucket.filter((item) => item.position === actual)) {
          issues.push({
            fileName: file.fileName,
            referencia,
            position: file.position,
            code: 'position_gap',
            message: `Não é possível anexar na posição ${actual} sem os comprovantes anteriores (${referencia}).`,
          });
        }
      }
    }
  }
};

export const parseReceiptBatchFileInputs = (rawFileNames) => {
  const files = [];
  const issues = [];
  const canonicalOwners = new Map();

  for (const fileName of rawFileNames) {
    const parsed = parseTreasuryReceiptFileName(fileName);

    if (!parsed) {
      issues.push({
        fileName,
        code: 'invalid_name',
        message: 'Nome de arquivo inválido para comprovante (.jpg/.jpeg com data e valor).',
      });
      continue;
    }

    const position = parsed.position ?? 1;
    const owner = canonicalOwners.get(parsed.canonicalFileName);

    if (owner && owner !== fileName) {
      issues.push({
        fileName,
        referencia: parsed.referencia,
        position,
        code: 'duplicate_canonical',
        message: `Conflito: "${parsed.canonicalFileName}" já está representado por "${owner}".`,
      });
      continue;
    }

    canonicalOwners.set(parsed.canonicalFileName, fileName);
    files.push({
      fileName,
      referencia: parsed.referencia,
      position,
      parsed,
    });
  }

  files.sort((left, right) => {
    const referenciaOrder = left.referencia.localeCompare(right.referencia, 'pt-BR');

    if (referenciaOrder !== 0) {
      return referenciaOrder;
    }

    return left.position - right.position;
  });

  validatePositionSequence(files, issues);

  return { files, issues };
};

export const runTreasuryReceiptBatchPreflight = (rawFileNames, entries, options = {}) => {
  const { files, issues } = parseReceiptBatchFileInputs(rawFileNames);
  const dateRange = extractReceiptBatchDateRange(files);
  const scopedEntries = filterEntriesByReceiptDateRange(entries, dateRange);
  const lookup = buildReferenciaLookup(scopedEntries);
  const ambiguousReferencias = listAmbiguousReferencias(lookup);

  if (options.requireUniqueReferencia !== false) {
    for (const ambiguous of ambiguousReferencias) {
      for (const file of files.filter((item) => item.referencia === ambiguous.referencia)) {
        issues.push({
          fileName: file.fileName,
          referencia: file.referencia,
          position: file.position,
          code: 'ambiguous_referencia',
          message: `Referência ambígua: ${ambiguous.entries.length} lançamentos com ${ambiguous.referencia}.`,
        });
      }
    }
  }

  for (const file of files) {
    if (issues.some((issue) => issue.fileName === file.fileName)) {
      continue;
    }

    const match = pickUniqueEntryForReferencia(lookup, file.referencia);

    if (match.ambiguous) {
      continue;
    }

    if (!match.entry) {
      issues.push({
        fileName: file.fileName,
        referencia: file.referencia,
        position: file.position,
        code: 'no_matching_entry',
        message: `Nenhum lançamento REALIZADO encontrado para ${file.referencia}.`,
      });
    }
  }

  const blockingCodes = new Set([
    'invalid_name',
    'duplicate_canonical',
    'position_gap',
    'ambiguous_referencia',
    'no_matching_entry',
  ]);

  const hasBlockingIssues = issues.some((issue) => blockingCodes.has(issue.code));

  return {
    valid: !hasBlockingIssues,
    files,
    issues,
    ambiguousReferencias,
    dateRange,
  };
};

export const slotIsOccupied = (urls, position) => position - 1 < urls.length;

export const entryHasRoomForReceipt = (urls, force, position) => {
  if (force) {
    return position >= 1 && position <= FINANCIAL_MAX_RECEIPTS_PER_ENTRY;
  }

  return urls.length < FINANCIAL_MAX_RECEIPTS_PER_ENTRY && !slotIsOccupied(urls, position);
};
