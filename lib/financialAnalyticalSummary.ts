import { decode } from 'base64-arraybuffer';
import type { FinancialMonthKey } from '@/lib/financialMonth';
import { FINANCIAL_DOCS_BUCKET, FINANCIAL_RECEIPT_SIGNED_URL_TTL_SECONDS } from '@/lib/financialReceipt';
import { supabase } from '@/lib/supabase';
import { withActiveTenantStoragePrefix } from '@/lib/tenantStoragePath';

export const FINANCIAL_ANALYTICAL_SUMMARY_LABEL = 'Resumo Financeiro';

/** Ex.: 202607 Resumo Financeiro.jpg */
export const buildFinancialAnalyticalSummaryFileName = (periodCode: string) =>
  `${periodCode} ${FINANCIAL_ANALYTICAL_SUMMARY_LABEL}.jpg`;

export const formatFinancialAnalyticalSummaryPeriodCode = (month: FinancialMonthKey) =>
  `${month.year}${String(month.month).padStart(2, '0')}`;

/**
 * Interpreta nomes do relatório analítico mensal:
 * `202607 Resumo Financeiro.jpg` (aceita .jpeg → canônico .jpg).
 */
export const parseFinancialAnalyticalSummaryFileName = (
  fileName: string
): { periodCode: string; canonicalFileName: string } | null => {
  if (typeof fileName !== 'string' || !fileName.trim()) {
    return null;
  }

  let name = fileName.trim();

  if (name.toLowerCase().startsWith('updated_')) {
    name = name.slice('updated_'.length);
  }

  const match = name.match(/^(\d{6})\s+Resumo\s+Financeiro\.jpe?g$/i);

  if (!match) {
    return null;
  }

  const periodCode = match[1];

  return {
    periodCode,
    canonicalFileName: buildFinancialAnalyticalSummaryFileName(periodCode),
  };
};

export const buildFinancialAnalyticalSummaryStorageRelativePath = (periodCode: string) =>
  `financial-summaries/${buildFinancialAnalyticalSummaryFileName(periodCode)}`;

export async function buildFinancialAnalyticalSummaryStoragePath(periodCode: string) {
  return withActiveTenantStoragePrefix(buildFinancialAnalyticalSummaryStorageRelativePath(periodCode));
}

export async function uploadFinancialAnalyticalSummaryImage(periodCode: string, imageInput: string) {
  let base64: string | null = null;
  let contentType = 'image/jpeg';

  if (imageInput.startsWith('data:')) {
    const base64SeparatorIndex = imageInput.indexOf('base64,');
    const mimeMatch = imageInput.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,/);

    if (mimeMatch?.[1]) {
      contentType = mimeMatch[1];
    }

    if (base64SeparatorIndex >= 0) {
      base64 = imageInput.slice(base64SeparatorIndex + 'base64,'.length);
    }
  }

  if (!base64) {
    throw new Error('Não foi possível processar a imagem do Resumo Financeiro.');
  }

  const storagePath = await buildFinancialAnalyticalSummaryStoragePath(periodCode);

  const { error } = await supabase.storage.from(FINANCIAL_DOCS_BUCKET).upload(storagePath, decode(base64), {
    contentType,
    upsert: true,
  });

  if (error) {
    throw error;
  }

  return storagePath;
}

export async function createFinancialAnalyticalSummarySignedUrl(month: FinancialMonthKey) {
  const periodCode = formatFinancialAnalyticalSummaryPeriodCode(month);
  const storagePath = await buildFinancialAnalyticalSummaryStoragePath(periodCode);

  const { data, error } = await supabase.storage
    .from(FINANCIAL_DOCS_BUCKET)
    .createSignedUrl(storagePath, FINANCIAL_RECEIPT_SIGNED_URL_TTL_SECONDS * 30);

  if (error || !data?.signedUrl) {
    return null;
  }

  return data.signedUrl;
}
