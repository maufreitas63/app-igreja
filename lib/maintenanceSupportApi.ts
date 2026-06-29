import { resolveActorProfileId } from '@/lib/maintenanceAccessControlApi';
import { loadSessionProfile } from '@/lib/loadSessionProfile';
import { supabase } from '@/lib/supabase';
import { getStoredUserPhone } from '@/lib/userSession';
import { openWhatsAppPhone } from '@/lib/whatsapp';
import { decode } from 'base64-arraybuffer';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';

export const MAINTENANCE_SUPPORT_SQL_HINT =
  'Execute no Supabase: scripts/maintenance-support-suggestions.sql para habilitar Sugestões e Melhorias.';

export const MAINTENANCE_SUPPORT_THEMES_SQL_HINT =
  'Execute no Supabase: scripts/maintenance-support-themes.sql para habilitar os temas das solicitações.';

export const MAINTENANCE_SUPPORT_THIRD_PARTY_INSERT_SQL_HINT =
  'Execute no Supabase: scripts/maintenance-support-third-party-insert.sql para permitir sugestão em nome de terceiros.';

export const MAINTENANCE_SUPPORT_BUCKET = 'maintenance-support';
const ATTACHMENT_SIGNED_URL_TTL_SECONDS = 60 * 60;

export type MaintenanceSupportRecordType =
  | 'suggestion'
  | 'question'
  | 'comment'
  | 'incident';

export type MaintenanceSupportStatus =
  | 'received'
  | 'in_review'
  | 'in_development'
  | 'awaiting_validation'
  | 'completed'
  | 'not_applicable';

export type MaintenanceSupportActorRole = 'user' | 'developer' | 'system';
export type MaintenanceSupportChannel = 'app' | 'whatsapp' | 'status' | 'attachment';

export const MAINTENANCE_SUPPORT_RECORD_TYPE_LABELS: Record<
  MaintenanceSupportRecordType,
  string
> = {
  suggestion: 'Sugestão',
  question: 'Dúvida',
  comment: 'Comentário',
  incident: 'Problema/Incidente',
};

export const MAINTENANCE_SUPPORT_STATUS_LABELS: Record<MaintenanceSupportStatus, string> = {
  received: 'Recebida',
  in_review: 'Em análise',
  in_development: 'Em desenvolvimento',
  awaiting_validation: 'Aguardando validação',
  completed: 'Concluída',
  not_applicable: 'Não aplicável',
};

export const MAINTENANCE_SUPPORT_RECORD_TYPE_OPTIONS = Object.entries(
  MAINTENANCE_SUPPORT_RECORD_TYPE_LABELS
).map(([value, label]) => ({ value, label }));

export const MAINTENANCE_SUPPORT_STATUS_OPTIONS = Object.entries(
  MAINTENANCE_SUPPORT_STATUS_LABELS
).map(([value, label]) => ({ value, label }));

export type MaintenanceSupportAttachment = {
  id: string;
  request_id: string;
  storage_path: string;
  file_name: string | null;
  mime_type: string | null;
  sort_order: number;
  uploaded_by_profile_id: string | null;
  created_at: string;
  signedUrl: string | null;
};

