import { MembersClass } from '@/components/MembersClass';
import { ScreenAccessGate } from '@/components/ScreenAccessGate';
import { refreshEventRegistrationKidsStatus } from '@/lib/refreshEventRegistrationKidsStatus';
import { confirmDialog } from '@/lib/confirmDialog';
import { attachSelfieToManagedMemberProfile } from '@/lib/managedMemberSelfie';
import { detachMemberFromFamilyWithNewCode } from '@/lib/detachMemberFromFamily';
import {
  applyNewFamilyCodeForRejectedMember,
  findMemberForFamilyTransfer,
} from '@/lib/rejectedMemberFamilyCode';
import { acceptMemberIntoFamily } from '@/lib/acceptMemberIntoFamily';
import { syncManagedMemberProfileFamilyWithFallback } from '@/lib/syncManagedMemberProfileFamily';
import { upsertFamilyMember } from '@/lib/upsertFamilyMember';
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
import {
  hasAnyProfileAddress,
  inheritFamilyAddressToAcceptedMember,
  loadAcceptorAddressForFamilyScreen,
  resolveAcceptorAuthUserId,
} from '@/lib/inheritFamilyAddress';
import { formatFullName } from '@/lib/fullName';
import {
  ensureProfilesForMembers,
  findProfileIdForMember,
  upsertProfileForManagedMember,
} from '@/lib/memberProfiles';
import { ACCESS_SCREEN, sessionHasAccess } from '@/lib/accessControl';
import { normalizeFamilyCode } from '@/lib/family';
import { MEMBER_ACCEPTED_VALUE } from '@/lib/membersAccepted';
import { resolveSelfiePreviewUrl } from '@/lib/selfie';
import { supabase } from '@/lib/supabase';
import { useReturnToCallerOnLeave } from '@/hooks/useReturnToCallerOnLeave';
import { useScreenAccessGuard } from '@/hooks/useScreenAccessGuard';
import { resolveReturnDashboardCardParam, resolveReturnRouteParam } from '@/lib/dashboardReturnNavigation';
import { useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, FlatList } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ALREADY_IN_FAMILY_TOAST_MESSAGE,
  SELF_MEMBER_BLOCK_MESSAGE,
  convertDateToISO,
  formatDate,
  formatDisplayDate,
  formatPhone,
  loadManageMembersData,
  normalizeMemberName,
  phoneDigitsMatch,
  showFamilyInconsistencyToast,
  showFamilyWarningToast,
  type ManagedMember,
  type ManageMembersData,
} from '@/lib/manageMembers/shared';


export type MembersClassPanelProps = {
  embedded?: boolean;
  phoneParam?: string | null;
  returnRoute?: string | null;
  returnDashboardCard?: string | null;
  onBack?: () => void;
};

