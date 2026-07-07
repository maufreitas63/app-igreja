import { ProfileClass } from '@/components/ProfileClass';
import { MaterialIcons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useReturnToCallerOnLeave } from '@/hooks/useReturnToCallerOnLeave';
import { resolveReturnDashboardCardParam, resolveReturnRouteParam, withReturnDashboardCard } from '@/lib/dashboardReturnNavigation';
import { useGhostMode } from '@/context/GhostModeContext';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  ActivityIndicator,
  Keyboard,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { changePhoneEverywhere } from '@/lib/changePhone';
import { confirmDialog } from '@/lib/confirmDialog';
import {
  deleteSelfieFile,
  hasExistingSelfieRecord,
  pickSelfieFromWeb,
  resolveSelfiePreviewUrl,
  resolveSelfieStorageFileName,
  saveProfileSelfieUrl,
  selectSelfiePictureSize,
  uploadSelfieInput,
} from '@/lib/selfie';
import { invalidateProfilesMapSnapshot, PROFILE_GEO_FIELDS } from '@/lib/profilesMapCache';
import { syncProfileAddressFromCep } from '@/lib/syncProfileAddressFromCep';
import { formatFullName } from '@/lib/fullName';
import {
  buildAppIndexRoute,
  buildDashboardFamilyAgendaRoute,
  buildRegisterRoute,
  isPlaceholderVisitorName,
  isProfileIncompleteForOnboarding,
  isProfilePendingSelfRegistration,
} from '@/lib/profileOnboarding';
import { isLgpdAtivoEnabled, isProfileLgpdPending } from '@/lib/appParameters';
import { reconcileRejectedMemberFamilyCode } from '@/lib/rejectedMemberFamilyCode';
import { ACCESS_PIN_LENGTH, isValidAccessPin, updateProfileAccessPin } from '@/lib/accessPin';
import { buildPhoneDbQueryVariants } from '@/lib/phoneDbVariants';
import { resolveEffectiveProfileId } from '@/lib/sessionProfile';
import { supabase } from '@/lib/supabase';
import {
  ACCESS_SCREEN,
  canUpdateProfileColumn,
  canViewProfileColumn,
  isProfileColumnAccessLoaded,
  loadProfileColumnAccess,
  sessionHasAccess,
  type ProfileColumnAccess,
} from '@/lib/accessControl';
import {
  AccessPinField,
  DEFAULT_EXPANDED_SECTIONS,
  ONBOARDING_EXPANDED_SECTIONS,
  buildFieldRows,
  buildSections,
  formatBooleanValue,
  formatDisplayDateLike,
  formatCep,
  formatDate,
  formatPhone,
  loadProfile,
  normalizeCep,
  normalizePhone,
  parseBooleanInput,
  toIsoDate,
  type ProfileFieldRow,
  type ProfileRecord,
  type ProfileSectionKey,
  type ProfileVehicle,
} from '@/lib/manageProfile/shared';
import { profileClassStyles } from '@/lib/manageProfile/profileClassStyles';

export type ProfileClassPanelProps = {
  embedded?: boolean;
  phoneParam?: string | null;
  returnRoute?: string | null;
  returnDashboardCard?: string | null;
  isOnboardingFlow?: boolean;
  isRecoveryAccessPinFlow?: boolean;
  recoveryPinParam?: string;
  onBack?: () => void;
};