export type MaintenanceSupportInteraction = {
  id: string;
  request_id: string;
  actor_profile_id: string | null;
  actor_name: string;
  actor_role: MaintenanceSupportActorRole;
  channel: MaintenanceSupportChannel;
  message: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

export type MaintenanceSupportCommunication = {
  id: string;
  request_id: string;
  recipient_profile_id: string | null;
  channel: 'in_app' | 'whatsapp';
  subject: string | null;
  message: string;
  delivery_status: string;
  authorized: boolean;
  sent_by_profile_id: string | null;
  sent_at: string;
};

export type MaintenanceSupportTheme = {
  id: string;
  titulo: string;
  sortOrder: number;
};

export type MaintenanceSupportRequest = {
  id: string;
  requester_profile_id: string | null;
  requester_name: string;
  requester_phone: string | null;
  record_type: MaintenanceSupportRecordType;
  tema_id: string | null;
  tema: string | null;
  description: string;
  status: MaintenanceSupportStatus;
  developer_action: string | null;
  developer_guidance: string | null;
  estimated_completion_date: string | null;
  responded_at: string | null;
  whatsapp_authorized: boolean;
  notify_in_app: boolean;
  created_at: string;
  updated_at: string;
  attachments: MaintenanceSupportAttachment[];
  interactions: MaintenanceSupportInteraction[];
  communications: MaintenanceSupportCommunication[];
};

export type MaintenanceSupportActor = {
  profileId: string | null;
  name: string;
  phone: string | null;
};

export type MaintenanceSupportLocalImage = {
  uri: string;
  fileName: string | null;
  mimeType: string | null;
};

type MaintenanceSupportRequestRow = Omit<
  MaintenanceSupportRequest,
  'attachments' | 'interactions' | 'communications'
>;

const REQUEST_COLUMNS =
  'id, requester_profile_id, requester_name, requester_phone, record_type, tema_id, description, status, developer_action, developer_guidance, estimated_completion_date, responded_at, whatsapp_authorized, notify_in_app, created_at, updated_at';

const ATTACHMENT_COLUMNS =
  'id, request_id, storage_path, file_name, mime_type, sort_order, uploaded_by_profile_id, created_at';

const INTERACTION_COLUMNS =
  'id, request_id, actor_profile_id, actor_name, actor_role, channel, message, metadata, created_at';

const COMMUNICATION_COLUMNS =
  'id, request_id, recipient_profile_id, channel, subject, message, delivery_status, authorized, sent_by_profile_id, sent_at';

const isMissingMaintenanceSupportSchemaError = (
  error: { code?: string; message?: string } | null | undefined
) => {
  if (!error) {
    return false;
  }

  const message = (error.message ?? '').toLowerCase();

  return (
    error.code === '42P01'
    || error.code === 'PGRST205'
    || message.includes('maintenance_support_requests')
    || message.includes('maintenance_support_attachments')
    || message.includes('maintenance_support_interactions')
    || message.includes('maintenance_support_communications')
  );
};

const isMissingMaintenanceSupportThemesError = (
  error: { code?: string; message?: string } | null | undefined
) => {
  if (!error) {
    return false;
  }

  const message = (error.message ?? '').toLowerCase();

  return (
    error.code === '42703'
    || message.includes('tema_id')
    || message.includes('maintenance_support_themes')
  );
};

const parseMaintenanceSupportRequestRow = (
  row: Record<string, unknown>,
  themeTitleById: Map<string, string>
): MaintenanceSupportRequestRow => {
  const temaId = row.tema_id ? String(row.tema_id) : null;

  return {
    ...(row as MaintenanceSupportRequestRow),
    tema_id: temaId,
    tema: temaId ? themeTitleById.get(temaId) ?? null : null,
  };
};

const isRlsPolicyViolation = (error: { code?: string; message?: string } | null | undefined) => {
  if (!error) {
    return false;
  }

  const message = (error.message ?? '').toLowerCase();

  return error.code === '42501' || message.includes('row-level security');
};

const throwSchemaHintIfMissing = (
  error: { code?: string; message?: string },
  options?: { thirdPartyRequest?: boolean }
) => {
  if (isMissingMaintenanceSupportSchemaError(error)) {
    throw new Error(MAINTENANCE_SUPPORT_SQL_HINT);
  }

  if (options?.thirdPartyRequest && isRlsPolicyViolation(error)) {
    throw new Error(MAINTENANCE_SUPPORT_THIRD_PARTY_INSERT_SQL_HINT);
  }

  throw error;
};

const sortByCreatedAtAsc = <T extends { created_at?: string; sent_at?: string }>(rows: T[]) =>
  [...rows].sort((left, right) => {
    const leftDate = left.created_at ?? left.sent_at ?? '';
    const rightDate = right.created_at ?? right.sent_at ?? '';
    return leftDate.localeCompare(rightDate);
  });

const appendSignedUrls = async (
  rows: Omit<MaintenanceSupportAttachment, 'signedUrl'>[]
): Promise<MaintenanceSupportAttachment[]> => {
  if (!rows.length) {
    return [];
  }

  return Promise.all(
    rows.map(async (row) => {
      const { data, error } = await supabase.storage
        .from(MAINTENANCE_SUPPORT_BUCKET)
        .createSignedUrl(row.storage_path, ATTACHMENT_SIGNED_URL_TTL_SECONDS);

      return {
        ...row,
        signedUrl: error ? null : data?.signedUrl ?? null,
      };
    })
  );
};

const getFileExtension = (fileName: string | null | undefined, contentType: string) => {
  const fromName = fileName?.split('.').pop()?.trim().toLowerCase();
  if (fromName && /^[a-z0-9]{2,5}$/.test(fromName)) {
    return fromName;
  }

  if (contentType.includes('png')) return 'png';
  if (contentType.includes('webp')) return 'webp';
  if (contentType.includes('gif')) return 'gif';
  if (contentType.includes('heic')) return 'heic';
  return 'jpg';
};

const parseImageInput = async (image: MaintenanceSupportLocalImage) => {
  let base64: string | null = null;
  let contentType =
    image.mimeType?.trim().toLowerCase().startsWith('image/')
      ? image.mimeType.trim().toLowerCase()
      : 'image/jpeg';

  if (image.uri.startsWith('data:')) {
    const mimeMatch = image.uri.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,/);
    const base64SeparatorIndex = image.uri.indexOf('base64,');

    if (mimeMatch?.[1]) {
      contentType = mimeMatch[1].toLowerCase();
    }

    if (base64SeparatorIndex >= 0) {
      base64 = image.uri.slice(base64SeparatorIndex + 'base64,'.length);
    }
  } else {
    base64 = await FileSystem.readAsStringAsync(image.uri, { encoding: 'base64' });
  }

  if (!base64) {
    throw new Error('Não foi possível processar a imagem selecionada.');
  }

  return {
    base64,
    contentType,
    fileExtension: getFileExtension(image.fileName, contentType),
  };
};