export function MembersClassPanel({
  embedded = false,
  phoneParam: phoneParamProp,
  returnRoute: returnRouteProp,
  returnDashboardCard: returnDashboardCardProp,
  onBack,
}: MembersClassPanelProps) {
  const insets = useSafeAreaInsets();
  const isEmbeddedOverlay = embedded && Boolean(onBack);
  const params = useLocalSearchParams();
  const phoneParam = isEmbeddedOverlay
    ? phoneParamProp ?? null
    : phoneParamProp ?? (params.phone ? decodeURIComponent(params.phone as string) : null);
  const returnDashboardCard = isEmbeddedOverlay
    ? null
    : returnDashboardCardProp ?? resolveReturnDashboardCardParam(params);
  const explicitReturnRoute = isEmbeddedOverlay
    ? null
    : returnRouteProp ?? resolveReturnRouteParam(params);
  const returnRoute = isEmbeddedOverlay
    ? null
    : explicitReturnRoute ?? (returnDashboardCard ? null : '/perfil');
  const returnToCaller = useReturnToCallerOnLeave(
    onBack
      ? { returnRoute: null, returnDashboardCard: null, managedByParent: true }
      : {
          returnRoute,
          returnDashboardCard,
          extraRouteParams: phoneParam ? { phone: encodeURIComponent(phoneParam) } : undefined,
        }
  );
  const handleLeaveScreen = useCallback(() => {
    if (onBack) {
      onBack();
      return;
    }
    returnToCaller();
  }, [onBack, returnToCaller]);

  const accessStatus = useScreenAccessGuard({
    resourceKey: ACCESS_SCREEN.manageMembers,
    deniedMessage: 'Você não tem permissão para abrir Gerenciar família.',
    enabled: !embedded,
    skipCheck: embedded,
  });
  const listRef = useRef<FlatList<ManagedMember>>(null);
  const [canUpdateFamilyMembers, setCanUpdateFamilyMembers] = useState(false);

  useEffect(() => {
    void (async () => {
      const [tableUpdate, screenManageUpdate, screenManageView] = await Promise.all([
        sessionHasAccess('table', 'members', 'update'),
        sessionHasAccess('screen', ACCESS_SCREEN.manageMembers, 'update'),
        sessionHasAccess('screen', ACCESS_SCREEN.manageMembers, 'view'),
      ]);

      // Membro/representante legal: RLS limita à própria família; o ACL de `member` só tinha view.
      setCanUpdateFamilyMembers(tableUpdate || screenManageUpdate || screenManageView);
    })();
  }, []);

  const [familyId, setFamilyId] = useState('');
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
    setName(formatFullName(profile.full_name));
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
    setName(formatFullName(member.full_name));
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

    const normalizedName = formatFullName(name || resolvedLinkedProfile?.full_name || '');

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

        await refreshEventRegistrationKidsStatus(
          resolvedLinkedProfile?.id ?? profileIdForEdit,
          birthIso
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

        await refreshEventRegistrationKidsStatus(
          resolvedLinkedProfile?.id ?? profileIdForAction,
          birthIso
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

      const upsertedMember = await upsertFamilyMember(memberPayload);

      const addressInherited = await copyAcceptorAddressToMember(
        {
          id: upsertedMember.id,
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

      await refreshEventRegistrationKidsStatus(
        resolvedLinkedProfile?.id ?? profileIdForAction,
        birthIso
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

  const handleNameBlur = useCallback(() => {
    setName((current) => formatFullName(current));
  }, []);

  const handlePhoneBlur = useCallback(() => {
    const formatted = phone.trim() ? formatPhone(phone) : '';
    if (formatted !== phone) {
      setPhone(formatted);
    }

    if (editingMemberId || linkedProfile || name.trim() || !canSearchProfileByPhone(formatted)) {
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
  }, [applyProfileToMemberForm, editingMemberId, linkedProfile, name, phone]);

  const membersClassNode = (
    <MembersClass
      embedded={embedded}
      insetsBottom={insets.bottom}
      listRef={listRef}
      familyId={familyId}
      members={members}
      editingMemberId={editingMemberId}
      memberFormSectionExpanded={memberFormSectionExpanded}
      onToggleMemberFormSection={() => setMemberFormSectionExpanded((open) => !open)}
      name={name}
      onNameChange={(value) => {
        setName(value);
        if (linkedProfile) {
          setLinkedProfile(null);
          setProfileLookupMessage(null);
        }
      }}
      onNameBlur={handleNameBlur}
      nameSearchLoading={nameSearchLoading}
      nameSearchResults={nameSearchResults}
      linkedProfile={linkedProfile}
      profileLookupMessage={profileLookupMessage}
      onSelectProfileFromNameSearch={handleSelectProfileFromNameSearch}
      phone={phone}
      onPhoneChange={(value) => {
        const formatted = formatPhone(value);
        setPhone(formatted);
        if (linkedProfile) {
          setLinkedProfile(null);
          setProfileLookupMessage(null);
        }
      }}
      onPhoneBlur={handlePhoneBlur}
      birthDate={birthDate}
      onBirthDateChange={(value) => setBirthDate(formatDate(value))}
      parentesco={parentesco}
      onParentescoChange={setParentesco}
      pendingMemberPhoto={pendingMemberPhoto}
      onPendingMemberPhotoChange={setPendingMemberPhoto}
      medicalFoodAlerts={medicalFoodAlerts}
      onMedicalFoodAlertsChange={setMedicalFoodAlerts}
      adding={adding}
      deleting={deleting}
      canUpdateFamilyMembers={canUpdateFamilyMembers}
      onAddMember={addMember}
      onConfirmDeleteEditingMember={() => void confirmDeleteEditingMember()}
      onResetForm={resetForm}
      idadeKids={idadeKids}
      idadeTeens={idadeTeens}
      showVidaTmp={showVidaTmp}
      pendingAcceptedMemberIds={pendingAcceptedMemberIds}
      onToggleMemberAccepted={(member) => void handleToggleMemberAccepted(member)}
      onStartEditingMember={startEditingMember}
      onLeaveScreen={handleLeaveScreen}
    />
  );

  if (embedded) {
    return membersClassNode;
  }

  return <ScreenAccessGate status={accessStatus}>{membersClassNode}</ScreenAccessGate>;
}
