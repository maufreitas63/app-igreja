import { loadProfileByPhone } from '@/lib/profileOnboarding';
import { supabase } from '@/lib/supabase';
import { isSupabaseRpcMissingError } from '@/lib/supabaseRpc';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const PASTORAL_BENEFICIARY_TYPES = ['self', 'family', 'third_party'] as const;

export type PastoralBeneficiaryType = (typeof PASTORAL_BENEFICIARY_TYPES)[number];

export const PASTORAL_BENEFICIARY_META: Record<
  PastoralBeneficiaryType,
  { label: string; shortLabel: string }
> = {
  self: { label: 'Para mim', shortLabel: 'Para mim' },
  family: { label: 'Para um familiar', shortLabel: 'Familiar' },
  third_party: { label: 'Para terceiros', shortLabel: 'Terceiros' },
};

export const PASTORAL_DESTINATIONS = ['Sigilo Pastoral', 'Ministério de Intercessão'] as const;

export type PastoralRequestDestination = (typeof PASTORAL_DESTINATIONS)[number];

export const PASTORAL_DESTINATION_META: Record<
  PastoralRequestDestination,
  { title: string; hint: string }
> = {
  'Sigilo Pastoral': {
    title: 'Sigilo Pastoral',
    hint: 'Confidencial. Apenas a equipe autorizada terá acesso.',
  },
  'Ministério de Intercessão': {
    title: 'Ministério de Intercessão',
    hint: 'Compartilhado com a equipe de oração da igreja.',
  },
};

export type PastoralSessionProfile = {
  userId: string;
  phone: string;
};

export const resolvePastoralAssignment = (destination: PastoralRequestDestination) => {
  if (destination === 'Sigilo Pastoral') {
    return {
      destination_label: 'Sigilo Pastoral',
      confidential: true,
    };
  }

  return {
    destination_label: 'Ministério de Intercessão',
    confidential: false,
  };
};

export type PastoralRequestPayload = {
  /** `profiles.id` — não confundir com `auth.users.id`. */
  profile_id: string;
  phone: string;
  motivo: string;
  situacao: string;
  description: string;
  category_id: string;
  subcategory_id: string;
  destination_label: string;
  confidential: boolean;
  request_for: PastoralBeneficiaryType;
  beneficiary_name: string | null;
  beneficiary_relationship: string | null;
  beneficiary_details: string | null;
  urgency_level: number;
  status: string;
};

export const validatePastoralBeneficiary = (input: {
  requestFor: PastoralBeneficiaryType | null;
  beneficiaryName: string;
  beneficiaryRelationship: string;
  beneficiaryDetails: string;
}): string | null => {
  if (!input.requestFor) {
    return 'Selecione para quem é este pedido.';
  }

  if (input.requestFor === 'self') {
    return null;
  }

  if (!input.beneficiaryName.trim()) {
    return 'Informe o nome de quem precisa do atendimento.';
  }

  if (input.requestFor === 'family' && !input.beneficiaryRelationship.trim()) {
    return 'Informe o grau de parentesco com o familiar.';
  }

  if (input.requestFor === 'third_party' && !input.beneficiaryDetails.trim()) {
    return 'Especifique quem é o necessitado (terceiros).';
  }

  return null;
};

export const findPastoralRequestMissingField = (input: {
  selectedMotivo: string;
  selectedSubmotivo: string;
  motivoLabel: string;
  situacaoLabel: string;
  selectedDestination: PastoralRequestDestination | null;
  requestFor: PastoralBeneficiaryType | null;
  beneficiaryName: string;
  beneficiaryRelationship: string;
  beneficiaryDetails: string;
  descricao: string;
}): string | null => {
  if (!input.selectedMotivo || !input.motivoLabel.trim()) {
    return 'Motivo';
  }

  if (!input.selectedSubmotivo || !input.situacaoLabel.trim()) {
    return 'Situação';
  }

  if (!input.requestFor) {
    return 'Este pedido é para';
  }

  if (input.requestFor !== 'self') {
    if (!input.beneficiaryName.trim()) {
      return 'Nome do necessitado';
    }

    if (input.requestFor === 'family' && !input.beneficiaryRelationship.trim()) {
      return 'Grau de parentesco';
    }

    if (input.requestFor === 'third_party' && !input.beneficiaryDetails.trim()) {
      return 'Especifique (terceiros)';
    }
  }

  if (!input.selectedDestination) {
    return 'Encaminhar para';
  }

  if (!input.descricao.trim()) {
    return 'Seu pedido';
  }

  return null;
};