const pickImagesFromWeb = () => {
  if (typeof document === 'undefined' || typeof FileReader === 'undefined') {
    throw new Error('A seleção de imagem não está disponível neste navegador.');
  }

  return new Promise<MaintenanceSupportLocalImage[]>((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.multiple = true;

    input.onchange = () => {
      const files = Array.from(input.files ?? []);
      if (!files.length) {
        resolve([]);
        return;
      }

      Promise.all(
        files.map(
          (file) =>
            new Promise<MaintenanceSupportLocalImage>((fileResolve, fileReject) => {
              const reader = new FileReader();
              reader.onload = () => {
                if (typeof reader.result !== 'string') {
                  fileReject(new Error('Não foi possível processar a imagem selecionada.'));
                  return;
                }

                fileResolve({
                  uri: reader.result,
                  fileName: file.name || null,
                  mimeType: file.type || null,
                });
              };
              reader.onerror = () => fileReject(new Error('Não foi possível carregar a imagem.'));
              reader.readAsDataURL(file);
            })
        )
      )
        .then(resolve)
        .catch(reject);
    };

    input.click();
  });
};

export async function pickMaintenanceSupportImagesFromGallery() {
  if (Platform.OS === 'web') {
    return pickImagesFromWeb();
  }

  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

  if (!permission.granted) {
    throw new Error('Permita o acesso à galeria para anexar imagens à solicitação.');
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsMultipleSelection: true,
    selectionLimit: 0,
    quality: 0.85,
  });

  if (result.canceled || !result.assets?.length) {
    return [];
  }

  return result.assets
    .filter((asset) => asset.uri)
    .map((asset) => ({
      uri: asset.uri,
      fileName: asset.fileName ?? null,
      mimeType: asset.mimeType ?? null,
    }));
}

export async function resolveMaintenanceSupportActor(): Promise<MaintenanceSupportActor> {
  const phone = (await getStoredUserPhone())?.trim() || null;
  const profileId = await resolveActorProfileId();
  let name = 'Usuário';

  if (phone) {
    const profile = await loadSessionProfile(phone);
    const profileName = profile?.full_name?.trim();
    if (profileName) {
      name = profileName;
    }
  }

  return { profileId, name, phone };
}

