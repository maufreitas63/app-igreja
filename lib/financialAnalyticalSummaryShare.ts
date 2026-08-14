import { getAppParameterValue } from '@/lib/appParameters';
import type { FinancialEntry } from '@/lib/financialEntry';
import { formatFinancialMonthKey, type FinancialMonthKey } from '@/lib/financialMonth';
import { FINANCIAL_DOCS_BUCKET } from '@/lib/financialReceipt';
import { isApkShellWebClient } from '@/lib/pdfViewerUrl';
import { supabase } from '@/lib/supabase';
import { withActiveTenantStoragePrefix } from '@/lib/tenantStoragePath';

export const FINANCIAL_SUMMARY_REPORT_DOM_ID = 'financial-summary-report';

const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24 * 7;

export type FinancialSummaryExportResult = {
  imageUrl: string;
  sharedImage: boolean;
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

async function uploadSummaryJpeg(
  blob: Blob,
  endMonth: FinancialMonthKey
): Promise<{ storagePath: string; signedUrl: string }> {
  const monthKey = formatFinancialMonthKey(endMonth);
  const storagePath = await withActiveTenantStoragePrefix(
    `summaries/resumo-financeiro-${monthKey}-${Date.now()}.jpg`
  );

  const { error: uploadError } = await supabase.storage
    .from(FINANCIAL_DOCS_BUCKET)
    .upload(storagePath, blob, {
      contentType: 'image/jpeg',
      cacheControl: '3600',
      upsert: false,
    });

  if (uploadError) {
    throw new Error(`Não foi possível gravar a imagem no Supabase: ${uploadError.message}`);
  }

  const { data, error: signedError } = await supabase.storage
    .from(FINANCIAL_DOCS_BUCKET)
    .createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS);

  if (signedError || !data?.signedUrl) {
    throw new Error('A imagem foi gravada, mas não foi possível obter o endereço para baixá-la.');
  }

  return { storagePath, signedUrl: data.signedUrl };
}

async function downloadJpegFromSupabase(signedUrl: string): Promise<Blob> {
  const response = await fetch(signedUrl);
  if (!response.ok) {
    throw new Error('Não foi possível baixar a imagem gravada no Supabase.');
  }

  const buffer = await response.arrayBuffer();
  return new Blob([buffer], { type: 'image/jpeg' });
}

function postShareImageToApkShell(signedUrl: string): boolean {
  if (!isApkShellWebClient()) {
    return false;
  }

  const bridge = (window as Window & { ReactNativeWebView?: { postMessage: (msg: string) => void } })
    .ReactNativeWebView;
  if (!bridge?.postMessage) {
    return false;
  }

  bridge.postMessage(JSON.stringify({ type: 'share-image', url: signedUrl }));
  return true;
}

async function shareDownloadedJpeg(blob: Blob, fileName: string): Promise<boolean> {
  const file = new File([blob], fileName, { type: 'image/jpeg' });

  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    const payload = { files: [file] };
    const canShare =
      typeof navigator.canShare !== 'function' || navigator.canShare(payload);

    if (canShare) {
      try {
        await navigator.share(payload);
        return true;
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          return true;
        }
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

  const captured = await captureFinancialSummaryImage();
  const { signedUrl } = await uploadSummaryJpeg(captured, input.endMonth);
  const downloaded = await downloadJpegFromSupabase(signedUrl);
  const fileName = `resumo-financeiro-${formatFinancialMonthKey(input.endMonth)}.jpg`;
  const treasurerPhone = await getAppParameterValue('Tesoureiro_contato');

  const sharedViaShell = postShareImageToApkShell(signedUrl);
  const sharedViaWeb = sharedViaShell ? true : await shareDownloadedJpeg(downloaded, fileName);

  return {
    imageUrl: signedUrl,
    sharedImage: sharedViaWeb,
    missingTreasurerPhone: !treasurerPhone?.trim(),
  };
}
