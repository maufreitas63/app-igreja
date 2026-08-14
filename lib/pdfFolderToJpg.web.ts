import {
  buildPdfToJpgCommand,
  inferSelectedFolderName,
  resolvePdfToJpgFolderPath,
  type PdfFolderToJpgResult,
} from '@/lib/pdfFolderToJpg';

const hasPdfExtension = (name: string) => /\.pdf$/i.test(name);

const getRelativePathParts = (file: File) => {
  const relative =
    typeof (file as File & { webkitRelativePath?: string }).webkitRelativePath === 'string' &&
    (file as File & { webkitRelativePath: string }).webkitRelativePath.trim()
      ? (file as File & { webkitRelativePath: string }).webkitRelativePath
      : file.name;

  return relative
    .replace(/\\/g, '/')
    .split('/')
    .map((part) => part.trim())
    .filter(Boolean);
};

const resolveSelectedFolderRootName = (browserFiles: File[]) => {
  const paths = browserFiles.map(getRelativePathParts).filter((parts) => parts.length > 0);

  if (!paths.length) {
    return null;
  }

  const rootCandidate = paths[0]![0]!;
  const allShareRoot = paths.every((parts) => parts[0] === rootCandidate);
  const hasNestedOrFileUnderRoot = paths.some((parts) => parts.length >= 2);

  if (allShareRoot && hasNestedOrFileUnderRoot) {
    return rootCandidate;
  }

  return inferSelectedFolderName(browserFiles);
};

const isTopLevelFolderFile = (file: File, selectedRootName: string | null) => {
  const parts = getRelativePathParts(file);

  if (!parts.length) {
    return false;
  }

  if (selectedRootName) {
    return parts.length === 2 && parts[0] === selectedRootName;
  }

  return parts.length === 1;
};

const pickFolderFilesViaInput = (): Promise<File[] | null> =>
  new Promise((resolve) => {
    if (typeof document === 'undefined') {
      resolve(null);
      return;
    }

    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.accept = '.pdf,application/pdf,image/jpeg,.jpg,.jpeg';
    input.setAttribute('webkitdirectory', '');
    input.setAttribute('directory', '');
    // @ts-expect-error — propriedade legada ainda usada pelos browsers
    input.webkitdirectory = true;
    input.style.position = 'fixed';
    input.style.left = '-9999px';
    input.style.top = '0';
    input.tabIndex = -1;

    let settled = false;

    const finish = (value: File[] | null) => {
      if (settled) {
        return;
      }

      settled = true;
      input.removeEventListener('change', onChange);
      input.removeEventListener('cancel', onCancel);
      input.remove();
      resolve(value);
    };

    const onChange = () => {
      finish(Array.from(input.files ?? []));
    };

    const onCancel = () => {
      finish(null);
    };

    input.addEventListener('change', onChange);
    input.addEventListener('cancel', onCancel);
    document.body.appendChild(input);
    input.click();
  });

export const isPdfFolderToJpgSupported = () =>
  typeof window !== 'undefined' && typeof document !== 'undefined';

export async function pickPdfConversionFolder(): Promise<{
  folderName: string | null;
  fileCount: number;
  pdfCount: number;
} | null> {
  const browserFiles = await pickFolderFilesViaInput();

  if (browserFiles === null) {
    return null;
  }

  const selectedRootName = resolveSelectedFolderRootName(browserFiles);
  const topLevelFiles = browserFiles.filter((file) =>
    isTopLevelFolderFile(file, selectedRootName)
  );

  return {
    folderName: selectedRootName,
    fileCount: topLevelFiles.length,
    pdfCount: topLevelFiles.filter((file) => hasPdfExtension(file.name)).length,
  };
}

export const PDF_TO_JPG_HELPER_URL = 'http://127.0.0.1:47821';

export async function convertPdfsInDirectory(folderHint?: string | null): Promise<PdfFolderToJpgResult> {
  const folderPath = resolvePdfToJpgFolderPath(folderHint);
  const command = buildPdfToJpgCommand(folderPath);

  const response = await fetch(`${PDF_TO_JPG_HELPER_URL}/convert`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ folderPath }),
  });

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
    throw new Error(
      payload?.message ||
        'Helper local não está em execução. Na pasta do projeto, rode: npm run pdf-to-jpg:helper'
    );
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
