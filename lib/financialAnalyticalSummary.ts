import { decode } from 'base64-arraybuffer';
import type { FinancialMonthKey } from '@/lib/financialMonth';
import { FINANCIAL_DOCS_BUCKET, FINANCIAL_RECEIPT_SIGNED_URL_TTL_SECONDS } from '@/lib/financialReceipt';
import { supabase } from '@/lib/supabase';
import {
  getStoredActiveIgrejaBranding,
  getStoredTenantId,
  persistTenantId,
} from '@/lib/tenantSession';

export const FINANCIAL_ANALYTICAL_SUMMARY_LABEL = 'Resumo Financeiro';

/** Ex.: 202607 Resumo Financeiro.jpg */
export const buildFinancialAnalyticalSummaryFileName = (periodCode: string) =>
  `${periodCode} ${FINANCIAL_ANALYTICAL_SUMMARY_LABEL}.jpg`;

export const formatFinancialAnalyticalSummaryPeriodCode = (month: FinancialMonthKey) =>
  `${month.year}${String(month.month).padStart(2, '0')}`;

const normalizeSummaryStem = (value: string) =>
  value
    .normalize('NFKC')
    .replace(/[\u00A0\u2000-\u200B\u202F\u205F\u3000]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/**
 * Interpreta nomes do relatório analítico mensal:
 * `202607 Resumo Financeiro.jpg` (aceita .jpeg → canônico .jpg; espaços especiais).
 */
export const parseFinancialAnalyticalSummaryFileName = (
  fileName: string
): { periodCode: string; canonicalFileName: string } | null => {
  if (typeof fileName !== 'string' || !fileName.trim()) {
    return null;
  }

  let name = normalizeSummaryStem(fileName);

  if (name.toLowerCase().startsWith('updated_')) {
    name = normalizeSummaryStem(name.slice('updated_'.length));
  }

  const match = name.match(/^(\d{6})\s+resumo\s+financeiro\.jpe?g$/i);

  if (!match) {
    return null;
  }

  const periodCode = match[1];

  return {
    periodCode,
    canonicalFileName: buildFinancialAnalyticalSummaryFileName(periodCode),
  };
};

async function resolveRequiredTenantIdForSummary(): Promise<string> {
  const stored = (await getStoredTenantId())?.trim() || null;
  if (stored) {
    return stored;
  }

  const branding = await getStoredActiveIgrejaBranding();
  const brandingId = branding?.id?.trim() || null;
  if (brandingId) {
    await persistTenantId(brandingId, { notify: false });
    return brandingId;
  }

  throw new Error(
    'Instância (igreja) não definida na sessão. Selecione a igreja e processe o Resumo Financeiro novamente.'
  );
}

/** Paths candidatos (novo + legado) para o arquivo do mês. */
export async function listFinancialAnalyticalSummaryStorageCandidates(periodCode: string) {
  const fileName = buildFinancialAnalyticalSummaryFileName(periodCode);
  const tenantId = await resolveRequiredTenantIdForSummary();

  return [
    // Preferido: {tenant}/financial-summaries/arquivo.jpg
    `${tenantId}/financial-summaries/${fileName}`,
    // Alternativo: financial-summaries/{tenant}/arquivo.jpg
    `financial-summaries/${tenantId}/${fileName}`,
    // Legado sem tenant (só leitura de tentativas antigas)
    `financial-summaries/${fileName}`,
  ];
}

export async function buildFinancialAnalyticalSummaryStoragePath(periodCode: string) {
  const candidates = await listFinancialAnalyticalSummaryStorageCandidates(periodCode);
  return candidates[0]!;
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
    throw new Error(
      `Falha ao enviar Resumo Financeiro para o Storage (${storagePath}): ${error.message}`
    );
  }

  return storagePath;
}

const tryCreateSignedUrl = async (storagePath: string) => {
  const { data, error } = await supabase.storage
    .from(FINANCIAL_DOCS_BUCKET)
    .createSignedUrl(storagePath, FINANCIAL_RECEIPT_SIGNED_URL_TTL_SECONDS * 30);

  if (error || !data?.signedUrl) {
    return null;
  }

  return data.signedUrl;
};

const tryFindSummaryInFolder = async (folderPath: string, fileName: string) => {
  const { data, error } = await supabase.storage.from(FINANCIAL_DOCS_BUCKET).list(folderPath, {
    limit: 100,
    search: fileName.slice(0, 6),
  });

  if (error || !data?.length) {
    return null;
  }

  const match = data.find((item) => {
    const name = item.name?.trim() || '';
    return name.toLowerCase() === fileName.toLowerCase()
      || parseFinancialAnalyticalSummaryFileName(name)?.canonicalFileName === fileName;
  });

  if (!match?.name) {
    return null;
  }

  const fullPath = `${folderPath.replace(/\/+$/, '')}/${match.name}`;
  return tryCreateSignedUrl(fullPath);
};

export async function createFinancialAnalyticalSummarySignedUrl(month: FinancialMonthKey) {
  const periodCode = formatFinancialAnalyticalSummaryPeriodCode(month);
  const fileName = buildFinancialAnalyticalSummaryFileName(periodCode);
  const candidates = await listFinancialAnalyticalSummaryStorageCandidates(periodCode);

  for (const storagePath of candidates) {
    const signed = await tryCreateSignedUrl(storagePath);
    if (signed) {
      return signed;
    }
  }

  try {
    const tenantId = await resolveRequiredTenantIdForSummary();
    const folderCandidates = [
      `${tenantId}/financial-summaries`,
      `financial-summaries/${tenantId}`,
      'financial-summaries',
    ];

    for (const folder of folderCandidates) {
      const signed = await tryFindSummaryInFolder(folder, fileName);
      if (signed) {
        return signed;
      }
    }
  } catch (error) {
    console.warn('Resumo Financeiro: não foi possível listar pastas no Storage:', error);
  }

  return null;
}
