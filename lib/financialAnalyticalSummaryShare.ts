import type { FinancialEntry } from '@/lib/financialEntry';
import { formatFinancialMonthKey, type FinancialMonthKey } from '@/lib/financialMonth';
import { FINANCIAL_DOCS_BUCKET } from '@/lib/financialReceipt';
import { isApkShellWebClient } from '@/lib/pdfViewerUrl';
import { supabase } from '@/lib/supabase';
import { withActiveTenantStoragePrefix } from '@/lib/tenantStoragePath';

export const FINANCIAL_SUMMARY_REPORT_DOM_ID = 'financial-summary-report';

const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24 * 7;
const PDF_MIME = 'application/pdf';

export type FinancialSummaryPdfPreview = {
  blob: Blob;
  fileName: string;
  previewUrl: string;
};

async function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Não foi possível gerar a imagem do resumo.'));
          return;
        }
        resolve(blob);
      },
      'image/png'
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

function copyComputedLook(fromRoot: HTMLElement, toRoot: HTMLElement) {
  const apply = (from: Element, to: Element) => {
    if (!(from instanceof HTMLElement) || !(to instanceof HTMLElement)) {
      return;
    }

    const cs = window.getComputedStyle(from);
    to.style.backgroundColor = cs.backgroundColor;
    to.style.color = cs.color;
    to.style.borderTopColor = cs.borderTopColor;
    to.style.borderRightColor = cs.borderRightColor;
    to.style.borderBottomColor = cs.borderBottomColor;
    to.style.borderLeftColor = cs.borderLeftColor;
    to.style.borderTopWidth = cs.borderTopWidth;
    to.style.borderRightWidth = cs.borderRightWidth;
    to.style.borderBottomWidth = cs.borderBottomWidth;
    to.style.borderLeftWidth = cs.borderLeftWidth;
    to.style.borderTopStyle = cs.borderTopStyle;
    to.style.fontWeight = cs.fontWeight;
    to.style.fontSize = cs.fontSize;
    to.style.fontFamily = cs.fontFamily;
    to.style.textAlign = cs.textAlign;
    to.style.letterSpacing = cs.letterSpacing;
    to.style.paddingTop = cs.paddingTop;
    to.style.paddingRight = cs.paddingRight;
    to.style.paddingBottom = cs.paddingBottom;
    to.style.paddingLeft = cs.paddingLeft;
    to.style.backgroundImage = cs.backgroundImage;
    to.style.opacity = cs.opacity;
    to.style.boxSizing = cs.boxSizing;

    const fromChildren = from.children;
    const toChildren = to.children;
    const count = Math.min(fromChildren.length, toChildren.length);
    for (let index = 0; index < count; index += 1) {
      apply(fromChildren[index]!, toChildren[index]!);
    }
  };

  apply(fromRoot, toRoot);
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
  const original = node;

  const html2canvas = (await import('html2canvas')).default;
  const options = {
    scale,
    width,
    height,
    windowWidth: width,
    windowHeight: height,
    backgroundColor: '#ffffff',
    useCORS: true,
    logging: false,
    scrollX: 0,
    scrollY: -window.scrollY,
    x: 0,
    y: 0,
    foreignObjectRendering: false,
    onclone: (clonedDoc: Document) => {
      const cloned = clonedDoc.getElementById(FINANCIAL_SUMMARY_REPORT_DOM_ID);
      if (!cloned) {
        return;
      }

      cloned.style.width = `${width}px`;
      cloned.style.maxWidth = `${width}px`;
      cloned.style.height = 'auto';
      cloned.style.maxHeight = 'none';
      cloned.style.overflow = 'visible';
      copyComputedLook(original, cloned);

      let parent = cloned.parentElement;
      while (parent) {
        parent.style.maxHeight = 'none';
        parent.style.overflow = 'visible';
        parent = parent.parentElement;
      }
    },
  };

  const canvas = await html2canvas(node, options);

  return canvasToPngBlob(canvas);
}

async function pngToPdfBlob(pngBlob: Blob): Promise<Blob> {
  const module = await import('jspdf/dist/jspdf.es.min.js');
  const jsPDF = module.jsPDF;
  const dataUrl = await blobToDataUrl(pngBlob);
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error('Falha ao ler a imagem do resumo.'));
    el.src = dataUrl;
  });

  const widthMm = 210;
  const heightMm = Math.max(80, (image.height / image.width) * widthMm);
  const doc = new jsPDF({
    unit: 'mm',
    format: [widthMm, heightMm],
    compress: true,
    orientation: heightMm >= widthMm ? 'portrait' : 'landscape',
  });
  doc.addImage(dataUrl, 'PNG', 0, 0, widthMm, heightMm);
  return doc.output('blob') as Blob;
}

async function uploadAndDownloadPdf(blob: Blob, fileName: string): Promise<Blob> {
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

  const response = await fetch(data.signedUrl);
  if (!response.ok) {
    throw new Error('Não foi possível baixar o PDF gravado no Supabase.');
  }

  const buffer = await response.arrayBuffer();
  return new Blob([buffer], { type: PDF_MIME });
}

function postShareFileToApkShell(blobUrlOrSigned: string, fileName: string): boolean {
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
      url: blobUrlOrSigned,
      mimeType: PDF_MIME,
      fileName,
    })
  );
  return true;
}

export async function shareFinancialSummaryPdfFile(blob: Blob, fileName: string): Promise<boolean> {
  const file = new File([blob], fileName, { type: PDF_MIME });

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
  if (postShareFileToApkShell(href, fileName)) {
    return true;
  }

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

export async function buildFinancialSummaryPdfPreview(input: {
  endMonth: FinancialMonthKey;
  realizedEntries: FinancialEntry[];
}): Promise<FinancialSummaryPdfPreview> {
  void input.realizedEntries;

  const png = await captureFinancialSummaryImage();
  const pdfBlob = await pngToPdfBlob(png);
  const fileName = `resumo-financeiro-${formatFinancialMonthKey(input.endMonth)}-${Date.now()}.pdf`;
  const storedBlob = await uploadAndDownloadPdf(pdfBlob, fileName);
  const previewUrl = URL.createObjectURL(storedBlob);

  return {
    blob: storedBlob,
    fileName,
    previewUrl,
  };
}
