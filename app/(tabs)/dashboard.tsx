import { CheckinModal } from '@/components/CheckinModal';
import { ParkingVehicleIdentifyPanel } from '@/components/ParkingVehicleIdentifyPanel';
import { FamilyEventSelector } from '@/components/FamilyEventSelector';
import { FamilyRegistrationList } from '@/components/FamilyRegistrationList';
import { ActiveScreenBadge } from '@/components/ui/ActiveScreenBadge';
import { CardLoadingState } from '@/components/ui/CardLoadingState';
import { CarouselFooterNav } from '@/components/ui/CarouselFooterNav';
import { DropdownSelect } from '@/components/ui/DropdownSelect';
import { useDashboardSelectedEvent, useEventRegistrationsByStatus } from '@/hooks';
import { useFamilyPreCheckin } from '@/hooks/useFamilyPreCheckin';
import { getAppParameterValue } from '@/lib/appParameters';
import { OFFERINGS_RECIPIENT_ROWS } from '@/lib/offeringsRecipientInfo';
import {
  APP_PARAMETER,
  eventRequiresQrCheckIn,
  eventUsesAutomaticAudienceCheckIn,
  isAppParameterNo,
  isEventCalendarToday,
  resolveQrCheckInCardVisible,
} from '@/lib/checkInVisibility';
import { formatEventDateTimeLabel } from '@/lib/eventDate';
import { resolveFamilyIdForPhone } from '@/lib/family';
import {
  fetchMembersDirectoryFromProfiles,
  fetchVisitorsDirectoryFromProfiles,
} from '@/lib/membersListApi';
import { prefetchProfilesMapMarkers } from '@/lib/syncProfilesMapMarkers';
import { loadSessionProfile } from '@/lib/loadSessionProfile';
import { lookupVehicleByPlaca, type VehicleLookupResult } from '@/lib/profileVehicleLookup';
import { buildPhoneDbQueryVariants } from '@/lib/phoneDbVariants';
import { fetchVolunteersForScaleType } from '@/lib/maintenanceScaleVolunteersApi';
import { supabase } from '@/lib/supabase';
import { FontAwesome } from '@expo/vector-icons';
import {
  ACCESS_SCREEN,
  ACL_UNAVAILABLE_MESSAGE,
  getAccessControlRpcStatus,
  isDashboardCardContentAllowed,
  loadDashboardCardViewAccess,
  profileHasAccess,
  type DashboardCardViewAccess,
} from '@/lib/accessControl';
import {
  getStoredUserPhone,
  persistProfileId,
  repairUserSessionReference,
  signOutAndReturnToLogin,
} from '@/lib/userSession';
import { normalizePhoneForWhatsApp, openMemberWhatsapp } from '@/lib/whatsapp';
import { computeResponsiveCardInsets } from '@/lib/uiTokens';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Linking from 'expo-linking';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  AppState,
  FlatList,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

const STATIC_CARD_INSETS = computeResponsiveCardInsets(390);

const DASHBOARD_HEADER_RESERVE = 100;
/** Botões < / Sair / >, margens e padding inferior extra (além do safe area). */
const DASHBOARD_FOOTER_RESERVE = 98;
const FOOTER_NAV_REPEAT_MS = 500;

/** Altura dos cards sem sobrepor o header nem os botões inferiores (<, Sair, >). */
const computeDashboardCardHeight = (
  screenHeight: number,
  topInset: number,
  bottomInset: number
) => {
  const available =
    screenHeight
    - topInset
    - bottomInset
    - DASHBOARD_HEADER_RESERVE
    - DASHBOARD_FOOTER_RESERVE
    - 20;

  return Math.max(280, Math.min(available, Math.round(screenHeight * 0.72)));
};

/** Card Agenda da Família: um pouco mais alto que o padrão (audiência visível sem ocupar a tela inteira). */
const computeEventPanelCardHeight = (
  screenHeight: number,
  topInset: number,
  bottomInset: number
) => {
  const available =
    screenHeight
    - topInset
    - bottomInset
    - DASHBOARD_HEADER_RESERVE
    - DASHBOARD_FOOTER_RESERVE
    - 14;

  const base = computeDashboardCardHeight(screenHeight, topInset, bottomInset);

  return Math.max(base + 28, Math.min(available, Math.round(screenHeight * 0.78)));
};

type DashboardProfile = {
  id?: string;
  full_name?: string;
  codigo_membro?: string;
  lgpd_accepted?: boolean | null;
  birth_date?: string | null;
  phone?: string | null;
};

type DashboardCard = {
  id: string;
  title: string;
  content:
    | 'event_alt'
    | 'qr'
    | 'offerings'
    | 'kids_teens'
    | 'pastoral'
    | 'birthdays'
    | 'members_list'
    | 'financial'
    | 'vigilance_scales'
    | 'parking_vehicle_v2'
    | 'scale_roster'
    | 'grouped_manage';
};

type GroupedRoomConfig = {
  key: 'KIDS' | 'TEENS';
  label: string;
  checkedCount: number;
  totalCount: number;
  headerStyle: object;
  dotStyle: object;
};

type BirthdayEntry = {
  full_name: string;
  birth_date: string;
  phone: string | null;
  day: number;
  month: number;
};

type MemberListEntry = {
  id: string;
  full_name: string;
  short_name: string;
  family_id: string;
  relationship: string | null;
  phone: string | null;
};

const dedupeMemberListEntries = (entries: MemberListEntry[]) => {
  const byPerson = new Map<string, MemberListEntry>();

  for (const entry of entries) {
    const key = `${normalizeParameterValue(entry.full_name)}|${normalizeParameterValue(entry.family_id)}`;
    const current = byPerson.get(key);

    if (!current) {
      byPerson.set(key, entry);
      continue;
    }

    const currentHasPhone = Boolean(cleanPhoneDigits(current.phone));
    const nextHasPhone = Boolean(cleanPhoneDigits(entry.phone));

    if (!currentHasPhone && nextHasPhone) {
      byPerson.set(key, entry);
      continue;
    }

    const currentHasRelationship = Boolean((current.relationship ?? '').trim());
    const nextHasRelationship = Boolean((entry.relationship ?? '').trim());

    if (!currentHasRelationship && nextHasRelationship) {
      byPerson.set(key, entry);
    }
  }

  return Array.from(byPerson.values()).sort((left, right) =>
    left.full_name.localeCompare(right.full_name, 'pt-BR')
  );
};

type ProfilePhoneRow = {
  full_name: string | null;
  phone: string | null;
  family_id?: string | null;
  codigo_membro?: string | null;
};

type ScaleTypeEntry = {
  id: string;
  code: string;
  name: string;
};

type VigilanceScaleEntry = {
  id: string;
  scale_id: string;
  scale_code: string;
  scale_name: string;
  data_servico: string;
  voluntario_id: string;
  volunteer_name: string;
  volunteer_phone: string | null;
};

type ScaleTypeRow = {
  id?: string | null;
  codigo?: string | null;
  nome?: string | null;
};

type VigilanceScaleRow = {
  id?: string | null;
  tipo_escala_id?: string | null;
  tipo_escala_codigo?: string | null;
  tipo_escala_nome?: string | null;
  data_servico?: string | null;
  voluntario_id?: string | null;
  volunteer_name?: string | null;
};

const formatDisplayName = (fullName: string) => {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);

  if (parts.length <= 1) {
    return parts[0] ?? fullName;
  }

  return `${parts[0]} ${parts[parts.length - 1]}`;
};

/** Degradê azul ardósia (contrasta com manutenção âmbar/pedra). */
const MAIN_SCREEN_GRADIENT = ['#1e3a5f', '#0f172a', '#020617'] as const;

const normalizeParameterValue = (value: string | null | undefined) =>
  (value ?? '')
    .trim()
    .toLocaleLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

const cleanPhoneDigits = (value: string | null | undefined) => (value ?? '').replace(/\D/g, '');

const resolveProfilePhoneForMember = (
  member: { full_name: string; phone: string | null; family_id: string },
  profiles: ProfilePhoneRow[]
) => {
  const memberPhone = member.phone?.trim() || null;
  const normalizedMemberPhone = cleanPhoneDigits(memberPhone);
  const normalizedName = member.full_name.trim().toLowerCase();
  const normalizedFamilyId = member.family_id.trim();

  if (memberPhone) {
    const byPhone = profiles.find((profile) => {
      if (!profile.phone) {
        return false;
      }

      return (
        profile.phone === memberPhone
        || cleanPhoneDigits(profile.phone) === normalizedMemberPhone
      );
    });

    if (byPhone?.phone) {
      return String(byPhone.phone);
    }
  }

  const byFamilyAndName = profiles.find((profile) => {
    const profileFamily = (profile.family_id ?? profile.codigo_membro ?? '').trim();
    const profileName = profile.full_name?.trim().toLowerCase() ?? '';

    return (
      profileFamily === normalizedFamilyId
      && profileName === normalizedName
      && Boolean(profile.phone)
    );
  });

  if (byFamilyAndName?.phone) {
    return String(byFamilyAndName.phone);
  }

  const byName = profiles.find((profile) => {
    const profileName = profile.full_name?.trim().toLowerCase() ?? '';
    return profileName === normalizedName && Boolean(profile.phone);
  });

  return byName?.phone ? String(byName.phone) : null;
};

const resolveProfilePhoneForVolunteerName = (
  volunteerName: string,
  profiles: ProfilePhoneRow[]
) => {
  const normalizedName = normalizeParameterValue(volunteerName);

  if (!normalizedName) {
    return null;
  }

  const byFullName = profiles.find((profile) => {
    const profileName = normalizeParameterValue(profile.full_name ?? '');
    return profileName === normalizedName && Boolean(profile.phone);
  });

  if (byFullName?.phone) {
    return String(byFullName.phone);
  }

  const byShortName = profiles.find((profile) => {
    if (!profile.full_name || !profile.phone) {
      return false;
    }

    const shortName = normalizeParameterValue(formatDisplayName(profile.full_name));
    return shortName === normalizedName;
  });

  return byShortName?.phone ? String(byShortName.phone) : null;
};

const normalizePhoneDigits = (value: string | null | undefined) =>
  (value ?? '').replace(/\D/g, '');

const isParkingWelcomeScale = (scaleName: string, scaleCode: string) => {
  const normalizedName = normalizeParameterValue(scaleName);
  const normalizedCode = normalizeParameterValue(scaleCode);

  return (
    (normalizedName.includes('acolhimento') && normalizedName.includes('estacionamento'))
    || normalizedName.includes('acolhimentoestacionamento')
    || normalizedCode.includes('acolhimento_estacionamento')
    || normalizedCode.includes('acolhimentoestacionamento')
    || normalizedCode === 'vigilancia_estacionamento'
    || normalizedCode.includes('vigilancia_estacionamento')
    || (normalizedName.includes('vigilancia') && normalizedName.includes('estacionamento'))
    || normalizedName.includes('estacionamento')
  );
};

const isIntercessionScale = (scaleName: string, scaleCode: string) => {
  const normalizedName = normalizeParameterValue(scaleName);
  const normalizedCode = normalizeParameterValue(scaleCode);

  return (
    normalizedName.includes('intercess')
    || normalizedCode.includes('intercess')
    || (normalizedName.includes('ministerio') && normalizedName.includes('intercess'))
  );
};

type ScaleRosterVolunteerEntry = {
  id: string;
  name: string;
  phone: string | null;
};

const BIRTHDAY_MONTHS = [
  { value: '1', label: 'Janeiro' },
  { value: '2', label: 'Fevereiro' },
  { value: '3', label: 'Março' },
  { value: '4', label: 'Abril' },
  { value: '5', label: 'Maio' },
  { value: '6', label: 'Junho' },
  { value: '7', label: 'Julho' },
  { value: '8', label: 'Agosto' },
  { value: '9', label: 'Setembro' },
  { value: '10', label: 'Outubro' },
  { value: '11', label: 'Novembro' },
  { value: '12', label: 'Dezembro' },
] as const;

const parseBirthdayParts = (value: string | null | undefined) => {
  if (!value) {
    return null;
  }

  const normalizedValue = String(value).trim();
  const isoMatch = normalizedValue.match(/^(\d{4})-(\d{2})-(\d{2})/);

  if (isoMatch) {
    const month = Number.parseInt(isoMatch[2], 10);
    const day = Number.parseInt(isoMatch[3], 10);

    if (Number.isFinite(month) && Number.isFinite(day)) {
      return { month, day };
    }
  }

  const brMatch = normalizedValue.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);

  if (brMatch) {
    const day = Number.parseInt(brMatch[1], 10);
    const month = Number.parseInt(brMatch[2], 10);

    if (Number.isFinite(month) && Number.isFinite(day)) {
      return { month, day };
    }
  }

  return null;
};

const formatBirthdayDayMonth = (day: number, month: number) =>
  `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}`;

const formatServiceDateLabel = (value: string | null | undefined) => {
  if (!value) {
    return 'Escala';
  }

  const normalizedValue = String(value).trim();
  const isoMatch = normalizedValue.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (isoMatch) {
    return `${isoMatch[3]}/${isoMatch[2]}/${isoMatch[1].slice(-2)}`;
  }

  return normalizedValue;
};

const getCurrentBirthdayMonth = () => String(new Date().getMonth() + 1);
const getCurrentLocalIsoDate = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
};

