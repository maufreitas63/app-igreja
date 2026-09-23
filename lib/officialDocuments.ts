import { supabase } from '@/lib/supabase';
import { getStoredTenantId } from '@/lib/tenantSession';

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

function asKind(value: string | null | undefined): OfficialDocumentKind {
  if (value === 'ata_assembleia' || value === 'estatuto' || value === 'regimento' || value === 'outro') {
    return value;
  }

  return 'outro';
}

export function formatOfficialDocumentDate(value: string | null | undefined): string {
  const match = (value ?? '').match(/^(\d{4})-(\d{2})-(\d{2})/);

  if (!match) {
    return '';
  }

  return `${match[3]}/${match[2]}/${match[1]}`;
}

export async function listOfficialDocuments(): Promise<OfficialDocument[]> {
  const tenantId = (await getStoredTenantId())?.trim() || '';

  let query = supabase
    .from('church_official_documents')
    .select('id, title, document_kind, assembly_date, summary, file_url')
    .eq('is_published', true)
    .order('assembly_date', { ascending: false, nullsFirst: false })
    .order('title', { ascending: true });

  if (tenantId) {
    query = query.eq('tenant_id', tenantId);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message || 'Não foi possível carregar os documentos oficiais.');
  }

  return (data ?? []).map((row) => ({
    id: String(row.id),
    title: String(row.title ?? '').trim(),
    documentKind: asKind(row.document_kind),
    assemblyDate: row.assembly_date ?? null,
    summary: row.summary?.trim() || null,
    fileUrl: row.file_url?.trim() || null,
  }));
}
