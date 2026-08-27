import { resolveKidsTeensStatusFromBirthDate } from '@/lib/kidsTeensStatus';
import { getAppParameterValue } from '@/lib/appParameters';
import { MEMBER_ACCEPTED_VALUE } from '@/lib/membersAccepted';
import { formatFullName, normalizeFullNameKey } from '@/lib/fullName';
import { formatBrazilDateInput, formatBrazilPhoneInput } from '@/lib/inputMasks';
import { buildPhoneDbQueryVariants } from '@/lib/phoneDbVariants';
import { dedupeFamilyMembers } from '@/lib/familyAudienceMembers';
import { FAMILY_RELATIONSHIP_OPTIONS } from '@/lib/familyRelationshipOptions';
import { ensureProfilesForMembers } from '@/lib/memberProfiles';
import { applyProfileBirthDates } from '@/lib/profileBirthDates';
import { supabase } from '@/lib/supabase';
import { getEffectiveUserPhone, loadEffectiveSessionProfile } from '@/lib/loadSessionProfile';
import {
  normalizeFamilyCode,
  resolveExistingFamilyIdForPhone,
} from '@/lib/family';
import { resolveProfileIdByPhone } from '@/lib/resolveProfileByPhone';
import { upsertFamilyMember } from '@/lib/upsertFamilyMember';
import Toast from 'react-native-toast-message';

export const OPCOES_PARENTESCO = [...FAMILY_RELATIONSHIP_OPTIONS];

export const formatPhone = formatBrazilPhoneInput;
export const formatDate = formatBrazilDateInput;

export const normalizeMemberName = normalizeFullNameKey;

export const normalizeMemberPhoneDigits = (value: string | null | undefined) =>
  (value ?? '').replace(/\D/g, '');

export const SELF_MEMBER_BLOCK_MESSAGE =
  'Você já faz parte desta família como titular da conta. Não é possível cadastrá-lo novamente como outro integrante.';

const FAMILY_INCONSISTENCY_TOAST_MS = 4500;

export const ALREADY_IN_FAMILY_TOAST_MESSAGE =
  'Este integrante já faz parte desta família. A ação não pode ser efetuada.';

export const showFamilyInconsistencyToast = (text2: string, text1 = 'Ação não permitida') => {
  Toast.show({
    type: 'error',
    text1,
    text2,
    visibilityTime: FAMILY_INCONSISTENCY_TOAST_MS,
  });
};

export const showFamilyWarningToast = (text2: string, text1 = 'Atenção') => {
  Toast.show({
    type: 'info',
    text1,
    text2,
    visibilityTime: FAMILY_INCONSISTENCY_TOAST_MS,
  });
};

export const phoneDigitsMatch = (left: string | null | undefined, right: string | null | undefined) => {
  const leftDigits = normalizeMemberPhoneDigits(left);
  const rightDigits = normalizeMemberPhoneDigits(right);

  if (!leftDigits || !rightDigits) {
    return false;
  }

  if (leftDigits === rightDigits) {
    return true;
  }

  const withoutCountryCode = (digits: string) =>
    digits.startsWith('55') && digits.length >= 12 ? digits.slice(2) : digits;

  return withoutCountryCode(leftDigits) === withoutCountryCode(rightDigits);
};

export const convertDateToISO = (dateStr: string) => {
  const cleaned = dateStr.replace(/\D/g, '');

  if (cleaned.length !== 8) {
    return null;
  }

  const day = cleaned.slice(0, 2);
  const month = cleaned.slice(2, 4);
  const year = cleaned.slice(4, 8);
  return `${year}-${month}-${day}`;
};

export const formatDisplayDate = (isoDate: string) => {
  if (!isoDate) return '';
  const [year, month, day] = isoDate.split('-');
  return `${day}/${month}/${year}`;
};

