import { getAppParameterValue } from '@/lib/appParameters';
import type { FinancialEntry } from '@/lib/financialEntry';
import { formatFinancialMonthKey, type FinancialMonthKey } from '@/lib/financialMonth';
import { FINANCIAL_DOCS_BUCKET } from '@/lib/financialReceipt';
import { isApkShellWebClient } from '@/lib/pdfViewerUrl';
import { supabase } from '@/lib/supabase';
import { withActiveTenantStoragePrefix } from '@/lib/tenantStoragePath';

export const FINANCIAL_SUMMARY_REPORT_DOM_ID = 'financial-summary-report';

const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24 * 7;
const PDF_MIME = 'application/pdf';

export type FinancialSummaryExportResult = {
  sharedFile: boolean;
  missingTreasurerPhone: boolean;
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

async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

export async function captureFinancialSummaryImage(): Promise<Blob> {
  if (typeof document === 'undefined' || typeof window === 'undefined') {
    throw new Error('A imagem do resumo só pode ser gerada no navegador.');
  }

  const node = document.getElementById(FINANCIAL_SUMMARY_REPORT_DOM_ID);
  if (!node) {
    throw new Error('Abra o resumo financeiro antes de enviar.');
  }

  const width = Math.max(1, Math.round(node.getBoundingClientRect().width || node.clientWidth));
  const height = Math.max(1, Math.round(node.scrollHeight || node.getBoundingClientRect().height));
  const scale = window.devicePixelRatio || 1;

  const html2canvas = (await import('html2canvas')).default;
  const canvas = await html2canvas(node, {
    scale,
    width,
    height,
    windowWidth: width,
    windowHeight: height,
    backgroundColor: '#ffffff',
    useCORS: true,
    logging: false,
    foreignObjectRendering: false,
    onclone: (clonedDoc) => {
      const cloned = clonedDoc.getElementById(FINANCIAL_SUMMARY_REPORT_DOM_ID);
      if (!cloned) {
        return;
      }

      cloned.style.width = `${width}px`;
      cloned.style.maxWidth = `${width}px`;
      cloned.style.height = 'auto';
      cloned.style.maxHeight = 'none';
      cloned.style.overflow = 'visible';

      let parent = cloned.parentElement;
      while (parent) {
        parent.style.maxHeight = 'none';
        parent.style.overflow = 'visible';
        parent = parent.parentElement;
      }
    },
  });

  return canvasToJpegBlob(canvas);
}

async function jpegToPdfBlob(jpegBlob: Blob): Promise<Blob> {
  const module = await import('jspdf/dist/jspdf.es.min.js');
  const jsPDF = module.jsPDF;
  const dataUrl = await blobToDataUrl(jpegBlob);
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true, orientation: 'portrait' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const props = doc.getImageProperties(dataUrl);
  const ratio = props.width / props.height;
  let drawWidth = pageWidth;
  let drawHeight = drawWidth / ratio;
  if (drawHeight > pageHeight) {
    drawHeight = pageHeight;
    drawWidth = drawHeight * ratio;
  }
  const x = (pageWidth - drawWidth) / 2;
  const y = (pageHeight - drawHeight) / 2;
  doc.addImage(dataUrl, 'JPEG', x, y, drawWidth, drawHeight);
  return doc.output('blob') as Blob;
}

async function uploadAndSignPdf(blob: Blob, fileName: string): Promise<string> {
  const storagePath = await withActiveTenantStoragePrefix(`summaries/${fileName}`);
  const { error: uploadError } = await supabase.storage.from(FINANCIAL_DOCS_BUCKET).upload(storagePath, blob, {
    contentType: PDF_MIME,
    cacheControl: '3600',
    upsert: false,
  });

  if (uploadError) {
    throw new Error(`Não foi possível gravar o PDF no Supabase: ${uploadError.message}`);
  }

  const { data, error: signedError } = await supabase.storage
    .from(FINANCIAL_DOCS_BUCKET)
    .createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS);

  if (signedError || !data?.signedUrl) {
    throw new Error('O PDF foi gravado, mas não foi possível baixá-lo do Supabase.');
  }

  return data.signedUrl;
}

async function downloadPdfFromSupabase(signedUrl: string): Promise<Blob> {
  const response = await fetch(signedUrl);
  if (!response.ok) {
    throw new Error('Não foi possível baixar o PDF gravado no Supabase.');
  }

  const buffer = await response.arrayBuffer();
  return new Blob([buffer], { type: PDF_MIME });
}

function postShareFileToApkShell(signedUrl: string, fileName: string): boolean {
  if (!isApkShellWebClient()) {
    return false;
  }

  const bridge = (window as Window & { ReactNativeWebView?: { postMessage: (msg: string) => void } })
    .ReactNativeWebView;
  if (!bridge?.postMessage) {
    return false;
  }

  bridge.postMessage(
    JSON.stringify({
      type: 'share-file',
      url: signedUrl,
      mimeType: PDF_MIME,
      fileName,
    })
  );
  return true;
}

async function sharePdfFileOnly(blob: Blob, fileName: string): Promise<boolean> {
  const file = new File([blob], fileName, { type: PDF_MIME });

  // Nunca passar `url` nem `text`: o WhatsApp transforma isso em mensagem de link.
  if (
    typeof navigator !== 'undefined' &&
    typeof navigator.share === 'function' &&
    typeof navigator.canShare === 'function' &&
    navigator.canShare({ files: [file] })
  ) {
    try {
      await navigator.share({ files: [file] });
      return true;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return true;
      }
    }
  }

  const href = URL.createObjectURL(file);
  const anchor = document.createElement('a');
  anchor.href = href;
  anchor.download = fileName;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(href), 2000);
  return false;
}

export async function exportFinancialSummaryPdfAndNotifyTreasurer(input: {
  endMonth: FinancialMonthKey;
  realizedEntries: FinancialEntry[];
}): Promise<FinancialSummaryExportResult> {
  void input.realizedEntries;

  const jpeg = await captureFinancialSummaryImage();
  const pdfBlob = await jpegToPdfBlob(jpeg);
  const fileName = `resumo-financeiro-${formatFinancialMonthKey(input.endMonth)}-${Date.now()}.pdf`;
  const signedUrl = await uploadAndSignPdf(pdfBlob, fileName);
  const downloadedPdf = await downloadPdfFromSupabase(signedUrl);
  const treasurerPhone = await getAppParameterValue('Tesoureiro_contato');

  const sharedViaShell = postShareFileToApkShell(signedUrl, fileName);
  const sharedViaWeb = sharedViaShell ? true : await sharePdfFileOnly(downloadedPdf, fileName);

  return {
    sharedFile: sharedViaWeb,
    missingTreasurerPhone: !treasurerPhone?.trim(),
  };
}
