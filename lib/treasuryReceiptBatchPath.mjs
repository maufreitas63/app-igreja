/** Espelho ESM de lib/treasuryReceiptBatchPath.ts para scripts Node. */

export const formatTreasuryReceiptAmount = (amount) =>
  Math.abs(Number(amount) || 0)
    .toFixed(2)
    .replace('.', ',');

export const buildFinancialReferencia = (transactionDate, amount) => {
  const match = String(transactionDate ?? '')
    .trim()
    .match(/^(\d{4})-(\d{2})-(\d{2})/);

  if (!match) {
    return null;
  }

  const [, year, month, day] = match;

  return `${year}${month}${day} ${formatTreasuryReceiptAmount(amount)}.jpg`;
};

const parseTreasuryReceiptAmountToken = (token) => {
  let normalized = token.trim().replace(/\s/g, '').replace(/^[+-]/, '');

  if (!normalized) {
    return null;
  }

  if (normalized.includes(',') && normalized.includes('.')) {
    normalized = normalized.replace(/\./g, '').replace(',', '.');
  } else if (normalized.includes(',')) {
    normalized = normalized.replace(',', '.');
  }

  const value = Math.abs(Number.parseFloat(normalized));

  if (!Number.isFinite(value)) {
    return null;
  }

  return formatTreasuryReceiptAmount(value);
};

const parseTreasuryReceiptStemToReferenciaBase = (stem) => {
  const dottedDateMatch = stem.match(/^(\d{4})[.\-/](\d{2})[.\-/](\d{2})\s+([+-]?\s*[\d.,]+)$/);

  if (dottedDateMatch) {
    const [, year, month, day, amountToken] = dottedDateMatch;
    const amount = parseTreasuryReceiptAmountToken(amountToken);

    if (!amount) {
      return null;
    }

    return `${year}${month}${day} ${amount}`;
  }

  const compactDateMatch = stem.match(/^(\d{4})(\d{2})(\d{2})\s+([+-]?\s*[\d.,]+)$/);

  if (compactDateMatch) {
    const [, year, month, day, amountToken] = compactDateMatch;
    const amount = parseTreasuryReceiptAmountToken(amountToken);

    if (!amount) {
      return null;
    }

    return `${year}${month}${day} ${amount}`;
  }

  return null;
};

export const parseTreasuryReceiptFileName = (fileName) => {
  if (typeof fileName !== 'string' || !fileName.trim()) {
    return null;
  }

  let name = fileName.trim();

  if (name.toLowerCase().startsWith('updated_')) {
    name = name.slice('updated_'.length);
  }

  if (!name.toLowerCase().endsWith('.jpg')) {
    return null;
  }

  let stem = name.replace(/\.jpg$/i, '').trim();
  let position = null;

  const positionMatch = stem.match(/ (\d)$/);

  if (positionMatch) {
    const digit = Number(positionMatch[1]);

    if (Number.isInteger(digit) && digit >= 1 && digit <= 3) {
      position = digit;
      stem = stem.slice(0, -positionMatch[0].length).trim();
    }
  }

  const referenciaBase = parseTreasuryReceiptStemToReferenciaBase(stem);

  if (!referenciaBase) {
    return null;
  }

  const referencia = `${referenciaBase}.jpg`;
  const canonicalFileName =
    position !== null ? `${referenciaBase} ${position}.jpg` : `${referenciaBase}.jpg`;

  return {
    referencia,
    canonicalFileName,
    position,
  };
};

export const resolveTreasuryReceiptLinkPosition = (position) => position ?? 1;

export const normalizeTreasuryReceiptFileName = (fileName) =>
  parseTreasuryReceiptFileName(fileName)?.canonicalFileName ?? null;

export const isTreasuryReceiptFileName = (fileName) => {
  if (typeof fileName !== 'string' || !fileName.trim()) {
    return false;
  }

  const normalized = fileName.trim();

  return (
    normalized.toLowerCase().endsWith('.jpg') && !normalized.toLowerCase().startsWith('updated_')
  );
};

export const buildUpdatedTreasuryReceiptFileName = (fileName) => {
  const trimmed = fileName.trim();

  if (!trimmed || trimmed.startsWith('updated_')) {
    return trimmed;
  }

  return `updated_${trimmed}`;
};

const normalizeReceiptUrls = (urls) => {
  if (!Array.isArray(urls)) {
    return [];
  }

  const seen = new Set();
  const result = [];

  for (const url of urls) {
    const normalized = typeof url === 'string' ? url.trim() : '';

    if (!normalized || seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    result.push(normalized);

    if (result.length >= 3) {
      break;
    }
  }

  return result;
};

export const placeFinancialReceiptAtPosition = (currentUrls, position, newUrl) => {
  if (position < 1 || position > 3) {
    return {
      urls: normalizeReceiptUrls(currentUrls),
      replacedUrl: null,
      error: `Posição de comprovante inválida: ${position}.`,
    };
  }

  const next = normalizeReceiptUrls(currentUrls);
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
    urls: normalizeReceiptUrls(next),
    replacedUrl,
  };
};

export const getEntryReceiptUrls = (entry) => {
  const fromArray = normalizeReceiptUrls(entry.receipt_urls);

  if (fromArray.length) {
    return fromArray;
  }

  const legacy = entry.receipt_url?.trim();

  return legacy ? [legacy] : [];
};
