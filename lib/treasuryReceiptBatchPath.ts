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

export const isTreasuryReceiptFileName = (fileName: string) =>
  fileName.toLowerCase().endsWith('.jpg') && !fileName.toLowerCase().startsWith('updated_');

export const buildUpdatedTreasuryReceiptFileName = (fileName: string) => {
  const trimmed = fileName.trim();

  if (!trimmed || trimmed.startsWith('updated_')) {
    return trimmed;
  }

  return `updated_${trimmed}`;
};
