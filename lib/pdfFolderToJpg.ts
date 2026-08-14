import { Platform } from 'react-native';
import { DEFAULT_TREASURY_RECEIPTS_DIR } from '@/lib/treasuryReceiptBatchPath';

export const DEFAULT_PDF_TO_JPG_DIR = String.raw`C:\IBN Tesouraria\Comprovantes\JPG`;

export type PdfFolderToJpgResult = {
  converted: string[];
  skippedExisting: string[];
  skippedEmpty: string[];
  errors: Array<{ fileName: string; error: string }>;
  pdfCount: number;
  pageCount: number;
  folderPath: string;
  command: string;
  helperSummary?: {
    ok: number;
    skipped: number;
    failed: number;
    pages: number;
  };
};

export const isPdfFolderToJpgSupported = () =>
  Platform.OS === 'web' && typeof window !== 'undefined';

/** Infere o nome da pasta a partir dos arquivos escolhidos no seletor. */
export function inferSelectedFolderName(files: File[]): string | null {
  const first = files[0] as File & { webkitRelativePath?: string };
  const relative = first?.webkitRelativePath?.trim();

  if (relative) {
    const root = relative.replace(/\\/g, '/').split('/')[0]?.trim();
    return root || null;
  }

  return null;
}

export function buildPdfToJpgCommand(folderPath: string) {
  const escaped = folderPath.replace(/"/g, '\\"');
  return `node scripts/convert-pdf-folder-to-jpg.mjs --in "${escaped}" --out "${escaped}"`;
}

export function resolvePdfToJpgFolderPath(folderHint: string | null | undefined) {
  const trimmed = folderHint?.trim();

  if (!trimmed) {
    return DEFAULT_PDF_TO_JPG_DIR;
  }

  if (/^[A-Za-z]:[\\/]/.test(trimmed) || trimmed.startsWith('\\\\')) {
    return trimmed;
  }

  const receiptsHint = DEFAULT_TREASURY_RECEIPTS_DIR.trim();
  if (receiptsHint && (/^[A-Za-z]:[\\/]/.test(receiptsHint) || receiptsHint.startsWith('\\\\'))) {
    return receiptsHint;
  }

  if (trimmed.toLowerCase() === 'jpg') {
    return DEFAULT_PDF_TO_JPG_DIR;
  }

  return DEFAULT_PDF_TO_JPG_DIR;
}

export async function pickPdfConversionFolder(): Promise<{
  folderName: string | null;
  fileCount: number;
  pdfCount: number;
} | null> {
  throw new Error(
    'Seleção de pasta disponível apenas na versão web (Chrome ou Edge no desktop).'
  );
}

export async function convertPdfsInDirectory(
  _folderHint?: string | null
): Promise<PdfFolderToJpgResult> {
  throw new Error(
    'A conversão PDF → JPG roda no computador (Node), não no navegador.'
  );
}
