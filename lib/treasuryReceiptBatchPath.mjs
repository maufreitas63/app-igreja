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

export const normalizeTreasuryReceiptFileName = (fileName) => {
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

  const withoutExt = name.replace(/\.jpg$/i, '').trim();

  const dottedDateMatch = withoutExt.match(
    /^(\d{4})[.\-/](\d{2})[.\-/](\d{2})\s+([+-]?\s*[\d.,]+)$/
  );

  if (dottedDateMatch) {
    const [, year, month, day, amountToken] = dottedDateMatch;
    const amount = parseTreasuryReceiptAmountToken(amountToken);

    if (!amount) {
      return null;
    }

    return `${year}${month}${day} ${amount}.jpg`;
  }

  const compactDateMatch = withoutExt.match(/^(\d{4})(\d{2})(\d{2})\s+([+-]?\s*[\d.,]+)$/);

  if (compactDateMatch) {
    const [, year, month, day, amountToken] = compactDateMatch;
    const amount = parseTreasuryReceiptAmountToken(amountToken);

    if (!amount) {
      return null;
    }

    return `${year}${month}${day} ${amount}.jpg`;
  }

  return null;
};

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
