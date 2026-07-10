import { resolveActorProfileId } from '@/lib/maintenanceAccessControlApi';
import {
  normalizeAssemblyMinuteLabel,
  parseAssemblyMinutePdfInput,
  pickAssemblyMinutePdf,
  pickAssemblyMinutePdfs,
  titleFromAssemblyMinuteFileName,
  uploadAssemblyMinutePdfBytes,
  type AssemblyMinutePdfInput,
} from '@/lib/assemblyMinutesPdf';
import { supabase } from '@/lib/supabase';

export const ASSEMBLY_MINUTES_SQL_HINT =
  'Execute no Supabase: scripts/assembly-minutes.sql para habilitar atas de assembleias.';

export const ASSEMBLY_MINUTES_BUCKET = 'assembly-minutes';
const SIGNED_URL_TTL_SECONDS = 60 * 60;

export type AssemblyMinuteRecord = {
  id: string;
  title: string;
  storage_path: string;
  file_name: string;
  mime_type: string;
  uploaded_by_profile_id: string | null;
  created_at: string;
  signedUrl: string | null;
};

const isMissingAssemblyMinutesSchemaError = (
  error: { code?: string; message?: string } | null | undefined
) => {
  if (!error) {
    return false;
  }

  const message = (error.message ?? '').toLowerCase();

  return (
    error.code === '42P01'
    || error.code === 'PGRST205'
    || message.includes('maintenance_assembly_minutes')
    || (message.includes('assembly-minutes') && message.includes('bucket'))
  );
};

const buildStoragePath = (fileName: string, index = 0) => {
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  return `minutes/${Date.now()}_${index}_${Math.random().toString(36).slice(2, 8)}_${safeName}`;
};

const appendSignedUrl = async (row: Omit<AssemblyMinuteRecord, 'signedUrl'>) => {
  const { data, error } = await supabase.storage
    .from(ASSEMBLY_MINUTES_BUCKET)
    .createSignedUrl(row.storage_path, SIGNED_URL_TTL_SECONDS);

  if (error) {
    console.warn('assemblyMinutes signed url:', error.message);
    return { ...row, signedUrl: null };
  }

  return { ...row, signedUrl: data?.signedUrl ?? null };
};

/** Código documental no formato PREFIXO.001.2025 (aceita `.`, `_`, `-` ou espaço). */
const DOCUMENT_CODE_RE = /([A-Z]{2,12})[\s._-]*(\d+)[\s._-]*(\d{4})/i;

export type AssemblyMinuteDocumentCode = {
  prefix: string;
  sequence: number;
  year: number;
};

/** @deprecated Use AssemblyMinuteDocumentCode */
export type AssemblyMinuteIbnCode = AssemblyMinuteDocumentCode;

export function parseAssemblyMinuteDocumentCode(
  value: string | null | undefined
): AssemblyMinuteDocumentCode | null {
  if (!value?.trim()) {
    return null;
  }

  const match =
    normalizeAssemblyMinuteLabel(value).match(DOCUMENT_CODE_RE) ?? value.match(DOCUMENT_CODE_RE);

  if (!match) {
    return null;
  }

  const prefix = String(match[1] ?? '').toUpperCase();
  const sequence = Number(match[2]);
  const year = Number(match[3]);

  if (!prefix || !Number.isFinite(sequence) || !Number.isFinite(year)) {
    return null;
  }

  return { prefix, sequence, year };
}

/** @deprecated Use parseAssemblyMinuteDocumentCode */
export function parseAssemblyMinuteIbnCode(
  value: string | null | undefined
): AssemblyMinuteIbnCode | null {
  return parseAssemblyMinuteDocumentCode(value);
}

/** Prefixo de ordenação: 12 caracteres à esquerda do título. */
export const ASSEMBLY_MINUTE_TITLE_SORT_PREFIX_LENGTH = 12;

export function assemblyMinuteTitleSortKey(title: string | null | undefined): string {
  return normalizeAssemblyMinuteLabel(title ?? '').slice(0, ASSEMBLY_MINUTE_TITLE_SORT_PREFIX_LENGTH);
}

