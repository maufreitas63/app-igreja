import type { PdfFolderToJpgResult } from '@/lib/pdfFolderToJpg';

type DirectoryHandle = FileSystemDirectoryHandle;
type FileHandle = FileSystemFileHandle;

declare global {
  interface Window {
    showDirectoryPicker?: (options?: {
      id?: string;
      mode?: 'read' | 'readwrite';
      startIn?: 'documents' | 'desktop' | 'downloads' | string;
    }) => Promise<DirectoryHandle>;
  }
}

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

async function listTopLevelEntries(dirHandle: DirectoryHandle) {
  const files: Array<{ name: string; handle: FileHandle }> = [];
  const namesLower = new Set<string>();

  // entries() retorna só o nível da pasta (não entra em subpastas).
  for await (const [name, handle] of dirHandle.entries()) {
    namesLower.add(name.toLowerCase());

    if (handle.kind === 'file') {
      files.push({ name, handle: handle as FileHandle });
    }
  }

  return { files, namesLower };
}

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
  const document = await pdfjs.getDocument({ data }).promise;
  const blobs: Blob[] = [];

  try {
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
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
    await document.destroy();
  }

  return blobs;
}

async function writeBlobToDirectory(
  dirHandle: DirectoryHandle,
  fileName: string,
  blob: Blob
) {
  const fileHandle = await dirHandle.getFileHandle(fileName, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(blob);
  await writable.close();
}

export const isPdfFolderToJpgSupported = () =>
  typeof window !== 'undefined' && typeof window.showDirectoryPicker === 'function';

export async function pickPdfConversionFolder(): Promise<DirectoryHandle | null> {
  if (!isPdfFolderToJpgSupported()) {
    throw new Error(
      'Conversão PDF → JPG requer Chrome ou Edge no desktop (seletor de pasta com gravação).'
    );
  }

  try {
    const dirHandle = await window.showDirectoryPicker!({
      id: 'treasury-pdf-to-jpg',
      mode: 'readwrite',
    });

    const permission =
      typeof dirHandle.requestPermission === 'function'
        ? await dirHandle.requestPermission({ mode: 'readwrite' })
        : 'granted';

    if (permission !== 'granted') {
      throw new Error('Permissão de gravação na pasta negada.');
    }

    return dirHandle;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      return null;
    }

    throw error;
  }
}

export async function convertPdfsInDirectory(
  dirHandle: DirectoryHandle
): Promise<PdfFolderToJpgResult> {
  const { files, namesLower } = await listTopLevelEntries(dirHandle);
  const pdfFiles = files
    .filter((entry) => hasPdfExtension(entry.name))
    .sort((left, right) => left.name.localeCompare(right.name, 'pt-BR'));

  const result: PdfFolderToJpgResult = {
    converted: [],
    skippedExisting: [],
    skippedEmpty: [],
    errors: [],
    pdfCount: pdfFiles.length,
    pageCount: 0,
  };

  for (const pdfEntry of pdfFiles) {
    const baseName = stripExtension(pdfEntry.name);

    if (outputsAlreadyExist(baseName, namesLower)) {
      result.skippedExisting.push(pdfEntry.name);
      continue;
    }

    try {
      const file = await pdfEntry.handle.getFile();
      const blobs = await renderPdfPagesToJpegBlobs(file);

      if (!blobs.length) {
        result.skippedEmpty.push(pdfEntry.name);
        continue;
      }

      for (let index = 0; index < blobs.length; index += 1) {
        const outName = pageOutputName(baseName, index + 1, blobs.length);
        await writeBlobToDirectory(dirHandle, outName, blobs[index]!);
        namesLower.add(outName.toLowerCase());
      }

      result.converted.push(pdfEntry.name);
      result.pageCount += blobs.length;
    } catch (error) {
      result.errors.push({
        fileName: pdfEntry.name,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return result;
}

export async function convertPdfFolderToJpg(): Promise<PdfFolderToJpgResult | null> {
  const dirHandle = await pickPdfConversionFolder();

  if (!dirHandle) {
    return null;
  }

  return convertPdfsInDirectory(dirHandle);
}