export async function fetchMaintenanceSupportThemes(): Promise<MaintenanceSupportTheme[]> {
  const { data, error } = await supabase
    .from('maintenance_support_themes')
    .select('id, titulo, sort_order')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
    .order('titulo', { ascending: true });

  if (error) {
    if (isMissingMaintenanceSupportThemesError(error)) {
      throw new Error(MAINTENANCE_SUPPORT_THEMES_SQL_HINT);
    }

    throw error;
  }

  if (!Array.isArray(data)) {
    return [];
  }

  return data.map((row) => ({
    id: String(row.id ?? ''),
    titulo: String(row.titulo ?? '').trim(),
    sortOrder: Number(row.sort_order) || 0,
  }));
}

const buildThemeTitleMap = async () => {
  const themes = await fetchMaintenanceSupportThemes();
  return new Map(themes.map((theme) => [theme.id, theme.titulo]));
};

export async function fetchMaintenanceSupportRequests(limit = 80): Promise<{
  rows: MaintenanceSupportRequest[];
  schemaMissing: boolean;
}> {
  const { data, error } = await supabase
    .from('maintenance_support_requests')
    .select(REQUEST_COLUMNS)
    .order('updated_at', { ascending: false })
    .limit(limit);

  if (error) {
    if (isMissingMaintenanceSupportSchemaError(error)) {
      return { rows: [], schemaMissing: true };
    }

    if (isMissingMaintenanceSupportThemesError(error)) {
      throw new Error(MAINTENANCE_SUPPORT_THEMES_SQL_HINT);
    }

    throw error;
  }

  let themeTitleById = new Map<string, string>();

  try {
    themeTitleById = await buildThemeTitleMap();
  } catch (themeError) {
    if (
      themeError instanceof Error
      && themeError.message === MAINTENANCE_SUPPORT_THEMES_SQL_HINT
    ) {
      themeTitleById = new Map();
    } else {
      throw themeError;
    }
  }

  const requestRows = (data ?? []).map((row) =>
    parseMaintenanceSupportRequestRow(row as Record<string, unknown>, themeTitleById)
  );
  const requestIds = requestRows.map((row) => row.id);

  if (!requestIds.length) {
    return { rows: [], schemaMissing: false };
  }

  const [attachmentsResult, interactionsResult, communicationsResult] = await Promise.all([
    supabase
      .from('maintenance_support_attachments')
      .select(ATTACHMENT_COLUMNS)
      .in('request_id', requestIds)
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true }),
    supabase
      .from('maintenance_support_interactions')
      .select(INTERACTION_COLUMNS)
      .in('request_id', requestIds)
      .order('created_at', { ascending: true }),
    supabase
      .from('maintenance_support_communications')
      .select(COMMUNICATION_COLUMNS)
      .in('request_id', requestIds)
      .order('sent_at', { ascending: true }),
  ]);

  if (attachmentsResult.error) throwSchemaHintIfMissing(attachmentsResult.error);
  if (interactionsResult.error) throwSchemaHintIfMissing(interactionsResult.error);
  if (communicationsResult.error) throwSchemaHintIfMissing(communicationsResult.error);

  const attachments = await appendSignedUrls(
    (attachmentsResult.data ?? []) as Omit<MaintenanceSupportAttachment, 'signedUrl'>[]
  );
  const interactions = (interactionsResult.data ?? []) as MaintenanceSupportInteraction[];
  const communications = (communicationsResult.data ?? []) as MaintenanceSupportCommunication[];

  return {
    schemaMissing: false,
    rows: requestRows.map((row) => ({
      ...row,
      attachments: attachments.filter((attachment) => attachment.request_id === row.id),
      interactions: sortByCreatedAtAsc(
        interactions.filter((interaction) => interaction.request_id === row.id)
      ),
      communications: communications.filter((communication) => communication.request_id === row.id),
    })),
  };
}

async function insertInteraction(input: {
  requestId: string;
  actor: MaintenanceSupportActor;
  actorRole: MaintenanceSupportActorRole;
  channel: MaintenanceSupportChannel;
  message: string;
  metadata?: Record<string, unknown> | null;
}) {
  const { error } = await supabase.from('maintenance_support_interactions').insert({
    request_id: input.requestId,
    actor_profile_id: input.actor.profileId,
    actor_name: input.actor.name,
    actor_role: input.actorRole,
    channel: input.channel,
    message: input.message.trim(),
    metadata: input.metadata ?? null,
  });

  if (error) throwSchemaHintIfMissing(error);
}