/** Ordem decrescente pelos 12 caracteres à esquerda do título. */
export function compareAssemblyMinutesByTitlePrefixDesc(
  a: Pick<AssemblyMinuteRecord, 'title' | 'created_at'>,
  b: Pick<AssemblyMinuteRecord, 'title' | 'created_at'>
) {
  const keyCompare = assemblyMinuteTitleSortKey(b.title).localeCompare(
    assemblyMinuteTitleSortKey(a.title),
    'pt-BR',
    { sensitivity: 'base', numeric: true }
  );

  if (keyCompare !== 0) {
    return keyCompare;
  }

  const titleCompare = normalizeAssemblyMinuteLabel(b.title).localeCompare(
    normalizeAssemblyMinuteLabel(a.title),
    'pt-BR',
    { sensitivity: 'base', numeric: true }
  );

  if (titleCompare !== 0) {
    return titleCompare;
  }

  return (b.created_at || '').localeCompare(a.created_at || '');
}

export function sortAssemblyMinutesByTitlePrefixDesc<
  T extends Pick<AssemblyMinuteRecord, 'title' | 'created_at'>,
>(rows: T[]): T[] {
  return [...rows].sort(compareAssemblyMinutesByTitlePrefixDesc);
}

/** @deprecated Prefer sortAssemblyMinutesByTitlePrefixDesc — mantém compatibilidade de imports. */
export function compareAssemblyMinutesByIbnDesc(
  a: Pick<AssemblyMinuteRecord, 'title' | 'file_name' | 'created_at'>,
  b: Pick<AssemblyMinuteRecord, 'title' | 'file_name' | 'created_at'>
) {
  return compareAssemblyMinutesByTitlePrefixDesc(a, b);
}

/** @deprecated Prefer sortAssemblyMinutesByTitlePrefixDesc — mantém compatibilidade de imports. */
export function sortAssemblyMinutesByIbnDesc<
  T extends Pick<AssemblyMinuteRecord, 'title' | 'file_name' | 'created_at'>,
>(rows: T[]): T[] {
  return sortAssemblyMinutesByTitlePrefixDesc(rows);
}

const prepareAssemblyMinuteRows = (rows: Omit<AssemblyMinuteRecord, 'signedUrl'>[]) =>
  sortAssemblyMinutesByTitlePrefixDesc(
    rows.map((row) => ({
      ...row,
      title: normalizeAssemblyMinuteLabel(row.title),
    }))
  );

export async function fetchAssemblyMinutes(): Promise<AssemblyMinuteRecord[]> {
  const { data, error } = await supabase
    .from('maintenance_assembly_minutes')
    .select('id, title, storage_path, file_name, mime_type, uploaded_by_profile_id, created_at')
    .order('created_at', { ascending: false });

  if (error) {
    if (isMissingAssemblyMinutesSchemaError(error)) {
      throw new Error(ASSEMBLY_MINUTES_SQL_HINT);
    }

    throw error;
  }

  const rows = prepareAssemblyMinuteRows((data ?? []) as Omit<AssemblyMinuteRecord, 'signedUrl'>[]);

  return Promise.all(rows.map((row) => appendSignedUrl(row)));
}