export default function Dashboard() {
  const { width: pageWidth, height: windowHeight } = useWindowDimensions();
  const previousPageWidthRef = useRef(pageWidth);
  const carouselPageStyle = useMemo(() => ({ width: pageWidth }), [pageWidth]);

  const dashboardListRef = useRef<FlatList<DashboardCard>>(null);
  const pixFeedbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handledDashboardCardRef = useRef<string | null>(null);
  const previousDashboardCardIndexRef = useRef(0);
  const footerNavRepeatIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const footerNavRepeatActiveRef = useRef(false);
  const currentIndexRef = useRef(0);
  const scrollToParkingCardRef = useRef(false);
  const scrollToScaleRosterRef = useRef(false);
  const scrollToScalesCardRef = useRef(false);
  const [profile, setProfile] = useState<DashboardProfile | null>(null);
  const [userPhone, setUserPhone] = useState<string | null>(null);
  const [isProfileLoading, setIsProfileLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isSalaRegistrationsEnabled, setIsSalaRegistrationsEnabled] = useState(false);
  const birthdaysLoadedRef = useRef(false);
  const membersListLoadedRef = useRef(false);
  const membersMapPrefetchStartedRef = useRef(false);
  const vigilanceScalesLoadedRef = useRef(false);
  const [isFooterSettingsPressed, setIsFooterSettingsPressed] = useState(false);
  const [canViewMaintenance, setCanViewMaintenance] = useState(false);
  const [isMaintenanceAccessLoading, setIsMaintenanceAccessLoading] = useState(true);
  const [dashboardCardAccess, setDashboardCardAccess] = useState<DashboardCardViewAccess>({});
  const [aclRpcStatus, setAclRpcStatus] = useState<'unknown' | 'available' | 'missing'>('unknown');
  const [modalVisible, setModalVisible] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [familyId, setFamilyId] = useState<string | null>(null);
  const [pixKey, setPixKey] = useState<string | null>(null);
  const [isPixKeyLoading, setIsPixKeyLoading] = useState(true);
  const [pixFeedbackMessage, setPixFeedbackMessage] = useState<string | null>(null);
  const [qrCodeAtivoEnabled, setQrCodeAtivoEnabled] = useState(true);
  const [checkInManualMode, setCheckInManualMode] = useState(false);
  const [selectedGroupedRoom, setSelectedGroupedRoom] = useState<'KIDS' | 'TEENS' | null>(null);
  const [birthdayEntries, setBirthdayEntries] = useState<BirthdayEntry[]>([]);
  const [isBirthdaysLoading, setIsBirthdaysLoading] = useState(true);
  const [birthdaysError, setBirthdaysError] = useState<string | null>(null);
  const [memberListEntries, setMemberListEntries] = useState<MemberListEntry[]>([]);
  const [visitorListEntries, setVisitorListEntries] = useState<MemberListEntry[]>([]);
  const [membersListAudience, setMembersListAudience] = useState<'members' | 'visitors'>('members');
  const [isMembersListLoading, setIsMembersListLoading] = useState(true);
  const [isVisitorsListLoading, setIsVisitorsListLoading] = useState(false);
  const [membersListError, setMembersListError] = useState<string | null>(null);
  const [membersListSearchQuery, setMembersListSearchQuery] = useState('');
  const visitorsListLoadedRef = useRef(false);
  const [familyModalFamilyId, setFamilyModalFamilyId] = useState<string | null>(null);
  const [selectedBirthdayMonth, setSelectedBirthdayMonth] = useState(getCurrentBirthdayMonth);
  const [scaleTypes, setScaleTypes] = useState<ScaleTypeEntry[]>([]);
  const [vigilanceScaleEntries, setVigilanceScaleEntries] = useState<VigilanceScaleEntry[]>([]);
  const [isVigilanceScalesLoading, setIsVigilanceScalesLoading] = useState(true);
  const [vigilanceScalesError, setVigilanceScalesError] = useState<string | null>(null);
  const [selectedVigilanceScale, setSelectedVigilanceScale] = useState('');
  const [isParkingPanelVisible, setIsParkingPanelVisible] = useState(false);
  const [isScaleRosterVisible, setIsScaleRosterVisible] = useState(false);
  const [registeredScaleVolunteers, setRegisteredScaleVolunteers] = useState<ScaleRosterVolunteerEntry[]>(
    []
  );
  const [isRegisteredScaleVolunteersLoading, setIsRegisteredScaleVolunteersLoading] = useState(false);
  const [registeredScaleVolunteersError, setRegisteredScaleVolunteersError] = useState<string | null>(
    null
  );
  const [vehiclePlacaQuery, setVehiclePlacaQuery] = useState('');
  const [vehicleLookupLoading, setVehicleLookupLoading] = useState(false);
  const [vehicleLookupError, setVehicleLookupError] = useState<string | null>(null);
  const [vehicleLookupResult, setVehicleLookupResult] = useState<VehicleLookupResult | null>(null);

  const insets = useSafeAreaInsets();
  const dashboardPanelCardHeight = useMemo(
    () => computeDashboardCardHeight(windowHeight, insets.top, insets.bottom),
    [insets.top, insets.bottom]
  );
  const eventPanelCardHeight = useMemo(
    () => computeEventPanelCardHeight(windowHeight, insets.top, insets.bottom),
    [insets.top, insets.bottom]
  );
  const dashboardPanelCardSizeStyle = useMemo(
    () => ({
      width: pageWidth * 0.9,
      minHeight: dashboardPanelCardHeight,
      maxHeight: dashboardPanelCardHeight,
      alignSelf: 'center' as const,
    }),
    [dashboardPanelCardHeight, pageWidth]
  );
  const eventPanelCardSizeStyle = useMemo(
    () => ({
      width: pageWidth * 0.9,
      minHeight: eventPanelCardHeight,
      maxHeight: eventPanelCardHeight,
      alignSelf: 'center' as const,
    }),
    [eventPanelCardHeight, pageWidth]
  );
  const params = useLocalSearchParams();
  const router = useRouter();
  const requestedDashboardCard = Array.isArray(params.dashboardCard)
    ? params.dashboardCard[0]
    : params.dashboardCard;

  const {
    events: activeEvents,
    selectedEvent,
    selectedEventId,
    setSelectedEventId,
    loading: areEventsLoading,
    error: eventsError,
    refetch: refetchActiveEvents,
  } = useDashboardSelectedEvent();

  const {
    kidsRegistrations,
    teensRegistrations,
    loading: loadingGroupedRegistrations,
    error: groupedRegistrationsError,
    refetch: refetchGroupedRegistrations,
  } = useEventRegistrationsByStatus(selectedEventId, {
    enabled: isSalaRegistrationsEnabled,
    familyId,
  });
  const phone = params.phone ? decodeURIComponent(params.phone as string) : null;
  const loadPixKey = useCallback(async () => {
    setIsPixKeyLoading(true);

    try {
      const value = await getAppParameterValue('chave_pix');
      setPixKey(value?.trim() || null);
    } catch (error) {
      console.error('Erro ao carregar chave PIX:', error);
      setPixKey(null);
    } finally {
      setIsPixKeyLoading(false);
    }
  }, []);
  const loadCheckInCardParameters = useCallback(async () => {
    try {
      const [qrCodeValue, checkInAutomaticoValue] = await Promise.all([
        getAppParameterValue(APP_PARAMETER.QR_CODE_ATIVO),
        getAppParameterValue(APP_PARAMETER.CHECK_IN_AUTOMATICO),
      ]);
      setQrCodeAtivoEnabled(!isAppParameterNo(qrCodeValue));
      setCheckInManualMode(isAppParameterNo(checkInAutomaticoValue));
    } catch (error) {
      console.error('Erro ao carregar parâmetros de check-in:', error);
      setQrCodeAtivoEnabled(true);
      setCheckInManualMode(false);
    }
  }, []);

  const selectedEventCheckInOptions = useMemo(
    () => ({
      totemAtivo: selectedEvent?.totem_ativo === true,
      qrCodeAtivoEnabled,
      checkInManualMode,
    }),
    [checkInManualMode, qrCodeAtivoEnabled, selectedEvent?.totem_ativo]
  );

  const selectedEventRequiresQrCheckIn = useMemo(
    () =>
      selectedEvent
        ? eventRequiresQrCheckIn({
            ...selectedEventCheckInOptions,
            requerQuorum: selectedEvent.requer_quorum === true,
          })
        : false,
    [selectedEvent, selectedEventCheckInOptions]
  );

  const qrFamilyCode = useMemo(
    () => String(familyId || profile?.codigo_membro || '').trim().toUpperCase(),
    [familyId, profile?.codigo_membro]
  );

  const selectedEventUsesAutomaticCheckIn = useMemo(
    () => (selectedEvent ? eventUsesAutomaticAudienceCheckIn(selectedEventCheckInOptions) : false),
    [selectedEvent, selectedEventCheckInOptions]
  );

  const isSelectedEventToday = useMemo(
    () => isEventCalendarToday(selectedEvent?.event_date),
    [selectedEvent?.event_date]
  );

  const {
    hasPreCheckin,
    hasTotemCheckinConfirmed,
    gateRequired: preCheckinGateRequired,
    gateError: preCheckinGateError,
    refetch: refetchPreCheckin,
  } = useFamilyPreCheckin(selectedEvent?.id, familyId, selectedEvent);

  const isQrCheckInCardVisible = useMemo(
    () =>
      resolveQrCheckInCardVisible({
        event: selectedEvent,
        qrCodeAtivoEnabled,
        checkInManualMode,
        hasFamilyPreCheckin: hasPreCheckin,
        hasFamilyTotemCheckin: hasTotemCheckinConfirmed,
      }),
    [checkInManualMode, hasPreCheckin, hasTotemCheckinConfirmed, qrCodeAtivoEnabled, selectedEvent]
  );

  useFocusEffect(
    useCallback(() => {
      void refetchPreCheckin({ silent: true });
    }, [refetchPreCheckin])
  );

  const qrCheckInCardTitle = useMemo(() => {
    if (selectedEvent?.requer_quorum === true) {
      return 'QR Code — Check-in Quórum';
    }

    return selectedEvent?.totem_ativo === true ? 'QR Code — Totem' : 'Check In — QR Code';
  }, [selectedEvent?.requer_quorum, selectedEvent?.totem_ativo]);

  const isQrTotemCardPoolBlue = useMemo(
    () =>
      selectedEvent?.totem_ativo === true
      && selectedEvent.requer_quorum !== true
      && isSelectedEventToday
      && hasTotemCheckinConfirmed,
    [hasTotemCheckinConfirmed, isSelectedEventToday, selectedEvent]
  );

  useEffect(() => {
    async function loadData() {
      setIsProfileLoading(true);
      let targetPhone = phone;
      if (!targetPhone) {
        targetPhone = await getStoredUserPhone();
      } else {
        await AsyncStorage.setItem('user_phone', targetPhone);
      }
      if (!targetPhone) {
        setCanViewMaintenance(false);
        setDashboardCardAccess({});
        setIsMaintenanceAccessLoading(false);
        setIsProfileLoading(false);
        return;
      }
      setUserPhone(targetPhone);
      const resolvedFamilyId = await resolveFamilyIdForPhone(targetPhone);
      setFamilyId(resolvedFamilyId);
      setIsMaintenanceAccessLoading(true);

      let sessionProfile = await loadSessionProfile(targetPhone);

      if (!sessionProfile?.id) {
        await repairUserSessionReference(targetPhone);
        sessionProfile = await loadSessionProfile(targetPhone);
      }

      if (!sessionProfile) {
        setProfile(null);
        setCurrentUserId(null);
        setCanViewMaintenance(false);
        setDashboardCardAccess({});
        setIsMaintenanceAccessLoading(false);
        setIsProfileLoading(false);
        signOutAndReturnToLogin();
        return;
      }

      const loadedProfile: DashboardProfile = {
        id: sessionProfile.id,
        full_name: sessionProfile.full_name ?? undefined,
        codigo_membro: sessionProfile.codigo_membro ?? sessionProfile.family_id ?? resolvedFamilyId,
        lgpd_accepted: sessionProfile.lgpd_accepted,
        birth_date: sessionProfile.birth_date ?? null,
        phone: sessionProfile.phone ?? targetPhone,
      };

      setProfile(loadedProfile);
      setCurrentUserId(loadedProfile.id ?? null);

      if (loadedProfile.id) {
        await persistProfileId(loadedProfile.id);
      } else {
        setCanViewMaintenance(false);
        setDashboardCardAccess({});
      }

      const aclStatus = await getAccessControlRpcStatus();
      setAclRpcStatus(aclStatus);

      if (loadedProfile?.id) {
        const [allowed, cardAccess] = await Promise.all([
          profileHasAccess(loadedProfile.id, 'screen', ACCESS_SCREEN.maintenance, 'view'),
          loadDashboardCardViewAccess(loadedProfile.id),
        ]);
        setCanViewMaintenance(allowed);
        setDashboardCardAccess(cardAccess);
      }

      setIsMaintenanceAccessLoading(false);
      setIsProfileLoading(false);
    }
    loadData();
  }, [phone]);

  useFocusEffect(
    useCallback(() => {
      let active = true;

      void (async () => {
        const targetPhone = phone ?? (await getStoredUserPhone());
        if (!targetPhone) {
          return;
        }

        const sessionProfile = await loadSessionProfile(targetPhone);
        if (!active) {
          return;
        }

        if (!sessionProfile) {
          if (profile?.id) {
            signOutAndReturnToLogin();
          }
          return;
        }

        if (!sessionProfile.id && !profile?.id) {
          return;
        }

        if (!sessionProfile.id && profile?.id) {
          signOutAndReturnToLogin();
          return;
        }

        const refreshedProfile: DashboardProfile = {
          id: sessionProfile.id,
          full_name: sessionProfile.full_name ?? undefined,
          codigo_membro: sessionProfile.codigo_membro ?? sessionProfile.family_id ?? familyId,
          lgpd_accepted: sessionProfile.lgpd_accepted,
          birth_date: sessionProfile.birth_date ?? null,
          phone: sessionProfile.phone ?? targetPhone,
        };

        if (active) {
          setProfile((current) => {
            if (
              current?.id === refreshedProfile.id
              && current?.full_name === refreshedProfile.full_name
              && current?.codigo_membro === refreshedProfile.codigo_membro
              && current?.lgpd_accepted === refreshedProfile.lgpd_accepted
              && current?.birth_date === refreshedProfile.birth_date
              && current?.phone === refreshedProfile.phone
            ) {
              return current;
            }

            return refreshedProfile;
          });
          setCurrentUserId((current) => current === sessionProfile.id ? current : sessionProfile.id);
        }

        await persistProfileId(sessionProfile.id);

        const aclStatus = await getAccessControlRpcStatus();

        if (sessionProfile.id) {
          const [allowed, cardAccess] = await Promise.all([
            profileHasAccess(sessionProfile.id, 'screen', ACCESS_SCREEN.maintenance, 'view'),
            loadDashboardCardViewAccess(sessionProfile.id),
          ]);

          if (active) {
            setAclRpcStatus((current) => (current === aclStatus ? current : aclStatus));
            setCanViewMaintenance((current) => (current === allowed ? current : allowed));
            setDashboardCardAccess((current) => {
              const nextSnapshot = JSON.stringify(cardAccess);
              const currentSnapshot = JSON.stringify(current);

              return nextSnapshot === currentSnapshot ? current : cardAccess;
            });
          }
        } else if (active) {
          setCanViewMaintenance(false);
          setDashboardCardAccess({});
        }
      })();

      return () => {
        active = false;
      };
    }, [familyId, phone])
  );

  useEffect(() => {
    loadPixKey();
  }, [loadPixKey]);

  useEffect(() => {
    void loadCheckInCardParameters();
  }, [loadCheckInCardParameters]);

  const loadBirthdays = useCallback(async () => {
    setIsBirthdaysLoading(true);
    setBirthdaysError(null);

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('full_name, birth_date, phone')
        .not('birth_date', 'is', null)
        .order('full_name', { ascending: true });

      if (error) {
        throw error;
      }

      const parsedEntries = (data ?? [])
        .map((entry) => {
          const parts = parseBirthdayParts(entry.birth_date);
          const fullName = entry.full_name?.trim();

          if (!parts || !fullName) {
            return null;
          }

          return {
            full_name: fullName,
            birth_date: String(entry.birth_date),
            phone: entry.phone ? String(entry.phone) : null,
            day: parts.day,
            month: parts.month,
          } satisfies BirthdayEntry;
        })
        .filter((entry): entry is BirthdayEntry => entry !== null)
        .sort(
          (left, right) =>
            left.month - right.month ||
            left.day - right.day ||
            left.full_name.localeCompare(right.full_name, 'pt-BR')
        );

      setBirthdayEntries(parsedEntries);
    } catch (error) {
      console.error('Erro ao carregar aniversariantes:', error);
      setBirthdayEntries([]);
      setBirthdaysError('Nao foi possivel carregar os aniversariantes.');
    } finally {
      setIsBirthdaysLoading(false);
    }
  }, []);

  const loadMembersList = useCallback(async () => {
    setIsMembersListLoading(true);
    setMembersListError(null);

    try {
      const directoryEntries = await fetchMembersDirectoryFromProfiles();
      const parsedEntries = directoryEntries.map((entry) => ({
        id: entry.id,
        full_name: entry.full_name,
        short_name: entry.short_name,
        family_id: entry.family_id,
        relationship: entry.relationship,
        phone: entry.phone,
      })) satisfies MemberListEntry[];

      setMemberListEntries(dedupeMemberListEntries(parsedEntries));
    } catch (error) {
      console.error('Erro ao carregar lista de membros:', error);
      setMemberListEntries([]);
      setMembersListError(
        error instanceof Error
          ? error.message
          : 'Nao foi possivel carregar a lista de membros.'
      );
    } finally {
      setIsMembersListLoading(false);
    }
  }, []);

  const loadVisitorsList = useCallback(async () => {
    setIsVisitorsListLoading(true);
    setMembersListError(null);

    try {
      const directoryEntries = await fetchVisitorsDirectoryFromProfiles();
      const parsedEntries = directoryEntries.map((entry) => ({
        id: entry.id,
        full_name: entry.full_name,
        short_name: entry.short_name,
        family_id: entry.family_id,
        relationship: entry.relationship,
        phone: entry.phone,
      })) satisfies MemberListEntry[];

      setVisitorListEntries(dedupeMemberListEntries(parsedEntries));
      visitorsListLoadedRef.current = true;
    } catch (error) {
      console.error('Erro ao carregar lista de visitantes:', error);
      setVisitorListEntries([]);
      setMembersListError(
        error instanceof Error
          ? error.message
          : 'Nao foi possivel carregar a lista de visitantes.'
      );
    } finally {
      setIsVisitorsListLoading(false);
    }
  }, []);

  const handleShowMembersList = useCallback(() => {
    setMembersListAudience('members');
    setMembersListSearchQuery('');
    setMembersListError(null);
  }, []);

  const handleShowVisitorsList = useCallback(() => {
    setMembersListAudience('visitors');
    setMembersListSearchQuery('');
    setMembersListError(null);

    if (!visitorsListLoadedRef.current) {
      void loadVisitorsList();
    }
  }, [loadVisitorsList]);

  useEffect(() => {
    if (profile?.full_name?.trim()) {
      return;
    }

    void loadMembersList();
  }, [loadMembersList, profile?.full_name]);

  useEffect(() => {
    if (profile?.full_name?.trim() || !userPhone) {
      return;
    }

    const userDigits = cleanPhoneDigits(userPhone);
    const memberMatch = memberListEntries.find((entry) => {
      const entryDigits = cleanPhoneDigits(entry.phone);
      return Boolean(userDigits && entryDigits && entryDigits === userDigits);
    });

    if (!memberMatch?.full_name?.trim()) {
      return;
    }

    setProfile((current) =>
      current
        ? { ...current, full_name: memberMatch.full_name }
        : {
            full_name: memberMatch.full_name,
            codigo_membro: memberMatch.family_id,
            lgpd_accepted: null,
          }
    );
  }, [memberListEntries, profile?.full_name, userPhone]);

  const loadVigilanceScales = useCallback(async (options?: { preserveSelection?: boolean }) => {
    const preserveSelection = options?.preserveSelection ?? false;
    setIsVigilanceScalesLoading(true);
    setVigilanceScalesError(null);

    try {
      const [{ data: typesData, error: typesError }, { data, error }, { data: profilesData, error: profilesError }] =
        await Promise.all([
          supabase.rpc('listar_tipos_escala'),
          supabase.rpc('listar_escalas'),
          supabase.from('profiles').select('full_name, phone, family_id, codigo_membro'),
        ]);

      if (typesError) {
        throw typesError;
      }

      if (error) {
        throw error;
      }

      if (profilesError) {
        throw profilesError;
      }

      const profiles = (profilesData as ProfilePhoneRow[] | null) ?? [];

      const parsedTypes = ((typesData as ScaleTypeRow[] | null) ?? [])
        .map((entry) => {
          const entryId = entry.id?.trim();
          const code = entry.codigo?.trim();
          const name = entry.nome?.trim();

          if (!entryId || !code || !name) {
            return null;
          }

          return {
            id: entryId,
            code,
            name,
          } satisfies ScaleTypeEntry;
        })
        .filter((entry): entry is ScaleTypeEntry => entry !== null)
        .sort((left, right) => left.name.localeCompare(right.name, 'pt-BR'));

      const parsedEntries = ((data as VigilanceScaleRow[] | null) ?? [])
        .map((entry) => {
          const entryId = entry.id?.trim();
          const scaleId = entry.tipo_escala_id?.trim();
          const scaleCode = entry.tipo_escala_codigo?.trim();
          const scaleName = entry.tipo_escala_nome?.trim();
          const serviceDate = entry.data_servico?.trim();
          const volunteerId = entry.voluntario_id?.trim();
          const volunteerName = entry.volunteer_name?.trim();

          if (
            !entryId
            || !scaleId
            || !scaleCode
            || !scaleName
            || !serviceDate
            || !volunteerId
            || !volunteerName
          ) {
            return null;
          }

          return {
            id: entryId,
            scale_id: scaleId,
            scale_code: scaleCode,
            scale_name: scaleName,
            data_servico: serviceDate,
            voluntario_id: volunteerId,
            volunteer_name: volunteerName,
            volunteer_phone: resolveProfilePhoneForVolunteerName(volunteerName, profiles),
          } satisfies VigilanceScaleEntry;
        })
        .filter((entry): entry is VigilanceScaleEntry => entry !== null)
        .sort(
          (left, right) =>
            left.scale_name.localeCompare(right.scale_name, 'pt-BR')
            || left.data_servico.localeCompare(right.data_servico)
            || left.volunteer_name.localeCompare(right.volunteer_name, 'pt-BR')
        );

      setScaleTypes(parsedTypes);
      setVigilanceScaleEntries(parsedEntries);
      if (!preserveSelection) {
        setSelectedVigilanceScale('');
        setIsParkingPanelVisible(false);
      }
    } catch (error) {
      console.error('Erro ao carregar escalas:', error);
      setScaleTypes([]);
      setVigilanceScaleEntries([]);
      if (!preserveSelection) {
        setSelectedVigilanceScale('');
        setIsParkingPanelVisible(false);
      }
      setVigilanceScalesError('Nao foi possivel carregar as escalas.');
    } finally {
      setIsVigilanceScalesLoading(false);
    }
  }, []);

  const handleSearchVehicleByPlaca = useCallback(async () => {
    setVehicleLookupLoading(true);
    setVehicleLookupError(null);
    setVehicleLookupResult(null);

    try {
      setVehicleLookupResult(await lookupVehicleByPlaca(vehiclePlacaQuery));
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Não foi possível localizar o veículo.';

      const expectedMessages = [
        'Informe a placa do veículo.',
        'Informe a placa completa do veículo.',
        'Nenhum veículo encontrado para esta placa.',
      ];

      if (expectedMessages.includes(message)) {
        setVehicleLookupError(message);
      } else {
        console.error('Erro ao buscar veículo por placa:', error);
        setVehicleLookupError('Não foi possível localizar o veículo.');
      }
    } finally {
      setVehicleLookupLoading(false);
    }
  }, [vehiclePlacaQuery]);

  const handleResetVehicleLookup = useCallback(() => {
    setVehiclePlacaQuery('');
    setVehicleLookupResult(null);
    setVehicleLookupError(null);
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        setSelectedBirthdayMonth(getCurrentBirthdayMonth());
        void loadBirthdays();
        void loadMembersList();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [loadBirthdays, loadMembersList]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        void loadVigilanceScales({ preserveSelection: true });
      }
    });

    return () => {
      subscription.remove();
    };
  }, [loadVigilanceScales]);

  useEffect(() => {
    return () => {
      if (pixFeedbackTimeoutRef.current) {
        clearTimeout(pixFeedbackTimeoutRef.current);
      }
    };
  }, []);

  const handleExit = () => {
    router.replace('/(tabs)');
  };

  const handleCopyPixKey = async () => {
    if (!pixKey) {
      Alert.alert('Chave PIX indisponível', 'Nenhuma chave PIX foi encontrada para copiar.');
      return;
    }

    try {
      await Clipboard.setStringAsync(pixKey);
      setPixFeedbackMessage('Chave PIX copiada para a área de transferência.');
      if (pixFeedbackTimeoutRef.current) {
        clearTimeout(pixFeedbackTimeoutRef.current);
      }
      pixFeedbackTimeoutRef.current = setTimeout(() => {
        setPixFeedbackMessage(null);
      }, 3000);
    } catch (error) {
      console.error('Erro ao copiar chave PIX:', error);
      Alert.alert('Erro ao copiar', 'Não foi possível copiar a chave PIX.');
    }
  };

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const index = Math.round(event.nativeEvent.contentOffset.x / pageWidth);
    setCurrentIndex(index);
  };

  const kidsCheckedCount = kidsRegistrations.filter((registration) => registration.room_entry_checked).length;
  const teensCheckedCount = teensRegistrations.filter((registration) => registration.room_entry_checked).length;
  const availableGroupedRooms: GroupedRoomConfig[] = [];

  if (selectedEvent?.kids_room) {
    availableGroupedRooms.push({
      key: 'KIDS',
      label: 'IBN KIDS',
      checkedCount: kidsCheckedCount,
      totalCount: kidsRegistrations.length,
      headerStyle: styles.groupedAudienceHeaderKids,
      dotStyle: styles.groupedAudienceDotKids,
    });
  }

  if (selectedEvent?.teens_room) {
    availableGroupedRooms.push({
      key: 'TEENS',
      label: 'IBN TEENS',
      checkedCount: teensCheckedCount,
      totalCount: teensRegistrations.length,
      headerStyle: styles.groupedAudienceHeaderTeens,
      dotStyle: styles.groupedAudienceDotTeens,
    });
  }
  const selectedGroupedRoomConfig =
    availableGroupedRooms.find((room) => room.key === selectedGroupedRoom) ?? availableGroupedRooms[0] ?? null;
  const visibleGroupedRegistrations =
    selectedGroupedRoomConfig?.key === 'TEENS' ? teensRegistrations : kidsRegistrations;
  useEffect(() => {
    setSelectedGroupedRoom((current) => {
      if (!availableGroupedRooms.length) {
        return null;
      }

      if (current && availableGroupedRooms.some((room) => room.key === current)) {
        return current;
      }

      return availableGroupedRooms[0].key;
    });
  }, [selectedEventId, selectedEvent?.kids_room, selectedEvent?.teens_room, kidsRegistrations.length, teensRegistrations.length]);

  const capacityRatio =
    selectedEvent?.max_capacity && selectedEvent.max_capacity > 0
      ? Math.min(selectedEvent.registeredCount / selectedEvent.max_capacity, 1)
      : 0;

  const capacityFillColor =
    capacityRatio >= 0.85 ? '#0284c7' : capacityRatio >= 0.6 ? '#06b6d4' : '#67e8f9';
  const selectedEventTime = selectedEvent ? formatEventDateTimeLabel(selectedEvent.event_date) : null;
  const selectedBirthdayMonthLabel =
    BIRTHDAY_MONTHS.find((monthOption) => monthOption.value === selectedBirthdayMonth)?.label ??
    'Mes';
  const birthdaysForSelectedMonth = birthdayEntries.filter(
    (entry) => String(entry.month) === selectedBirthdayMonth
  );
  const upcomingVigilanceScaleEntries = vigilanceScaleEntries.filter(
    (entry) => entry.data_servico >= getCurrentLocalIsoDate()
  );
  const selectedScaleType =
    scaleTypes.find((entry) => entry.code === selectedVigilanceScale) ?? null;
  const selectedVigilanceScaleLabel = selectedScaleType?.name ?? 'Escala';
  const vigilanceEntriesForSelectedScale = upcomingVigilanceScaleEntries.filter(
    (entry) => entry.scale_code === selectedVigilanceScale
  );
  const loadRegisteredScaleVolunteers = useCallback(async (scaleTypeId: string) => {
    setIsRegisteredScaleVolunteersLoading(true);
    setRegisteredScaleVolunteersError(null);

    try {
      const [volunteers, { data: profilesData, error: profilesError }] = await Promise.all([
        fetchVolunteersForScaleType(scaleTypeId),
        supabase.from('profiles').select('full_name, phone, family_id, codigo_membro'),
      ]);

      if (profilesError) {
        throw profilesError;
      }

      const profiles = (profilesData as ProfilePhoneRow[] | null) ?? [];
      const entries = volunteers
        .map((volunteer) => ({
          id: volunteer.id,
          name: volunteer.name,
          phone: resolveProfilePhoneForVolunteerName(volunteer.name, profiles),
        }))
        .sort((left, right) =>
          formatDisplayName(left.name).localeCompare(formatDisplayName(right.name), 'pt-BR')
        );

      setRegisteredScaleVolunteers(entries);
    } catch (error) {
      console.error('Erro ao carregar servos da escala:', error);
      setRegisteredScaleVolunteers([]);
      setRegisteredScaleVolunteersError('Nao foi possivel carregar os servos desta escala.');
    } finally {
      setIsRegisteredScaleVolunteersLoading(false);
    }
  }, []);

  const handleSelectVigilanceScale = useCallback(
    (option: ScaleTypeEntry) => {
      setSelectedVigilanceScale(option.code);
      setIsParkingPanelVisible(false);
      handleResetVehicleLookup();
      setIsScaleRosterVisible(true);
      scrollToScaleRosterRef.current = true;

      if (isIntercessionScale(option.name, option.code)) {
        void loadRegisteredScaleVolunteers(option.id);
        return;
      }

      setRegisteredScaleVolunteers([]);
      setRegisteredScaleVolunteersError(null);
    },
    [handleResetVehicleLookup, loadRegisteredScaleVolunteers]
  );

  const isSelectedScaleIntercession = useMemo(
    () =>
      selectedScaleType
        ? isIntercessionScale(selectedScaleType.name, selectedScaleType.code)
        : false,
    [selectedScaleType]
  );

  const isSelectedScaleParking = useMemo(
    () =>
      selectedScaleType
        ? isParkingWelcomeScale(selectedScaleType.name, selectedScaleType.code)
        : false,
    [selectedScaleType]
  );
  const displayName = useMemo(() => {
    const profileName = profile?.full_name?.trim();
    if (profileName) {
      return formatDisplayName(profileName);
    }

    if (userPhone) {
      const userDigits = cleanPhoneDigits(userPhone);
      const memberMatch = memberListEntries.find((entry) => {
        const entryDigits = cleanPhoneDigits(entry.phone);
        return Boolean(userDigits && entryDigits && entryDigits === userDigits);
      });

      if (memberMatch?.full_name?.trim()) {
        return formatDisplayName(memberMatch.full_name);
      }
    }

    return 'Usuário';
  }, [memberListEntries, profile?.full_name, userPhone]);
  const isLgpdPending = profile?.lgpd_accepted === false;
  const handleEventRegistrationChange = async () => {
    await refetchActiveEvents();
    await refetchGroupedRegistrations();
    await refetchPreCheckin();
  };
  const activeMemberListEntries = useMemo(
    () => (membersListAudience === 'visitors' ? visitorListEntries : memberListEntries),
    [memberListEntries, membersListAudience, visitorListEntries]
  );

  const isActiveMembersListLoading = useMemo(
    () => (membersListAudience === 'visitors' ? isVisitorsListLoading : isMembersListLoading),
    [isMembersListLoading, isVisitorsListLoading, membersListAudience]
  );

  const filteredMemberListEntries = useMemo(() => {
    const query = normalizeParameterValue(membersListSearchQuery);

    if (!query) {
      return activeMemberListEntries;
    }

    return activeMemberListEntries.filter((entry) => {
      const fullName = normalizeParameterValue(entry.full_name);
      const shortName = normalizeParameterValue(entry.short_name);

      return fullName.includes(query) || shortName.includes(query);
    });
  }, [activeMemberListEntries, membersListSearchQuery]);

  const familyModalMembers = useMemo(() => {
    if (!familyModalFamilyId) {
      return [];
    }

    return activeMemberListEntries
      .filter((entry) => entry.family_id === familyModalFamilyId)
      .sort((left, right) => left.full_name.localeCompare(right.full_name, 'pt-BR'));
  }, [familyModalFamilyId, activeMemberListEntries]);

  const handleOpenVigilanceVolunteerWhatsapp = async (phone: string | null) => {
    const whatsappPhone = normalizePhoneForWhatsApp(phone);

    if (!whatsappPhone) {
      Alert.alert('Telefone indisponível', 'Este servo não possui telefone cadastrado no perfil.');
      return;
    }

    try {
      await Linking.openURL(`https://wa.me/${whatsappPhone}`);
    } catch (error) {
      console.error('Erro ao abrir WhatsApp:', error);
      Alert.alert('Erro', 'Não foi possível abrir o Zap deste servo.');
    }
  };

  const handleOpenMemberWhatsapp = async (entry: MemberListEntry) => {
    await openMemberWhatsapp(entry.phone);
  };

  const handleOpenBirthdayWhatsapp = async (entry: BirthdayEntry) => {
    const whatsappPhone = normalizePhoneForWhatsApp(entry.phone);

    if (!whatsappPhone) {
      Alert.alert('Telefone indisponivel', 'Este aniversariante nao possui telefone cadastrado.');
      return;
    }

    try {
      await Linking.openURL(`https://wa.me/${whatsappPhone}`);
    } catch (error) {
      console.error('Erro ao abrir WhatsApp:', error);
      Alert.alert('Erro', 'Nao foi possivel abrir o Zap deste usuario.');
    }
  };
  const handleOpenVehicleOwnerWhatsapp = async (phone: string | null) => {
    const whatsappPhone = normalizePhoneForWhatsApp(phone);

    if (!whatsappPhone) {
      Alert.alert('Telefone indisponivel', 'Nao ha telefone cadastrado para este proprietario.');
      return;
    }

    try {
      await Linking.openURL(`https://wa.me/${whatsappPhone}`);
    } catch (error) {
      console.error('Erro ao abrir WhatsApp:', error);
      Alert.alert('Erro', 'Nao foi possivel abrir o Zap deste proprietario.');
    }
  };

  const handleOpenMembersMap = useCallback(() => {
    handledDashboardCardRef.current = null;
    prefetchProfilesMapMarkers();
    router.push('/mapa-geolocalizacao');
  }, [router]);
  const dashboardCardCandidates: DashboardCard[] = useMemo(
    () => [
      { id: '1', title: 'Agenda da Família', content: 'event_alt' },
      ...(isQrCheckInCardVisible
        ? [{ id: '2', title: qrCheckInCardTitle, content: 'qr' as const }]
        : []),
      { id: '4', title: 'Sala(s)', content: 'kids_teens' },
      { id: '3', title: 'Dízimos e Ofertas', content: 'offerings' },
      { id: '5', title: 'Coração Aberto', content: 'pastoral' },
      { id: '10', title: 'Lista de Membros', content: 'members_list' },
      { id: '7', title: 'Aniversariantes', content: 'birthdays' },
      { id: '11', title: 'Financeiro', content: 'financial' },
      { id: '8', title: 'Escalas', content: 'vigilance_scales' },
      ...(isScaleRosterVisible
        ? [
            {
              id: '12',
              title: selectedVigilanceScaleLabel,
              content: 'scale_roster' as const,
            },
          ]
        : []),
      ...(isParkingPanelVisible
        ? [{ id: '9', title: 'Estacionamento', content: 'parking_vehicle_v2' as const }]
        : []),
      { id: '6', title: 'Dados Cadastrais', content: 'grouped_manage' },
    ],
    [
      isParkingPanelVisible,
      isQrCheckInCardVisible,
      isScaleRosterVisible,
      qrCheckInCardTitle,
      selectedVigilanceScaleLabel,
    ]
  );

  const hasDashboardCardAccessMap = Object.keys(dashboardCardAccess).length > 0;

  const data: DashboardCard[] = useMemo(
    () =>
      dashboardCardCandidates.filter((card) => {
        if (!profile?.id) {
          return false;
        }

        if (!hasDashboardCardAccessMap) {
          return true;
        }

        return isDashboardCardContentAllowed(card.content, dashboardCardAccess);
      }),
    [dashboardCardAccess, dashboardCardCandidates, hasDashboardCardAccessMap, profile?.id]
  );

  const activeDashboardScreenTitle = useMemo(() => {
    const card = data[currentIndex];
    return card?.title?.trim() ?? '';
  }, [currentIndex, data]);

  useEffect(() => {
    setIsSalaRegistrationsEnabled(data[currentIndex]?.content === 'kids_teens');
  }, [currentIndex, data]);

  useEffect(() => {
    if (data[currentIndex]?.content === 'birthdays' && !birthdaysLoadedRef.current) {
      birthdaysLoadedRef.current = true;
      void loadBirthdays();
    }
  }, [currentIndex, data, loadBirthdays]);

  useEffect(() => {
    if (data[currentIndex]?.content === 'members_list' && !membersListLoadedRef.current) {
      membersListLoadedRef.current = true;
      void loadMembersList();
    }
  }, [currentIndex, data, loadMembersList]);

  useEffect(() => {
    if (data[currentIndex]?.content === 'members_list' && !membersMapPrefetchStartedRef.current) {
      membersMapPrefetchStartedRef.current = true;
      prefetchProfilesMapMarkers();
    }
  }, [currentIndex, data]);

  useEffect(() => {
    if (data[currentIndex]?.content === 'vigilance_scales' && !vigilanceScalesLoadedRef.current) {
      vigilanceScalesLoadedRef.current = true;
      void loadVigilanceScales();
    }
  }, [currentIndex, data, loadVigilanceScales]);

  const scrollToDashboardCard = useCallback((targetIndex: number, animated = true) => {
    if (targetIndex < 0 || targetIndex >= data.length) {
      return;
    }

    setCurrentIndex(targetIndex);
    dashboardListRef.current?.scrollToOffset({
      offset: targetIndex * pageWidth,
      animated,
    });
  }, [data.length, pageWidth]);

  useEffect(() => {
    currentIndexRef.current = currentIndex;
  }, [currentIndex]);

  const stopFooterNavRepeat = useCallback(() => {
    if (footerNavRepeatIntervalRef.current) {
      clearInterval(footerNavRepeatIntervalRef.current);
      footerNavRepeatIntervalRef.current = null;
    }
  }, []);

  useEffect(() => () => stopFooterNavRepeat(), [stopFooterNavRepeat]);

  const stepFooterNavCard = useCallback(
    (direction: 'prev' | 'next') => {
      const index = currentIndexRef.current;
      const targetIndex = direction === 'prev' ? index - 1 : index + 1;

      if (targetIndex < 0 || targetIndex >= data.length) {
        stopFooterNavRepeat();
        return;
      }

      scrollToDashboardCard(targetIndex, false);
    },
    [data.length, scrollToDashboardCard, stopFooterNavRepeat]
  );

  const startFooterNavRepeat = useCallback(
    (direction: 'prev' | 'next') => {
      stopFooterNavRepeat();
      footerNavRepeatActiveRef.current = false;

      footerNavRepeatIntervalRef.current = setInterval(() => {
        footerNavRepeatActiveRef.current = true;
        stepFooterNavCard(direction);
      }, FOOTER_NAV_REPEAT_MS);
    },
    [stepFooterNavCard, stopFooterNavRepeat]
  );

  const handleFooterNavPressOut = useCallback(() => {
    stopFooterNavRepeat();
  }, [stopFooterNavRepeat]);

  const handleFooterPreviousPress = useCallback(() => {
    if (footerNavRepeatActiveRef.current) {
      footerNavRepeatActiveRef.current = false;
      return;
    }

    stepFooterNavCard('prev');
  }, [stepFooterNavCard]);

  const handleFooterNextPress = useCallback(() => {
    if (footerNavRepeatActiveRef.current) {
      footerNavRepeatActiveRef.current = false;
      return;
    }

    stepFooterNavCard('next');
  }, [stepFooterNavCard]);

  const handleFooterSettingsPress = useCallback(() => {
    if (isFooterSettingsPressed) {
      setIsFooterSettingsPressed(false);
      return;
    }

    if (!canViewMaintenance) {
      Alert.alert(
        'Sem permissão',
        'Você não tem acesso à manutenção do sistema. Fale com um administrador se precisar deste acesso.'
      );
      return;
    }

    setIsFooterSettingsPressed(true);
    router.push('/maintenance-dashboard');
  }, [canViewMaintenance, isFooterSettingsPressed, router]);

  useFocusEffect(
    useCallback(() => {
      return () => {
        setIsFooterSettingsPressed(false);
      };
    }, [])
  );

  useEffect(() => {
    if (data[currentIndex]?.content === 'offerings') {
      loadPixKey();
    }
  }, [currentIndex, data, loadPixKey]);

  useEffect(() => {
    if (data[currentIndex]?.content === 'kids_teens') {
      const hasLoadedGroupedRegistrations =
        kidsRegistrations.length > 0 || teensRegistrations.length > 0;
      void refetchGroupedRegistrations({ silent: hasLoadedGroupedRegistrations });
    }
  }, [
    currentIndex,
    data,
    kidsRegistrations.length,
    refetchGroupedRegistrations,
    teensRegistrations.length,
  ]);

  const handleBackFromParking = useCallback(() => {
    handleResetVehicleLookup();
    setIsParkingPanelVisible(false);
    const rosterIdx = data.findIndex((item) => item.content === 'scale_roster');
    if (rosterIdx >= 0 && isScaleRosterVisible) {
      requestAnimationFrame(() => scrollToDashboardCard(rosterIdx));
      return;
    }

    const scalesIdx = data.findIndex((item) => item.content === 'vigilance_scales');
    if (scalesIdx >= 0) {
      requestAnimationFrame(() => scrollToDashboardCard(scalesIdx));
    }
  }, [data, handleResetVehicleLookup, isScaleRosterVisible]);

  const handleBackFromScaleRoster = useCallback(() => {
    setIsScaleRosterVisible(false);
    setRegisteredScaleVolunteers([]);
    setRegisteredScaleVolunteersError(null);
    scrollToScalesCardRef.current = true;
  }, []);

  const handleOpenParkingFromRoster = useCallback(() => {
    scrollToParkingCardRef.current = true;
    setIsParkingPanelVisible(true);
  }, []);

  useLayoutEffect(() => {
    if (!isParkingPanelVisible || !scrollToParkingCardRef.current) {
      return;
    }

    const parkingIdx = data.findIndex((item) => item.content === 'parking_vehicle_v2');
    if (parkingIdx < 0) {
      return;
    }

    scrollToParkingCardRef.current = false;
    requestAnimationFrame(() => {
      scrollToDashboardCard(parkingIdx);
    });
  }, [isParkingPanelVisible, data, scrollToDashboardCard]);

  useLayoutEffect(() => {
    if (!isScaleRosterVisible || !scrollToScaleRosterRef.current || isParkingPanelVisible) {
      return;
    }

    const rosterIdx = data.findIndex((item) => item.content === 'scale_roster');
    if (rosterIdx < 0) {
      return;
    }

    scrollToScaleRosterRef.current = false;
    scrollToDashboardCard(rosterIdx, false);
  }, [isScaleRosterVisible, isParkingPanelVisible, data, scrollToDashboardCard]);

  useLayoutEffect(() => {
    if (isScaleRosterVisible || !scrollToScalesCardRef.current) {
      return;
    }

    const scalesIdx = data.findIndex((item) => item.content === 'vigilance_scales');
    if (scalesIdx < 0) {
      return;
    }

    scrollToScalesCardRef.current = false;
    scrollToDashboardCard(scalesIdx, false);
  }, [isScaleRosterVisible, data, scrollToDashboardCard]);

  useEffect(() => {
    const scalesIdx = data.findIndex((item) => item.content === 'vigilance_scales');
    const previousIndex = previousDashboardCardIndexRef.current;
    const previousContent = data[previousIndex]?.content;
    previousDashboardCardIndexRef.current = currentIndex;

    if (scalesIdx < 0 || currentIndex !== scalesIdx || previousIndex === scalesIdx) {
      return;
    }

    if (previousContent === 'parking_vehicle_v2' || previousContent === 'scale_roster') {
      return;
    }

    setSelectedVigilanceScale('');
    setIsParkingPanelVisible(false);
    setIsScaleRosterVisible(false);
    setRegisteredScaleVolunteers([]);
    setRegisteredScaleVolunteersError(null);
    handleResetVehicleLookup();
  }, [currentIndex, data, handleResetVehicleLookup]);

  useEffect(() => {
    if (currentIndex < data.length) {
      return;
    }

    const nextIndex = Math.max(data.length - 1, 0);
    setCurrentIndex(nextIndex);
    dashboardListRef.current?.scrollToOffset({
      offset: nextIndex * pageWidth,
      animated: false,
    });
  }, [currentIndex, data.length, pageWidth]);

  useEffect(() => {
    if (!requestedDashboardCard) {
      handledDashboardCardRef.current = null;
      return;
    }

    if (handledDashboardCardRef.current === requestedDashboardCard) {
      return;
    }

    const targetIndex = data.findIndex(
      (item) => item.id === requestedDashboardCard || item.content === requestedDashboardCard
    );

    if (targetIndex < 0) {
      return;
    }

    handledDashboardCardRef.current = requestedDashboardCard;
    setCurrentIndex(targetIndex);
    dashboardListRef.current?.scrollToOffset({
      offset: targetIndex * pageWidth,
      animated: false,
    });
  }, [data, pageWidth, requestedDashboardCard]);

  useEffect(() => {
    if (previousPageWidthRef.current === pageWidth) {
      return;
    }

    previousPageWidthRef.current = pageWidth;
    const index = currentIndexRef.current;
    requestAnimationFrame(() => {
      dashboardListRef.current?.scrollToOffset({
        offset: index * pageWidth,
        animated: false,
      });
    });
  }, [pageWidth]);

  return (
    <LinearGradient colors={MAIN_SCREEN_GRADIENT} style={styles.container}>
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
        <StatusBar barStyle="light-content" />
        <View style={styles.header}>
          <View style={[styles.welcomeBox, isLgpdPending && styles.welcomeBoxLgpdPending]}>
            <Text style={styles.welcomeText}>Boas-Vindas,</Text>
            <View style={styles.welcomeNameRow}>
              <Text numberOfLines={1} style={styles.userName}>
                {displayName}
              </Text>
              <ActiveScreenBadge title={activeDashboardScreenTitle} accent="emerald" />
            </View>
          </View>
        </View>

        {aclRpcStatus === 'missing' ? (
          <View style={styles.aclUnavailableBanner}>
            <Text style={styles.aclUnavailableText}>{ACL_UNAVAILABLE_MESSAGE}</Text>
          </View>
        ) : null}

        <View style={styles.listContainer}>
          <FlatList
            ref={dashboardListRef}
            style={styles.dashboardFlatList}
            data={data}
            horizontal
            pagingEnabled
            scrollEnabled={false}
            keyboardShouldPersistTaps="handled"
            showsHorizontalScrollIndicator={false}
            onScroll={handleScroll}
            scrollEventThrottle={16}
            keyExtractor={(item) => item.id}
            getItemLayout={(_, index) => ({
              length: pageWidth,
              offset: pageWidth * index,
              index,
            })}
            snapToAlignment="start"
            snapToInterval={pageWidth}
            snapToOffsets={data.map((_, index) => index * pageWidth)}
            decelerationRate="fast"
            disableIntervalMomentum={true}
            renderItem={({ item }) => (
              <View style={[styles.cardWrapper, carouselPageStyle]}>
                {item.content === 'event_alt' ? (
                  <View style={[styles.card, styles.eventCard, styles.eventAltCard, eventPanelCardSizeStyle]}>
                    {areEventsLoading || isProfileLoading ? (
                      <CardLoadingState lines={4} />
                    ) : !activeEvents.length ? (
                      <View style={styles.eventAltEmptyState}>
                        <Text style={styles.placeholderText}>
                          No momento não há eventos disponíveis. Aguarde os próximos eventos.
                        </Text>
                      </View>
                    ) : (
                      <View style={styles.eventAltCardBody}>
                        <View style={[styles.eventSection, styles.eventAltHero]}>
                          <View style={styles.eventAltHeroRow}>
                            <View style={styles.eventAltSummary}>
                              <Text style={styles.sectionLabel}>Evento Selecionado</Text>
                              {selectedEvent ? (
                                <>
                                  <Text style={styles.eventAltName} numberOfLines={2}>
                                    {selectedEvent.name}
                                  </Text>
                                  {selectedEventTime ? (
                                    <Text style={styles.eventAltMeta}>{selectedEventTime}</Text>
                                  ) : null}
                                  {selectedEvent.event_local ? (
                                    <Text style={styles.eventAltLocation}>{selectedEvent.event_local}</Text>
                                  ) : null}
                                  {selectedEvent.kids_room || selectedEvent.teens_room ? (
                                    <View style={styles.eventAltRoomLegendRow}>
                                      {selectedEvent.kids_room ? (
                                        <View
                                          style={[
                                            styles.eventAltRoomBadge,
                                            styles.eventAltRoomBadgeKids,
                                            styles.eventAltRoomBadgeInline,
                                          ]}
                                        >
                                          <View
                                            style={[
                                              styles.eventRoomIndicator,
                                              styles.eventRoomIndicatorKids,
                                            ]}
                                          />
                                          <Text
                                            style={styles.eventAltRoomBadgeText}
                                            numberOfLines={1}
                                          >
                                            IBN Kids
                                          </Text>
                                        </View>
                                      ) : null}
                                      {selectedEvent.teens_room ? (
                                        <View
                                          style={[
                                            styles.eventAltRoomBadge,
                                            styles.eventAltRoomBadgeTeens,
                                            styles.eventAltRoomBadgeInline,
                                          ]}
                                        >
                                          <View
                                            style={[
                                              styles.eventRoomIndicator,
                                              styles.eventRoomIndicatorTeens,
                                            ]}
                                          />
                                          <Text
                                            style={styles.eventAltRoomBadgeText}
                                            numberOfLines={1}
                                          >
                                            IBN Teens
                                          </Text>
                                        </View>
                                      ) : null}
                                    </View>
                                  ) : null}
                                </>
                              ) : (
                                <Text style={styles.placeholderText}>Selecione um evento.</Text>
                              )}
                            </View>
                            <View style={styles.eventAltCapacityCard}>
                              <Text style={styles.sectionLabel}>Vagas</Text>
                              {eventsError ? (
                                <Text style={styles.capacityPlaceholder}>--</Text>
                              ) : selectedEvent && selectedEvent.remainingCapacity !== null ? (
                                <View style={styles.eventAltCapacityCupWrapper}>
                                  <View style={styles.eventAltCapacityCup}>
                                    <View
                                      style={[
                                        styles.eventAltCapacityLiquid,
                                        {
                                          height: `${Math.max(capacityRatio * 100, 8)}%`,
                                          backgroundColor: capacityFillColor,
                                        },
                                      ]}
                                    />
                                    <View style={styles.eventAltCapacityOverlay}>
                                      <Text style={styles.eventAltCapacityValue}>
                                        ({selectedEvent.remainingCapacity})
                                      </Text>
                                      <Text style={styles.eventAltCapacityMeta}>
                                        {selectedEvent.registeredCount}/{selectedEvent.max_capacity}
                                      </Text>
                                    </View>
                                  </View>
                                </View>
                              ) : (
                                <Text style={styles.capacityPlaceholder}>--</Text>
                              )}
                            </View>
                          </View>
                        </View>

                        <View style={[styles.eventSection, styles.eventAltSelectorSection]}>
                          <Text style={styles.sectionLabel}>Trocar Evento</Text>
                          {eventsError ? (
                            <Text style={styles.placeholderText}>Erro ao carregar evento.</Text>
                          ) : (
                            <FamilyEventSelector
                              events={activeEvents}
                              selectedEventId={selectedEventId}
                              onSelectEvent={setSelectedEventId}
                            />
                          )}
                        </View>

                        <View style={[styles.eventSection, styles.eventAltMembersSection]}>
                          {!selectedEvent ? (
                            <Text style={styles.sectionHint}>Selecione um evento para registrar participantes.</Text>
                          ) : null}
                          {selectedEvent?.requer_quorum === true ? (
                            <>
                              <Text style={styles.sectionHint}>
                                Requer quórum: inscrição individual — apenas o usuário ativo aparece na
                                audiência deste evento.
                              </Text>
                              {hasTotemCheckinConfirmed ? (
                                <Text style={styles.sectionHint}>
                                  Check-in no totem concluído — a audiência não pode ser desmarcada.
                                </Text>
                              ) : (
                                <Text style={styles.sectionHint}>
                                  Marque a audiência abaixo para liberar o atalho e o card «QR Code —
                                  Check-in Totem».
                                </Text>
                              )}
                            </>
                          ) : null}
                          {selectedEvent &&
                          isSelectedEventToday &&
                          selectedEventUsesAutomaticCheckIn &&
                          !preCheckinGateRequired ? (
                            <Text style={styles.sectionHint}>
                              Check-in automático: marque a audiência abaixo para registrar a presença da
                              família neste evento.
                            </Text>
                          ) : null}
                          {selectedEvent && selectedEventRequiresQrCheckIn && !isSelectedEventToday ? (
                            <Text style={styles.sectionHint}>
                              O card com QR Code de check-in ficará disponível no dia do evento.
                            </Text>
                          ) : null}
                          {selectedEvent?.requer_quorum !== true &&
                          isSelectedEventToday &&
                          selectedEventRequiresQrCheckIn &&
                          preCheckinGateRequired &&
                          preCheckinGateError ? (
                            <Text style={styles.sectionHintError}>{preCheckinGateError}</Text>
                          ) : null}
                          {selectedEvent?.requer_quorum !== true &&
                          isSelectedEventToday &&
                          selectedEventRequiresQrCheckIn &&
                          preCheckinGateRequired &&
                          !preCheckinGateError &&
                          !hasPreCheckin ? (
                            <Text style={styles.sectionHint}>
                              Marque a audiência abaixo (pré-check-in) para liberar o card de check-in
                              com QR Code.
                            </Text>
                          ) : null}
                          {profile?.id ? (
                            <FamilyRegistrationList
                              familyId={familyId ?? ''}
                              eventId={selectedEvent?.id}
                              title={selectedEvent ? `Audiência para ${selectedEvent.name}` : 'Audiência da Família'}
                              onRegistrationChange={handleEventRegistrationChange}
                              showKidsIndicator={Boolean(selectedEvent?.kids_room)}
                              showTeensIndicator={Boolean(selectedEvent?.teens_room)}
                              quorumMode={selectedEvent?.requer_quorum === true}
                              quorumTotemCheckinConfirmed={hasTotemCheckinConfirmed}
                              sessionPhone={userPhone}
                              sessionProfileName={profile?.full_name ?? null}
                              sessionProfile={{
                                id: profile.id,
                                full_name: profile.full_name ?? null,
                                phone: profile.phone ?? userPhone,
                                birth_date: profile.birth_date ?? null,
                                family_id: familyId ?? profile.codigo_membro ?? null,
                              }}
                            />
                          ) : (
                            <Text style={styles.placeholderText}>
                              Faça login para se inscrever em eventos.
                            </Text>
                          )}
                        </View>
                      </View>
                    )}
                  </View>
                ) : item.content === 'grouped_manage' ? (
                  <View style={[styles.stackContainer, dashboardPanelCardSizeStyle]}>
                    <TouchableOpacity
                      style={[styles.card, styles.miniCard, styles.cardProfileAction]}
                      onPress={() => router.push({ pathname: '/manage-profile', params: userPhone ? { phone: encodeURIComponent(userPhone) } : {} })}
                    >
                      <Text style={styles.miniCardTitle}>Dados Cadastrais</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.card, styles.miniCard, styles.cardManageAction]}
                      onPress={() => router.push({ pathname: '/manage-members', params: userPhone ? { phone: encodeURIComponent(userPhone) } : {} })}
                    >
                      <Text style={styles.miniCardTitle}>Gerenciar Família</Text>
                    </TouchableOpacity>
                  </View>
                ) : item.content === 'members_list' ? (
                  <View style={[styles.card, styles.cardMembersList, eventPanelCardSizeStyle]}>
                    <View style={styles.membersListTitleRow}>
                      <Text style={styles.cardTitle}>
                        {membersListAudience === 'visitors' ? 'LISTA DE VISITANTES' : item.title}
                      </Text>
                      <View style={styles.membersListActionButtons}>
                        {membersListAudience === 'members' ? (
                          <TouchableOpacity
                            style={styles.membersListVisitorsButton}
                            onPress={handleShowVisitorsList}
                            activeOpacity={0.85}
                          >
                            <FontAwesome name="user-o" size={16} color="#FFF" />
                            <Text style={styles.membersListVisitorsButtonText}>Visitantes</Text>
                          </TouchableOpacity>
                        ) : (
                          <TouchableOpacity
                            style={styles.membersListMembersButton}
                            onPress={handleShowMembersList}
                            activeOpacity={0.85}
                          >
                            <FontAwesome name="users" size={16} color="#FFF" />
                            <Text style={styles.membersListMembersButtonText}>Membros</Text>
                          </TouchableOpacity>
                        )}
                        <TouchableOpacity
                          style={styles.membersListMapButton}
                          onPress={handleOpenMembersMap}
                          activeOpacity={0.85}
                        >
                          <FontAwesome name="map" size={18} color="#FFF" />
                          <Text style={styles.membersListMapButtonText}>Mapa</Text>
                        </TouchableOpacity>
                      </View>
                    </View>

                    <Text style={styles.membersListSummaryText}>
                      {normalizeParameterValue(membersListSearchQuery)
                        ? `${filteredMemberListEntries.length} de ${activeMemberListEntries.length} ${
                            membersListAudience === 'visitors' ? 'visitante' : 'membro'
                          }${activeMemberListEntries.length === 1 ? '' : 's'}`
                        : `${activeMemberListEntries.length} ${
                            membersListAudience === 'visitors' ? 'visitante' : 'membro'
                          }${activeMemberListEntries.length === 1 ? '' : 's'} em ordem alfabética`}
                      .
                    </Text>

                    {!isActiveMembersListLoading && !membersListError ? (
                      <View style={styles.membersListSearchSection}>
                        <Text style={styles.sectionLabel}>
                          {membersListAudience === 'visitors'
                            ? 'Procurar visitante'
                            : 'Procurar membro'}
                        </Text>
                        <View style={styles.membersListSearchRow}>
                          <TextInput
                            style={styles.membersListSearchInput}
                            placeholder="Digite o nome..."
                            placeholderTextColor="#94a3b8"
                            value={membersListSearchQuery}
                            onChangeText={setMembersListSearchQuery}
                            autoCapitalize="words"
                            autoCorrect={false}
                          />
                          {normalizeParameterValue(membersListSearchQuery) ? (
                            <TouchableOpacity
                              style={styles.membersListSearchClearButton}
                              onPress={() => setMembersListSearchQuery('')}
                              activeOpacity={0.85}
                              accessibilityRole="button"
                              accessibilityLabel="Limpar busca de membro"
                            >
                              <FontAwesome name="times-circle" size={26} color="#fda4af" />
                            </TouchableOpacity>
                          ) : null}
                        </View>
                      </View>
                    ) : null}

                    <View style={styles.membersListHeaderRow}>
                      <Text style={[styles.membersListHeaderCell, styles.membersListHeaderName]}>
                        Nome
                      </Text>
                      <Text style={styles.membersListHeaderCell}>Família</Text>
                      <Text style={styles.membersListHeaderCell}>Zap</Text>
                    </View>

                    <View style={styles.membersListBox}>
                      {isActiveMembersListLoading ? (
                        <CardLoadingState lines={4} />
                      ) : membersListError ? (
                        <View style={styles.membersListMessageBox}>
                          <Text style={styles.offeringsErrorText}>{membersListError}</Text>
                          <TouchableOpacity
                            style={styles.offeringsSecondaryButton}
                            onPress={() =>
                              void (membersListAudience === 'visitors'
                                ? loadVisitorsList()
                                : loadMembersList())
                            }
                            activeOpacity={0.85}
                          >
                            <Text style={styles.offeringsSecondaryButtonText}>
                              Atualizar lista
                            </Text>
                          </TouchableOpacity>
                        </View>
                      ) : activeMemberListEntries.length ? (
                        filteredMemberListEntries.length ? (
                        <ScrollView
                          style={styles.membersListScroll}
                          contentContainerStyle={styles.membersListContent}
                          nestedScrollEnabled
                          showsVerticalScrollIndicator
                        >
                          {filteredMemberListEntries.map((entry) => (
                            <View key={entry.id} style={styles.membersListRow}>
                              <Text style={styles.membersListName} numberOfLines={1}>
                                {entry.short_name}
                              </Text>
                              <TouchableOpacity
                                style={styles.membersListFamilyButton}
                                onPress={() => setFamilyModalFamilyId(entry.family_id)}
                                activeOpacity={0.85}
                              >
                                <FontAwesome name="users" size={18} color="#fda4af" />
                              </TouchableOpacity>
                              <TouchableOpacity
                                style={[
                                  styles.membersListWhatsappButton,
                                  !entry.phone && styles.membersListWhatsappButtonDisabled,
                                ]}
                                onPress={() => void handleOpenMemberWhatsapp(entry)}
                                disabled={!entry.phone}
                                activeOpacity={0.85}
                              >
                                <FontAwesome
                                  name="whatsapp"
                                  size={20}
                                  color={entry.phone ? '#25D366' : '#64748B'}
                                />
                              </TouchableOpacity>
                            </View>
                          ))}
                        </ScrollView>
                        ) : (
                          <Text style={styles.groupedAudienceEmptyText}>
                            {membersListAudience === 'visitors'
                              ? 'Nenhum visitante corresponde à busca.'
                              : 'Nenhum membro corresponde à busca.'}
                          </Text>
                        )
                      ) : (
                        <Text style={styles.groupedAudienceEmptyText}>
                          {membersListAudience === 'visitors'
                            ? 'Nenhum visitante encontrado.'
                            : 'Nenhum membro encontrado.'}
                        </Text>
                      )}
                    </View>
                  </View>
                ) : item.content === 'birthdays' ? (
                  <View style={[styles.card, styles.cardBirthdays, eventPanelCardSizeStyle]}>
                    <Text style={[styles.cardTitle, styles.cardBirthdaysTitle]}>{item.title}</Text>

                    <View style={styles.birthdaysFilterSection}>
                      <Text style={styles.birthdaysFilterLabel}>Selecionar Mês</Text>
                      <DropdownSelect
                        options={BIRTHDAY_MONTHS}
                        selectedValue={selectedBirthdayMonth}
                        onValueChange={setSelectedBirthdayMonth}
                        modalTitle="Selecionar mês"
                      />
                    </View>

                    <Text style={styles.birthdaysSummaryText}>
                      {birthdaysForSelectedMonth.length} aniversariante
                      {birthdaysForSelectedMonth.length === 1 ? '' : 's'} em{' '}
                      {selectedBirthdayMonthLabel.toLowerCase()}.
                    </Text>

                    <View style={styles.birthdaysListBox}>
                      {isBirthdaysLoading ? (
                        <CardLoadingState lines={4} />
                      ) : birthdaysError ? (
                        <View style={styles.birthdaysMessageBox}>
                          <Text style={styles.offeringsErrorText}>{birthdaysError}</Text>
                          <TouchableOpacity
                            style={styles.offeringsSecondaryButton}
                            onPress={() => void loadBirthdays()}
                            activeOpacity={0.85}
                          >
                            <Text style={styles.offeringsSecondaryButtonText}>
                              Atualizar lista
                            </Text>
                          </TouchableOpacity>
                        </View>
                      ) : birthdaysForSelectedMonth.length ? (
                        <ScrollView
                          style={styles.birthdaysListScroll}
                          contentContainerStyle={styles.birthdaysListContent}
                          nestedScrollEnabled
                          showsVerticalScrollIndicator
                        >
                          {birthdaysForSelectedMonth.map((entry, index) => (
                            <View
                              key={`${entry.birth_date}-${entry.full_name}-${index}`}
                              style={styles.birthdayRow}
                            >
                              <View style={styles.birthdayDateBadge}>
                                <Text style={styles.birthdayDateBadgeText}>
                                  {formatBirthdayDayMonth(entry.day, entry.month)}
                                </Text>
                              </View>
                              <View style={styles.birthdayContent}>
                                <Text style={styles.birthdayName}>{entry.full_name}</Text>
                                <TouchableOpacity
                                  style={[
                                    styles.birthdayWhatsappButton,
                                    !entry.phone && styles.birthdayWhatsappButtonDisabled,
                                  ]}
                                  onPress={() => void handleOpenBirthdayWhatsapp(entry)}
                                  disabled={!entry.phone}
                                  activeOpacity={0.85}
                                >
                                  <FontAwesome
                                    name="whatsapp"
                                    size={18}
                                    color={entry.phone ? '#25D366' : '#64748B'}
                                  />
                                </TouchableOpacity>
                              </View>
                            </View>
                          ))}
                        </ScrollView>
                      ) : (
                        <Text style={styles.groupedAudienceEmptyText}>
                          Nenhum aniversariante encontrado em{' '}
                          {selectedBirthdayMonthLabel.toLowerCase()}.
                        </Text>
                      )}
                    </View>
                  </View>
                ) : item.content === 'financial' ? (
                  <TouchableOpacity
                    style={[styles.card, eventPanelCardSizeStyle, styles.cardFinancialAction]}
                    onPress={() => router.navigate({ pathname: '/financial' })}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.cardTitle}>{item.title}</Text>
                    <View style={styles.cardFinancialBody}>
                      <Text style={styles.cardFinancialSubtitle}>
                        Gestão de entradas, saídas e relatórios da igreja em um só lugar.
                      </Text>
                      <Text style={styles.cardFinancialFooter}>
                        Toque para abrir o módulo financeiro.
                      </Text>
                    </View>
                  </TouchableOpacity>
                ) : item.content === 'vigilance_scales' ? (
                  <View style={[styles.card, styles.cardVigilanceScales, eventPanelCardSizeStyle]}>
                    <Text style={styles.cardTitle}>{item.title}</Text>

                    <View style={styles.vigilanceScaleFilterSection}>
                      <Text style={styles.sectionLabel}>Selecionar Escala</Text>
                      {isVigilanceScalesLoading ? (
                        <CardLoadingState lines={3} />
                      ) : vigilanceScalesError ? (
                        <View style={styles.vigilanceScaleMessageBox}>
                          <Text style={styles.offeringsErrorText}>{vigilanceScalesError}</Text>
                          <TouchableOpacity
                            style={styles.offeringsSecondaryButton}
                            onPress={() => void loadVigilanceScales({ preserveSelection: true })}
                            activeOpacity={0.85}
                          >
                            <Text style={styles.offeringsSecondaryButtonText}>
                              Atualizar escalas
                            </Text>
                          </TouchableOpacity>
                        </View>
                      ) : scaleTypes.length ? (
                        <ScrollView
                          style={styles.vigilanceScaleRadioList}
                          contentContainerStyle={styles.vigilanceScaleRadioListContent}
                          nestedScrollEnabled
                          showsVerticalScrollIndicator
                        >
                          {scaleTypes.map((option) => {
                            const isSelected = selectedVigilanceScale === option.code;

                            return (
                              <TouchableOpacity
                                key={option.code}
                                style={[
                                  styles.vigilanceScaleRadioRow,
                                  isSelected && styles.vigilanceScaleRadioRowSelected,
                                ]}
                                onPress={() => handleSelectVigilanceScale(option)}
                                activeOpacity={0.85}
                              >
                                <View
                                  style={[
                                    styles.vigilanceScaleRadioOuter,
                                    isSelected && styles.vigilanceScaleRadioOuterSelected,
                                  ]}
                                >
                                  {isSelected ? <View style={styles.vigilanceScaleRadioInner} /> : null}
                                </View>
                                <Text
                                  style={[
                                    styles.vigilanceScaleRadioLabel,
                                    isSelected && styles.vigilanceScaleRadioLabelSelected,
                                  ]}
                                >
                                  {option.name}
                                </Text>
                              </TouchableOpacity>
                            );
                          })}
                        </ScrollView>
                      ) : (
                        <Text style={styles.groupedAudienceEmptyText}>
                          Nenhum tipo de escala cadastrado ainda.
                        </Text>
                      )}
                    </View>
                  </View>
                ) : item.content === 'parking_vehicle_v2' ? (
                  <View style={[styles.card, styles.cardParkingVehicleV2, eventPanelCardSizeStyle]}>
                    <Text style={[styles.cardTitle, styles.cardParkingVehicleV2Title]}>
                      {selectedVigilanceScaleLabel}
                    </Text>

                    <View style={styles.parkingV2VehicleStatic}>
                      <ParkingVehicleIdentifyPanel
                        placaQuery={vehiclePlacaQuery}
                        loading={vehicleLookupLoading}
                        error={vehicleLookupError}
                        result={vehicleLookupResult}
                        onChangePlaca={(text) => {
                          setVehiclePlacaQuery(text);
                          setVehicleLookupError(null);
                        }}
                        onSearch={() => void handleSearchVehicleByPlaca()}
                        onReset={handleResetVehicleLookup}
                        onOpenWhatsapp={(phone) => void handleOpenVehicleOwnerWhatsapp(phone)}
                        fillAvailableHeight
                      />
                    </View>

                    <TouchableOpacity
                      style={styles.parkingV2FooterBack}
                      onPress={handleBackFromParking}
                      activeOpacity={0.85}
                    >
                      <Text style={styles.parkingV2BackButtonText}>Voltar</Text>
                    </TouchableOpacity>
                  </View>
                ) : item.content === 'scale_roster' ? (
                  <View style={[styles.card, styles.cardScaleRoster, dashboardPanelCardSizeStyle]}>
                    <Text style={styles.cardTitle}>{selectedVigilanceScaleLabel}</Text>

                    {isSelectedScaleParking ? (
                      <View style={styles.scaleRosterParkingPrompt}>
                        <TouchableOpacity
                          style={styles.scaleRosterIdentifyVehicleButton}
                          onPress={handleOpenParkingFromRoster}
                          activeOpacity={0.85}
                          accessibilityRole="button"
                          accessibilityLabel="Identificar veículo pela placa"
                        >
                          <FontAwesome name="car" size={18} color="#020617" />
                          <Text style={styles.scaleRosterIdentifyVehicleButtonText}>
                            Identificar veículo
                          </Text>
                        </TouchableOpacity>
                      </View>
                    ) : null}

                    <View style={styles.scaleRosterListArea}>
                      {isSelectedScaleIntercession ? (
                        isRegisteredScaleVolunteersLoading ? (
                          <CardLoadingState lines={3} />
                        ) : registeredScaleVolunteersError ? (
                          <View style={styles.vigilanceScaleMessageBox}>
                            <Text style={styles.offeringsErrorText}>{registeredScaleVolunteersError}</Text>
                            {selectedScaleType ? (
                              <TouchableOpacity
                                style={styles.offeringsSecondaryButton}
                                onPress={() =>
                                  void loadRegisteredScaleVolunteers(selectedScaleType.id)
                                }
                                activeOpacity={0.85}
                              >
                                <Text style={styles.offeringsSecondaryButtonText}>Atualizar lista</Text>
                              </TouchableOpacity>
                            ) : null}
                          </View>
                        ) : registeredScaleVolunteers.length ? (
                          <ScrollView
                            style={styles.vigilanceScaleListScroll}
                            contentContainerStyle={styles.vigilanceScaleListContent}
                            nestedScrollEnabled
                            showsVerticalScrollIndicator
                            keyboardShouldPersistTaps="handled"
                          >
                            {registeredScaleVolunteers.map((entry, index) => (
                              <View
                                key={entry.id}
                                style={[
                                  styles.vigilanceScaleRow,
                                  styles.scaleRosterIntercessionRow,
                                  index === 0 && styles.vigilanceScaleRowFirst,
                                ]}
                              >
                                <Text style={styles.vigilanceScaleName} numberOfLines={1}>
                                  {formatDisplayName(entry.name)}
                                </Text>
                                <TouchableOpacity
                                  style={[
                                    styles.vigilanceScaleWhatsappButton,
                                    !entry.phone && styles.vigilanceScaleWhatsappButtonDisabled,
                                  ]}
                                  onPress={() => void handleOpenVigilanceVolunteerWhatsapp(entry.phone)}
                                  disabled={!entry.phone}
                                  activeOpacity={0.85}
                                  accessibilityLabel="Abrir WhatsApp do servo"
                                >
                                  <FontAwesome
                                    name="whatsapp"
                                    size={20}
                                    color={entry.phone ? '#25D366' : '#64748B'}
                                  />
                                </TouchableOpacity>
                              </View>
                            ))}
                          </ScrollView>
                        ) : (
                          <Text style={styles.groupedAudienceEmptyText}>
                            Nenhum servo cadastrado nesta escala.
                          </Text>
                        )
                      ) : isVigilanceScalesLoading ? (
                        <CardLoadingState lines={3} />
                      ) : vigilanceScalesError ? (
                        <View style={styles.vigilanceScaleMessageBox}>
                          <Text style={styles.offeringsErrorText}>{vigilanceScalesError}</Text>
                          <TouchableOpacity
                            style={styles.offeringsSecondaryButton}
                            onPress={() => void loadVigilanceScales({ preserveSelection: true })}
                            activeOpacity={0.85}
                          >
                            <Text style={styles.offeringsSecondaryButtonText}>Atualizar escalas</Text>
                          </TouchableOpacity>
                        </View>
                      ) : vigilanceEntriesForSelectedScale.length ? (
                        <View style={styles.vigilanceScaleListBox}>
                          <View style={styles.vigilanceScaleTableHeader}>
                            <Text
                              style={[
                                styles.vigilanceScaleTableHeaderText,
                                styles.vigilanceScaleNameHeader,
                              ]}
                            >
                              Nome
                            </Text>
                            <View style={styles.vigilanceScaleTrailing}>
                              <Text
                                style={[
                                  styles.vigilanceScaleTableHeaderText,
                                  styles.vigilanceScaleDateHeader,
                                ]}
                              >
                                Data
                              </Text>
                              <Text
                                style={[
                                  styles.vigilanceScaleTableHeaderText,
                                  styles.vigilanceScaleWhatsappHeader,
                                ]}
                              >
                                Zap
                              </Text>
                            </View>
                          </View>
                          <ScrollView
                            style={styles.vigilanceScaleListScroll}
                            contentContainerStyle={styles.vigilanceScaleListContent}
                            nestedScrollEnabled
                            showsVerticalScrollIndicator
                            keyboardShouldPersistTaps="handled"
                          >
                            {vigilanceEntriesForSelectedScale.map((entry, index) => (
                              <View
                                key={`${entry.data_servico}-${entry.voluntario_id}-${index}`}
                                style={[
                                  styles.vigilanceScaleRow,
                                  index === 0 && styles.vigilanceScaleRowFirst,
                                ]}
                              >
                                <Text style={styles.vigilanceScaleName} numberOfLines={1}>
                                  {formatDisplayName(entry.volunteer_name)}
                                </Text>
                                <View style={styles.vigilanceScaleTrailing}>
                                  <Text style={styles.vigilanceScaleDateText}>
                                    {formatServiceDateLabel(entry.data_servico)}
                                  </Text>
                                  <TouchableOpacity
                                    style={[
                                      styles.vigilanceScaleWhatsappButton,
                                      !entry.volunteer_phone && styles.vigilanceScaleWhatsappButtonDisabled,
                                    ]}
                                    onPress={() =>
                                      void handleOpenVigilanceVolunteerWhatsapp(entry.volunteer_phone)
                                    }
                                    disabled={!entry.volunteer_phone}
                                    activeOpacity={0.85}
                                    accessibilityLabel="Abrir WhatsApp do servo"
                                  >
                                    <FontAwesome
                                      name="whatsapp"
                                      size={20}
                                      color={entry.volunteer_phone ? '#25D366' : '#64748B'}
                                    />
                                  </TouchableOpacity>
                                </View>
                              </View>
                            ))}
                          </ScrollView>
                        </View>
                      ) : (
                        <Text style={styles.groupedAudienceEmptyText}>
                          Nenhum registro futuro nesta escala.
                        </Text>
                      )}
                    </View>

                    <TouchableOpacity
                      style={styles.parkingV2FooterBack}
                      onPress={handleBackFromScaleRoster}
                      activeOpacity={0.85}
                    >
                      <Text style={styles.parkingV2BackButtonText}>Voltar</Text>
                    </TouchableOpacity>
                  </View>
                ) : item.content === 'offerings' ? (
                  <View style={[styles.card, styles.cardOfferings, dashboardPanelCardSizeStyle]}>
                    <Text style={styles.cardTitle}>{item.title}</Text>
                    <View style={styles.offeringsContent}>
                      <Text style={styles.offeringsSectionTitle}>Dados do recebedor</Text>
                      <View style={styles.offeringsRecipientBox}>
                        {OFFERINGS_RECIPIENT_ROWS.map((row, index) => (
                          <View
                            key={row.label}
                            style={[
                              styles.offeringsRecipientRow,
                              index === OFFERINGS_RECIPIENT_ROWS.length - 1 &&
                                styles.offeringsRecipientRowLast,
                            ]}
                          >
                            <Text style={styles.offeringsRecipientLabel}>{row.label}</Text>
                            <Text style={styles.offeringsRecipientValue} numberOfLines={3}>
                              {row.value}
                            </Text>
                          </View>
                        ))}
                      </View>

                      <Text style={styles.offeringsLabel}>Chave PIX</Text>
                      {isPixKeyLoading ? (
                        <CardLoadingState lines={2} compact />
                      ) : pixKey ? (
                        <>
                          <View style={styles.offeringsKeyBox}>
                            <Text style={styles.offeringsKeyValue}>{pixKey}</Text>
                          </View>
                          <TouchableOpacity style={styles.offeringsCopyButton} onPress={handleCopyPixKey}>
                            <Text style={styles.offeringsCopyButtonText}>Copiar chave PIX</Text>
                          </TouchableOpacity>
                          <Text style={styles.offeringsHelpText}>
                            Toque no botão para copiar a chave e colar no aplicativo do seu banco.
                          </Text>
                          {pixFeedbackMessage ? (
                            <Text style={styles.offeringsSuccessText}>{pixFeedbackMessage}</Text>
                          ) : null}
                        </>
                      ) : (
                        <>
                          <Text style={styles.offeringsErrorText}>Chave PIX indisponível.</Text>
                          <TouchableOpacity style={styles.offeringsSecondaryButton} onPress={loadPixKey}>
                            <Text style={styles.offeringsSecondaryButtonText}>Atualizar chave PIX</Text>
                          </TouchableOpacity>
                        </>
                      )}
                    </View>
                  </View>
                ) : item.content === 'kids_teens' ? (
                  <View style={[styles.card, styles.cardGroupedAudience, dashboardPanelCardSizeStyle]}>
                    <View style={styles.checkinTitleField}>
                      <Text style={styles.checkinTitleValue} numberOfLines={2}>
                        {selectedEvent?.name ?? 'Nenhum evento selecionado'}
                      </Text>
                    </View>
                    <Text style={styles.cardTitle}>{item.title}</Text>
                    {loadingGroupedRegistrations ? (
                      <CardLoadingState lines={3} />
                    ) : groupedRegistrationsError ? (
                      <Text style={styles.offeringsErrorText}>
                        {groupedRegistrationsError.message}
                      </Text>
                    ) : !selectedEvent ? (
                      <Text style={styles.placeholderText}>Selecione um evento no Painel de Eventos.</Text>
                    ) : !familyId ? (
                      <Text style={styles.placeholderText}>
                        Não foi possível identificar a família do seu cadastro para listar os inscritos.
                      </Text>
                    ) : (
                      <View style={styles.groupedAudienceSections}>
                        <View style={styles.groupedAudienceSelectorRow}>
                          {availableGroupedRooms.map((room) => {
                            const isSelected = room.key === selectedGroupedRoomConfig?.key;

                            return (
                              <TouchableOpacity
                                key={room.key}
                                style={[
                                  styles.groupedAudienceSelectorChip,
                                  isSelected ? room.headerStyle : styles.groupedAudienceSelectorChipInactive,
                                  isSelected && styles.groupedAudienceSelectorChipSelected,
                                ]}
                                onPress={() => setSelectedGroupedRoom(room.key)}
                                activeOpacity={0.85}
                              >
                                <View style={styles.groupedAudienceHeaderLabel}>
                                  <View
                                    style={[
                                      styles.groupedAudienceDot,
                                      room.dotStyle,
                                      !isSelected && styles.groupedAudienceDotInactive,
                                    ]}
                                  />
                                  <Text
                                    style={[
                                      styles.groupedAudienceHeaderText,
                                      !isSelected && styles.groupedAudienceHeaderTextInactive,
                                    ]}
                                  >
                                    {room.label}
                                  </Text>
                                </View>
                                <View
                                  style={[
                                    styles.groupedAudienceCountBadge,
                                    isSelected
                                      ? styles.groupedAudienceCountBadgeActive
                                      : styles.groupedAudienceCountBadgeInactive,
                                  ]}
                                >
                                  <Text
                                    style={[
                                      styles.groupedAudienceCountText,
                                      !isSelected && styles.groupedAudienceCountTextInactive,
                                    ]}
                                  >
                                    {`${room.checkedCount}/${room.totalCount}`}
                                  </Text>
                                </View>
                              </TouchableOpacity>
                            );
                          })}
                        </View>

                        {selectedGroupedRoomConfig ? (
                          <View style={styles.groupedAudienceSection}>
                            <View
                              key={selectedGroupedRoomConfig.key}
                              style={styles.groupedAudienceListBox}
                            >
                              {visibleGroupedRegistrations.length ? (
                                <ScrollView
                                  style={styles.groupedAudienceListScroll}
                                  contentContainerStyle={styles.groupedAudienceListContent}
                                  nestedScrollEnabled
                                  showsVerticalScrollIndicator={false}
                                >
                                  {visibleGroupedRegistrations.map((registration, index) => (
                                    <View
                                      key={`${selectedGroupedRoomConfig.key}-${registration.full_name}-${index}`}
                                      style={[
                                        styles.groupedAudienceRow,
                                        index === visibleGroupedRegistrations.length - 1 &&
                                          styles.groupedAudienceRowLast,
                                      ]}
                                    >
                                      <View style={styles.groupedAudienceRowContent}>
                                        <View style={styles.monitorReadOnlyCheckSlot}>
                                          {registration.room_entry_checked ? (
                                            <Text style={styles.monitorReadOnlyCheckMark}>✓</Text>
                                          ) : null}
                                        </View>
                                        <View style={styles.groupedAudienceNameWrap}>
                                          <Text style={styles.groupedAudienceName} numberOfLines={1}>
                                            {formatDisplayName(registration.full_name)}
                                          </Text>
                                        </View>
                                      </View>
                                    </View>
                                  ))}
                                </ScrollView>
                              ) : (
                                <Text style={styles.groupedAudienceEmptyText}>
                                  {selectedGroupedRoomConfig.key === 'KIDS'
                                    ? 'Nenhum membro da sua família inscrito em IBN KIDS.'
                                    : 'Nenhum membro da sua família inscrito em IBN TEENS.'}
                                </Text>
                              )}
                            </View>
                          </View>
                        ) : (
                          <Text style={styles.placeholderText}>Nenhuma sala disponível para este evento.</Text>
                        )}
                      </View>
                    )}
                  </View>
                ) : (
                  <TouchableOpacity
                    style={[
                      styles.card,
                      dashboardPanelCardSizeStyle,
                      item.content === 'qr' && isQrTotemCardPoolBlue && styles.cardQrTotemConfirmed,
                      item.content === 'pastoral' && styles.cardPastoralAction,
                    ]}
                    onPress={() => {
                      if (item.content === 'qr') setModalVisible(true);
                      if (item.content === 'pastoral') {
                        router.navigate({
                          pathname: '/pastoral',
                          params: currentUserId ? { userId: currentUserId } : {},
                        });
                      }
                    }}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.cardTitle}>{item.title}</Text>
                    {item.content === 'qr' ? (
                      <>
                        <View style={styles.checkinTitleField}>
                          <Text style={styles.checkinTitleValue} numberOfLines={2}>
                            {selectedEvent?.name ?? 'Nenhum evento selecionado'}
                          </Text>
                        </View>
                        {qrFamilyCode ? (
                          <View style={styles.checkinEtiquetaField}>
                            <Text style={styles.checkinEtiquetaLabel}>Etiqueta (código da família)</Text>
                            <Text style={styles.checkinEtiquetaValue}>{qrFamilyCode}</Text>
                          </View>
                        ) : (
                          <Text style={styles.qrCardHint}>
                            Vincule um código de família em Dados Cadastrais para gerar o QR Code.
                          </Text>
                        )}
                        <Text style={styles.qrCardHint}>
                          {selectedEvent?.requer_quorum === true
                            ? 'Após marcar a audiência, apresente esta etiqueta e o QR no totem.'
                            : selectedEvent?.totem_ativo === true
                              ? 'Apresente este QR no totem para confirmar a presença.'
                              : 'Check-in manual: apresente este QR na entrada do evento.'}
                        </Text>
                        {qrFamilyCode ? (
                          <View style={styles.qrBackground}>
                            <QRCode value={qrFamilyCode} size={180} />
                          </View>
                        ) : null}
                        {selectedEvent?.kids_room || selectedEvent?.teens_room ? (
                          <View style={styles.checkinRoomRow}>
                            {selectedEvent?.kids_room ? (
                              <View
                                style={[
                                  styles.checkinRoomBadge,
                                  styles.checkinRoomBadgeKids,
                                ]}
                              >
                                <View
                                  style={[
                                    styles.eventRoomIndicator,
                                    styles.eventRoomIndicatorKids,
                                  ]}
                                />
                                <Text style={styles.checkinRoomBadgeText}>IBN Kids</Text>
                              </View>
                            ) : null}
                            {selectedEvent?.teens_room ? (
                              <View
                                style={[
                                  styles.checkinRoomBadge,
                                  styles.checkinRoomBadgeTeens,
                                ]}
                              >
                                <View
                                  style={[
                                    styles.eventRoomIndicator,
                                    styles.eventRoomIndicatorTeens,
                                  ]}
                                />
                                <Text style={styles.checkinRoomBadgeText}>IBN Teens</Text>
                              </View>
                            ) : null}
                          </View>
                        ) : null}
                      </>
                    ) : item.content === 'pastoral' ? (
                      <View style={styles.cardPastoralBody}>
                        <Text style={styles.cardPastoralSubtitle}>
                          Sua jornada de fé acompanhada de perto: solicitações, orações e aconselhamento ao
                          seu alcance.
                        </Text>
                        <Text style={styles.cardPastoralFooter}>
                          Sua necessidade é nossa prioridade. Toque aqui para iniciar um atendimento
                          personalizado.
                        </Text>
                      </View>
                    ) : (
                      <Text style={styles.placeholderText}>Clique aqui para abrir o formulário</Text>
                    )}
                  </TouchableOpacity>
                )}
              </View>
            )}
          />

          <View style={[styles.footerControls, { paddingBottom: insets.bottom + 10 }]}>
            <CarouselFooterNav
              currentIndex={currentIndex}
              totalCount={data.length}
              centerLabel="Menu"
              centerAccessibilityLabel="Menu"
              onCenterPress={handleExit}
              onPreviousPress={handleFooterPreviousPress}
              onNextPress={handleFooterNextPress}
              onPreviousPressIn={() => startFooterNavRepeat('prev')}
              onPreviousPressOut={handleFooterNavPressOut}
              onNextPressIn={() => startFooterNavRepeat('next')}
              onNextPressOut={handleFooterNavPressOut}
              isPreviousDisabled={currentIndex === 0}
              isNextDisabled={currentIndex === data.length - 1}
              accent="emerald"
              trailingAccessory={
                !isMaintenanceAccessLoading && canViewMaintenance ? (
                  <TouchableOpacity
                    style={[
                      styles.footerNavButton,
                      styles.footerNavButtonSquare,
                      styles.footerSettingsButton,
                      isFooterSettingsPressed && styles.footerSettingsButtonPressed,
                    ]}
                    onPress={handleFooterSettingsPress}
                    activeOpacity={1}
                    accessibilityLabel="Configurações"
                    accessibilityState={{ selected: isFooterSettingsPressed }}
                  >
                    <FontAwesome
                      name="cog"
                      size={22}
                      color={isFooterSettingsPressed ? '#FECACA' : '#64748B'}
                    />
                  </TouchableOpacity>
                ) : null
              }
            />
          </View>
        </View>

        <Modal
          visible={familyModalFamilyId !== null}
          transparent
          animationType="fade"
          onRequestClose={() => setFamilyModalFamilyId(null)}
        >
          <Pressable
            style={styles.membersFamilyBackdrop}
            onPress={() => setFamilyModalFamilyId(null)}
          >
            <Pressable style={styles.membersFamilyModalCard} onPress={() => undefined}>
              <Text style={styles.membersFamilyModalTitle}>Membros da família</Text>
              {familyModalFamilyId ? (
                <Text style={styles.membersFamilyModalSubtitle}>
                  Família {familyModalFamilyId}
                </Text>
              ) : null}
              <ScrollView
                style={styles.membersFamilyModalScroll}
                contentContainerStyle={styles.membersFamilyModalScrollContent}
                nestedScrollEnabled
                showsVerticalScrollIndicator
              >
                {familyModalMembers.map((member) => (
                  <View key={member.id} style={styles.membersFamilyModalRow}>
                    <View style={styles.membersFamilyModalRowContent}>
                      <Text style={styles.membersFamilyModalName}>{member.full_name}</Text>
                      {member.relationship ? (
                        <Text style={styles.membersFamilyModalRelationship}>
                          {member.relationship}
                        </Text>
                      ) : null}
                    </View>
                    {member.phone ? (
                      <TouchableOpacity
                        style={styles.membersFamilyModalWhatsappButton}
                        onPress={() => void handleOpenMemberWhatsapp(member)}
                        activeOpacity={0.85}
                      >
                        <FontAwesome name="whatsapp" size={20} color="#25D366" />
                      </TouchableOpacity>
                    ) : null}
                  </View>
                ))}
              </ScrollView>
              <TouchableOpacity
                style={styles.membersFamilyCloseButton}
                onPress={() => setFamilyModalFamilyId(null)}
                activeOpacity={0.85}
              >
                <Text style={styles.membersFamilyCloseButtonText}>Fechar</Text>
              </TouchableOpacity>
            </Pressable>
          </Pressable>
        </Modal>

        {currentUserId && <CheckinModal visible={modalVisible} onClose={() => setModalVisible(false)} userId={currentUserId} />}
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  aclUnavailableBanner: {
    backgroundColor: 'rgba(251, 191, 36, 0.15)',
    borderColor: 'rgba(251, 191, 36, 0.35)',
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
    marginHorizontal: 24,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  aclUnavailableText: {
    color: '#FCD34D',
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
  },
  header: { paddingHorizontal: 24, paddingTop: 10, paddingBottom: 8 },
  welcomeBox: {
    width: '100%',
    borderRadius: 18,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 4,
  },
  welcomeBoxLgpdPending: {
    backgroundColor: 'rgba(185, 28, 28, 0.72)',
  },
  welcomeText: { color: '#94A3B8', fontSize: 13, textTransform: 'uppercase', letterSpacing: 1 },
  welcomeNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  userName: {
    color: '#FFF',
    fontSize: 24,
    fontWeight: '800',
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
  },
  activeScreenTitle: {
    flexShrink: 0,
    maxWidth: '46%',
    color: '#6EE7B7',
    fontSize: 11,
    fontWeight: '800',
    textAlign: 'right',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    lineHeight: 14,
  },
  listContainer: { flex: 1, minHeight: 0 },
  dashboardFlatList: { flex: 1, minHeight: 0 },
  cardWrapper: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 0,
    paddingBottom: 8,
  },
  card: {
    width: '90%',
    alignSelf: 'center',
    backgroundColor: 'rgba(30, 41, 59, 0.7)',
    borderWidth: 1,
    borderColor: '#10b981',
    borderRadius: STATIC_CARD_INSETS.borderRadius,
    padding: STATIC_CARD_INSETS.padding,
    alignItems: 'center',
    overflow: 'hidden',
    justifyContent: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 15,
  },
  cardQrTotemConfirmed: {
    backgroundColor: 'rgba(6, 182, 212, 0.48)',
    borderColor: '#22D3EE',
    shadowColor: '#06B6D4',
    shadowOpacity: 0.35,
  },
  eventCard: {
    padding: 20,
    alignItems: 'stretch',
    justifyContent: 'flex-start',
  },
  eventAltCard: {
    flex: 1,
    minHeight: 0,
    alignSelf: 'stretch',
  },
  eventAltCardBody: {
    flex: 1,
    minHeight: 0,
    width: '100%',
    gap: 4,
  },
  eventSection: {
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 24,
    padding: 18,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 12,
  },
  eventInfoSection: {
    flex: 1,
    minHeight: 132,
  },
  capacitySection: {
    width: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eventAltHero: {
    padding: 8,
    flexShrink: 0,
  },
  eventAltEmptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  eventAltHeroRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 8,
  },
  eventAltSummary: {
    flex: 1,
    minWidth: 0,
  },
  eventAltName: {
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: '800',
    lineHeight: 22,
  },
  eventAltMeta: {
    color: '#BAE6FD',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 3,
  },
  eventAltLocation: {
    color: '#CBD5E1',
    fontSize: 12,
    marginTop: 2,
  },
  eventAltRoomLegendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    flexWrap: 'nowrap',
    gap: 4,
    marginTop: 8,
    width: '100%',
  },
  eventAltRoomBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderWidth: 1,
  },
  eventAltRoomBadgeInline: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
  },
  eventAltRoomBadgeKids: {
    backgroundColor: 'rgba(250, 204, 21, 0.12)',
    borderColor: 'rgba(250, 204, 21, 0.35)',
  },
  eventAltRoomBadgeTeens: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderColor: 'rgba(239, 68, 68, 0.35)',
  },
  eventAltRoomBadgeText: {
    color: '#E2E8F0',
    fontSize: 11,
    fontWeight: '600',
    flexShrink: 1,
    textAlign: 'center',
  },
  eventAltCapacityCard: {
    width: 96,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#164e63',
    backgroundColor: 'rgba(8, 47, 73, 0.35)',
    paddingVertical: 8,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  eventAltCapacityCupWrapper: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  eventAltCapacityCup: {
    width: 70,
    height: 84,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: 'rgba(103, 232, 249, 0.65)',
    backgroundColor: 'rgba(8, 47, 73, 0.35)',
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  eventAltCapacityLiquid: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    opacity: 0.9,
  },
  eventAltCapacityOverlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  eventAltCapacityValue: {
    color: '#ECFEFF',
    fontSize: 20,
    fontWeight: '900',
    textAlign: 'center',
  },
  eventAltCapacityMeta: {
    color: '#BAE6FD',
    fontSize: 10,
    fontWeight: '700',
    marginTop: 3,
    textAlign: 'center',
  },
  eventAltSelectorSection: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    overflow: 'hidden',
    width: '100%',
    flexShrink: 0,
  },
  eventAltSelectorContent: {
    gap: 8,
    paddingRight: 8,
  },
  eventAltChip: {
    width: 170,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    paddingVertical: 8,
    paddingHorizontal: 12,
    paddingRight: 32,
    position: 'relative',
  },
  eventAltChipSelected: {
    backgroundColor: 'rgba(6, 182, 212, 0.25)',
    borderColor: '#67e8f9',
  },
  eventAltChipIndicators: {
    position: 'absolute',
    top: 11,
    right: 10,
    alignItems: 'center',
    gap: 5,
  },
  eventAltChipTitle: {
    color: '#E2E8F0',
    fontSize: 14,
    fontWeight: '700',
  },
  eventAltChipTitleSelected: {
    color: '#ECFEFF',
  },
  eventAltChipMeta: {
    color: '#94A3B8',
    fontSize: 11,
    marginTop: 5,
  },
  eventAltChipMetaSelected: {
    color: '#BAE6FD',
  },
  eventAltMembersSection: {
    flex: 1,
    minHeight: 0,
    paddingVertical: 12,
    paddingHorizontal: 14,
    overflow: 'hidden',
  },
  eventsScroll: {
    maxHeight: 118,
  },
  eventsScrollContent: {
    gap: 8,
  },
  eventOption: {
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 12,
    paddingRight: 36,
    position: 'relative',
  },
  eventOptionSelected: {
    backgroundColor: 'rgba(6, 182, 212, 0.25)',
    borderColor: '#67e8f9',
  },
  eventRoomIndicators: {
    position: 'absolute',
    top: 10,
    right: 10,
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 6,
  },
  eventRoomIndicator: {
    width: 10,
    height: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  eventRoomIndicatorKids: {
    backgroundColor: '#facc15',
  },
  eventRoomIndicatorTeens: {
    backgroundColor: '#ef4444',
  },
  eventOptionTitle: {
    color: '#E2E8F0',
    fontSize: 15,
    fontWeight: '700',
  },
  eventOptionTitleSelected: {
    color: '#ECFEFF',
  },
  eventOptionMeta: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 4,
  },
  eventOptionMetaSelected: {
    color: '#BAE6FD',
  },
  eventOptionLocation: {
    color: '#CBD5E1',
    fontSize: 12,
    marginTop: 3,
  },
  eventOptionLocationSelected: {
    color: '#E0F2FE',
  },
  membersSection: {
    flex: 1,
    minHeight: 135,
    maxHeight: 205,
    overflow: 'hidden',
  },
  roomLegendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: 8,
    marginRight: 112,
    marginTop: 12,
  },
  roomLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  roomLegendText: {
    color: '#CBD5E1',
    fontSize: 12,
    fontWeight: '600',
  },
  sectionDivider: {
    height: 18,
  },
  sectionLabel: {
    color: '#10b981',
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
  },
  sectionTitle: {
    color: '#FFF',
    fontSize: 22,
    fontWeight: '800',
  },
  capacityValue: {
    color: '#E0F2FE',
    fontSize: 20,
    fontWeight: '900',
    textAlign: 'center',
  },
  capacityPlaceholder: {
    color: '#94A3B8',
    fontSize: 24,
    fontWeight: '700',
  },
  capacityCupWrapper: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  capacityCup: {
    width: 72,
    height: 84,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: 'rgba(103, 232, 249, 0.65)',
    backgroundColor: 'rgba(8, 47, 73, 0.35)',
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  capacityLiquid: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    opacity: 0.9,
  },
  capacityOverlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  capacityMeta: {
    color: '#BAE6FD',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 4,
    textAlign: 'center',
  },
  sectionHint: {
    color: '#94A3B8',
    fontSize: 14,
    marginTop: 6,
    marginBottom: 4,
  },
  sectionHintError: {
    color: '#FCA5A5',
    fontSize: 14,
    marginBottom: 4,
    marginTop: 6,
  },
  stackContainer: {
    gap: 12,
    flex: 1,
    minHeight: 0,
    width: '100%',
    justifyContent: 'center',
  },
  miniCard: {
    flex: 1,
    width: '100%',
    padding: 24,
    borderRadius: 24,
    minHeight: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  miniCardTitle: { fontSize: 22, fontWeight: '800', color: '#FFF', textAlign: 'center' },
  cardProfileAction: { backgroundColor: 'rgba(16, 185, 129, 0.3)', borderColor: '#10b981' },
  cardManageAction: { backgroundColor: 'rgba(6, 182, 212, 0.3)', borderColor: '#06b6d4' },
  cardPastoralAction: { backgroundColor: 'rgba(168, 85, 247, 0.3)', borderColor: '#a855f7' },
  cardFinancialAction: { backgroundColor: 'rgba(16, 185, 129, 0.22)', borderColor: '#10b981' },
  cardFinancialBody: {
    flex: 1,
    justifyContent: 'center',
    paddingVertical: 8,
  },
  cardFinancialSubtitle: {
    color: '#D1FAE5',
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginTop: 12,
    paddingHorizontal: 8,
  },
  cardFinancialFooter: {
    color: '#6EE7B7',
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    marginTop: 16,
    fontWeight: '600',
  },
  cardPastoralBody: {
    width: '100%',
    paddingHorizontal: 8,
  },
  cardPastoralSubtitle: {
    color: '#E9D5FF',
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginTop: 20,
    fontWeight: '500',
  },
  cardPastoralFooter: {
    color: '#C4B5FD',
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    marginTop: 24,
    fontWeight: '600',
  },
  cardOfferings: {
    alignItems: 'stretch',
    justifyContent: 'flex-start',
    padding: 24,
  },
  cardBirthdays: {
    alignItems: 'stretch',
    justifyContent: 'flex-start',
    padding: 18,
    gap: 6,
    backgroundColor: 'rgba(37, 99, 235, 0.14)',
    borderColor: '#60a5fa',
  },
  cardBirthdaysTitle: {
    marginBottom: 8,
  },
  cardMembersList: {
    alignItems: 'stretch',
    justifyContent: 'flex-start',
    padding: 20,
    gap: 10,
    backgroundColor: 'rgba(244, 63, 94, 0.16)',
    borderColor: '#fb7185',
  },
  membersListSummaryText: {
    color: '#FECDD3',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  membersListTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  membersListActionButtons: {
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  membersListVisitorsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(59, 130, 246, 0.25)',
    borderWidth: 1,
    borderColor: '#3b82f6',
  },
  membersListVisitorsButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  membersListMembersButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(251, 113, 133, 0.25)',
    borderWidth: 1,
    borderColor: '#fb7185',
  },
  membersListMembersButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  membersListMapButton: {
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(16, 185, 129, 0.25)',
    borderWidth: 1,
    borderColor: '#10b981',
  },
  membersListMapButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  membersListSearchSection: {
    gap: 6,
  },
  membersListSearchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  membersListSearchInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: 'rgba(251, 113, 133, 0.45)',
    borderRadius: 12,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    color: '#FFF',
    fontSize: 15,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  membersListSearchClearButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  membersListHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(251, 113, 133, 0.35)',
  },
  membersListHeaderCell: {
    flex: 1,
    color: '#FDA4AF',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    textAlign: 'center',
  },
  membersListHeaderName: {
    flex: 2,
    textAlign: 'left',
  },
  membersListBox: {
    flex: 1,
    minHeight: 0,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(251, 113, 133, 0.35)',
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    overflow: 'hidden',
  },
  membersListLoader: {
    marginTop: 24,
  },
  membersListMessageBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    padding: 16,
  },
  membersListScroll: {
    flex: 1,
  },
  membersListContent: {
    paddingVertical: 4,
  },
  membersListRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(148, 163, 184, 0.12)',
  },
  membersListName: {
    flex: 2,
    color: '#FFF',
    fontSize: 15,
    fontWeight: '600',
  },
  membersListFamilyButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  membersListWhatsappButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  membersListWhatsappButtonDisabled: {
    opacity: 0.55,
  },
  membersFamilyBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 23, 0.72)',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  membersFamilyModalCard: {
    maxHeight: '70%',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#fb7185',
    backgroundColor: '#1e293b',
    padding: 20,
    gap: 10,
  },
  membersFamilyModalTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
  },
  membersFamilyModalSubtitle: {
    color: '#FDA4AF',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  membersFamilyModalScroll: {
    maxHeight: 280,
  },
  membersFamilyModalScrollContent: {
    gap: 8,
    paddingBottom: 4,
  },
  membersFamilyModalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(244, 63, 94, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(251, 113, 133, 0.25)',
  },
  membersFamilyModalRowContent: {
    flex: 1,
    minWidth: 0,
  },
  membersFamilyModalName: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '700',
  },
  membersFamilyModalWhatsappButton: {
    padding: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  membersFamilyModalRelationship: {
    color: '#FDA4AF',
    fontSize: 12,
    marginTop: 4,
    fontWeight: '600',
  },
  membersFamilyCloseButton: {
    marginTop: 4,
    backgroundColor: '#f43f5e',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  membersFamilyCloseButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
  },
  cardVigilanceScales: {
    alignItems: 'stretch',
    justifyContent: 'flex-start',
    padding: 20,
    gap: 12,
    backgroundColor: 'rgba(20, 184, 166, 0.14)',
    borderColor: '#2dd4bf',
  },
  cardParkingVehicleV2: {
    alignItems: 'stretch',
    justifyContent: 'flex-start',
    padding: 20,
    gap: 6,
    minHeight: 0,
    overflow: 'hidden',
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderColor: '#fbbf24',
  },
  cardScaleRoster: {
    alignItems: 'stretch',
    justifyContent: 'flex-start',
    padding: 20,
    gap: 10,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderColor: '#34d399',
  },
  scaleRosterParkingPrompt: {
    flexShrink: 0,
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  scaleRosterIdentifyVehicleButton: {
    width: '100%',
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 14,
    backgroundColor: '#FBBF24',
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.65)',
  },
  scaleRosterIdentifyVehicleButtonText: {
    color: '#020617',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  scaleRosterListArea: {
    flex: 1,
    minHeight: 0,
  },
  scaleRosterIntercessionRow: {
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardParkingVehicleV2Title: {
    marginBottom: 4,
    flexShrink: 0,
  },
  parkingV2VehicleStatic: {
    flex: 1,
    minHeight: 0,
    width: '100%',
  },
  parkingV2ScaleScrollArea: {
    minHeight: 0,
  },
  parkingScalePrompt: {
    flexShrink: 0,
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 8,
  },
  parkingOpenPanelButton: {
    backgroundColor: '#10b981',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  parkingOpenPanelButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
  },
  parkingV2SectionBox: {
    gap: 10,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
  },
  parkingV2SectionBoxVehicle: {
    borderColor: 'rgba(251, 191, 36, 0.45)',
  },
  parkingV2SectionBoxScale: {
    borderColor: 'rgba(45, 212, 191, 0.45)',
  },
  parkingV2SectionBoxScaleFlex: {
    flex: 1,
    minHeight: 0,
  },
  parkingV2SectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  parkingV2SectionTitleVehicle: {
    color: '#FBBF24',
  },
  parkingV2SectionTitleScale: {
    color: '#2DD4BF',
  },
  parkingV2Badge: {
    alignSelf: 'flex-start',
    color: '#FDE68A',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.45)',
    backgroundColor: 'rgba(245, 158, 11, 0.16)',
  },
  parkingV2SearchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  parkingV2Input: {
    flex: 1,
    backgroundColor: '#0f172a',
    color: '#FFF',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  parkingV2SearchButton: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#10b981',
    alignItems: 'center',
    justifyContent: 'center',
  },
  parkingV2SearchButtonDisabled: {
    opacity: 0.6,
  },
  parkingV2ErrorText: {
    color: '#FCA5A5',
    fontSize: 13,
    lineHeight: 18,
  },
  parkingV2ResultCard: {
    gap: 10,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.35)',
    backgroundColor: 'rgba(15, 23, 42, 0.88)',
  },
  parkingV2OwnerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  parkingV2OwnerName: {
    flex: 1,
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: '800',
    lineHeight: 24,
  },
  parkingV2VehicleSummary: {
    color: '#CBD5E1',
    fontSize: 14,
    lineHeight: 20,
  },
  parkingV2NewSearchButton: {
    alignSelf: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  parkingV2FooterBack: {
    flexShrink: 0,
    marginTop: 4,
    marginBottom: 0,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.35)',
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    alignItems: 'center',
  },
  parkingV2ResetButtonText: {
    color: '#FBBF24',
    fontSize: 13,
    fontWeight: '700',
  },
  parkingV2BackButtonText: {
    color: '#E2E8F0',
    fontSize: 14,
    fontWeight: '700',
  },
  cardGroupedAudience: {
    alignItems: 'stretch',
    justifyContent: 'flex-start',
    padding: 20,
    gap: 10,
  },
  cardTitle: { fontSize: 22, fontWeight: '800', marginBottom: 16, color: '#FFF', textAlign: 'center' },
  groupedAudienceSections: {
    flex: 1,
    minHeight: 0,
    gap: 14,
  },
  groupedAudienceSelectorRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'stretch',
    marginTop: 6,
  },
  groupedAudienceSelectorChip: {
    flex: 1,
    flexBasis: 0,
    borderRadius: 18,
    borderWidth: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    height: 56,
    justifyContent: 'space-between',
    alignSelf: 'stretch',
    overflow: 'hidden',
  },
  groupedAudienceSelectorChipInactive: {
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    borderColor: '#334155',
  },
  groupedAudienceSelectorChipSelected: {
    borderColor: '#67e8f9',
  },
  groupedAudienceSection: {
    flex: 1,
    minHeight: 0,
    gap: 8,
  },
  groupedAudienceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    borderRadius: 18,
    borderWidth: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  groupedAudienceHeaderKids: {
    backgroundColor: 'rgba(8, 145, 178, 0.16)',
    borderColor: 'rgba(103, 232, 249, 0.5)',
  },
  groupedAudienceHeaderTeens: {
    backgroundColor: 'rgba(8, 145, 178, 0.16)',
    borderColor: 'rgba(103, 232, 249, 0.5)',
  },
  groupedAudienceHeaderLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minWidth: 0,
    flex: 1,
  },
  groupedAudienceDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
  },
  groupedAudienceDotInactive: {
    opacity: 0.55,
  },
  groupedAudienceDotKids: {
    backgroundColor: '#FACC15',
  },
  groupedAudienceDotTeens: {
    backgroundColor: '#EF4444',
  },
  groupedAudienceHeaderText: {
    color: '#E2E8F0',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  groupedAudienceHeaderTextInactive: {
    color: '#94A3B8',
  },
  groupedAudienceCountBadge: {
    minWidth: 54,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupedAudienceCountBadgeActive: {
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
  },
  groupedAudienceCountBadgeInactive: {
    backgroundColor: 'rgba(2, 6, 23, 0.55)',
  },
  groupedAudienceCountText: {
    color: '#F8FAFC',
    fontSize: 12,
    fontWeight: '800',
  },
  groupedAudienceCountTextInactive: {
    color: '#94A3B8',
  },
  groupedAudienceListBox: {
    flex: 1,
    minHeight: 220,
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 18,
    backgroundColor: 'rgba(15, 23, 42, 0.3)',
    overflow: 'hidden',
  },
  groupedAudienceListScroll: {
    flex: 1,
    minHeight: 0,
  },
  groupedAudienceListContent: {
    paddingVertical: 2,
  },
  groupedAudienceRow: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(148, 163, 184, 0.24)',
  },
  groupedAudienceRowLast: {
    borderBottomWidth: 0,
  },
  groupedAudienceRowContent: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    gap: 10,
  },
  groupedAudienceNameWrap: {
    flex: 1,
    minWidth: 0,
    paddingLeft: 6,
  },
  groupedAudienceName: {
    color: '#F8FAFC',
    fontSize: 15,
    textAlign: 'left',
    flexShrink: 1,
  },
  groupedAudienceEmptyText: {
    color: '#94A3B8',
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 14,
    paddingVertical: 16,
  },
  offeringsContent: { gap: 14 },
  vigilanceScaleFilterSection: {
    flex: 1,
    minHeight: 0,
    gap: 8,
  },
  vigilanceScaleRadioList: {
    flex: 1,
    minHeight: 0,
  },
  vigilanceScaleRadioListContent: {
    gap: 8,
  },
  vigilanceScaleRadioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
  },
  vigilanceScaleRadioRowSelected: {
    borderColor: '#10b981',
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
  },
  vigilanceScaleRadioOuter: {
    width: 20,
    height: 20,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: '#94A3B8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  vigilanceScaleRadioOuterSelected: {
    borderColor: '#10b981',
  },
  vigilanceScaleRadioInner: {
    width: 10,
    height: 10,
    borderRadius: 999,
    backgroundColor: '#10b981',
  },
  vigilanceScaleRadioLabel: {
    flex: 1,
    color: '#CBD5E1',
    fontSize: 14,
    fontWeight: '600',
  },
  vigilanceScaleRadioLabelSelected: {
    color: '#F8FAFC',
  },
  vigilanceScalePickerWrapper: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    overflow: 'hidden',
  },
  vigilanceScalePicker: {
    color: '#F8FAFC',
    width: '100%',
  },
  vigilanceScalePickerItem: {
    color: '#F8FAFC',
  },
  vigilanceScaleLoader: {
    marginVertical: 24,
  },
  vigilanceScaleListBox: {
    flex: 1,
    minHeight: 0,
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 18,
    backgroundColor: 'rgba(15, 23, 42, 0.3)',
    overflow: 'hidden',
  },
  vigilanceScaleListScroll: {
    flex: 1,
    minHeight: 0,
  },
  vigilanceScaleListContent: {
    paddingVertical: 2,
  },
  vigilanceScaleMessageBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 16,
  },
  vigilanceScaleTableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 14,
    paddingRight: 8,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(45, 212, 191, 0.24)',
    backgroundColor: 'rgba(15, 23, 42, 0.88)',
    zIndex: 1,
  },
  vigilanceScaleTableHeaderText: {
    color: '#99F6E4',
    fontSize: 13,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  vigilanceScaleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 14,
    paddingRight: 8,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(148, 163, 184, 0.24)',
  },
  vigilanceScaleRowFirst: {
    backgroundColor: 'rgba(34, 211, 238, 0.32)',
    borderBottomColor: 'rgba(34, 211, 238, 0.45)',
  },
  vigilanceScaleNameHeader: {
    flex: 1,
    minWidth: 0,
    marginRight: 8,
  },
  vigilanceScaleTrailing: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    flexShrink: 0,
    gap: 6,
    marginLeft: 'auto',
  },
  vigilanceScaleDateHeader: {
    textAlign: 'right',
  },
  vigilanceScaleWhatsappHeader: {
    width: 36,
    textAlign: 'center',
  },
  vigilanceScaleName: {
    flex: 1,
    minWidth: 0,
    marginRight: 8,
    color: '#F8FAFC',
    fontSize: 15,
  },
  vigilanceScaleDateText: {
    color: '#CCFBF1',
    fontSize: 13,
    textAlign: 'right',
    flexShrink: 0,
  },
  vigilanceScaleWhatsappButton: {
    width: 36,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 2,
    paddingLeft: 0,
    paddingRight: 0,
  },
  vigilanceScaleWhatsappButtonDisabled: {
    opacity: 0.55,
  },
  vigilanceScaleBlankState: {
    flex: 1,
    minHeight: 120,
  },
  vigilanceScaleBodyScroll: {
    flex: 1,
    minHeight: 0,
  },
  vigilanceScaleParkingContent: {
    gap: 12,
    paddingBottom: 8,
  },
  parkingVehiclesSection: {
    gap: 12,
  },
  vigilanceCheckboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  vigilanceCheckbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#94A3B8',
  },
  vigilanceCheckboxChecked: {
    backgroundColor: '#10b981',
    borderColor: '#10b981',
  },
  vigilanceCheckboxLabel: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '600',
  },
  parkingVehicleLookupBox: {
    gap: 10,
  },
  parkingVehicleInput: {
    backgroundColor: '#0f172a',
    color: '#FFF',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155',
    fontSize: 15,
  },
  parkingVehicleSearchButton: {
    backgroundColor: '#10b981',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  parkingVehicleSearchButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
  },
  parkingVehicleSearchButtonDisabled: {
    opacity: 0.6,
  },
  parkingVehicleResultCard: {
    gap: 4,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
  },
  parkingVehicleOwnerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(148, 163, 184, 0.24)',
  },
  parkingVehicleOwnerName: {
    flex: 1,
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 22,
  },
  parkingVehicleResultTitle: {
    color: '#10b981',
    fontSize: 13,
    fontWeight: '800',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  parkingVehicleResultSubtitle: {
    color: '#10b981',
    fontSize: 13,
    fontWeight: '800',
    textTransform: 'uppercase',
    marginTop: 8,
    marginBottom: 4,
  },
  parkingVehicleResultLine: {
    color: '#E2E8F0',
    fontSize: 14,
    lineHeight: 20,
  },
  birthdaysFilterSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 2,
  },
  birthdaysFilterLabel: {
    color: '#10b981',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    flexShrink: 0,
  },
  birthdaysSummaryText: {
    color: '#DBEAFE',
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 4,
  },
  birthdaysLoader: {
    marginVertical: 24,
  },
  birthdaysListBox: {
    flex: 1,
    minHeight: 0,
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 18,
    backgroundColor: 'rgba(15, 23, 42, 0.3)',
    overflow: 'hidden',
  },
  birthdaysListScroll: {
    flex: 1,
    minHeight: 0,
  },
  birthdaysListContent: {
    paddingVertical: 0,
  },
  birthdaysMessageBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 16,
  },
  birthdayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(148, 163, 184, 0.24)',
  },
  birthdayContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  birthdayDateBadge: {
    minWidth: 64,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(96, 165, 250, 0.55)',
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    paddingVertical: 5,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  birthdayDateBadgeText: {
    color: '#DBEAFE',
    fontSize: 12,
    fontWeight: '800',
  },
  birthdayName: {
    flex: 1,
    color: '#F8FAFC',
    fontSize: 14,
  },
  birthdayWhatsappButton: {
    width: 32,
    height: 32,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(37, 211, 102, 0.4)',
    backgroundColor: 'rgba(37, 211, 102, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  birthdayWhatsappButtonDisabled: {
    borderColor: 'rgba(100, 116, 139, 0.3)',
    backgroundColor: 'rgba(51, 65, 85, 0.4)',
  },
  offeringsSectionTitle: {
    color: '#E2E8F0',
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'left',
  },
  offeringsRecipientBox: {
    backgroundColor: 'rgba(248, 250, 252, 0.95)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.45)',
    paddingHorizontal: 14,
    paddingVertical: 4,
  },
  offeringsRecipientRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(148, 163, 184, 0.35)',
  },
  offeringsRecipientRowLast: {
    borderBottomWidth: 0,
  },
  offeringsRecipientLabel: {
    color: '#64748B',
    fontSize: 14,
    fontWeight: '600',
    flexShrink: 0,
  },
  offeringsRecipientValue: {
    flex: 1,
    color: '#1E293B',
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'right',
  },
  offeringsLabel: {
    color: '#A7F3D0',
    fontSize: 14,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    textAlign: 'center',
  },
  offeringsLoader: { marginVertical: 12 },
  offeringsKeyBox: {
    backgroundColor: 'rgba(15, 23, 42, 0.78)',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 18,
  },
  offeringsKeyValue: {
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  offeringsCopyButton: {
    backgroundColor: '#10b981',
    borderRadius: 18,
    paddingVertical: 16,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  offeringsCopyButtonText: {
    color: '#022C22',
    fontSize: 16,
    fontWeight: '800',
  },
  offeringsHelpText: {
    color: '#CBD5E1',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  offeringsSuccessText: {
    color: '#86EFAC',
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  offeringsErrorText: {
    color: '#FCA5A5',
    fontSize: 15,
    textAlign: 'center',
  },
  offeringsSecondaryButton: {
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#10b981',
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
  },
  offeringsSecondaryButtonText: {
    color: '#D1FAE5',
    fontSize: 15,
    fontWeight: '700',
  },
  checkinTitleField: {
    width: '100%',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#67e8f9',
    backgroundColor: 'rgba(6, 182, 212, 0.25)',
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 14,
    alignItems: 'center',
  },
  checkinTitleValue: {
    color: '#F8FAFC',
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
  },
  checkinEtiquetaField: {
    width: '100%',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#FBBF24',
    backgroundColor: 'rgba(251, 191, 36, 0.15)',
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 12,
    alignItems: 'center',
  },
  checkinEtiquetaLabel: {
    color: '#FDE68A',
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  checkinEtiquetaValue: {
    color: '#FFFBEB',
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 1,
    textAlign: 'center',
  },
  qrCardHint: {
    color: '#94A3B8',
    fontSize: 12,
    lineHeight: 17,
    textAlign: 'center',
    marginBottom: 12,
    paddingHorizontal: 8,
  },
  qrBackground: { backgroundColor: '#FFF', padding: 20, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  checkinRoomRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginTop: 14,
  },
  checkinRoomBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 999,
    borderWidth: 1,
    paddingVertical: 7,
    paddingHorizontal: 12,
  },
  checkinRoomBadgeKids: {
    backgroundColor: 'rgba(250, 204, 21, 0.12)',
    borderColor: 'rgba(250, 204, 21, 0.35)',
  },
  checkinRoomBadgeTeens: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderColor: 'rgba(239, 68, 68, 0.35)',
  },
  checkinRoomBadgeText: {
    color: '#E2E8F0',
    fontSize: 12,
    fontWeight: '700',
  },
  placeholderText: { color: '#94A3B8', fontSize: 16, textAlign: 'center' },
  footerControls: { flexShrink: 0, paddingHorizontal: 32, marginTop: 6 },
  monitorReadOnlyCheckMark: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
    flexShrink: 0,
  },
  monitorReadOnlyCheckSlot: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  footerNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
  },
  footerNavMainGroup: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minWidth: 0,
  },
  footerNavButton: {
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  footerNavButtonSquare: {
    width: 48,
    height: 48,
    flexGrow: 0,
    flexShrink: 0,
    paddingVertical: 0,
  },
  footerNavExitCompact: {
    flex: 1,
    minWidth: 0,
    height: 48,
    paddingVertical: 0,
    paddingHorizontal: 8,
  },
  footerSettingsButton: {
    backgroundColor: 'rgba(148, 163, 184, 0.12)',
    borderColor: '#475569',
  },
  footerSettingsButtonPressed: {
    backgroundColor: 'rgba(239, 68, 68, 0.28)',
    borderColor: '#EF4444',
  },
  footerNavButtonDisabled: {
    opacity: 0.4,
  },
  footerSideButton: {
    backgroundColor: 'rgba(16, 185, 129, 0.16)',
    borderColor: '#10b981',
  },
  footerNavSideButtonHidden: {
    opacity: 0,
  },
  footerSideButtonText: {
    color: '#D1FAE5',
    fontWeight: '700',
    fontSize: 24,
    lineHeight: 24,
  },
  footerExitButton: {
    backgroundColor: 'rgba(245, 158, 11, 0.22)',
    borderColor: '#FBBF24',
  },
  footerExitButtonText: {
    color: '#FBBF24',
    fontWeight: '700',
    fontSize: 14,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
});