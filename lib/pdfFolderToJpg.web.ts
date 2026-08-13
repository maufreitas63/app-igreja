import { zipSync } from 'fflate';
import type { PdfFolderToJpgResult } from '@/lib/pdfFolderToJpg';

const JPEG_QUALITY = 0.85;
const RENDER_SCALE = 2;

declare global {
  interface Window {
    showDirectoryPicker?: (options?: {
      id?: string;
      mode?: 'read' | 'readwrite';
    }) => Promise<FileSystemDirectoryHandle>;
  }
}

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

const formatUnknownError = (error: unknown) => {
  if (error instanceof Error) {
    const cause =
      error.cause instanceof Error
        ? ` (${error.cause.message})`
        : typeof error.cause === 'string'
          ? ` (${error.cause})`
          : '';
    return `${error.name}: ${error.message}${cause}`.trim();
  }

  return String(error);
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

type PdfJsModule = {
  version: string;
  GlobalWorkerOptions: { workerSrc: string };
  getDocument: (params: {
    data: Uint8Array;
    useSystemFonts?: boolean;
    isEvalSupported?: boolean;
    useWorkerFetch?: boolean;
  }) => { promise: Promise<PdfJsDocument> };
};

type PdfJsDocument = {
  numPages: number;
  getPage: (pageNumber: number) => Promise<PdfJsPage>;
  destroy: () => Promise<void>;
};

type PdfJsPage = {
  getViewport: (params: { scale: number }) => { width: number; height: number };
  render: (params: {
    canvasContext: CanvasRenderingContext2D;
    viewport: { width: number; height: number };
    canvas: HTMLCanvasElement;
  }) => { promise: Promise<void> };
  cleanup: () => void;
};

let pdfJsModulePromise: Promise<PdfJsModule> | null = null;

async function importSameOriginModule(moduleUrl: string): Promise<PdfJsModule> {
  // new Function evita que o Metro reescreva o import dinâmico.
  const importer = new Function('url', 'return import(url)') as (url: string) => Promise<PdfJsModule>;
  return importer(moduleUrl);
}

async function ensurePdfJs(): Promise<PdfJsModule> {
  if (pdfJsModulePromise) {
    return pdfJsModulePromise;
  }

  pdfJsModulePromise = (async () => {
    const origin = window.location.origin;
    const pdfjs = await importSameOriginModule(`${origin}/pdf.min.mjs`);
    if (!pdfjs?.getDocument) {
      throw new Error('pdf.js carregou, mas getDocument não está disponível.');
    }
    pdfjs.GlobalWorkerOptions.workerSrc = `${origin}/pdf.worker.min.mjs`;
    return pdfjs;
  })();

  try {
    return await pdfJsModulePromise;
  } catch (error) {
    pdfJsModulePromise = null;
    throw error;
  }
}

async function canvasToJpegBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((value) => resolve(value), 'image/jpeg', JPEG_QUALITY);
  });

  if (blob) {
    return blob;
  }

  // Fallback se toBlob falhar em algum browser.
  const dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
  const response = await fetch(dataUrl);
  return response.blob();
}

async function renderPdfPagesToJpegBlobs(file: File): Promise<Blob[]> {
  const pdfjs = await ensurePdfJs();
  const data = new Uint8Array(await file.arrayBuffer());

  const pdfDocument = await pdfjs.getDocument({
    data,
    useSystemFonts: true,
    isEvalSupported: false,
    useWorkerFetch: false,
  }).promise;

  const blobs: Blob[] = [];

  try {
    for (let pageNumber = 1; pageNumber <= pdfDocument.numPages; pageNumber += 1) {
      const page = await pdfDocument.getPage(pageNumber);
      const viewport = page.getViewport({ scale: RENDER_SCALE });
      const canvas = globalThis.document.createElement('canvas');
      canvas.width = Math.max(1, Math.floor(viewport.width));
      canvas.height = Math.max(1, Math.floor(viewport.height));
      const context = canvas.getContext('2d', { alpha: false });

      if (!context) {
        throw new Error('Canvas 2D indisponível neste navegador.');
      }

      context.fillStyle = '#FFFFFF';
      context.fillRect(0, 0, canvas.width, canvas.height);

      const renderTask = page.render({
        canvasContext: context,
        viewport,
        canvas,
      });

      await renderTask.promise;

      blobs.push(await canvasToJpegBlob(canvas));
      page.cleanup();
    }
  } finally {
    await pdfDocument.destroy();
  }

  return blobs;
}