export async function uploadAssemblyMinute(input: {
  title?: string;
  pdf: AssemblyMinutePdfInput;
  storageIndex?: number;
}) {
  const title = normalizeAssemblyMinuteLabel(
    input.title?.trim() || titleFromAssemblyMinuteFileName(input.pdf.fileName)
  );

  if (!title) {
    throw new Error('Não foi possível definir o título da ata a partir do nome do arquivo.');
  }

  const actorProfileId = await resolveActorProfileId();
  const storagePath = buildStoragePath(input.pdf.fileName, input.storageIndex ?? 0);

  const { error: uploadError } = await supabase.storage
    .from(ASSEMBLY_MINUTES_BUCKET)
    .upload(storagePath, uploadAssemblyMinutePdfBytes(input.pdf.base64, input.pdf.contentType), {
      contentType: input.pdf.contentType || 'application/pdf',
      upsert: false,
    });

  if (uploadError) {
    if (isMissingAssemblyMinutesSchemaError(uploadError)) {
      throw new Error(ASSEMBLY_MINUTES_SQL_HINT);
    }

    throw uploadError;
  }

  const { data, error } = await supabase
    .from('maintenance_assembly_minutes')
    .insert({
      title,
      storage_path: storagePath,
      file_name: input.pdf.fileName,
      mime_type: input.pdf.contentType || 'application/pdf',
      uploaded_by_profile_id: actorProfileId,
    })
    .select('id, title, storage_path, file_name, mime_type, uploaded_by_profile_id, created_at')
    .single();

  if (error) {
    if (isMissingAssemblyMinutesSchemaError(error)) {
      throw new Error(ASSEMBLY_MINUTES_SQL_HINT);
    }

    throw error;
  }

  return appendSignedUrl(data as Omit<AssemblyMinuteRecord, 'signedUrl'>);
}

export async function pickAndUploadAssemblyMinute(title?: string) {
  const picked = await pickAssemblyMinutePdf();

  if (!picked) {
    return null;
  }

  return uploadAssemblyMinute({ title, pdf: picked });
}

export type AssemblyMinutesBatchUploadResult = {
  uploaded: AssemblyMinuteRecord[];
  failures: { fileName: string; error: string }[];
};

/** Seleciona vários PDFs e publica cada um com título = nome do arquivo (sem .pdf). */
export async function pickAndUploadAssemblyMinutes(): Promise<AssemblyMinutesBatchUploadResult | null> {
  const picked = await pickAssemblyMinutePdfs();

  if (!picked?.length) {
    return null;
  }

  const uploaded: AssemblyMinuteRecord[] = [];
  const failures: { fileName: string; error: string }[] = [];

  for (let index = 0; index < picked.length; index += 1) {
    const pdf = picked[index];

    try {
      const row = await uploadAssemblyMinute({
        pdf,
        storageIndex: index,
        title: titleFromAssemblyMinuteFileName(pdf.fileName),
      });
      uploaded.push(row);
    } catch (error) {
      failures.push({
        fileName: pdf.fileName,
        error: error instanceof Error ? error.message : 'Falha ao enviar o PDF.',
      });
    }
  }

  return { uploaded, failures };
}

export { normalizeAssemblyMinuteLabel, titleFromAssemblyMinuteFileName };

export async function createAssemblyMinuteSignedUrl(storagePath: string) {
  const { data, error } = await supabase.storage
    .from(ASSEMBLY_MINUTES_BUCKET)
    .createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS);

  if (error) {
    throw error;
  }

  return data?.signedUrl ?? null;
}

/** Renomeia o título exibido da ata (não altera o arquivo no Storage). */
export async function renameAssemblyMinute(id: string, title: string) {
  const nextTitle = normalizeAssemblyMinuteLabel(title);

  if (!nextTitle) {
    throw new Error('Informe o novo título da ata.');
  }

  const { data, error } = await supabase
    .from('maintenance_assembly_minutes')
    .update({ title: nextTitle })
    .eq('id', id)
    .select('id, title, storage_path, file_name, mime_type, uploaded_by_profile_id, created_at')
    .single();

  if (error) {
    if (isMissingAssemblyMinutesSchemaError(error)) {
      throw new Error(ASSEMBLY_MINUTES_SQL_HINT);
    }

    const message = (error.message ?? '').toLowerCase();

    if (message.includes('permission') || message.includes('policy') || error.code === '42501') {
      throw new Error(
        'Sem permissão para renomear. Execute scripts/assembly-minutes-rename-policy.sql no Supabase.'
      );
    }

    throw error;
  }

  return appendSignedUrl(data as Omit<AssemblyMinuteRecord, 'signedUrl'>);
}

export { pickAssemblyMinutePdf, parseAssemblyMinutePdfInput };