export async function uploadMaintenanceSupportAttachments(
  requestId: string,
  images: MaintenanceSupportLocalImage[],
  actor: MaintenanceSupportActor
) {
  if (!images.length) {
    return [];
  }

  const uploadedRows: Array<Omit<MaintenanceSupportAttachment, 'signedUrl'>> = [];

  for (let index = 0; index < images.length; index += 1) {
    const image = images[index];
    const parsed = await parseImageInput(image);
    const safeName = image.fileName?.replace(/[^a-zA-Z0-9._-]/g, '_') || `imagem_${index + 1}`;
    const storagePath = `requests/${requestId}/${Date.now()}_${index + 1}.${parsed.fileExtension}`;

    const { error: uploadError } = await supabase.storage
      .from(MAINTENANCE_SUPPORT_BUCKET)
      .upload(storagePath, decode(parsed.base64), {
        contentType: parsed.contentType,
        upsert: false,
      });

    if (uploadError) {
      throw uploadError;
    }

    const { data, error } = await supabase
      .from('maintenance_support_attachments')
      .insert({
        request_id: requestId,
        storage_path: storagePath,
        file_name: safeName,
        mime_type: parsed.contentType,
        sort_order: index,
        uploaded_by_profile_id: actor.profileId,
      })
      .select(ATTACHMENT_COLUMNS)
      .single();

    if (error) throwSchemaHintIfMissing(error);
    uploadedRows.push(data as Omit<MaintenanceSupportAttachment, 'signedUrl'>);
  }

  await insertInteraction({
    requestId,
    actor,
    actorRole: 'user',
    channel: 'attachment',
    message: `${images.length} imagem(ns) anexada(s) à solicitação.`,
    metadata: { attachmentCount: images.length },
  });

  return appendSignedUrls(uploadedRows);
}

export type MaintenanceSupportRequester = {
  profileId: string;
  name: string;
  phone: string | null;
};

export async function createMaintenanceSupportRequest(input: {
  recordType: MaintenanceSupportRecordType;
  description: string;
  whatsappAuthorized: boolean;
  notifyInApp: boolean;
  images: MaintenanceSupportLocalImage[];
  requester?: MaintenanceSupportRequester;
  temaId?: string | null;
}) {
  const actor = await resolveMaintenanceSupportActor();
  const description = input.description.trim();

  if (!description) {
    throw new Error('Informe a descrição detalhada da solicitação.');
  }

  const requesterProfileId = input.requester?.profileId ?? actor.profileId;
  const requesterName = input.requester?.name?.trim() || actor.name;
  const requesterPhone = input.requester?.phone ?? actor.phone;
  const temaId = input.temaId?.trim() || null;

  const { data, error } = await supabase
    .from('maintenance_support_requests')
    .insert({
      requester_profile_id: requesterProfileId,
      requester_name: requesterName,
      requester_phone: requesterPhone,
      record_type: input.recordType,
      tema_id: temaId,
      description,
      whatsapp_authorized: input.whatsappAuthorized,
      notify_in_app: input.notifyInApp,
      status: 'received',
    })
    .select(REQUEST_COLUMNS)
    .single();

  if (error) throwSchemaHintIfMissing(error, { thirdPartyRequest: Boolean(input.requester) });

  const request = data as MaintenanceSupportRequestRow;

  await insertInteraction({
    requestId: request.id,
    actor,
    actorRole: input.requester ? 'developer' : 'user',
    channel: 'app',
    message: input.requester
      ? `Solicitação registrada pelo super administrador em nome de ${requesterName}.`
      : 'Solicitação aberta pelo usuário.',
  });

  const attachments = await uploadMaintenanceSupportAttachments(request.id, input.images, actor);

  let tema: string | null = null;

  if (temaId) {
    try {
      const themeTitleById = await buildThemeTitleMap();
      tema = themeTitleById.get(temaId) ?? null;
    } catch {
      tema = null;
    }
  }

  return {
    ...request,
    tema_id: temaId,
    tema,
    attachments,
    interactions: [],
    communications: [],
  } satisfies MaintenanceSupportRequest;
}

