import {
  fetchAssemblyMinutes,
  type AssemblyMinuteRecord,
} from '@/lib/assemblyMinutesApi';

export type OfficialDocumentKind = 'ata_assembleia' | 'estatuto' | 'regimento' | 'outro';

export type OfficialDocument = {
  id: string;
  title: string;
  documentKind: OfficialDocumentKind;
  assemblyDate: string | null;
  summary: string | null;
  fileUrl: string | null;
};

export const OFFICIAL_DOCUMENT_KIND_LABEL: Record<OfficialDocumentKind, string> = {
  ata_assembleia: 'Ata de assembleia',
  estatuto: 'Estatuto',
  regimento: 'Regimento interno',
  outro: 'Documento oficial',
};

export function formatOfficialDocumentDate(value: string | null | undefined): string {
  const match = (value ?? '').match(/^(\d{4})-(\d{2})-(\d{2})/);

  if (!match) {
    return '';
  }

  return `${match[3]}/${match[2]}/${match[1]}`;
}

function mapAssemblyMinute(row: AssemblyMinuteRecord): OfficialDocument {
  return {
    id: row.id,
    title: row.title,
    documentKind: 'ata_assembleia',
    assemblyDate: row.created_at.slice(0, 10) || null,
    summary: null,
    fileUrl: row.signedUrl,
  };
}

/** Mesmas atas publicadas em Financeiro → Atas de assembleias. */
export async function listOfficialDocuments(): Promise<OfficialDocument[]> {
  const rows = await fetchAssemblyMinutes();
  return rows.map(mapAssemblyMinute);
}
