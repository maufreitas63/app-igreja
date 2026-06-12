import { MaterialIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useReturnToCallerOnLeave } from '@/hooks/useReturnToCallerOnLeave';
import { resolveReturnDashboardCardParam, withReturnDashboardCard } from '@/lib/dashboardReturnNavigation';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  ActivityIndicator,
  Keyboard,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
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
// import { useFamilyMembers } from '@/hooks/useFamilyMembers';
import {
  invalidateProfilesMapSnapshot,
  PROFILE_GEO_FIELDS,
} from '@/lib/profilesMapCache';
import { syncProfileAddressFromCep } from '@/lib/syncProfileAddressFromCep';
// import { formatShortName } from '@/lib/formatShortName';
// import {
//   canSearchFamilyByMemberName,
//   linkProfileToFamilyById,
//   searchFamiliesByMemberName,
//   type FamilySearchByNameResult,
// } from '@/lib/linkProfileFamily';
// import { normalizeFamilyCode } from '@/lib/family';
import {
  buildDashboardFamilyAgendaRoute,
  buildRegisterRoute,
  isPlaceholderVisitorName,
  isProfileIncompleteForOnboarding,
  isProfilePendingSelfRegistration,
} from '@/lib/profileOnboarding';
import { reconcileRejectedMemberFamilyCode } from '@/lib/rejectedMemberFamilyCode';
import {
  ACCESS_PIN_LENGTH,
  isValidAccessPin,
  updateProfileAccessPin,
} from '@/lib/accessPin';
import { buildPhoneDbQueryVariants } from '@/lib/phoneDbVariants';
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
import { clearStoredProfileId, getStoredProfileId, getStoredUserPhone } from '@/lib/userSession';

type ProfileRecord = {
  id: string;
  [key: string]: unknown;
};

type FieldKind = 'text' | 'phone' | 'date' | 'boolean' | 'url';
type ProfileSectionKey = 'personal' | 'contact' | 'privacy' | 'technical' | 'vehicles'; // | 'family_link';

type ProfileFieldRow = {
  key: string;
  kind: FieldKind;
  label: string;
  value: string;
  readOnly?: boolean;
};

type ProfileSection = {
  key: ProfileSectionKey;
  title: string;
  fields: ProfileFieldRow[];
};

type ProfileVehicle = {
  id: string;
  phone: string;
  placa: string;
  marca: string | null;
  modelo: string | null;
  cor: string | null;
};

const FIELD_ORDER = [
  'id',
  'full_name',
  'phone',
  'birth_date',
  'family_id',
  'codigo_membro',
  'auth_user_id',
  'lgpd_accepted',
  'is_active',
  'selfie_url',
  'created_at',
  'updated_at',
] as const;

const FIELD_LABELS: Record<string, string> = {
  id: 'ID',
  auth_user_id: 'ID do Usuário de Autenticação',
  codigo_membro: 'Código do Membro',
  role: 'Perfil',
  full_name: 'Nome Completo',
  cpf: 'CPF',
  email: 'E-mail',
  phone: 'Telefone',
  birth_date: 'Nascimento',
  baptism_date: 'Data de Batismo',
  church_function: 'Função na Igreja',
  cep: 'CEP',
  address_street: 'Rua',
  address_number: 'Número',
  address_complement: 'Complemento',
  address_neighborhood: 'Bairro',
  address_city: 'Cidade',
  address_state: 'Estado',
  family_group_id: 'Grupo Familiar',
  family_id: 'Família',
  selfie_url: 'URL da Selfie',
  lgpd_accepted: 'LGPD Aceito',
  lgpd_accepted_at: 'Data do Aceite LGPD',
  lgpd_status: 'Status LGPD',
  lgpd_status_date: 'Data do Status LGPD',
  is_active: 'Perfil Ativo',
  medical_food_alerts: 'Alertas Alimentares',
  first_visit_date: 'Data da Primeira Visita',
  invited_by: 'Convidado Por',
  follow_up_status: 'Status de Acompanhamento',
  created_at: 'Criado Em',
  updated_at: 'Atualizado Em',
};

const SECTION_TITLES: Record<ProfileSectionKey, string> = {
  personal: 'Dados Pessoais',
  contact: 'Contato',
  privacy: 'Privacidade / Status',
  technical: 'Endereço',
  vehicles: 'Veículos cadastrados',
  // family_link: 'Vincular a Familia',
};

/** Ordem de exibição das seções de dados do perfil (sem privacidade/status). */
const SECTION_DISPLAY_ORDER: ProfileSectionKey[] = ['personal', 'contact', 'technical'];

const READ_ONLY_FIELDS = new Set(['id', 'auth_user_id', 'created_at', 'updated_at', 'selfie_url']);
const HIDDEN_PROFILE_FIELDS = new Set([
  'codigo_membro',
  'family_group_id',
  'family_id',
  'role',
  'is_active',
  'lgpd_accepted_at',
  'lgpd_status',
  'lgpd_status_date',
  'id',
  'auth_user_id',
  'created_at',
  'updated_at',
  'baptism_date',
  'church_function',
  'first_visit_date',
  'follow_up_status',
  'invited_by',
  'selfie_url',
  'access_pin',
]);
const DEFAULT_EXPANDED_SECTIONS: Record<ProfileSectionKey, boolean> = {
  personal: false,
  contact: false,
  privacy: false,
  technical: false,
  vehicles: false,
  // family_link: false,
};

const ONBOARDING_EXPANDED_SECTIONS: Record<ProfileSectionKey, boolean> = {
  personal: true,
  contact: true,
  privacy: false,
  technical: true,
  vehicles: false,
  // family_link: false,
};

const normalizePhone = (value: string | null | undefined) => (value ?? '').replace(/\D/g, '');

