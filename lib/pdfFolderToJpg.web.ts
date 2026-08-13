import type { PdfFolderToJpgResult } from '@/lib/pdfFolderToJpg';

const JPEG_QUALITY = 0.85;
const RENDER_SCALE = 2;

const hasJpgExtension = (name: string) => /\.jpe?g$/i.test(name);
const hasPdfExtension = (name: string) => /\.pdf$/i.test(name);

const stripExtension = (fileName: string) => fileName.replace(/\.[^.]+$/i, '');

const pageOutputName = (pdfBaseName: string, pageNumber: number, pageCount: number) => {
  if (pageCount <= 1) {
    return `${pdfBaseName}.jpg`;
  }

  return `${pdfBaseName}-p${String(pageNumber).padStart(2, '0')}.jpg`;
};

const outputsAlreadyExist = (pdfBaseName: string, namesLower: Set<string>) => {
  if (namesLower.has(`${pdfBaseName}.jpg`.toLowerCase())) {
    return true;
  }

  const prefix = `${pdfBaseName}-p`.toLowerCase();
  for (const name of namesLower) {
    if (name.startsWith(prefix) && hasJpgExtension(name)) {
      return true;
    }
  }

  return false;
};

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

  return null;
};

/** Só arquivos diretamente na pasta escolhida (desconsidera subpastas). */
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

async function ensurePdfJs() {
  const pdfjs = await import('pdfjs-dist');

  if (!pdfjs.GlobalWorkerOptions.workerSrc) {
    pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
  }

  return pdfjs;
}

async function renderPdfPagesToJpegBlobs(file: File): Promise<Blob[]> {
  const pdfjs = await ensurePdfJs();
  const data = new Uint8Array(await file.arrayBuffer());
  const pdfDocument = await pdfjs.getDocument({ data }).promise;
  const blobs: Blob[] = [];

  try {
    for (let pageNumber = 1; pageNumber <= pdfDocument.numPages; pageNumber += 1) {
      const page = await pdfDocument.getPage(pageNumber);
      const viewport = page.getViewport({ scale: RENDER_SCALE });
      const canvas = globalThis.document.createElement('canvas');
      canvas.width = Math.max(1, Math.floor(viewport.width));
      canvas.height = Math.max(1, Math.floor(viewport.height));
      const context = canvas.getContext('2d');

      if (!context) {
        throw new Error('Canvas 2D indisponível neste navegador.');
      }

      await page.render({
        canvasContext: context,
        viewport,
        canvas,
      }).promise;

      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (value) => {
            if (!value) {
              reject(new Error('Falha ao gerar JPG.'));
              return;
            }
            resolve(value);
          },
          'image/jpeg',
          JPEG_QUALITY
        );
      });

      blobs.push(blob);
      page.cleanup();
    }
  } finally {
    await pdfDocument.destroy();
  }

  return blobs;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.rel = 'noopener';
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export type PdfFolderPick = {
  topLevelFiles: File[];
};

export const isPdfFolderToJpgSupported = () =>
  typeof window !== 'undefined' && typeof document !== 'undefined';

/** Abre o seletor de pasta (webkitdirectory — estável no Windows/PWA). */
export async function pickPdfConversionFolder(): Promise<PdfFolderPick | null> {
  if (!isPdfFolderToJpgSupported()) {
    throw new Error('Conversão PDF → JPG disponível apenas na versão web (Chrome ou Edge).');
  }

  const browserFiles = await pickFolderFilesViaInput();

  if (browserFiles === null) {
    return null;
  }

  const selectedRootName = resolveSelectedFolderRootName(browserFiles);
  const topLevelFiles = browserFiles.filter((file) =>
    isTopLevelFolderFile(file, selectedRootName)
  );

  return { topLevelFiles };
}

export async function convertPdfsInDirectory(
  pick: PdfFolderPick
): Promise<PdfFolderToJpgResult> {
  const namesLower = new Set(pick.topLevelFiles.map((file) => file.name.toLowerCase()));
  const pdfFiles = pick.topLevelFiles
    .filter((file) => hasPdfExtension(file.name))
    .sort((left, right) => left.name.localeCompare(right.name, 'pt-BR'));

  const result: PdfFolderToJpgResult = {
    converted: [],
    skippedExisting: [],
    skippedEmpty: [],
    errors: [],
    pdfCount: pdfFiles.length,
    pageCount: 0,
  };

  for (const pdfFile of pdfFiles) {
    const baseName = stripExtension(pdfFile.name);

    if (outputsAlreadyExist(baseName, namesLower)) {
      result.skippedExisting.push(pdfFile.name);
      continue;
    }

    try {
      const blobs = await renderPdfPagesToJpegBlobs(pdfFile);

      if (!blobs.length) {
        result.skippedEmpty.push(pdfFile.name);
        continue;
      }

      for (let index = 0; index < blobs.length; index += 1) {
        const outName = pageOutputName(baseName, index + 1, blobs.length);
        await downloadBlob(blobs[index]!, outName);
        namesLower.add(outName.toLowerCase());
        await sleep(250);
      }

      result.converted.push(pdfFile.name);
      result.pageCount += blobs.length;
    } catch (error) {
      result.errors.push({
        fileName: pdfFile.name,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return result;
}

export async function convertPdfFolderToJpg(): Promise<PdfFolderToJpgResult | null> {
  const pick = await pickPdfConversionFolder();

  if (!pick) {
    return null;
  }

  return convertPdfsInDirectory(pick);
}
