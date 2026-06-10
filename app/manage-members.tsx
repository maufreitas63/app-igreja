import { getAppParameterValue } from '@/lib/appParameters';
import { MEMBER_ACCEPTED_VALUE } from '@/lib/membersAccepted';
import {
  hasAnyProfileAddress,
  inheritFamilyAddressToAcceptedMember,
  loadAcceptorAddressForFamilyScreen,
  resolveAcceptorAuthUserId,
} from '@/lib/inheritFamilyAddress';
import { formatShortName } from '@/lib/formatShortName';
import {
  buildProfileInFamilyMessage,
  canSearchProfileByName,
  canSearchProfileByPhone,
  hasAcceptedMemberInFamily,
  lookupProfileByPhoneForMember,
  profileBelongsToFamily,
  searchProfilesByNameForMember,
  type ProfileMemberLookup,
} from '@/lib/lookupProfileByPhoneForMember';
import { findAcceptedMemberDuplicateInFamily } from '@/lib/familyMemberMatch';
import { MemberPhotoPicker } from '@/components/MemberPhotoPicker';
import { confirmDialog } from '@/lib/confirmDialog';
import { attachSelfieToManagedMemberProfile } from '@/lib/managedMemberSelfie';
import { resolveSelfiePreviewUrl } from '@/lib/selfie';
import { buildPhoneDbQueryVariants } from '@/lib/phoneDbVariants';
import { dedupeFamilyMembers } from '@/lib/familyAudienceMembers';
import { detachMemberFromFamilyWithNewCode } from '@/lib/detachMemberFromFamily';
import {
  applyNewFamilyCodeForRejectedMember,
  findMemberForFamilyTransfer,
} from '@/lib/rejectedMemberFamilyCode';
import { MaterialIcons } from '@expo/vector-icons';
import { acceptMemberIntoFamily } from '@/lib/acceptMemberIntoFamily';
import {
  ensureProfilesForMembers,
  findProfileIdForMember,
  upsertProfileForManagedMember,
} from '../lib/memberProfiles';
import { syncManagedMemberProfileFamilyWithFallback } from '@/lib/syncManagedMemberProfileFamily';
import { applyProfileBirthDates } from '../lib/profileBirthDates';
import { supabase } from '@/lib/supabase';
import { ACCESS_SCREEN } from '@/lib/accessControl';
import {
  normalizeFamilyCode,
  resolveCurrentFamilyId,
  resolveFamilyIdForAuthUser,
  resolveFamilyIdForPhone,
} from '@/lib/family';
import { resolveProfileIdByPhone } from '@/lib/resolveProfileByPhone';
import { useReturnToCallerOnLeave } from '@/hooks/useReturnToCallerOnLeave';
import { useScreenAccessGuard } from '@/hooks/useScreenAccessGuard';
import { resolveReturnDashboardCardParam } from '@/lib/dashboardReturnNavigation';
import { useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import Toast from 'react-native-toast-message';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

const OPCOES_PARENTESCO = ['Cônjuge', 'Filho(a)', 'Representante Legal', 'Pai', 'Mãe', 'Outros'];

const formatPhone = (value: string) => {
  const cleaned = value.replace(/\D/g, '');
  if (cleaned.length <= 2) return cleaned;
  if (cleaned.length <= 6) return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2)}`;
  if (cleaned.length <= 10) return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 6)}-${cleaned.slice(6)}`;
  return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7, 11)}`;
};

const formatDate = (value: string) => {
  const cleaned = value.replace(/\D/g, '');
  if (cleaned.length <= 2) return cleaned;
  if (cleaned.length <= 4) return `${cleaned.slice(0, 2)}/${cleaned.slice(2)}`;
  return `${cleaned.slice(0, 2)}/${cleaned.slice(2, 4)}/${cleaned.slice(4, 8)}`;
};

const normalizeMemberName = (value: string | null | undefined) =>
  (value ?? '')
    .trim()
    .toLocaleLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');

const normalizeMemberPhoneDigits = (value: string | null | undefined) =>
  (value ?? '').replace(/\D/g, '');

const SELF_MEMBER_BLOCK_MESSAGE =
  'Você já faz parte desta família como titular da conta. Não é possível cadastrá-lo novamente como outro integrante.';

const FAMILY_INCONSISTENCY_TOAST_MS = 4500;

const ALREADY_IN_FAMILY_TOAST_MESSAGE =
  'Este integrante já faz parte desta família. A ação não pode ser efetuada.';

const showFamilyInconsistencyToast = (text2: string, text1 = 'Ação não permitida') => {
  Toast.show({
    type: 'error',
    text1,
    text2,
    visibilityTime: FAMILY_INCONSISTENCY_TOAST_MS,
  });
};

const showFamilyWarningToast = (text2: string, text1 = 'Atenção') => {
  Toast.show({
    type: 'info',
    text1,
    text2,
    visibilityTime: FAMILY_INCONSISTENCY_TOAST_MS,
  });
};

const phoneDigitsMatch = (left: string | null | undefined, right: string | null | undefined) => {
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

const convertDateToISO = (dateStr: string) => {
  const cleaned = dateStr.replace(/\D/g, '');

  if (cleaned.length !== 8) {
    return null;
  }

  const day = cleaned.slice(0, 2);
  const month = cleaned.slice(2, 4);
  const year = cleaned.slice(4, 8);
  return `${year}-${month}-${day}`;
};

const formatDisplayDate = (isoDate: string) => {
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

const getBirthDateElapsedCode = (birthDate: string | null | undefined) => {
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

const getAgeFromBirthDate = (birthDate: string | null | undefined) => {
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
  let age = today.getFullYear() - year;
  const hasHadBirthdayThisYear =
    today.getMonth() + 1 > month || ((today.getMonth() + 1 === month) && today.getDate() >= day);

  if (!hasHadBirthdayThisYear) {
    age -= 1;
  }

  return age;
};

const getMemberRoomStatus = (
  birthDate: string | null | undefined,
  idadeKids: number | null,
  idadeTeens: number | null
) => {
  const age = getAgeFromBirthDate(birthDate);

  if (age === null) {
    return null;
  }

  if (idadeKids !== null && age <= idadeKids) {
    return 'KIDS' as const;
  }

  if (idadeKids !== null && idadeTeens !== null && age > idadeKids && age <= idadeTeens) {
    return 'TEENS' as const;
  }

  return null;
};

type ManageMembersData = {
  familyId: string;
  members: ManagedMember[];
  profileName: string;
  profilePhone: string | null;
  acceptorProfileId: string | null;
  idadeKids: number | null;
  idadeTeens: number | null;
  showVidaTmp: boolean;
};

type ManagedMember = {
  birth_date: string | null;
  family_id: string;
  full_name: string;
  id: string;
  phone: string | null;
  relationship: string;
  accepted?: boolean | null;
};

async function loadManageMembersData(phoneParam: string | null): Promise<ManageMembersData> {
  let currentFamilyId = await resolveCurrentFamilyId();
  let profileName = '';
  let profilePhone: string | null = null;
  let profileBirth: string | null = null;
  let acceptorProfileId: string | null = null;

  if (phoneParam) {
    currentFamilyId = await resolveFamilyIdForPhone(phoneParam);
    const resolvedProfileId = await resolveProfileIdByPhone(phoneParam);

    if (resolvedProfileId) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, full_name, phone, birth_date')
        .eq('id', resolvedProfileId)
        .maybeSingle();

      if (profile) {
        profileName = profile.full_name ?? '';
        profilePhone = profile.phone;
        profileBirth = profile.birth_date;
        acceptorProfileId = profile.id ?? null;
      }
    } else {
      const phoneVariants = buildPhoneDbQueryVariants(phoneParam);
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, full_name, phone, birth_date')
        .in('phone', phoneVariants.length ? phoneVariants : [phoneParam])
        .limit(1)
        .maybeSingle();

      if (profile) {
        profileName = profile.full_name ?? '';
        profilePhone = profile.phone;
        profileBirth = profile.birth_date;
        acceptorProfileId = profile.id ?? null;
      }
    }
  } else {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      currentFamilyId = await resolveFamilyIdForAuthUser(user.id);
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, full_name, phone, birth_date')
        .eq('auth_user_id', user.id)
        .maybeSingle();

      if (profile) {
        profileName = profile.full_name ?? '';
        profilePhone = profile.phone;
        profileBirth = profile.birth_date;
        acceptorProfileId = profile.id ?? null;
      }
    }
  }

  currentFamilyId = normalizeFamilyCode(currentFamilyId);

  /** Lista todos os membros (incl. accepted false/null) para reconhecimento familiar. */
  const fetchFamilyMembers = async () => {
    const { data } = await supabase
      .from('members')
      .select('*')
      .ilike('family_id', currentFamilyId)
      .order('created_at', { ascending: false });

    return (data ?? []).map((member) => ({
      ...member,
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
      const { error } = await supabase.from('members').insert([
        {
          full_name: profileName,
          phone: profilePhone,
          birth_date: profileBirth,
          relationship: 'Representante Legal',
          family_id: currentFamilyId,
          accepted: MEMBER_ACCEPTED_VALUE,
        },
      ]);

      if (!error) {
        membersData = await fetchFamilyMembers();
      }
    }
  }

  const [idadeKidsValue, idadeTeensValue, vidaTmpValue] = await Promise.all([
    getAppParameterValue('idade_kids'),
    getAppParameterValue('idade_teens'),
    getAppParameterValue('vida_tmp'),
  ]);

  await ensureProfilesForMembers(membersData, currentFamilyId);
  const members = dedupeFamilyMembers(await applyProfileBirthDates(membersData));

  return {
    familyId: currentFamilyId,
    members,
    profileName,
    profilePhone,
    acceptorProfileId,
    idadeKids: parseNumericParameter(idadeKidsValue),
    idadeTeens: parseNumericParameter(idadeTeensValue),
    showVidaTmp: parseSimParameter(vidaTmpValue),
  };
}

export default function ManageMembers() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();
  const phoneParam = params.phone ? decodeURIComponent(params.phone as string) : null;
  const returnDashboardCard = resolveReturnDashboardCardParam(params);
  const returnToCaller = useReturnToCallerOnLeave({
    returnDashboardCard,
    fallbackDashboardCard: 'grouped_manage',
    extraRouteParams: phoneParam ? { phone: encodeURIComponent(phoneParam) } : undefined,
  });
  const listRef = useRef<FlatList<ManagedMember>>(null);

  useScreenAccessGuard({
    resourceKey: ACCESS_SCREEN.manageMembers,
    deniedMessage: 'Você não tem permissão para abrir Gerenciar família.',
  });

  const [familyId, setFamilyId] = useState('IBN0001');
  const [members, setMembers] = useState<ManagedMember[]>([]);
  const [profileName, setProfileName] = useState('');
  const [profilePhone, setProfilePhone] = useState<string | null>(null);
  const [acceptorProfileId, setAcceptorProfileId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [parentesco, setParentesco] = useState('');
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [idadeKids, setIdadeKids] = useState<number | null>(null);
  const [idadeTeens, setIdadeTeens] = useState<number | null>(null);
  const [showVidaTmp, setShowVidaTmp] = useState(false);
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [editingMemberSnapshot, setEditingMemberSnapshot] = useState<ManagedMember | null>(null);
  const [pendingAcceptedMemberIds, setPendingAcceptedMemberIds] = useState<string[]>([]);
  const [memberFormSectionExpanded, setMemberFormSectionExpanded] = useState(false);
  const [nameSearchLoading, setNameSearchLoading] = useState(false);
  const [nameSearchResults, setNameSearchResults] = useState<ProfileMemberLookup[]>([]);
  const [profileLookupMessage, setProfileLookupMessage] = useState<string | null>(null);
  const [linkedProfile, setLinkedProfile] = useState<ProfileMemberLookup | null>(null);
  const [medicalFoodAlerts, setMedicalFoodAlerts] = useState('');
  const [pendingMemberPhoto, setPendingMemberPhoto] = useState<string | null>(null);

  const applyLoadedData = useCallback((data: ManageMembersData) => {
    setFamilyId(data.familyId);
    setMembers(data.members);
    setProfileName(data.profileName);
    setProfilePhone(data.profilePhone);
    setAcceptorProfileId(data.acceptorProfileId);
    setIdadeKids(data.idadeKids);
    setIdadeTeens(data.idadeTeens);
    setShowVidaTmp(data.showVidaTmp);
  }, []);

  const fetchData = useCallback(async () => {
    const data = await loadManageMembersData(phoneParam);
    applyLoadedData(data);
  }, [phoneParam, applyLoadedData]);

  const resetForm = useCallback(() => {
    setName('');
    setPhone('');
    setBirthDate('');
    setParentesco('');
    setEditingMemberId(null);
    setEditingMemberSnapshot(null);
    setProfileLookupMessage(null);
    setLinkedProfile(null);
    setNameSearchResults([]);
    setNameSearchLoading(false);
    setMedicalFoodAlerts('');
    setPendingMemberPhoto(null);
  }, []);

  const applyProfileToMemberForm = useCallback((profile: ProfileMemberLookup) => {
    setLinkedProfile(profile);
    setName(profile.full_name?.trim() ?? '');
    setPhone(profile.phone ? formatPhone(profile.phone) : '');
    setBirthDate(profile.birth_date ? formatDisplayDate(profile.birth_date) : '');
    setPendingMemberPhoto(null);
  }, []);

  const profileMatchesSessionAccount = useCallback(
    (profile: Pick<ProfileMemberLookup, 'id' | 'full_name' | 'phone'>) => {
      if (acceptorProfileId && profile.id === acceptorProfileId) {
        return true;
      }

      if (!profileName.trim()) {
        return false;
      }

      const sameName = normalizeMemberName(profile.full_name) === normalizeMemberName(profileName);
      const samePhone = phoneDigitsMatch(profile.phone, profilePhone);

      return sameName || samePhone;
    },
    [acceptorProfileId, profileName, profilePhone]
  );

  const handleSelectProfileFromNameSearch = useCallback(
    (profile: ProfileMemberLookup) => {
      const isEditingSamePerson =
        Boolean(editingMemberSnapshot) &&
        (normalizeMemberName(editingMemberSnapshot?.full_name) ===
          normalizeMemberName(profile.full_name) ||
          phoneDigitsMatch(editingMemberSnapshot?.phone, profile.phone));

      if (!isEditingSamePerson && profileMatchesSessionAccount(profile)) {
        setProfileLookupMessage(SELF_MEMBER_BLOCK_MESSAGE);
        showFamilyInconsistencyToast(SELF_MEMBER_BLOCK_MESSAGE, 'Não é possível selecionar');
        return;
      }

      if (profileBelongsToFamily(profile, familyId) && !isEditingSamePerson) {
        const duplicateMessage = buildProfileInFamilyMessage(profile);
        setProfileLookupMessage(duplicateMessage);
        showFamilyInconsistencyToast(ALREADY_IN_FAMILY_TOAST_MESSAGE);
        return;
      }

      applyProfileToMemberForm(profile);
      setNameSearchResults([]);

      const familyHint =
        profile.family_id && profile.family_id !== familyId
          ? ` Código familiar no cadastro: ${profile.family_id}.`
          : '';

      setProfileLookupMessage(
        `Usuário selecionado: ${profile.full_name?.trim() || 'Sem nome'}.${familyHint}`
      );
    },
    [applyProfileToMemberForm, editingMemberSnapshot, familyId, profileMatchesSessionAccount]
  );

  useEffect(() => {
    if (editingMemberId) {
      setNameSearchResults([]);
      setNameSearchLoading(false);
      return;
    }

    const query = name.trim();

    if (!canSearchProfileByName(query)) {
      setNameSearchResults([]);
      setNameSearchLoading(false);
      return;
    }

    let active = true;
    const timer = setTimeout(() => {
      setNameSearchLoading(true);

      void searchProfilesByNameForMember(query)
        .then((results) => {
          if (active) {
            setNameSearchResults(results.filter((profile) => !profileMatchesSessionAccount(profile)));
          }
        })
        .catch((err: unknown) => {
          console.error('Erro ao buscar perfis por nome:', err);

          if (active) {
            setNameSearchResults([]);
            setProfileLookupMessage('Não foi possível buscar usuários pelo nome.');
          }
        })
        .finally(() => {
          if (active) {
            setNameSearchLoading(false);
          }
        });
    }, 300);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [editingMemberId, name, profileMatchesSessionAccount]);

  useEffect(() => {
    if (editingMemberId || linkedProfile || name.trim()) {
      return;
    }

    const formattedPhone = formatPhone(phone);

    if (!canSearchProfileByPhone(formattedPhone)) {
      return;
    }

    let active = true;
    const timer = setTimeout(() => {
      void lookupProfileByPhoneForMember(formattedPhone)
        .then((profile) => {
          if (!active || !profile) {
            return;
          }

          applyProfileToMemberForm(profile);
          setProfileLookupMessage(
            `Perfil encontrado pelo telefone: ${profile.full_name?.trim() || 'Sem nome'}.`
          );
        })
        .catch((err: unknown) => {
          console.error('Erro ao buscar perfil pelo telefone:', err);
        });
    }, 350);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [applyProfileToMemberForm, editingMemberId, linkedProfile, name, phone]);

  const persistPendingMemberPhoto = useCallback(
    async (
      member: {
        full_name: string;
        phone: string | null;
        birth_date: string | null;
      },
      profileId?: string | null
    ): Promise<string | null> => {
      if (!pendingMemberPhoto || /^https?:/i.test(pendingMemberPhoto)) {
        return null;
      }

      try {
        await attachSelfieToManagedMemberProfile({
          member,
          familyId,
          profileId,
          photo: pendingMemberPhoto,
        });
        return null;
      } catch (photoError) {
        console.error('Erro ao salvar fotografia do membro:', photoError);
        return ' A fotografia não pôde ser salva no perfil do integrante.';
      }
    },
    [familyId, pendingMemberPhoto]
  );

  const resolveProfileIdForMemberAction = useCallback(
    async (
      member: Pick<ManagedMember, 'full_name' | 'phone' | 'birth_date'>,
      explicitProfileId?: string | null
    ) => {
      if (explicitProfileId?.trim()) {
        return explicitProfileId.trim();
      }

      const profileId = await findProfileIdForMember({
        full_name: member.full_name,
        phone: member.phone,
        birth_date: member.birth_date,
      });

      return profileId ?? null;
    },
    []
  );

  const copyAcceptorAddressToMember = useCallback(
    async (
      member: Pick<ManagedMember, 'full_name' | 'phone' | 'birth_date'> & { id?: string },
      profileId?: string | null
    ): Promise<boolean> => {
      if (member.id) {
        await syncManagedMemberProfileFamilyWithFallback({
          memberId: String(member.id),
          profileId,
          member: {
            full_name: member.full_name,
            phone: member.phone,
            birth_date: member.birth_date,
          },
          familyId,
        });
      } else {
        await upsertProfileForManagedMember(
          {
            full_name: member.full_name,
            phone: member.phone,
            birth_date: member.birth_date,
          },
          familyId,
          null,
          undefined,
          profileId
        );
      }

      const acceptorAuthUserId = await resolveAcceptorAuthUserId();
      const inheritedAddress = await loadAcceptorAddressForFamilyScreen({
        profileId: acceptorProfileId,
        phone: profilePhone ?? phoneParam,
        authUserId: acceptorAuthUserId,
      });

      if (!inheritedAddress || !hasAnyProfileAddress(inheritedAddress)) {
        return false;
      }

      try {
        await inheritFamilyAddressToAcceptedMember(
          {
            full_name: member.full_name,
            phone: member.phone,
            birth_date: member.birth_date,
          },
          {
            acceptorProfileId,
            acceptorPhone: profilePhone ?? phoneParam,
            acceptorAuthUserId,
            acceptedProfileId: profileId,
            inheritedAddress,
          }
        );
        return true;
      } catch (err: unknown) {
        console.error('Erro ao herdar endereço para membro aceito:', err);
        return false;
      }
    },
    [acceptorProfileId, familyId, phoneParam, profilePhone]
  );

  const handleToggleMemberAccepted = useCallback(async (member: ManagedMember) => {
    const memberId = String(member.id);

    if (!memberId || memberId === 'undefined') {
      showFamilyInconsistencyToast(
        'Este integrante não possui identificador válido para atualizar.',
        'Erro'
      );
      return;
    }

    let alreadyPending = false;

    setPendingAcceptedMemberIds((current) => {
      if (current.includes(memberId)) {
        alreadyPending = true;
        return current;
      }

      return [...current, memberId];
    });

    if (alreadyPending) {
      return;
    }

    const nextAccepted = member.accepted !== true;
    const nextFamilyIdForMember = nextAccepted ? familyId : member.family_id;

    setMembers((current) =>
      current.map((entry) =>
        String(entry.id) === memberId
          ? { ...entry, accepted: nextAccepted, family_id: nextFamilyIdForMember ?? entry.family_id }
          : entry
      )
    );

    try {
      const profileIdForMember = await resolveProfileIdForMemberAction(member);

      if (!nextAccepted) {
        const newFamilyId = await applyNewFamilyCodeForRejectedMember(
          {
            id: memberId,
            full_name: member.full_name,
            phone: member.phone,
            birth_date: member.birth_date,
            family_id: member.family_id,
          },
          profileIdForMember
        );

        setMembers((current) =>
          current.map((entry) =>
            String(entry.id) === memberId
              ? { ...entry, accepted: false, family_id: newFamilyId }
              : entry
          )
        );
      } else {
        await acceptMemberIntoFamily({
          memberId,
          targetFamilyId: familyId,
          profileId: profileIdForMember,
          member: {
            full_name: member.full_name,
            phone: member.phone,
            birth_date: member.birth_date,
          },
        });

        const addressInherited = await copyAcceptorAddressToMember(
          { ...member, id: memberId },
          profileIdForMember
        );

        setMembers((current) =>
          current.map((entry) =>
            String(entry.id) === memberId
              ? { ...entry, accepted: true, family_id: familyId }
              : entry
          )
        );

        if (!addressInherited) {
          showFamilyWarningToast(
            'O vínculo familiar foi confirmado, mas o endereço completo da sua família não pôde ser copiado para o perfil desta pessoa. Verifique se o integrante possui telefone cadastrado e se o seu perfil tem endereço preenchido.',
            'Integrante reconhecido'
          );
        }
      }
    } catch (err: unknown) {
      setMembers((current) =>
        current.map((entry) =>
          String(entry.id) === memberId ? { ...entry, accepted: member.accepted ?? null } : entry
        )
      );

      const message =
        err instanceof Error ? err.message : 'Não foi possível atualizar o reconhecimento do integrante.';

      if (message.toLowerCase().includes('accepted')) {
        showFamilyInconsistencyToast(
          'A coluna accepted ainda não existe na tabela members. Execute scripts/members-accepted-column.sql no Supabase.',
          'Erro'
        );
      } else {
        showFamilyInconsistencyToast(message, 'Erro');
      }
    } finally {
      setPendingAcceptedMemberIds((current) => current.filter((id) => id !== memberId));
    }
  }, [copyAcceptorAddressToMember, familyId, resolveProfileIdForMemberAction]);

  const startEditingMember = useCallback((member: ManagedMember) => {
    const editingId = String(member.id);

    setEditingMemberId(editingId);
    setEditingMemberSnapshot(member);
    setName(member.full_name ?? '');
    setPhone(member.phone ? formatPhone(member.phone) : '');
    setBirthDate(member.birth_date ? formatDisplayDate(member.birth_date) : '');
    setParentesco(member.relationship ?? '');
    setMedicalFoodAlerts('');
    setPendingMemberPhoto(null);
    setProfileLookupMessage(null);
    setLinkedProfile(null);
    setNameSearchResults([]);
    setNameSearchLoading(false);
    setMemberFormSectionExpanded(true);
    listRef.current?.scrollToOffset({ animated: true, offset: 0 });

    void (async () => {
      try {
        const profileId = await findProfileIdForMember({
          full_name: member.full_name ?? '',
          phone: member.phone,
          birth_date: member.birth_date,
        });

        if (!profileId) {
          return;
        }

        const { data, error } = await supabase
          .from('profiles')
          .select('id, medical_food_alerts, selfie_url')
          .eq('id', profileId)
          .maybeSingle();

        if (error) {
          throw error;
        }

        if (data?.id) {
          setMedicalFoodAlerts(
            typeof data.medical_food_alerts === 'string' ? data.medical_food_alerts.trim() : ''
          );

          if (typeof data.selfie_url === 'string' && data.selfie_url.trim()) {
            const previewUrl = await resolveSelfiePreviewUrl(data.selfie_url);
            setPendingMemberPhoto(previewUrl);
          }
        }
      } catch (loadError) {
        console.error('Erro ao carregar dados do perfil do membro:', loadError);
      }
    })();
  }, []);

  useEffect(() => {
    let active = true;

    void loadManageMembersData(phoneParam).then((data) => {
      if (active) {
        applyLoadedData(data);
      }
    });

    return () => {
      active = false;
    };
  }, [phoneParam, applyLoadedData]);

  const isAccountLegalRepresentativeMember = useCallback(
    (member: Pick<ManagedMember, 'full_name' | 'phone' | 'relationship'>) => {
      if (member.relationship !== 'Representante Legal' || !profileName.trim()) {
        return false;
      }

      const sameName = normalizeMemberName(member.full_name) === normalizeMemberName(profileName);
      const samePhone = Boolean(
        profilePhone && member.phone && phoneDigitsMatch(member.phone, profilePhone)
      );

      return sameName || samePhone;
    },
    [profileName, profilePhone]
  );

  const performDeleteEditingMember = useCallback(async () => {
    if (!editingMemberId || !editingMemberSnapshot) {
      return;
    }

    if (isAccountLegalRepresentativeMember(editingMemberSnapshot)) {
      showFamilyInconsistencyToast(
        'O representante legal da conta não pode ser removido por esta tela.',
        'Não é possível excluir'
      );
      return;
    }

    setDeleting(true);
    try {
      const profileIdForMember = await resolveProfileIdForMemberAction(
        editingMemberSnapshot,
        linkedProfile?.id
      );

      const newFamilyId = await detachMemberFromFamilyWithNewCode(
        {
          id: editingMemberId,
          full_name: editingMemberSnapshot.full_name,
          phone: editingMemberSnapshot.phone,
          birth_date: editingMemberSnapshot.birth_date,
          family_id: editingMemberSnapshot.family_id,
          accepted: editingMemberSnapshot.accepted,
        },
        profileIdForMember
      );

      resetForm();
      await fetchData();
      Alert.alert(
        'Sucesso',
        `Integrante removido da família. Novo código familiar atribuído: ${newFamilyId}.`
      );
    } catch (err: unknown) {
      const rawMessage = err instanceof Error ? err.message : 'Não foi possível excluir o integrante.';
      const message = rawMessage.toLowerCase().includes('policy') || rawMessage.toLowerCase().includes('permission')
        ? `${rawMessage}\n\nExecute no Supabase: scripts/sync-managed-member-profile-family-rpc.sql`
        : rawMessage;
      showFamilyInconsistencyToast(message, 'Erro');
    } finally {
      setDeleting(false);
    }
  }, [
    editingMemberId,
    editingMemberSnapshot,
    fetchData,
    isAccountLegalRepresentativeMember,
    linkedProfile?.id,
    resolveProfileIdForMemberAction,
    resetForm,
  ]);

  const confirmDeleteEditingMember = useCallback(async () => {
    if (!editingMemberSnapshot) {
      return;
    }

    const memberLabel = editingMemberSnapshot.full_name?.trim() || 'este integrante';

    const confirmed = await confirmDialog(
      'Excluir integrante',
      `Remover ${memberLabel} da família? Ele receberá um novo código familiar sequencial e deixará de aparecer nesta lista.`,
      'Excluir',
      'Cancelar',
      { destructive: true }
    );

    if (confirmed) {
      await performDeleteEditingMember();
    }
  }, [editingMemberSnapshot, performDeleteEditingMember]);

  const addMember = async () => {
    if (!parentesco) {
      showFamilyInconsistencyToast('Selecione o grau de parentesco.');
      return;
    }

    const formattedPhone = phone.trim() ? formatPhone(phone) : '';
    let resolvedLinkedProfile = linkedProfile;

    if (
      formattedPhone &&
      canSearchProfileByPhone(formattedPhone) &&
      !resolvedLinkedProfile
    ) {
      try {
        const profileByPhone = await lookupProfileByPhoneForMember(formattedPhone);

        if (profileByPhone) {
          resolvedLinkedProfile = profileByPhone;
        }
      } catch (lookupError) {
        console.error('Erro ao resolver perfil pelo telefone antes de salvar:', lookupError);
      }
    }

    const normalizedName = name.trim() || resolvedLinkedProfile?.full_name?.trim() || '';

    if (!normalizedName) {
      showFamilyInconsistencyToast(
        'O nome é obrigatório. Digite o nome completo ou informe um telefone com perfil cadastrado.'
      );
      return;
    }

    const normalizedPhone = formattedPhone || null;

    if (
      !editingMemberId &&
      profileMatchesSessionAccount({
        id: resolvedLinkedProfile?.id ?? '',
        full_name: resolvedLinkedProfile?.full_name ?? normalizedName,
        phone: resolvedLinkedProfile?.phone ?? normalizedPhone,
      })
    ) {
      showFamilyInconsistencyToast(SELF_MEMBER_BLOCK_MESSAGE, 'Não é possível cadastrar');
      return;
    }

    setAdding(true);
    try {
      const birthIso = convertDateToISO(birthDate);
      const normalizedFamilyId = normalizeFamilyCode(familyId);
      const memberPayload = {
        full_name: normalizedName,
        phone: normalizedPhone,
        birth_date: birthIso,
        relationship: parentesco,
        family_id: normalizedFamilyId,
        accepted: MEMBER_ACCEPTED_VALUE,
      };
      const memberProfileInput = {
        full_name: normalizedName,
        phone: normalizedPhone,
        birth_date: birthIso,
      };

      if (editingMemberId) {
        const { error } = await supabase
          .from('members')
          .update(memberPayload)
          .eq('id', editingMemberId);
        if (error) throw error;

        await syncManagedMemberProfileFamilyWithFallback({
          memberId: editingMemberId,
          profileId: resolvedLinkedProfile?.id,
          member: {
            full_name: normalizedName,
            phone: normalizedPhone,
            birth_date: birthIso,
          },
          familyId,
        });

        await upsertProfileForManagedMember(
          {
            full_name: normalizedName,
            phone: normalizedPhone,
            birth_date: birthIso,
            medical_food_alerts: medicalFoodAlerts.trim() || null,
          },
          familyId,
          editingMemberSnapshot
            ? {
                full_name: editingMemberSnapshot.full_name,
                phone: editingMemberSnapshot.phone,
                birth_date: editingMemberSnapshot.birth_date,
              }
            : null,
          undefined,
          resolvedLinkedProfile?.id
        );

        const profileIdForEdit = await resolveProfileIdForMemberAction(
          memberProfileInput,
          resolvedLinkedProfile?.id
        );

        const photoWarning = await persistPendingMemberPhoto(
          memberProfileInput,
          resolvedLinkedProfile?.id ?? profileIdForEdit
        );

        resetForm();
        await fetchData();
        Alert.alert('Sucesso', `Integrante atualizado!${photoWarning ?? ''}`);
        return;
      }

      const duplicateMember = await findAcceptedMemberDuplicateInFamily(normalizedFamilyId, {
        full_name: normalizedName,
        phone: normalizedPhone,
      });

      if (duplicateMember) {
        showFamilyInconsistencyToast(ALREADY_IN_FAMILY_TOAST_MESSAGE);
        return;
      }

      const profileIdForAction = await resolveProfileIdForMemberAction(
        {
          full_name: normalizedName,
          phone: normalizedPhone,
          birth_date: birthIso,
        },
        resolvedLinkedProfile?.id
      );

      if (resolvedLinkedProfile && profileBelongsToFamily(resolvedLinkedProfile, familyId)) {
        const alreadyInFamilyGroup = await hasAcceptedMemberInFamily(resolvedLinkedProfile, familyId);

        if (alreadyInFamilyGroup) {
          setProfileLookupMessage(buildProfileInFamilyMessage(resolvedLinkedProfile));
          showFamilyInconsistencyToast(ALREADY_IN_FAMILY_TOAST_MESSAGE);
          return;
        }
      }

      const existingMember = await findMemberForFamilyTransfer(
        {
          full_name: resolvedLinkedProfile?.full_name ?? normalizedName,
          phone: resolvedLinkedProfile?.phone ?? normalizedPhone,
        },
        normalizedFamilyId
      );

      if (existingMember?.id) {
        const existingFamilyId = existingMember.family_id?.trim().toUpperCase() ?? '';
        const targetFamilyId = familyId.trim().toUpperCase();

        if (existingFamilyId === targetFamilyId && existingMember.accepted === true) {
          showFamilyInconsistencyToast(ALREADY_IN_FAMILY_TOAST_MESSAGE);
          return;
        }

        if (existingFamilyId && existingFamilyId !== targetFamilyId) {
          const confirmed = await confirmDialog(
            'Vincular à sua família',
            `${normalizedName} está na família ${existingFamilyId}. Deseja transferir para ${targetFamilyId}? O endereço completo da sua família será copiado para o perfil desta pessoa.`,
            'Transferir',
            'Cancelar'
          );

          if (!confirmed) {
            return;
          }
        }

        const { error: updateExistingError } = await supabase
          .from('members')
          .update({
            full_name: normalizedName,
            phone: normalizedPhone,
            birth_date: birthIso,
            relationship: parentesco,
          })
          .eq('id', existingMember.id);

        if (updateExistingError) {
          throw updateExistingError;
        }

        await acceptMemberIntoFamily({
          memberId: String(existingMember.id),
          targetFamilyId: familyId,
          profileId: resolvedLinkedProfile?.id ?? profileIdForAction,
          member: {
            full_name: normalizedName,
            phone: normalizedPhone,
            birth_date: birthIso,
          },
        });

        const addressInherited = await copyAcceptorAddressToMember(
          {
            id: String(existingMember.id),
            full_name: normalizedName,
            phone: normalizedPhone,
            birth_date: birthIso,
          },
          resolvedLinkedProfile?.id ?? profileIdForAction
        );

        const photoWarning = await persistPendingMemberPhoto(
          memberProfileInput,
          resolvedLinkedProfile?.id ?? profileIdForAction
        );

        resetForm();
        await fetchData();

        const transferBaseMessage =
          existingFamilyId && existingFamilyId !== targetFamilyId
            ? `Integrante transferido da família ${existingFamilyId} para ${targetFamilyId}.`
            : 'Integrante adicionado à família!';

        Alert.alert(
          'Sucesso',
          (addressInherited
            ? `${transferBaseMessage} O endereço completo da sua família foi copiado para o perfil.`
            : `${transferBaseMessage} O endereço completo da sua família não pôde ser copiado para o perfil.`) +
            (photoWarning ?? '')
        );
        return;
      }

      const { data: insertedMember, error } = await supabase
        .from('members')
        .insert([memberPayload])
        .select('id')
        .maybeSingle();
      if (error) throw error;

      if (!insertedMember?.id) {
        throw new Error('Integrante criado, mas o identificador não foi retornado.');
      }

      const addressInherited = await copyAcceptorAddressToMember(
        {
          id: String(insertedMember.id),
          full_name: normalizedName,
          phone: normalizedPhone,
          birth_date: birthIso,
        },
        resolvedLinkedProfile?.id ?? profileIdForAction
      );

      const photoWarning = await persistPendingMemberPhoto(
        memberProfileInput,
        resolvedLinkedProfile?.id ?? profileIdForAction
      );

      resetForm();
      await fetchData();
      Alert.alert(
        'Sucesso',
        (addressInherited
          ? 'Integrante adicionado! O endereço completo da sua família foi copiado para o perfil.'
          : 'Integrante adicionado, mas o endereço completo da sua família não pôde ser copiado para o perfil.') +
          (photoWarning ?? '')
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro ao adicionar integrante.';
      showFamilyInconsistencyToast(message, 'Erro');
    } finally {
      setAdding(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <Text style={styles.titleCentered}>Gerenciar Família</Text>
        <View style={styles.readOnlyContainer}>
          <Text style={styles.readOnlyText}>Família Atual: {familyId}</Text>
        </View>
      </View>

      <FlatList
        ref={listRef}
        style={styles.membersList}
        data={members}
        keyExtractor={(item) => String(item.id)}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: 20, paddingBottom: 100 }}
        ListHeaderComponent={
          <>
            <View style={styles.memberFormSection}>
              <TouchableOpacity
                style={styles.memberFormSectionHeader}
                onPress={() => setMemberFormSectionExpanded((open) => !open)}
                activeOpacity={0.85}
              >
                <View style={styles.memberFormSectionHeaderText}>
                  <Text style={styles.memberFormSectionTitle}>
                    {editingMemberId ? 'Editar integrante' : 'Adicionar integrante'}
                  </Text>
                  <Text style={styles.memberFormSectionMeta}>
                    {editingMemberId ? 'Alterar dados do familiar' : 'Preencha os dados do familiar'}
                  </Text>
                </View>
                <MaterialIcons
                  name={memberFormSectionExpanded ? 'expand-less' : 'expand-more'}
                  size={22}
                  color="#CBD5E1"
                />
              </TouchableOpacity>

              {memberFormSectionExpanded ? (
              <View style={styles.memberFormSectionBody}>
                <Text style={styles.fieldLabel}>Nome completo</Text>
                {!editingMemberId ? (
                  <Text style={styles.fieldHint}>
                    Digite o nome para buscar em perfis ou digite o nome completo para inserir manualmente um
                    integrante. Ao informar o telefone, o nome pode ser preenchido automaticamente pelo perfil.
                  </Text>
                ) : null}
                <TextInput
                  style={styles.input}
                  placeholder="Nome completo (mín. 2 letras)"
                  placeholderTextColor="#64748b"
                  value={name}
                  autoCapitalize="words"
                  autoCorrect={false}
                  onChangeText={(value) => {
                    setName(value);
                    if (linkedProfile) {
                      setLinkedProfile(null);
                      setProfileLookupMessage(null);
                    }
                  }}
                />
                {!editingMemberId && nameSearchLoading ? (
                  <ActivityIndicator color="#10b981" style={styles.nameSearchLoader} />
                ) : null}
                {!editingMemberId && canSearchProfileByName(name) && !nameSearchLoading ? (
                  <ScrollView
                    style={styles.nameSearchResults}
                    nestedScrollEnabled
                    keyboardShouldPersistTaps="handled"
                  >
                    {nameSearchResults.length ? (
                      nameSearchResults.map((profile) => {
                        const isSelected = linkedProfile?.id === profile.id;

                        return (
                          <TouchableOpacity
                            key={profile.id}
                            style={[styles.nameSearchResultRow, isSelected && styles.nameSearchResultRowSelected]}
                            onPress={() => handleSelectProfileFromNameSearch(profile)}
                            activeOpacity={0.85}
                          >
                            <Text style={styles.nameSearchResultName}>
                              {formatShortName(profile.full_name)}
                            </Text>
                            <Text style={styles.nameSearchResultMeta}>
                              {[profile.phone, profile.family_id].filter(Boolean).join(' · ') ||
                                profile.full_name?.trim() ||
                                'Sem dados adicionais'}
                            </Text>
                          </TouchableOpacity>
                        );
                      })
                    ) : (
                      <Text style={styles.nameSearchEmpty}>
                        Nenhum usuário encontrado. Preencha os dados manualmente.
                      </Text>
                    )}
                  </ScrollView>
                ) : !editingMemberId ? (
                  <Text style={styles.nameSearchHint}>Digite pelo menos 2 letras para buscar.</Text>
                ) : null}
                {profileLookupMessage ? (
                  <Text
                    style={[
                      styles.profileLookupMessage,
                      linkedProfile ? styles.profileLookupMessageSuccess : styles.profileLookupMessageMuted,
                    ]}
                  >
                    {profileLookupMessage}
                  </Text>
                ) : null}

                <Text style={styles.fieldLabel}>Telefone</Text>
                <TextInput
                  style={styles.input}
                  placeholder="(00) 00000-0000"
                  keyboardType="phone-pad"
                  maxLength={15}
                  placeholderTextColor="#64748b"
                  value={phone}
                  onChangeText={(value) => {
                    setPhone(value);
                    if (linkedProfile) {
                      setLinkedProfile(null);
                      setProfileLookupMessage(null);
                    }
                  }}
                  onBlur={() => {
                    const formatted = formatPhone(phone);
                    setPhone(formatted);

                    if (
                      editingMemberId ||
                      linkedProfile ||
                      name.trim() ||
                      !canSearchProfileByPhone(formatted)
                    ) {
                      return;
                    }

                    void lookupProfileByPhoneForMember(formatted)
                      .then((profile) => {
                        if (!profile) {
                          return;
                        }

                        applyProfileToMemberForm(profile);
                        setProfileLookupMessage(
                          `Perfil encontrado pelo telefone: ${profile.full_name?.trim() || 'Sem nome'}.`
                        );
                      })
                      .catch((err: unknown) => {
                        console.error('Erro ao buscar perfil pelo telefone:', err);
                      });
                  }}
                />

                <Text style={styles.fieldLabel}>Nascimento</Text>
                <TextInput
                  style={styles.input}
                  placeholder="DD/MM/AAAA"
                  keyboardType="number-pad"
                  maxLength={10}
                  placeholderTextColor="#64748b"
                  value={birthDate}
                  onChangeText={(value) => setBirthDate(formatDate(value))}
                />

                <Text style={styles.fieldLabel}>Grau de parentesco</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scrollOptions}>
                  {OPCOES_PARENTESCO.map((opcao) => (
                    <TouchableOpacity
                      key={opcao}
                      style={[styles.option, parentesco === opcao && styles.optionSelected]}
                      onPress={() => setParentesco(opcao)}
                    >
                      <Text style={parentesco === opcao ? styles.optionTextSelected : styles.optionText}>
                        {opcao}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                {(!linkedProfile && !editingMemberId) || editingMemberId ? (
                  <MemberPhotoPicker
                    photoUri={pendingMemberPhoto}
                    onPhotoChange={setPendingMemberPhoto}
                    disabled={adding || deleting}
                  />
                ) : null}

                {editingMemberId ? (
                  <>
                    <Text style={styles.fieldLabel}>Restrições alimentares</Text>
                    <Text style={styles.fieldHint}>
                      Informe alergias, intolerâncias ou outras restrições do familiar.
                    </Text>
                    <TextInput
                      style={[styles.input, styles.multilineInput]}
                      placeholder="Ex.: sem lactose, alérgico a amendoim"
                      placeholderTextColor="#64748b"
                      value={medicalFoodAlerts}
                      onChangeText={setMedicalFoodAlerts}
                      multiline
                      numberOfLines={3}
                      textAlignVertical="top"
                    />
                  </>
                ) : null}

                {editingMemberId ? (
                  <View style={styles.memberFormSectionActions}>
                    <TouchableOpacity
                      style={styles.addButton}
                      onPress={addMember}
                      disabled={adding || deleting}
                    >
                      <Text style={styles.addButtonText}>
                        {adding ? '...' : 'SALVAR ALTERAÇÕES'}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.deleteMemberButton,
                        (adding || deleting) && styles.deleteMemberButtonDisabled,
                      ]}
                      onPress={() => void confirmDeleteEditingMember()}
                      disabled={adding || deleting}
                      activeOpacity={0.85}
                    >
                      <Text style={styles.deleteMemberButtonText}>
                        {deleting ? '...' : 'EXCLUIR INTEGRANTE'}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.cancelEditButton} onPress={resetForm}>
                      <Text style={styles.cancelEditButtonText}>Cancelar edição</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={styles.addButton}
                    onPress={addMember}
                    disabled={adding || deleting}
                  >
                    <Text style={styles.addButtonText}>
                      {adding ? '...' : 'ADICIONAR INTEGRANTE'}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
              ) : null}
            </View>

            <Text style={[styles.titleCentered, styles.membersListTitle]}>Integrantes Cadastrados</Text>
          </>
        }
        renderItem={({ item }) => {
          const memberId = String(item.id);
          const isAcceptPending = pendingAcceptedMemberIds.includes(memberId);

          const isEditingThisMember = editingMemberId !== null && String(item.id) === String(editingMemberId);

          return (
          <View style={[styles.memberRow, isEditingThisMember && styles.memberRowEditing]}>
            <View style={styles.memberRowMain}>
            {(() => {
              const birthDateElapsedCode = getBirthDateElapsedCode(item.birth_date);

              return (
                <View style={styles.memberContent} pointerEvents="box-none">
                  <View style={styles.memberNameRow}>
                    <Text style={styles.memberName}>{item.full_name}</Text>
                    {(() => {
                      const roomStatus = getMemberRoomStatus(item.birth_date, idadeKids, idadeTeens);

                      if (!roomStatus) {
                        return null;
                      }

                      return (
                        <View
                          style={[
                            styles.memberStatusDot,
                            roomStatus === 'KIDS' ? styles.memberStatusDotKids : styles.memberStatusDotTeens,
                          ]}
                        />
                      );
                    })()}
                  </View>
                  <Text style={styles.memberInfo}>
                    {item.family_id} • {item.relationship}
                  </Text>
                  <Text style={styles.memberInfo}>
                    {item.phone ? `${item.phone} ` : 'Sem telefone '}
                    {item.birth_date ? `• Nasc: ${formatDisplayDate(item.birth_date)}` : ''}
                  </Text>
                  {showVidaTmp && birthDateElapsedCode ? (
                    <Text style={styles.memberInfo}>Vida: {birthDateElapsedCode}</Text>
                  ) : null}
                </View>
              );
            })()}
            <View style={styles.memberActionsColumn}>
              <Pressable
                style={({ pressed }) => [
                  styles.acceptButton,
                  item.accepted === true && styles.acceptButtonChecked,
                  item.accepted === false && styles.acceptButtonUnchecked,
                  isAcceptPending && styles.acceptButtonPending,
                  pressed && !isAcceptPending && styles.acceptButtonPressed,
                ]}
                onPress={() => void handleToggleMemberAccepted(item)}
                hitSlop={8}
                accessibilityRole="checkbox"
                accessibilityState={{
                  checked: item.accepted === true,
                  disabled: isAcceptPending,
                }}
                accessibilityLabel={
                  item.accepted === true
                    ? `Integrante ${item.full_name} reconhecido como pertencente à família`
                    : item.accepted === false
                      ? `Integrante ${item.full_name} marcado como não pertencente à família`
                      : `Marcar ${item.full_name} como pertencente à família`
                }
              >
                {isAcceptPending ? (
                  <ActivityIndicator color="#10b981" size="small" />
                ) : item.accepted === true ? (
                  <MaterialIcons name="check" size={18} color="#0f172a" />
                ) : item.accepted === false ? (
                  <MaterialIcons name="close" size={16} color="#FCA5A5" />
                ) : (
                  <MaterialIcons name="check-box-outline-blank" size={20} color="#94A3B8" />
                )}
              </Pressable>
              <TouchableOpacity style={styles.editButton} onPress={() => startEditingMember(item)}>
                <MaterialIcons name="edit" size={18} color="#FFF" />
              </TouchableOpacity>
            </View>
            </View>
          </View>
          );
        }}
      />

      <View style={[styles.footerContainer, { paddingBottom: insets.bottom + 10 }]}>
        <TouchableOpacity style={styles.backButton} onPress={returnToCaller}>
          <Text style={styles.backButtonText}>Voltar</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  header: { padding: 20, paddingBottom: 0 },
  titleCentered: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFF',
    marginVertical: 10,
    textAlign: 'center',
  },
  readOnlyContainer: {
    backgroundColor: '#1e293b',
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#10b981',
  },
  readOnlyText: { color: '#10b981', fontWeight: 'bold', fontSize: 16 },
  membersList: {
    flex: 1,
  },
  memberFormSection: {
    backgroundColor: '#1e293b',
    borderRadius: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#334155',
    overflow: 'hidden',
  },
  memberFormSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 15,
    paddingVertical: 14,
  },
  memberFormSectionHeaderText: {
    flex: 1,
    paddingRight: 10,
  },
  memberFormSectionTitle: {
    color: '#E2E8F0',
    fontSize: 15,
    fontWeight: '800',
  },
  memberFormSectionMeta: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 2,
  },
  memberFormSectionBody: {
    paddingHorizontal: 15,
    paddingTop: 12,
    paddingBottom: 15,
  },
  memberFormSectionActions: {
    paddingHorizontal: 15,
    paddingTop: 4,
    paddingBottom: 15,
    gap: 10,
  },
  fieldLabel: {
    color: '#CBD5E1',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 6,
  },
  fieldHint: {
    color: '#94A3B8',
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 8,
  },
  nameSearchLoader: {
    marginBottom: 8,
  },
  nameSearchResults: {
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 10,
    marginBottom: 12,
    maxHeight: 180,
    overflow: 'hidden',
  },
  nameSearchResultRow: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  nameSearchResultRowSelected: {
    backgroundColor: 'rgba(16, 185, 129, 0.14)',
  },
  nameSearchResultName: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '700',
  },
  nameSearchResultMeta: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 2,
  },
  nameSearchEmpty: {
    color: '#94A3B8',
    fontSize: 12,
    lineHeight: 17,
    padding: 12,
  },
  nameSearchHint: {
    color: '#94A3B8',
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 12,
  },
  profileLookupMessage: {
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 12,
  },
  profileLookupMessageSuccess: {
    color: '#86EFAC',
    fontWeight: '600',
  },
  profileLookupMessageMuted: {
    color: '#94A3B8',
  },
  membersListTitle: {
    marginTop: 4,
    marginBottom: 8,
  },
  multilineInput: {
    minHeight: 96,
    paddingTop: 14,
    paddingBottom: 14,
  },
  input: {
    backgroundColor: '#0f172a',
    color: '#FFF',
    padding: 15,
    borderRadius: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  scrollOptions: { marginBottom: 12, maxHeight: 50 },
  option: {
    paddingHorizontal: 15,
    paddingVertical: 10,
    backgroundColor: '#0f172a',
    borderRadius: 20,
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  optionSelected: { backgroundColor: '#10b981', borderColor: '#10b981' },
  optionText: { color: '#FFF' },
  optionTextSelected: { color: '#FFF', fontWeight: 'bold' },
  addButton: {
    backgroundColor: '#10b981',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 4,
  },
  addButtonText: { color: '#FFF', fontWeight: 'bold' },
  deleteMemberButton: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderWidth: 1,
    borderColor: '#EF4444',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 0,
  },
  deleteMemberButtonDisabled: {
    opacity: 0.6,
  },
  deleteMemberButtonText: {
    color: '#FCA5A5',
    fontWeight: 'bold',
  },
  editingBanner: {
    backgroundColor: 'rgba(16, 185, 129, 0.14)',
    borderWidth: 1,
    borderColor: '#10b981',
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    gap: 10,
  },
  editingBannerText: {
    color: '#D1FAE5',
    fontWeight: '700',
    textAlign: 'center',
  },
  cancelEditButton: {
    backgroundColor: '#334155',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  cancelEditButtonText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
  },
  memberRow: {
    padding: 15,
    backgroundColor: '#1e293b',
    borderRadius: 10,
    marginVertical: 5,
    flexDirection: 'column',
  },
  memberRowEditing: {
    borderWidth: 1,
    borderColor: '#10b981',
    backgroundColor: '#1a2e44',
  },
  memberRowMain: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  memberRowEditActions: {
    marginTop: 12,
    gap: 8,
  },
  memberRowSaveButton: {
    backgroundColor: '#10b981',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  memberRowSaveButtonText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 13,
  },
  memberRowDeleteButton: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderWidth: 1,
    borderColor: '#EF4444',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  memberRowDeleteButtonText: {
    color: '#FCA5A5',
    fontWeight: '700',
    fontSize: 13,
  },
  memberRowActionDisabled: {
    opacity: 0.6,
  },
  memberContent: {
    flex: 1,
    minWidth: 0,
    marginRight: 8,
  },
  memberName: { color: '#FFF', fontWeight: 'bold', fontSize: 15 },
  memberNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  memberStatusDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
    flexShrink: 0,
  },
  memberStatusDotKids: {
    backgroundColor: '#FACC15',
  },
  memberStatusDotTeens: {
    backgroundColor: '#EF4444',
  },
  memberInfo: { color: '#94A3B8', fontSize: 12 },
  memberActionsColumn: {
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
    zIndex: 2,
    elevation: 2,
  },
  acceptButton: {
    width: 34,
    height: 34,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#94A3B8',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0f172a',
  },
  acceptButtonPressed: {
    opacity: 0.85,
  },
  acceptButtonPending: {
    borderColor: '#10b981',
    opacity: 0.9,
  },
  acceptButtonChecked: {
    borderColor: '#10b981',
    backgroundColor: '#10b981',
  },
  acceptButtonUnchecked: {
    borderColor: '#EF4444',
    backgroundColor: 'rgba(239, 68, 68, 0.18)',
  },
  editButton: {
    backgroundColor: '#0EA5E9',
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerContainer: {
    backgroundColor: '#0f172a',
    paddingHorizontal: 20,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  backButton: {
    backgroundColor: '#334155',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#475569',
  },
  backButtonText: { color: '#FFF', fontWeight: 'bold', fontSize: 14 },
});
