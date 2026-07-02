import {
  buildUpdatedTreasuryReceiptFileName,
  isTreasuryReceiptFileName,
} from '@/lib/treasuryReceiptBatchPath';
import type {
  TreasuryReceiptFolderAccess,
  TreasuryReceiptFolderFile,
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

const collectDirectoryFiles = async (directoryHandle: FileSystemDirectoryHandleLike) => {
  const files: TreasuryReceiptFolderFile[] = [];

  for await (const [fileName, handle] of directoryHandle.entries()) {
    if (handle.kind !== 'file' || !isTreasuryReceiptFileName(fileName)) {
      continue;
    }

    const fileHandle = handle as FileSystemFileHandleLike;
    const canRename = typeof fileHandle.move === 'function';

    files.push({
      fileName,
      readDataUrl: async () => readFileAsDataUrl(await fileHandle.getFile()),
      markProcessed: async () => {
        if (!canRename) {
          throw new Error('O navegador não permitiu renomear arquivos nesta pasta.');
        }

        await fileHandle.move!(buildUpdatedTreasuryReceiptFileName(fileName));
      },
    });
  }

  files.sort((left, right) => left.fileName.localeCompare(right.fileName, 'pt-BR'));

  return files;
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

  const files = await collectDirectoryFiles(directoryHandle);

  return {
    files,
    canRenameAfterUpload: true,
  };
}