async function writeBlobToDirectory(
  dirHandle: FileSystemDirectoryHandle,
  fileName: string,
  blob: Blob
) {
  const fileHandle = await dirHandle.getFileHandle(fileName, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(blob);
  await writable.close();
}

async function downloadZip(files: Record<string, Uint8Array>, zipName: string) {
  const zipped = zipSync(files, { level: 6 });
  const blob = new Blob([zipped], { type: 'application/zip' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = zipName;
  anchor.rel = 'noopener';
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // Revoga depois para não cortar o download.
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

export type PdfFolderPick =
  | {
      kind: 'fsa';
      dirHandle: FileSystemDirectoryHandle;
      namesLower: Set<string>;
      pdfFiles: Array<{ name: string; read: () => Promise<File> }>;
    }
  | {
      kind: 'input';
      namesLower: Set<string>;
      pdfFiles: Array<{ name: string; read: () => Promise<File> }>;
    };

export const isPdfFolderToJpgSupported = () =>
  typeof window !== 'undefined' && typeof document !== 'undefined';

async function listFsaTopLevel(dirHandle: FileSystemDirectoryHandle) {
  const namesLower = new Set<string>();
  const pdfFiles: Array<{ name: string; read: () => Promise<File> }> = [];

  for await (const [name, handle] of dirHandle.entries()) {
    namesLower.add(name.toLowerCase());

    if (handle.kind === 'file' && hasPdfExtension(name)) {
      const fileHandle = handle as FileSystemFileHandle;
      pdfFiles.push({
        name,
        read: () => fileHandle.getFile(),
      });
    }
  }

  pdfFiles.sort((left, right) => left.name.localeCompare(right.name, 'pt-BR'));
  return { namesLower, pdfFiles };
}

/** Abre o seletor de pasta. Prefere FSA (grava na pasta); fallback webkitdirectory. */
export async function pickPdfConversionFolder(): Promise<PdfFolderPick | null> {
  if (!isPdfFolderToJpgSupported()) {
    throw new Error('Conversão PDF → JPG disponível apenas na versão web (Chrome ou Edge).');
  }

  // 1) Tentativa com File System Access API (grava JPG na pasta escolhida).
  if (typeof window.showDirectoryPicker === 'function') {
    try {
      const dirHandle = await window.showDirectoryPicker({
        id: 'treasury-pdf-to-jpg',
        mode: 'readwrite',
      });

      const permission =
        typeof dirHandle.requestPermission === 'function'
          ? await dirHandle.requestPermission({ mode: 'readwrite' })
          : 'granted';

      if (permission !== 'granted') {
        throw new Error('Permissão de gravação na pasta negada pelo navegador.');
      }

      const listed = await listFsaTopLevel(dirHandle);
      return {
        kind: 'fsa',
        dirHandle,
        namesLower: listed.namesLower,
        pdfFiles: listed.pdfFiles,
      };
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        // Cancelamento real OU bloqueio do gesto — cai no fallback estável.
      } else if (!(error instanceof DOMException)) {
        // Continua para fallback; erro de permissão etc. também tenta input.
        console.warn('FSA PDF→JPG indisponível, usando seletor alternativo.', error);
      } else if (error.name !== 'AbortError') {
        console.warn('FSA PDF→JPG falhou, usando seletor alternativo.', error);
      }
    }
  }

  // 2) Fallback estável no Windows (mesmo dos comprovantes).
  const browserFiles = await pickFolderFilesViaInput();

  if (browserFiles === null) {
    return null;
  }

  const selectedRootName = resolveSelectedFolderRootName(browserFiles);
  const topLevelFiles = browserFiles.filter((file) =>
    isTopLevelFolderFile(file, selectedRootName)
  );
  const namesLower = new Set(topLevelFiles.map((file) => file.name.toLowerCase()));
  const pdfFiles = topLevelFiles
    .filter((file) => hasPdfExtension(file.name))
    .sort((left, right) => left.name.localeCompare(right.name, 'pt-BR'))
    .map((file) => ({
      name: file.name,
      read: async () => file,
    }));

  return {
    kind: 'input',
    namesLower,
    pdfFiles,
  };
}

export async function convertPdfsInDirectory(pick: PdfFolderPick): Promise<PdfFolderToJpgResult> {
  const result: PdfFolderToJpgResult = {
    converted: [],
    skippedExisting: [],
    skippedEmpty: [],
    errors: [],
    pdfCount: pick.pdfFiles.length,
    pageCount: 0,
  };

  const namesLower = new Set(pick.namesLower);
  const zipParts: Record<string, Uint8Array> = {};

  // Garante worker same-origin configurado antes do primeiro PDF.
  try {
    await ensurePdfJs();
  } catch (error) {
    const message = formatUnknownError(error);
    for (const pdf of pick.pdfFiles) {
      result.errors.push({ fileName: pdf.name, error: message });
    }
    return result;
  }

  for (const pdfEntry of pick.pdfFiles) {
    const baseName = stripExtension(pdfEntry.name);

    if (outputsAlreadyExist(baseName, namesLower)) {
      result.skippedExisting.push(pdfEntry.name);
      continue;
    }

    try {
      const file = await pdfEntry.read();
      const blobs = await renderPdfPagesToJpegBlobs(file);

      if (!blobs.length) {
        result.skippedEmpty.push(pdfEntry.name);
        continue;
      }

      for (let index = 0; index < blobs.length; index += 1) {
        const outName = pageOutputName(baseName, index + 1, blobs.length);
        const blob = blobs[index]!;

        if (pick.kind === 'fsa') {
          await writeBlobToDirectory(pick.dirHandle, outName, blob);
        } else {
          const buffer = new Uint8Array(await blob.arrayBuffer());
          zipParts[outName] = buffer;
        }

        namesLower.add(outName.toLowerCase());
      }

      result.converted.push(pdfEntry.name);
      result.pageCount += blobs.length;
    } catch (error) {
      result.errors.push({
        fileName: pdfEntry.name,
        error: formatUnknownError(error),
      });
    }
  }

  if (pick.kind === 'input' && Object.keys(zipParts).length > 0) {
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    await downloadZip(zipParts, `comprovantes-pdf-jpg-${stamp}.zip`);
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
