import { useRoomDisplayLabels } from '@/hooks/useRoomDisplayLabels';
import { CheckinModal } from '@/components/CheckinModal';
import { AdministrativoCard } from '@/components/AdministrativoCard';
import { SmallGroupCard } from '@/components/SmallGroupCard';
import { CampaignCard } from '@/components/CampaignCard';
import { OpportunityMuralCard } from '@/components/OpportunityMuralCard';
import { ScalesClassPanel } from '@/components/ScalesClassPanel';
import { ParkingVehicleIdentifyPanel } from '@/components/ParkingVehicleIdentifyPanel';
import { FamilyEventSelector } from '@/components/FamilyEventSelector';
import { FamilyRegistrationList } from '@/components/FamilyRegistrationList';
import { resolveEventEnabledRoomKeys } from '@/lib/maintenanceEventForm';
import { MinisterialProfileForm } from '@/components/MinisterialProfileForm';
import { OfferingsClass } from '@/components/OfferingsClass';
import { PerfilClassPanel } from '@/components/PerfilClassPanel';
import { ActiveScreenBadge } from '@/components/ui/ActiveScreenBadge';
import { usePalette } from '@/context/PaletteContext';
import { CardLoadingState } from '@/components/ui/CardLoadingState';
import { CarouselFooterNav } from '@/components/ui/CarouselFooterNav';
import { DropdownSelect } from '@/components/ui/DropdownSelect';
import { useDashboardSelectedEvent, useEventRegistrationsByStatus, useRoomServidorScales } from '@/hooks';
import { useFamilyPreCheckin } from '@/hooks/useFamilyPreCheckin';
import { useGeoCheckinMonitor } from '@/hooks/useGeoCheckinMonitor';
import { useEventGeofenceCoordinates } from '@/hooks/useEventGeofenceCoordinates';
import { useFamilyReceptionSuperAdminNotifier } from '@/hooks/useFamilyReceptionSuperAdminNotifier';
import { useShowAclTechnicalKeys } from '@/hooks/useShowAclTechnicalKeys';
import { getAppParameterValue , isLgpdAtivoEnabled, isProfileLgpdPending } from '@/lib/appParameters';
import {
  loadOfferingsRecipientBundle,
  type OfferingsRecipientRow,
} from '@/lib/offeringsRecipientInfo';
import {
  APP_PARAMETER,
  eventRequiresQrCheckIn,
  isAppParameterNo,
  isEventCalendarToday,
  resolveQrCheckInCardVisible,
} from '@/lib/checkInVisibility';
import { formatEventDateTimeLabel } from '@/lib/eventDate';
import {
  formatGeofenceHoursBeforeLabel,
  formatGeofenceWindowStartLabel,
  parseGeofenceHoursBeforeParameter,
} from '@/lib/geoCheckinWindow';
import { parseGeofenceRadiusMeters } from '@/lib/checkinGeofence';
import { formatRoomServidorNames } from '@/lib/roomServidorScales';
import { resolveFamilyIdForPhone, normalizeFamilyCode } from '@/lib/family';
import { withActiveMembershipProfileFilter } from '@/lib/activeMemberProfile';
import { fetchProfileHasActiveMembership } from '@/lib/profileMembershipStatus';
import { formatFullName } from '@/lib/fullName';
import {
  fetchFamilyMembersForDirectoryEntry,
  fetchMembersDirectoryFromProfiles,
  fetchVisitorsDirectoryFromProfiles,
} from '@/lib/membersListApi';
import { prefetchProfilesMapMarkers } from '@/lib/syncProfilesMapMarkers';
import { loadEffectiveSessionProfile, getEffectiveUserPhone } from '@/lib/loadSessionProfile';
import { isGhostModeActive } from '@/lib/ghostMode';

import { lookupVehicleByPlaca, type VehicleLookupResult } from '@/lib/profileVehicleLookup';
import { fetchVolunteersForScaleType } from '@/lib/maintenanceScaleVolunteersApi';
import { supabase } from '@/lib/supabase';
import { FontAwesome, MaterialIcons } from '@expo/vector-icons';
import {
  ACCESS_SCREEN,
  ACL_UNAVAILABLE_MESSAGE,
  checkOperatorIsSuperAdmin,
  DASHBOARD_CARD_CONTENT_TO_ACCESS_KEY,
  getAccessControlRpcStatus,
  isDashboardCardContentAllowed,
  loadDashboardCardViewAccess,
  profileHasAccess,
  type DashboardCardViewAccess,
} from '@/lib/accessControl';
import { checkSessionIsSuperAdmin } from '@/lib/maintenanceAccessControlApi';
import { useGhostMode } from '@/context/GhostModeContext';
import { MAP_PIN_DETAIL_DENIED_MESSAGE } from '@/hooks/useMapPinDetailAccess';
import { resolveEffectiveProfileId } from '@/lib/sessionProfile';
import {
  getStoredUserPhone,
  persistProfileId,
  repairUserSessionReference,
  signOutAndNavigateToLogin,
} from '@/lib/userSession';
import { normalizePhoneForWhatsApp, openMemberWhatsapp } from '@/lib/whatsapp';
import { DASHBOARD_CARD_BLOCKED_MESSAGES } from '@/lib/dashboardCardScreenLinks';
import {
  getDashboardLinkedScreenKeys,
  isDashboardCardFullyAllowed,
  loadDashboardLinkedScreenAccess,
  type DashboardScreenAccess,
} from '@/lib/dashboardScreenAccess';
import {
  loadGroupedManageScreenAccess,
  type GroupedManageScreenAccess,
} from '@/lib/groupedManageAccess';
import {
  DASHBOARD_SCREEN_DENIED_MESSAGES,
  navigateWithScreenAccess,
} from '@/lib/dashboardScreenNavigation';
import { resolveDashboardCardAccessResourceKey } from '@/lib/screenAccessResourceKeys';
import { recordProfileScreenVisit } from '@/lib/profileScreenVisitTracking';
import {
  fetchPermittedScaleTypes,
  SCALE_PERMITTED_RPC_MISSING,
} from '@/lib/scaleAccess';
import { derivePermittedScaleTypesFromSchedule } from '@/lib/scaleVolunteerProfileMatch';
import {
  buildDashboardDeepLinkKey,
  computeDashboardPanelInnerPadding,
  computeEventPanelCardHeight,
  computePanelCardTopPadding,
  DASHBOARD_PANEL_TITLE_TYPO,
  resolveCarouselIndexByContent,
  resolveDashboardCardIndex,
} from '@/lib/dashboardPanelLayout';
import { BIRTHDAYS_UI, DASHBOARD_CARD_THEMES, VIGILANCE_SCALES_UI } from '@/lib/dashboardCardThemes';
import { DASHBOARD_CARD_BOX_SHADOW, DASHBOARD_CARD_REFERENCE_THEME, DASHBOARD_CARD_SHELL, DASHBOARD_CARD_TYPO } from '@/lib/dashboardCardStyles';
import { boxShadowStyle } from '@/lib/boxShadow';
import { buildDashboardScreenGradient, buildPaletteSurfaceTheme } from '@/lib/paletteTheme';
import { withReturnDashboardCard, pickRouteParam, isMinimalPresentationRoute } from '@/lib/dashboardReturnNavigation';
import {
  buildFamilyAgendaHomeHref,
  isFamilyAgendaDashboardCardParam,
} from '@/lib/familyAgendaNavigation';
import { MinimalRouteShell } from '@/components/minimal/MinimalRouteShell';
import { MINIMAL_SECTION_TITLE } from '@/lib/minimalUiTheme';
import { CONTAIN_WIDTH, MINIMAL_FLAT_PANEL, MINIMAL_DASHBOARD_STYLES, MINIMAL_PAGE } from '@/lib/minimalPresentation';
import { computeResponsiveCardInsets } from '@/lib/uiTokens';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Linking from 'expo-linking';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  FlatList,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import Toast from 'react-native-toast-message';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const STATIC_CARD_INSETS = computeResponsiveCardInsets(390);

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
    | 'grouped_manage'
    | 'administrativo'
    | 'small_group'
    | 'campaign_card'
    | 'opportunity_mural_card';
};

/** Cards minimalistas que renderizam o título principal no corpo da tela. */
const MINIMAL_BODY_TITLE_CARD_CONTENTS = new Set<DashboardCard['content']>([
  'vigilance_scales',
  'scale_roster',
  'parking_vehicle_v2',
  'members_list',
  'birthdays',
  'financial',
  'grouped_manage',
  'small_group',
]);

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
  cep: string | null;
  address_street: string | null;
  address_number: string | null;
  address_neighborhood: string | null;
  address_city: string | null;
  address_state: string | null;
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

const normalizeParameterValue = (value: string | null | undefined) =>
  (value ?? '')
    .trim()
    .toLocaleLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

