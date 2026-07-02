import type { FinancialEntry } from '@/lib/financialEntry';

export const FINANCIAL_MAX_RECEIPTS_PER_ENTRY = 3;

const normalizeReceiptUrl = (value: unknown): string | null => {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();

  return trimmed.length > 0 ? trimmed : null;
};

/** Lista de URLs de comprovantes (máx. 3), deduplicada e estável. */
export const normalizeFinancialReceiptUrls = (urls: unknown): string[] => {
  if (!Array.isArray(urls)) {
    return [];
  }

  const seen = new Set<string>();
  const result: string[] = [];

  for (const url of urls) {
    const normalized = normalizeReceiptUrl(url);

    if (!normalized || seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    result.push(normalized);

    if (result.length >= FINANCIAL_MAX_RECEIPTS_PER_ENTRY) {
      break;
    }
  }

  return result;
};

export type PlaceFinancialReceiptAtPositionResult = {
  urls: string[];
  replacedUrl: string | null;
  error?: string;
};

/** Insere ou substitui comprovante na posição 1–3 (ordem densa no array). */
export const placeFinancialReceiptAtPosition = (
  currentUrls: string[],
  position: number,
  newUrl: string
): PlaceFinancialReceiptAtPositionResult => {
  if (position < 1 || position > FINANCIAL_MAX_RECEIPTS_PER_ENTRY) {
    return {
      urls: normalizeFinancialReceiptUrls(currentUrls),
      replacedUrl: null,
      error: `Posição de comprovante inválida: ${position}.`,
    };
  }

  const next = normalizeFinancialReceiptUrls(currentUrls);
  const index = position - 1;

  if (index > next.length) {
    return {
      urls: next,
      replacedUrl: null,
      error: `Não é possível anexar na posição ${position} sem os comprovantes anteriores.`,
    };
  }

  const replacedUrl = index < next.length ? next[index] ?? null : null;

  if (index === next.length) {
    next.push(newUrl);
  } else {
    next[index] = newUrl;
  }

  return {
    urls: normalizeFinancialReceiptUrls(next),
    replacedUrl,
  };
};

export const getFinancialEntryReceiptUrls = (entry: Pick<FinancialEntry, 'receipt_url' | 'receipt_urls'>) => {
  const fromArray = normalizeFinancialReceiptUrls(entry.receipt_urls);

  if (fromArray.length) {
    return fromArray;
  }

  const legacy = normalizeReceiptUrl(entry.receipt_url);

  return legacy ? [legacy] : [];
};

export const parseFinancialReceiptUrlsFromRow = (row: Record<string, unknown>): string[] => {
  const fromColumn = normalizeFinancialReceiptUrls(row.receipt_urls);

  if (fromColumn.length) {
    return fromColumn;
  }

  const legacy = normalizeReceiptUrl(row.receipt_url);

  return legacy ? [legacy] : [];
};

export const mergeFinancialReceiptUrlsIntoEntries = (
  entries: FinancialEntry[],
  rows: { id?: string; receipt_url?: string | null; receipt_urls?: unknown }[] | null | undefined
): FinancialEntry[] => {
  if (!rows?.length) {
    return entries;
  }

  const urlsById = new Map<string, string[]>();

  for (const row of rows) {
    const id = String(row.id ?? '').trim();

    if (!id) {
      continue;
    }

    const urls = parseFinancialReceiptUrlsFromRow(row as Record<string, unknown>);

    if (urls.length) {
      urlsById.set(id, urls);
    }
  }

  if (!urlsById.size) {
    return entries;
  }

  return entries.map((entry) => {
    const urls = urlsById.get(entry.id);

    if (!urls?.length) {
      return entry;
    }

    return {
      ...entry,
      receipt_urls: urls,
      receipt_url: urls[0] ?? null,
    };
  });
};