const formatPhone = (value: string) => {
  const cleaned = value.replace(/\D/g, '');
  if (cleaned.length <= 2) return cleaned;
  if (cleaned.length <= 6) return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2)}`;
  if (cleaned.length <= 10) return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 6)}-${cleaned.slice(6)}`;
  return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7, 11)}`;
};

const formatCep = (value: string) => {
  const cleaned = value.replace(/\D/g, '').slice(0, 8);
  if (cleaned.length <= 5) {
    return cleaned;
  }

  return `${cleaned.slice(0, 5)}-${cleaned.slice(5)}`;
};

const normalizeCep = (value: string) => value.replace(/\D/g, '').slice(0, 8);

const formatDate = (value: string) => {
  const cleaned = value.replace(/\D/g, '');
  if (cleaned.length <= 2) return cleaned;
  if (cleaned.length <= 4) return `${cleaned.slice(0, 2)}/${cleaned.slice(2)}`;
  return `${cleaned.slice(0, 2)}/${cleaned.slice(2, 4)}/${cleaned.slice(4, 8)}`;
};

const toIsoDate = (value: string) => {
  const cleaned = value.replace(/\D/g, '');
  if (cleaned.length !== 8) {
    return null;
  }

  return `${cleaned.slice(4, 8)}-${cleaned.slice(2, 4)}-${cleaned.slice(0, 2)}`;
};

const formatDisplayDateLike = (value: string | null | undefined) => {
  if (!value) return '';

  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{2}):(\d{2}))?/);
  if (!match) {
    return value;
  }

  const [, year, month, day, hours, minutes] = match;
  if (hours && minutes) {
    return `${day}/${month}/${year} ${hours}:${minutes}`;
  }

  return `${day}/${month}/${year}`;
};

const formatBooleanValue = (value: boolean | null | undefined) => {
  if (value === true) return 'Sim';
  if (value === false) return 'Não';
  return 'Sem valor';
};

const humanizeFieldKey = (value: string) =>
  value
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

const inferFieldKind = (key: string, value: unknown): FieldKind => {
  if (typeof value === 'boolean' || key.startsWith('is_') || key.endsWith('_accepted')) {
    return 'boolean';
  }

  if (key.includes('phone')) {
    return 'phone';
  }

  if (key.includes('birth_date') || key.endsWith('_date') || key.endsWith('_at')) {
    return 'date';
  }

  if (key.includes('url')) {
    return 'url';
  }

  return 'text';
};

/** Campos exibidos na seção Endereço, nesta ordem. */
const ADDRESS_FIELD_ORDER = [
  'cep',
  'address_street',
  'address_number',
  'address_complement',
  'address_neighborhood',
  'address_city',
  'address_state',
] as const;

const ADDRESS_FIELD_ORDER_SET = new Set<string>(ADDRESS_FIELD_ORDER);

const inferSectionKey = (field: ProfileFieldRow): ProfileSectionKey => {
  if (
    field.key === 'full_name' ||
    field.key === 'birth_date' ||
    field.key.includes('name')
  ) {
    return 'personal';
  }

  if (field.key === 'medical_food_alerts') {
    return 'personal';
  }

  if (
    field.kind === 'phone' ||
    field.key.includes('email') ||
    field.key.includes('contact')
  ) {
    return 'contact';
  }

  if (
    field.key.includes('lgpd') ||
    field.key.includes('active') ||
    field.key.includes('accepted')
  ) {
    return 'privacy';
  }

  if (ADDRESS_FIELD_ORDER_SET.has(field.key)) {
    return 'technical';
  }

  return 'technical';
};

const parseBooleanInput = (value: string) => {
  const normalized = value
    .trim()
    .toLocaleLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  if (!normalized) {
    return null;
  }

  if (['sim', 's', 'true', '1'].includes(normalized)) {
    return true;
  }

  if (['nao', 'n', 'false', '0'].includes(normalized)) {
    return false;
  }

  throw new Error('Use Sim ou Não para este campo.');
};

function pickBestProfileRow(rows: ProfileRecord[]): ProfileRecord | null {
  if (!rows.length) {
    return null;
  }

  const withRealName = rows.find((row) => {
    const name = row.full_name;
    return (
      typeof name === 'string'
      && name.trim().length > 0
      && !isPlaceholderVisitorName(name)
    );
  });

  if (withRealName) {
    return withRealName;
  }

  const withAnyName = rows.find((row) => {
    const name = row.full_name;
    return typeof name === 'string' && name.trim().length > 0;
  });

  return withAnyName ?? rows[0];
}

async function loadProfile(phoneParam: string | null): Promise<ProfileRecord | null> {
  const phoneCandidates = new Set<string>();

  if (phoneParam?.trim()) {
    for (const variant of buildPhoneDbQueryVariants(phoneParam)) {
      phoneCandidates.add(variant);
    }
  }

  const storedPhone = await getStoredUserPhone();
  if (storedPhone?.trim()) {
    for (const variant of buildPhoneDbQueryVariants(storedPhone)) {
      phoneCandidates.add(variant);
    }
  }

  const variantList = [...phoneCandidates];
  if (variantList.length > 0) {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .in('phone', variantList)
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('Erro ao carregar perfil por telefone:', error);
    } else {
      const best = pickBestProfileRow((data ?? []) as ProfileRecord[]);
      if (best) {
        return best;
      }
    }
  }

  const storedProfileId = await getStoredProfileId();
  if (storedProfileId) {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', storedProfileId)
      .maybeSingle();

    if (error) {
      console.error('Erro ao carregar perfil por id da sessão:', error);
    } else if (data) {
      return data as ProfileRecord;
    } else {
      await clearStoredProfileId();
    }
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('auth_user_id', user.id)
    .maybeSingle();

  if (error) {
    console.error('Erro ao carregar perfil por auth:', error);
    return null;
  }

  return (data as ProfileRecord | null) ?? null;
}

const buildFieldRows = (profile: ProfileRecord | null): ProfileFieldRow[] => {
  if (!profile) {
    return [];
  }

  const profileKeys = Object.keys(profile);
  const orderedKeys = [
    ...FIELD_ORDER.filter((key) => profileKeys.includes(key)),
    ...profileKeys
      .filter((key) => !FIELD_ORDER.includes(key as (typeof FIELD_ORDER)[number]))
      .sort((left, right) => left.localeCompare(right)),
  ].filter((key) => !HIDDEN_PROFILE_FIELDS.has(key));

  return orderedKeys.map((key) => {
    const rawValue = profile[key];
    const kind = inferFieldKind(key, rawValue);
    let value = '';

    if (kind === 'date') {
      value = formatDisplayDateLike(rawValue as string | null | undefined);
    } else if (kind === 'boolean') {
      value = formatBooleanValue(rawValue as boolean | null | undefined);
    } else {
      value =
        rawValue === null || rawValue === undefined || rawValue === ''
          ? 'Sem valor'
          : String(rawValue);
    }

    return {
      key,
      kind,
      label: FIELD_LABELS[key] ?? humanizeFieldKey(key),
      value,
      readOnly: READ_ONLY_FIELDS.has(key),
    };
  });
};

const buildSections = (fields: ProfileFieldRow[]): ProfileSection[] => {
  const groupedFields: Record<ProfileSectionKey, ProfileFieldRow[]> = {
    personal: [],
    contact: [],
    privacy: [],
    technical: [],
    vehicles: [],
    // family_link: [],
  };

  for (const field of fields) {
    groupedFields[inferSectionKey(field)].push(field);
  }

  const sortTechnicalAddressFields = (sectionFields: ProfileFieldRow[]) => {
    const byKey = new Map(sectionFields.map((field) => [field.key, field]));
    return ADDRESS_FIELD_ORDER.map((key) => byKey.get(key)).filter(
      (row): row is ProfileFieldRow => Boolean(row)
    );
  };

  return SECTION_DISPLAY_ORDER.map((sectionKey) => ({
    key: sectionKey,
    title: SECTION_TITLES[sectionKey],
    fields:
      sectionKey === 'technical'
        ? sortTechnicalAddressFields(groupedFields[sectionKey])
        : groupedFields[sectionKey].map((field) =>
            sectionKey === 'privacy' ? { ...field, readOnly: true } : field
          ),
  })).filter((section) => section.fields.length > 0);
};

const ACCESS_PIN_SECTION_BODY_MIN_HEIGHT = 404;

type AccessPinFieldProps = {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  inputRef: React.RefObject<TextInput | null>;
  visible: boolean;
  onToggleVisible: () => void;
  editable: boolean;
  hasError?: boolean;
  onFocus?: () => void;
  onSubmitEditing?: () => void;
  blurOnSubmit?: boolean;
  returnKeyType?: 'next' | 'done';
};

function AccessPinField({
  label,
  value,
  onChangeText,
  inputRef,
  visible,
  onToggleVisible,
  editable,
  hasError = false,
  onFocus,
  onSubmitEditing,
  blurOnSubmit,
  returnKeyType,
}: AccessPinFieldProps) {
  return (
    <View style={accessPinFieldStyles.fieldBlock}>
      <Text style={accessPinFieldStyles.label}>{label}</Text>
      <View style={accessPinFieldStyles.row}>
        <TextInput
          ref={inputRef}
          style={[accessPinFieldStyles.input, hasError && accessPinFieldStyles.inputError]}
          placeholder="****"
          placeholderTextColor="#64748b"
          value={value}
          onChangeText={onChangeText}
          onFocus={onFocus}
          onSubmitEditing={onSubmitEditing}
          blurOnSubmit={blurOnSubmit}
          returnKeyType={returnKeyType}
          keyboardType="number-pad"
          maxLength={ACCESS_PIN_LENGTH}
          secureTextEntry={!visible}
          editable={editable}
          textAlign="center"
          scrollEnabled={false}
        />
        <TouchableOpacity
          style={accessPinFieldStyles.visibilityButton}
          onPress={onToggleVisible}
          disabled={!editable}
          accessibilityRole="button"
          accessibilityLabel={visible ? 'Ocultar senha' : 'Mostrar senha'}
          hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
        >
          <MaterialIcons
            name={visible ? 'visibility' : 'visibility-off'}
            size={22}
            color="#94A3B8"
          />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const accessPinFieldStyles = StyleSheet.create({
  fieldBlock: {
    minHeight: 77,
    marginBottom: 0,
  },
  label: {
    color: '#CBD5E1',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
    height: 18,
    marginBottom: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 52,
  },
  input: {
    flex: 1,
    height: 52,
    backgroundColor: '#0f172a',
    color: '#FFF',
    paddingHorizontal: 15,
    paddingVertical: 0,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 0,
    ...(Platform.OS === 'android' ? { includeFontPadding: false, textAlignVertical: 'center' as const } : {}),
  },
  inputError: {
    borderColor: '#f87171',
  },
  visibilityButton: {
    width: 44,
    height: 52,
    marginLeft: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default function ManageProfile() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();
  const phoneParam = params.phone ? decodeURIComponent(params.phone as string) : null;
  const returnDashboardCard = resolveReturnDashboardCardParam(params);
  const returnToCaller = useReturnToCallerOnLeave({
    returnDashboardCard,
    fallbackDashboardCard: 'grouped_manage',
    extraRouteParams: phoneParam ? { phone: encodeURIComponent(phoneParam) } : undefined,
  });
  const isOnboardingFlow = params.onboarding === '1';
  const scrollRef = useRef<ScrollView>(null);
  const onboardingAlertShownRef = useRef(false);
  const cameraRef = useRef<CameraView>(null);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();

  const [profile, setProfile] = useState<ProfileRecord | null>(null);
  const [profileColumnAccess, setProfileColumnAccess] = useState<ProfileColumnAccess>({
    view: {},
    update: {},
  });
  const [columnAccessLoading, setColumnAccessLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState('');
  const [saving, setSaving] = useState(false);
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
  const [accessPinSectionExpanded, setAccessPinSectionExpanded] = useState(false);
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
    setAccessPinSectionExpanded((open) => {
      if (open) {
        currentAccessPinRef.current?.blur();
        newAccessPinRef.current?.blur();
        confirmAccessPinRef.current?.blur();
      }

      return !open;
    });
  }, []);

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

  const handleSaveAccessPin = useCallback(async () => {
    if (!canUpdateAccessPin) {
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

      resetAccessPinForm();
      Alert.alert('Senha atualizada', 'Use a nova senha de 4 dígitos na próxima entrada.');
    } finally {
      setSavingAccessPin(false);
    }
  }, [
    accessPinValidationMessage,
    canUpdateAccessPin,
    confirmAccessPin,
    currentAccessPin,
    newAccessPin,
    profilePhoneForAccessPin,
    resetAccessPinForm,
  ]);

  const loadVehicles = useCallback(
    async (phone: string | null | undefined) => {
      const normalizedPhone = phone ? String(phone).trim() : '';

      if (!normalizedPhone) {
        setVehicles([]);
        return;
      }

      setLoadingVehicles(true);

      try {
        const { data, error } = await supabase
          .from('profile_vehicles')
          .select('id, phone, placa, marca, modelo, cor')
          .eq('phone', normalizedPhone)
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

  const fetchProfile = useCallback(async () => {
    setLoading(true);

    try {
      const loadedProfile = await loadProfile(phoneParam);
      const nextProfile = loadedProfile
        ? await reconcileRejectedMemberFamilyCode(loadedProfile)
        : null;
      setProfile(nextProfile);

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
  }, [phoneParam]);

  useFocusEffect(
    useCallback(() => {
      void fetchProfile();
    }, [fetchProfile])
  );

  useFocusEffect(
    useCallback(() => {
      let active = true;

      void (async () => {
        const allowed = await sessionHasAccess('screen', ACCESS_SCREEN.manageProfile, 'view');

        if (!active || allowed) {
          return;
        }

        Alert.alert(
          'Acesso negado',
          'Você não tem permissão para abrir Dados cadastrais.',
          [{ text: 'OK', onPress: () => router.replace('/(tabs)/dashboard') }]
        );
      })();

      return () => {
        active = false;
      };
    }, [router])
  );

  useEffect(() => {
    if (loading || !profile) {
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
    } else {
      setEditingValue(rawValue ? String(rawValue) : '');
    }

    scrollRef.current?.scrollTo({ y: 0, animated: true });
  }, [columnAccessLoading, profile, profileColumnAccess]);

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

    const actorProfileId = await getStoredProfileId();

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
    if (!editingField || !editingFieldRow) {
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
    (vehicle: ProfileVehicle) => {
      Alert.alert(
        'Excluir veículo',
        `Deseja remover o veículo de placa ${vehicle.placa}?`,
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Excluir',
            style: 'destructive',
            onPress: () => {
              void (async () => {
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
              })();
            },
          },
        ]
      );
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
      ? String(profile.full_name)
      : 'Perfil sem nome';
  const displayPhone = profile?.phone ? String(profile.phone) : 'Telefone não informado';
  const displayBirth = profile?.birth_date ? formatDisplayDateLike(String(profile.birth_date)) : 'Nascimento não informado';
  const displayFamily = profile?.family_id || profile?.codigo_membro
    ? String(profile.family_id ?? profile.codigo_membro)
    : 'Família não vinculada';
  const isLgpdPending = profile?.lgpd_accepted === false;

  const handleOpenLgpdScreen = useCallback(() => {
    const phoneForLgpd = phoneParam?.trim() || String(profile?.phone ?? '').trim();

    router.push({
      pathname: '/lgpd',
      params: phoneForLgpd ? { phone: encodeURIComponent(phoneForLgpd) } : {},
    });
  }, [phoneParam, profile?.phone, router]);

  if (screenMode === 'CAMERA') {
    return (
      <SafeAreaView style={styles.cameraScreen} edges={['top', 'left', 'right', 'bottom']}>
        <View style={styles.cameraStage}>
          <Text style={styles.cameraHint}>Afaste um pouco o rosto e centralize-o dentro do quadro.</Text>
          <View style={styles.cameraFrame}>
            <CameraView
              style={[styles.cameraView, { transform: [{ scaleX: -1 }] }]}
              ref={cameraRef}
              facing="front"
              mirror={false}
              zoom={0}
              pictureSize={pictureSize ?? undefined}
              {...(Platform.OS === 'android' ? { ratio: '4:3' as const } : {})}
              onCameraReady={() => void handleCameraReady()}
              onMountError={(event) => {
                Alert.alert('Erro na câmera', event.nativeEvent.message || 'Não foi possível abrir a câmera.');
                setScreenMode('FORM');
              }}
            />
          </View>
        </View>
        <View style={styles.cameraActions}>
          <TouchableOpacity style={styles.cameraSecondaryButton} onPress={() => setScreenMode('FORM')}>
            <Text style={styles.cameraSecondaryButtonText}>Cancelar</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.cameraPrimaryButton, !isCameraReady && styles.disabledButton]}
            disabled={!isCameraReady}
            onPress={async () => {
              const picture = await cameraRef.current?.takePictureAsync({ quality: 0.1 });
              if (picture?.uri) {
                void handleSelfieSelected(picture.uri);
              }
            }}
          >
            <Text style={styles.cameraPrimaryButtonText}>
              {isCameraReady ? 'Capturar Selfie' : 'Preparando câmera...'}
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <Text style={styles.titleCentered}>Dados Cadastrais</Text>
        {isOnboardingFlow && isProfileIncompleteForOnboarding(profile) ? (
          <Text style={styles.onboardingHint}>
            Complete as informações faltantes para finalizar seu cadastro.
          </Text>
        ) : null}
      </View>

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets={!accessPinSectionExpanded}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.selfieCard}>
          <View style={styles.selfieRow}>
            {selfiePreviewUrl ? (
              <View style={styles.selfieFrame}>
                {isSelfieLoading ? (
                  <ActivityIndicator color="#10b981" />
                ) : (
                  <Image
                    key={`${selfiePreviewKey}:${selfiePreviewUrl}`}
                    source={{ uri: selfiePreviewUrl }}
                    style={styles.selfieImage}
                    contentFit="contain"
                    cachePolicy="none"
                  />
                )}
              </View>
            ) : null}
            <View style={styles.selfieAside}>
              <View style={styles.selfieSummary}>
                <Text style={styles.summaryName}>{displayName}</Text>
                <Text style={styles.summaryMeta}>{displayPhone}</Text>
                <Text style={styles.summaryMeta}>{displayBirth}</Text>
                <Text style={styles.summaryBadge}>{displayFamily}</Text>
              </View>
              {isLgpdPending ? (
                <TouchableOpacity
                  style={styles.lgpdActionButton}
                  onPress={() => void handleOpenLgpdScreen()}
                  disabled={loading || !profile}
                >
                  <Text style={styles.lgpdActionButtonText}>LGPD</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
          <TouchableOpacity
            style={[styles.selfieActionButton, isSelfieLoading && styles.disabledButton]}
            onPress={() => void handleOpenSelfieAction()}
            disabled={isSelfieLoading || !profile}
          >
            <Text style={styles.selfieActionText}>
              {profile?.selfie_url ? 'Atualizar Selfie' : 'Tirar Selfie'}
            </Text>
          </TouchableOpacity>
        </View>

        {profile && canViewAccessPinSection ? (
          <View
            style={styles.sectionCard}
            onLayout={(event) => {
              accessPinSectionScrollYRef.current = event.nativeEvent.layout.y;
            }}
          >
            <TouchableOpacity
              style={styles.sectionHeader}
              onPress={toggleAccessPinSection}
              activeOpacity={0.85}
            >
              <View>
                <Text style={styles.sectionTitle}>Senha de acesso</Text>
                <Text style={styles.sectionMeta}>Alterar senha de 4 dígitos</Text>
              </View>
              <MaterialIcons
                name={accessPinSectionExpanded ? 'expand-less' : 'expand-more'}
                size={22}
                color="#CBD5E1"
              />
            </TouchableOpacity>

            {accessPinSectionExpanded ? (
              <View style={styles.accessPinSectionBody}>
                <Text style={styles.accessPinHint} numberOfLines={3}>
                  Defina uma senha de 4 dígitos para entrar no app. Use a senha que recebeu no
                  WhatsApp como senha atual.
                </Text>

                <AccessPinField
                  label="Senha atual"
                  value={currentAccessPin}
                  onChangeText={(text) =>
                    handleAccessPinFieldChange(text, setCurrentAccessPin, newAccessPinRef)
                  }
                  inputRef={currentAccessPinRef}
                  visible={showCurrentAccessPin}
                  onToggleVisible={() => setShowCurrentAccessPin((open) => !open)}
                  editable={canUpdateAccessPin && !savingAccessPin}
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
                  editable={canUpdateAccessPin && !savingAccessPin}
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
                  editable={canUpdateAccessPin && !savingAccessPin}
                  hasError={accessPinConfirmMismatch}
                  onFocus={lockAccessPinScrollPosition}
                  onSubmitEditing={focusSaveAccessPinButton}
                  returnKeyType="done"
                />

                <View style={styles.accessPinErrorSlot}>
                  <Text
                    style={[
                      styles.accessPinErrorText,
                      !accessPinValidationMessage && styles.accessPinErrorTextPlaceholder,
                    ]}
                    numberOfLines={2}
                  >
                    {accessPinValidationMessage ?? ' '}
                  </Text>
                </View>

                <TouchableOpacity
                  ref={saveAccessPinRef}
                  focusable={canUpdateAccessPin && !savingAccessPin}
                  style={[
                    styles.accessPinSaveButton,
                    (savingAccessPin || accessPinValidationMessage || !canUpdateAccessPin)
                      && styles.disabledButton,
                  ]}
                  onPress={() => void handleSaveAccessPin()}
                  disabled={
                    !canUpdateAccessPin || savingAccessPin || Boolean(accessPinValidationMessage)
                  }
                >
                  {savingAccessPin ? (
                    <ActivityIndicator color="#FFF" />
                  ) : (
                    <Text style={styles.saveButtonText}>Salvar nova senha</Text>
                  )}
                </TouchableOpacity>
              </View>
            ) : null}
          </View>
        ) : null}

        {editingFieldRow ? (
          <View style={styles.editorCard}>
            <Text style={styles.editorLabel}>Editar: {editingFieldRow.label}</Text>
            <TextInput
              style={styles.input}
              placeholder={editingPlaceholder}
              placeholderTextColor="#64748b"
              value={editingValue}
              editable={!saving}
              keyboardType={
                editingFieldRow.kind === 'phone'
                || editingFieldRow.kind === 'date'
                || editingFieldRow.key === 'cep'
                  ? 'number-pad'
                  : 'default'
              }
              multiline={editingFieldRow.kind === 'url'}
              onBlur={() => {
                if (editingFieldRow.kind === 'phone') {
                  setEditingValue((current) => formatPhone(current));
                }

                if (editingFieldRow.kind === 'date') {
                  setEditingValue((current) => formatDate(current));
                }

                if (editingFieldRow.key === 'cep') {
                  setEditingValue((current) => formatCep(current));
                }
              }}
              onChangeText={setEditingValue}
            />
            <View style={styles.editorActions}>
              <TouchableOpacity
                style={[styles.saveButton, saving && styles.disabledButton]}
                onPress={() => void handleSaveField()}
                disabled={saving}
              >
                <Text style={styles.saveButtonText}>{saving ? '...' : 'Salvar Campo'}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.cancelButton, saving && styles.disabledButton]}
                onPress={resetEditing}
                disabled={saving}
              >
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}

        {loading ? (
          <Text style={styles.emptyText}>Carregando perfil...</Text>
        ) : !profile ? (
          <Text style={styles.emptyText}>Perfil não encontrado.</Text>
        ) : columnAccessLoading ? (
          <Text style={styles.emptyText}>Carregando permissões dos campos...</Text>
        ) : profileSections.length === 0 ? (
          <Text style={styles.emptyText}>
            Você não tem permissão para visualizar campos deste perfil.
          </Text>
        ) : (
          <>
            {profileSections.map((section) => {
              const isExpanded = expandedSections[section.key];

              return (
                <View key={section.key} style={styles.sectionCard}>
                  <TouchableOpacity
                    style={styles.sectionHeader}
                    onPress={() => toggleSection(section.key)}
                    activeOpacity={0.85}
                  >
                    <View>
                      <Text style={styles.sectionTitle}>{section.title}</Text>
                      <Text style={styles.sectionMeta}>{section.fields.length} campo(s)</Text>
                    </View>
                    <MaterialIcons
                      name={isExpanded ? 'expand-less' : 'expand-more'}
                      size={22}
                      color="#CBD5E1"
                    />
                  </TouchableOpacity>

                  {isExpanded ? (
                    <View style={styles.sectionFields}>
                      {section.fields.map((field) => (
                        <View key={field.key} style={styles.fieldRow}>
                          <View style={styles.fieldInfoRow}>
                            <Text style={styles.fieldLabel} numberOfLines={3}>
                              {field.label}
                            </Text>
                            <Text style={styles.fieldValue} numberOfLines={6}>
                              {field.value}
                            </Text>
                          </View>
                          {!field.readOnly ? (
                            <View style={styles.actionsRow}>
                              <TouchableOpacity
                                style={styles.editButton}
                                onPress={() => startEditingField(field)}
                              >
                                <MaterialIcons name="edit" size={18} color="#FFF" />
                              </TouchableOpacity>
                            </View>
                          ) : null}
                        </View>
                      ))}
                    </View>
                  ) : null}
                </View>
              );
            })}

            <View style={styles.sectionCard}>
              <TouchableOpacity
                style={styles.sectionHeader}
                onPress={() => toggleSection('vehicles')}
                activeOpacity={0.85}
              >
                <View>
                  <Text style={styles.sectionTitle}>{SECTION_TITLES.vehicles}</Text>
                  <Text style={styles.sectionMeta}>
                    {vehicles.length} veículo(s)
                  </Text>
                </View>
                <MaterialIcons
                  name={expandedSections.vehicles ? 'expand-less' : 'expand-more'}
                  size={22}
                  color="#CBD5E1"
                />
              </TouchableOpacity>

              {expandedSections.vehicles ? (
                <>
                  {isVehicleEditorVisible ? (
                    <View style={styles.vehicleEditor}>
                      <Text style={styles.vehicleEditorTitle}>
                        {editingVehicle ? 'Editar veículo' : 'Cadastrar novo veículo'}
                      </Text>
                      <View style={styles.vehicleFormRow}>
                        <Text style={styles.vehicleFormLabel}>Placa</Text>
                        <TextInput
                          style={[styles.input, styles.vehicleFormInput]}
                          placeholder="ABC1D23"
                          placeholderTextColor="#64748b"
                          value={vehicleForm.placa}
                          onChangeText={(text) =>
                            setVehicleForm((current) => ({ ...current, placa: text }))
                          }
                          autoCapitalize="characters"
                        />
                      </View>
                      <View style={styles.vehicleFormRow}>
                        <Text style={styles.vehicleFormLabel}>Marca</Text>
                        <TextInput
                          style={[styles.input, styles.vehicleFormInput]}
                          placeholder="Marca"
                          placeholderTextColor="#64748b"
                          value={vehicleForm.marca}
                          onChangeText={(text) =>
                            setVehicleForm((current) => ({ ...current, marca: text }))
                          }
                        />
                      </View>
                      <View style={styles.vehicleFormRow}>
                        <Text style={styles.vehicleFormLabel}>Modelo</Text>
                        <TextInput
                          style={[styles.input, styles.vehicleFormInput]}
                          placeholder="Modelo"
                          placeholderTextColor="#64748b"
                          value={vehicleForm.modelo}
                          onChangeText={(text) =>
                            setVehicleForm((current) => ({ ...current, modelo: text }))
                          }
                        />
                      </View>
                      <View style={styles.vehicleFormRow}>
                        <Text style={styles.vehicleFormLabel}>Cor</Text>
                        <TextInput
                          style={[styles.input, styles.vehicleFormInput]}
                          placeholder="Cor"
                          placeholderTextColor="#64748b"
                          value={vehicleForm.cor}
                          onChangeText={(text) =>
                            setVehicleForm((current) => ({ ...current, cor: text }))
                          }
                        />
                      </View>
                      <View style={styles.editorActions}>
                        <TouchableOpacity
                          style={[styles.saveButton, savingVehicle && styles.disabledButton]}
                          onPress={() => void handleSaveVehicle()}
                          disabled={savingVehicle}
                        >
                          <Text style={styles.saveButtonText}>
                            {savingVehicle ? '...' : 'Salvar Veículo'}
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.cancelButton, savingVehicle && styles.disabledButton]}
                          onPress={resetVehicleEditing}
                          disabled={savingVehicle}
                        >
                          <Text style={styles.cancelButtonText}>Cancelar</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ) : null}

                  <View style={styles.sectionFields}>
                    {loadingVehicles ? (
                      <Text style={styles.emptyText}>Carregando veículos...</Text>
                    ) : vehicles.length === 0 ? (
                      <Text style={styles.emptyText}>Nenhum veículo cadastrado para este perfil.</Text>
                    ) : (
                      vehicles.map((vehicle) => (
                        <View key={vehicle.id} style={styles.vehicleRow}>
                          <View style={styles.vehicleInfo}>
                            <View style={styles.vehicleDetailRow}>
                              <Text style={styles.vehicleDetailLabel}>Placa</Text>
                              <Text style={styles.vehicleDetailValue}>{vehicle.placa}</Text>
                            </View>
                            <View style={styles.vehicleDetailRow}>
                              <Text style={styles.vehicleDetailLabel}>Marca</Text>
                              <Text style={styles.vehicleDetailValue}>
                                {vehicle.marca?.trim() || '—'}
                              </Text>
                            </View>
                            <View style={styles.vehicleDetailRow}>
                              <Text style={styles.vehicleDetailLabel}>Modelo</Text>
                              <Text style={styles.vehicleDetailValue}>
                                {vehicle.modelo?.trim() || '—'}
                              </Text>
                            </View>
                            <View style={styles.vehicleDetailRow}>
                              <Text style={styles.vehicleDetailLabel}>Cor</Text>
                              <Text style={styles.vehicleDetailValue}>
                                {vehicle.cor?.trim() || '—'}
                              </Text>
                            </View>
                          </View>
                          <View style={styles.vehicleActionsColumn}>
                            <TouchableOpacity
                              style={[
                                styles.editButton,
                                (deletingVehicleId === vehicle.id || savingVehicle) && styles.disabledButton,
                              ]}
                              onPress={() => startEditingVehicle(vehicle)}
                              disabled={deletingVehicleId === vehicle.id || savingVehicle}
                            >
                              <MaterialIcons name="edit" size={18} color="#FFF" />
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={[
                                styles.deleteVehicleButton,
                                (deletingVehicleId === vehicle.id || savingVehicle) && styles.disabledButton,
                              ]}
                              onPress={() => handleDeleteVehicle(vehicle)}
                              disabled={deletingVehicleId === vehicle.id || savingVehicle}
                            >
                              {deletingVehicleId === vehicle.id ? (
                                <ActivityIndicator color="#FFF" size="small" />
                              ) : (
                                <MaterialIcons name="delete" size={18} color="#FFF" />
                              )}
                            </TouchableOpacity>
                          </View>
                        </View>
                      ))
                    )}
                  </View>

                  <TouchableOpacity
                    style={styles.newVehicleButton}
                    onPress={startNewVehicle}
                  >
                    <Text style={styles.newVehicleButtonText}>Cadastrar novo veículo</Text>
                  </TouchableOpacity>
                </>
              ) : null}
            </View>

            {/* Seção Vincular a Familia — oculta temporariamente
            <View style={styles.sectionCard}>
              <TouchableOpacity
                style={styles.sectionHeader}
                onPress={() => toggleSection('family_link')}
                activeOpacity={0.85}
              >
                <View>
                  <Text style={styles.sectionTitle}>{SECTION_TITLES.family_link}</Text>
                  <Text style={styles.sectionMeta}>
                    {searchedFamilyId
                      ? `${familyMembers.length} membro(s) · ${searchedFamilyId}`
                      : 'Busque pelo nome de um membro da família'}
                  </Text>
                </View>
                <MaterialIcons
                  name={expandedSections.family_link ? 'expand-less' : 'expand-more'}
                  size={22}
                  color="#CBD5E1"
                />
              </TouchableOpacity>

              {expandedSections.family_link ? (
                <View style={styles.familyLinkSection}>
                  <View style={styles.familyFormRow}>
                    <TextInput
                      style={[styles.input, styles.familyFormInput]}
                      placeholder="Nome do membro da família"
                      placeholderTextColor="#64748b"
                      value={familySearchInput}
                      onChangeText={(text) => {
                        setFamilySearchInput(text);
                        setSearchedFamilyId('');
                        setSelectedFamilyMemberId(null);
                        setFamilyNameSearchResults([]);
                      }}
                      autoCapitalize="words"
                      autoCorrect={false}
                    />
                  </View>

                  {searchingFamily ? (
                    <ActivityIndicator color="#10b981" style={styles.familyNameSearchLoader} />
                  ) : null}

                  {canSearchFamilyByMemberName(familySearchInput) && !searchingFamily && !searchedFamilyId ? (
                    <View style={styles.familyNameSearchResults}>
                      {familyNameSearchResults.length ? (
                        familyNameSearchResults.map((result) => (
                          <TouchableOpacity
                            key={result.key}
                            style={styles.familyNameSearchResultRow}
                            onPress={() => handleSelectFamilyNameSearchResult(result)}
                            activeOpacity={0.85}
                          >
                            <Text style={styles.familyNameSearchResultName}>
                              {formatShortName(result.fullName)}
                            </Text>
                            <Text style={styles.familyNameSearchResultMeta}>
                              {[result.familyId, result.phone].filter(Boolean).join(' · ')}
                            </Text>
                          </TouchableOpacity>
                        ))
                      ) : (
                        <Text style={styles.familyNameSearchEmpty}>
                          Nenhum membro encontrado com este nome.
                        </Text>
                      )}
                    </View>
                  ) : !searchedFamilyId ? (
                    <Text style={styles.familyNameSearchHint}>
                      Digite pelo menos 2 letras para buscar.
                    </Text>
                  ) : null}

                  <Text style={styles.familyMembersTitle}>Membros da família</Text>
                  {isSearchedFamilySameAsCurrent ? (
                    <Text style={styles.familyMembersHint}>
                      Esta é a sua família atual. Não é possível solicitar vínculo com membros já
                      vinculados a você.
                    </Text>
                  ) : searchedFamilyId && familyMembers.length > 0 ? (
                    <Text style={styles.familyMembersHint}>
                      Selecione um membro para solicitar o vínculo familiar.
                    </Text>
                  ) : null}

                  {loadingFamilyMembers ? (
                    <Text style={styles.emptyText}>Carregando membros...</Text>
                  ) : !searchedFamilyId ? (
                    <Text style={styles.emptyText}>
                      Selecione um membro na busca por nome para visualizar a família.
                    </Text>
                  ) : familyMembers.length === 0 ? (
                    <Text style={styles.emptyText}>Nenhum membro cadastrado nesta família.</Text>
                  ) : (
                    familyMembers.map((member) => {
                      const isSelected = selectedFamilyMemberId === member.id;
                      const memberRowDisabled = isSearchedFamilySameAsCurrent;

                      return (
                        <TouchableOpacity
                          key={member.id}
                          style={[
                            styles.familyMemberRow,
                            isSelected && styles.familyMemberRowSelected,
                            memberRowDisabled && styles.familyMemberRowDisabled,
                          ]}
                          onPress={() => {
                            if (memberRowDisabled) {
                              return;
                            }

                            setSelectedFamilyMemberId(member.id);
                          }}
                          activeOpacity={memberRowDisabled ? 1 : 0.85}
                          disabled={memberRowDisabled}
                        >
                          <View style={styles.familyMemberInfo}>
                            <Text style={styles.familyMemberName} numberOfLines={1}>
                              {member.full_name}
                            </Text>
                            <Text style={styles.familyMemberMeta} numberOfLines={1}>
                              {member.relationship?.trim() || 'Parentesco não informado'}
                              {member.phone ? ` · ${member.phone}` : ''}
                            </Text>
                          </View>
                          <View
                            style={[
                              styles.familyMemberSelector,
                              isSelected && styles.familyMemberSelectorChecked,
                            ]}
                          >
                            {isSelected ? (
                              <MaterialIcons name="check" size={14} color="#0f172a" />
                            ) : null}
                          </View>
                        </TouchableOpacity>
                      );
                    })
                  )}

                  <TouchableOpacity
                    style={[
                      styles.familyManageButton,
                      (!searchedFamilyId ||
                        !selectedFamilyMemberId ||
                        requestingFamilyLink ||
                        isSearchedFamilySameAsCurrent) &&
                        styles.disabledButton,
                    ]}
                    onPress={() => void handleRequestFamilyLink()}
                    disabled={
                      !searchedFamilyId ||
                      !selectedFamilyMemberId ||
                      requestingFamilyLink ||
                      isSearchedFamilySameAsCurrent
                    }
                    activeOpacity={0.85}
                  >
                    {requestingFamilyLink ? (
                      <ActivityIndicator color="#6EE7B7" size="small" />
                    ) : (
                      <Text style={styles.familyManageButtonText}>Solicitar vínculo familiar</Text>
                    )}
                  </TouchableOpacity>
                </View>
              ) : null}
            </View>
            */}
          </>
        )}
      </ScrollView>

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
  header: { padding: 20, paddingBottom: 10 },
  titleCentered: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFF',
    textAlign: 'center',
  },
  onboardingHint: {
    marginTop: 8,
    color: '#6EE7B7',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 12,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
  selfieCard: {
    backgroundColor: '#1e293b',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#334155',
    gap: 14,
  },
  selfieRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
  },
  selfieFrame: {
    width: '34%',
    maxWidth: 140,
    minWidth: 124,
    aspectRatio: 3 / 4,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#0f172a',
    borderWidth: 2,
    borderColor: '#10b981',
    alignItems: 'center',
    justifyContent: 'center',
  },
  selfieImage: {
    width: '100%',
    height: '100%',
  },
  selfieAside: {
    flex: 1,
    gap: 10,
    alignSelf: 'stretch',
    justifyContent: 'space-between',
  },
  selfieSummary: {
    gap: 6,
    alignSelf: 'flex-start',
    paddingTop: 2,
  },
  lgpdActionButton: {
    alignSelf: 'stretch',
    backgroundColor: '#B91C1C',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lgpdActionButtonText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  summaryName: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '800',
  },
  summaryMeta: {
    color: '#CBD5E1',
    fontSize: 13,
  },
  summaryBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(16, 185, 129, 0.14)',
    color: '#A7F3D0',
    fontSize: 12,
    fontWeight: '700',
  },
  selfieActionButton: {
    backgroundColor: '#10b981',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  selfieActionText: {
    color: '#062E26',
    fontSize: 15,
    fontWeight: '800',
  },
  accessPinSectionBody: {
    paddingHorizontal: 15,
    paddingBottom: 15,
    minHeight: ACCESS_PIN_SECTION_BODY_MIN_HEIGHT,
  },
  accessPinHint: {
    color: '#94A3B8',
    fontSize: 13,
    lineHeight: 18,
    height: 54,
    marginBottom: 12,
  },
  accessPinFieldLabel: {
    color: '#CBD5E1',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 6,
  },
  accessPinErrorSlot: {
    height: 40,
    justifyContent: 'center',
    marginBottom: 4,
  },
  accessPinErrorText: {
    color: '#f87171',
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  accessPinErrorTextPlaceholder: {
    color: 'transparent',
  },
  accessPinSaveButton: {
    backgroundColor: '#10b981',
    height: 50,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editorCard: {
    backgroundColor: '#1e293b',
    borderRadius: 14,
    padding: 15,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  editorLabel: {
    color: '#10b981',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 10,
    textAlign: 'center',
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
  editorActions: {
    flexDirection: 'row',
    gap: 10,
  },
  saveButton: {
    flex: 1,
    backgroundColor: '#10b981',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#FFF',
    fontWeight: '800',
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#334155',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#FFF',
    fontWeight: '700',
  },
  disabledButton: {
    opacity: 0.45,
  },
  sectionCard: {
    backgroundColor: '#1e293b',
    borderRadius: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#334155',
    overflow: 'hidden',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 15,
    paddingVertical: 14,
  },
  sectionTitle: {
    color: '#E2E8F0',
    fontSize: 15,
    fontWeight: '800',
  },
  sectionMeta: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 2,
  },
  sectionFields: {
    paddingHorizontal: 10,
    paddingBottom: 10,
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0f172a',
    borderRadius: 10,
    padding: 14,
    marginTop: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#10b981',
  },
  fieldInfoRow: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  fieldLabel: {
    width: '34%',
    maxWidth: 112,
    flexShrink: 0,
    color: '#CBD5E1',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    lineHeight: 16,
  },
  fieldValue: {
    flex: 1,
    minWidth: 0,
    color: '#FFF',
    fontSize: 13,
    lineHeight: 18,
  },
  actionsRow: {
    width: 40,
    marginLeft: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  editButton: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0EA5E9',
  },
  vehicleActionsColumn: {
    marginLeft: 12,
    alignItems: 'center',
    gap: 8,
  },
  deleteVehicleButton: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#DC2626',
  },
  vehicleEditor: {
    marginTop: 16,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#020617',
    borderWidth: 1,
    borderColor: '#1E293B',
    gap: 0,
  },
  vehicleEditorTitle: {
    color: '#E2E8F0',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 10,
  },
  vehicleFormRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 8,
  },
  vehicleFormLabel: {
    width: '30%',
    maxWidth: 100,
    flexShrink: 0,
    paddingTop: 13,
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
  },
  vehicleFormInput: {
    flex: 1,
    minWidth: 0,
    marginBottom: 0,
    paddingVertical: 11,
    paddingHorizontal: 12,
    fontSize: 14,
  },
  vehicleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  vehicleInfo: {
    flex: 1,
    minWidth: 0,
    paddingRight: 8,
    gap: 4,
  },
  vehicleDetailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  vehicleDetailLabel: {
    width: '30%',
    maxWidth: 100,
    flexShrink: 0,
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
  },
  vehicleDetailValue: {
    flex: 1,
    minWidth: 0,
    color: '#E2E8F0',
    fontSize: 14,
    lineHeight: 20,
  },
  newVehicleButton: {
    marginTop: 12,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#38BDF8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  newVehicleButtonText: {
    color: '#38BDF8',
    fontSize: 14,
    fontWeight: '600',
  },
  // familyLinkSection: {
  //   gap: 12,
  //   paddingTop: 4,
  // },
  // familyHint: {
  //   color: '#94A3B8',
  //   fontSize: 13,
  //   lineHeight: 18,
  // },
  // familyFormRow: {
  //   gap: 6,
  // },
  // familyFormLabel: {
  //   color: '#94A3B8',
  //   fontSize: 12,
  //   fontWeight: '600',
  // },
  // familyFormInput: {
  //   marginBottom: 0,
  // },
  // familyNameSearchLoader: {
  //   marginBottom: 8,
  // },
  // familyNameSearchResults: {
  //   backgroundColor: '#0f172a',
  //   borderWidth: 1,
  //   borderColor: '#334155',
  //   borderRadius: 10,
  //   marginBottom: 12,
  //   maxHeight: 180,
  //   overflow: 'hidden',
  // },
  // familyNameSearchResultRow: {
  //   paddingHorizontal: 12,
  //   paddingVertical: 10,
  //   borderBottomWidth: 1,
  //   borderBottomColor: '#1e293b',
  // },
  // familyNameSearchResultName: {
  //   color: '#F8FAFC',
  //   fontSize: 14,
  //   fontWeight: '700',
  // },
  // familyNameSearchResultMeta: {
  //   color: '#94A3B8',
  //   fontSize: 12,
  //   marginTop: 2,
  // },
  // familyNameSearchEmpty: {
  //   color: '#94A3B8',
  //   fontSize: 12,
  //   lineHeight: 17,
  //   padding: 12,
  // },
  // familyNameSearchHint: {
  //   color: '#94A3B8',
  //   fontSize: 12,
  //   lineHeight: 17,
  //   marginBottom: 12,
  // },
  // familyLinkButton: {
  //   backgroundColor: '#10b981',
  //   borderRadius: 12,
  //   paddingVertical: 14,
  //   alignItems: 'center',
  //   justifyContent: 'center',
  // },
  // familyLinkButtonText: {
  //   color: '#0f172a',
  //   fontSize: 15,
  //   fontWeight: '800',
  // },
  // familyMembersTitle: {
  //   color: '#E2E8F0',
  //   fontSize: 14,
  //   fontWeight: '700',
  //   marginTop: 4,
  // },
  // familyMembersHint: {
  //   color: '#94A3B8',
  //   fontSize: 12,
  //   lineHeight: 16,
  // },
  // familyMemberRow: {
  //   flexDirection: 'row',
  //   alignItems: 'center',
  //   gap: 10,
  //   paddingVertical: 10,
  //   paddingHorizontal: 8,
  //   borderRadius: 10,
  //   borderBottomWidth: 1,
  //   borderBottomColor: '#1E293B',
  // },
  // familyMemberRowSelected: {
  //   backgroundColor: 'rgba(16, 185, 129, 0.12)',
  //   borderBottomColor: 'rgba(16, 185, 129, 0.35)',
  // },
  // familyMemberRowDisabled: {
  //   opacity: 0.45,
  // },
  // familyMemberInfo: {
  //   flex: 1,
  //   gap: 2,
  //   minWidth: 0,
  // },
  // familyMemberSelector: {
  //   width: 24,
  //   height: 24,
  //   borderRadius: 6,
  //   borderWidth: 2,
  //   borderColor: '#64748B',
  //   alignItems: 'center',
  //   justifyContent: 'center',
  //   flexShrink: 0,
  // },
  // familyMemberSelectorChecked: {
  //   borderColor: '#10b981',
  //   backgroundColor: '#10b981',
  // },
  // familyMemberName: {
  //   color: '#F8FAFC',
  //   fontSize: 15,
  //   fontWeight: '600',
  // },
  // familyMemberMeta: {
  //   color: '#94A3B8',
  //   fontSize: 12,
  // },
  // familyManageButton: {
  //   marginTop: 4,
  //   paddingVertical: 10,
  //   borderRadius: 999,
  //   borderWidth: 1,
  //   borderColor: '#10b981',
  //   alignItems: 'center',
  //   justifyContent: 'center',
  // },
  // familyManageButtonText: {
  //   color: '#6EE7B7',
  //   fontSize: 14,
  //   fontWeight: '600',
  // },
  disabledIconButton: {
    opacity: 0.35,
  },
  emptyText: {
    color: '#94A3B8',
    fontSize: 16,
    textAlign: 'center',
    paddingVertical: 20,
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
  backButtonText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 14,
  },
  cameraScreen: {
    flex: 1,
    backgroundColor: '#020617',
  },
  cameraView: {
    flex: 1,
  },
  cameraStage: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingBottom: 120,
  },
  cameraHint: {
    color: '#CBD5E1',
    textAlign: 'center',
    marginBottom: 14,
    fontSize: 14,
    fontWeight: '600',
  },
  cameraFrame: {
    width: '100%',
    aspectRatio: 3 / 4,
    borderRadius: 28,
    overflow: 'hidden',
    alignSelf: 'center',
    borderWidth: 2,
    borderColor: '#10b981',
    backgroundColor: '#020617',
  },
  cameraActions: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: 36,
    flexDirection: 'row',
    gap: 10,
  },
  cameraPrimaryButton: {
    flex: 1,
    backgroundColor: '#10b981',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
  },
  cameraPrimaryButtonText: {
    color: '#062E26',
    fontWeight: '800',
  },
  cameraSecondaryButton: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#475569',
  },
  cameraSecondaryButtonText: {
    color: '#FFF',
    fontWeight: '700',
  },
});
