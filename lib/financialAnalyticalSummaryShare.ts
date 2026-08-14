import { getAppParameterValue } from '@/lib/appParameters';
import type { FinancialEntry } from '@/lib/financialEntry';
import { type FinancialMonthKey } from '@/lib/financialMonth';
import { openWhatsAppPhone } from '@/lib/whatsapp';

export const FINANCIAL_SUMMARY_REPORT_DOM_ID = 'financial-summary-report';

export type FinancialSummaryExportResult = {
  sentImage: boolean;
  notifiedTreasurer: boolean;
  missingTreasurerPhone: boolean;
  copiedImage: boolean;
};

async function canvasToJpegBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Não foi possível gerar a imagem do resumo.'));
          return;
        }
        resolve(blob);
      },
      'image/jpeg',
      0.92
    );
  });
}

export async function captureFinancialSummaryImage(): Promise<Blob> {
  if (typeof document === 'undefined') {
    throw new Error('A imagem do resumo só pode ser gerada no navegador.');
  }

  const node = document.getElementById(FINANCIAL_SUMMARY_REPORT_DOM_ID);
  if (!node) {
    throw new Error('Abra o resumo financeiro antes de enviar.');
  }

  const html2canvas = (await import('html2canvas')).default;
  const canvas = await html2canvas(node, {
    scale: 2,
    backgroundColor: '#ffffff',
    useCORS: true,
    logging: false,
    onclone: (clonedDoc) => {
      const cloned = clonedDoc.getElementById(FINANCIAL_SUMMARY_REPORT_DOM_ID);
      let parent = cloned as HTMLElement | null;
      while (parent) {
        parent.style.maxHeight = 'none';
        parent.style.overflow = 'visible';
        parent.style.height = 'auto';
        parent = parent.parentElement;
      }
    },
  });

  return canvasToJpegBlob(canvas);
}

async function copyImageToClipboard(blob: Blob): Promise<boolean> {
  try {
    if (typeof navigator === 'undefined' || !navigator.clipboard || typeof ClipboardItem === 'undefined') {
      return false;
    }

    const pngBlob = await new Promise<Blob>((resolve, reject) => {
      const image = new Image();
      const url = URL.createObjectURL(blob);
      image.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = image.width;
        canvas.height = image.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          URL.revokeObjectURL(url);
          reject(new Error('Canvas indisponível.'));
          return;
        }
        ctx.drawImage(image, 0, 0);
        canvas.toBlob((converted) => {
          URL.revokeObjectURL(url);
          if (!converted) {
            reject(new Error('Falha ao copiar imagem.'));
            return;
          }
          resolve(converted);
        }, 'image/png');
      };
      image.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Falha ao ler a imagem.'));
      };
      image.src = url;
    });

    await navigator.clipboard.write([new ClipboardItem({ 'image/png': pngBlob })]);
    return true;
  } catch {
    return false;
  }
}

export async function exportFinancialSummaryPdfAndNotifyTreasurer(_input: {
  endMonth: FinancialMonthKey;
  realizedEntries: FinancialEntry[];
}): Promise<FinancialSummaryExportResult> {
  const imageBlob = await captureFinancialSummaryImage();
  const copiedImage = await copyImageToClipboard(imageBlob);
  const treasurerPhone = await getAppParameterValue('Tesoureiro_contato');

  if (!treasurerPhone?.trim()) {
    return {
      sentImage: copiedImage,
      notifiedTreasurer: false,
      missingTreasurerPhone: true,
      copiedImage,
    };
  }

  await openWhatsAppPhone(treasurerPhone);

  return {
    sentImage: copiedImage,
    notifiedTreasurer: true,
    missingTreasurerPhone: false,
    copiedImage,
  };
}
