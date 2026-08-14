import { getAppParameterValue } from '@/lib/appParameters';
import { buildFinancialAnalyticalSummaryPdfBlob } from '@/lib/financialAnalyticalSummaryPdf';
import type { FinancialEntry } from '@/lib/financialEntry';
import { formatFinancialMonthLabel, type FinancialMonthKey } from '@/lib/financialMonth';
import {
  FINANCIAL_DOCS_BUCKET,
} from '@/lib/financialReceipt';
import { openPdfUri } from '@/lib/openPdfUri';
import { supabase } from '@/lib/supabase';
import { withActiveTenantStoragePrefix } from '@/lib/tenantStoragePath';
import { openWhatsAppPhone } from '@/lib/whatsapp';

const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24 * 7;

export type FinancialSummaryExportResult = {
  openedPdf: boolean;
  notifiedTreasurer: boolean;
  missingTreasurerPhone: boolean;
  signedUrl: string | null;
};

async function blobToArrayBuffer(blob: Blob): Promise<ArrayBuffer> {
  if (typeof blob.arrayBuffer === 'function') {
    return blob.arrayBuffer();
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(blob);
  });
}

export async function exportFinancialSummaryPdfAndNotifyTreasurer(input: {
  endMonth: FinancialMonthKey;
  realizedEntries: FinancialEntry[];
}): Promise<FinancialSummaryExportResult> {
  const churchName = (await getAppParameterValue('Nome_Entidade'))?.trim() || '';
  const { blob, fileName } = await buildFinancialAnalyticalSummaryPdfBlob({
    ...input,
    churchName,
  });

  const monthLabel = formatFinancialMonthLabel(input.endMonth);
  const objectUrl = URL.createObjectURL(blob);
  await openPdfUri(objectUrl);

  let signedUrl: string | null = null;

  try {
    const storagePath = await withActiveTenantStoragePrefix(
      `summaries/${fileName.replace('.pdf', '')}-${Date.now()}.pdf`
    );
    const bytes = await blobToArrayBuffer(blob);
    const { error: uploadError } = await supabase.storage
      .from(FINANCIAL_DOCS_BUCKET)
      .upload(storagePath, bytes, {
        contentType: 'application/pdf',
        upsert: false,
      });

    if (!uploadError) {
      const signed = await supabase.storage
        .from(FINANCIAL_DOCS_BUCKET)
        .createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS);
      signedUrl = signed.data?.signedUrl ?? null;
    }
  } catch {
    signedUrl = null;
  }

  const treasurerPhone = await getAppParameterValue('Tesoureiro_contato');

  if (!treasurerPhone?.trim()) {
    return {
      openedPdf: true,
      notifiedTreasurer: false,
      missingTreasurerPhone: true,
      signedUrl,
    };
  }

  const lines = [
    `Resumo financeiro — ${monthLabel}`,
    churchName ? `Igreja: ${churchName}` : '',
    signedUrl ? `PDF: ${signedUrl}` : 'O PDF do resumo foi gerado nesta instância.',
  ].filter(Boolean);

  await openWhatsAppPhone(treasurerPhone, lines.join('\n'));

  return {
    openedPdf: true,
    notifiedTreasurer: true,
    missingTreasurerPhone: false,
    signedUrl,
  };
}