export const buildPastoralValidationAlertMessage = (fieldLabel: string) =>
  `Para enviar o pedido, preencha o campo "${fieldLabel}".\n\nVocê também pode limpar o pedido (ícone de borracha no topo) ou cancelar tocando em Voltar.`;

export const buildPastoralRequestPayload = (input: {
  userId: string;
  phone: string;
  motivo: string;
  situacao: string;
  description: string;
  categoryId: string;
  subcategoryId: string;
  destination: PastoralRequestDestination;
  requestFor: PastoralBeneficiaryType;
  beneficiaryName: string;
  beneficiaryRelationship: string;
  beneficiaryDetails: string;
}): PastoralRequestPayload => {
  const { destination_label, confidential } = resolvePastoralAssignment(input.destination);
  const isSelf = input.requestFor === 'self';

  return {
    profile_id: input.userId,
    phone: input.phone.trim(),
    motivo: input.motivo.trim(),
    situacao: input.situacao.trim(),
    description: input.description.trim(),
    category_id: input.categoryId,
    subcategory_id: input.subcategoryId,
    destination_label,
    confidential,
    request_for: input.requestFor,
    beneficiary_name: isSelf ? null : input.beneficiaryName.trim(),
    beneficiary_relationship:
      input.requestFor === 'family' ? input.beneficiaryRelationship.trim() : null,
    beneficiary_details:
      input.requestFor === 'third_party' ? input.beneficiaryDetails.trim() : null,
    urgency_level: 1,
    status: 'new',
  };
};

