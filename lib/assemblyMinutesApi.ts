import { resolveActorProfileId } from '@/lib/maintenanceAccessControlApi';
import {
  parseAssemblyMinutePdfInput,
  pickAssemblyMinutePdf,
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

const buildStoragePath = (fileName: string) => {
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  return `minutes/${Date.now()}_${safeName}`;
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

  const rows = (data ?? []) as Omit<AssemblyMinuteRecord, 'signedUrl'>[];

  return Promise.all(rows.map((row) => appendSignedUrl(row)));
}

export async function uploadAssemblyMinute(input: {
  title: string;
  pdf: AssemblyMinutePdfInput;
}) {
  const title = input.title.trim();

  if (!title) {
    throw new Error('Informe o título da ata.');
  }

  const actorProfileId = await resolveActorProfileId();
  const storagePath = buildStoragePath(input.pdf.fileName);

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

export async function pickAndUploadAssemblyMinute(title: string) {
  const picked = await pickAssemblyMinutePdf();

  if (!picked) {
    return null;
  }

  return uploadAssemblyMinute({ title, pdf: picked });
}

export async function createAssemblyMinuteSignedUrl(storagePath: string) {
  const { data, error } = await supabase.storage
    .from(ASSEMBLY_MINUTES_BUCKET)
    .createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS);

  if (error) {
    throw error;
  }

  return data?.signedUrl ?? null;
}

export { pickAssemblyMinutePdf, parseAssemblyMinutePdfInput };
