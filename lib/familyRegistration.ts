import { formatCep, normalizeCepDigits } from '@/lib/cepUtils';
import {
  FAMILY_DEPENDENT_RELATIONSHIP_OPTIONS,
  FAMILY_INFORMANT_RELATIONSHIP,
  type FamilyDependentRelationship,
} from '@/lib/familyRelationshipOptions';
import { supabaseBrowser } from '@/lib/supabaseBrowser';
import { isSupabaseRpcMissingError } from '@/lib/supabaseRpc';

export {
  FAMILY_DEPENDENT_RELATIONSHIP_OPTIONS,
  FAMILY_INFORMANT_RELATIONSHIP,
  type FamilyDependentRelationship,
};

const BRAZILIAN_DATE_REGEX = /^(\d{2})\/(\d{2})\/(\d{4})$/;

/** Converte dd/mm/aaaa para yyyy-mm-dd (padrão date do Postgres/Supabase). */
export function parseBrazilianDateToIso(value: string): string | null {
  const match = BRAZILIAN_DATE_REGEX.exec(value.trim());
  if (!match) {
    return null;
  }

  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const date = new Date(year, month - 1, day);

  if (
    date.getFullYear() !== year
    || date.getMonth() !== month - 1
    || date.getDate() !== day
  ) {
    return null;
  }

  const pad = (n: number) => String(n).padStart(2, '0');
  return `${year}-${pad(month)}-${pad(day)}`;
}

export function normalizePhoneDigits(value: string): string {
  return value.replace(/\D/g, '').slice(0, 11);
}

export function formatPhoneDisplay(value: string): string {
  const cleaned = normalizePhoneDigits(value);
  if (cleaned.length <= 2) return cleaned;
  if (cleaned.length <= 6) return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2)}`;
  if (cleaned.length <= 10) {
    return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 6)}-${cleaned.slice(6)}`;
  }
  return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7, 11)}`;
}

/** Formato canônico gravado em `profiles.phone` e `members.phone` — ex.: `(11) 99999-8888`. */
export function formatPhoneForStorage(value: string): string | null {
  const digits = normalizePhoneDigits(value);
  if (digits.length < 10) {
    return null;
  }

  return formatPhoneDisplay(digits);
}

export type FamilyRegistrationDependent = {
  fullName: string;
  birthDate: string;
  phone: string;
  relationship: FamilyDependentRelationship;
  foodRestrictions: string;
};

export type FamilyRegistrationFormValues = {
  informant: {
    fullName: string;
    birthDate: string;
    phone: string;
    cep: string;
    addressNumber: string;
    addressComplement: string;
    foodRestrictions: string;
  };
  dependents: FamilyRegistrationDependent[];
};

type FamilyRegistrationRpcPayload = {
  informant: {
    full_name: string;
    birth_date: string;
    phone: string | null;
    cep: string | null;
    address_number: string | null;
    address_complement: string | null;
    medical_food_alerts: string | null;
  };
  dependents: Array<{
    full_name: string;
    birth_date: string;
    phone: string | null;
    relationship: string;
    medical_food_alerts: string | null;
  }>;
};

function buildAddressPatch(cep: string, addressNumber: string, addressComplement: string) {
  const cepDigits = normalizeCepDigits(cep);
  return {
    cep: cepDigits ? formatCep(cepDigits) : null,
    address_number: addressNumber.trim() || null,
    address_complement: addressComplement.trim() || null,
  };
}

function buildFamilyRegistrationRpcPayload(
  values: FamilyRegistrationFormValues
): FamilyRegistrationRpcPayload {
  const address = buildAddressPatch(
    values.informant.cep,
    values.informant.addressNumber,
    values.informant.addressComplement
  );

  const informantBirthIso = parseBrazilianDateToIso(values.informant.birthDate);
  if (!informantBirthIso) {
    throw new Error('Data de nascimento do informante inválida.');
  }

  const informantPhone = formatPhoneForStorage(values.informant.phone);

  const dependents: FamilyRegistrationRpcPayload['dependents'] = [];

  for (const dependent of values.dependents) {
    const name = dependent.fullName.trim();
    if (!name) {
      continue;
    }

    const birthIso = parseBrazilianDateToIso(dependent.birthDate);
    if (!birthIso) {
      throw new Error(`Data de nascimento inválida para o dependente "${name}".`);
    }

    const phone = dependent.phone ? formatPhoneForStorage(dependent.phone) : null;

    dependents.push({
      full_name: name,
      birth_date: birthIso,
      phone,
      relationship: dependent.relationship,
      medical_food_alerts: dependent.foodRestrictions.trim() || null,
    });
  }

  return {
    informant: {
      full_name: values.informant.fullName.trim(),
      birth_date: informantBirthIso,
      phone: informantPhone,
      ...address,
      medical_food_alerts: values.informant.foodRestrictions.trim() || null,
    },
    dependents,
  };
}

const FAMILY_REGISTRATION_RPC_MISSING_MESSAGE =
  'Cadastro familiar indisponível no servidor. Execute scripts/recepcao-cadastro-familiar.sql no Supabase.';

export type FamilyRegistrationSubmitResult = {
  submissionId: string;
  memberCount: number;
  detectedFamilyId: string | null;
  hasFamilyConflict: boolean;
  message: string;
};

export async function submitFamilyRegistration(
  values: FamilyRegistrationFormValues
): Promise<FamilyRegistrationSubmitResult> {
  const payload = buildFamilyRegistrationRpcPayload(values);

  const { data, error } = await supabaseBrowser.rpc('submit_family_registration_public', {
    p_payload: payload,
  });

  if (error) {
    if (isSupabaseRpcMissingError(error, 'submit_family_registration_public')) {
      throw new Error(FAMILY_REGISTRATION_RPC_MISSING_MESSAGE);
    }

    throw error;
  }

  const record = (data ?? {}) as Record<string, unknown>;

  if (record.success !== true) {
    throw new Error(String(record.message ?? 'Não foi possível gravar o cadastro familiar.'));
  }

  const submissionId = String(record.submission_id ?? '').trim();
  const memberCount = Number(record.member_count ?? 0);

  if (!submissionId) {
    throw new Error('O servidor não retornou o protocolo do cadastro.');
  }

  return {
    submissionId,
    memberCount: Number.isFinite(memberCount) ? memberCount : 0,
    detectedFamilyId: record.detected_family_id
      ? String(record.detected_family_id).trim()
      : null,
    hasFamilyConflict: record.has_family_conflict === true,
    message: String(
      record.message
        ?? 'Cadastro recebido e aguardando análise da equipe antes de gravar nas tabelas finais.'
    ),
  };
}

export const FAMILY_REGISTRATION_PUBLIC_PATH = '/cadastro-familia/';

export function buildFamilyRegistrationShareUrl(): string {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}${FAMILY_REGISTRATION_PUBLIC_PATH}`;
  }
  return '';
}

export function buildFamilyRegistrationWhatsAppUrl(pageUrl: string): string {
  const message = [
    'Olá! Convido você e sua família a preencherem o cadastro da nossa igreja.',
    'É rápido e ajuda a organizar nossa comunidade.',
    '',
    `Acesse o formulário: ${pageUrl}`,
  ].join('\n');

  return `https://wa.me/?text=${encodeURIComponent(message)}`;
}
