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

/** Monta referencia localmente: aaaammdd nnnn,nn.jpg */
export const buildFinancialReferencia = (transactionDate: string, amount: number) => {
  const match = String(transactionDate ?? '')
    .trim()
    .match(/^(\d{4})-(\d{2})-(\d{2})/);

  if (!match) {
    return null;
  }

  const [, year, month, day] = match;
  const absolute = Math.abs(Number(amount) || 0);

  return `${year}${month}${day} ${absolute.toFixed(2).replace('.', ',')}.jpg`;
};

export const isTreasuryReceiptFileName = (fileName: string) => {
  if (typeof fileName !== 'string' || !fileName.trim()) {
    return false;
  }

  const normalized = fileName.trim();

  return (
    normalized.toLowerCase().endsWith('.jpg') && !normalized.toLowerCase().startsWith('updated_')
  );
};

export const buildUpdatedTreasuryReceiptFileName = (fileName: string) => {
  const trimmed = fileName.trim();

  if (!trimmed || trimmed.startsWith('updated_')) {
    return trimmed;
  }

  return `updated_${trimmed}`;
};
