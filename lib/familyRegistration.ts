import { formatCep, normalizeCepDigits } from '@/lib/geoMapGeocoding';
import { supabase } from '@/lib/supabase';

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

export type FamilyRegistrationDependent = {
  fullName: string;
  birthDate: string;
  phone: string;
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
  };
  dependents: FamilyRegistrationDependent[];
};

export type ProfileInsertRow = {
  full_name: string;
  birth_date: string;
  phone: string | null;
  family_id: string;
  codigo_membro: string;
  cep: string | null;
  address_number: string | null;
  address_complement: string | null;
  medical_food_alerts: string | null;
  is_active: boolean;
};

function buildAddressPatch(cep: string, addressNumber: string, addressComplement: string) {
  const cepDigits = normalizeCepDigits(cep);
  return {
    cep: cepDigits ? formatCep(cepDigits) : null,
    address_number: addressNumber.trim() || null,
    address_complement: addressComplement.trim() || null,
  };
}

export function buildFamilyProfileRows(
  values: FamilyRegistrationFormValues,
  familyId: string
): ProfileInsertRow[] {
  const address = buildAddressPatch(
    values.informant.cep,
    values.informant.addressNumber,
    values.informant.addressComplement
  );

  const informantBirthIso = parseBrazilianDateToIso(values.informant.birthDate);
  if (!informantBirthIso) {
    throw new Error('Data de nascimento do informante inválida.');
  }

  const informantPhone = normalizePhoneDigits(values.informant.phone);

  const rows: ProfileInsertRow[] = [
    {
      full_name: values.informant.fullName.trim(),
      birth_date: informantBirthIso,
      phone: informantPhone || null,
      family_id: familyId,
      codigo_membro: familyId,
      ...address,
      medical_food_alerts: null,
      is_active: false,
    },
  ];

  for (const dependent of values.dependents) {
    const name = dependent.fullName.trim();
    if (!name) {
      continue;
    }

    const birthIso = parseBrazilianDateToIso(dependent.birthDate);
    if (!birthIso) {
      throw new Error(`Data de nascimento inválida para o dependente "${name}".`);
    }

    const phone = normalizePhoneDigits(dependent.phone);

    rows.push({
      full_name: name,
      birth_date: birthIso,
      phone: phone || null,
      family_id: familyId,
      codigo_membro: familyId,
      ...address,
      medical_food_alerts: dependent.foodRestrictions.trim() || null,
      is_active: false,
    });
  }

  return rows;
}

export async function submitFamilyRegistration(
  values: FamilyRegistrationFormValues
): Promise<{ familyId: string; insertedCount: number }> {
  const familyId = crypto.randomUUID();
  const rows = buildFamilyProfileRows(values, familyId);

  const results = await Promise.all(
    rows.map(async (row) => {
      const { error } = await supabase.from('profiles').insert(row);
      if (error) {
        throw error;
      }
    })
  );

  void results;

  return {
    familyId,
    insertedCount: rows.length,
  };
}

export function buildFamilyRegistrationShareUrl(): string {
  if (typeof window !== 'undefined' && window.location?.href) {
    return window.location.href;
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
