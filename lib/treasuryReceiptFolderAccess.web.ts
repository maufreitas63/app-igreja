import { parseFinancialAnalyticalSummaryFileName } from '@/lib/financialAnalyticalSummary';
import {
  hasTreasuryReceiptImageExtension,
  parseTreasuryReceiptFileName,
  resolveTreasuryReceiptLinkPosition,
} from '@/lib/treasuryReceiptBatchPath';
import type {
  TreasuryReceiptFolderAccess,
  TreasuryReceiptFolderFile,
  TreasuryReceiptSummaryFolderFile,
} from '@/lib/treasuryReceiptFolderAccess';

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

const noopMarkProcessed = async () => {
  // Seleção via <input webkitdirectory> não permite renomear no disco.
};

const isCollectableTreasuryImage = (fileName: string) => {
  if (typeof fileName !== 'string' || !fileName.trim()) {
    return false;
  }

  return hasTreasuryReceiptImageExtension(fileName.trim());
};

/** Só arquivos na raiz da pasta escolhida (ignora subpastas). */
const isTopLevelFolderFile = (file: File) => {
  const relative =
    typeof (file as File & { webkitRelativePath?: string }).webkitRelativePath === 'string'
      ? (file as File & { webkitRelativePath: string }).webkitRelativePath
      : file.name;
  const parts = relative.split(/[/\\]/).filter(Boolean);

  // "Pasta/arquivo.jpg" → 2 partes; arquivo solto → 1.
  return parts.length <= 2;
};

const collectFromBrowserFiles = (browserFiles: File[]) => {
  const files: TreasuryReceiptFolderFile[] = [];
  const summaryFiles: TreasuryReceiptSummaryFolderFile[] = [];

  for (const file of browserFiles) {
    if (!isTopLevelFolderFile(file) || !isCollectableTreasuryImage(file.name)) {
      continue;
    }

    const fileName = file.name;
    const summaryParsed = parseFinancialAnalyticalSummaryFileName(fileName);

    if (summaryParsed) {
      summaryFiles.push({
        fileName,
        periodCode: summaryParsed.periodCode,
        canonicalFileName: summaryParsed.canonicalFileName,
        originalFileName: fileName !== summaryParsed.canonicalFileName ? fileName : undefined,
        readDataUrl: async () => readFileAsDataUrl(file),
        markProcessed: noopMarkProcessed,
      });
      continue;
    }

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
      readDataUrl: async () => readFileAsDataUrl(file),
      markProcessed: noopMarkProcessed,
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

/**
 * Seletor de pasta via input nativo (webkitdirectory).
 * Mais estável no Chrome/Edge Windows do que showDirectoryPicker.
 *
 * Não usa detecção por `window.focus` — isso cancelava o fluxo enquanto o
 * usuário ainda navegava no diálogo do Windows.
 */
const pickFolderFilesViaInput = (): Promise<File[] | null> =>
  new Promise((resolve) => {
    if (typeof document === 'undefined') {
      resolve(null);
      return;
    }

    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.accept = 'image/jpeg,.jpg,.jpeg,image/*';
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
      // Pasta confirmada (pode vir vazia).
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

export const isTreasuryReceiptFolderAccessSupported = () =>
  typeof window !== 'undefined' && typeof document !== 'undefined';

export async function pickTreasuryReceiptFolderFiles(): Promise<TreasuryReceiptFolderAccess | null> {
  if (!isTreasuryReceiptFolderAccessSupported()) {
    throw new Error(
      'Seleção de pasta disponível apenas na versão web (Chrome ou Edge no desktop).'
    );
  }

  const browserFiles = await pickFolderFilesViaInput();

  if (browserFiles === null) {
    return null;
  }

  const { files, summaryFiles } = collectFromBrowserFiles(browserFiles);

  return {
    files,
    summaryFiles,
    canRenameAfterUpload: false,
  };
}