const parseNumericParameter = (value: string | null) => {
  if (!value || !/^\d+$/.test(value.trim())) {
    return null;
  }

  return Number.parseInt(value.trim(), 10);
};

const parseSimParameter = (value: string | null) =>
  (value ?? '')
    .trim()
    .toLocaleLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') === 'sim';

export const getBirthDateElapsedCode = (birthDate: string | null | undefined) => {
  if (!birthDate) {
    return null;
  }

  const match = birthDate.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) {
    return null;
  }

  const [, yearText, monthText, dayText] = match;
  const year = Number.parseInt(yearText, 10);
  const month = Number.parseInt(monthText, 10);
  const day = Number.parseInt(dayText, 10);

  if ([year, month, day].some(Number.isNaN)) {
    return null;
  }

  const today = new Date();
  let years = today.getFullYear() - year;
  let months = today.getMonth() + 1 - month;
  let days = today.getDate() - day;

  if (days < 0) {
    const previousMonthLastDay = new Date(today.getFullYear(), today.getMonth(), 0).getDate();
    days += previousMonthLastDay;
    months -= 1;
  }

  if (months < 0) {
    months += 12;
    years -= 1;
  }

  if (years < 0) {
    return null;
  }

  return `${String(years).padStart(2, '0')}${String(months).padStart(2, '0')}${String(days).padStart(2, '0')}`;
};

export const getMemberRoomStatus = (
  birthDate: string | null | undefined,
  idadeKids: number | null,
  idadeTeens: number | null
) => resolveKidsTeensStatusFromBirthDate(birthDate, { idadeKids, idadeTeens }) ?? null;

export type ManageMembersData = {
  familyId: string;
  members: ManagedMember[];
  profileName: string;
  profilePhone: string | null;
  acceptorProfileId: string | null;
  idadeKids: number | null;
  idadeTeens: number | null;
  showVidaTmp: boolean;
};

export type ManagedMember = {
  birth_date: string | null;
  family_id: string;
  full_name: string;
  id: string;
  phone: string | null;
  relationship: string;
  accepted?: boolean | null;
};

