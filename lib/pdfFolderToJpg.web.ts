import {
  buildPdfToJpgCommand,
  buildPdfToJpgProtocolUrl,
  resolvePdfToJpgFolderPath,
  type PdfFolderToJpgResult,
} from '@/lib/pdfFolderToJpg';

export const isPdfFolderToJpgSupported = () =>
  typeof window !== 'undefined' && typeof document !== 'undefined';

export async function pickPdfConversionFolder(): Promise<{
  folderName: string | null;
  fileCount: number;
  pdfCount: number;
} | null> {
  return null;
}

function launchLocalConverter(folderPath: string) {
  const url = buildPdfToJpgProtocolUrl(folderPath);
  window.location.assign(url);
}

export async function convertPdfsInDirectory(folderHint?: string | null): Promise<PdfFolderToJpgResult> {
  const folderPath = resolvePdfToJpgFolderPath(folderHint);
  const command = buildPdfToJpgCommand(folderPath);

  launchLocalConverter(folderPath);

  return {
    converted: [],
    skippedExisting: [],
    skippedEmpty: [],
    errors: [],
    pdfCount: 0,
    pageCount: 0,
    folderPath,
    command,
    helperSummary: {
      ok: 0,
      skipped: 0,
      failed: 0,
      pages: 0,
    },
  };
}
