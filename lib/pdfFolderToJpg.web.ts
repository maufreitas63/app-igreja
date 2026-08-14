import {
  buildPdfToJpgCommand,
  resolvePdfToJpgFolderPath,
  type PdfFolderToJpgResult,
} from '@/lib/pdfFolderToJpg';

export const PDF_TO_JPG_HELPER_URL = 'https://127.0.0.1:47821';

const HELPER_HINT =
  'Helper local não está em execução. Na pasta do projeto, rode: npm run pdf-to-jpg:helper. ' +
  'Na primeira vez, abra https://127.0.0.1:47821/health no Chrome, avance no aviso de certificado e clique de novo no botão.';

export const isPdfFolderToJpgSupported = () =>
  typeof window !== 'undefined' && typeof document !== 'undefined';

export async function pickPdfConversionFolder(): Promise<{
  folderName: string | null;
  fileCount: number;
  pdfCount: number;
} | null> {
  return null;
}

export async function convertPdfsInDirectory(folderHint?: string | null): Promise<PdfFolderToJpgResult> {
  const folderPath = resolvePdfToJpgFolderPath(folderHint);
  const command = buildPdfToJpgCommand(folderPath);

  let response: Response;

  try {
    response = await fetch(`${PDF_TO_JPG_HELPER_URL}/convert`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folderPath }),
    });
  } catch {
    throw new Error(HELPER_HINT);
  }

  const payload = (await response.json().catch(() => null)) as
    | {
        ok?: boolean;
        message?: string;
        okCount?: number;
        skipped?: number;
        failed?: number;
        pages?: number;
      }
    | null;

  if (!response.ok || !payload?.ok) {
    throw new Error(payload?.message || HELPER_HINT);
  }

  const convertedCount = Number(payload.okCount ?? 0);
  const skippedCount = Number(payload.skipped ?? 0);
  const failedCount = Number(payload.failed ?? 0);

  return {
    converted: Array.from({ length: convertedCount }, () => 'ok'),
    skippedExisting: Array.from({ length: skippedCount }, () => 'skipped'),
    skippedEmpty: [],
    errors: Array.from({ length: failedCount }, () => ({
      fileName: folderPath,
      error: 'Falha na conversão (veja o terminal do helper).',
    })),
    pdfCount: convertedCount + skippedCount + failedCount,
    pageCount: Number(payload.pages ?? 0),
    folderPath,
    command,
    helperSummary: {
      ok: convertedCount,
      skipped: skippedCount,
      failed: failedCount,
      pages: Number(payload.pages ?? 0),
    },
  };
}