export async function loadManageMembersData(phoneParam: string | null): Promise<ManageMembersData> {
  let currentFamilyId = '';
  let profileName = '';
  let profilePhone: string | null = null;
  let profileBirth: string | null = null;
  let acceptorProfileId: string | null = null;

  // Identidade efetiva (alvo do Modo Ghost) — nunca auth.getUser() / family_ref.
  const sessionProfile = await loadEffectiveSessionProfile();
  const effectivePhone =
    (await getEffectiveUserPhone())?.trim() || sessionProfile?.phone?.trim() || null;
  const requestedPhone = phoneParam?.trim() || null;
  const phoneForLookup = requestedPhone || effectivePhone;

  const useSessionIdentity =
    Boolean(sessionProfile) &&
    (!requestedPhone ||
      phoneDigitsMatch(requestedPhone, sessionProfile?.phone) ||
      phoneDigitsMatch(requestedPhone, effectivePhone));

  if (useSessionIdentity && sessionProfile) {
    currentFamilyId = normalizeFamilyCode(
      sessionProfile.family_id ?? sessionProfile.codigo_membro ?? null
    );
    profileName = formatFullName(sessionProfile.full_name);
    profilePhone = sessionProfile.phone?.trim() || effectivePhone;
    profileBirth = sessionProfile.birth_date ?? null;
    acceptorProfileId = sessionProfile.id ?? null;
  }

  if (!currentFamilyId && phoneForLookup) {
    currentFamilyId = (await resolveExistingFamilyIdForPhone(phoneForLookup)) ?? '';
  }

  if (!acceptorProfileId && phoneForLookup) {
    const resolvedProfileId = await resolveProfileIdByPhone(phoneForLookup);

    if (resolvedProfileId) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, full_name, phone, birth_date, family_id, codigo_membro')
        .eq('id', resolvedProfileId)
        .maybeSingle();

      if (profile) {
        profileName = formatFullName(profile.full_name);
        profilePhone = profile.phone;
        profileBirth = profile.birth_date;
        acceptorProfileId = profile.id ?? null;
        if (!currentFamilyId) {
          currentFamilyId = normalizeFamilyCode(profile.family_id ?? profile.codigo_membro ?? null);
        }
      }
    } else {
      const phoneVariants = buildPhoneDbQueryVariants(phoneForLookup);
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, full_name, phone, birth_date, family_id, codigo_membro')
        .in('phone', phoneVariants.length ? phoneVariants : [phoneForLookup])
        .limit(1)
        .maybeSingle();

      if (profile) {
        profileName = formatFullName(profile.full_name);
        profilePhone = profile.phone;
        profileBirth = profile.birth_date;
        acceptorProfileId = profile.id ?? null;
        if (!currentFamilyId) {
          currentFamilyId = normalizeFamilyCode(profile.family_id ?? profile.codigo_membro ?? null);
        }
      }
    }
  }

  currentFamilyId = normalizeFamilyCode(currentFamilyId);

  const [idadeKidsValue, idadeTeensValue, vidaTmpValue] = await Promise.all([
    getAppParameterValue('idade_kids'),
    getAppParameterValue('idade_teens'),
    getAppParameterValue('vida_tmp'),
  ]);

  const idadeKids = parseNumericParameter(idadeKidsValue);
  const idadeTeens = parseNumericParameter(idadeTeensValue);
  const showVidaTmp = parseSimParameter(vidaTmpValue);

  if (!currentFamilyId) {
    return {
      familyId: '',
      members: [],
      profileName,
      profilePhone,
      acceptorProfileId,
      idadeKids,
      idadeTeens,
      showVidaTmp,
    };
  }

  const fetchFamilyMembers = async () => {
    const { data } = await supabase
      .from('members')
      .select('*')
      .ilike('family_id', currentFamilyId)
      .order('created_at', { ascending: false });

    return (data ?? []).map((member) => ({
      ...member,
      full_name: formatFullName(member.full_name),
      family_id: normalizeFamilyCode(member.family_id),
    }));
  };

  let membersData = await fetchFamilyMembers();

  if (profileName) {
    const alreadyIncluded = membersData.some((member) => {
      if (normalizeFamilyCode(member.family_id) !== currentFamilyId) {
        return false;
      }

      const sameName = normalizeMemberName(member.full_name) === normalizeMemberName(profileName);
      const samePhone = phoneDigitsMatch(member.phone, profilePhone);

      return sameName || samePhone;
    });

    let existsInDatabase = alreadyIncluded;

    if (!existsInDatabase && profilePhone?.trim()) {
      const phoneVariants = buildPhoneDbQueryVariants(profilePhone);
      const { data: existingByPhone } = await supabase
        .from('members')
        .select('id')
        .ilike('family_id', currentFamilyId)
        .in('phone', phoneVariants.length ? phoneVariants : [profilePhone.trim()])
        .limit(1)
        .maybeSingle();

      existsInDatabase = Boolean(existingByPhone?.id);
    }

    if (!existsInDatabase) {
      try {
        await upsertFamilyMember({
          full_name: profileName,
          phone: profilePhone,
          birth_date: profileBirth,
          relationship: 'Representante Legal',
          family_id: currentFamilyId,
          accepted: MEMBER_ACCEPTED_VALUE,
        });
        membersData = await fetchFamilyMembers();
      } catch {
        // Mantém a tela utilizável mesmo se o upsert falhar.
      }
    }
  }

  await ensureProfilesForMembers(membersData, currentFamilyId);
  const members = dedupeFamilyMembers(await applyProfileBirthDates(membersData));

  return {
    familyId: currentFamilyId,
    members,
    profileName,
    profilePhone,
    acceptorProfileId,
    idadeKids,
    idadeTeens,
    showVidaTmp,
  };
}
