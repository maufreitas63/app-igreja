import { normalizeIsbnInput } from '@/lib/livrosApi';

const ISBN13_IN_TEXT = /97[89]\d{10}/;

/** Tipos 1D que o expo-camera lê no ISBN impresso na contracapa. */
export const ISBN_CAMERA_BARCODE_TYPES = [
  'ean13',
  'ean8',
  'upc_a',
  'upc_e',
  'code128',
  'code39',
  'itf14',
] as const;

/** Formatos da Barcode Detection API no navegador. */
export const ISBN_WEB_BARCODE_FORMATS = [
  'ean_13',
  'ean_8',
  'upc_a',
  'upc_e',
  'code_128',
  'code_39',
  'itf',
] as const;

export function extractIsbnFromBarcode(raw: string): string | null {
  const compact = normalizeIsbnInput(raw);
  if (!compact) {
    return null;
  }

  const bookland = compact.match(ISBN13_IN_TEXT);
  if (bookland) {
    return bookland[0];
  }

  if (compact.length === 13 && /^\d{13}$/.test(compact)) {
    return compact;
  }

  if (compact.length === 10 && /^\d{9}[\dX]$/.test(compact)) {
    return compact;
  }

  if (compact.length === 12 && /^\d{12}$/.test(compact)) {
    return compact;
  }

  return null;
}
