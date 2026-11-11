import { fetchPdfToJpgHelper, isPdfToJpgHelperOnline } from '@/lib/pdfFolderToJpg';
import {
  buildUpdatedTreasuryReceiptFileName,
  parseTreasuryReceiptFileName,
  resolveTreasuryReceiptLinkPosition,
} from '@/lib/treasuryReceiptBatchPath';
import type { TreasuryReceiptFolderAccess } from '@/lib/treasuryReceiptFolderAccess';

type ListedReceipt = {
  fileName: string;
  relativePath: string;
};

const helperPost = async (pathname: string, body: Record<string, string>) => {
  const response = await fetchPdfToJpgHelper(pathname, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const payload = (await response.json()) as { ok?: boolean; message?: string } & Record<string, unknown>;

  if (!response.ok || payload.ok === false) {
    throw new Error(payload.message || `Falha no helper local (${pathname}).`);
  }

  return payload;
};

export const isWindowsDiskFolderPath = (value: string) =>
  /^[A-Za-z]:[\\/]/.test(value.trim()) || value.trim().startsWith('\\\\');

export async function loadTreasuryReceiptsFromDiskPath(
  folderPath: string
): Promise<TreasuryReceiptFolderAccess> {
  const online = await isPdfToJpgHelperOnline();

  if (!online) {
    throw new Error(
      `Não foi possível ler "${folderPath}". Ligue o helper neste PC (npm run pdf-to-jpg:helper) e tente de novo.`
    );
  }

  const listed = await helperPost('/list-receipts', { folderPath });
  const rawFiles = Array.isArray(listed.files) ? (listed.files as ListedReceipt[]) : [];
  const files = rawFiles.map((item) => {
    const fileName = String(item.fileName || '').trim();
    const relativePath = String(item.relativePath || fileName).trim();
    const parsed = parseTreasuryReceiptFileName(fileName);
    const canonicalFileName = parsed?.canonicalFileName ?? fileName;

    return {
      fileName,
      canonicalFileName,
      referencia: parsed?.referencia ?? '',
      position: resolveTreasuryReceiptLinkPosition(parsed?.position),
      originalFileName: fileName !== canonicalFileName ? fileName : undefined,
      readDataUrl: async () => {
        const payload = await helperPost('/receipt-file', { folderPath, relativePath });
        const dataUrl = String(payload.dataUrl || '');

        if (!dataUrl.startsWith('data:')) {
          throw new Error(`Não foi possível ler ${fileName} no disco.`);
        }

        return dataUrl;
      },
      markProcessed: async () => {
        const nextName = buildUpdatedTreasuryReceiptFileName(fileName);
        if (!nextName || nextName === fileName) {
          return;
        }

        await helperPost('/rename-receipt', {
          folderPath,
          relativePath,
          nextName,
        });
      },
    };
  });

  files.sort((left, right) => {
    const referenciaOrder = left.referencia.localeCompare(right.referencia, 'pt-BR');
    return referenciaOrder !== 0 ? referenciaOrder : left.position - right.position;
  });

  return {
    files,
    canRenameAfterUpload: true,
    diagnostics: {
      pickerFileCount: files.length,
      collectedCount: files.length,
      skippedNotImage: 0,
      skippedUpdated: 0,
      fromSubfolders: rawFiles.filter((item) => String(item.relativePath || '').includes('/')).length,
    },
  };
}