export async function resolvePastoralSessionProfile(
  routeUserId?: string | null
): Promise<PastoralSessionProfile | null> {
  if (routeUserId) {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('id, phone')
      .eq('id', routeUserId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (profile?.id) {
      const storedPhone = await AsyncStorage.getItem('user_phone');

      return {
        userId: String(profile.id),
        phone: String(profile.phone ?? storedPhone ?? '').trim(),
      };
    }
  }

  const storedPhone = await AsyncStorage.getItem('user_phone');

  if (!storedPhone?.trim()) {
    return null;
  }

  const profile = await loadProfileByPhone(storedPhone);

  if (!profile?.id) {
    return null;
  }

  return {
    userId: String(profile.id),
    phone: String(profile.phone ?? storedPhone).trim(),
  };
}

export const getSupabaseErrorMessage = (error: unknown) => {
  if (error && typeof error === 'object') {
    const record = error as { code?: string; message?: string; details?: string; hint?: string };

    if (record.code === '23503' && (record.message ?? '').includes('user_id')) {
      return (
        'Seu cadastro não está vinculado ao módulo pastoral. ' +
        'No Supabase, execute o script atualizado scripts/pastoral-requests-fields.sql e tente novamente.'
      );
    }

    const parts = [record.message, record.details, record.hint].filter(Boolean);

    if (parts.length) {
      return parts.join('\n');
    }
  }

  return 'Não foi possível enviar o pedido agora.';
};

export async function submitPastoralRequest(payload: PastoralRequestPayload): Promise<string> {
  const { data: rpcId, error: rpcError } = await supabase.rpc('insert_pastoral_request', {
    p_user_id: payload.profile_id,
    p_phone: payload.phone,
    p_motivo: payload.motivo,
    p_situacao: payload.situacao,
    p_description: payload.description,
    p_category_id: payload.category_id,
    p_subcategory_id: payload.subcategory_id,
    p_destination_label: payload.destination_label,
    p_confidential: payload.confidential,
    p_request_for: payload.request_for,
    p_beneficiary_name: payload.beneficiary_name,
    p_beneficiary_relationship: payload.beneficiary_relationship,
    p_beneficiary_details: payload.beneficiary_details,
  });

  if (!rpcError && rpcId) {
    return String(rpcId);
  }

  if (rpcError && !isSupabaseRpcMissingError(rpcError, 'insert_pastoral_request')) {
    throw rpcError;
  }

  if (rpcError) {
    console.warn('insert_pastoral_request RPC:', rpcError);
  }

  const { data: rows, error: insertError } = await supabase
    .from('pastoral_requests')
    .insert([
      {
        profile_id: payload.profile_id,
        phone: payload.phone,
        motivo: payload.motivo,
        situacao: payload.situacao,
        description: payload.description,
        category_id: payload.category_id,
        subcategory_id: payload.subcategory_id,
        destination_label: payload.destination_label,
        confidential: payload.confidential,
        request_for: payload.request_for,
        beneficiary_name: payload.beneficiary_name,
        beneficiary_relationship: payload.beneficiary_relationship,
        beneficiary_details: payload.beneficiary_details,
        urgency_level: payload.urgency_level,
        status: payload.status,
      },
    ])
    .select('id');

  if (insertError) {
    throw insertError;
  }

  const insertedId = rows?.[0]?.id;

  if (!insertedId) {
    throw new Error(
      'O pedido não foi gravado. Execute no Supabase o script scripts/pastoral-requests-fields.sql e tente novamente.'
    );
  }

  return String(insertedId);
}

export type PastoralRequestHistoryItem = {
  id: string;
  created_at: string;
  motivo: string | null;
  situacao: string | null;
  description: string | null;
  destination_label: string | null;
  request_for: PastoralBeneficiaryType | null;
  beneficiary_name: string | null;
  beneficiary_relationship: string | null;
  beneficiary_details: string | null;
  status: string | null;
  updated_at?: string | null;
  confidential: boolean;
};

const isPastoralBeneficiaryType = (value: string | null | undefined): value is PastoralBeneficiaryType =>
  value === 'self' || value === 'family' || value === 'third_party';

export const formatPastoralRequestForLabel = (requestFor: PastoralBeneficiaryType | null) => {
  if (!requestFor) {
    return '—';
  }

  return PASTORAL_BENEFICIARY_META[requestFor].label;
};

export const formatPastoralBeneficiarySummary = (item: PastoralRequestHistoryItem) => {
  if (item.request_for === 'self' || !item.request_for) {
    return 'Para mim';
  }

  const name = item.beneficiary_name?.trim();

  if (item.request_for === 'family') {
    const relationship = item.beneficiary_relationship?.trim();
    if (name && relationship) {
      return `${name} (${relationship})`;
    }

    return name ?? 'Familiar';
  }

  const details = item.beneficiary_details?.trim();
  if (name && details) {
    return `${name} — ${details}`;
  }

  return name ?? details ?? 'Terceiros';
};

export const PASTORAL_FOLLOW_UP_STAGES = ['Acolher', 'Apoiar', 'Acompanhar'] as const;

export type PastoralFollowUpStage = (typeof PASTORAL_FOLLOW_UP_STAGES)[number];

export const isPastoralFollowUpStage = (value: string | null | undefined): value is PastoralFollowUpStage => {
  if (!value?.trim()) {
    return false;
  }

  return PASTORAL_FOLLOW_UP_STAGES.some(
    (stage) => stage.toLowerCase() === value.trim().toLowerCase()
  );
};

export const normalizePastoralFollowUpStage = (
  status: string | null | undefined
): PastoralFollowUpStage | null => {
  if (!status?.trim()) {
    return null;
  }

  const match = PASTORAL_FOLLOW_UP_STAGES.find(
    (stage) => stage.toLowerCase() === status.trim().toLowerCase()
  );

  return match ?? null;
};

/** Índice do estágio atual (-1 = ainda não iniciou acompanhamento, ex.: status `new`). */
export const getPastoralFollowUpStageIndex = (
  stage: PastoralFollowUpStage | null | undefined
): number => {
  if (!stage) {
    return -1;
  }

  return PASTORAL_FOLLOW_UP_STAGES.indexOf(stage);
};

/** Estágio já concluído no fluxo (inclui o estágio atual). */
export const isPastoralFollowUpStageDone = (
  currentStage: PastoralFollowUpStage | null | undefined,
  stage: PastoralFollowUpStage
): boolean => {
  const currentIndex = getPastoralFollowUpStageIndex(currentStage);
  const stageIndex = getPastoralFollowUpStageIndex(stage);

  return stageIndex >= 0 && currentIndex >= stageIndex;
};

/** Só permite avançar um estágio por vez (Acolher → Apoiar → Acompanhar). */
export const canAdvanceToPastoralFollowUpStage = (
  currentStage: PastoralFollowUpStage | null | undefined,
  targetStage: PastoralFollowUpStage
): boolean => {
  const currentIndex = getPastoralFollowUpStageIndex(currentStage);
  const targetIndex = getPastoralFollowUpStageIndex(targetStage);

  if (targetIndex < 0) {
    return false;
  }

  if (currentIndex === targetIndex) {
    return false;
  }

  return targetIndex === currentIndex + 1;
};

export const getPastoralFollowUpStageBlockedMessage = (
  currentStage: PastoralFollowUpStage | null | undefined,
  targetStage: PastoralFollowUpStage
): string | null => {
  if (canAdvanceToPastoralFollowUpStage(currentStage, targetStage)) {
    return null;
  }

  const currentIndex = getPastoralFollowUpStageIndex(currentStage);
  const targetIndex = getPastoralFollowUpStageIndex(targetStage);

  if (currentIndex === targetIndex) {
    return null;
  }

  if (targetIndex <= 0) {
    return null;
  }

  const requiredStage = PASTORAL_FOLLOW_UP_STAGES[targetIndex - 1];

  return `Marque "${requiredStage}" antes de "${targetStage}".`;
};

const PASTORAL_STATUS_LABELS: Record<string, string> = {
  new: 'Novo',
  pending: 'Pendente',
  open: 'Aberto',
  in_progress: 'Em andamento',
  closed: 'Encerrado',
  cancelled: 'Cancelado',
  Acolher: 'Acolher',
  Apoiar: 'Apoiar',
  Acompanhar: 'Acompanhar',
};

export const formatPastoralStatusLabel = (status: string | null | undefined) => {
  if (!status?.trim()) {
    return 'Novo';
  }

  const normalized = status.trim().toLowerCase();

  return PASTORAL_STATUS_LABELS[normalized] ?? status;
};

export const formatPastoralRequestDate = (isoDate: string) => {
  const date = new Date(isoDate);

  if (Number.isNaN(date.getTime())) {
    return '—';
  }

  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

/** Rótulo do chip de pedido: DD/MM/AAAA - HH:mm */
export const formatPastoralRequestDateTimeLabel = (isoDate: string) => {
  const date = new Date(isoDate);

  if (Number.isNaN(date.getTime())) {
    return '—';
  }

  const datePart = date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  const timePart = date.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return `${datePart} - ${timePart}`;
};

const HISTORY_RPC_SETUP_HINT =
  'Execute no Supabase o script scripts/pastoral-requests-history.sql (ou pastoral-requests-fields.sql completo) e abra o histórico novamente.';

export async function fetchMyPastoralRequests(profileId: string): Promise<PastoralRequestHistoryItem[]> {
  const { data, error } = await supabase.rpc('list_my_pastoral_requests', {
    p_profile_id: profileId,
  });

  if (error?.code === 'PGRST202') {
    throw new Error(`Histórico indisponível no servidor. ${HISTORY_RPC_SETUP_HINT}`);
  }

  if (error) {
    throw error;
  }

  if (Array.isArray(data)) {
    return data.map((row) => {
      const record = row as Record<string, unknown>;
      const requestForRaw = record.request_for;

      return {
        id: String(record.id),
        created_at: String(record.created_at),
        motivo: record.motivo != null ? String(record.motivo) : null,
        situacao: record.situacao != null ? String(record.situacao) : null,
        description: record.description != null ? String(record.description) : null,
        destination_label:
          record.destination_label != null ? String(record.destination_label) : null,
        request_for: isPastoralBeneficiaryType(
          typeof requestForRaw === 'string' ? requestForRaw : null
        )
          ? requestForRaw
          : null,
        beneficiary_name:
          record.beneficiary_name != null ? String(record.beneficiary_name) : null,
        beneficiary_relationship:
          record.beneficiary_relationship != null
            ? String(record.beneficiary_relationship)
            : null,
        beneficiary_details:
          record.beneficiary_details != null ? String(record.beneficiary_details) : null,
        status: record.status != null ? String(record.status) : null,
        confidential: Boolean(record.confidential),
      };
    });
  }

  return [];
}