const cleanPhoneDigits = (value: string | null | undefined) => (value ?? '').replace(/\D/g, '');

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
  const { colors: paletteColors } = usePalette();
  const mainScreenGradient = useMemo(
    () => buildDashboardScreenGradient(paletteColors),
    [paletteColors]
  );
  const groupedManagePaletteStyle = useMemo(() => {
    const theme = buildPaletteSurfaceTheme(paletteColors);

    return {
      backgroundColor: theme.backgroundColor,
      borderColor: theme.borderColor,
      ...DASHBOARD_CARD_BOX_SHADOW,
    };
  }, [paletteColors]);
  const {
    kidsRoomLabel,
    teensRoomLabel,
    kidsRoomBadgeLabel,
    teensRoomBadgeLabel,
  } = useRoomDisplayLabels();
  const { isActive: ghostModeActive, state: ghostModeState } = useGhostMode();
  const { width: pageWidth, height: windowHeight } = useWindowDimensions();
  const [measuredListWidth, setMeasuredListWidth] = useState(0);
  const previousPageWidthRef = useRef(pageWidth);
  const carouselPageStyle = useMemo(() => ({ width: pageWidth }), [pageWidth]);
  const dashboardCardWidth = useMemo(() => pageWidth * 0.9, [pageWidth]);
  const dashboardCardHorizontalInset = useMemo(() => pageWidth * 0.05, [pageWidth]);

  const dashboardListRef = useRef<FlatList<DashboardCard>>(null);
  const handledDashboardCardRef = useRef<string | null>(null);
  const previousDashboardCardIndexRef = useRef(0);
  const footerNavRepeatIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const footerNavRepeatActiveRef = useRef(false);
  const currentIndexRef = useRef(0);
  const scrollToParkingCardRef = useRef(false);
  const scrollToScaleRosterRef = useRef(false);
  const scrollToScalesCardRef = useRef(false);
  const activeDashboardContentRef = useRef<DashboardCard['content'] | null>(null);
  const previousDashboardDataLengthRef = useRef(0);
  const [profile, setProfile] = useState<DashboardProfile | null>(null);
  const [hasActiveMembership, setHasActiveMembership] = useState(false);
  const [lgpdAtivo, setLgpdAtivo] = useState(true);
  const [userPhone, setUserPhone] = useState<string | null>(null);
  const [isProfileLoading, setIsProfileLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isDashboardCarouselReady, setIsDashboardCarouselReady] = useState(false);
  const [isSalaRegistrationsEnabled, setIsSalaRegistrationsEnabled] = useState(false);
  const birthdaysLoadedRef = useRef(false);
  const membersListLoadedRef = useRef(false);
  const membersMapPrefetchStartedRef = useRef(false);
  const vigilanceScalesLoadedRef = useRef(false);
  const [isFooterSettingsPressed, setIsFooterSettingsPressed] = useState(false);
  const [ministerialFormVisible, setMinisterialFormVisible] = useState(false);
  const [canViewMaintenance, setCanViewMaintenance] = useState(false);
  const [canMonitorFamilyReception, setCanMonitorFamilyReception] = useState(false);
  const [isMaintenanceAccessLoading, setIsMaintenanceAccessLoading] = useState(true);
  const [dashboardCardAccess, setDashboardCardAccess] = useState<DashboardCardViewAccess>({});
  const [dashboardScreenAccess, setDashboardScreenAccess] = useState<DashboardScreenAccess>({});
  const [, setGroupedManageScreenAccess] =
    useState<GroupedManageScreenAccess>({
      manageProfile: false,
      manageMembers: false,
    });
  const [canAccessMapGeolocation, setCanAccessMapGeolocation] = useState(false);
  const [canViewMapPinDetails, setCanViewMapPinDetails] = useState(false);
  const [aclRpcStatus, setAclRpcStatus] = useState<'unknown' | 'available' | 'missing'>('unknown');
  const [modalVisible, setModalVisible] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [familyId, setFamilyId] = useState<string | null>(null);
  const [pixKey, setPixKey] = useState<string | null>(null);
  const [offeringsRecipientRows, setOfferingsRecipientRows] = useState<OfferingsRecipientRow[]>([]);
  const [isPixKeyLoading, setIsPixKeyLoading] = useState(true);
  const [qrCodeAtivoEnabled, setQrCodeAtivoEnabled] = useState(true);
  const [checkInManualMode, setCheckInManualMode] = useState(false);
  const [geoCheckinTempoValue, setGeoCheckinTempoValue] = useState<string | null>(null);
  const [geoCheckinRaioValue, setGeoCheckinRaioValue] = useState<string | null>(null);
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
  const birthdaysLoadGenRef = useRef(0);
  const membersListLoadGenRef = useRef(0);
  const visitorsListLoadGenRef = useRef(0);
  const vigilanceLoadGenRef = useRef(0);
  const [familyModalSeedEntry, setFamilyModalSeedEntry] = useState<MemberListEntry | null>(null);
  const [familyModalFamilyId, setFamilyModalFamilyId] = useState<string | null>(null);
  const [familyModalMembers, setFamilyModalMembers] = useState<MemberListEntry[]>([]);
  const [familyModalError, setFamilyModalError] = useState<string | null>(null);
  const [isFamilyModalLoading, setIsFamilyModalLoading] = useState(false);
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
    () => computeEventPanelCardHeight(windowHeight, insets.top, insets.bottom),
    [insets.bottom, insets.top, windowHeight]
  );
  const dashboardPanelCardSizeStyle = useMemo(
    () => ({
      width: dashboardCardWidth,
      minHeight: dashboardPanelCardHeight,
      maxHeight: dashboardPanelCardHeight,
      alignSelf: 'center' as const,
    }),
    [dashboardCardWidth, dashboardPanelCardHeight]
  );
  const dashboardCardWrapperStyle = useMemo(
    () => ({
      ...styles.cardWrapper,
      paddingTop: computePanelCardTopPadding(
        windowHeight,
        insets.top,
        insets.bottom,
        dashboardPanelCardHeight
      ),
    }),
    [dashboardPanelCardHeight, insets.bottom, insets.top, windowHeight]
  );

  const dashboardPanelInnerPadding = useMemo(
    () => computeDashboardPanelInnerPadding(pageWidth),
    [pageWidth]
  );

  const dashboardPanelTopInsetStyle = useMemo(
    () => ({ paddingTop: dashboardPanelInnerPadding }),
    [dashboardPanelInnerPadding]
  );
  const params = useLocalSearchParams();
  const router = useRouter();
  const isMinimalPresentation = isMinimalPresentationRoute(params.presentation);

  const carouselLayoutWidth = useMemo(() => {
    if (isMinimalPresentation && measuredListWidth > 0) {
      return measuredListWidth;
    }
    return pageWidth;
  }, [isMinimalPresentation, measuredListWidth, pageWidth]);

  const handleMinimalListLayout = useCallback(
    (event: { nativeEvent: { layout: { width: number } } }) => {
      if (!isMinimalPresentation) {
        return;
      }

      const nextWidth = Math.round(event.nativeEvent.layout.width);
      if (nextWidth > 0 && nextWidth !== measuredListWidth) {
        setMeasuredListWidth(nextWidth);
      }
    },
    [isMinimalPresentation, measuredListWidth]
  );

  const effectiveCarouselPageStyle = useMemo(
    () =>
      isMinimalPresentation
        ? {
            width: carouselLayoutWidth,
            maxWidth: carouselLayoutWidth,
            flex: 1,
            alignSelf: 'stretch' as const,
          }
        : carouselPageStyle,
    [carouselLayoutWidth, carouselPageStyle, isMinimalPresentation]
  );

  const effectiveDashboardCardWrapperStyle = useMemo(
    () =>
      isMinimalPresentation
        ? { ...MINIMAL_PAGE, paddingTop: 0, paddingBottom: 0 }
        : dashboardCardWrapperStyle,
    [dashboardCardWrapperStyle, isMinimalPresentation]
  );

  const effectiveDashboardPanelCardSizeStyle = useMemo(
    () =>
      isMinimalPresentation
        ? { width: '100%' as const, flex: 1, alignSelf: 'stretch' as const }
        : dashboardPanelCardSizeStyle,
    [dashboardPanelCardSizeStyle, isMinimalPresentation]
  );

  const cardBaseStyle = isMinimalPresentation ? MINIMAL_FLAT_PANEL : styles.card;
  const skipLegacyCard = !isMinimalPresentation;
  const mds = isMinimalPresentation ? MINIMAL_DASHBOARD_STYLES : null;

  useFamilyReceptionSuperAdminNotifier(canMonitorFamilyReception);
  const requestedDashboardCard = Array.isArray(params.dashboardCard)
    ? params.dashboardCard[0]
    : params.dashboardCard;
  const requestedDashboardCardNonce = Array.isArray(params.dashboardCardNonce)
    ? params.dashboardCardNonce[0]
    : params.dashboardCardNonce;

  useEffect(() => {
    if (!isFamilyAgendaDashboardCardParam(
      typeof requestedDashboardCard === 'string' ? requestedDashboardCard : null
    )) {
      return;
    }

    router.replace(buildFamilyAgendaHomeHref());
  }, [requestedDashboardCard, router]);
  const administrativoInitialTab =
    pickRouteParam(params.administrativoTab) === 'outros' ? 'outros' : undefined;
  const dashboardDeepLinkKey = buildDashboardDeepLinkKey(
    requestedDashboardCard,
    requestedDashboardCardNonce
  );
  const isDashboardDeepLinkPending =
    Boolean(requestedDashboardCard)
    && Boolean(dashboardDeepLinkKey)
    && handledDashboardCardRef.current !== dashboardDeepLinkKey;

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
  const {
    kidsServidorNames,
    teensServidorNames,
    loading: loadingRoomServidores,
  } = useRoomServidorScales(selectedEvent?.event_date, {
    enabled: isSalaRegistrationsEnabled,
    profileFullName: profile?.full_name,
    profileId: profile?.id,
  });
  const phone = params.phone ? decodeURIComponent(params.phone as string) : null;
  const loadPixKey = useCallback(async () => {
    setIsPixKeyLoading(true);

    try {
      const bundle = await loadOfferingsRecipientBundle();
      setOfferingsRecipientRows(bundle.recipientRows);
      setPixKey(bundle.pixKey);
    } catch (error) {
      console.error('Erro ao carregar dados de dízimos/ofertas:', error);
      setOfferingsRecipientRows([]);
      setPixKey(null);
    } finally {
      setIsPixKeyLoading(false);
    }
  }, []);
  const loadCheckInCardParameters = useCallback(async () => {
    try {
      const [qrCodeValue, checkInAutomaticoValue, geoCheckinTempo, geoCheckinRaio] =
        await Promise.all([
        getAppParameterValue(APP_PARAMETER.QR_CODE_ATIVO),
        getAppParameterValue(APP_PARAMETER.CHECK_IN_AUTOMATICO),
        getAppParameterValue(APP_PARAMETER.CHECK_IN_GEOFENCE_TEMPO),
        getAppParameterValue(APP_PARAMETER.CHECK_IN_GEOFENCE_RAIO_METROS),
      ]);
      setQrCodeAtivoEnabled(!isAppParameterNo(qrCodeValue));
      setCheckInManualMode(isAppParameterNo(checkInAutomaticoValue));
      setGeoCheckinTempoValue(geoCheckinTempo?.trim() || null);
      setGeoCheckinRaioValue(geoCheckinRaio?.trim() || null);
    } catch (error) {
      console.error('Erro ao carregar parâmetros de check-in:', error);
      setQrCodeAtivoEnabled(true);
      setCheckInManualMode(false);
      setGeoCheckinTempoValue(null);
      setGeoCheckinRaioValue(null);
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

  const isSelectedEventToday = useMemo(
    () => isEventCalendarToday(selectedEvent?.event_date),
    [selectedEvent?.event_date]
  );

  const geoCheckinHoursBefore = useMemo(
    () => parseGeofenceHoursBeforeParameter(geoCheckinTempoValue),
    [geoCheckinTempoValue]
  );

  const geoCheckinRadiusMeters = useMemo(
    () => parseGeofenceRadiusMeters(geoCheckinRaioValue),
    [geoCheckinRaioValue]
  );

  const geoCheckinAtivoEnabled = selectedEvent?.geofence_ativo === true;

  const geoCheckinWindowStartLabel = useMemo(
    () => formatGeofenceWindowStartLabel(selectedEvent?.event_date, geoCheckinHoursBefore),
    [geoCheckinHoursBefore, selectedEvent?.event_date]
  );

  const {
    hasPreCheckin,
    hasTotemCheckinConfirmed,
    gateRequired: preCheckinGateRequired,
    gateError: preCheckinGateError,
    refetch: refetchPreCheckin,
  } = useFamilyPreCheckin(selectedEvent?.id, familyId ?? undefined, selectedEvent);

  const focusEventAudienceCard = useCallback(() => {
    router.replace(buildFamilyAgendaHomeHref());
  }, [router]);

  const {
    coordinates: eventGeofenceCoordinates,
    loading: eventGeofenceLoading,
    error: eventGeofenceError,
  } = useEventGeofenceCoordinates(
    selectedEvent?.event_local,
    geoCheckinAtivoEnabled && Boolean(selectedEvent?.event_local?.trim())
  );

  const eventRegistrationChangeRef = useRef<(() => Promise<void>) | null>(null);

  const handleGeoCheckinConfirmed = useCallback(async () => {
    await eventRegistrationChangeRef.current?.();
  }, []);

  const geoCheckinEvent = useMemo(
    () =>
      selectedEvent
        ? {
            id: selectedEvent.id,
            event_date: selectedEvent.event_date,
            latitude: eventGeofenceCoordinates?.latitude ?? null,
            longitude: eventGeofenceCoordinates?.longitude ?? null,
          }
        : null,
    [
      eventGeofenceCoordinates?.latitude,
      eventGeofenceCoordinates?.longitude,
      selectedEvent,
    ]
  );

  const familyRegistrationSessionProfile = useMemo(
    () =>
      profile?.id
        ? {
            id: profile.id,
            full_name: profile.full_name ?? null,
            phone: profile.phone ?? userPhone,
            birth_date: profile.birth_date ?? null,
            family_id: familyId ?? profile.codigo_membro ?? null,
          }
        : null,
    [
      familyId,
      profile?.birth_date,
      profile?.codigo_membro,
      profile?.full_name,
      profile?.id,
      profile?.phone,
      userPhone,
    ]
  );

  const {
    status: geoCheckinStatus,
    gpsProgress: geoCheckinGpsProgress,
    lastCoordinates: geoDeviceCoordinates,
    lastDistanceMeters: geoCheckinDistanceMeters,
    inGeofenceWindow,
    errorMessage: geoCheckinErrorMessage,
  } = useGeoCheckinMonitor({
    enabled: geoCheckinAtivoEnabled,
    geofenceHoursBefore: geoCheckinHoursBefore,
    geofenceRadiusMeters: geoCheckinRadiusMeters,
    event: geoCheckinEvent,
    familyId: familyId ?? undefined,
    hasFamilyPreCheckin: hasPreCheckin,
    hasFamilyGeoCheckinConfirmed: hasTotemCheckinConfirmed,
    onRequiresPrecheckin: focusEventAudienceCard,
    onConfirmed: handleGeoCheckinConfirmed,
  });

  const skipGeofenceOnAudienceSave = hasPreCheckin || hasTotemCheckinConfirmed;

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
    return () => {
      birthdaysLoadGenRef.current += 1;
      membersListLoadGenRef.current += 1;
      visitorsListLoadGenRef.current += 1;
      vigilanceLoadGenRef.current += 1;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      setIsProfileLoading(true);
      setIsMaintenanceAccessLoading(true);

      try {
        let targetPhone = phone;
        if (!targetPhone) {
          targetPhone = isGhostModeActive()
            ? await getEffectiveUserPhone()
            : await getStoredUserPhone();
        } else if (!isGhostModeActive()) {
          await AsyncStorage.setItem('user_phone', targetPhone);
        }
        if (cancelled) {
          return;
        }
        if (!targetPhone && !isGhostModeActive()) {
          setCanViewMaintenance(false);
          setCanMonitorFamilyReception(false);
          setDashboardCardAccess({});
          setDashboardScreenAccess({});
          setGroupedManageScreenAccess({ manageProfile: false, manageMembers: false });
          setCanAccessMapGeolocation(false);
          setCanViewMapPinDetails(false);
          return;
        }

        let sessionProfile = await loadEffectiveSessionProfile(targetPhone);

        if (!sessionProfile?.id && !isGhostModeActive()) {
          await repairUserSessionReference(targetPhone);
          sessionProfile = await loadEffectiveSessionProfile(targetPhone);
        }

        if (cancelled) {
          return;
        }

        // No Modo Ghost, telefone/família vêm só do alvo — nunca do operador real.
        const effectivePhone =
          sessionProfile?.phone?.trim()
          || (isGhostModeActive() ? null : targetPhone?.trim() || null);
        setUserPhone(effectivePhone);

        const resolvedFamilyId =
          sessionProfile?.family_id
          ?? sessionProfile?.codigo_membro
          ?? (effectivePhone ? await resolveFamilyIdForPhone(effectivePhone) : null);

        if (cancelled) {
          return;
        }

        setFamilyId(resolvedFamilyId);

        if (!sessionProfile) {
          setProfile(null);
          setCurrentUserId(null);
          setCanViewMaintenance(false);
          setCanMonitorFamilyReception(false);
          setDashboardCardAccess({});
          setDashboardScreenAccess({});
          setGroupedManageScreenAccess({ manageProfile: false, manageMembers: false });
          setCanAccessMapGeolocation(false);
          setCanViewMapPinDetails(false);
          signOutAndNavigateToLogin();
          return;
        }

        const loadedProfile: DashboardProfile = {
          id: sessionProfile.id,
          full_name: sessionProfile.full_name ?? undefined,
          codigo_membro: sessionProfile.codigo_membro ?? sessionProfile.family_id ?? resolvedFamilyId ?? undefined,
          lgpd_accepted: sessionProfile.lgpd_accepted,
          birth_date: sessionProfile.birth_date ?? null,
          phone: sessionProfile.phone ?? effectivePhone,
        };

        setProfile(loadedProfile);
        setCurrentUserId(loadedProfile.id ?? null);

        if (loadedProfile.id && !isGhostModeActive()) {
          await persistProfileId(loadedProfile.id);
          if (cancelled) {
            return;
          }
        } else if (!loadedProfile.id) {
          setCanViewMaintenance(false);
          setCanMonitorFamilyReception(false);
          setDashboardCardAccess({});
          setGroupedManageScreenAccess({ manageProfile: false, manageMembers: false });
          setCanAccessMapGeolocation(false);
          setCanViewMapPinDetails(false);
        }

        const aclStatus = await getAccessControlRpcStatus();
        if (cancelled) {
          return;
        }
        setAclRpcStatus(aclStatus);

        if (loadedProfile?.id) {
          const accessProfileId = (await resolveEffectiveProfileId()) ?? loadedProfile.id;
          if (cancelled) {
            return;
          }
          const [allowed, cardAccess, screenAccess, groupedManageAccess, mapGeolocationAllowed, mapPinDetailAllowed, isSuperAdmin, canAccessProfileCadastro, activeMembership] =
            await Promise.all([
              profileHasAccess(accessProfileId, 'screen', ACCESS_SCREEN.maintenance, 'view'),
              loadDashboardCardViewAccess(accessProfileId, { forceRefresh: ghostModeActive }),
              loadDashboardLinkedScreenAccess(accessProfileId, { forceRefresh: ghostModeActive }),
              loadGroupedManageScreenAccess(accessProfileId, { forceRefresh: ghostModeActive }),
              profileHasAccess(accessProfileId, 'screen', ACCESS_SCREEN.mapGeolocation, 'view'),
              profileHasAccess(accessProfileId, 'screen', ACCESS_SCREEN.mapGeolocationPinDetail, 'view'),
              checkSessionIsSuperAdmin({ forceRefresh: ghostModeActive }),
              profileHasAccess(
                accessProfileId,
                'screen',
                'maintenance.card.profile_cadastro',
                'view'
              ),
              fetchProfileHasActiveMembership(accessProfileId),
            ]);

          if (cancelled) {
            return;
          }

          let resolvedCardAccess = cardAccess;
          let resolvedScreenAccess = screenAccess;
          let resolvedGroupedManageAccess = groupedManageAccess;
          const hasAnyCard = Object.values(cardAccess).some((allowedCard) => allowedCard === true);
          // No Ghost os cards/ACL são só do alvo — o Super Admin operador não amplia a visão.
          const operatorIsSuperAdmin =
            !isGhostModeActive()
            && (await checkOperatorIsSuperAdmin({ forceRefresh: ghostModeActive }));

          if (cancelled) {
            return;
          }

          if (!hasAnyCard && operatorIsSuperAdmin) {
            resolvedCardAccess = Object.fromEntries(
              Object.keys(DASHBOARD_CARD_CONTENT_TO_ACCESS_KEY).map((content) => [content, true] as const)
            );
            resolvedScreenAccess = Object.fromEntries(
              getDashboardLinkedScreenKeys().map((resourceKey) => [resourceKey, true] as const)
            );
            resolvedGroupedManageAccess = { manageProfile: true, manageMembers: true };
          }

          setCanViewMaintenance(allowed || operatorIsSuperAdmin);
          setCanMonitorFamilyReception(isSuperAdmin || canAccessProfileCadastro || operatorIsSuperAdmin);
          setDashboardCardAccess(resolvedCardAccess);
          setDashboardScreenAccess(resolvedScreenAccess);
          setGroupedManageScreenAccess(resolvedGroupedManageAccess);
          setCanAccessMapGeolocation(mapGeolocationAllowed || operatorIsSuperAdmin);
          setCanViewMapPinDetails(mapPinDetailAllowed || operatorIsSuperAdmin);
          setHasActiveMembership(activeMembership);
        } else {
          setHasActiveMembership(false);
        }
      } catch (error) {
        if (cancelled) {
          return;
        }
        console.error('Erro ao carregar dashboard:', error);
        setCanViewMaintenance(false);
        setCanMonitorFamilyReception(false);
        setDashboardCardAccess({});
        setDashboardScreenAccess({});
        setGroupedManageScreenAccess({ manageProfile: false, manageMembers: false });
        setCanAccessMapGeolocation(false);
        setCanViewMapPinDetails(false);
        setHasActiveMembership(false);
      } finally {
        if (!cancelled) {
          setIsMaintenanceAccessLoading(false);
          setIsProfileLoading(false);
        }
      }
    }
    void loadData();
    return () => {
      cancelled = true;
    };
  }, [phone, ghostModeActive, ghostModeState?.targetProfileId]);

  useFocusEffect(
    useCallback(() => {
      let active = true;

      void (async () => {
        const [storedPhone, lgpdModuleActive] = await Promise.all([
          phone ? Promise.resolve(phone) : getEffectiveUserPhone(),
          isLgpdAtivoEnabled(),
        ]);

        if (!active) {
          return;
        }

        setLgpdAtivo(lgpdModuleActive);

        const sessionProfile = await loadEffectiveSessionProfile(storedPhone);

        if (!active || !sessionProfile?.id) {
          return;
        }

        const effectivePhone =
          sessionProfile.phone?.trim()
          || (isGhostModeActive() ? null : storedPhone?.trim() || null);

        const refreshedProfile: DashboardProfile = {
          id: sessionProfile.id,
          full_name: sessionProfile.full_name ?? undefined,
          codigo_membro: sessionProfile.codigo_membro ?? sessionProfile.family_id ?? familyId ?? undefined,
          lgpd_accepted: sessionProfile.lgpd_accepted,
          birth_date: sessionProfile.birth_date ?? null,
          phone: sessionProfile.phone ?? effectivePhone,
        };

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
    const loadId = ++birthdaysLoadGenRef.current;
    setIsBirthdaysLoading(true);
    setBirthdaysError(null);

    try {
      const { data, error } = await withActiveMembershipProfileFilter(
        supabase.from('profiles').select('full_name, birth_date, phone')
      )
        .not('birth_date', 'is', null)
        .order('full_name', { ascending: true });

      if (error) {
        throw error;
      }

      const parsedEntries = (data ?? [])
        .map((entry) => {
          const parts = parseBirthdayParts(entry.birth_date);
          const fullName = formatFullName(entry.full_name);

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

      if (loadId !== birthdaysLoadGenRef.current) {
        return;
      }

      setBirthdayEntries(parsedEntries);
    } catch (error) {
      if (loadId !== birthdaysLoadGenRef.current) {
        return;
      }
      console.error('Erro ao carregar aniversariantes:', error);
      setBirthdayEntries([]);
      setBirthdaysError('Nao foi possivel carregar os aniversariantes.');
    } finally {
      if (loadId === birthdaysLoadGenRef.current) {
        setIsBirthdaysLoading(false);
      }
    }
  }, []);

  const loadMembersList = useCallback(async () => {
    const loadId = ++membersListLoadGenRef.current;
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
        cep: entry.cep,
        address_street: entry.address_street,
        address_number: entry.address_number,
        address_neighborhood: entry.address_neighborhood,
        address_city: entry.address_city,
        address_state: entry.address_state,
      })) satisfies MemberListEntry[];

      if (loadId !== membersListLoadGenRef.current) {
        return;
      }

      setMemberListEntries(dedupeMemberListEntries(parsedEntries));
    } catch (error) {
      if (loadId !== membersListLoadGenRef.current) {
        return;
      }
      console.error('Erro ao carregar lista de membros:', error);
      setMemberListEntries([]);
      setMembersListError(
        error instanceof Error
          ? error.message
          : 'Nao foi possivel carregar a lista de membros.'
      );
    } finally {
      if (loadId === membersListLoadGenRef.current) {
        setIsMembersListLoading(false);
      }
    }
  }, []);

  const loadVisitorsList = useCallback(async () => {
    const loadId = ++visitorsListLoadGenRef.current;
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
        cep: entry.cep,
        address_street: entry.address_street,
        address_number: entry.address_number,
        address_neighborhood: entry.address_neighborhood,
        address_city: entry.address_city,
        address_state: entry.address_state,
      })) satisfies MemberListEntry[];

      if (loadId !== visitorsListLoadGenRef.current) {
        return;
      }

      setVisitorListEntries(dedupeMemberListEntries(parsedEntries));
      visitorsListLoadedRef.current = true;
    } catch (error) {
      if (loadId !== visitorsListLoadGenRef.current) {
        return;
      }
      console.error('Erro ao carregar lista de visitantes:', error);
      setVisitorListEntries([]);
      setMembersListError(
        error instanceof Error
          ? error.message
          : 'Nao foi possivel carregar a lista de visitantes.'
      );
    } finally {
      if (loadId === visitorsListLoadGenRef.current) {
        setIsVisitorsListLoading(false);
      }
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
    const loadId = ++vigilanceLoadGenRef.current;
    const preserveSelection = options?.preserveSelection ?? false;
    setIsVigilanceScalesLoading(true);
    setVigilanceScalesError(null);

    try {
      const [{ data, error }, { data: profilesData, error: profilesError }] = await Promise.all([
        supabase.rpc('listar_escalas'),
        withActiveMembershipProfileFilter(
          supabase.from('profiles').select('full_name, phone, family_id, codigo_membro')
        ),
      ]);

      if (error) {
        throw error;
      }

      if (profilesError) {
        throw profilesError;
      }

      const profiles = (profilesData as ProfilePhoneRow[] | null) ?? [];

      let parsedTypes: ScaleTypeEntry[];

      try {
        const permittedTypes = await fetchPermittedScaleTypes('view');
        parsedTypes = permittedTypes.map((entry) => ({
          id: entry.id,
          code: entry.code,
          name: entry.name,
        }));
      } catch (scaleTypesError) {
        if (
          scaleTypesError instanceof Error
          && scaleTypesError.message === SCALE_PERMITTED_RPC_MISSING
        ) {
          const { data: typesData, error: typesError } = await supabase.rpc('listar_tipos_escala');

          if (typesError) {
            throw typesError;
          }

          parsedTypes = ((typesData as ScaleTypeRow[] | null) ?? [])
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
        } else {
          throw scaleTypesError;
        }
      }

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

      if (parsedTypes.length === 0 && profile?.full_name?.trim()) {
        parsedTypes = derivePermittedScaleTypesFromSchedule(profile.full_name, parsedEntries);
      }

      if (loadId !== vigilanceLoadGenRef.current) {
        return;
      }

      setScaleTypes(parsedTypes);
      setVigilanceScaleEntries(parsedEntries);
      if (!preserveSelection) {
        setSelectedVigilanceScale('');
        setIsParkingPanelVisible(false);
      }
    } catch (error) {
      if (loadId !== vigilanceLoadGenRef.current) {
        return;
      }
      console.error('Erro ao carregar escalas:', error);
      setScaleTypes([]);
      setVigilanceScaleEntries([]);
      if (!preserveSelection) {
        setSelectedVigilanceScale('');
        setIsParkingPanelVisible(false);
      }
      setVigilanceScalesError('Nao foi possivel carregar as escalas.');
    } finally {
      if (loadId === vigilanceLoadGenRef.current) {
        setIsVigilanceScalesLoading(false);
      }
    }
  }, [profile?.full_name]);

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

  const handleExit = () => {
    handledDashboardCardRef.current = null;
    previousDashboardDataLengthRef.current = 0;
    activeDashboardContentRef.current = null;
    router.replace('/(tabs)');
  };

  const handleCopyPixKey = async () => {
    if (!pixKey) {
      Alert.alert('Chave PIX indisponível', 'Nenhuma chave PIX foi encontrada para copiar.');
      return;
    }

    try {
      await Clipboard.setStringAsync(pixKey);
      Toast.show({
        type: 'success',
        text1: 'Chave PIX copiada',
        text2: 'Cole no aplicativo do seu banco para concluir a transferência.',
        visibilityTime: 3500,
      });
    } catch (error) {
      console.error('Erro ao copiar chave PIX:', error);
      Alert.alert('Erro ao copiar', 'Não foi possível copiar a chave PIX.');
    }
  };

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (isMinimalPresentation || carouselLayoutWidth <= 0) {
      return;
    }

    const index = Math.round(event.nativeEvent.contentOffset.x / carouselLayoutWidth);
    setCurrentIndex(index);
  };

  const kidsCheckedCount = kidsRegistrations.filter((registration) => registration.room_entry_checked).length;
  const teensCheckedCount = teensRegistrations.filter((registration) => registration.room_entry_checked).length;
  const availableGroupedRooms = useMemo(() => {
    const rooms: GroupedRoomConfig[] = [];

    if (selectedEvent?.kids_room) {
      rooms.push({
        key: 'KIDS',
        label: kidsRoomLabel,
        checkedCount: kidsCheckedCount,
        totalCount: kidsRegistrations.length,
        headerStyle: styles.groupedAudienceHeaderKids,
        dotStyle: styles.groupedAudienceDotKids,
      });
    }

    if (selectedEvent?.teens_room) {
      rooms.push({
        key: 'TEENS',
        label: teensRoomLabel,
        checkedCount: teensCheckedCount,
        totalCount: teensRegistrations.length,
        headerStyle: styles.groupedAudienceHeaderTeens,
        dotStyle: styles.groupedAudienceDotTeens,
      });
    }

    return rooms;
  }, [
    kidsCheckedCount,
    kidsRegistrations.length,
    kidsRoomLabel,
    selectedEvent?.kids_room,
    selectedEvent?.teens_room,
    teensCheckedCount,
    teensRegistrations.length,
    teensRoomLabel,
  ]);
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
  }, [availableGroupedRooms]);

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
  const nextVigilanceScaleServiceDate = vigilanceEntriesForSelectedScale[0]?.data_servico ?? null;
  const loadRegisteredScaleVolunteers = useCallback(async (scaleTypeId: string) => {
    setIsRegisteredScaleVolunteersLoading(true);
    setRegisteredScaleVolunteersError(null);

    try {
      const [volunteers, { data: profilesData, error: profilesError }] = await Promise.all([
        fetchVolunteersForScaleType(scaleTypeId),
        withActiveMembershipProfileFilter(
          supabase.from('profiles').select('full_name, phone, family_id, codigo_membro')
        ),
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
  const isLgpdPending = isProfileLgpdPending(profile?.lgpd_accepted, lgpdAtivo);
  const handleEventRegistrationChange = async () => {
    await refetchActiveEvents();
    await refetchGroupedRegistrations();
    await refetchPreCheckin();
  };
  eventRegistrationChangeRef.current = handleEventRegistrationChange;
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

  useEffect(() => {
    if (!familyModalSeedEntry) {
      setFamilyModalFamilyId(null);
      setFamilyModalMembers([]);
      setFamilyModalError(null);
      setIsFamilyModalLoading(false);
      return;
    }

    let cancelled = false;
    setFamilyModalFamilyId(normalizeFamilyCode(familyModalSeedEntry.family_id) || null);
    setFamilyModalMembers([]);
    setFamilyModalError(null);
    setIsFamilyModalLoading(true);

    void (async () => {
      try {
        const { familyId, members } = await fetchFamilyMembersForDirectoryEntry(
          familyModalSeedEntry,
          { visitorsOnly: membersListAudience === 'visitors' }
        );

        if (cancelled) {
          return;
        }

        setFamilyModalFamilyId(familyId);
        setFamilyModalMembers(members);

        if (!members.length) {
          setFamilyModalError(
            familyId
              ? `Nenhum integrante encontrado para a família ${familyId}. Verifique se scripts/members-list-family-sync.sql foi aplicado no Supabase.`
              : 'Código familiar não identificado para este integrante.'
          );
        }
      } catch (error) {
        console.error('Erro ao carregar membros da família:', error);

        if (!cancelled) {
          setFamilyModalFamilyId(normalizeFamilyCode(familyModalSeedEntry.family_id) || null);
          setFamilyModalMembers([]);
          setFamilyModalError(
            error instanceof Error
              ? error.message
              : 'Não foi possível carregar os membros da família.'
          );
        }
      } finally {
        if (!cancelled) {
          setIsFamilyModalLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [familyModalSeedEntry, membersListAudience]);

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

  const dashboardCardCandidates: DashboardCard[] = useMemo(
    () => [
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
      { id: '6', title: 'Perfil & Identidade', content: 'grouped_manage' },
      ...(hasActiveMembership
        ? [
            { id: '13', title: 'Administrativo', content: 'administrativo' as const },
            { id: '16', title: 'Pequeno Grupo', content: 'small_group' as const },
            { id: '17', title: 'Campanhas e Projetos', content: 'campaign_card' as const },
            { id: '18', title: 'Mural de Oportunidades', content: 'opportunity_mural_card' as const },
          ]
        : []),
    ],
    [
      hasActiveMembership,
      isParkingPanelVisible,
      isQrCheckInCardVisible,
      isScaleRosterVisible,
      qrCheckInCardTitle,
      selectedVigilanceScaleLabel,
    ]
  );

  const isDashboardCardAccessReady =
    Boolean(profile?.id)
    && (!isMaintenanceAccessLoading || Object.keys(dashboardCardAccess).length > 0);

  const data: DashboardCard[] = useMemo(() => {
    if (!isDashboardCardAccessReady) {
      return [];
    }

    return dashboardCardCandidates.filter((card) =>
      isDashboardCardFullyAllowed(card.content, dashboardCardAccess, dashboardScreenAccess)
    );
  }, [dashboardCardAccess, dashboardCardCandidates, dashboardScreenAccess, isDashboardCardAccessReady]);

  const carouselData = useMemo(() => {
    if (!isMinimalPresentation) {
      return data;
    }

    const targetIndex = resolveDashboardCardIndex(data, requestedDashboardCard);

    if (targetIndex >= 0) {
      return [data[targetIndex]!];
    }

    return data.length ? [data[0]!] : [];
  }, [data, isMinimalPresentation, requestedDashboardCard]);

  const activeDashboardCard = useMemo(() => {
    if (isMinimalPresentation) {
      return carouselData[0] ?? null;
    }

    return data[currentIndex] ?? null;
  }, [carouselData, currentIndex, data, isMinimalPresentation]);

  const buildChildScreenParams = useCallback(
    (extra?: Record<string, string>) => {
      const activeCard = activeDashboardCard;
      const returnDashboardCard = activeCard?.content ?? activeCard?.id;

      if (!returnDashboardCard) {
        return extra ?? {};
      }

      return withReturnDashboardCard(returnDashboardCard, extra);
    },
    [activeDashboardCard]
  );

  const isMapGeolocationEnabled = useMemo(
    () => canAccessMapGeolocation,
    [canAccessMapGeolocation]
  );

  const mapGeolocationDisabledMessage = useMemo(
    () =>
      DASHBOARD_SCREEN_DENIED_MESSAGES[ACCESS_SCREEN.mapGeolocation]
      ?? 'Você não tem permissão para abrir o mapa de geolocalização.',
    []
  );

  const handleOpenMemberOnMap = useCallback(
    (entry: MemberListEntry) => {
      if (!isMapGeolocationEnabled) {
        Toast.show({
          type: 'error',
          text1: 'Mapa indisponível',
          text2: mapGeolocationDisabledMessage,
          visibilityTime: 3500,
        });
        return;
      }

      if (!canViewMapPinDetails) {
        Toast.show({
          type: 'info',
          text1: 'Detalhe indisponível',
          text2: MAP_PIN_DETAIL_DENIED_MESSAGE,
          visibilityTime: 4000,
        });
        return;
      }

      if (!entry.cep?.trim()) {
        Toast.show({
          type: 'error',
          text1: 'Mapa indisponível',
          text2: 'Este membro não possui CEP cadastrado para exibir no mapa.',
          visibilityTime: 3500,
        });
        return;
      }

      handledDashboardCardRef.current = null;
      prefetchProfilesMapMarkers();
      void navigateWithScreenAccess(
        router,
        '/mapa-geolocalizacao',
        ACCESS_SCREEN.mapGeolocation,
        buildChildScreenParams({ focusProfileId: entry.id })
      );
    },
    [buildChildScreenParams, canViewMapPinDetails, isMapGeolocationEnabled, mapGeolocationDisabledMessage, router]
  );

  const handleOpenMembersMap = useCallback(() => {
    if (!isMapGeolocationEnabled) {
      Toast.show({
        type: 'error',
        text1: 'Mapa indisponível',
        text2: mapGeolocationDisabledMessage,
        visibilityTime: 3500,
      });
      return;
    }

    handledDashboardCardRef.current = null;
    prefetchProfilesMapMarkers();
    void navigateWithScreenAccess(
      router,
      '/mapa-geolocalizacao',
      ACCESS_SCREEN.mapGeolocation,
      buildChildScreenParams()
    );
  }, [buildChildScreenParams, isMapGeolocationEnabled, mapGeolocationDisabledMessage, router]);

  const activeDashboardScreenTitle = useMemo(() => {
    const card = activeDashboardCard;
    if (!card) {
      return '';
    }

    if (isMinimalPresentation && MINIMAL_BODY_TITLE_CARD_CONTENTS.has(card.content)) {
      return '';
    }

    return card.title?.trim() ?? '';
  }, [activeDashboardCard, isMinimalPresentation]);

  const isVigilanceScalesScreen = activeDashboardCard?.content === 'vigilance_scales';

  const { showTechnicalKeys } = useShowAclTechnicalKeys(Boolean(profile?.id));

  const activeDashboardScreenTechnicalKey = useMemo(() => {
    const card = activeDashboardCard;

    if (!card) {
      return null;
    }

    return resolveDashboardCardAccessResourceKey(card.content, {
      scaleTypeCode: card.content === 'scale_roster' ? selectedVigilanceScale : null,
    });
  }, [activeDashboardCard, selectedVigilanceScale]);

  useEffect(() => {
    const card = activeDashboardCard;

    if (!card) {
      return;
    }

    const screenKey =
      resolveDashboardCardAccessResourceKey(card.content, {
        scaleTypeCode: card.content === 'scale_roster' ? selectedVigilanceScale : null,
      }) ?? `dashboard.card.${card.content}`;

    void recordProfileScreenVisit(screenKey, card.title);
  }, [activeDashboardCard, selectedVigilanceScale]);

  useEffect(() => {
    setIsSalaRegistrationsEnabled(activeDashboardCard?.content === 'kids_teens');
  }, [activeDashboardCard]);

  useEffect(() => {
    if (activeDashboardCard?.content === 'birthdays' && !birthdaysLoadedRef.current) {
      birthdaysLoadedRef.current = true;
      void loadBirthdays();
    }
  }, [activeDashboardCard, loadBirthdays]);

  useEffect(() => {
    if (activeDashboardCard?.content === 'members_list' && !membersListLoadedRef.current) {
      membersListLoadedRef.current = true;
      void loadMembersList();
    }
  }, [activeDashboardCard, loadMembersList]);

  useEffect(() => {
    if (
      activeDashboardCard?.content === 'members_list'
      && isMapGeolocationEnabled
      && !membersMapPrefetchStartedRef.current
    ) {
      membersMapPrefetchStartedRef.current = true;
      prefetchProfilesMapMarkers();
    }
  }, [activeDashboardCard, isMapGeolocationEnabled]);

  useEffect(() => {
    if (activeDashboardCard?.content === 'vigilance_scales' && !vigilanceScalesLoadedRef.current) {
      vigilanceScalesLoadedRef.current = true;
      void loadVigilanceScales();
    }
  }, [activeDashboardCard, loadVigilanceScales]);

  const scrollToDashboardCard = useCallback((targetIndex: number, animated = true) => {
    if (targetIndex < 0 || targetIndex >= data.length || carouselLayoutWidth <= 0) {
      return;
    }

    currentIndexRef.current = targetIndex;
    setCurrentIndex(targetIndex);

    const listIndex = isMinimalPresentation ? 0 : targetIndex;

    if (listIndex < 0 || listIndex >= carouselData.length) {
      return;
    }

    const list = dashboardListRef.current;
    if (!list) {
      return;
    }

    list.scrollToIndex({ index: listIndex, animated, viewPosition: 0 });
    requestAnimationFrame(() => {
      list.scrollToOffset({
        offset: listIndex * carouselLayoutWidth,
        animated: false,
      });
    });
  }, [carouselData.length, carouselLayoutWidth, data.length, isMinimalPresentation]);

  const handleDashboardScrollToIndexFailed = useCallback(
    (info: { index: number }) => {
      if (info.index < 0 || info.index >= carouselData.length || carouselLayoutWidth <= 0) {
        return;
      }

      dashboardListRef.current?.scrollToOffset({
        offset: info.index * carouselLayoutWidth,
        animated: false,
      });
      requestAnimationFrame(() => {
        dashboardListRef.current?.scrollToIndex({
          index: info.index,
          animated: false,
          viewPosition: 0,
        });
      });
    },
    [carouselData.length, carouselLayoutWidth]
  );

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
    router.push({
      pathname: '/maintenance-dashboard',
      params: buildChildScreenParams(),
    });
  }, [buildChildScreenParams, canViewMaintenance, isFooterSettingsPressed, router]);

  useFocusEffect(
    useCallback(() => {
      return () => {
        setIsFooterSettingsPressed(false);
      };
    }, [])
  );

  useEffect(() => {
    if (activeDashboardCard?.content === 'offerings') {
      loadPixKey();
    }
  }, [activeDashboardCard, loadPixKey]);

  useEffect(() => {
    if (activeDashboardCard?.content === 'kids_teens') {
      const hasLoadedGroupedRegistrations =
        kidsRegistrations.length > 0 || teensRegistrations.length > 0;
      void refetchGroupedRegistrations({ silent: hasLoadedGroupedRegistrations });
    }
  }, [
    activeDashboardCard,
    kidsRegistrations.length,
    refetchGroupedRegistrations,
    teensRegistrations.length,
  ]);

  const handleBackFromParking = useCallback(() => {
    handleResetVehicleLookup();
    setIsParkingPanelVisible(false);
    const rosterIdx = data.findIndex((item) => item.content === 'scale_roster');
    if (rosterIdx >= 0 && isScaleRosterVisible) {
      scrollToDashboardCard(rosterIdx, false);
      return;
    }

    const scalesIdx = data.findIndex((item) => item.content === 'vigilance_scales');
    if (scalesIdx >= 0) {
      scrollToDashboardCard(scalesIdx, false);
    }
  }, [data, handleResetVehicleLookup, isScaleRosterVisible, scrollToDashboardCard]);

  const handleBackFromScaleRoster = useCallback(() => {
    setIsScaleRosterVisible(false);
    setRegisteredScaleVolunteers([]);
    setRegisteredScaleVolunteersError(null);
    scrollToScalesCardRef.current = true;
  }, []);

  const handleOpenParkingFromRoster = useCallback(() => {
    if (!isDashboardCardContentAllowed('parking_vehicle_v2', dashboardCardAccess)) {
      Alert.alert(
        'Sem permissão',
        DASHBOARD_CARD_BLOCKED_MESSAGES.parking_vehicle_v2
          ?? 'Você não tem permissão para abrir o painel de estacionamento.'
      );
      return;
    }

    scrollToParkingCardRef.current = true;
    setIsParkingPanelVisible(true);
  }, [dashboardCardAccess]);

  useEffect(() => {
    if (!isParkingPanelVisible || !scrollToParkingCardRef.current) {
      return;
    }

    const parkingIdx = data.findIndex((item) => item.content === 'parking_vehicle_v2');
    if (parkingIdx < 0) {
      scrollToParkingCardRef.current = false;
      setIsParkingPanelVisible(false);
      Alert.alert(
        'Painel indisponível',
        DASHBOARD_CARD_BLOCKED_MESSAGES.parking_vehicle_v2
          ?? 'O painel de estacionamento não está disponível para o seu perfil.'
      );
      return;
    }

    scrollToParkingCardRef.current = false;

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        scrollToDashboardCard(parkingIdx, false);
      });
    });
  }, [isParkingPanelVisible, data, scrollToDashboardCard]);

  useEffect(() => {
    if (!isScaleRosterVisible || !scrollToScaleRosterRef.current || isParkingPanelVisible) {
      return;
    }

    const rosterIdx = data.findIndex((item) => item.content === 'scale_roster');
    if (rosterIdx < 0) {
      return;
    }

    scrollToScaleRosterRef.current = false;

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        scrollToDashboardCard(rosterIdx, false);
      });
    });
  }, [isScaleRosterVisible, isParkingPanelVisible, data, scrollToDashboardCard]);

  useEffect(() => {
    if (isScaleRosterVisible || !scrollToScalesCardRef.current) {
      return;
    }

    const scalesIdx = data.findIndex((item) => item.content === 'vigilance_scales');
    if (scalesIdx < 0) {
      return;
    }

    scrollToScalesCardRef.current = false;

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        scrollToDashboardCard(scalesIdx, false);
      });
    });
  }, [isScaleRosterVisible, data, scrollToDashboardCard]);

  useEffect(() => {
    if (isDashboardDeepLinkPending) {
      return;
    }

    const content = activeDashboardCard?.content ?? null;

    if (content) {
      activeDashboardContentRef.current = content;
    }
  }, [activeDashboardCard, isDashboardDeepLinkPending]);

  useEffect(() => {
    if (
      scrollToScaleRosterRef.current
      || scrollToParkingCardRef.current
      || scrollToScalesCardRef.current
      || isDashboardDeepLinkPending
    ) {
      if (!isDashboardDeepLinkPending) {
        previousDashboardDataLengthRef.current = data.length;
      }
      return;
    }

    if (data.length === previousDashboardDataLengthRef.current) {
      return;
    }

    const isInitialCarouselHydration =
      previousDashboardDataLengthRef.current === 0 && data.length > 0;

    previousDashboardDataLengthRef.current = data.length;

    if (isInitialCarouselHydration) {
      return;
    }

    const content = activeDashboardContentRef.current;
    if (!content) {
      return;
    }

    let targetIndex = resolveCarouselIndexByContent(data, content);

    if (targetIndex < 0 && content === 'scale_roster') {
      targetIndex = resolveCarouselIndexByContent(data, 'vigilance_scales');
    }

    if (targetIndex < 0 || targetIndex === currentIndexRef.current) {
      return;
    }

    requestAnimationFrame(() => {
      scrollToDashboardCard(targetIndex, false);
    });
  }, [data, isDashboardDeepLinkPending, scrollToDashboardCard]);

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
    scrollToDashboardCard(nextIndex, false);
  }, [currentIndex, data.length, scrollToDashboardCard]);

  useLayoutEffect(() => {
    if (!isDashboardCardAccessReady) {
      if (requestedDashboardCard) {
        setIsDashboardCarouselReady(false);
      }
      return;
    }

    if (data.length === 0) {
      setIsDashboardCarouselReady(true);
      return;
    }

    if (!requestedDashboardCard) {
      handledDashboardCardRef.current = null;
      setIsDashboardCarouselReady(true);
      return;
    }

    if (isFamilyAgendaDashboardCardParam(requestedDashboardCard)) {
      setIsDashboardCarouselReady(true);
      return;
    }

    // Deep link já aplicado: não voltar ao card quando o carrossel ganha painéis dinâmicos (ex.: scale_roster).
    if (dashboardDeepLinkKey && handledDashboardCardRef.current === dashboardDeepLinkKey) {
      setIsDashboardCarouselReady(true);
      return;
    }

    const targetIndex = resolveDashboardCardIndex(data, requestedDashboardCard);
    if (targetIndex < 0) {
      if (dashboardDeepLinkKey && handledDashboardCardRef.current !== dashboardDeepLinkKey) {
        Alert.alert(
          'Painel indisponível',
          'Você não tem permissão para abrir este painel ou ele não está disponível no momento.'
        );
        handledDashboardCardRef.current = dashboardDeepLinkKey;
      }
      setIsDashboardCarouselReady(true);
      return;
    }

    scrollToDashboardCard(targetIndex, false);

    const targetContent = data[targetIndex]?.content ?? null;
    if (targetContent) {
      activeDashboardContentRef.current = targetContent;
    }

    previousDashboardDataLengthRef.current = data.length;
    handledDashboardCardRef.current = dashboardDeepLinkKey;
    setIsDashboardCarouselReady(true);
  }, [dashboardDeepLinkKey, data, isDashboardCardAccessReady, requestedDashboardCard, scrollToDashboardCard]);

  useEffect(() => {
    if (previousPageWidthRef.current === carouselLayoutWidth) {
      return;
    }

    previousPageWidthRef.current = carouselLayoutWidth;
    const index = isMinimalPresentation ? 0 : currentIndexRef.current;
    requestAnimationFrame(() => {
      dashboardListRef.current?.scrollToOffset({
        offset: index * carouselLayoutWidth,
        animated: false,
      });
    });
  }, [carouselLayoutWidth, isMinimalPresentation]);

  return (
    <MinimalRouteShell
      minimal={isMinimalPresentation}
      title={activeDashboardScreenTitle}
      gradientColors={mainScreenGradient}
    >
        {!isMinimalPresentation ? (
        <View style={styles.header}>
          <View
            style={[
              styles.screenBadgeBox,
              isLgpdPending && styles.screenBadgeBoxLgpdPending,
              isVigilanceScalesScreen && styles.screenBadgeBoxVigilanceScales,
            ]}
          >
            <ActiveScreenBadge
              title={activeDashboardScreenTitle}
              accent="emerald"
              align="left"
              color={isVigilanceScalesScreen ? VIGILANCE_SCALES_UI.accent : undefined}
              technicalKey={showTechnicalKeys ? activeDashboardScreenTechnicalKey : null}
            />
          </View>
        </View>
        ) : null}

        {aclRpcStatus === 'missing' ? (
          <View style={styles.aclUnavailableBanner}>
            <Text style={styles.aclUnavailableText}>{ACL_UNAVAILABLE_MESSAGE}</Text>
          </View>
        ) : null}

        <View style={styles.listContainer} onLayout={handleMinimalListLayout}>
          {isDashboardCardAccessReady && data.length === 0 ? (
            <View style={styles.dashboardEmptyState}>
              <Text style={styles.dashboardEmptyTitle}>Nenhum painel disponível</Text>
              <Text style={styles.dashboardEmptyText}>
                {ghostModeActive
                  ? 'O usuário simulado não tem permissão para ver painéis do dashboard. Encerre o Modo Ghost para voltar à sua sessão.'
                  : aclRpcStatus === 'missing'
                    ? ACL_UNAVAILABLE_MESSAGE
                    : 'Suas permissões atuais não incluem painéis do dashboard. Se você é administrador, saia e entre novamente ou fale com o suporte.'}
              </Text>
            </View>
          ) : null}

          <FlatList
            ref={dashboardListRef}
            style={[
              styles.dashboardFlatList,
              (!isDashboardCardAccessReady || !isDashboardCarouselReady) && styles.dashboardFlatListHidden,
            ]}
            data={carouselData}
            extraData={{
              currentIndex,
              carouselLayoutWidth,
              isScaleRosterVisible,
              isParkingPanelVisible,
              selectedVigilanceScale,
            }}
            horizontal
            pagingEnabled={!isMinimalPresentation}
            scrollEnabled={false}
            keyboardShouldPersistTaps="handled"
            showsHorizontalScrollIndicator={false}
            initialNumToRender={carouselData.length}
            maxToRenderPerBatch={carouselData.length}
            windowSize={Math.max(5, carouselData.length)}
            removeClippedSubviews={false}
            onScroll={handleScroll}
            onScrollToIndexFailed={handleDashboardScrollToIndexFailed}
            scrollEventThrottle={16}
            keyExtractor={(item) => item?.id ?? 'dashboard-card'}
            getItemLayout={(_, index) => ({
              length: carouselLayoutWidth,
              offset: carouselLayoutWidth * index,
              index,
            })}
            snapToAlignment="start"
            snapToInterval={isMinimalPresentation ? undefined : carouselLayoutWidth}
            snapToOffsets={
              isMinimalPresentation
                ? undefined
                : carouselData.map((_, index) => index * carouselLayoutWidth)
            }
            decelerationRate="fast"
            disableIntervalMomentum={true}
            renderItem={({ item }) => (
              <View
                style={
                  isMinimalPresentation
                    ? [styles.carouselPageSlot, effectiveCarouselPageStyle]
                    : effectiveCarouselPageStyle
                }
              >
                <View
                  style={[
                    effectiveCarouselPageStyle,
                    item.content === 'small_group' && styles.smallGroupPanelShell,
                  ]}
                >
                <View style={effectiveDashboardCardWrapperStyle}>
                {item.content === 'event_alt' ? (
                  <View
                    style={[
                    cardBaseStyle,
                      styles.eventCard,
                      styles.eventAltCard,
                      effectiveDashboardPanelCardSizeStyle,
                    ]}
                  >
                    {areEventsLoading || isProfileLoading ? (
                      <View style={styles.eventAltLoadingState}>
                        <ActivityIndicator color="#818CF8" size="large" />
                      </View>
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
                                            {kidsRoomBadgeLabel}
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
                                            {teensRoomBadgeLabel}
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
                          {selectedEvent && selectedEventRequiresQrCheckIn && !isSelectedEventToday ? (
                            <Text style={styles.sectionHint}>
                              O card com QR Code de check-in ficará disponível no dia do evento.
                            </Text>
                          ) : null}
                          {geoCheckinAtivoEnabled
                          && selectedEvent?.event_date
                          && !inGeofenceWindow
                          && !hasTotemCheckinConfirmed ? (
                            <Text style={styles.sectionHint}>
                              Check-in por proximidade inicia{' '}
                              {formatGeofenceHoursBeforeLabel(geoCheckinHoursBefore)}
                              {geoCheckinWindowStartLabel
                                ? ` (${geoCheckinWindowStartLabel})`
                                : ''}
                              .
                            </Text>
                          ) : null}
                          {geoCheckinAtivoEnabled
                          && inGeofenceWindow
                          && selectedEvent?.event_local?.trim()
                          && !eventGeofenceLoading
                          && !eventGeofenceCoordinates ? (
                            <Text style={styles.sectionHintError}>
                              Local «{selectedEvent.event_local}» sem coordenadas nos locais favoritos.
                              Cadastre latitude/longitude em Manutenção → Locais favoritos.
                            </Text>
                          ) : null}
                          {eventGeofenceError ? (
                            <Text style={styles.sectionHintError}>{eventGeofenceError}</Text>
                          ) : null}
                          {geoCheckinErrorMessage ? (
                            <Text style={styles.sectionHintError}>{geoCheckinErrorMessage}</Text>
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
                          {familyRegistrationSessionProfile ? (
                            <FamilyRegistrationList
                              familyId={familyId ?? ''}
                              eventId={selectedEvent?.id}
                              eventName={selectedEvent?.name ?? null}
                              title={selectedEvent ? `Audiência para ${selectedEvent.name}` : 'Audiência da Família'}
                              onRegistrationChange={handleEventRegistrationChange}
                              showKidsIndicator={Boolean(selectedEvent?.kids_room)}
                              showTeensIndicator={Boolean(selectedEvent?.teens_room)}
                              eventEnabledRoomKeys={
                                selectedEvent ? resolveEventEnabledRoomKeys(selectedEvent) : []
                              }
                              quorumMode={selectedEvent?.requer_quorum === true}
                              quorumTotemCheckinConfirmed={hasTotemCheckinConfirmed}
                              sessionPhone={userPhone}
                              sessionProfileName={profile?.full_name ?? null}
                              deviceCoordinates={geoDeviceCoordinates}
                              skipGeofenceOnSave={skipGeofenceOnAudienceSave}
                              geoCheckinStatus={geoCheckinStatus}
                              geoCheckinGpsProgress={geoCheckinGpsProgress}
                              geoCheckinDistanceMeters={geoCheckinDistanceMeters}
                              geoCheckinRadiusMeters={geoCheckinRadiusMeters}
                              sessionProfile={familyRegistrationSessionProfile}
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
                  <View
                    style={[
                    cardBaseStyle,
                      styles.cardGroupedManage,
                      groupedManagePaletteStyle,
                      styles.dashboardPanelCardTopLayout,
                      effectiveDashboardPanelCardSizeStyle,
                      dashboardPanelTopInsetStyle,
                    ]}
                  >
                    <View style={styles.cardGroupedManagePanel}>
                      <PerfilClassPanel />
                    </View>
                  </View>
                ) : item.content === 'administrativo' ? (
                  <View
                    style={[
                    cardBaseStyle,
                      styles.cardAdministrativo,
                      styles.dashboardPanelCardTopLayout,
                      effectiveDashboardPanelCardSizeStyle,
                      dashboardPanelTopInsetStyle,
                    ]}
                  >
                    <AdministrativoCard
                      panelHeight={dashboardPanelCardHeight}
                      isActive={activeDashboardCard?.content === 'administrativo'}
                      initialTab={administrativoInitialTab}
                    />
                  </View>
                ) : item.content === 'small_group' ? (
                  <View
                    style={[
                    cardBaseStyle,
                      styles.cardAdministrativo,
                      styles.dashboardPanelCardTopLayout,
                      effectiveDashboardPanelCardSizeStyle,
                      dashboardPanelTopInsetStyle,
                    ]}
                  >
                    <View style={styles.cardGroupedManagePanel}>
                      <SmallGroupCard
                        panelHeight={dashboardPanelCardHeight}
                        isActive={activeDashboardCard?.content === 'small_group'}
                      />
                    </View>
                  </View>
                ) : item.content === 'campaign_card' ? (
                  <View
                    style={[
                    cardBaseStyle,
                      styles.cardAdministrativo,
                      styles.dashboardPanelCardTopLayout,
                      effectiveDashboardPanelCardSizeStyle,
                      dashboardPanelTopInsetStyle,
                    ]}
                  >
                    <CampaignCard
                      panelHeight={dashboardPanelCardHeight}
                      isActive={activeDashboardCard?.content === 'campaign_card'}
                    />
                  </View>
                ) : item.content === 'opportunity_mural_card' ? (
                  <View
                    style={[
                    cardBaseStyle,
                      styles.cardAdministrativo,
                      styles.dashboardPanelCardTopLayout,
                      effectiveDashboardPanelCardSizeStyle,
                      dashboardPanelTopInsetStyle,
                    ]}
                  >
                    <OpportunityMuralCard
                      panelHeight={dashboardPanelCardHeight}
                      isActive={activeDashboardCard?.content === 'opportunity_mural_card'}
                    />
                  </View>
                ) : item.content === 'members_list' ? (
                  <View
                    style={[
                    cardBaseStyle,
                      skipLegacyCard && styles.cardMembersList,
                      styles.dashboardPanelCardTopLayout,
                      effectiveDashboardPanelCardSizeStyle,
                      dashboardPanelTopInsetStyle,
                    ]}
                  >
                    <View style={styles.membersListHeader}>
                      <Text style={[styles.dashboardPanelTitle, mds?.panelTitle]}>
                        {membersListAudience === 'visitors' ? 'LISTA DE VISITANTES' : item.title}
                      </Text>
                    </View>

                    <View style={styles.membersListBody}>
                      <View style={styles.membersListActionButtons}>
                        {membersListAudience === 'members' ? (
                          <TouchableOpacity
                            style={styles.membersListVisitorsButton}
                            onPress={handleShowVisitorsList}
                            activeOpacity={0.85}
                          >
                            <FontAwesome name="user-o" size={16} color="#4AC3F9" />
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
                        {isMapGeolocationEnabled ? (
                          <TouchableOpacity
                            style={styles.membersListMapButton}
                            onPress={handleOpenMembersMap}
                            activeOpacity={0.85}
                            accessibilityRole="button"
                            accessibilityLabel="Abrir mapa geral de geolocalização"
                          >
                            <FontAwesome name="map" size={18} color="#FFF" />
                            <Text style={styles.membersListMapButtonText}>Mapa Geral</Text>
                          </TouchableOpacity>
                        ) : null}
                      </View>

                    <Text style={[styles.membersListSummaryText, mds?.summaryText]}>
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
                        <Text style={[styles.membersListSectionLabel, mds?.sectionLabel]}>
                          {membersListAudience === 'visitors'
                            ? 'Procurar visitante'
                            : 'Procurar membro'}
                        </Text>
                        <View style={styles.membersListSearchRow}>
                          <TextInput
                            style={[styles.membersListSearchInput, mds?.searchInput]}
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
                      <Text style={[styles.membersListHeaderCell, styles.membersListHeaderName, mds?.headerCell]}>
                        Nome
                      </Text>
                      <View style={styles.membersListActionsHeader}>
                        <Text style={[styles.membersListHeaderCell, styles.membersListHeaderAction, mds?.headerCell]}>
                          Base
                        </Text>
                        <Text style={[styles.membersListHeaderCell, styles.membersListHeaderAction, mds?.headerCell]}>
                          Zap
                        </Text>
                        <Text style={[styles.membersListHeaderCell, styles.membersListHeaderAction, mds?.headerCell]}>
                          GPS
                        </Text>
                      </View>
                    </View>

                    <View style={[styles.membersListBox, mds?.listBox]}>
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
                          {filteredMemberListEntries.map((entry) => {
                            const canOpenMemberOnMap =
                              isMapGeolocationEnabled
                              && canViewMapPinDetails
                              && Boolean(entry.cep?.trim());

                            return (
                            <View key={entry.id} style={styles.membersListRow}>
                              <Text style={styles.membersListName} numberOfLines={1}>
                                {entry.short_name}
                              </Text>
                              <View style={styles.membersListActionsRow}>
                                <TouchableOpacity
                                  style={[
                                    styles.membersListActionCell,
                                    styles.membersListActionCellFamily,
                                  ]}
                                  onPress={() => {
                                    setFamilyModalSeedEntry(entry);
                                    setFamilyModalFamilyId(
                                      normalizeFamilyCode(entry.family_id) || null
                                    );
                                    setFamilyModalMembers([]);
                                    setFamilyModalError(null);
                                  }}
                                  activeOpacity={0.85}
                                >
                                  <FontAwesome name="users" size={18} color="#4ac3f9" />
                                </TouchableOpacity>
                                <TouchableOpacity
                                  style={[
                                    styles.membersListActionCell,
                                    !entry.phone && styles.membersListActionCellDisabled,
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
                                <TouchableOpacity
                                  style={[
                                    styles.membersListActionCell,
                                    !canOpenMemberOnMap && styles.membersListActionCellDisabled,
                                  ]}
                                  onPress={() => handleOpenMemberOnMap(entry)}
                                  disabled={!canOpenMemberOnMap}
                                  activeOpacity={0.85}
                                  accessibilityRole="button"
                                  accessibilityLabel={`Abrir mapa com localização de ${entry.short_name}`}
                                >
                                  <FontAwesome
                                    name="map"
                                    size={16}
                                    color={canOpenMemberOnMap ? '#38bdf8' : '#64748B'}
                                  />
                                </TouchableOpacity>
                              </View>
                            </View>
                            );
                          })}
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
                  </View>
                ) : item.content === 'birthdays' ? (
                  <View
                    style={[
                    cardBaseStyle,
                      skipLegacyCard && styles.cardBirthdays,
                      styles.dashboardPanelCardTopLayout,
                      effectiveDashboardPanelCardSizeStyle,
                      dashboardPanelTopInsetStyle,
                    ]}
                  >
                    <Text style={[styles.dashboardPanelTitle, mds?.panelTitle]}>{item.title}</Text>

                    <View style={styles.birthdaysBody}>
                    <View style={styles.birthdaysFilterSection}>
                      <Text style={[styles.birthdaysFilterLabel, mds?.filterLabel]}>Selecionar Mês</Text>
                      <DropdownSelect
                        options={BIRTHDAY_MONTHS}
                        selectedValue={selectedBirthdayMonth}
                        onValueChange={setSelectedBirthdayMonth}
                        modalTitle="Selecionar mês"
                        style={[styles.birthdaysMonthDropdown, mds?.birthdayMonthDropdown]}
                        triggerTextStyle={[styles.birthdaysMonthDropdownText, mds?.birthdayMonthDropdownText]}
                        triggerIconColor={BIRTHDAYS_UI.accent}
                      />
                    </View>

                    <Text style={[styles.birthdaysSummaryText, mds?.summaryText]}>
                      {birthdaysForSelectedMonth.length} aniversariante
                      {birthdaysForSelectedMonth.length === 1 ? '' : 's'} em{' '}
                      {selectedBirthdayMonthLabel.toLowerCase()}.
                    </Text>

                    <View style={[styles.birthdaysListBox, mds?.listBox]}>
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
                              <View style={[styles.birthdayDateBadge, mds?.birthdayBadge]}>
                                <Text style={[styles.birthdayDateBadgeText, mds?.birthdayBadgeText]}>
                                  {formatBirthdayDayMonth(entry.day, entry.month)}
                                </Text>
                              </View>
                              <View style={styles.birthdayContent}>
                                <Text style={[styles.birthdayName, mds?.nameText]}>{entry.full_name}</Text>
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
                        <Text style={[styles.groupedAudienceEmptyText, mds?.emptyText]}>
                          Nenhum aniversariante encontrado em{' '}
                          {selectedBirthdayMonthLabel.toLowerCase()}.
                        </Text>
                      )}
                    </View>
                    </View>
                  </View>
                ) : item.content === 'financial' ? (
                  <TouchableOpacity
                    style={[
                    cardBaseStyle,
                      effectiveDashboardPanelCardSizeStyle,
                      styles.dashboardPanelCardTopLayout,
                      dashboardPanelTopInsetStyle,
                    ]}
                    onPress={() =>
                      void navigateWithScreenAccess(
                        router,
                        '/financial',
                        ACCESS_SCREEN.financial,
                        buildChildScreenParams(),
                        { method: 'navigate' }
                      )
                    }
                    activeOpacity={0.8}
                  >
                    <Text style={styles.dashboardPanelTitle}>{item.title}</Text>
                    <View style={styles.cardFinancialBody}>
                      <Text style={styles.cardFinancialSubtitle}>
                        Gestão financeira da igreja, tudo em um só lugar.
                      </Text>
                      <View style={styles.cardFinancialCtaRow}>
                        <MaterialIcons
                          name="touch-app"
                          size={34}
                          color="#6EE7B7"
                          style={styles.cardFinancialCtaIcon}
                        />
                        <Text style={styles.cardFinancialCta}>
                          Toque para abrir o módulo financeiro.
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                ) : item.content === 'vigilance_scales' ? (
                  <View
                    style={[
                    cardBaseStyle,
                      skipLegacyCard && styles.cardVigilanceScales,
                      styles.dashboardPanelCardTopLayout,
                      effectiveDashboardPanelCardSizeStyle,
                      dashboardPanelTopInsetStyle,
                    ]}
                  >
                    <ScalesClassPanel embedded />
                  </View>
                ) : item.content === 'parking_vehicle_v2' ? (
                  <View style={[cardBaseStyle, styles.cardParkingVehicleV2, effectiveDashboardPanelCardSizeStyle]}>
                    <Text
                      style={[
                        isMinimalPresentation ? styles.minimalSectionTitle : styles.cardTitle,
                        !isMinimalPresentation && styles.cardParkingVehicleV2Title,
                      ]}
                    >
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
                  <View
                    style={[
                    cardBaseStyle,
                      styles.cardScaleRoster,
                      styles.dashboardPanelCardTopLayout,
                      effectiveDashboardPanelCardSizeStyle,
                    ]}
                  >
                    <Text
                      style={isMinimalPresentation ? styles.minimalSectionTitle : styles.cardTitle}
                    >
                      {selectedVigilanceScaleLabel}
                    </Text>

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
                                  entry.data_servico === nextVigilanceScaleServiceDate
                                    && styles.vigilanceScaleRowFirst,
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
                  <View
                    style={[
                    cardBaseStyle,
                      styles.cardOfferings,
                      styles.dashboardPanelCardTopLayout,
                      effectiveDashboardPanelCardSizeStyle,
                      dashboardPanelTopInsetStyle,
                    ]}
                  >
                    <OfferingsClass
                      title={item.title}
                      recipientRows={offeringsRecipientRows}
                      pixKey={pixKey}
                      pixKeyLoading={isPixKeyLoading}
                      onCopyPixKey={handleCopyPixKey}
                      onRetryLoadPixKey={loadPixKey}
                    />
                  </View>
                ) : item.content === 'kids_teens' ? (
                  <View
                    style={[
                    cardBaseStyle,
                      styles.cardGroupedAudience,
                      styles.dashboardPanelCardTopLayout,
                      effectiveDashboardPanelCardSizeStyle,
                    ]}
                  >
                    <View style={styles.checkinTitleField}>
                      <Text style={styles.checkinTitleValue} numberOfLines={2}>
                        {selectedEvent?.name ?? 'Nenhum evento selecionado'}
                      </Text>
                    </View>
                    <Text style={styles.cardTitle}>{item.title}</Text>
                    {loadingGroupedRegistrations || loadingRoomServidores ? (
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

                        <View style={styles.groupedAudienceServidorNamesRow}>
                          {availableGroupedRooms.map((room) => (
                            <View
                              key={`${room.key}-servidores`}
                              style={styles.groupedAudienceServidorNamesColumn}
                            >
                              <Text style={styles.groupedAudienceServidorNamesLabel}>Servidores</Text>
                              <Text style={styles.groupedAudienceServidorNamesText} numberOfLines={2}>
                                {formatRoomServidorNames(
                                  room.key === 'TEENS' ? teensServidorNames : kidsServidorNames
                                )}
                              </Text>
                            </View>
                          ))}
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
                                        <View style={styles.servidorReadOnlyCheckSlot}>
                                          {registration.room_entry_checked ? (
                                            <Text style={styles.servidorReadOnlyCheckMark}>✓</Text>
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
                                    ? `Nenhum membro da sua família inscrito em ${kidsRoomLabel}.`
                                    : `Nenhum membro da sua família inscrito em ${teensRoomLabel}.`}
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
                    cardBaseStyle,
                      effectiveDashboardPanelCardSizeStyle,
                      item.content === 'qr' && isQrTotemCardPoolBlue && styles.cardQrTotemConfirmed,
                      item.content === 'pastoral' && styles.cardPastoralAction,
                      item.content === 'pastoral' && styles.dashboardPanelCardTopLayout,
                      item.content === 'pastoral' && dashboardPanelTopInsetStyle,
                    ]}
                    onPress={() => {
                      if (item.content === 'qr') setModalVisible(true);
                      if (item.content === 'pastoral') {
                        void navigateWithScreenAccess(
                          router,
                          '/pastoral',
                          ACCESS_SCREEN.pastoral,
                          buildChildScreenParams(
                            currentUserId ? { userId: currentUserId } : {}
                          ),
                          { method: 'navigate' }
                        );
                      }
                    }}
                    activeOpacity={0.8}
                  >
                    <Text
                      style={
                        item.content === 'pastoral' ? styles.dashboardPanelTitle : styles.cardTitle
                      }
                    >
                      {item.title}
                    </Text>
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
                                <Text style={styles.checkinRoomBadgeText}>{kidsRoomBadgeLabel}</Text>
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
                                <Text style={styles.checkinRoomBadgeText}>{teensRoomBadgeLabel}</Text>
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
                        <Text style={styles.cardPastoralPriority}>
                          Sua necessidade é nossa prioridade.
                        </Text>
                        <View style={styles.cardPastoralCtaRow}>
                          <MaterialIcons
                            name="touch-app"
                            size={34}
                            color="#E9D5FF"
                            style={styles.cardPastoralCtaIcon}
                          />
                          <Text style={styles.cardPastoralCta}>
                            Toque aqui para iniciar um atendimento personalizado.
                          </Text>
                        </View>
                      </View>
                    ) : (
                      <Text style={styles.placeholderText}>Clique aqui para abrir o formulário</Text>
                    )}
                  </TouchableOpacity>
                )}
                </View>
                </View>
              </View>
            )}
          />

          {!isMinimalPresentation ? (
          <View
            style={[
              styles.footerControls,
              {
                paddingHorizontal: dashboardCardHorizontalInset,
                paddingBottom: insets.bottom + 10,
              },
            ]}
          >
            <CarouselFooterNav
              currentIndex={currentIndex}
              totalCount={data.length}
              centerLabel="Menu"
              centerAccessibilityLabel="Menu"
              onCenterPress={handleExit}
              onPreviousPress={handleFooterPreviousPress}
              onNextPress={handleFooterNextPress}
              hideSideNavigation
              hidePageIndicator
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
          ) : null}
        </View>

        <Modal
          visible={familyModalSeedEntry !== null}
          transparent
          animationType="fade"
          onRequestClose={() => setFamilyModalSeedEntry(null)}
        >
          <Pressable
            style={styles.membersFamilyBackdrop}
            onPress={() => setFamilyModalSeedEntry(null)}
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
                {isFamilyModalLoading ? (
                  <CardLoadingState lines={3} compact />
                ) : familyModalError ? (
                  <Text style={styles.offeringsErrorText}>{familyModalError}</Text>
                ) : familyModalMembers.length === 0 ? (
                  <Text style={styles.groupedAudienceEmptyText}>
                    Nenhum membro reconhecido nesta família.
                  </Text>
                ) : null}
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
                onPress={() => setFamilyModalSeedEntry(null)}
                activeOpacity={0.85}
              >
                <Text style={styles.membersFamilyCloseButtonText}>Fechar</Text>
              </TouchableOpacity>
            </Pressable>
          </Pressable>
        </Modal>

        {currentUserId && <CheckinModal visible={modalVisible} onClose={() => setModalVisible(false)} userId={currentUserId} />}
        <MinisterialProfileForm
          visible={ministerialFormVisible}
          profileId={profile?.id ?? null}
          onClose={() => setMinisterialFormVisible(false)}
        />
    </MinimalRouteShell>
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
  screenBadgeBox: {
    width: '100%',
    borderRadius: 18,
    backgroundColor: VIGILANCE_SCALES_UI.headerSurface,
    borderWidth: 1,
    borderColor: VIGILANCE_SCALES_UI.border,
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: 'flex-start',
  },
  screenBadgeBoxLgpdPending: {
    backgroundColor: 'rgba(185, 28, 28, 0.72)',
  },
  screenBadgeBoxVigilanceScales: {
    backgroundColor: VIGILANCE_SCALES_UI.headerSurface,
    borderWidth: 1,
    borderColor: VIGILANCE_SCALES_UI.border,
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
  dashboardEmptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    paddingBottom: 24,
  },
  dashboardEmptyTitle: {
    color: '#E2E8F0',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 10,
    textAlign: 'center',
  },
  dashboardEmptyText: {
    color: '#94A3B8',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  dashboardFlatList: { flex: 1, minHeight: 0 },
  carouselPageSlot: {
    width: '100%',
    maxWidth: '100%',
    flex: 1,
    alignSelf: 'stretch',
    minWidth: 0,
    overflow: 'hidden',
  },
  dashboardFlatListHidden: {
    position: 'absolute',
    opacity: 0,
    pointerEvents: 'none',
  },
  eventAltLoadingState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 180,
    paddingVertical: 24,
  },
  cardWrapper: {
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingBottom: 8,
  },
  card: {
    width: '90%',
    alignSelf: 'center',
    ...DASHBOARD_CARD_SHELL,
    padding: STATIC_CARD_INSETS.padding,
    alignItems: 'center',
    overflow: 'hidden',
    justifyContent: 'center',
  },
  cardDashboardShell: {
    ...DASHBOARD_CARD_SHELL,
    paddingHorizontal: 20,
    paddingBottom: 20,
    gap: 12,
  },
  cardQrTotemConfirmed: {
    ...boxShadowStyle({
      color: DASHBOARD_CARD_REFERENCE_THEME.shadowColor,
      offsetY: 10,
      blurRadius: 15,
      opacity: 0.35,
      elevation: 5,
    }),
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
    color: VIGILANCE_SCALES_UI.accent,
    fontSize: 18,
    fontWeight: '800',
    lineHeight: 22,
  },
  eventAltMeta: {
    color: VIGILANCE_SCALES_UI.accent,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 3,
  },
  eventAltLocation: {
    color: VIGILANCE_SCALES_UI.accent,
    fontSize: 12,
    marginTop: 2,
    opacity: 0.88,
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
  cardGroupedManage: {
    flex: 1,
    alignItems: 'stretch',
    justifyContent: 'flex-start',
    gap: 0,
  },
  cardGroupedManagePanel: {
    flex: 1,
    minHeight: 0,
    width: '100%',
    alignSelf: 'stretch',
  },
  smallGroupPanelShell: {
    ...CONTAIN_WIDTH,
    flex: 1,
  },
  cardAdministrativo: {
    alignItems: 'stretch',
    justifyContent: 'flex-start',
    gap: 0,
  },
  groupedManageBody: {
    marginTop: 12,
    flexGrow: 0,
    flexShrink: 1,
    gap: 8,
    alignItems: 'stretch',
    width: '100%',
    justifyContent: 'flex-start',
  },
  groupedManageButton: {
    width: '100%',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupedManageButtonProfile: {
    backgroundColor: 'rgba(99, 102, 241, 0.28)',
    borderColor: '#818CF8',
  },
  groupedManageButtonFamily: {
    backgroundColor: 'rgba(168, 85, 247, 0.24)',
    borderColor: '#C084FC',
  },
  groupedManageButtonMinisterial: {
    backgroundColor: 'rgba(16, 185, 129, 0.18)',
    borderColor: '#34D399',
  },
  groupedManageButtonContent: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  groupedManageButtonIcon: {
    opacity: 0.95,
  },
  groupedManageButtonTitle: {
    color: '#F8FAFC',
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 20,
  },
  cardPastoralAction: {
    ...boxShadowStyle({
      color: DASHBOARD_CARD_REFERENCE_THEME.shadowColor,
      offsetY: 10,
      blurRadius: 15,
      opacity: 0.32,
      elevation: 5,
    }),
  },
  dashboardPanelCardTopLayout: {
    justifyContent: 'flex-start',
    alignItems: 'stretch',
  },
  dashboardPanelTitle: {
    ...DASHBOARD_PANEL_TITLE_TYPO,
    textAlign: 'center',
    marginBottom: 4,
    alignSelf: 'stretch',
  },
  cardFinancialBody: {
    flex: 1,
    justifyContent: 'center',
    paddingVertical: 8,
  },
  cardFinancialSubtitle: {
    color: DASHBOARD_CARD_TYPO.body.color,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 8,
  },
  cardFinancialCtaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginTop: 32,
    paddingHorizontal: 8,
    gap: 10,
    maxWidth: '100%',
  },
  cardFinancialCtaIcon: {
    flexShrink: 0,
  },
  cardFinancialCta: {
    flexShrink: 1,
    color: VIGILANCE_SCALES_UI.accent,
    fontSize: 17,
    lineHeight: 24,
    fontWeight: '700',
    textAlign: 'center',
  },
  cardPastoralBody: {
    width: '100%',
    paddingHorizontal: 8,
    marginTop: 48,
  },
  cardPastoralSubtitle: {
    color: VIGILANCE_SCALES_UI.accent,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginTop: 8,
    fontWeight: '500',
  },
  cardPastoralPriority: {
    color: VIGILANCE_SCALES_UI.accent,
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    marginTop: 24,
    fontWeight: '600',
    opacity: 0.88,
  },
  cardPastoralCtaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 40,
    paddingHorizontal: 4,
    gap: 10,
  },
  cardPastoralCtaIcon: {
    flexShrink: 0,
  },
  cardPastoralCta: {
    flex: 1,
    color: VIGILANCE_SCALES_UI.accent,
    fontSize: 17,
    lineHeight: 24,
    fontWeight: '700',
  },
  cardOfferings: {
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  cardBirthdays: {
    paddingHorizontal: 18,
    paddingBottom: 18,
    gap: 6,
  },
  cardMembersList: {
    alignItems: 'stretch',
    justifyContent: 'flex-start',
    padding: 20,
    gap: 0,
  },
  membersListSummaryText: {
    color: VIGILANCE_SCALES_UI.accent,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  membersListHeader: {
    alignItems: 'stretch',
  },
  membersListBody: {
    marginTop: 16,
    gap: 10,
    flex: 1,
    minHeight: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.55)',
    borderWidth: 1,
    borderColor: 'rgba(58, 150, 221, 1)',
  },
  membersListActionButtons: {
    flexDirection: 'row',
    alignItems: 'stretch',
    width: '100%',
    gap: 8,
  },
  membersListVisitorsButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.28)',
    borderWidth: 1,
    borderColor: '#F8FAFC',
  },
  membersListVisitorsButtonText: {
    color: 'rgba(76, 159, 224, 1)',
    fontSize: 13,
    fontWeight: '800',
  },
  membersListMembersButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 10,
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
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.28)',
    borderWidth: 1,
    borderColor: '#F8FAFC',
  },
  membersListMapButtonDisabled: {
    opacity: 0.45,
    backgroundColor: 'rgba(100, 116, 139, 0.2)',
    borderColor: 'rgba(148, 163, 184, 0.45)',
  },
  membersListMapButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  membersListMapButtonTextDisabled: {
    color: '#94A3B8',
  },
  membersListSearchSection: {
    gap: 6,
  },
  membersListSectionLabel: {
    color: 'rgba(96, 197, 243, 1)',
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
  },
  membersListSearchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  membersListSearchInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#F8FAFC',
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.55)',
    color: 'rgba(80, 191, 242, 1)',
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
    gap: 8,
  },
  membersListHeaderCell: {
    color: '#3A96DD',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    textAlign: 'center',
  },
  membersListHeaderName: {
    flex: 1,
    minWidth: 0,
    textAlign: 'left',
  },
  membersListActionsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,
    gap: 2,
  },
  membersListHeaderAction: {
    width: 40,
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
    borderBottomColor: 'rgba(255, 255, 255, 1)',
    gap: 8,
  },
  membersListName: {
    flex: 1,
    minWidth: 0,
    color: '#4A9EDF',
    fontSize: 15,
    fontWeight: '600',
  },
  membersListActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,
    gap: 2,
  },
  membersListActionCell: {
    width: 40,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  membersListActionCellFamily: {
    backgroundColor: 'rgba(255, 255, 255, 1)',
  },
  membersListActionCellDisabled: {
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
    paddingHorizontal: 20,
    paddingBottom: 20,
    gap: 12,
  },
  cardParkingVehicleV2: {
    alignItems: 'stretch',
    justifyContent: 'flex-start',
    padding: 20,
    gap: 6,
    minHeight: 0,
    overflow: 'hidden',
  },
  cardScaleRoster: {
    alignItems: 'stretch',
    justifyContent: 'flex-start',
    padding: 20,
    gap: 10,
  },
  scaleRosterParkingPrompt: {
    flexShrink: 0,
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  scaleRosterParkingActionsRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 10,
    width: '100%',
  },
  scaleRosterParkingActionHalf: {
    flex: 1,
    minWidth: 0,
  },
  scaleRosterIdentifyVehicleButton: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: '#FBBF24',
    borderWidth: 1,
    borderColor: '#3A96DD',
  },
  scaleRosterIdentifyVehicleButtonText: {
    color: '#020617',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.2,
    flexShrink: 1,
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
    backgroundColor: '#F59E0B',
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
    backgroundColor: '#F59E0B',
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
  cardTitle: { ...DASHBOARD_CARD_TYPO.cardTitle, marginBottom: 16 },
  minimalSectionTitle: {
    ...MINIMAL_SECTION_TITLE,
    alignSelf: 'stretch',
    marginBottom: 8,
  },
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
  groupedAudienceServidorNamesRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
  },
  groupedAudienceServidorNamesColumn: {
    flex: 1,
    flexBasis: 0,
    gap: 2,
    minWidth: 0,
  },
  groupedAudienceServidorNamesLabel: {
    color: '#64748B',
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  groupedAudienceServidorNamesText: {
    color: '#CBD5E1',
    fontSize: 12,
    lineHeight: 16,
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
  offeringsContent: {
    gap: 14,
    marginTop: 28,
  },
  vigilanceScaleFilterSection: {
    flex: 1,
    minHeight: 0,
    gap: 8,
  },
  vigilanceScalesPanelTitle: {
    color: VIGILANCE_SCALES_UI.accent,
  },
  vigilanceScaleSectionLabel: {
    color: VIGILANCE_SCALES_UI.accent,
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
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
    borderColor: VIGILANCE_SCALES_UI.borderMuted,
    backgroundColor: VIGILANCE_SCALES_UI.surface,
  },
  vigilanceScaleRadioRowSelected: {
    borderColor: VIGILANCE_SCALES_UI.border,
    backgroundColor: VIGILANCE_SCALES_UI.surfaceHighlight,
  },
  vigilanceScaleRadioOuter: {
    width: 20,
    height: 20,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: VIGILANCE_SCALES_UI.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vigilanceScaleRadioOuterSelected: {
    borderColor: VIGILANCE_SCALES_UI.accent,
  },
  vigilanceScaleRadioInner: {
    width: 10,
    height: 10,
    borderRadius: 999,
    backgroundColor: VIGILANCE_SCALES_UI.accent,
  },
  vigilanceScaleRadioLabel: {
    flex: 1,
    color: VIGILANCE_SCALES_UI.accent,
    fontSize: 14,
    fontWeight: '600',
  },
  vigilanceScaleRadioLabelSelected: {
    color: VIGILANCE_SCALES_UI.accent,
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
    color: DASHBOARD_CARD_THEMES.parking_vehicle_v2.accentMuted,
    fontSize: 13,
    fontWeight: '800',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  parkingVehicleResultSubtitle: {
    color: DASHBOARD_CARD_THEMES.parking_vehicle_v2.accentMuted,
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
  birthdaysBody: {
    flex: 1,
    minHeight: 0,
    gap: 6,
    marginTop: 28,
  },
  birthdaysFilterSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 2,
  },
  birthdaysFilterLabel: {
    color: BIRTHDAYS_UI.accent,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    flexShrink: 0,
  },
  birthdaysSummaryText: {
    color: BIRTHDAYS_UI.accent,
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
    borderColor: BIRTHDAYS_UI.border,
    borderRadius: 18,
    backgroundColor: BIRTHDAYS_UI.listBackground,
    overflow: 'hidden',
  },
  birthdaysListScroll: {
    flex: 1,
    minHeight: 0,
    borderWidth: 1,
    borderColor: '#FFFFFF',
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
    backgroundColor: '#FFFFFF',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: BIRTHDAYS_UI.border,
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
    borderColor: BIRTHDAYS_UI.border,
    backgroundColor: BIRTHDAYS_UI.dateBadgeBackground,
    paddingVertical: 5,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  birthdayDateBadgeText: {
    color: BIRTHDAYS_UI.dateText,
    fontSize: 12,
    fontWeight: '800',
  },
  birthdayName: {
    flex: 1,
    color: BIRTHDAYS_UI.nameText,
    fontSize: 14,
  },
  birthdaysMonthDropdown: {
    color: '#FFFFFF',
    backgroundColor: BIRTHDAYS_UI.monthDropdownBackground,
  },
  birthdaysMonthDropdownText: {
    color: BIRTHDAYS_UI.monthDropdownText,
    fontWeight: '700',
    textAlign: 'center',
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
    color: DASHBOARD_CARD_THEMES.offerings.accent,
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#F59E0B',
    borderRadius: 18,
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#FBBF24',
  },
  offeringsCopyButtonIcon: {
    flexShrink: 0,
  },
  offeringsCopyButtonText: {
    color: '#451A03',
    fontSize: 16,
    fontWeight: '800',
  },
  offeringsHelpText: {
    color: '#CBD5E1',
    fontSize: 14,
    lineHeight: 20,
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
    borderColor: DASHBOARD_CARD_THEMES.offerings.borderColor,
    backgroundColor: 'rgba(217, 119, 6, 0.14)',
  },
  offeringsSecondaryButtonText: {
    color: DASHBOARD_CARD_THEMES.offerings.accent,
    fontSize: 15,
    fontWeight: '700',
  },
  checkinTitleField: {
    width: '100%',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: DASHBOARD_CARD_THEMES.kids_teens.borderColor,
    backgroundColor: 'rgba(244, 114, 182, 0.18)',
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
  footerControls: { flexShrink: 0, marginTop: 6 },
  servidorReadOnlyCheckMark: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
    flexShrink: 0,
  },
  servidorReadOnlyCheckSlot: {
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