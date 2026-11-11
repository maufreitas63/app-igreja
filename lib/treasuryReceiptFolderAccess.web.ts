import {
  hasTreasuryReceiptImageExtension,
  parseTreasuryReceiptFileName,
  resolveTreasuryReceiptLinkPosition,
} from '@/lib/treasuryReceiptBatchPath';
import type {
  TreasuryReceiptFolderAccess,
  TreasuryReceiptFolderDiagnostics,
  TreasuryReceiptFolderFile,
} from '@/lib/treasuryReceiptFolderAccess';

type DirectoryPickerHandle = {
  values: () => AsyncIterable<{
    kind: string;
    name: string;
    getFile?: () => Promise<File>;
  }>;
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

const noopMarkProcessed = async () => {
  // Seleção via pasta do navegador não permite renomear no disco.
};

const basenameOf = (fileName: string) => {
  const parts = fileName.replace(/\\/g, '/').split('/').filter(Boolean);
  return (parts[parts.length - 1] ?? fileName).trim();
};

const getRelativePath = (file: File) => {
  const relative =
    typeof (file as File & { webkitRelativePath?: string }).webkitRelativePath === 'string' &&
    (file as File & { webkitRelativePath: string }).webkitRelativePath.trim()
      ? (file as File & { webkitRelativePath: string }).webkitRelativePath
      : file.name;

  return relative.replace(/\\/g, '/').replace(/^\/+/, '');
};

const collectFromBrowserFiles = (browserFiles: File[]) => {
  const files: TreasuryReceiptFolderFile[] = [];
  let skippedNotImage = 0;
  let skippedUpdated = 0;
  let fromSubfolders = 0;

  for (const file of browserFiles) {
    const relativePath = getRelativePath(file);
    const pathParts = relativePath.split('/').filter(Boolean);
    const fileName = basenameOf(relativePath || file.name);

    if (!hasTreasuryReceiptImageExtension(fileName)) {
      skippedNotImage += 1;
      continue;
    }

    if (fileName.toLowerCase().startsWith('updated_')) {
      skippedUpdated += 1;
      continue;
    }

    if (pathParts.length > 2) {
      fromSubfolders += 1;
    }

    const parsed = parseTreasuryReceiptFileName(fileName);
    const linkPosition = resolveTreasuryReceiptLinkPosition(parsed?.position);
    const canonicalFileName = parsed?.canonicalFileName ?? fileName;

    files.push({
      fileName,
      canonicalFileName,
      referencia: parsed?.referencia ?? '',
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

  const diagnostics: TreasuryReceiptFolderDiagnostics = {
    pickerFileCount: browserFiles.length,
    collectedCount: files.length,
    skippedNotImage,
    skippedUpdated,
    fromSubfolders,
  };

  return { files, diagnostics };
};

const walkDirectoryHandle = async (
  handle: DirectoryPickerHandle,
  prefix = ''
): Promise<File[]> => {
  const files: File[] = [];

  for await (const entry of handle.values()) {
    if (entry.kind === 'file' && typeof entry.getFile === 'function') {
      const file = await entry.getFile();
      const relative = `${prefix}${entry.name}`;

      try {
        Object.defineProperty(file, 'webkitRelativePath', {
          value: relative,
          configurable: true,
        });
      } catch {
        // Alguns File nativos não aceitam redefinir webkitRelativePath.
      }

      files.push(file);
      continue;
    }

    if (entry.kind === 'directory') {
      files.push(
        ...(await walkDirectoryHandle(
          entry as unknown as DirectoryPickerHandle,
          `${prefix}${entry.name}/`
        ))
      );
    }
  }

  return files;
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
    // Sem `accept`: no Windows o Chrome/Edge zera a lista da pasta quando o filtro de imagem está ligado.
    input.setAttribute('webkitdirectory', '');
    input.setAttribute('directory', '');
    input.webkitdirectory = true;
    input.style.position = 'fixed';
    input.style.left = '0';
    input.style.top = '0';
    input.style.width = '1px';
    input.style.height = '1px';
    input.style.opacity = '0';
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

export const isTreasuryReceiptFolderAccessSupported = () =>
  typeof window !== 'undefined' && typeof document !== 'undefined';

export async function pickTreasuryReceiptFolderFiles(): Promise<TreasuryReceiptFolderAccess | null> {
  if (!isTreasuryReceiptFolderAccessSupported()) {
    throw new Error(
      'Seleção de pasta disponível apenas na versão web (Chrome ou Edge no desktop).'
    );
  }

  let browserFiles: File[] | null = null;
  const showDirectoryPicker = (
    window as Window & { showDirectoryPicker?: () => Promise<DirectoryPickerHandle> }
  ).showDirectoryPicker;

  if (typeof showDirectoryPicker === 'function') {
    try {
      const handle = await showDirectoryPicker();
      browserFiles = await walkDirectoryHandle(handle);
    } catch (error) {
      if (
        error &&
        typeof error === 'object' &&
        'name' in error &&
        (error as { name: string }).name === 'AbortError'
      ) {
        return null;
      }

      browserFiles = await pickFolderFilesViaInput();
    }
  } else {
    browserFiles = await pickFolderFilesViaInput();
  }

  if (browserFiles === null) {
    return null;
  }

  const { files, diagnostics } = collectFromBrowserFiles(browserFiles);

  return {
    files,
    canRenameAfterUpload: false,
    diagnostics,
  };
}