export async function addMaintenanceSupportUserUpdate(input: {
  requestId: string;
  description?: string;
  message: string;
  images: MaintenanceSupportLocalImage[];
}) {
  const actor = await resolveMaintenanceSupportActor();
  const updates: Record<string, unknown> = {};

  if (input.description?.trim()) {
    updates.description = input.description.trim();
  }

  if (Object.keys(updates).length) {
    const { error } = await supabase
      .from('maintenance_support_requests')
      .update(updates)
      .eq('id', input.requestId);

    if (error) throwSchemaHintIfMissing(error);
  }

  if (input.message.trim()) {
    await insertInteraction({
      requestId: input.requestId,
      actor,
      actorRole: 'user',
      channel: 'app',
      message: input.message.trim(),
    });
  }

  await uploadMaintenanceSupportAttachments(input.requestId, input.images, actor);
}

export async function updateMaintenanceSupportTreatment(input: {
  requestId: string;
  status: MaintenanceSupportStatus;
  developerAction: string;
  developerGuidance: string;
  estimatedCompletionDate: string | null;
  temaId?: string | null;
}) {
  const actor = await resolveMaintenanceSupportActor();
  const developerAction = input.developerAction.trim() || null;
  const developerGuidance = input.developerGuidance.trim() || null;
  const temaId = input.temaId?.trim() || null;

  const { data, error } = await supabase
    .from('maintenance_support_requests')
    .update({
      status: input.status,
      developer_action: developerAction,
      developer_guidance: developerGuidance,
      estimated_completion_date: input.estimatedCompletionDate,
      tema_id: temaId,
      responded_at: new Date().toISOString(),
    })
    .eq('id', input.requestId)
    .select('id');

  if (error) throwSchemaHintIfMissing(error);

  if (!data?.length) {
    throw new Error(
      'Não foi possível salvar o tratamento. Confirme que você é super_admin e que scripts/maintenance-support-suggestions.sql foi aplicado no Supabase.'
    );
  }

  await insertInteraction({
    requestId: input.requestId,
    actor,
    actorRole: 'developer',
    channel: 'status',
    message: `Tratamento atualizado para "${MAINTENANCE_SUPPORT_STATUS_LABELS[input.status]}".`,
    metadata: {
      status: input.status,
      estimatedCompletionDate: input.estimatedCompletionDate,
    },
  });
}

export async function recordMaintenanceSupportCommunication(input: {
  request: MaintenanceSupportRequest;
  channel: 'in_app' | 'whatsapp';
  subject?: string | null;
  message: string;
  deliveryStatus?: string;
}) {
  const actor = await resolveMaintenanceSupportActor();
  const message = input.message.trim();

  if (!message) {
    throw new Error('Informe a mensagem da comunicação.');
  }

  const { error } = await supabase.from('maintenance_support_communications').insert({
    request_id: input.request.id,
    recipient_profile_id: input.request.requester_profile_id,
    channel: input.channel,
    subject: input.subject?.trim() || null,
    message,
    delivery_status: input.deliveryStatus ?? 'registered',
    authorized: input.channel === 'whatsapp' ? input.request.whatsapp_authorized : true,
    sent_by_profile_id: actor.profileId,
  });

  if (error) throwSchemaHintIfMissing(error);
}

export async function sendMaintenanceSupportWhatsApp(input: {
  request: MaintenanceSupportRequest;
  message: string;
}) {
  if (!input.request.whatsapp_authorized) {
    throw new Error('O usuário não autorizou atualizações por WhatsApp.');
  }

  if (!input.request.requester_phone) {
    throw new Error('Telefone do usuário indisponível para WhatsApp.');
  }

  await openWhatsAppPhone(input.request.requester_phone, input.message);
  await recordMaintenanceSupportCommunication({
    request: input.request,
    channel: 'whatsapp',
    subject: 'Atualização de solicitação',
    message: input.message,
    deliveryStatus: 'opened',
  });
}
