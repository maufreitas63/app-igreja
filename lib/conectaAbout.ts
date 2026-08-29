import { getAppParameterValue } from '@/lib/appParameters';

export const CONECTA_VERSAO_PARAMETER = 'conecta_versao';
export const CONECTA_REVISAO_PARAMETER = 'conecta_revisao';

export type ConectaAboutInfo = {
  version: string;
  revision: string;
};

function formatRevisionDate(raw: string | null | undefined): string {
  const value = (raw ?? '').trim();
  if (!value) return '—';
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(value)) return value;

  const isoDay = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoDay) {
    return `${isoDay[3]}/${isoDay[2]}/${isoDay[1]}`;
  }

  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }

  return value;
}

export async function loadConectaAboutInfo(): Promise<ConectaAboutInfo> {
  const [versionRaw, revisionRaw] = await Promise.all([
    getAppParameterValue(CONECTA_VERSAO_PARAMETER),
    getAppParameterValue(CONECTA_REVISAO_PARAMETER),
  ]);

  return {
    version: versionRaw?.trim() || '—',
    revision: formatRevisionDate(revisionRaw),
  };
}