export function ProfileClassPanel({
  embedded = false,
  phoneParam: phoneParamProp,
  returnRoute: returnRouteProp,
  returnDashboardCard: returnDashboardCardProp,
  isOnboardingFlow: isOnboardingFlowProp,
  isRecoveryAccessPinFlow: isRecoveryAccessPinFlowProp,
  recoveryPinParam: recoveryPinParamProp,
  onBack,
}: ProfileClassPanelProps) {
  const router = useRouter();
  const { isActive: ghostModeActive, state: ghostModeState } = useGhostMode();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();
  const phoneParam = phoneParamProp ?? (params.phone ? decodeURIComponent(params.phone as string) : null);
  const returnDashboardCard = returnDashboardCardProp ?? resolveReturnDashboardCardParam(params);
  const explicitReturnRoute = returnRouteProp ?? resolveReturnRouteParam(params);
  const returnRoute = explicitReturnRoute ?? (returnDashboardCard ? null : '/perfil');
  const returnToCaller = useReturnToCallerOnLeave(
    onBack
      ? { returnRoute: null, returnDashboardCard: null }
      : {
          returnRoute,
          returnDashboardCard,
          extraRouteParams: phoneParam ? { phone: encodeURIComponent(phoneParam) } : undefined,
        }
  );
  const isOnboardingFlow = isOnboardingFlowProp ?? params.onboarding === '1';
  const isRecoveryAccessPinFlow = isRecoveryAccessPinFlowProp ?? params.changeAccessPinAfterRecovery === '1';
  const recoveryPinParam = recoveryPinParamProp ?? (params.recoveryPin ? decodeURIComponent(String(params.recoveryPin)) : '');
  const scrollRef = useRef<ScrollView>(null);
  const profileRef = useRef<ProfileRecord | null>(null);
  const lastProfileFetchAtRef = useRef(0);
  const PROFILE_FOCUS_STALE_MS = 60_000;
  const onboardingAlertShownRef = useRef(false);
  const recoveryAccessPinInitializedRef = useRef(false);
  const cameraRef = useRef<CameraView>(null);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();

  const [profile, setProfile] = useState<ProfileRecord | null>(null);
  const [lgpdModuleActive, setLgpdModuleActive] = useState(true);
  const [profileColumnAccess, setProfileColumnAccess] = useState<ProfileColumnAccess>({
    view: {},
    update: {},
  });
  const [columnAccessLoading, setColumnAccessLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [lookingUpCep, setLookingUpCep] = useState(false);
  const lastCepLookupRef = useRef<string | null>(null);
  const [screenMode, setScreenMode] = useState<'FORM' | 'CAMERA'>('FORM');
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [pictureSize, setPictureSize] = useState<string | null>(null);
  const [selfiePreviewUrl, setSelfiePreviewUrl] = useState<string | null>(null);
  const [selfiePreviewKey, setSelfiePreviewKey] = useState(0);
  const [isSelfieLoading, setIsSelfieLoading] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Record<ProfileSectionKey, boolean>>(DEFAULT_EXPANDED_SECTIONS);
  const [vehicles, setVehicles] = useState<ProfileVehicle[]>([]);
  const [loadingVehicles, setLoadingVehicles] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<ProfileVehicle | null>(null);
  const [isVehicleEditorVisible, setIsVehicleEditorVisible] = useState(false);
  const [vehicleForm, setVehicleForm] = useState({
    placa: '',
    marca: '',
    modelo: '',
    cor: '',
  });
  const [savingVehicle, setSavingVehicle] = useState(false);
  const [deletingVehicleId, setDeletingVehicleId] = useState<string | null>(null);
  // const [familySearchInput, setFamilySearchInput] = useState('');
  // const [familyNameSearchResults, setFamilyNameSearchResults] = useState<FamilySearchByNameResult[]>([]);
  // const [searchedFamilyId, setSearchedFamilyId] = useState('');
  // const [selectedFamilyMemberId, setSelectedFamilyMemberId] = useState<string | null>(null);
  // const [searchingFamily, setSearchingFamily] = useState(false);
  // const [requestingFamilyLink, setRequestingFamilyLink] = useState(false);
  const [currentAccessPin, setCurrentAccessPin] = useState('');
  const [newAccessPin, setNewAccessPin] = useState('');
  const [confirmAccessPin, setConfirmAccessPin] = useState('');
  const [savingAccessPin, setSavingAccessPin] = useState(false);
  const [accessPinSectionExpanded, setAccessPinSectionExpanded] = useState(
    () => isRecoveryAccessPinFlow
  );
  const [securityQuestionSectionExpanded, setSecurityQuestionSectionExpanded] = useState(false);
  const [showCurrentAccessPin, setShowCurrentAccessPin] = useState(false);
  const [showNewAccessPin, setShowNewAccessPin] = useState(false);
  const [showConfirmAccessPin, setShowConfirmAccessPin] = useState(false);
  const currentAccessPinRef = useRef<TextInput>(null);
  const newAccessPinRef = useRef<TextInput>(null);
  const confirmAccessPinRef = useRef<TextInput>(null);
  const saveAccessPinRef = useRef<View>(null);
  const accessPinSectionScrollYRef = useRef(0);
  const accessPinScrollLockYRef = useRef(0);

  const lockAccessPinScrollPosition = useCallback(() => {
    scrollRef.current?.scrollTo({
      y: accessPinScrollLockYRef.current,
      animated: false,
    });
  }, []);

  const scrollAccessPinSectionToTop = useCallback(() => {
    const y = Math.max(0, accessPinSectionScrollYRef.current);
    accessPinScrollLockYRef.current = y;
    scrollRef.current?.scrollTo({ y, animated: true });
  }, []);

  const toggleAccessPinSection = useCallback(() => {
    if (isRecoveryAccessPinFlow) {
      return;
    }

    setAccessPinSectionExpanded((open) => {
      if (open) {
        currentAccessPinRef.current?.blur();
        newAccessPinRef.current?.blur();
        confirmAccessPinRef.current?.blur();
      }

      return !open;
    });
  }, [isRecoveryAccessPinFlow]);

  useEffect(() => {
    if (!accessPinSectionExpanded) {
      return;
    }

    const frame = requestAnimationFrame(() => {
      requestAnimationFrame(scrollAccessPinSectionToTop);
    });

    return () => cancelAnimationFrame(frame);
  }, [accessPinSectionExpanded, scrollAccessPinSectionToTop]);

  useEffect(() => {
    if (!accessPinSectionExpanded) {
      return;
    }

    const lockAfterKeyboard = () => {
      requestAnimationFrame(lockAccessPinScrollPosition);
    };

    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvent, lockAfterKeyboard);
    const hideSub = Keyboard.addListener(hideEvent, lockAfterKeyboard);

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [accessPinSectionExpanded, lockAccessPinScrollPosition]);

  const scheduleAccessPinScrollLock = useCallback(() => {
    requestAnimationFrame(() => {
      requestAnimationFrame(lockAccessPinScrollPosition);
    });
  }, [lockAccessPinScrollPosition]);

  const focusSaveAccessPinButton = useCallback(() => {
    confirmAccessPinRef.current?.blur();
    requestAnimationFrame(() => {
      const saveButton = saveAccessPinRef.current as (View & { focus?: () => void }) | null;
      saveButton?.focus?.();
      lockAccessPinScrollPosition();
    });
  }, [lockAccessPinScrollPosition]);

  const handleAccessPinFieldChange = useCallback(
    (
      text: string,
      setter: React.Dispatch<React.SetStateAction<string>>,
      nextRef?: React.RefObject<TextInput | null>,
      onComplete?: () => void
    ) => {
      const digits = text.replace(/\D/g, '').slice(0, ACCESS_PIN_LENGTH);
      setter(digits);
      if (digits.length !== ACCESS_PIN_LENGTH) {
        return;
      }
      if (nextRef?.current) {
        nextRef.current.focus();
        scheduleAccessPinScrollLock();
        return;
      }
      onComplete?.();
      scheduleAccessPinScrollLock();
    },
    [scheduleAccessPinScrollLock]
  );

  // const currentFamilyId = useMemo(() => {
  //   const raw = profile?.family_id ?? profile?.codigo_membro;
  //   return raw ? String(raw).trim() : '';
  // }, [profile?.family_id, profile?.codigo_membro]);

  // const isSearchedFamilySameAsCurrent = useMemo(() => {
  //   if (!searchedFamilyId || !currentFamilyId) {
  //     return false;
  //   }

  //   return normalizeFamilyCode(searchedFamilyId) === normalizeFamilyCode(currentFamilyId);
  // }, [currentFamilyId, searchedFamilyId]);

  // const {
  //   members: familyMembers,
  //   loading: loadingFamilyMembers,
  //   refetch: refetchFamilyMembers,
  // } = useFamilyMembers(searchedFamilyId);

  const profileFields = useMemo(() => {
    const rows = buildFieldRows(profile);

    if (columnAccessLoading || !isProfileColumnAccessLoaded(profileColumnAccess)) {
      return [];
    }

    return rows
      .filter((field) => canViewProfileColumn(field.key, profileColumnAccess))
      .map((field) => ({
        ...field,
        readOnly:
          field.readOnly || !canUpdateProfileColumn(field.key, profileColumnAccess),
      }));
  }, [columnAccessLoading, profile, profileColumnAccess]);
  const profileSections = useMemo(() => buildSections(profileFields), [profileFields]);
  const canViewAccessPinSection = canViewProfileColumn('access_pin', profileColumnAccess);
  const canUpdateAccessPin = canUpdateProfileColumn('access_pin', profileColumnAccess);
  const showAccessPinSection =
    Boolean(profile) && (canViewAccessPinSection || isRecoveryAccessPinFlow);
  const canUseAccessPinForm = canUpdateAccessPin || isRecoveryAccessPinFlow;
  const editingFieldRow = useMemo(
    () => profileFields.find((field) => field.key === editingField) ?? null,
    [editingField, profileFields]
  );

  const profilePhoneForAccessPin = useMemo(() => {
    const fromProfile = profile?.phone;
    if (typeof fromProfile === 'string' && fromProfile.trim()) {
      return fromProfile.trim();
    }

    return phoneParam?.trim() ?? '';
  }, [phoneParam, profile?.phone]);

  const accessPinConfirmMismatch = useMemo(
    () =>
      isValidAccessPin(newAccessPin)
      && isValidAccessPin(confirmAccessPin)
      && newAccessPin !== confirmAccessPin,
    [confirmAccessPin, newAccessPin]
  );

  const accessPinSameAsCurrent = useMemo(
    () =>
      isValidAccessPin(currentAccessPin)
      && isValidAccessPin(newAccessPin)
      && currentAccessPin === newAccessPin,
    [currentAccessPin, newAccessPin]
  );

  const accessPinValidationMessage = useMemo(() => {
    if (accessPinConfirmMismatch) {
      return 'A nova senha e a confirmação não conferem.';
    }

    if (accessPinSameAsCurrent) {
      return 'A nova senha deve ser diferente da atual.';
    }

    return null;
  }, [accessPinConfirmMismatch, accessPinSameAsCurrent]);

  const resetAccessPinForm = useCallback(() => {
    setCurrentAccessPin('');
    setNewAccessPin('');
    setConfirmAccessPin('');
    setShowCurrentAccessPin(false);
    setShowNewAccessPin(false);
    setShowConfirmAccessPin(false);
  }, []);

  const renderAccessPinFormFields = () => (
    <>
      <AccessPinField
        label={
          isRecoveryAccessPinFlow
            ? 'Senha atual (enviada por e-mail)'
            : 'Senha atual'
        }
        value={currentAccessPin}
        onChangeText={(text) => {
          if (isRecoveryAccessPinFlow) {
            return;
          }

          handleAccessPinFieldChange(text, setCurrentAccessPin, newAccessPinRef);
        }}
        inputRef={currentAccessPinRef}
        visible={showCurrentAccessPin}
        onToggleVisible={() => setShowCurrentAccessPin((open) => !open)}
        editable={canUseAccessPinForm && !savingAccessPin && !isRecoveryAccessPinFlow}
        allowVisibilityToggle={isRecoveryAccessPinFlow}
        onFocus={lockAccessPinScrollPosition}
        onSubmitEditing={() => {
          newAccessPinRef.current?.focus();
          scheduleAccessPinScrollLock();
        }}
        blurOnSubmit={false}
        returnKeyType="next"
      />

      <AccessPinField
        label="Nova senha"
        value={newAccessPin}
        onChangeText={(text) =>
          handleAccessPinFieldChange(text, setNewAccessPin, confirmAccessPinRef)
        }
        inputRef={newAccessPinRef}
        visible={showNewAccessPin}
        onToggleVisible={() => setShowNewAccessPin((open) => !open)}
        editable={canUseAccessPinForm && !savingAccessPin}
        hasError={accessPinConfirmMismatch || accessPinSameAsCurrent}
        onFocus={lockAccessPinScrollPosition}
        onSubmitEditing={() => {
          confirmAccessPinRef.current?.focus();
          scheduleAccessPinScrollLock();
        }}
        blurOnSubmit={false}
        returnKeyType="next"
      />

      <AccessPinField
        label="Confirmar nova senha"
        value={confirmAccessPin}
        onChangeText={(text) =>
          handleAccessPinFieldChange(text, setConfirmAccessPin, undefined, focusSaveAccessPinButton)
        }
        inputRef={confirmAccessPinRef}
        visible={showConfirmAccessPin}
        onToggleVisible={() => setShowConfirmAccessPin((open) => !open)}
        editable={canUseAccessPinForm && !savingAccessPin}
        hasError={accessPinConfirmMismatch}
        onFocus={lockAccessPinScrollPosition}
        onSubmitEditing={focusSaveAccessPinButton}
        returnKeyType="done"
      />

      <View style={profileClassStyles.accessPinErrorSlot}>
        <Text
          style={[
            profileClassStyles.accessPinErrorText,
            !accessPinValidationMessage && profileClassStyles.accessPinErrorTextPlaceholder,
          ]}
          numberOfLines={2}
        >
          {accessPinValidationMessage ?? ' '}
        </Text>
      </View>

      <TouchableOpacity
        ref={saveAccessPinRef}
        focusable={canUseAccessPinForm && !savingAccessPin}
        style={[
          profileClassStyles.accessPinSaveButton,
          (savingAccessPin || accessPinValidationMessage || !canUseAccessPinForm)
            && profileClassStyles.disabledButton,
        ]}
        onPress={() => void handleSaveAccessPin()}
        disabled={
          !canUseAccessPinForm || savingAccessPin || Boolean(accessPinValidationMessage)
        }
      >
        {savingAccessPin ? (
          <ActivityIndicator color="#FFF" />
        ) : (
          <Text style={profileClassStyles.saveButtonText}>Salvar nova senha</Text>
        )}
      </TouchableOpacity>
    </>
  );

  const handleSaveAccessPin = useCallback(async () => {
    if (!canUseAccessPinForm) {
      Alert.alert('Campo protegido', 'Você não tem permissão para alterar a senha de acesso.');
      return;
    }

    if (!profilePhoneForAccessPin) {
      Alert.alert('Atenção', 'Telefone do perfil não encontrado.');
      return;
    }

    if (!isValidAccessPin(currentAccessPin)) {
      Alert.alert('Atenção', 'Informe a senha atual com 4 dígitos.');
      return;
    }

    if (!isValidAccessPin(newAccessPin)) {
      Alert.alert('Atenção', 'A nova senha deve ter 4 dígitos.');
      return;
    }

    if (accessPinConfirmMismatch) {
      Alert.alert('Senhas diferentes', 'A nova senha e a confirmação não coincidem. Corrija e tente novamente.');
      return;
    }

    if (accessPinValidationMessage) {
      return;
    }

    setSavingAccessPin(true);

    try {
      const result = await updateProfileAccessPin(
        profilePhoneForAccessPin,
        currentAccessPin,
        newAccessPin
      );

      if (!result.ok) {
        Alert.alert('Não foi possível alterar', result.message);
        return;
      }

      if (isRecoveryAccessPinFlow) {
        const phoneForIndex = profilePhoneForAccessPin.trim();
        resetAccessPinForm();
        router.replace(buildAppIndexRoute(phoneForIndex));
        return;
      }

      resetAccessPinForm();
      Alert.alert('Senha atualizada', 'Use a nova senha de 4 dígitos na próxima entrada.');
    } finally {
      setSavingAccessPin(false);
    }
  }, [
    accessPinConfirmMismatch,
    accessPinValidationMessage,
    canUseAccessPinForm,
    confirmAccessPin,
    currentAccessPin,
    isRecoveryAccessPinFlow,
    newAccessPin,
    profilePhoneForAccessPin,
    resetAccessPinForm,
    router,
  ]);

  const handleLeaveScreen = useCallback(() => {
    if (isRecoveryAccessPinFlow) {
      Alert.alert(
        'Defina sua nova senha',
        'Escolha uma senha de 4 dígitos, confirme nos dois campos e toque em Salvar nova senha para continuar.'
      );
      return;
    }

    if (onBack) {
      onBack();
      return;
    }

    returnToCaller();
  }, [isRecoveryAccessPinFlow, onBack, returnToCaller]);

  const loadVehicles = useCallback(
    async (phone: string | null | undefined) => {
      const normalizedPhone = phone ? String(phone).trim() : '';

      if (!normalizedPhone) {
        setVehicles([]);
        return;
      }

      setLoadingVehicles(true);

      try {
        const phoneVariants = buildPhoneDbQueryVariants(normalizedPhone);
        const { data, error } = await supabase
          .from('profile_vehicles')
          .select('id, phone, placa, marca, modelo, cor')
          .in('phone', phoneVariants.length ? phoneVariants : [normalizedPhone])
          .order('placa', { ascending: true });

        if (error) {
          throw error;
        }

        setVehicles(data ?? []);
      } catch (error) {
        console.error('Erro ao carregar veiculos do perfil:', error);
        setVehicles([]);
      } finally {
        setLoadingVehicles(false);
      }
    },
    []
  );

  useEffect(() => {
    profileRef.current = profile;
  }, [profile]);

  useEffect(() => {
    lastProfileFetchAtRef.current = 0;
    profileRef.current = null;
  }, [ghostModeActive, ghostModeState?.targetProfileId, phoneParam]);

  const fetchProfile = useCallback(
    async (options?: { force?: boolean }) => {
      const force = options?.force === true;

      if (
        !force
        && profileRef.current
        && lastProfileFetchAtRef.current > 0
        && Date.now() - lastProfileFetchAtRef.current < PROFILE_FOCUS_STALE_MS
        && (!ghostModeActive || profileRef.current.id === ghostModeState?.targetProfileId)
      ) {
        return;
      }

      setLoading(true);

      try {
        const loadedProfile = await loadProfile(phoneParam);
        const nextProfile = loadedProfile
          ? await reconcileRejectedMemberFamilyCode(loadedProfile)
          : null;
        setProfile(nextProfile);
        profileRef.current = nextProfile;
        lastProfileFetchAtRef.current = Date.now();

        setColumnAccessLoading(true);

        if (nextProfile?.id) {
          const columnAccess = await loadProfileColumnAccess(String(nextProfile.id));
          setProfileColumnAccess(columnAccess);
        } else {
          setProfileColumnAccess({ view: {}, update: {} });
        }
      } finally {
        setColumnAccessLoading(false);
        setLoading(false);
      }
    },
    [ghostModeActive, ghostModeState?.targetProfileId, phoneParam]
  );

  useFocusEffect(
    useCallback(() => {
      let active = true;

      void (async () => {
        try {
          const lgpdAtivo = await isLgpdAtivoEnabled();

          if (active) {
            setLgpdModuleActive(lgpdAtivo);
          }
        } catch (error) {
          console.error('Erro ao carregar LGPD_Ativo:', error);
        }
      })();

      return () => {
        active = false;
      };
    }, [])
  );

  useFocusEffect(
    useCallback(() => {
      let active = true;

      void (async () => {
        if (isRecoveryAccessPinFlow) {
          await fetchProfile();
          return;
        }

        const allowed = await sessionHasAccess('screen', ACCESS_SCREEN.manageProfile, 'view');

        if (!active) {
          return;
        }

        if (!allowed) {
          setLoading(false);
          setColumnAccessLoading(false);
          Alert.alert(
            'Acesso negado',
            'Você não tem permissão para abrir Dados cadastrais.',
            [{ text: 'OK', onPress: () => router.replace('/(tabs)/dashboard') }]
          );
          return;
        }

        await fetchProfile({ force: ghostModeActive });
      })();

      return () => {
        active = false;
      };
    }, [fetchProfile, ghostModeActive, ghostModeState?.targetProfileId, isRecoveryAccessPinFlow, router])
  );

  useEffect(() => {
    if (loading || !profile) {
      return;
    }

    if (isRecoveryAccessPinFlow) {
      return;
    }

    if (isProfilePendingSelfRegistration(profile)) {
      const phoneForRegister =
        phoneParam?.trim()
        || (typeof profile.phone === 'string' ? profile.phone.trim() : '');

      if (phoneForRegister) {
        router.replace(buildRegisterRoute(phoneForRegister));
      }

      return;
    }

    if (!isOnboardingFlow) {
      return;
    }

    if (!isProfileIncompleteForOnboarding(profile)) {
      if (phoneParam) {
        router.replace(buildDashboardFamilyAgendaRoute(phoneParam));
      }
      return;
    }

    if (onboardingAlertShownRef.current) {
      return;
    }

    onboardingAlertShownRef.current = true;
    Alert.alert(
      'Complete seu cadastro',
      'Preencha os dados faltantes nas seções abaixo (contato, CPF, e-mail e endereço) para concluir seu cadastro.'
    );
  }, [isOnboardingFlow, loading, phoneParam, profile, router]);

  useEffect(() => {
    if (!isRecoveryAccessPinFlow || loading || !profile || recoveryAccessPinInitializedRef.current) {
      return;
    }

    const normalizedRecoveryPin = recoveryPinParam.replace(/\D/g, '').slice(0, ACCESS_PIN_LENGTH);

    if (!isValidAccessPin(normalizedRecoveryPin)) {
      Alert.alert(
        'Recuperação de senha',
        'Não foi possível identificar a senha enviada por e-mail. Faça login novamente.',
        [
          {
            text: 'OK',
            onPress: () => {
              if (phoneParam) {
                router.replace({
                  pathname: '/',
                  params: { phone: encodeURIComponent(phoneParam), recovered: '1' },
                });
              } else {
                router.replace('/');
              }
            },
          },
        ]
      );
      return;
    }

    recoveryAccessPinInitializedRef.current = true;
    setAccessPinSectionExpanded(true);
    setCurrentAccessPin(normalizedRecoveryPin);
    setShowCurrentAccessPin(true);
  }, [isRecoveryAccessPinFlow, loading, phoneParam, profile, recoveryPinParam, router]);

  useEffect(() => {
    setExpandedSections(isOnboardingFlow ? ONBOARDING_EXPANDED_SECTIONS : DEFAULT_EXPANDED_SECTIONS);
    void loadVehicles(profile?.phone ? String(profile.phone) : null);
    setEditingVehicle(null);
    setIsVehicleEditorVisible(false);
    setVehicleForm({
      placa: '',
      marca: '',
      modelo: '',
      cor: '',
    });
  }, [profile?.id, profile?.phone, isOnboardingFlow, loadVehicles]);

  // useEffect(() => {
  //   setFamilySearchInput('');
  //   setSearchedFamilyId('');
  //   setSelectedFamilyMemberId(null);
  //   setFamilyNameSearchResults([]);
  // }, [currentFamilyId]);

  // useEffect(() => {
  //   if (expandedSections.family_link && searchedFamilyId) {
  //     void refetchFamilyMembers();
  //   }
  // }, [expandedSections.family_link, refetchFamilyMembers, searchedFamilyId]);

  useEffect(() => {
    let active = true;

    void (async () => {
      if (!profile?.selfie_url) {
        setSelfiePreviewUrl(null);
        return;
      }

      setIsSelfieLoading(true);

      try {
        const url = await resolveSelfiePreviewUrl(String(profile.selfie_url));
        if (active) {
          setSelfiePreviewUrl(url);
          setSelfiePreviewKey(Date.now());
        }
      } finally {
        if (active) {
          setIsSelfieLoading(false);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [profile?.selfie_url]);

  const resetEditing = useCallback(() => {
    setEditingField(null);
    setEditingValue('');
    setExpandedSections(
      isOnboardingFlow ? ONBOARDING_EXPANDED_SECTIONS : DEFAULT_EXPANDED_SECTIONS
    );
  }, [isOnboardingFlow]);

  const resetVehicleEditing = useCallback(() => {
    setEditingVehicle(null);
    setIsVehicleEditorVisible(false);
    setVehicleForm({
      placa: '',
      marca: '',
      modelo: '',
      cor: '',
    });
    setExpandedSections((current) => ({
      ...current,
      vehicles: false,
    }));
  }, []);

  const toggleSection = useCallback((sectionKey: ProfileSectionKey) => {
    setExpandedSections((current) => {
      const nextOpen = !current[sectionKey];

      const closingVehiclesSection = sectionKey === 'vehicles' && !nextOpen;
      const leavingVehiclesForAnother =
        nextOpen && sectionKey !== 'vehicles' && current.vehicles;

      if (closingVehiclesSection || leavingVehiclesForAnother) {
        queueMicrotask(() => {
          resetVehicleEditing();
        });
      }

      if (nextOpen) {
        return {
          ...DEFAULT_EXPANDED_SECTIONS,
          [sectionKey]: true,
        };
      }

      return {
        ...current,
        [sectionKey]: false,
      };
    });
  }, [resetVehicleEditing]);

  const startEditingField = useCallback((field: ProfileFieldRow) => {
    if (columnAccessLoading || !isProfileColumnAccessLoaded(profileColumnAccess)) {
      Alert.alert('Aguarde', 'Carregando permissões dos campos do perfil.');
      return;
    }

    if (!canUpdateProfileColumn(field.key, profileColumnAccess)) {
      Alert.alert('Campo protegido', 'Você não tem permissão para alterar este campo.');
      return;
    }

    if (field.readOnly) {
      Alert.alert('Campo protegido', 'Este campo é apenas para visualização.');
      return;
    }

    setEditingField(field.key);

    const rawValue = profile?.[field.key];
    if (field.kind === 'date') {
      setEditingValue(formatDisplayDateLike(rawValue as string | null | undefined));
    } else if (field.kind === 'boolean') {
      setEditingValue(formatBooleanValue(rawValue as boolean | null | undefined));
    } else if (field.key === 'cep') {
      setEditingValue(rawValue ? formatCep(String(rawValue)) : '');
    } else if (field.key === 'full_name') {
      setEditingValue(rawValue ? formatFullName(String(rawValue)) : '');
    } else {
      setEditingValue(rawValue ? String(rawValue) : '');
    }

    scrollRef.current?.scrollTo({ y: 0, animated: true });
  }, [columnAccessLoading, profile, profileColumnAccess]);

  const handleEditingValueChange = useCallback(
    (value: string) => {
      if (editingFieldRow?.kind === 'date') {
        setEditingValue(formatDate(value));
        return;
      }

      if (editingFieldRow?.kind === 'phone') {
        setEditingValue(formatPhone(value));
        return;
      }

      if (editingFieldRow?.key === 'cep') {
        const formattedCep = formatCep(value);
        setEditingValue(formattedCep);

        const digits = normalizeCep(formattedCep);

        // Ao completar 8 dígitos, consulta ViaCEP e grava o endereço automaticamente.
        if (
          digits.length === 8
          && profile?.id
          && lastCepLookupRef.current !== digits
          && !lookingUpCep
          && !saving
        ) {
          lastCepLookupRef.current = digits;
          setLookingUpCep(true);

          void (async () => {
            try {
              const updatedProfile = await syncProfileAddressFromCep(profile.id, {
                cep: formattedCep,
              });

              if (updatedProfile && typeof updatedProfile === 'object' && 'id' in updatedProfile) {
                setProfile(updatedProfile as ProfileRecord);
              }

              Alert.alert(
                'Endereço preenchido',
                `CEP ${formattedCep} consultado. Rua, bairro, cidade e UF foram atualizados.`
              );
            } catch (error) {
              lastCepLookupRef.current = null;
              Alert.alert(
                'CEP',
                error instanceof Error
                  ? error.message
                  : 'Não foi possível consultar o endereço deste CEP.'
              );
            } finally {
              setLookingUpCep(false);
            }
          })();
        }

        return;
      }

      setEditingValue(value);
    },
    [editingFieldRow, lookingUpCep, profile?.id, saving]
  );

  const updateSingleField = useCallback(async (fieldKey: string, value: unknown) => {
    if (!profile?.id) {
      throw new Error('Perfil não encontrado.');
    }

    if (columnAccessLoading || !isProfileColumnAccessLoaded(profileColumnAccess)) {
      throw new Error('Permissões dos campos ainda estão carregando.');
    }

    if (!canUpdateProfileColumn(fieldKey, profileColumnAccess)) {
      throw new Error('Você não tem permissão para alterar este campo.');
    }

    const actorProfileId = await resolveEffectiveProfileId();

    const rpcResult = await supabase.rpc('update_profile_field', {
      p_profile_id: profile.id,
      p_field: fieldKey,
      p_value: value ?? null,
      p_actor_profile_id: actorProfileId ?? profile.id,
    });

    const isMissingUpdateProfileFieldRpc = rpcResult.error?.code === 'PGRST202'
      || rpcResult.error?.message.toLowerCase().includes('update_profile_field')
      || false;

    if (!rpcResult.error && rpcResult.data) {
      const updatedProfile = rpcResult.data as ProfileRecord;
      setProfile(updatedProfile);
      return updatedProfile;
    }

    if (isMissingUpdateProfileFieldRpc) {
      throw new Error('O banco ainda não foi atualizado para gravar selfie. Execute o script scripts/update-profile-field.sql no Supabase.');
    }

    const shouldTryDirectUpdate = rpcResult.error
      && (
        rpcResult.error.message.toLowerCase().includes('update_profile_field')
        || rpcResult.error.message.toLowerCase().includes('function')
      );

    if (!shouldTryDirectUpdate && rpcResult.error) {
      throw rpcResult.error;
    }

    const { data, error } = await supabase
      .from('profiles')
      .update({ [fieldKey]: value })
      .eq('id', profile.id)
      .select('*')
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      throw new Error('Atualização do perfil não confirmada. Execute o script scripts/update-profile-field.sql no Supabase.');
    }

    const updatedProfile = data as ProfileRecord;
    setProfile(updatedProfile);
    return updatedProfile;
  }, [profile?.id, profileColumnAccess]);

  const handleSaveField = useCallback(async () => {
    if (!editingField || !editingFieldRow || !profile?.id) {
      return;
    }

    try {
      setSaving(true);

      let nextValue: unknown = editingValue.trim();

      if (editingFieldRow.key === 'cep') {
        const normalizedCep = normalizeCep(editingValue);
        const formattedCep = editingValue.trim() ? formatCep(editingValue) : null;

        if (editingValue.trim()) {
          const updatedProfile = await syncProfileAddressFromCep(profile.id, {
            cep: editingValue,
          });

          if (updatedProfile && typeof updatedProfile === 'object' && 'id' in updatedProfile) {
            setProfile(updatedProfile as ProfileRecord);
          }

          resetEditing();
          Alert.alert('Sucesso', `CEP atualizado e endereço preenchido para ${formattedCep ?? normalizedCep}.`);
          return;
        }

        nextValue = formattedCep;
      } else if (editingFieldRow.kind === 'phone') {
        const formattedPhone = editingValue.trim() ? formatPhone(editingValue) : null;

        if (!formattedPhone) {
          throw new Error('O telefone não pode ficar vazio.');
        }

        const currentPhone = profile?.phone ? String(profile.phone).trim() : '';

        if (!currentPhone) {
          await updateSingleField('phone', formattedPhone);
        } else {
          const changeResult = await changePhoneEverywhere(currentPhone, formattedPhone);
          const refreshedProfile = await loadProfile(formattedPhone);

          if (refreshedProfile) {
            setProfile(refreshedProfile);
          }

          await AsyncStorage.setItem('user_phone', formattedPhone);
          router.replace({
            pathname: '/manage-profile',
            params: returnDashboardCard
              ? withReturnDashboardCard(returnDashboardCard, {
                  phone: encodeURIComponent(formattedPhone),
                })
              : { phone: encodeURIComponent(formattedPhone) },
          });

          resetEditing();
          const updatedRows = changeResult.updated_rows ?? 0;
          Alert.alert(
            'Sucesso',
            updatedRows > 0
              ? `Telefone atualizado em ${updatedRows} registro(s) do banco.`
              : 'Telefone atualizado.'
          );
          return;
        }

        nextValue = formattedPhone;
      } else if (editingFieldRow.key === 'full_name') {
        nextValue = formatFullName(editingValue);

        if (!nextValue) {
          throw new Error('O nome completo não pode ficar vazio.');
        }
      } else if (editingFieldRow.kind === 'date') {
        nextValue = editingValue.trim() ? toIsoDate(editingValue) : null;

        if (editingValue.trim() && !nextValue) {
          throw new Error('Informe a data no formato DD/MM/AAAA.');
        }
      } else if (editingFieldRow.kind === 'boolean') {
        nextValue = parseBooleanInput(editingValue);
      } else if (!editingValue.trim()) {
        nextValue = null;
      }

      await updateSingleField(editingField, nextValue);
      if (PROFILE_GEO_FIELDS.has(editingField)) {
        await invalidateProfilesMapSnapshot();
      }
      resetEditing();
      Alert.alert('Sucesso', 'Campo atualizado.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Não foi possível atualizar o campo.';
      Alert.alert('Erro', message);
    } finally {
      setSaving(false);
    }
  }, [editingField, editingFieldRow, editingValue, profile?.phone, resetEditing, router, updateSingleField]);

  const startNewVehicle = useCallback(() => {
    setEditingVehicle(null);
    setVehicleForm({
      placa: '',
      marca: '',
      modelo: '',
      cor: '',
    });
    setIsVehicleEditorVisible(true);
  }, []);

  const startEditingVehicle = useCallback((vehicle: ProfileVehicle) => {
    setEditingVehicle(vehicle);
    setVehicleForm({
      placa: vehicle.placa ?? '',
      marca: vehicle.marca ?? '',
      modelo: vehicle.modelo ?? '',
      cor: vehicle.cor ?? '',
    });
    setIsVehicleEditorVisible(true);
  }, []);

  // const handleSelectFamilyNameSearchResult = useCallback(
  //   (result: FamilySearchByNameResult) => {
  //     setSearchedFamilyId(result.familyId);
  //     setFamilySearchInput(result.fullName);
  //     setFamilyNameSearchResults([]);
  //     setSelectedFamilyMemberId(null);
  //   },
  //   []
  // );

  // useEffect(() => {
  //   if (isSearchedFamilySameAsCurrent) {
  //     setSelectedFamilyMemberId(null);
  //   }
  // }, [isSearchedFamilySameAsCurrent]);

  // useEffect(() => {
  //   const query = familySearchInput.trim();

  //   if (!canSearchFamilyByMemberName(query) || searchedFamilyId) {
  //     setFamilyNameSearchResults([]);
  //     setSearchingFamily(false);
  //     return;
  //   }

  //   let active = true;
  //   const timer = setTimeout(() => {
  //     setSearchingFamily(true);

  //     void searchFamiliesByMemberName(query)
  //       .then((results) => {
  //         if (active) {
  //           setFamilyNameSearchResults(results);
  //         }
  //       })
  //       .catch((error: unknown) => {
  //         console.error('Erro ao buscar família por nome:', error);

  //         if (active) {
  //           setFamilyNameSearchResults([]);
  //         }
  //       })
  //       .finally(() => {
  //         if (active) {
  //           setSearchingFamily(false);
  //         }
  //       });
  //   }, 300);

  //   return () => {
  //     active = false;
  //     clearTimeout(timer);
  //   };
  // }, [familySearchInput, searchedFamilyId]);

  // const handleRequestFamilyLink = useCallback(async () => {
  //   if (!profile?.id) {
  //     Alert.alert('Erro', 'Perfil não encontrado.');
  //     return;
  //   }

  //   if (!searchedFamilyId) {
  //     Alert.alert('Atenção', 'Busque a família antes de solicitar o vínculo.');
  //     return;
  //   }

  //   const selectedMember = familyMembers.find((member) => member.id === selectedFamilyMemberId);

  //   if (!selectedMember) {
  //     Alert.alert('Atenção', 'Selecione um membro da família para solicitar o vínculo.');
  //     return;
  //   }

  //   try {
  //     setRequestingFamilyLink(true);
  //     const linkedFamilyId = await linkProfileToFamilyById(
  //       {
  //         id: String(profile.id),
  //         full_name: profile.full_name ? String(profile.full_name) : null,
  //         phone: profile.phone ? String(profile.phone) : null,
  //         birth_date: profile.birth_date ? String(profile.birth_date) : null,
  //       },
  //       searchedFamilyId
  //     );

  //     try {
  //       await updateSingleField('invited_by', selectedMember.full_name);
  //     } catch (invitedByError) {
  //       console.warn('Não foi possível registrar o membro de referência:', invitedByError);
  //     }

  //     const refreshedProfile = await loadProfile(phoneParam);
  //     if (refreshedProfile) {
  //       setProfile(refreshedProfile);
  //     }

  //     setFamilySearchInput(selectedMember.full_name);
  //     setSearchedFamilyId(linkedFamilyId);
  //     setFamilyNameSearchResults([]);
  //     setSelectedFamilyMemberId(selectedMember.id);
  //     await refetchFamilyMembers();
  //     Alert.alert(
  //       'Solicitação enviada',
  //       `Vínculo solicitado com a família ${linkedFamilyId} por referência de ${selectedMember.full_name}.`
  //     );
  //   } catch (error) {
  //     const message =
  //       error instanceof Error ? error.message : 'Não foi possível solicitar o vínculo familiar.';
  //     Alert.alert('Erro', message);
  //   } finally {
  //     setRequestingFamilyLink(false);
  //   }
  // }, [
  //   familyMembers,
  //   familySearchInput,
  //   phoneParam,
  //   profile,
  //   refetchFamilyMembers,
  //   searchedFamilyId,
  //   selectedFamilyMemberId,
  //   updateSingleField,
  // ]);

  const handleSaveVehicle = useCallback(async () => {
    if (!profile?.phone) {
      Alert.alert('Telefone obrigatório', 'Cadastre primeiro um telefone no perfil para vincular veículos.');
      return;
    }

    const placa = vehicleForm.placa.trim().toUpperCase();
    if (!placa) {
      Alert.alert('Placa obrigatória', 'Informe a placa do veículo.');
      return;
    }

    const payload = {
      phone: String(profile.phone),
      placa,
      marca: vehicleForm.marca.trim() || null,
      modelo: vehicleForm.modelo.trim() || null,
      cor: vehicleForm.cor.trim() || null,
    };

    try {
      setSavingVehicle(true);

      if (editingVehicle) {
        const { error } = await supabase
          .from('profile_vehicles')
          .update(payload)
          .eq('id', editingVehicle.id);

        if (error) {
          throw error;
        }
      } else {
        const { error } = await supabase.from('profile_vehicles').insert(payload);
        if (error) {
          throw error;
        }
      }

      await loadVehicles(profile.phone ? String(profile.phone) : null);
      resetVehicleEditing();
      Alert.alert('Sucesso', 'Veículo salvo com sucesso.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Não foi possível salvar o veículo.';
      Alert.alert('Erro', message);
    } finally {
      setSavingVehicle(false);
    }
  }, [editingVehicle, loadVehicles, profile?.phone, resetVehicleEditing, vehicleForm]);

  const handleDeleteVehicle = useCallback(
    async (vehicle: ProfileVehicle) => {
      const confirmed = await confirmDialog(
        'Excluir veículo',
        `Deseja remover o veículo de placa ${vehicle.placa}?`,
        'Excluir',
        'Cancelar',
        { destructive: true }
      );

      if (!confirmed) {
        return;
      }

      if (!profile?.phone) {
        Alert.alert('Erro', 'Perfil sem telefone vinculado.');
        return;
      }

      try {
        setDeletingVehicleId(vehicle.id);

        const { error } = await supabase
          .from('profile_vehicles')
          .delete()
          .eq('id', vehicle.id)
          .eq('phone', String(profile.phone));

        if (error) {
          throw error;
        }

        if (editingVehicle?.id === vehicle.id) {
          resetVehicleEditing();
        }

        await loadVehicles(String(profile.phone));
        Alert.alert('Sucesso', 'Veículo excluído.');
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Não foi possível excluir o veículo.';
        Alert.alert('Erro', message);
      } finally {
        setDeletingVehicleId(null);
      }
    },
    [editingVehicle?.id, loadVehicles, profile?.phone, resetVehicleEditing]
  );

  const handleSelfieSelected = useCallback(async (photo: string) => {
    const previousPreview = selfiePreviewUrl;
    const previousFileName = resolveSelfieStorageFileName(
      profile?.selfie_url ? String(profile.selfie_url) : null
    );

    try {
      setSelfiePreviewUrl(photo);
      setIsSelfieLoading(true);
      const fileName = await uploadSelfieInput(photo);
      const savedSelfieUrl = await saveProfileSelfieUrl(String(profile?.id), fileName);

      setProfile((current) =>
        current ? { ...current, selfie_url: savedSelfieUrl } : current
      );

      if (previousFileName && previousFileName !== savedSelfieUrl) {
        await deleteSelfieFile(previousFileName);
      }

      const nextPreview = await resolveSelfiePreviewUrl(savedSelfieUrl);
      setSelfiePreviewUrl(nextPreview ?? photo);
      setSelfiePreviewKey(Date.now());
      Alert.alert('Sucesso', 'Selfie atualizada.');
    } catch (error) {
      setSelfiePreviewUrl(previousPreview ?? null);
      const message = error instanceof Error ? error.message : 'Não foi possível atualizar a selfie.';
      Alert.alert('Erro', message);
    } finally {
      setIsSelfieLoading(false);
      setScreenMode('FORM');
    }
  }, [profile?.id, profile?.selfie_url, selfiePreviewUrl]);

  const proceedToSelfieCapture = useCallback(async () => {
    if (Platform.OS === 'web') {
      try {
        const selectedSelfie = await pickSelfieFromWeb();
        if (!selectedSelfie) {
          return;
        }

        void handleSelfieSelected(selectedSelfie);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Não foi possível carregar a selfie selecionada.';
        Alert.alert('Erro', message);
      }
      return;
    }

    if (cameraPermission?.granted) {
      setIsCameraReady(false);
      setPictureSize(null);
      setScreenMode('CAMERA');
      return;
    }

    const permissionResponse = await requestCameraPermission();

    if (!permissionResponse.granted) {
      Alert.alert('Permissão necessária', 'Permita o uso da câmera para atualizar a selfie.');
      return;
    }

    setIsCameraReady(false);
    setPictureSize(null);
    setScreenMode('CAMERA');
  }, [cameraPermission?.granted, handleSelfieSelected, requestCameraPermission]);

  const handleOpenSelfieAction = useCallback(async () => {
    if (!profile?.id || isSelfieLoading) {
      return;
    }

    const hasExistingSelfie = hasExistingSelfieRecord(
      profile.selfie_url ? String(profile.selfie_url) : null,
      selfiePreviewUrl
    );

    if (hasExistingSelfie) {
      const shouldReplace = await confirmDialog(
        'Substituir selfie?',
        'Já existe uma selfie cadastrada. Deseja substituir a imagem anterior pela nova?',
        'Substituir',
        'Não'
      );

      if (!shouldReplace) {
        return;
      }
    }

    await proceedToSelfieCapture();
  }, [isSelfieLoading, proceedToSelfieCapture, profile?.id, profile?.selfie_url, selfiePreviewUrl]);

  const handleCameraReady = useCallback(async () => {
    setIsCameraReady(true);

    try {
      const availableSizes = await cameraRef.current?.getAvailablePictureSizesAsync?.();
      if (Array.isArray(availableSizes) && availableSizes.length > 0) {
        setPictureSize(selectSelfiePictureSize(availableSizes));
      }
    } catch (error) {
      console.warn('Não foi possível carregar os tamanhos de foto da câmera.', error);
    }
  }, []);

  const editingPlaceholder = editingFieldRow
    ? editingFieldRow.key === 'cep'
      ? '00000-000'
      : editingFieldRow.kind === 'date'
      ? 'DD/MM/AAAA'
      : editingFieldRow.kind === 'boolean'
        ? 'Sim ou Não'
        : 'Informe o valor'
    : '';

  const displayName =
    profile?.full_name && !isPlaceholderVisitorName(String(profile.full_name))
      ? formatFullName(String(profile.full_name))
      : 'Perfil sem nome';
  const displayPhone = profile?.phone ? String(profile.phone) : 'Telefone não informado';
  const displayBirth = profile?.birth_date ? formatDisplayDateLike(String(profile.birth_date)) : 'Nascimento não informado';
  const displayFamily = profile?.family_id || profile?.codigo_membro
    ? String(profile.family_id ?? profile.codigo_membro)
    : 'Família não vinculada';
  const isLgpdPending = isProfileLgpdPending(
    profile?.lgpd_accepted as boolean | null | undefined,
    lgpdModuleActive
  );

  const handleOpenLgpdScreen = useCallback(() => {
    const phoneForLgpd = phoneParam?.trim() || String(profile?.phone ?? '').trim();

    router.push({
      pathname: '/lgpd',
      params: phoneForLgpd ? { phone: encodeURIComponent(phoneForLgpd) } : {},
    });
  }, [phoneParam, profile?.phone, router]);

  const handleVehicleFormChange = useCallback(
    (patch: Partial<{ placa: string; marca: string; modelo: string; cor: string }>) => {
      setVehicleForm((current) => ({ ...current, ...patch }));
    },
    []
  );

  return (
    <ProfileClass
      embedded={embedded}
      screenMode={screenMode}
      insetsBottom={insets.bottom}
      scrollRef={scrollRef}
      cameraRef={cameraRef}
      pictureSize={pictureSize}
      isCameraReady={isCameraReady}
      onCameraReady={handleCameraReady}
      onCancelCamera={() => setScreenMode('FORM')}
      onCaptureSelfie={async () => {
        const picture = await cameraRef.current?.takePictureAsync({ quality: 0.1 });
        if (picture?.uri) {
          void handleSelfieSelected(picture.uri);
        }
      }}
      onCameraMountError={(message) => {
        Alert.alert('Erro na câmera', message || 'Não foi possível abrir a câmera.');
        setScreenMode('FORM');
      }}
      isOnboardingFlow={isOnboardingFlow}
      isRecoveryAccessPinFlow={isRecoveryAccessPinFlow}
      profile={profile}
      loading={loading}
      ghostModeActive={ghostModeActive}
      columnAccessLoading={columnAccessLoading}
      profileSections={profileSections}
      expandedSections={expandedSections}
      toggleSection={toggleSection}
      selfiePreviewUrl={selfiePreviewUrl}
      selfiePreviewKey={selfiePreviewKey}
      isSelfieLoading={isSelfieLoading}
      displayName={displayName}
      displayPhone={displayPhone}
      displayBirth={displayBirth}
      displayFamily={displayFamily}
      lgpdModuleActive={lgpdModuleActive}
      isLgpdPending={isLgpdPending}
      onOpenLgpdScreen={() => void handleOpenLgpdScreen()}
      onOpenSelfieAction={() => void handleOpenSelfieAction()}
      showAccessPinSection={showAccessPinSection}
      accessPinSectionExpanded={accessPinSectionExpanded}
      toggleAccessPinSection={toggleAccessPinSection}
      onAccessPinSectionLayout={(y) => {
        accessPinSectionScrollYRef.current = y;
      }}
      accessPinFormContent={renderAccessPinFormFields()}
      securityQuestionSectionExpanded={securityQuestionSectionExpanded}
      onToggleSecurityQuestionSection={() => setSecurityQuestionSectionExpanded((open) => !open)}
      onSecurityQuestionSaved={(securityQuestion) => {
        setProfile((current) =>
          current ? { ...current, security_question: securityQuestion } : current
        );
        void fetchProfile({ force: true });
      }}
      editingFieldRow={editingFieldRow}
      editingPlaceholder={editingPlaceholder}
      editingValue={editingValue}
      saving={saving}
      lookingUpCep={lookingUpCep}
      onEditingValueChange={handleEditingValueChange}
      onSaveField={() => void handleSaveField()}
      onCancelEditing={resetEditing}
      onStartEditingField={startEditingField}
      vehicles={vehicles}
      loadingVehicles={loadingVehicles}
      isVehicleEditorVisible={isVehicleEditorVisible}
      editingVehicle={editingVehicle}
      vehicleForm={vehicleForm}
      onVehicleFormChange={handleVehicleFormChange}
      savingVehicle={savingVehicle}
      deletingVehicleId={deletingVehicleId}
      onSaveVehicle={() => void handleSaveVehicle()}
      onCancelVehicleEditing={resetVehicleEditing}
      onStartEditingVehicle={startEditingVehicle}
      onDeleteVehicle={(vehicle) => void handleDeleteVehicle(vehicle)}
      onStartNewVehicle={startNewVehicle}
      accessPinSectionExpandedForScroll={accessPinSectionExpanded}
      onLeaveScreen={handleLeaveScreen}
      showOnboardingHint={Boolean(isOnboardingFlow && isProfileIncompleteForOnboarding(profile))}
    />
  );
}
