import { parseFinancialAnalyticalSummaryFileName } from '@/lib/financialAnalyticalSummary';
import {
  buildUpdatedTreasuryReceiptFileName,
  isTreasuryReceiptFileName,
  parseTreasuryReceiptFileName,
  resolveTreasuryReceiptLinkPosition,
} from '@/lib/treasuryReceiptBatchPath';
import type {
  TreasuryReceiptFolderAccess,
  TreasuryReceiptFolderFile,
  TreasuryReceiptSummaryFolderFile,
} from '@/lib/treasuryReceiptFolderAccess';

type FileSystemFileHandleLike = {
  kind: 'file';
  getFile: () => Promise<File>;
  move?: (newName: string) => Promise<void>;
};

type FileSystemDirectoryHandleLike = {
  entries: () => AsyncIterable<[string, FileSystemFileHandleLike | { kind: 'directory' }]>;
};

const readFileAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        reject(new Error('Não foi possível ler o arquivo JPG.'));
        return;
      }

      resolve(reader.result);
    };

    reader.onerror = () => {
      reject(reader.error ?? new Error('Não foi possível ler o arquivo JPG.'));
    };

    reader.readAsDataURL(file);
  });

const createMarkProcessed =
  (fileHandle: FileSystemFileHandleLike, fileName: string, canonicalFileName: string, canRename: boolean) =>
  async () => {
    if (!canRename) {
      throw new Error('O navegador não permitiu renomear arquivos nesta pasta.');
    }

    const processedName = buildUpdatedTreasuryReceiptFileName(canonicalFileName);
    const currentName = fileName;

    if (currentName !== canonicalFileName) {
      await fileHandle.move!(canonicalFileName);
    }

    await fileHandle.move!(processedName);
  };

const collectDirectoryFiles = async (directoryHandle: FileSystemDirectoryHandleLike) => {
  const files: TreasuryReceiptFolderFile[] = [];
  const summaryFiles: TreasuryReceiptSummaryFolderFile[] = [];

  for await (const [fileName, handle] of directoryHandle.entries()) {
    if (handle.kind !== 'file' || !isTreasuryReceiptFileName(fileName)) {
      continue;
    }

    const fileHandle = handle as FileSystemFileHandleLike;
    const canRename = typeof fileHandle.move === 'function';
    const summaryParsed = parseFinancialAnalyticalSummaryFileName(fileName);

    if (summaryParsed) {
      summaryFiles.push({
        fileName,
        periodCode: summaryParsed.periodCode,
        canonicalFileName: summaryParsed.canonicalFileName,
        originalFileName: fileName !== summaryParsed.canonicalFileName ? fileName : undefined,
        readDataUrl: async () => readFileAsDataUrl(await fileHandle.getFile()),
        markProcessed: createMarkProcessed(
          fileHandle,
          fileName,
          summaryParsed.canonicalFileName,
          canRename
        ),
      });
      continue;
    }

    const parsed = parseTreasuryReceiptFileName(fileName);

    if (!parsed) {
      continue;
    }

    const { referencia, canonicalFileName, position } = parsed;
    const linkPosition = resolveTreasuryReceiptLinkPosition(position);

    files.push({
      fileName,
      canonicalFileName,
      referencia,
      position: linkPosition,
      originalFileName: fileName !== canonicalFileName ? fileName : undefined,
      readDataUrl: async () => readFileAsDataUrl(await fileHandle.getFile()),
      markProcessed: createMarkProcessed(fileHandle, fileName, canonicalFileName, canRename),
    });
  }

  files.sort((left, right) => {
    const referenciaOrder = left.referencia.localeCompare(right.referencia, 'pt-BR');

    if (referenciaOrder !== 0) {
      return referenciaOrder;
    }

    return left.position - right.position;
  });

  summaryFiles.sort((left, right) => right.periodCode.localeCompare(left.periodCode));

  return { files, summaryFiles };
};

export const isTreasuryReceiptFolderAccessSupported = () =>
  typeof window !== 'undefined' && typeof window.showDirectoryPicker === 'function';

export async function pickTreasuryReceiptFolderFiles(): Promise<TreasuryReceiptFolderAccess | null> {
  if (!isTreasuryReceiptFolderAccessSupported()) {
    throw new Error(
      'Selecione a pasta no Chrome ou Edge (desktop). Firefox e Safari ainda não suportam esta integração.'
    );
  }

  let directoryHandle: FileSystemDirectoryHandleLike;

  try {
    directoryHandle = (await window.showDirectoryPicker({
      mode: 'readwrite',
    })) as FileSystemDirectoryHandleLike;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      return null;
    }

    throw error;
  }

  const { files, summaryFiles } = await collectDirectoryFiles(directoryHandle);

  return {
    files,
    summaryFiles,
    canRenameAfterUpload: true,
  };
}
