export const DEFAULT_TREASURY_RECEIPTS_DIR = 'C:\\IBN Tesouraria\\Comprovantes\\JPG';

const STORAGE_KEY = 'maintenance.treasuryReceiptsDir';

export const loadTreasuryReceiptsDir = (): string => {
  if (typeof localStorage === 'undefined') {
    return DEFAULT_TREASURY_RECEIPTS_DIR;
  }

  const stored = localStorage.getItem(STORAGE_KEY)?.trim();

  return stored || DEFAULT_TREASURY_RECEIPTS_DIR;
};

export const saveTreasuryReceiptsDir = (value: string) => {
  if (typeof localStorage === 'undefined') {
    return;
  }

  const trimmed = value.trim();

  if (!trimmed) {
    localStorage.removeItem(STORAGE_KEY);
    return;
  }

  localStorage.setItem(STORAGE_KEY, trimmed);
};

/** Extensão canônica da referencia no banco e após normalização de nomes locais. */
export const TREASURY_RECEIPT_CANONICAL_EXTENSION = '.jpg';

const hasTreasuryReceiptImageExtension = (fileName: string) => {
  const lower = fileName.toLowerCase();

  return lower.endsWith('.jpeg') || lower.endsWith('.jpg');
};

const stripTreasuryReceiptImageExtension = (fileName: string): string | null => {
  const lower = fileName.toLowerCase();

  if (lower.endsWith('.jpeg')) {
    return fileName.slice(0, -5);
  }

  if (lower.endsWith('.jpg')) {
    return fileName.slice(0, -4);
  }

  return null;
};

const buildTreasuryReceiptCanonicalFileName = (referenciaBase: string, position: number | null) =>
  position !== null
    ? `${referenciaBase} ${position}${TREASURY_RECEIPT_CANONICAL_EXTENSION}`
    : `${referenciaBase}${TREASURY_RECEIPT_CANONICAL_EXTENSION}`;

export const formatTreasuryReceiptAmount = (amount: number) =>
  Math.abs(Number(amount) || 0)
    .toFixed(2)
    .replace('.', ',');

/** Monta referencia localmente: aaaammdd nnnn,nn.jpg */
export const buildFinancialReferencia = (transactionDate: string, amount: number) => {
  const match = String(transactionDate ?? '')
    .trim()
    .match(/^(\d{4})-(\d{2})-(\d{2})/);

  if (!match) {
    return null;
  }

  const [, year, month, day] = match;

  return `${year}${month}${day} ${formatTreasuryReceiptAmount(amount)}.jpg`;
};

const parseTreasuryReceiptAmountToken = (token: string) => {
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

/** Converte o trecho sem extensão (e sem sufixo de posição) para aaaammdd nnnn,nn */
const parseTreasuryReceiptStemToReferenciaBase = (stem: string): string | null => {
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

export type ParsedTreasuryReceiptFileName = {
  /** Chave de busca do lançamento: aaaammdd nnnn,nn.jpg */
  referencia: string;
  /** Nome canônico do arquivo após normalização. */
  canonicalFileName: string;
  /** Posição 1–3 quando o nome termina com espaço + dígito; null no padrão único. */
  position: number | null;
};

/**
 * Interpreta nomes de comprovantes (.jpg ou .jpeg).
 * - Único: aaaammdd nnnn,nn.jpg
 * - Múltiplo: aaaammdd nnnn,nn n.jpg (espaço obrigatório antes do dígito de posição)
 * Arquivos .jpeg são normalizados para o padrão .jpg da referencia.
 */
export const parseTreasuryReceiptFileName = (fileName: string): ParsedTreasuryReceiptFileName | null => {
  if (typeof fileName !== 'string' || !fileName.trim()) {
    return null;
  }

  let name = fileName.trim();

  if (name.toLowerCase().startsWith('updated_')) {
    name = name.slice('updated_'.length);
  }

  if (!hasTreasuryReceiptImageExtension(name)) {
    return null;
  }

  const stemWithoutExtension = stripTreasuryReceiptImageExtension(name);

  if (stemWithoutExtension === null) {
    return null;
  }

  let stem = stemWithoutExtension.trim();
  let position: number | null = null;

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

  const referencia = buildTreasuryReceiptCanonicalFileName(referenciaBase, null);
  const canonicalFileName = buildTreasuryReceiptCanonicalFileName(referenciaBase, position);

  return {
    referencia,
    canonicalFileName,
    position,
  };
};

/** Posição efetiva para vinculação: padrão único usa a posição 1. */
export const resolveTreasuryReceiptLinkPosition = (position: number | null | undefined) =>
  position ?? 1;

/**
 * Converte nome de comprovante (.jpg/.jpeg) para o padrão canônico .jpg.
 * - Data aaaa.mm.dd → aaaammdd
 * - Remove sinal +/- antes do valor
 */
export const normalizeTreasuryReceiptFileName = (fileName: string): string | null =>
  parseTreasuryReceiptFileName(fileName)?.canonicalFileName ?? null;

export const isTreasuryReceiptFileName = (fileName: string) => {
  if (typeof fileName !== 'string' || !fileName.trim()) {
    return false;
  }

  const normalized = fileName.trim();

  return (
    hasTreasuryReceiptImageExtension(normalized) &&
    !normalized.toLowerCase().startsWith('updated_')
  );
};

export const buildUpdatedTreasuryReceiptFileName = (fileName: string) => {
  const trimmed = fileName.trim();

  if (!trimmed || trimmed.startsWith('updated_')) {
    return trimmed;
  }

  return `updated_${trimmed}`;
};
