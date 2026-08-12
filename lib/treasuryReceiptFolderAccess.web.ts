import { parseFinancialAnalyticalSummaryFileName } from '@/lib/financialAnalyticalSummary';
import {
  buildUpdatedTreasuryReceiptFileName,
  hasTreasuryReceiptImageExtension,
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

    if (currentName !== canonicalFileName && currentName !== processedName) {
      try {
        await fileHandle.move!(canonicalFileName);
      } catch {
        // Já pode estar no nome canônico / updated_.
      }
    }

    if (currentName !== processedName) {
      try {
        await fileHandle.move!(processedName);
      } catch {
        // Se já estiver updated_, segue sem falhar o upload na nuvem.
      }
    }
  };

/** Aceita .jpg/.jpeg, inclusive já renomeados com updated_ (necessário p/ reenviar Resumo). */
const isCollectableTreasuryImage = (fileName: string) => {
  if (typeof fileName !== 'string' || !fileName.trim()) {
    return false;
  }

  return hasTreasuryReceiptImageExtension(fileName.trim());
};

const collectDirectoryFiles = async (directoryHandle: FileSystemDirectoryHandleLike) => {
  const files: TreasuryReceiptFolderFile[] = [];
  const summaryFiles: TreasuryReceiptSummaryFolderFile[] = [];

  for await (const [fileName, handle] of directoryHandle.entries()) {
    if (handle.kind !== 'file' || !isCollectableTreasuryImage(fileName)) {
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

    // Comprovantes já processados (updated_) não reentram no vínculo por referencia.
    if (fileName.trim().toLowerCase().startsWith('updated_')) {
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

  const pickDirectory = async (mode: 'read' | 'readwrite') =>
    (await window.showDirectoryPicker({ mode })) as FileSystemDirectoryHandleLike;

  const isAbortError = (error: unknown) => {
    if (error instanceof DOMException && error.name === 'AbortError') {
      return true;
    }

    return (
      typeof error === 'object' &&
      error !== null &&
      'name' in error &&
      (error as { name?: string }).name === 'AbortError'
    );
  };

  const describePickerError = (error: unknown) => {
    const name =
      error instanceof DOMException
        ? error.name
        : typeof error === 'object' && error && 'name' in error
          ? String((error as { name?: string }).name ?? '')
          : '';
    const message = error instanceof Error ? error.message : '';

    if (name === 'NotAllowedError' || /user gesture|user activation/i.test(message)) {
      return new Error(
        'O navegador bloqueou o seletor de pasta. Clique em Processar e escolha a pasta imediatamente no diálogo do sistema (Chrome/Edge no desktop).'
      );
    }

    if (name === 'SecurityError') {
      return new Error(
        'O navegador bloqueou o acesso à pasta por segurança. Use Chrome ou Edge no desktop e permita o acesso quando solicitado.'
      );
    }

    return error instanceof Error
      ? error
      : new Error('Não foi possível abrir o seletor de pasta.');
  };

  let directoryHandle: FileSystemDirectoryHandleLike;
  let canRenameAfterUpload = true;

  try {
    directoryHandle = await pickDirectory('readwrite');
  } catch (error) {
    if (isAbortError(error)) {
      return null;
    }

    // Sem permissão de escrita: ainda dá para ler e enviar; só não renomeia localmente.
    try {
      directoryHandle = await pickDirectory('read');
      canRenameAfterUpload = false;
    } catch (fallbackError) {
      if (isAbortError(fallbackError)) {
        return null;
      }

      throw describePickerError(fallbackError);
    }
  }

  const { files, summaryFiles } = await collectDirectoryFiles(directoryHandle);

  return {
    files,
    summaryFiles,
    canRenameAfterUpload,
  };
}

