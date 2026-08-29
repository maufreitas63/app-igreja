import {
  emptyMaintenanceEventForm,
  formFromMaintenanceEvent,
  formatEventTimeInputMask,
  summarizeMaintenanceEvent,
  isMaintenanceEventFormDateInPast,
  toggleEnabledRoomKey,
  validateMaintenanceEventForm,
  type MaintenanceEventFormState,
} from '@/lib/maintenanceEventForm';
import { ActiveScreenBadge } from '@/components/ui/ActiveScreenBadge';
import { EventFavoriteLocationPickerModal } from '@/components/EventFavoriteLocationPickerModal';
import { MonthlyDatePickerModal } from '@/components/ui/MonthlyDatePickerModal';
import { CarouselFooterNav } from '@/components/ui/CarouselFooterNav';
import { EventsGanttChart } from '@/components/EventsGanttChart';
import { MaintenanceQuorumPresenceCard } from '@/components/MaintenanceQuorumPresenceCard';
import { MaintenanceScaleTypesCard } from '@/components/MaintenanceScaleTypesCard';
import { MaintenanceScaleVolunteersCard } from '@/components/MaintenanceScaleVolunteersCard';
import { MaintenanceAccessControlCard } from '@/components/MaintenanceAccessControlCard';
import { MaintenanceFinancialsCard } from '@/components/MaintenanceFinancialsCard';
import { MaintenancePredictiveInsightsCard } from '@/components/MaintenancePredictiveInsightsCard';
import { MaintenanceReportsCard } from '@/components/MaintenanceReportsCard';
import { MaintenanceSupportSuggestionsCard } from '@/components/MaintenanceSupportSuggestionsCard';
import { MaintenancePastoralCareCard } from '@/components/MaintenancePastoralCareCard';
import { MaintenanceSmallGroupsCard } from '@/components/MaintenanceSmallGroupsCard';
import { MaintenanceCampaignsCard } from '@/components/MaintenanceCampaignsCard';
import { MaintenanceVolunteerMuralCard } from '@/components/MaintenanceVolunteerMuralCard';
import { MaintenanceDiscipleshipAlertsCard } from '@/components/MaintenanceDiscipleshipAlertsCard';
import { MaintenanceDiscipleshipThemesCard } from '@/components/MaintenanceDiscipleshipThemesCard';
import { MaintenanceDiscipleshipResetCard } from '@/components/MaintenanceDiscipleshipResetCard';
import { MaintenancePastoralRoleChangeCard } from '@/components/MaintenancePastoralRoleChangeCard';
import { MaintenanceIgrejaTransferCard } from '@/components/MaintenanceIgrejaTransferCard';
import { MaintenanceEventOrchestrationCard } from '@/components/MaintenanceEventOrchestrationCard';
import { MaintenanceFamilyReceptionCard } from '@/components/MaintenanceFamilyReceptionCard';
import { MaintenanceVisitorFollowupCard } from '@/components/MaintenanceVisitorFollowupCard';
import { MaintenanceProfileCadastroCard } from '@/components/MaintenanceProfileCadastroCard';
import { MaintenanceProfileAccessInsightsCard } from '@/components/MaintenanceProfileAccessInsightsCard';
import { MaintenanceGhostModeCard } from '@/components/MaintenanceGhostModeCard';
import { MaintenanceScalesCard } from '@/components/MaintenanceScalesCard';
import { MaintenanceSalaServidorCard } from '@/components/MaintenanceSalaServidorCard';
import { QuorumCheckinRegistryTable } from '@/components/QuorumCheckinRegistryTable';
import { useGhostMode } from '@/context/GhostModeContext';
import { SCALE_SCHEDULING_MENU_LABEL, SCALE_VOLUNTEERS_MENU_LABEL } from '@/lib/appDrawerMenu';
import { loadMaintenanceDashboardAccess } from '@/lib/maintenanceDashboardAccess';
import { resolveMaintenancePanelAccessResourceKey } from '@/lib/screenAccessResourceKeys';
import { recordProfileScreenVisit } from '@/lib/profileScreenVisitTracking';
import { MEMBER_HOME_PATH } from '@/lib/failClosedNavigation';
import { useShowAclTechnicalKeys } from '@/hooks/useShowAclTechnicalKeys';
import { type MaintenanceScalePanelContent } from '@/lib/scaleAccess';
import {
  ensureEventsOptionalColumns,
  ENABLED_ROOM_KEYS_COLUMN_SQL_HINT,
  ENABLED_ROOM_KEYS_DISTINCT_ORDER_SQL_HINT,
  GEOFENCE_ATIVO_COLUMN_SQL_HINT,
  isGeofenceAtivoColumnAvailable,
  isRequerQuorumColumnAvailable,
  isSomenteMembrosColumnAvailable,
  isTotemAtivoColumnAvailable,
  REQUER_QUORUM_COLUMN_SQL_HINT,
  SOMENTE_MEMBROS_COLUMN_SQL_HINT,
  TOTEM_COLUMN_SQL_HINT,
} from '@/lib/eventsColumnSupport';
import {
  DEFAULT_CHURCH_ROOM_SETTINGS,
  listChurchRoomSettings,
  type ChurchRoomSetting,
} from '@/lib/churchRoomSettings';
import {
  ensureEventQuorumRegistry,
  isQuorumRegistryTableAvailable,
  QUORUM_REGISTRY_SQL_HINT,
} from '@/lib/quorumRegistry';
import {
  buildDashboardPanelCardSizeStyle,
  computeDashboardCardHeight,
  resolveCarouselIndexByContent,
  resolveMaintenancePanelIndex,
} from '@/lib/dashboardPanelLayout';
import { MinimalRouteShell } from '@/components/minimal/MinimalRouteShell';
import { CloseFooterBar } from '@/components/minimal/CloseFooterBar';
import { MINIMAL_FLAT_PANEL, MINIMAL_PAGE, CONTAIN_WIDTH } from '@/lib/minimalPresentation';
import { MINIMAL_SECTION_TITLE, MINIMAL_UI } from '@/lib/minimalUiTheme';
import { pickRouteParam, isMinimalPresentationRoute } from '@/lib/dashboardReturnNavigation';
import {
  MAINTENANCE_SHORTCUT_ICON_ACTIVE_COLOR,
  MAINTENANCE_SHORTCUT_ICON_COLORS,
  MAINTENANCE_SHORTCUT_ICONS,
  type MaintenancePanelContent,
} from '@/lib/maintenanceShortcutIcons';
import {
  computeMaintenancePanelInsets,
  UI_MAINTENANCE_PANEL_BORDERS,
  UI_PANEL_TYPO,
  UI_RADIUS,
  UI_SPACING,
} from '@/lib/uiTokens';
import { MAINTENANCE_LIGHT_PANEL_CARD, VIGILANCE_SCALES_UI } from '@/lib/dashboardCardThemes';
import { DASHBOARD_CARD_BOX_SHADOW, DASHBOARD_CARD_SHELL } from '@/lib/dashboardCardStyles';
import { confirmDialog } from '@/lib/confirmDialog';
import {
  deleteMaintenanceEvent,
  replicateMaintenanceEventFromRecord,
  saveMaintenanceEvent,
} from '@/lib/saveMaintenanceEvent';
import {
  isUnlimitedEventCapacity,
  UNLIMITED_EVENT_CAPACITY_LABEL,
} from '@/lib/eventCapacity';
import type { EventFavoriteLocation } from '@/lib/eventFavoriteLocationsApi';
import {
  EVENT_FAVORITE_LOCATIONS_SQL_HINT,
  useEventFavoriteLocations,
} from '@/hooks/useEventFavoriteLocations';
import { useFamilyReceptionSuperAdminNotifier } from '@/hooks/useFamilyReceptionSuperAdminNotifier';
import { useMaintenanceEvents, type MaintenanceEvent } from '@/hooks/useMaintenanceEvents';
import { useQuorumRegistry } from '@/hooks/useQuorumRegistry';
import { FontAwesome, MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';

/** Cor ativa unificada dos chips de sala no editor de eventos. */
const ROOM_CHIP_CUSTOM_ACTIVE: ViewStyle = {
  backgroundColor: 'rgba(30, 64, 175, 0.10)',
  borderColor: 'rgba(30, 64, 175, 0.35)',
};

/** Fundo claro no padrão vigilance. */
const MAINTENANCE_SCREEN_GRADIENT = ['#FFFFFF', '#F0F9FF'] as const;
const FOOTER_NAV_REPEAT_MS = 500;

const MINIMAL_SWITCH_TRACK = { false: MINIMAL_UI.divider, true: MINIMAL_UI.accent } as const;

const STATIC_MAINTENANCE_PANEL_INSETS = computeMaintenancePanelInsets(390);
/** Padding horizontal de `MinimalScreenLayout` (`flexContent`). */
const MINIMAL_LAYOUT_HORIZONTAL_PADDING = 16;

type MaintenanceCarouselCard = {
  id: string;
  title: string;
  content:
    | 'menu'
    | 'events'
    | 'events_gantt'
    | 'sala_servidor'
    | 'quorum_presence'
    | 'scale_types'
    | 'scale_volunteers'
    | 'scales'
    | 'pastoral_care'
    | 'small_groups_management'
    | 'campaigns_management'
    | 'volunteer_mural'
    | 'mudanca_papeis'
    | 'transferencia_igreja'
    | 'profile_cadastro'
    | 'family_reception'
    | 'visitor_followup'
    | 'financials'
    | 'predictive_insights'
    | 'relatorios'
    | 'suggestions_improvements'
    | 'access_control'
    | 'profile_access_insights'
  | 'auditor'
  | 'discipleship_themes'
  | 'discipleship_alerts'
  | 'discipleship_reset'
  | 'event_orchestration';
};

type MaintenanceShortcut = {
  id: string;
  label: string;
  content: MaintenancePanelContent;
};

const MAINTENANCE_PANEL_CARDS: MaintenanceCarouselCard[] = [
  { id: '1', title: 'Programação de Eventos', content: 'events' },
  { id: '2', title: 'Cronograma de Eventos', content: 'events_gantt' },
  { id: '15', title: 'Manutenção de Avisos', content: 'event_orchestration' },
  { id: '3', title: 'Sala(s) - Check In', content: 'sala_servidor' },
  { id: '5', title: 'Tipos de Escala', content: 'scale_types' },
  { id: '6', title: SCALE_VOLUNTEERS_MENU_LABEL, content: 'scale_volunteers' },
  { id: '7', title: SCALE_SCHEDULING_MENU_LABEL, content: 'scales' },
  { id: '8', title: 'Cuidado Pastoral', content: 'pastoral_care' },
  { id: '24', title: 'Gestão de Pequenos Grupos', content: 'small_groups_management' },
  { id: '25', title: 'Gestão de Campanhas', content: 'campaigns_management' },
  { id: '26', title: 'Mural de Voluntários', content: 'volunteer_mural' },
  { id: '21', title: 'Temas da Trilha', content: 'discipleship_themes' },
  { id: '20', title: 'Trilha — Reconhecimentos', content: 'discipleship_alerts' },
  { id: '22', title: 'Resetar Trilha', content: 'discipleship_reset' },
  { id: '9', title: 'Informações Financeiras', content: 'financials' },
  { id: '16', title: 'Modelo Preditivo', content: 'predictive_insights' },
  { id: '17', title: 'Relatórios', content: 'relatorios' },
  { id: '18', title: 'Sugestões e Melhorias', content: 'suggestions_improvements' },
  { id: '4', title: 'Lista de Presença', content: 'quorum_presence' },
  { id: '11', title: 'Cadastro de Usuário', content: 'profile_cadastro' },
  { id: '12', title: 'Recepção Familiar', content: 'family_reception' },
  { id: '27', title: 'Régua de Acolhimento', content: 'visitor_followup' },
  { id: '10', title: 'Controle de Acesso', content: 'access_control' },
  { id: '13', title: 'Mudança de Papéis', content: 'mudanca_papeis' },
  { id: '23', title: 'Transferência de Membro', content: 'transferencia_igreja' },
  { id: '14', title: 'Acessos de Usuários', content: 'profile_access_insights' },
  { id: '19', title: 'Modo Ghost (Auditor)', content: 'auditor' },
];

type FeatureToggleProps = {
  label: string;
  value: boolean;
  onValueChange: (next: boolean) => void;
  activeStyle: ViewStyle;
};

const getSaveErrorMessage = (err: unknown) => {
  const message =
    err && typeof err === 'object' && 'message' in err
      ? String((err as { message: string }).message)
      : 'Não foi possível salvar o evento.';

  const code =
    err && typeof err === 'object' && 'code' in err ? String((err as { code: string }).code) : '';

  if (
    code === '42501'
    || code === '0_ROWS'
    || message.toLowerCase().includes('row-level security')
    || message.toLowerCase().includes('nenhum registro foi apagado')
  ) {
    return `${message}\n\nExecute no Supabase o script scripts/events-maintenance-rls.sql (inclui DELETE) na tabela events.`;
  }

  if (code === '23503' || message.toLowerCase().includes('foreign key')) {
    return 'Este evento possui inscrições vinculadas. Remova-as antes de apagar.';
  }

  if (
    code === '23502' ||
    message.toLowerCase().includes('max_capacity') ||
    message.toLowerCase().includes('null value')
  ) {
    return 'Informe a capacidade (vagas). O banco exige um número neste campo.';
  }

  if (message.toLowerCase().includes('totem_ativo')) {
    return `${message}\n\n${TOTEM_COLUMN_SQL_HINT}`;
  }

  if (message.toLowerCase().includes('somente_membros')) {
    return `${message}\n\n${SOMENTE_MEMBROS_COLUMN_SQL_HINT}`;
  }

  if (message.toLowerCase().includes('geofence_ativo')) {
    return `Check-in automático não foi salvo no banco.\n\n${GEOFENCE_ATIVO_COLUMN_SQL_HINT}`;
  }

  if (
    message.toLowerCase().includes('aggregate with distinct')
    || message.toLowerCase().includes('order by expressions must appear')
  ) {
    return `Erro ao salvar salas do evento (trigger no banco).\n\n${ENABLED_ROOM_KEYS_DISTINCT_ORDER_SQL_HINT}`;
  }

  if (
    code === 'ENABLED_ROOM_KEYS_MISSING'
    || message.toLowerCase().includes('enabled_room_keys')
  ) {
    return `Salas customizadas no evento não foram salvas.\n\n${ENABLED_ROOM_KEYS_COLUMN_SQL_HINT}`;
  }

  if (code === 'GEOFENCE_COLUMN_MISSING') {
    return `Check-in automático não foi salvo no banco.\n\n${GEOFENCE_ATIVO_COLUMN_SQL_HINT}`;
  }

  if (
    code === 'EVENT_DUPLICATE'
    || code === '23505'
    || message.toLowerCase().includes('já existe um evento com o mesmo nome')
    || message.toLowerCase().includes('events_tenant_name_local_date_uq')
  ) {
    return 'Já existe um evento com o mesmo nome, local e data/hora. Altere um desses campos ou edite o evento existente.';
  }

  return message;
};

const FeatureToggle = ({ label, value, onValueChange, activeStyle }: FeatureToggleProps) => (
  <TouchableOpacity
    style={[styles.featureChip, value && activeStyle]}
    onPress={() => onValueChange(!value)}
    activeOpacity={0.85}
  >
    <Text style={[styles.featureChipText, value && styles.featureChipTextActive]}>{label}</Text>
  </TouchableOpacity>
);

type SimNaoToggleProps = {
  value: boolean;
  onValueChange: (next: boolean) => void;
  disabled?: boolean;
  minimal?: boolean;
};

const SimNaoToggle = ({ value, onValueChange, disabled, minimal }: SimNaoToggleProps) => (
  <View style={[styles.totemBlock, minimal && styles.totemBlockMinimal]}>
    <View style={[styles.totemChoiceRow, minimal && styles.totemChoiceRowMinimal]}>
      <TouchableOpacity
        style={[
          styles.totemChoiceButton,
          minimal && styles.totemChoiceButtonMinimal,
          value && styles.totemChoiceButtonSimActive,
          minimal && value && styles.totemChoiceButtonSimActiveMinimal,
        ]}
        onPress={() => onValueChange(true)}
        activeOpacity={0.85}
        disabled={disabled}
      >
        <Text
          style={[
            styles.totemChoiceText,
            value && styles.totemChoiceTextActive,
            minimal && styles.totemChoiceTextMinimal,
            minimal && value && styles.totemChoiceTextSimActiveMinimal,
          ]}
        >
          Sim
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[
          styles.totemChoiceButton,
          minimal && styles.totemChoiceButtonMinimal,
          !value && styles.totemChoiceButtonNaoActive,
          minimal && !value && styles.totemChoiceButtonNaoActiveMinimal,
        ]}
        onPress={() => onValueChange(false)}
        activeOpacity={0.85}
        disabled={disabled}
      >
        <Text
          style={[
            styles.totemChoiceText,
            !value && styles.totemChoiceTextActive,
            minimal && styles.totemChoiceTextMinimal,
            minimal && !value && styles.totemChoiceTextNaoActiveMinimal,
          ]}
        >
          Não
        </Text>
      </TouchableOpacity>
    </View>
  </View>
);

type FeatureToggleColumnProps = {
  label: string;
  value: boolean;
  onValueChange: (next: boolean) => void;
  disabled?: boolean;
  minimal?: boolean;
  halfWidth?: boolean;
};

const FeatureToggleColumn = ({
  label,
  value,
  onValueChange,
  disabled,
  minimal,
  halfWidth,
}: FeatureToggleColumnProps) => (
  <View
    style={[
      styles.featureToggleColumn,
      minimal && styles.featureToggleColumnMinimal,
      halfWidth && styles.featureToggleColumnHalf,
    ]}
  >
    <Text
      style={[styles.totemFieldLabel, minimal && styles.totemFieldLabelMinimal]}
      numberOfLines={2}
    >
      {label}
    </Text>
    <SimNaoToggle
      value={value}
      onValueChange={onValueChange}
      disabled={disabled}
      minimal={minimal}
    />
  </View>
);

export default function MaintenanceDashboard() {
  const { width: pageWidth, height: windowHeight } = useWindowDimensions();
  const { panel: panelParam, presentation: presentationParam } = useLocalSearchParams<{
    panel?: string | string[];
    presentation?: string | string[];
  }>();
  const requestedPanel = pickRouteParam(panelParam);
  const isMinimalPresentation = isMinimalPresentationRoute(presentationParam);
  const previousPageWidthRef = useRef(pageWidth);
  /** Largura/altura reais do estágio (após padding do MinimalScreenLayout), para o carrossel caber. */
  const [measuredCarouselWidth, setMeasuredCarouselWidth] = useState(0);
  const [measuredCarouselHeight, setMeasuredCarouselHeight] = useState(0);
  const carouselPageWidth = useMemo(() => {
    if (!isMinimalPresentation) {
      return pageWidth;
    }
    if (measuredCarouselWidth > 0) {
      return measuredCarouselWidth;
    }
    return Math.max(280, pageWidth - MINIMAL_LAYOUT_HORIZONTAL_PADDING * 2);
  }, [isMinimalPresentation, measuredCarouselWidth, pageWidth]);
  const router = useRouter();
  const { isActive: ghostModeActive } = useGhostMode();
  const insets = useSafeAreaInsets();
  const { events, loading, error, refetch } = useMaintenanceEvents();
  const safeEvents = useMemo(() => events ?? [], [events]);
  const hasQuorumEvent = useMemo(
    () => safeEvents.some((event) => event.requer_quorum === true),
    [safeEvents]
  );
  const quorumPresenceShortcutEnabled = !loading && hasQuorumEvent;

  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [form, setForm] = useState<MaintenanceEventFormState>(emptyMaintenanceEventForm);
  const [eventRoomOptions, setEventRoomOptions] = useState<ChurchRoomSetting[]>(
    DEFAULT_CHURCH_ROOM_SETTINGS
  );
  const [isSaving, setIsSaving] = useState(false);
  const [isReplicatingSeven, setIsReplicatingSeven] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteConfirmPending, setDeleteConfirmPending] = useState(false);
  /** ID/nome fixados ao abrir a confirmação — evita apagar outro evento se a seleção mudar. */
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [deleteTargetName, setDeleteTargetName] = useState('');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [eventDatePickerVisible, setEventDatePickerVisible] = useState(false);
  const [favoritePickerVisible, setFavoritePickerVisible] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const carouselRef = useRef<FlatList<MaintenanceCarouselCard>>(null);
  const currentIndexRef = useRef(0);
  const carouselScrollSyncLockRef = useRef(false);
  const footerNavRepeatIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const footerNavRepeatActiveRef = useRef(false);
  const pendingMaintenancePanelRef = useRef<MaintenancePanelContent | null>(null);
  const activeMaintenanceContentRef = useRef<MaintenanceCarouselCard['content']>('menu');
  const previousMaintenanceCardCountRef = useRef(0);
  const [headerUserName, setHeaderUserName] = useState('Usuário');
  const [accessState, setAccessState] = useState<'checking' | 'allowed' | 'denied'>('checking');
  const [canManageAccessControl, setCanManageAccessControl] = useState(false);
  const [canAccessAccessControlCard, setCanAccessAccessControlCard] = useState(false);
  const [scalePanelAccess, setScalePanelAccess] = useState<
    Partial<Record<MaintenanceScalePanelContent, boolean>>
  >({});
  const [canAccessPastoralCare, setCanAccessPastoralCare] = useState(false);
  const [canAccessPastoralRoleChange, setCanAccessPastoralRoleChange] = useState(false);
  const [canMonitorFamilyReception, setCanMonitorFamilyReception] = useState(false);
  const [canAccessProfileCadastro, setCanAccessProfileCadastro] = useState(false);
  const [canUpdateMaintenanceEvents, setCanUpdateMaintenanceEvents] = useState(false);
  const [canBypassEventPastDateLock, setCanBypassEventPastDateLock] = useState(false);
  const [canOperateGhostMode, setCanOperateGhostMode] = useState(false);
  const [maintenancePanelAccess, setMaintenancePanelAccess] = useState<Record<string, boolean>>(
    {}
  );
  const [totemSchemaReady, setTotemSchemaReady] = useState(isTotemAtivoColumnAvailable());
  const [quorumSchemaReady, setQuorumSchemaReady] = useState(isRequerQuorumColumnAvailable());
  const [somenteMembrosSchemaReady, setSomenteMembrosSchemaReady] = useState(
    isSomenteMembrosColumnAvailable()
  );
  const [geofenceSchemaReady, setGeofenceSchemaReady] = useState(isGeofenceAtivoColumnAvailable());
  const [quorumRegistrySchemaMissing, setQuorumRegistrySchemaMissing] = useState(
    !isQuorumRegistryTableAvailable()
  );
  const schemaProbeDoneRef = useRef(false);

  const isBusy = isSaving || isDeleting || isReplicatingSeven;

  const isCreating = selectedEventId === '__new__';
  const isEventDateInPast = useMemo(
    () => isMaintenanceEventFormDateInPast(form),
    [form]
  );

  const editorQuorumEventId =
    selectedEventId !== null && form.requerQuorum && !isCreating ? selectedEventId : undefined;

  const {
    rows: quorumRegistryRows,
    loading: isQuorumRegistryLoading,
    isRefreshing: isQuorumRegistryRefreshing,
    error: quorumRegistryError,
  } = useQuorumRegistry(editorQuorumEventId, {
    pollMs: 15000,
    enabled: Boolean(editorQuorumEventId) && !quorumRegistrySchemaMissing,
  });

  const patchForm = useCallback((patch: Partial<MaintenanceEventFormState>) => {
    setForm((current) => ({ ...current, ...patch }));
  }, []);

  const cancelDeleteConfirm = useCallback(() => {
    setDeleteConfirmPending(false);
    setDeleteTargetId(null);
    setDeleteTargetName('');
  }, []);

  const startNewEvent = useCallback(() => {
    setStatusMessage(null);
    cancelDeleteConfirm();
    setSelectedEventId('__new__');
    setForm(emptyMaintenanceEventForm());
  }, [cancelDeleteConfirm]);

  const startEditEvent = useCallback((event: MaintenanceEvent) => {
    setStatusMessage(null);
    cancelDeleteConfirm();
    setSelectedEventId(event.id);
    setForm(formFromMaintenanceEvent(event));
  }, [cancelDeleteConfirm]);

  const closeEditor = useCallback(() => {
    setStatusMessage(null);
    cancelDeleteConfirm();
    setSelectedEventId(null);
    setForm(emptyMaintenanceEventForm());
  }, [cancelDeleteConfirm]);

  const beginDeleteConfirm = useCallback(() => {
    if (!selectedEventId || selectedEventId === '__new__') {
      return;
    }

    const eventFromList = safeEvents.find((event) => event.id === selectedEventId);
    setDeleteTargetId(selectedEventId);
    setDeleteTargetName(form.name.trim() || eventFromList?.name || 'este evento');
    setDeleteConfirmPending(true);
    setStatusMessage(null);
  }, [form.name, safeEvents, selectedEventId]);

  useEffect(() => {
    if (!loading) {
      setTotemSchemaReady(isTotemAtivoColumnAvailable());
      setQuorumSchemaReady(isRequerQuorumColumnAvailable());
      setSomenteMembrosSchemaReady(isSomenteMembrosColumnAvailable());
      setGeofenceSchemaReady(isGeofenceAtivoColumnAvailable());
    }
  }, [loading, safeEvents.length]);

  useFocusEffect(
    useCallback(() => {
      let active = true;

      if (!schemaProbeDoneRef.current) {
        schemaProbeDoneRef.current = true;

        void ensureEventsOptionalColumns().then(({ totem, quorum, somenteMembros, geofenceAtivo }) => {
          if (active) {
            setTotemSchemaReady(totem);
            setQuorumSchemaReady(quorum);
            setSomenteMembrosSchemaReady(somenteMembros);
            setGeofenceSchemaReady(geofenceAtivo);
          }
        });

        void ensureEventQuorumRegistry().then((ready) => {
          if (active) {
            setQuorumRegistrySchemaMissing(!ready);
          }
        });
      }

      void (async () => {
        setAccessState((current) => (current === 'allowed' ? current : 'checking'));
        const snapshot = await loadMaintenanceDashboardAccess({ forceRefresh: ghostModeActive });

        if (!active) {
          return;
        }

        if (!snapshot.allowed) {
          setAccessState('denied');
          const { denyScreenAccessAndRedirect } = await import('@/lib/screenAccessDenyRedirect');
          denyScreenAccessAndRedirect(
            router,
            MEMBER_HOME_PATH,
            'Sem permissão',
            'Você não tem acesso à manutenção do sistema.'
          );
          return;
        }

        setCanManageAccessControl(snapshot.isSuperAdmin);
        setCanAccessAccessControlCard(snapshot.canOpenAccessControlCard);
        setCanMonitorFamilyReception(snapshot.canMonitorFamilyReception);
        setCanAccessProfileCadastro(snapshot.canAccessProfileCadastro);
        setCanUpdateMaintenanceEvents(snapshot.canUpdateMaintenanceEvents);
        setCanBypassEventPastDateLock(snapshot.canBypassEventPastDateLock);
        setMaintenancePanelAccess(snapshot.maintenancePanelAccess);
        setScalePanelAccess(snapshot.scalePanelAccess);
        setCanAccessPastoralCare(snapshot.canAccessPastoralCare);
        setCanAccessPastoralRoleChange(snapshot.canAccessPastoralRoleChange);
        setCanOperateGhostMode(snapshot.canOperateGhostMode);

        if (snapshot.headerUserName) {
          setHeaderUserName(snapshot.headerUserName);
        }

        setAccessState('allowed');
      })();

      return () => {
        active = false;
      };
    }, [ghostModeActive, router])
  );

  const handleSave = useCallback(async () => {
    if (isSaving) {
      return;
    }

    Keyboard.dismiss();
    setStatusMessage(null);

    const validation = validateMaintenanceEventForm(form, {
      bypassPastDateRestriction: canBypassEventPastDateLock,
    });
    if (!validation.ok) {
      setStatusMessage(validation.message);
      Toast.show({
        type: 'error',
        text1: 'Revise o formulário',
        text2: validation.message,
        visibilityTime: 5000,
      });
      return;
    }

    setIsSaving(true);

    try {
      const columnSupport = await ensureEventsOptionalColumns();
      setGeofenceSchemaReady(columnSupport.geofenceAtivo);

      const result = await saveMaintenanceEvent(selectedEventId, validation.payload);

      if (!result.ok) {
        const message = getSaveErrorMessage({ message: result.message, code: result.code });
        setStatusMessage(message);
        Toast.show({
          type: 'error',
          text1: 'Erro ao salvar',
          text2: message,
          visibilityTime: 6000,
        });
        return;
      }

      await refetch();
      const wasCreating = selectedEventId === '__new__';
      closeEditor();
      const purgedCount = result.purgedCheckins ?? 0;
      Toast.show({
        type: 'success',
        text1: wasCreating ? 'Evento criado' : 'Evento atualizado',
        text2:
          result.purgeWarning
            ? result.purgeWarning
            : purgedCount > 0
              ? `${purgedCount} check-in(s) removido(s) — famílias precisam validar novamente.`
              : 'Alterações gravadas com sucesso.',
        visibilityTime: result.purgeWarning ? 8000 : 4000,
      });
    } catch (saveError) {
      console.error('Erro ao salvar evento:', saveError);
      const message = getSaveErrorMessage(saveError);
      setStatusMessage(message);
      Toast.show({
        type: 'error',
        text1: 'Erro ao salvar',
        text2: message,
        visibilityTime: 6000,
      });
    } finally {
      setIsSaving(false);
    }
  }, [canBypassEventPastDateLock, closeEditor, form, isSaving, refetch, selectedEventId]);

  const handleReplicateSevenDays = useCallback(async () => {
    if (isCreating || !selectedEventId) {
      return;
    }

    const sourceEvent = safeEvents.find((event) => event.id === selectedEventId);

    if (!sourceEvent) {
      Toast.show({
        type: 'error',
        text1: 'Replicar evento',
        text2: 'Evento não encontrado. Atualize a lista e tente novamente.',
        visibilityTime: 5000,
      });
      return;
    }

    const confirmed = await confirmDialog(
      'Replicar evento (+7)',
      'Criar 1 cópia para daqui a 7 dias com o mesmo horário, local, capacidade, salas e recursos? Apenas a data muda e a cópia ficará como rascunho.',
      'Criar cópia',
      'Cancelar'
    );

    if (!confirmed) {
      return;
    }

    Keyboard.dismiss();
    setStatusMessage(null);
    setIsReplicatingSeven(true);

    try {
      const result = await replicateMaintenanceEventFromRecord(sourceEvent, 7);

      if (!result.ok) {
        const message = getSaveErrorMessage({ message: result.message, code: result.code });
        setStatusMessage(message);
        Toast.show({
          type: 'error',
          text1: 'Erro ao replicar',
          text2: message,
          visibilityTime: 6000,
        });
        return;
      }

      await refetch();
      if (result.newEventId) {
        setSelectedEventId(result.newEventId);
      }
      Toast.show({
        type: 'success',
        text1: 'Evento replicado',
        text2: '1 rascunho criado para daqui a 7 dias.',
      });
    } catch (replicateError) {
      console.error('Erro ao replicar evento:', replicateError);
      const message = getSaveErrorMessage(replicateError);
      setStatusMessage(message);
      Toast.show({
        type: 'error',
        text1: 'Erro ao replicar',
        text2: message,
        visibilityTime: 6000,
      });
    } finally {
      setIsReplicatingSeven(false);
    }
  }, [isCreating, refetch, safeEvents, selectedEventId]);

  const performDelete = useCallback(async () => {
    const eventId = deleteTargetId;
    if (!eventId) {
      return;
    }

    Keyboard.dismiss();
    setStatusMessage(null);
    setIsDeleting(true);

    try {
      const result = await deleteMaintenanceEvent(eventId);

      if (!result.ok) {
        const message = getSaveErrorMessage({ message: result.message, code: result.code });
        setStatusMessage(message);
        Toast.show({
          type: 'error',
          text1: 'Erro ao apagar',
          text2: message,
          visibilityTime: 6000,
        });
        return;
      }

      await refetch();
      cancelDeleteConfirm();
      closeEditor();
      Toast.show({
        type: 'success',
        text1: 'Evento apagado',
        text2: `"${deleteTargetName}" foi removido.`,
      });
    } catch (deleteError) {
      console.error('Erro ao apagar evento:', deleteError);
      const message = getSaveErrorMessage(deleteError);
      setStatusMessage(message);
      Toast.show({
        type: 'error',
        text1: 'Erro ao apagar',
        text2: message,
        visibilityTime: 6000,
      });
    } finally {
      setIsDeleting(false);
    }
  }, [cancelDeleteConfirm, closeEditor, deleteTargetId, deleteTargetName, refetch]);

  const showEditor = selectedEventId !== null;

  useEffect(() => {
    if (!showEditor) {
      return;
    }

    let cancelled = false;
    void listChurchRoomSettings({ forceRefresh: true })
      .then((rows) => {
        if (!cancelled) {
          setEventRoomOptions(
            rows.filter((row) => row.is_enabled && row.room_kind !== 'especial')
          );
        }
      })
      .catch((error) => {
        console.warn('listChurchRoomSettings (evento):', error);
        if (!cancelled) {
          setEventRoomOptions(DEFAULT_CHURCH_ROOM_SETTINGS);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [showEditor]);

  const {
    locations: favoriteLocations,
    loading: favoriteLocationsLoading,
    saving: favoriteLocationsSaving,
    deletingId: favoriteLocationDeletingId,
    schemaMissing: favoriteLocationsSchemaMissing,
    cepColumnMissing: favoriteLocationsCepColumnMissing,
    error: favoriteLocationsError,
    reload: reloadFavoriteLocations,
    saveLocation: saveFavoriteLocation,
    removeLocation: removeFavoriteLocation,
  } = useEventFavoriteLocations(showEditor);

  const applyFavoriteLocation = useCallback(
    (location: EventFavoriteLocation) => {
      setStatusMessage(null);
      patchForm({
        eventLocal: location.name,
        eventLocalAddress: location.address,
        maxCapacity: String(location.capacity),
      });
      setFavoritePickerVisible(false);
    },
    [patchForm]
  );

  const maintenancePanelCards = useMemo(() => {
    return MAINTENANCE_PANEL_CARDS.filter((card) => {
      if (card.content === 'access_control') {
        return canAccessAccessControlCard;
      }

      if (
        card.content === 'scale_types'
        || card.content === 'scale_volunteers'
        || card.content === 'scales'
      ) {
        return scalePanelAccess[card.content] === true;
      }

      if (card.content === 'pastoral_care') {
        return canAccessPastoralCare;
      }

      if (card.content === 'discipleship_alerts' || card.content === 'discipleship_themes') {
        return canAccessPastoralCare || maintenancePanelAccess[card.content] === true;
      }

      if (card.content === 'discipleship_reset') {
        return canManageAccessControl || maintenancePanelAccess[card.content] === true;
      }

      if (card.content === 'mudanca_papeis') {
        return canAccessPastoralRoleChange || canManageAccessControl;
      }

      if (card.content === 'transferencia_igreja') {
        return (
          canAccessPastoralRoleChange
          || canManageAccessControl
          || maintenancePanelAccess[card.content] === true
        );
      }

      if (card.content === 'profile_access_insights') {
        return canManageAccessControl || maintenancePanelAccess[card.content] === true;
      }

      if (card.content === 'auditor') {
        return canOperateGhostMode;
      }

      if (card.content === 'profile_cadastro' || card.content === 'family_reception') {
        return canAccessProfileCadastro;
      }

      if (card.content === 'visitor_followup') {
        return canAccessProfileCadastro || maintenancePanelAccess[card.content] === true;
      }

      return maintenancePanelAccess[card.content] === true;
    });
  }, [
    canAccessAccessControlCard,
    canAccessPastoralCare,
    canAccessPastoralRoleChange,
    canAccessProfileCadastro,
    canOperateGhostMode,
    canManageAccessControl,
    maintenancePanelAccess,
    scalePanelAccess,
  ]);

  const maintenanceCarouselCards = useMemo<MaintenanceCarouselCard[]>(
    () => {
      const cards = [{ id: 'menu', title: 'Manutenção', content: 'menu' as const }, ...maintenancePanelCards];

      if (!isMinimalPresentation) {
        return cards;
      }

      if (requestedPanel) {
        const match = maintenancePanelCards.find((card) => card.content === requestedPanel);

        if (match) {
          return [match];
        }
      }

      return maintenancePanelCards.length ? [maintenancePanelCards[0]!] : [];
    },
    [isMinimalPresentation, maintenancePanelCards, requestedPanel]
  );

  const maintenanceCardCount = maintenanceCarouselCards.length;

  const maintenanceShortcuts = useMemo<MaintenanceShortcut[]>(
    () =>
      maintenancePanelCards.map((card) => ({
        id: card.id,
        label: card.title,
        content: card.content as MaintenancePanelContent,
      })),
    [maintenancePanelCards]
  );

  const activeMaintenancePanelContent = maintenanceCarouselCards[currentIndex]?.content ?? null;

  useFamilyReceptionSuperAdminNotifier(
    accessState === 'allowed'
    && canMonitorFamilyReception
    && activeMaintenancePanelContent !== 'family_reception'
  );

  const activeMaintenanceScreenTitle = useMemo(() => {
    if (showEditor) {
      return isCreating ? 'Novo evento' : 'Editar evento';
    }

    return maintenanceCarouselCards[currentIndex]?.title?.trim() ?? '';
  }, [currentIndex, isCreating, maintenanceCarouselCards, showEditor]);

  const { showTechnicalKeys } = useShowAclTechnicalKeys(accessState === 'allowed');

  const activeMaintenanceScreenTechnicalKey = useMemo(() => {
    if (showEditor) {
      return resolveMaintenancePanelAccessResourceKey('events', { inEventEditor: true });
    }

    const content = maintenanceCarouselCards[currentIndex]?.content;
    return resolveMaintenancePanelAccessResourceKey(content);
  }, [currentIndex, maintenanceCarouselCards, showEditor]);

  useEffect(() => {
    if (showEditor) {
      const screenKey =
        resolveMaintenancePanelAccessResourceKey('events', { inEventEditor: true })
        ?? 'maintenance.card.events';

      void recordProfileScreenVisit(screenKey, isCreating ? 'Novo evento' : 'Editar evento');
      return;
    }

    const card = maintenanceCarouselCards[currentIndex];

    if (!card?.content || card.content === 'menu') {
      return;
    }

    const screenKey =
      resolveMaintenancePanelAccessResourceKey(card.content) ?? `maintenance.card.${card.content}`;

    void recordProfileScreenVisit(screenKey, card.title);
  }, [currentIndex, isCreating, maintenanceCarouselCards, showEditor]);

  const cardHeight = useMemo(
    () => computeDashboardCardHeight(windowHeight, insets.top, insets.bottom),
    [insets.bottom, insets.top, windowHeight]
  );

  const panelCardSizeStyle = useMemo(
    () => buildDashboardPanelCardSizeStyle(pageWidth, cardHeight),
    [cardHeight, pageWidth]
  );

  const effectiveCarouselPageStyle = useMemo(
    () => ({
      width: carouselPageWidth,
      maxWidth: carouselPageWidth,
      minWidth: 0,
      overflow: 'hidden' as const,
      // Em modo minimal a página precisa preencher a altura do estágio;
      // flexGrow:0 colapsava o conteúdo para tela em branco.
      ...(isMinimalPresentation
        ? {
            flex: 1,
            alignSelf: 'stretch' as const,
            ...(measuredCarouselHeight > 0
              ? {
                  height: measuredCarouselHeight,
                  maxHeight: measuredCarouselHeight,
                }
              : null),
          }
        : { flexBasis: carouselPageWidth }),
    }),
    [carouselPageWidth, isMinimalPresentation, measuredCarouselHeight]
  );

  const effectiveCardWrapperStyle = useMemo(
    () =>
      isMinimalPresentation
        ? {
            ...MINIMAL_PAGE,
            paddingTop: 0,
            paddingBottom: 0,
            justifyContent: 'flex-start' as const,
          }
        : styles.cardWrapper,
    [isMinimalPresentation]
  );

  const effectivePanelCardStyle = useMemo(
    () =>
      isMinimalPresentation
        ? {
            ...MINIMAL_FLAT_PANEL,
            flex: 1,
          }
        : null,
    [isMinimalPresentation]
  );

  const effectivePanelScrollContentStyle = useMemo(
    () =>
      isMinimalPresentation
        ? {
            gap: UI_SPACING.md,
            paddingBottom: UI_SPACING.lg,
            paddingHorizontal: 0,
            width: '100%' as const,
            maxWidth: '100%' as const,
          }
        : styles.panelScrollContent,
    [isMinimalPresentation]
  );

  const scrollToMaintenanceCard = useCallback((targetIndex: number, animated = false) => {
    if (targetIndex < 0 || targetIndex >= maintenanceCardCount || carouselPageWidth <= 0) {
      return;
    }

    carouselScrollSyncLockRef.current = true;
    currentIndexRef.current = targetIndex;
    setCurrentIndex(targetIndex);

    const list = carouselRef.current;
    if (!list) {
      carouselScrollSyncLockRef.current = false;
      return;
    }

    const offset = targetIndex * carouselPageWidth;

    list.scrollToOffset({ offset, animated: false });
    requestAnimationFrame(() => {
      list.scrollToIndex({ index: targetIndex, animated, viewPosition: 0 });
      list.scrollToOffset({ offset, animated: false });
      requestAnimationFrame(() => {
        carouselScrollSyncLockRef.current = false;
      });
    });
  }, [carouselPageWidth, maintenanceCardCount]);

  const scrollToMaintenancePanel = useCallback(
    (panelContent: MaintenancePanelContent) => {
      const targetIndex = resolveMaintenancePanelIndex(maintenanceCarouselCards, panelContent);

      if (targetIndex < 0) {
        pendingMaintenancePanelRef.current = panelContent;
        return;
      }

      pendingMaintenancePanelRef.current = null;
      scrollToMaintenanceCard(targetIndex, false);
    },
    [maintenanceCarouselCards, scrollToMaintenanceCard]
  );

  useEffect(() => {
    if (!requestedPanel || accessState !== 'allowed') {
      return;
    }

    scrollToMaintenancePanel(requestedPanel as MaintenancePanelContent);
  }, [accessState, requestedPanel, scrollToMaintenancePanel]);

  useEffect(() => {
    if (currentIndex < maintenanceCardCount) {
      return;
    }

    const nextIndex = Math.max(maintenanceCardCount - 1, 0);
    scrollToMaintenanceCard(nextIndex, false);
  }, [currentIndex, maintenanceCardCount, scrollToMaintenanceCard]);

  useEffect(() => {
    const content = maintenanceCarouselCards[currentIndex]?.content;

    if (content) {
      activeMaintenanceContentRef.current = content;
    }
  }, [currentIndex, maintenanceCarouselCards]);

  useEffect(() => {
    const pending = pendingMaintenancePanelRef.current;

    if (pending) {
      const targetIndex = resolveMaintenancePanelIndex(maintenanceCarouselCards, pending);

      if (targetIndex >= 0) {
        pendingMaintenancePanelRef.current = null;

        requestAnimationFrame(() => {
          scrollToMaintenanceCard(targetIndex, false);
        });
      }

      previousMaintenanceCardCountRef.current = maintenanceCardCount;
      return;
    }

    if (showEditor || maintenanceCardCount === 0) {
      previousMaintenanceCardCountRef.current = maintenanceCardCount;
      return;
    }

    if (maintenanceCardCount === previousMaintenanceCardCountRef.current) {
      return;
    }

    previousMaintenanceCardCountRef.current = maintenanceCardCount;

    if (maintenanceCarouselCards[currentIndexRef.current]?.content === 'menu') {
      return;
    }

    const content = activeMaintenanceContentRef.current;
    const targetIndex = resolveCarouselIndexByContent(maintenanceCarouselCards, content);
    const resolvedIndex =
      targetIndex >= 0
        ? targetIndex
        : Math.min(Math.max(currentIndexRef.current, 0), maintenanceCardCount - 1);

    if (resolvedIndex !== currentIndexRef.current) {
      requestAnimationFrame(() => {
        scrollToMaintenanceCard(resolvedIndex, false);
      });
    }
  }, [maintenanceCardCount, maintenanceCarouselCards, scrollToMaintenanceCard, showEditor]);

  const handleCarouselScrollToIndexFailed = useCallback(
    (info: { index: number }) => {
      if (info.index < 0 || info.index >= maintenanceCardCount || carouselPageWidth <= 0) {
        return;
      }

      carouselRef.current?.scrollToOffset({
        offset: info.index * carouselPageWidth,
        animated: false,
      });
      requestAnimationFrame(() => {
        carouselRef.current?.scrollToIndex({
          index: info.index,
          animated: false,
          viewPosition: 0,
        });
      });
    },
    [carouselPageWidth, maintenanceCardCount]
  );

  useEffect(() => {
    currentIndexRef.current = currentIndex;
  }, [currentIndex]);

  useEffect(() => {
    if (previousPageWidthRef.current === pageWidth) {
      return;
    }

    previousPageWidthRef.current = pageWidth;
    setMeasuredCarouselWidth(0);
    const index = currentIndexRef.current;
    requestAnimationFrame(() => {
      scrollToMaintenanceCard(index, false);
    });
  }, [pageWidth, scrollToMaintenanceCard]);

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

      if (targetIndex < 0 || targetIndex >= maintenanceCardCount) {
        stopFooterNavRepeat();
        return;
      }

      scrollToMaintenanceCard(targetIndex, false);
    },
    [maintenanceCardCount, scrollToMaintenanceCard, stopFooterNavRepeat]
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

  const handleMenu = useCallback(() => {
    router.replace('/(tabs)');
  }, [router]);

  const handleBack = useCallback(() => {
    scrollToMaintenanceCard(0);
  }, [scrollToMaintenanceCard]);

  const handleCarouselScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (carouselScrollSyncLockRef.current) {
        return;
      }

      const index = Math.round(event.nativeEvent.contentOffset.x / carouselPageWidth);
      if (index >= 0 && index < maintenanceCardCount && index !== currentIndexRef.current) {
        currentIndexRef.current = index;
        setCurrentIndex(index);
      }
    },
    [carouselPageWidth, maintenanceCardCount]
  );

  const handleGanttEventPress = useCallback(
    (eventId: string) => {
      const event = safeEvents.find((entry) => entry.id === eventId);
      if (!event) {
        return;
      }

      startEditEvent(event);
    },
    [safeEvents, startEditEvent]
  );

  const roomLabelByKey = useMemo(() => {
    const labels: Record<string, string> = {};
    for (const room of eventRoomOptions) {
      labels[room.room_key] = room.display_label;
    }
    return labels;
  }, [eventRoomOptions]);

  const renderCarouselItem = useCallback(
    ({ item, index }: { item: MaintenanceCarouselCard; index: number }) => {
      const shouldMountPanel = Math.abs(currentIndex - index) <= 1;

      return (
      <View style={[effectiveCardWrapperStyle, effectiveCarouselPageStyle]}>
        <View
          style={[
            isMinimalPresentation ? effectivePanelCardStyle : styles.panelCard,
            !isMinimalPresentation && panelCardSizeStyle,
            !isMinimalPresentation && styles.panelCardLight,
            !isMinimalPresentation && item.content === 'quorum_presence' && styles.panelCardInnerPadding,
            !isMinimalPresentation && item.content === 'scale_types' && styles.panelCardInnerPadding,
            !isMinimalPresentation && item.content === 'scale_volunteers' && styles.panelCardInnerPadding,
            !isMinimalPresentation && item.content === 'scales' && styles.panelCardInnerPadding,
            !isMinimalPresentation && item.content === 'pastoral_care' && styles.panelCardInnerPadding,
            !isMinimalPresentation && item.content === 'small_groups_management' && styles.panelCardInnerPadding,
            !isMinimalPresentation && item.content === 'campaigns_management' && styles.panelCardInnerPadding,
            !isMinimalPresentation && item.content === 'volunteer_mural' && styles.panelCardInnerPadding,
            !isMinimalPresentation && item.content === 'mudanca_papeis' && styles.panelCardInnerPadding,
            !isMinimalPresentation && item.content === 'transferencia_igreja' && styles.panelCardInnerPadding,
            !isMinimalPresentation && item.content === 'profile_cadastro' && styles.panelCardInnerPadding,
            !isMinimalPresentation && item.content === 'family_reception' && styles.panelCardInnerPadding,
            !isMinimalPresentation && item.content === 'visitor_followup' && styles.panelCardInnerPadding,
            !isMinimalPresentation && item.content === 'financials' && styles.panelCardInnerPadding,
            !isMinimalPresentation && item.content === 'predictive_insights' && styles.panelCardInnerPadding,
            !isMinimalPresentation && item.content === 'relatorios' && styles.panelCardInnerPadding,
            !isMinimalPresentation && item.content === 'suggestions_improvements' && styles.panelCardInnerPadding,
            !isMinimalPresentation && item.content === 'access_control' && styles.panelCardInnerPadding,
            !isMinimalPresentation && item.content === 'profile_access_insights' && styles.panelCardInnerPadding,
            !isMinimalPresentation && item.content === 'auditor' && styles.panelCardInnerPadding,
            !isMinimalPresentation && item.content === 'event_orchestration' && styles.panelCardInnerPadding,
            !isMinimalPresentation && item.content === 'menu' && styles.panelCardMenu,
          ]}
        >
          {!shouldMountPanel ? (
            <View style={[styles.panelCardPlaceholder, { minHeight: cardHeight }]} />
          ) : item.content === 'menu' ? (
            <View style={styles.menuPanel}>
              <Text style={styles.menuPanelTitle}>Módulos de manutenção</Text>
              <View style={styles.menuPanelSubtitleSpacer} />
              <ScrollView
                style={styles.menuShortcutsScroll}
                contentContainerStyle={styles.menuShortcutsArea}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              >
                {maintenanceShortcuts.map((shortcut) => {
                  const isActiveShortcut = activeMaintenancePanelContent === shortcut.content;
                  const isShortcutDisabled =
                    shortcut.content === 'quorum_presence' && !quorumPresenceShortcutEnabled;
                  const iconName = MAINTENANCE_SHORTCUT_ICONS[shortcut.content];
                  const iconColor = isShortcutDisabled
                    ? '#64748B'
                    : isActiveShortcut
                      ? MAINTENANCE_SHORTCUT_ICON_ACTIVE_COLOR
                      : MAINTENANCE_SHORTCUT_ICON_COLORS[shortcut.content];

                  return (
                    <TouchableOpacity
                      key={shortcut.id}
                      style={[
                        styles.menuShortcutButton,
                        isActiveShortcut && !isShortcutDisabled && styles.menuShortcutButtonActive,
                        isShortcutDisabled && styles.menuShortcutButtonDisabled,
                      ]}
                      onPress={() => {
                        if (isShortcutDisabled) {
                          return;
                        }

                        scrollToMaintenancePanel(shortcut.content);
                      }}
                      activeOpacity={isShortcutDisabled ? 1 : 0.9}
                      disabled={isShortcutDisabled}
                      hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
                      accessibilityRole="button"
                      accessibilityState={{ disabled: isShortcutDisabled }}
                      accessibilityLabel={
                        isShortcutDisabled
                          ? `${shortcut.label} indisponível: nenhum evento com quórum`
                          : `Abrir ${shortcut.label}`
                      }
                    >
                      <View style={styles.menuShortcutRow}>
                        <FontAwesome
                          name={iconName}
                          size={16}
                          color={iconColor}
                          style={styles.menuShortcutIcon}
                        />
                        <Text
                          style={[
                            styles.menuShortcutButtonText,
                            isActiveShortcut && !isShortcutDisabled && styles.menuShortcutButtonTextActive,
                            isShortcutDisabled && styles.menuShortcutButtonTextDisabled,
                          ]}
                          numberOfLines={2}
                        >
                          {shortcut.label}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          ) : item.content === 'quorum_presence' ? (
            <MaintenanceQuorumPresenceCard
              events={safeEvents}
              loadingEvents={loading}
              schemaMissing={quorumRegistrySchemaMissing}
              isActive={currentIndex === index}
              panelHeight={cardHeight}
              minimal={isMinimalPresentation}
            />
          ) : item.content === 'scale_types' ? (
            <View
              style={[
                styles.scaleTypesPanel,
                isMinimalPresentation && styles.scaleTypesPanelMinimal,
              ]}
            >
              <MaintenanceScaleTypesCard
                isActive={currentIndex === index}
                panelHeight={cardHeight}
                minimal={isMinimalPresentation}
              />
            </View>
          ) : item.content === 'scale_volunteers' ? (
            <View
              style={[
                styles.scaleVolunteersPanel,
                isMinimalPresentation && styles.scaleVolunteersPanelMinimal,
              ]}
            >
              <MaintenanceScaleVolunteersCard
                isActive={currentIndex === index}
                panelHeight={cardHeight}
                minimal={isMinimalPresentation}
              />
            </View>
          ) : item.content === 'scales' ? (
            <View
              style={[
                styles.scalesPanel,
                isMinimalPresentation && styles.scalesPanelMinimal,
              ]}
            >
              <MaintenanceScalesCard
                isActive={currentIndex === index}
                panelHeight={cardHeight}
                minimal={isMinimalPresentation}
              />
            </View>
          ) : item.content === 'pastoral_care' ? (
            <View
              style={[
                styles.pastoralCarePanel,
                isMinimalPresentation && styles.pastoralCarePanelMinimal,
              ]}
            >
              <MaintenancePastoralCareCard
                isActive={currentIndex === index}
                panelHeight={cardHeight}
                minimal={isMinimalPresentation}
              />
            </View>
          ) : item.content === 'small_groups_management' ? (
            <View
              style={[
                styles.pastoralCarePanel,
                isMinimalPresentation && styles.pastoralCarePanelMinimal,
              ]}
            >
              <MaintenanceSmallGroupsCard
                isActive={currentIndex === index}
                panelHeight={cardHeight}
                minimal={isMinimalPresentation}
              />
            </View>
          ) : item.content === 'campaigns_management' ? (
            <View
              style={[
                styles.pastoralCarePanel,
                isMinimalPresentation && styles.pastoralCarePanelMinimal,
              ]}
            >
              <MaintenanceCampaignsCard
                isActive={currentIndex === index}
                panelHeight={cardHeight}
                minimal={isMinimalPresentation}
              />
            </View>
          ) : item.content === 'volunteer_mural' ? (
            <View
              style={[
                styles.pastoralCarePanel,
                isMinimalPresentation && styles.pastoralCarePanelMinimal,
              ]}
            >
              <MaintenanceVolunteerMuralCard
                isActive={currentIndex === index}
                panelHeight={cardHeight}
                minimal={isMinimalPresentation}
              />
            </View>
          ) : item.content === 'discipleship_themes' ? (
            <View
              style={[
                styles.pastoralCarePanel,
                isMinimalPresentation && styles.pastoralCarePanelMinimal,
              ]}
            >
              <MaintenanceDiscipleshipThemesCard
                isActive={currentIndex === index}
                panelHeight={cardHeight}
                minimal={isMinimalPresentation}
              />
            </View>
          ) : item.content === 'discipleship_alerts' ? (
            <View
              style={[
                styles.pastoralCarePanel,
                isMinimalPresentation && styles.pastoralCarePanelMinimal,
              ]}
            >
              <MaintenanceDiscipleshipAlertsCard
                isActive={currentIndex === index}
                panelHeight={cardHeight}
                minimal={isMinimalPresentation}
              />
            </View>
          ) : item.content === 'discipleship_reset' ? (
            <View
              style={[
                styles.pastoralCarePanel,
                isMinimalPresentation && styles.pastoralCarePanelMinimal,
              ]}
            >
              <MaintenanceDiscipleshipResetCard
                isActive={currentIndex === index}
                panelHeight={cardHeight}
                minimal={isMinimalPresentation}
              />
            </View>
          ) : item.content === 'mudanca_papeis' ? (
            <View
              style={[
                styles.pastoralRoleChangePanel,
                isMinimalPresentation && styles.pastoralRoleChangePanelMinimal,
              ]}
            >
              <MaintenancePastoralRoleChangeCard
                isActive={currentIndex === index}
                panelHeight={cardHeight}
                minimal={isMinimalPresentation}
              />
            </View>
          ) : item.content === 'transferencia_igreja' ? (
            <View
              style={[
                styles.pastoralRoleChangePanel,
                isMinimalPresentation && styles.pastoralRoleChangePanelMinimal,
              ]}
            >
              <MaintenanceIgrejaTransferCard
                isActive={currentIndex === index}
                panelHeight={cardHeight}
                minimal={isMinimalPresentation}
              />
            </View>
          ) : item.content === 'profile_cadastro' ? (
            <View
              style={[
                styles.profileCadastroPanel,
                isMinimalPresentation && styles.profileCadastroPanelMinimal,
              ]}
            >
              <MaintenanceProfileCadastroCard
                isActive={currentIndex === index}
                panelHeight={cardHeight}
                minimal={isMinimalPresentation}
              />
            </View>
          ) : item.content === 'family_reception' ? (
            <View
              style={[
                styles.familyReceptionPanel,
                isMinimalPresentation && styles.familyReceptionPanelMinimal,
              ]}
            >
              <MaintenanceFamilyReceptionCard
                isActive={currentIndex === index}
                panelHeight={cardHeight}
                minimal={isMinimalPresentation}
              />
            </View>
          ) : item.content === 'visitor_followup' ? (
            <View
              style={[
                styles.familyReceptionPanel,
                isMinimalPresentation && styles.familyReceptionPanelMinimal,
              ]}
            >
              <MaintenanceVisitorFollowupCard
                isActive={currentIndex === index}
                panelHeight={cardHeight}
                minimal={isMinimalPresentation}
              />
            </View>
          ) : item.content === 'financials' ? (
            <View
              style={[
                styles.financialsPanel,
                isMinimalPresentation && styles.financialsPanelMinimal,
              ]}
            >
              <MaintenanceFinancialsCard
                isActive={currentIndex === index}
                panelHeight={cardHeight}
                minimal={isMinimalPresentation}
              />
            </View>
          ) : item.content === 'predictive_insights' ? (
            <View
              style={[
                styles.predictivePanel,
                isMinimalPresentation && styles.predictivePanelMinimal,
              ]}
            >
              <MaintenancePredictiveInsightsCard
                isActive={currentIndex === index}
                panelHeight={cardHeight}
                minimal={isMinimalPresentation}
              />
            </View>
          ) : item.content === 'relatorios' ? (
            <View
              style={[
                styles.reportsPanel,
                isMinimalPresentation && styles.reportsPanelMinimal,
              ]}
            >
              <MaintenanceReportsCard
                isActive={currentIndex === index}
                panelHeight={cardHeight}
                events={safeEvents}
                loadingEvents={loading}
                isSuperAdmin={canManageAccessControl}
                minimal={isMinimalPresentation}
              />
            </View>
          ) : item.content === 'suggestions_improvements' ? (
            <MaintenanceSupportSuggestionsCard
              isActive={currentIndex === index}
              panelHeight={cardHeight}
              isSuperAdmin={canManageAccessControl}
              variant="vigilance"
            />
          ) : item.content === 'access_control' ? (
            <View
              style={[
                styles.accessControlPanel,
                isMinimalPresentation && styles.accessControlPanelMinimal,
              ]}
            >
              <MaintenanceAccessControlCard
                isActive={currentIndex === index}
                panelHeight={cardHeight}
                minimal={isMinimalPresentation}
              />
            </View>
          ) : item.content === 'profile_access_insights' ? (
            <View
              style={[
                styles.profileAccessInsightsPanel,
                isMinimalPresentation && styles.profileAccessInsightsPanelMinimal,
              ]}
            >
              <MaintenanceProfileAccessInsightsCard
                isActive={currentIndex === index}
                panelHeight={cardHeight}
                minimal={isMinimalPresentation}
              />
            </View>
          ) : item.content === 'auditor' ? (
            <View
              style={[
                styles.ghostModePanel,
                isMinimalPresentation && styles.ghostModePanelMinimal,
              ]}
            >
              <MaintenanceGhostModeCard
                isActive={currentIndex === index}
                panelHeight={cardHeight}
                minimal={isMinimalPresentation}
              />
            </View>
          ) : item.content === 'event_orchestration' ? (
            <View
              style={[
                styles.orchestrationPanel,
                isMinimalPresentation && styles.orchestrationPanelMinimal,
              ]}
            >
              <MaintenanceEventOrchestrationCard
                isActive={currentIndex === index}
                panelHeight={cardHeight}
                minimal={isMinimalPresentation}
              />
            </View>
          ) : item.content === 'sala_servidor' ? (
            <View
              style={[
                styles.salaServidorPanel,
                isMinimalPresentation && styles.salaServidorPanelMinimal,
              ]}
            >
              <MaintenanceSalaServidorCard
                embedded={!isMinimalPresentation}
                panelHeight={cardHeight}
                minimal={isMinimalPresentation}
              />
            </View>
          ) : item.content === 'events_gantt' ? (
            <View style={[styles.ganttPanel, isMinimalPresentation && styles.ganttPanelMinimal]}>
              <Text
                style={[
                  styles.eventsScreenTitle,
                  isMinimalPresentation && styles.eventsScreenTitleMinimal,
                ]}
              >
                {item.title}
              </Text>
              {!isMinimalPresentation ? <View style={styles.ganttPanelSubtitleSpacer} /> : null}
              <EventsGanttChart
                events={safeEvents}
                loading={loading}
                error={error}
                onRetry={() => void refetch()}
                onEventPress={handleGanttEventPress}
                minimal={isMinimalPresentation}
              />
            </View>
          ) : item.content === 'events' ? (
            <ScrollView
              style={[styles.panelScroll, isMinimalPresentation && styles.panelScrollMinimal]}
              contentContainerStyle={effectivePanelScrollContentStyle}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="always"
            >
              <>
                <Text
                  style={[
                    styles.eventsScreenTitle,
                    isMinimalPresentation && styles.eventsScreenTitleMinimal,
                  ]}
                >
                  {item.title}
                </Text>
                <TouchableOpacity
                  style={[
                    styles.newEventButton,
                    isMinimalPresentation && styles.newEventButtonMinimal,
                  ]}
                  onPress={startNewEvent}
                  activeOpacity={0.85}
                  disabled={deleteConfirmPending || isBusy}
                >
                  <FontAwesome
                    name="plus"
                    size={16}
                    color={isMinimalPresentation ? MINIMAL_UI.onDark : '#0f172a'}
                  />
                  <Text
                    style={[
                      styles.newEventButtonText,
                      isMinimalPresentation && styles.newEventButtonTextMinimal,
                    ]}
                  >
                    Novo evento
                  </Text>
                </TouchableOpacity>

                <View style={styles.listSection}>
                  <Text
                    style={[
                      styles.sectionTitle,
                      isMinimalPresentation && styles.sectionTitleMinimal,
                    ]}
                  >
                    Eventos cadastrados
                  </Text>

                  {loading ? (
                    <ActivityIndicator color="#818CF8" style={styles.loader} />
                  ) : error ? (
                    <View style={styles.messageBox}>
                      <Text style={styles.errorText}>{error.message}</Text>
                      <TouchableOpacity
                        style={styles.retryButton}
                        onPress={() => void refetch()}
                        activeOpacity={0.85}
                      >
                        <Text style={styles.retryButtonText}>Atualizar</Text>
                      </TouchableOpacity>
                    </View>
                  ) : safeEvents.length ? (
                    [...safeEvents]
                      .map((event) => ({
                        event,
                        summary: summarizeMaintenanceEvent(event, roomLabelByKey),
                      }))
                      .sort((left, right) => {
                        // 1) Ativos (publicados) primeiro, depois inativos
                        if (left.summary.isPublished !== right.summary.isPublished) {
                          return left.summary.isPublished ? -1 : 1;
                        }

                        // 2) Data de evento em ordem crescente (nulls por último)
                        const leftDate = left.event.event_date ?? '';
                        const rightDate = right.event.event_date ?? '';

                        if (!leftDate && !rightDate) return 0;
                        if (!leftDate) return 1;
                        if (!rightDate) return -1;

                        return leftDate.localeCompare(rightDate);
                      })
                      .map(({ event, summary }) => (
                        <TouchableOpacity
                          key={event.id}
                          style={[
                            styles.eventCard,
                            isMinimalPresentation && styles.eventCardMinimal,
                            deleteConfirmPending && styles.eventCardDisabled,
                          ]}
                          onPress={() => startEditEvent(event)}
                          disabled={deleteConfirmPending || isBusy}
                          activeOpacity={0.9}
                        >
                          <View style={styles.eventCardHeader}>
                            <Text
                              style={[
                                styles.eventCardName,
                                isMinimalPresentation && styles.eventCardNameMinimal,
                              ]}
                              numberOfLines={2}
                            >
                              {event.name}
                            </Text>
                            <View
                              style={[
                                styles.statusBadge,
                                summary.isPublished
                                  ? styles.statusBadgeActive
                                  : styles.statusBadgeInactive,
                                isMinimalPresentation
                                  && summary.isPublished
                                  && styles.statusBadgeActiveMinimal,
                                isMinimalPresentation
                                  && !summary.isPublished
                                  && styles.statusBadgeInactiveMinimal,
                              ]}
                            >
                              <Text
                                style={[
                                  styles.statusBadgeText,
                                  summary.isPublished
                                    ? styles.statusBadgeTextActive
                                    : styles.statusBadgeTextInactive,
                                  isMinimalPresentation
                                    && summary.isPublished
                                    && styles.statusBadgeTextActiveMinimal,
                                  isMinimalPresentation
                                    && !summary.isPublished
                                    && styles.statusBadgeTextInactiveMinimal,
                                ]}
                              >
                                {summary.isPublished ? 'Publicado' : 'Rascunho'}
                              </Text>
                            </View>
                          </View>
                          <Text
                            style={[
                              styles.eventCardMeta,
                              isMinimalPresentation && styles.eventCardMetaMinimal,
                            ]}
                            numberOfLines={2}
                          >
                            {summary.dateLabel}
                          </Text>
                          <Text
                            style={[
                              styles.eventCardMeta,
                              isMinimalPresentation && styles.eventCardMetaMinimal,
                            ]}
                            numberOfLines={2}
                          >
                            {summary.localLabel} · {summary.capacityLabel}
                          </Text>
                          {summary.flagsLabel ? (
                            <Text
                              style={[
                                styles.eventCardFlags,
                                isMinimalPresentation && styles.eventCardFlagsMinimal,
                              ]}
                              numberOfLines={2}
                            >
                              {summary.flagsLabel}
                            </Text>
                          ) : null}
                        </TouchableOpacity>
                      ))
                  ) : (
                    <Text style={styles.emptyText}>Nenhum evento cadastrado ainda.</Text>
                  )}
                </View>
              </>
            </ScrollView>
          ) : null}
        </View>
      </View>
      );
    },
    [
      cardHeight,
      currentIndex,
      deleteConfirmPending,
      error,
      safeEvents,
      handleGanttEventPress,
      isBusy,
      loading,
      activeMaintenancePanelContent,
      maintenanceShortcuts,
      effectiveCarouselPageStyle,
      effectiveCardWrapperStyle,
      effectivePanelCardStyle,
      effectivePanelScrollContentStyle,
      isMinimalPresentation,
      panelCardSizeStyle,
      quorumPresenceShortcutEnabled,
      quorumRegistrySchemaMissing,
      refetch,
      roomLabelByKey,
      scrollToMaintenancePanel,
      startEditEvent,
      startNewEvent,
      canManageAccessControl,
    ]
  );

  if (accessState === 'checking' || accessState === 'denied') {
    return (
      <LinearGradient colors={MAINTENANCE_SCREEN_GRADIENT} style={styles.container}>
        <SafeAreaView style={styles.accessGate} edges={['top', 'left', 'right', 'bottom']}>
          <ActivityIndicator color="#3A96DD" size="large" />
          {accessState === 'denied' ? (
            <Text style={styles.accessGateText}>Redirecionando...</Text>
          ) : null}
        </SafeAreaView>
      </LinearGradient>
    );
  }

  return (
    <MinimalRouteShell
      minimal={isMinimalPresentation}
      title={isMinimalPresentation && !showEditor ? undefined : activeMaintenanceScreenTitle}
      gradientColors={MAINTENANCE_SCREEN_GRADIENT}
      statusBarStyle="dark-content"
    >
        {!isMinimalPresentation ? (
        <View style={styles.header}>
          <View style={styles.welcomeBox}>
            <Text style={styles.welcomeText}>Boas-Vindas,</Text>
            <View style={styles.welcomeNameRow}>
              <Text numberOfLines={1} style={styles.userName}>
                {headerUserName}
              </Text>
              <ActiveScreenBadge
                title={activeMaintenanceScreenTitle}
                accent="amber"
                technicalKey={showTechnicalKeys ? activeMaintenanceScreenTechnicalKey : null}
              />
            </View>
          </View>
        </View>
        ) : null}

        <View style={styles.mainStage}>
          <View style={styles.carouselStage}>
            <View
              style={styles.listContainer}
              onLayout={(event) => {
                if (!isMinimalPresentation) {
                  return;
                }
                const { width, height } = event.nativeEvent.layout;
                const nextWidth = Math.floor(width);
                const nextHeight = Math.floor(height);
                if (nextWidth > 0 && nextWidth !== measuredCarouselWidth) {
                  setMeasuredCarouselWidth(nextWidth);
                }
                if (nextHeight > 0 && nextHeight !== measuredCarouselHeight) {
                  setMeasuredCarouselHeight(nextHeight);
                }
              }}
            >
              <FlatList
                ref={carouselRef}
                style={[
                  styles.carouselFlatList,
                  isMinimalPresentation &&
                    measuredCarouselHeight > 0 && {
                      height: measuredCarouselHeight,
                      maxHeight: measuredCarouselHeight,
                    },
                ]}
                data={maintenanceCarouselCards}
                extraData={{
                  currentIndex,
                  maintenanceCardCount,
                  carouselPageWidth,
                  measuredCarouselHeight,
                }}
                horizontal
                pagingEnabled={!isMinimalPresentation}
                scrollEnabled={false}
                keyboardShouldPersistTaps="handled"
                showsHorizontalScrollIndicator={false}
                initialNumToRender={maintenanceCardCount}
                maxToRenderPerBatch={Math.min(5, maintenanceCardCount)}
                windowSize={Math.max(5, maintenanceCardCount)}
                removeClippedSubviews={false}
                onScroll={handleCarouselScroll}
                onScrollToIndexFailed={handleCarouselScrollToIndexFailed}
                scrollEventThrottle={16}
                keyExtractor={(item) => item.id}
                getItemLayout={(_, index) => ({
                  length: carouselPageWidth,
                  offset: carouselPageWidth * index,
                  index,
                })}
                contentContainerStyle={
                  isMinimalPresentation
                    ? {
                        flexGrow: 1,
                        alignItems: 'stretch' as const,
                        minHeight:
                          measuredCarouselHeight > 0 ? measuredCarouselHeight : undefined,
                      }
                    : undefined
                }
                snapToAlignment="start"
                snapToInterval={isMinimalPresentation ? undefined : carouselPageWidth}
                snapToOffsets={
                  isMinimalPresentation
                    ? undefined
                    : maintenanceCarouselCards.map((_, index) => index * carouselPageWidth)
                }
                decelerationRate="fast"
                disableIntervalMomentum
                renderItem={renderCarouselItem}
              />
            </View>

            {!isMinimalPresentation ? (
            <View style={[styles.footerControls, { paddingBottom: insets.bottom + 10 }]}>
              <CarouselFooterNav
                currentIndex={currentIndex}
                totalCount={maintenanceCardCount}
                centerLabel={currentIndex === 0 ? 'Menu' : 'Voltar'}
                centerAccessibilityLabel={
                  currentIndex === 0 ? 'Menu' : 'Voltar ao card Manutenção'
                }
                onCenterPress={currentIndex === 0 ? handleMenu : handleBack}
                onPreviousPress={handleFooterPreviousPress}
                onNextPress={handleFooterNextPress}
                onPreviousPressIn={() => startFooterNavRepeat('prev')}
                onPreviousPressOut={handleFooterNavPressOut}
                onNextPressIn={() => startFooterNavRepeat('next')}
                onNextPressOut={handleFooterNavPressOut}
                isPreviousDisabled={currentIndex === 0}
                isNextDisabled={currentIndex === maintenanceCardCount - 1}
                accent="amber"
              />
            </View>
            ) : null}
          </View>

          {isMinimalPresentation && !showEditor ? (
            <CloseFooterBar onPress={handleMenu} />
          ) : null}

          {showEditor ? (
            <View style={styles.editorOverlay}>
              <ScrollView
                style={styles.scroll}
                contentContainerStyle={[
                  styles.scrollContent,
                  isMinimalPresentation && styles.scrollContentMinimal,
                  styles.scrollContentWithFooter,
                  { paddingBottom: 16 },
                ]}
                keyboardShouldPersistTaps="always"
                showsVerticalScrollIndicator={false}
              >
            <View style={styles.editorSection}>
              <View style={[styles.editorCard, isMinimalPresentation && styles.editorCardMinimal]}>
                <View
                  style={[
                    styles.nameGeofenceRow,
                    isMinimalPresentation && styles.nameGeofenceRowMinimal,
                  ]}
                >
                  <View style={styles.nameInputColumn}>
                    <Text
                      style={[
                        styles.fieldLabel,
                        isMinimalPresentation && styles.fieldLabelMinimal,
                      ]}
                    >
                      Nome do evento
                    </Text>
                    <TextInput
                      style={[
                        styles.input,
                        styles.nameInput,
                        isMinimalPresentation && styles.inputMinimal,
                      ]}
                      placeholder="Ex.: Culto de domingo"
                      placeholderTextColor="#64748B"
                      value={form.name}
                      onChangeText={(text) => patchForm({ name: text })}
                    />
                  </View>
                  <FeatureToggleColumn
                    label="Check-in automático"
                    value={form.geofenceAtivo}
                    onValueChange={(geofenceAtivo) => patchForm({ geofenceAtivo })}
                    disabled={isBusy || !geofenceSchemaReady}
                    minimal={isMinimalPresentation}
                  />
                </View>

                <Text style={styles.fieldLabel}>Data e horário</Text>
                <View style={styles.dateTimeRow}>
                  <Pressable
                    style={styles.dateTimeField}
                    onPress={() => setEventDatePickerVisible(true)}
                    accessibilityRole="button"
                    accessibilityLabel="Selecionar data do evento"
                  >
                    <View style={[styles.input, styles.dateInputTrigger]}>
                      <Text
                        style={[
                          styles.dateInputText,
                          !form.eventDateInput.trim() && styles.dateInputPlaceholder,
                        ]}
                      >
                        {form.eventDateInput.trim() || 'DD/MM/AAAA'}
                      </Text>
                      <MaterialIcons name="calendar-today" size={18} color="#94A3B8" />
                    </View>
                  </Pressable>
                  <View style={styles.dateTimeField}>
                    <TextInput
                      style={styles.input}
                      placeholder="HH:MM"
                      placeholderTextColor="#64748B"
                      value={form.eventTimeInput}
                      keyboardType="numeric"
                      onChangeText={(text) => {
                        setStatusMessage(null);
                        patchForm({ eventTimeInput: formatEventTimeInputMask(text) });
                      }}
                    />
                  </View>
                </View>

                <View style={styles.localCapacityHeader}>
                  <Text style={styles.fieldLabel}>Local do evento</Text>
                </View>
                <View style={styles.localNameFavoritesRow}>
                  <TextInput
                    style={[styles.input, styles.localInput]}
                    placeholder="Ex.: Templo principal"
                    placeholderTextColor="#64748B"
                    value={form.eventLocal}
                    onChangeText={(text) => patchForm({ eventLocal: text })}
                  />
                  <Pressable
                    style={({ pressed }) => [
                      styles.favoritePickerButton,
                      pressed && styles.actionPressed,
                    ]}
                    onPress={() => {
                      void reloadFavoriteLocations();
                      setFavoritePickerVisible(true);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel="Selecionar local favorito"
                  >
                    <MaterialIcons name="place" size={16} color="#3A96DD" />
                    <Text style={styles.favoritePickerButtonText}>Favoritos</Text>
                  </Pressable>
                </View>
                <View style={styles.localAddressCapacityRow}>
                  <View style={styles.localAddressSlot}>
                    <TextInput
                      style={[styles.input, styles.localAddressInput]}
                      placeholder="Endereço do local"
                      placeholderTextColor="#64748B"
                      value={form.eventLocalAddress}
                      onChangeText={(text) => patchForm({ eventLocalAddress: text })}
                    />
                  </View>
                  <View style={styles.capacityColumn}>
                    <Text
                      style={[
                        styles.fieldLabel,
                        styles.capacityFieldLabel,
                        isMinimalPresentation && styles.fieldLabelMinimal,
                      ]}
                    >
                      Capacidade
                    </Text>
                    <TextInput
                      style={[
                        styles.input,
                        styles.capacityInput,
                        isMinimalPresentation && styles.inputMinimal,
                      ]}
                      placeholder="Ex.: 70"
                      placeholderTextColor="#64748B"
                      value={form.maxCapacity}
                      keyboardType="number-pad"
                      onChangeText={(text) => patchForm({ maxCapacity: text.replace(/\D/g, '') })}
                    />
                    {isUnlimitedEventCapacity(form.maxCapacity) ? (
                      <Text
                        style={[
                          styles.capacityUnlimitedHint,
                          isMinimalPresentation && styles.capacityUnlimitedHintMinimal,
                        ]}
                      >
                        {UNLIMITED_EVENT_CAPACITY_LABEL}
                      </Text>
                    ) : null}
                  </View>
                </View>

                {favoriteLocationsSchemaMissing && !loading ? (
                  <View style={styles.totemSqlWarning}>
                    <Text style={styles.totemSqlWarningText}>
                      Locais favoritos indisponíveis até criar a tabela no Supabase.
                    </Text>
                    <Text style={styles.totemSqlWarningHint}>{EVENT_FAVORITE_LOCATIONS_SQL_HINT}</Text>
                  </View>
                ) : null}

                {!somenteMembrosSchemaReady && !loading ? (
                  <View style={styles.totemSqlWarning}>
                    <Text style={styles.totemSqlWarningText}>
                      Não foi possível preparar a coluna somente_membros automaticamente. O botão
                      Somente Membros só será salvo após habilitar a migração no Supabase.
                    </Text>
                    <Text style={styles.totemSqlWarningHint}>{SOMENTE_MEMBROS_COLUMN_SQL_HINT}</Text>
                  </View>
                ) : null}

                {!geofenceSchemaReady && !loading ? (
                  <View style={styles.totemSqlWarning}>
                    <Text style={styles.totemSqlWarningText}>
                      Não foi possível preparar a coluna geofence_ativo automaticamente. O botão
                      Check-in automático só será salvo após habilitar a migração no Supabase.
                    </Text>
                    <Text style={styles.totemSqlWarningHint}>{GEOFENCE_ATIVO_COLUMN_SQL_HINT}</Text>
                  </View>
                ) : null}

                {!totemSchemaReady && !loading ? (
                  <View style={styles.totemSqlWarning}>
                    <Text style={styles.totemSqlWarningText}>
                      Não foi possível preparar a coluna totem_ativo automaticamente. O botão
                      Sim/Não só será salvo após habilitar a migração no Supabase.
                    </Text>
                    <Text style={styles.totemSqlWarningHint}>{TOTEM_COLUMN_SQL_HINT}</Text>
                  </View>
                ) : null}

                <Text
                  style={[
                    styles.fieldLabel,
                    isMinimalPresentation && styles.fieldLabelMinimal,
                    isMinimalPresentation && styles.fieldLabelCentered,
                  ]}
                >
                  Salas e recursos
                </Text>
                <View style={[styles.featureRow, isMinimalPresentation && styles.featureRowMinimal]}>
                  <View
                    style={[
                      styles.featureRowChips,
                      isMinimalPresentation && styles.featureRowChipsMinimal,
                    ]}
                  >
                    {eventRoomOptions.map((room) => {
                      const selected = form.enabledRoomKeys.includes(room.room_key);

                      return (
                        <FeatureToggle
                          key={room.room_key}
                          label={room.display_label}
                          value={selected}
                          onValueChange={() => {
                            patchForm(toggleEnabledRoomKey(form.enabledRoomKeys, room.room_key));
                          }}
                          activeStyle={ROOM_CHIP_CUSTOM_ACTIVE}
                        />
                      );
                    })}
                  </View>
                  <View
                    style={[
                      styles.featureToggleGroup,
                      isMinimalPresentation && styles.featureToggleGroupMinimal,
                    ]}
                  >
                    <FeatureToggleColumn
                      label="Somente Membros"
                      value={form.somenteMembros}
                      onValueChange={(somenteMembros) => patchForm({ somenteMembros })}
                      disabled={isBusy}
                      minimal={isMinimalPresentation}
                      halfWidth={isMinimalPresentation}
                    />
                    <FeatureToggleColumn
                      label="Ativação de Totem"
                      value={form.totemAtivo}
                      onValueChange={(totemAtivo) => patchForm({ totemAtivo })}
                      disabled={isBusy}
                      minimal={isMinimalPresentation}
                      halfWidth={isMinimalPresentation}
                    />
                    <FeatureToggleColumn
                      label="Requer Quorum"
                      value={form.requerQuorum}
                      onValueChange={(requerQuorum) => patchForm({ requerQuorum })}
                      disabled={isBusy}
                      minimal={isMinimalPresentation}
                      halfWidth={isMinimalPresentation}
                    />
                  </View>
                </View>

                {!quorumSchemaReady && !loading ? (
                  <View style={styles.totemSqlWarning}>
                    <Text style={styles.totemSqlWarningText}>
                      Não foi possível preparar a coluna requer_quorum automaticamente. O botão
                      Requer Quorum só será salvo após habilitar a migração no Supabase.
                    </Text>
                    <Text style={styles.totemSqlWarningHint}>{REQUER_QUORUM_COLUMN_SQL_HINT}</Text>
                  </View>
                ) : null}

                {form.requerQuorum && quorumRegistrySchemaMissing && !loading ? (
                  <View style={styles.totemSqlWarning}>
                    <Text style={styles.totemSqlWarningText}>
                      A tabela de registro de check-in do quórum ainda não está no Supabase.
                    </Text>
                    <Text style={styles.totemSqlWarningHint}>{QUORUM_REGISTRY_SQL_HINT}</Text>
                  </View>
                ) : null}

                <View style={[styles.publishRow, isMinimalPresentation && styles.publishRowMinimal]}>
                  <View style={styles.publishCopy}>
                    <Text style={[styles.fieldLabel, isMinimalPresentation && styles.fieldLabelMinimal]}>
                      Publicação
                    </Text>
                    <Text
                      style={[
                        styles.publishHint,
                        isMinimalPresentation && styles.publishHintMinimal,
                      ]}
                    >
                      {form.isPublished
                        ? 'Publicado — visível no dashboard e cronograma (verde)'
                        : 'Rascunho — oculto para membros; no cronograma aparece em laranja'}
                    </Text>
                  </View>
                  <Switch
                    value={form.isPublished}
                    onValueChange={(isPublished) => patchForm({ isPublished })}
                    trackColor={isMinimalPresentation ? MINIMAL_SWITCH_TRACK : { false: '#475569', true: '#22C55E' }}
                    thumbColor={isMinimalPresentation ? MINIMAL_UI.background : '#F8FAFC'}
                  />
                </View>
                {isEventDateInPast && form.isPublished && !canBypassEventPastDateLock ? (
                  <Text style={styles.publishPastWarning}>
                    Esta data é anterior a hoje. Só eventos de hoje ou futuros permanecem
                    publicados — confira o ano no calendário (ex.: 2026, não 2021).
                  </Text>
                ) : null}
                {isEventDateInPast && form.isPublished && canBypassEventPastDateLock ? (
                  <Text style={styles.publishPastTreasurerHint}>
                    Data retroativa permitida para Tesoureiro: o evento permanecerá publicado
                    mesmo em meses anteriores.
                  </Text>
                ) : null}

                {!isCreating ? (
                  <View style={styles.replicateSevenSection}>
                    <Pressable
                      style={({ pressed }) => [
                        styles.replicateSevenButton,
                        (pressed || isReplicatingSeven) && styles.actionPressed,
                      ]}
                      onPress={() => void handleReplicateSevenDays()}
                      disabled={isBusy}
                      accessibilityRole="button"
                      accessibilityLabel="Duplicar evento para daqui a 7 dias como rascunho"
                    >
                      {isReplicatingSeven ? (
                        <ActivityIndicator color="#3A96DD" size="small" />
                      ) : (
                        <Text style={styles.replicateSevenButtonText}>+7</Text>
                      )}
                    </Pressable>
                    <Text style={styles.replicateSevenHint}>
                      Cria 1 cópia para daqui a 7 dias com o mesmo horário, local, capacidade, salas e
                      recursos. Apenas a data muda; a cópia fica como rascunho.
                    </Text>
                  </View>
                ) : null}

                {form.requerQuorum && !isCreating ? (
                  <QuorumCheckinRegistryTable
                    rows={quorumRegistryRows}
                    loading={isQuorumRegistryLoading}
                    isRefreshing={isQuorumRegistryRefreshing}
                    error={quorumRegistryError}
                    schemaMissing={quorumRegistrySchemaMissing}
                  />
                ) : null}

              </View>
            </View>
              </ScrollView>
            </View>
          ) : null}
        </View>

        {showEditor ? (
          <View style={[styles.editorFooter, isMinimalPresentation && styles.editorFooterMinimal, { paddingBottom: insets.bottom + 12 }]}>
            {statusMessage ? (
              <View style={styles.statusBanner}>
                <Text style={styles.statusBannerText}>{statusMessage}</Text>
              </View>
            ) : null}
            {!isCreating && deleteConfirmPending ? (
              <View style={styles.deleteConfirmBox}>
                <Text style={styles.deleteConfirmTitle}>Confirmar exclusão</Text>
                <Text style={styles.deleteConfirmText}>
                  Apagar &quot;{deleteTargetName}&quot;? Esta ação não pode ser desfeita.
                </Text>
                <View style={styles.deleteConfirmActions}>
                  <Pressable
                    style={({ pressed }) => [
                      styles.deleteConfirmNoButton,
                      pressed && styles.actionPressed,
                    ]}
                    onPress={cancelDeleteConfirm}
                    disabled={isBusy}
                  >
                    <Text style={styles.deleteConfirmNoText}>Não</Text>
                  </Pressable>
                  <Pressable
                    style={({ pressed }) => [
                      styles.deleteConfirmYesButton,
                      pressed && styles.actionPressed,
                    ]}
                    onPress={() => void performDelete()}
                    disabled={isBusy}
                  >
                    {isDeleting ? (
                      <ActivityIndicator color="#FFF" size="small" />
                    ) : (
                      <Text style={styles.deleteConfirmYesText}>Sim, apagar</Text>
                    )}
                  </Pressable>
                </View>
              </View>
            ) : !isCreating && canUpdateMaintenanceEvents ? (
              <Pressable
                style={({ pressed }) => [
                  styles.deleteButton,
                  isMinimalPresentation && styles.deleteButtonMinimal,
                  (pressed || isBusy) && styles.actionPressed,
                ]}
                onPress={beginDeleteConfirm}
                disabled={isBusy}
                accessibilityRole="button"
                accessibilityLabel="Apagar evento"
              >
                <FontAwesome
                  name="trash-o"
                  size={16}
                  color={isMinimalPresentation ? MINIMAL_UI.icon : '#FCA5A5'}
                />
                <Text
                  style={[
                    styles.deleteButtonText,
                    isMinimalPresentation && styles.deleteButtonTextMinimal,
                  ]}
                >
                  Apagar evento
                </Text>
              </Pressable>
            ) : null}
            <View style={styles.editorActions}>
              <Pressable
                style={({ pressed }) => [styles.cancelButton, pressed && styles.actionPressed]}
                onPress={closeEditor}
                disabled={isBusy}
              >
                <Text style={styles.cancelButtonText}>
                  {isCreating ? 'Cancelar' : 'Voltar'}
                </Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [
                  styles.saveButton,
                  (pressed || isSaving) && styles.saveButtonPressed,
                ]}
                onPress={() => {
                  void handleSave();
                }}
                disabled={isBusy}
                accessibilityRole="button"
                accessibilityLabel="Salvar evento"
              >
                {isSaving ? (
                  <ActivityIndicator color="#0f172a" size="small" />
                ) : (
                  <Text style={styles.saveButtonText}>Salvar</Text>
                )}
              </Pressable>
            </View>
          </View>
        ) : null}

        <MonthlyDatePickerModal
          visible={eventDatePickerVisible}
          value={form.eventDateInput}
          onClose={() => setEventDatePickerVisible(false)}
          onConfirm={(dateInput) => {
            setStatusMessage(null);
            patchForm({ eventDateInput: dateInput });
          }}
        />

        <EventFavoriteLocationPickerModal
          visible={favoritePickerVisible}
          locations={favoriteLocations}
          loading={favoriteLocationsLoading}
          saving={favoriteLocationsSaving}
          deletingId={favoriteLocationDeletingId}
          schemaMissing={favoriteLocationsSchemaMissing}
          cepColumnMissing={favoriteLocationsCepColumnMissing}
          error={favoriteLocationsError}
          canManage={canUpdateMaintenanceEvents}
          onClose={() => setFavoritePickerVisible(false)}
          onSelect={applyFavoriteLocation}
          onSave={async (input, locationId) => {
            await saveFavoriteLocation(input, locationId);
          }}
          onDelete={removeFavoriteLocation}
        />
    </MinimalRouteShell>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  accessGate: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  accessGateText: {
    color: 'rgba(58, 150, 221, 0.82)',
    fontSize: 14,
  },
  header: { paddingHorizontal: 24, paddingTop: 10, paddingBottom: 8 },
  welcomeBox: {
    width: '100%',
    borderRadius: 18,
    backgroundColor: VIGILANCE_SCALES_UI.headerSurface,
    borderWidth: 1,
    borderColor: VIGILANCE_SCALES_UI.border,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 4,
  },
  welcomeText: {
    color: 'rgba(58, 150, 221, 0.82)',
    fontSize: 13,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  welcomeNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  userName: {
    color: '#3A96DD',
    fontSize: 24,
    fontWeight: '800',
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
  },
  activeScreenTitle: {
    flexShrink: 0,
    maxWidth: '46%',
    color: '#1B4F8A',
    fontSize: 11,
    fontWeight: '800',
    textAlign: 'right',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    lineHeight: 14,
  },
  mainStage: {
    flex: 1,
    minHeight: 0,
    position: 'relative',
    width: '100%',
    maxWidth: '100%',
    minWidth: 0,
    overflow: 'hidden',
  },
  carouselStage: {
    flex: 1,
    minHeight: 0,
    width: '100%',
    maxWidth: '100%',
    minWidth: 0,
    overflow: 'hidden',
  },
  editorOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 2,
    backgroundColor: '#FFFFFF',
  },
  listContainer: {
    flex: 1,
    minHeight: 0,
    width: '100%',
    maxWidth: '100%',
    minWidth: 0,
    overflow: 'hidden',
  },
  carouselFlatList: {
    flex: 1,
    minHeight: 0,
    width: '100%',
    maxWidth: '100%',
    minWidth: 0,
    overflow: 'hidden',
  },
  cardWrapper: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 0,
    paddingBottom: 8,
  },
  panelCard: {
    borderRadius: STATIC_MAINTENANCE_PANEL_INSETS.borderRadius,
    overflow: 'hidden',
    ...DASHBOARD_CARD_SHELL,
  },
  panelCardInnerPadding: {
    padding: STATIC_MAINTENANCE_PANEL_INSETS.innerPadding,
  },
  panelCardMenu: {
    borderColor: UI_MAINTENANCE_PANEL_BORDERS.menu,
    padding: STATIC_MAINTENANCE_PANEL_INSETS.menuPadding,
  },
  panelCardLight: {
    ...MAINTENANCE_LIGHT_PANEL_CARD,
    ...DASHBOARD_CARD_BOX_SHADOW,
  },
  panelCardPlaceholder: {
    flex: 1,
  },
  menuPanel: {
    flex: 1,
    minHeight: 0,
    gap: STATIC_MAINTENANCE_PANEL_INSETS.gap,
  },
  menuPanelTitle: {
    fontSize: UI_PANEL_TYPO.title.fontSize,
    fontWeight: UI_PANEL_TYPO.title.fontWeight,
    lineHeight: UI_PANEL_TYPO.title.lineHeight,
    color: UI_PANEL_TYPO.title.color,
    textAlign: 'center',
    alignSelf: 'stretch',
  },
  menuPanelSubtitleSpacer: {
    height: UI_PANEL_TYPO.subtitle.lineHeight,
    marginBottom: UI_SPACING.xs,
  },
  menuShortcutsScroll: {
    flex: 1,
    minHeight: 0,
  },
  menuShortcutsArea: {
    flexGrow: 1,
    justifyContent: 'space-evenly',
    gap: UI_SPACING.sm,
    paddingVertical: UI_SPACING.xs,
  },
  menuShortcutButton: {
    flexGrow: 0,
    flexShrink: 0,
    alignSelf: 'stretch',
    borderRadius: UI_RADIUS.sm,
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.35)',
    backgroundColor: '#FFFFFF',
    paddingVertical: UI_SPACING.sm,
    paddingRight: UI_SPACING.md,
    paddingLeft: 0,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  menuShortcutButtonActive: {
    borderColor: '#3A96DD',
    backgroundColor: '#F0F9FF',
  },
  menuShortcutButtonDisabled: {
    opacity: 0.45,
    borderColor: 'rgba(52, 211, 153, 0.35)',
    backgroundColor: '#F8FAFC',
  },
  menuShortcutRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: UI_SPACING.sm,
    paddingLeft: UI_SPACING.md,
    paddingRight: UI_SPACING.xs,
    width: '100%',
  },
  menuShortcutIcon: {
    marginTop: 2,
    flexShrink: 0,
  },
  menuShortcutButtonText: {
    color: '#3A96DD',
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 19,
    textAlign: 'left',
    flex: 1,
    minWidth: 0,
  },
  menuShortcutButtonTextActive: {
    color: '#3A96DD',
  },
  menuShortcutButtonTextDisabled: {
    color: 'rgba(58, 150, 221, 0.82)',
  },
  ganttPanel: {
    ...CONTAIN_WIDTH,
    flex: 1,
    padding: STATIC_MAINTENANCE_PANEL_INSETS.menuPadding,
    minHeight: 0,
  },
  ganttPanelMinimal: {
    paddingHorizontal: 0,
    paddingVertical: 4,
    width: '100%',
    maxWidth: '100%',
    minWidth: 0,
    overflow: 'hidden',
  },
  orchestrationPanel: {
    ...CONTAIN_WIDTH,
    flex: 1,
    minHeight: 0,
  },
  orchestrationPanelMinimal: {
    paddingHorizontal: 0,
    paddingVertical: 4,
    width: '100%',
    maxWidth: '100%',
    minWidth: 0,
    overflow: 'hidden',
  },
  scaleTypesPanel: {
    ...CONTAIN_WIDTH,
    flex: 1,
    minHeight: 0,
  },
  scaleTypesPanelMinimal: {
    paddingHorizontal: 0,
    paddingVertical: 4,
    width: '100%',
    maxWidth: '100%',
    minWidth: 0,
    overflow: 'hidden',
  },
  scaleVolunteersPanel: {
    ...CONTAIN_WIDTH,
    flex: 1,
    minHeight: 0,
  },
  scaleVolunteersPanelMinimal: {
    paddingHorizontal: 0,
    paddingVertical: 4,
    width: '100%',
    maxWidth: '100%',
    minWidth: 0,
    overflow: 'hidden',
  },
  scalesPanel: {
    ...CONTAIN_WIDTH,
    flex: 1,
    minHeight: 0,
  },
  scalesPanelMinimal: {
    paddingHorizontal: 0,
    paddingVertical: 4,
    width: '100%',
    maxWidth: '100%',
    minWidth: 0,
    overflow: 'hidden',
  },
  pastoralCarePanel: {
    ...CONTAIN_WIDTH,
    flex: 1,
    minHeight: 0,
  },
  pastoralCarePanelMinimal: {
    paddingHorizontal: 0,
    paddingVertical: 4,
    width: '100%',
    maxWidth: '100%',
    minWidth: 0,
    overflow: 'hidden',
  },
  financialsPanel: {
    ...CONTAIN_WIDTH,
    flex: 1,
    minHeight: 0,
  },
  financialsPanelMinimal: {
    paddingHorizontal: 0,
    paddingVertical: 4,
    width: '100%',
    maxWidth: '100%',
    minWidth: 0,
    overflow: 'hidden',
  },
  salaServidorPanel: {
    ...CONTAIN_WIDTH,
    flex: 1,
    minHeight: 0,
  },
  salaServidorPanelMinimal: {
    paddingHorizontal: 0,
    paddingVertical: 4,
    width: '100%',
    maxWidth: '100%',
    minWidth: 0,
    overflow: 'hidden',
  },
  accessControlPanel: {
    ...CONTAIN_WIDTH,
    flex: 1,
    minHeight: 0,
  },
  accessControlPanelMinimal: {
    paddingHorizontal: 0,
    paddingVertical: 4,
    width: '100%',
    maxWidth: '100%',
    minWidth: 0,
    overflow: 'hidden',
  },
  pastoralRoleChangePanel: {
    ...CONTAIN_WIDTH,
    flex: 1,
    minHeight: 0,
  },
  pastoralRoleChangePanelMinimal: {
    paddingHorizontal: 0,
    paddingVertical: 4,
    width: '100%',
    maxWidth: '100%',
    minWidth: 0,
    overflow: 'hidden',
  },
  profileCadastroPanel: {
    ...CONTAIN_WIDTH,
    flex: 1,
    minHeight: 0,
  },
  profileCadastroPanelMinimal: {
    paddingHorizontal: 0,
    paddingVertical: 4,
    width: '100%',
    maxWidth: '100%',
    minWidth: 0,
    overflow: 'hidden',
  },
  familyReceptionPanel: {
    ...CONTAIN_WIDTH,
    flex: 1,
    minHeight: 0,
  },
  familyReceptionPanelMinimal: {
    paddingHorizontal: 0,
    paddingVertical: 4,
    width: '100%',
    maxWidth: '100%',
    minWidth: 0,
    overflow: 'hidden',
  },
  predictivePanel: {
    ...CONTAIN_WIDTH,
    flex: 1,
    minHeight: 0,
  },
  predictivePanelMinimal: {
    paddingHorizontal: 0,
    paddingVertical: 4,
    width: '100%',
    maxWidth: '100%',
    minWidth: 0,
    overflow: 'hidden',
  },
  reportsPanel: {
    ...CONTAIN_WIDTH,
    flex: 1,
    minHeight: 0,
  },
  reportsPanelMinimal: {
    paddingHorizontal: 0,
    paddingVertical: 4,
    width: '100%',
    maxWidth: '100%',
    minWidth: 0,
    overflow: 'hidden',
  },
  profileAccessInsightsPanel: {
    ...CONTAIN_WIDTH,
    flex: 1,
    minHeight: 0,
  },
  profileAccessInsightsPanelMinimal: {
    paddingHorizontal: 0,
    paddingVertical: 4,
    width: '100%',
    maxWidth: '100%',
    minWidth: 0,
    overflow: 'hidden',
  },
  ghostModePanel: {
    ...CONTAIN_WIDTH,
    flex: 1,
    minHeight: 0,
  },
  ghostModePanelMinimal: {
    paddingHorizontal: 0,
    paddingVertical: 4,
    width: '100%',
    maxWidth: '100%',
    minWidth: 0,
    overflow: 'hidden',
  },
  ganttPanelTitle: {
    fontSize: UI_PANEL_TYPO.titleMuted.fontSize,
    fontWeight: UI_PANEL_TYPO.titleMuted.fontWeight,
    color: UI_PANEL_TYPO.titleMuted.color,
    textAlign: 'center',
    alignSelf: 'stretch',
  },
  ganttPanelSubtitleSpacer: {
    height: UI_PANEL_TYPO.subtitle.lineHeight,
    marginTop: UI_SPACING.xs,
    marginBottom: UI_SPACING.sm,
  },
  panelScroll: {
    flex: 1,
    width: '100%',
    minWidth: 0,
    maxWidth: '100%',
  },
  panelScrollMinimal: {
    alignSelf: 'stretch',
  },
  panelScrollContent: {
    padding: STATIC_MAINTENANCE_PANEL_INSETS.scrollPadding,
    gap: UI_SPACING.lg,
    paddingBottom: UI_SPACING.xl,
  },
  footerControls: { flexShrink: 0, paddingHorizontal: 32, marginTop: 6 },
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
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 20,
    gap: 16,
  },
  scrollContentMinimal: {
    paddingHorizontal: 16,
    width: '100%',
    maxWidth: '100%',
    alignSelf: 'center',
  },
  scrollContentWithFooter: {
    paddingBottom: 8,
  },
  eventsScreenTitle: {
    color: '#3A96DD',
    fontSize: MINIMAL_SECTION_TITLE.fontSize,
    fontWeight: MINIMAL_SECTION_TITLE.fontWeight,
    textAlign: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    alignSelf: 'stretch',
  },
  eventsScreenTitleMinimal: {
    ...MINIMAL_SECTION_TITLE,
    alignSelf: 'stretch',
  },
  newEventButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    alignSelf: 'stretch',
    width: '100%',
    maxWidth: '100%',
    backgroundColor: '#3A96DD',
    borderWidth: 1,
    borderColor: '#1B4F8A',
    borderRadius: 14,
    paddingVertical: 14,
  },
  newEventButtonMinimal: {
    backgroundColor: MINIMAL_UI.accent,
    borderColor: MINIMAL_UI.blueDark,
  },
  newEventButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  newEventButtonTextMinimal: {
    color: MINIMAL_UI.onDark,
  },
  listSection: {
    gap: 10,
    width: '100%',
    minWidth: 0,
    maxWidth: '100%',
  },
  sectionTitle: {
    color: '#3A96DD',
    fontSize: 13,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  sectionTitleMinimal: {
    color: MINIMAL_UI.textMuted,
  },
  loader: {
    marginVertical: 24,
  },
  messageBox: {
    alignItems: 'center',
    gap: 12,
    paddingVertical: 16,
  },
  errorText: {
    color: '#FCA5A5',
    textAlign: 'center',
  },
  retryButton: {
    borderWidth: 1,
    borderColor: '#3A96DD',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  retryButtonText: {
    color: '#3A96DD',
    fontWeight: '700',
  },
  eventCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.35)',
    backgroundColor: '#FFFFFF',
    padding: 14,
    gap: 6,
    width: '100%',
    maxWidth: '100%',
    minWidth: 0,
    alignSelf: 'stretch',
  },
  eventCardMinimal: {
    borderColor: MINIMAL_UI.border,
  },
  eventCardSelected: {
    borderColor: '#3A96DD',
    backgroundColor: '#F0F9FF',
  },
  eventCardDisabled: {
    opacity: 0.45,
  },
  eventCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    width: '100%',
    minWidth: 0,
  },
  eventCardName: {
    flex: 1,
    minWidth: 0,
    flexShrink: 1,
    color: '#3A96DD',
    fontSize: 17,
    fontWeight: '700',
  },
  eventCardNameMinimal: {
    color: MINIMAL_UI.text,
  },
  statusBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    flexShrink: 0,
  },
  statusBadgeActiveMinimal: {
    backgroundColor: '#ECFDF5',
    borderColor: '#16A34A',
  },
  statusBadgeInactiveMinimal: {
    backgroundColor: MINIMAL_UI.rowHover,
    borderColor: MINIMAL_UI.border,
  },
  statusBadgeActive: {
    backgroundColor: 'rgba(34, 197, 94, 0.18)',
    borderColor: '#22C55E',
  },
  statusBadgeInactive: {
    backgroundColor: 'rgba(148, 163, 184, 0.14)',
    borderColor: 'rgba(52, 211, 153, 0.35)',
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  statusBadgeTextActive: {
    color: '#86EFAC',
  },
  statusBadgeTextInactive: {
    color: 'rgba(58, 150, 221, 0.82)',
  },
  statusBadgeTextInactiveMinimal: {
    color: MINIMAL_UI.textMuted,
  },
  statusBadgeTextActiveMinimal: {
    color: '#15803D',
  },
  eventCardMeta: {
    color: '#3A96DD',
    fontSize: 13,
    flexShrink: 1,
    width: '100%',
  },
  eventCardMetaMinimal: {
    color: MINIMAL_UI.textMuted,
  },
  eventCardFlags: {
    color: '#1B4F8A',
    fontSize: 12,
    fontWeight: '600',
    flexShrink: 1,
    width: '100%',
  },
  eventCardFlagsMinimal: {
    color: MINIMAL_UI.text,
  },
  emptyText: {
    color: 'rgba(58, 150, 221, 0.82)',
    textAlign: 'center',
    paddingVertical: 20,
  },
  editorSection: {
    gap: 10,
    marginTop: 4,
  },
  editorCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.35)',
    backgroundColor: '#FFFFFF',
    padding: 16,
    gap: 10,
  },
  editorCardMinimal: {
    width: '100%',
    maxWidth: '100%',
    minWidth: 0,
    alignSelf: 'stretch',
    borderColor: MINIMAL_UI.border,
  },
  fieldLabel: {
    color: '#3A96DD',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.35)',
    borderRadius: 12,
    color: '#3A96DD',
    fontSize: 15,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  localCapacityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 10,
    marginBottom: 2,
  },
  favoritePickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: 112,
    flexShrink: 0,
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.35)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#F0F9FF',
  },
  favoritePickerButtonText: {
    color: '#3A96DD',
    fontSize: 12,
    fontWeight: '800',
  },
  localNameFavoritesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  localAddressCapacityRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    marginTop: 8,
  },
  localAddressSlot: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'flex-end',
  },
  localInput: {
    flex: 1,
    minWidth: 0,
  },
  localAddressInput: {
    width: '100%',
  },
  capacityColumn: {
    width: 112,
    flexShrink: 0,
    gap: 6,
  },
  capacityFieldLabel: {
    textAlign: 'center',
  },
  capacityInput: {
    width: '100%',
    paddingHorizontal: 10,
    textAlign: 'center',
  },
  capacityUnlimitedHint: {
    color: '#86EFAC',
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 13,
  },
  capacityUnlimitedHintMinimal: {
    color: MINIMAL_UI.textMuted,
  },
  dateTimeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    width: '100%',
    maxWidth: '100%',
    minWidth: 0,
  },
  dateTimeField: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 140,
    minWidth: 120,
    maxWidth: '100%',
  },
  dateInputTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  dateInputText: {
    flex: 1,
    color: '#3A96DD',
    fontSize: 15,
  },
  dateInputPlaceholder: {
    color: 'rgba(58, 150, 221, 0.82)',
  },
  featureLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  nameGeofenceRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    width: '100%',
    maxWidth: '100%',
    minWidth: 0,
  },
  nameGeofenceRowMinimal: {
    // Evita featureToggleColumnMinimal (width 100%) esmagar o campo Nome.
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: 12,
  },
  nameInputColumn: {
    flex: 1,
    minWidth: 0,
    width: '100%',
    maxWidth: '100%',
  },
  nameInput: {
    width: '100%',
    maxWidth: '100%',
    minWidth: 0,
  },
  totemFieldLabel: {
    color: '#3A96DD',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    textAlign: 'right',
    flexShrink: 0,
  },
  totemFieldLabelMinimal: {
    color: MINIMAL_UI.textMuted,
    textAlign: 'left',
    flex: 1,
    minWidth: 0,
    flexShrink: 1,
    fontSize: 11,
    lineHeight: 14,
  },
  featureRow: {
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: 10,
    width: '100%',
  },
  featureRowMinimal: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    maxWidth: '100%',
    minWidth: 0,
    gap: 10,
  },
  featureRowChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    width: '100%',
    flexShrink: 0,
  },
  featureRowChipsMinimal: {
    flexGrow: 0,
    minWidth: 0,
    width: '100%',
    maxWidth: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  featureToggleGroup: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    flexWrap: 'wrap',
    width: '100%',
    flexShrink: 0,
  },
  featureToggleGroupMinimal: {
    width: '100%',
    maxWidth: '100%',
    minWidth: 0,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'stretch',
    justifyContent: 'space-between',
    marginLeft: 0,
    gap: 6,
  },
  featureToggleColumn: {
    alignItems: 'flex-end',
    gap: 4,
  },
  featureToggleColumnMinimal: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    maxWidth: '100%',
    minWidth: 0,
    gap: 6,
  },
  featureToggleColumnHalf: {
    width: '48%',
    maxWidth: '48%',
  },
  totemBlock: {
    flexShrink: 0,
  },
  totemBlockMinimal: {
    flexShrink: 0,
    marginLeft: 0,
  },
  totemChoiceRow: {
    flexDirection: 'row',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.35)',
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
  },
  totemChoiceRowMinimal: {
    borderColor: MINIMAL_UI.border,
    backgroundColor: MINIMAL_UI.background,
  },
  totemChoiceButton: {
    minWidth: 44,
    paddingHorizontal: 14,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  totemChoiceButtonMinimal: {
    minWidth: 34,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  totemChoiceButtonSimActive: {
    backgroundColor: 'rgba(34, 197, 94, 0.22)',
  },
  totemChoiceButtonNaoActive: {
    backgroundColor: 'rgba(100, 116, 139, 0.45)',
  },
  totemChoiceButtonSimActiveMinimal: {
    backgroundColor: MINIMAL_UI.blueDark,
  },
  totemChoiceButtonNaoActiveMinimal: {
    backgroundColor: MINIMAL_UI.divider,
  },
  totemChoiceText: {
    color: 'rgba(58, 150, 221, 0.82)',
    fontSize: 13,
    fontWeight: '700',
  },
  totemChoiceTextMinimal: {
    color: MINIMAL_UI.textMuted,
    fontSize: 12,
  },
  totemChoiceTextActive: {
    color: '#3A96DD',
    fontWeight: '800',
  },
  totemChoiceTextSimActiveMinimal: {
    color: MINIMAL_UI.onDark,
    fontWeight: '800',
  },
  totemChoiceTextNaoActiveMinimal: {
    color: MINIMAL_UI.text,
    fontWeight: '800',
  },
  totemSqlWarning: {
    marginBottom: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.45)',
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    gap: 6,
  },
  totemSqlWarningText: {
    color: '#fde68a',
    fontSize: 12,
    lineHeight: 18,
  },
  totemSqlWarningHint: {
    color: '#fbbf24',
    fontSize: 11,
    lineHeight: 16,
  },
  featureChip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 0,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.35)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#FFFFFF',
  },
  featureChipText: {
    color: 'rgba(58, 150, 221, 0.82)',
    fontSize: 13,
    fontWeight: '700',
  },
  featureChipTextActive: {
    color: '#3A96DD',
    fontWeight: '800',
  },
  publishRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 4,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(148, 163, 184, 0.2)',
    width: '100%',
    minWidth: 0,
  },
  publishRowMinimal: {
    borderTopColor: MINIMAL_UI.divider,
  },
  publishCopy: {
    flex: 1,
    gap: 4,
    minWidth: 0,
  },
  publishHint: {
    color: 'rgba(58, 150, 221, 0.82)',
    fontSize: 12,
  },
  publishHintMinimal: {
    color: MINIMAL_UI.textMuted,
  },
  fieldLabelMinimal: {
    color: MINIMAL_UI.textMuted,
  },
  inputMinimal: {
    width: '100%',
    maxWidth: '100%',
    minWidth: 0,
    borderColor: MINIMAL_UI.border,
    color: MINIMAL_UI.text,
    backgroundColor: MINIMAL_UI.background,
  },
  fieldLabelCentered: {
    textAlign: 'center',
    alignSelf: 'stretch',
  },
  publishPastWarning: {
    color: '#FCD34D',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
  },
  publishPastTreasurerHint: {
    color: '#86EFAC',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
  },
  replicateSevenSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 4,
    width: '100%',
  },
  replicateSevenButton: {
    alignSelf: 'center',
    flexShrink: 0,
    minWidth: 56,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.35)',
    backgroundColor: '#F0F9FF',
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  replicateSevenButtonText: {
    color: '#3A96DD',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  replicateSevenHint: {
    color: 'rgba(58, 150, 221, 0.82)',
    fontSize: 12,
    lineHeight: 17,
    flexGrow: 0,
    flexShrink: 1,
    width: '70%',
    maxWidth: '70%',
  },
  editorFooter: {
    paddingHorizontal: 20,
    paddingTop: 10,
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(52, 211, 153, 0.35)',
    backgroundColor: '#FFFFFF',
  },
  editorFooterMinimal: {
    borderTopColor: MINIMAL_UI.divider,
  },
  statusBanner: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(248, 113, 113, 0.45)',
    backgroundColor: 'rgba(127, 29, 29, 0.35)',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  statusBannerText: {
    color: '#FECACA',
    fontSize: 13,
    lineHeight: 18,
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(248, 113, 113, 0.55)',
    backgroundColor: 'rgba(127, 29, 29, 0.28)',
    paddingVertical: 12,
    width: '100%',
    maxWidth: '100%',
  },
  deleteButtonMinimal: {
    borderColor: MINIMAL_UI.blueDark,
    backgroundColor: MINIMAL_UI.background,
  },
  deleteButtonText: {
    color: '#FCA5A5',
    fontWeight: '700',
    fontSize: 14,
  },
  deleteButtonTextMinimal: {
    color: MINIMAL_UI.blueDark,
  },
  deleteConfirmBox: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(248, 113, 113, 0.55)',
    backgroundColor: 'rgba(127, 29, 29, 0.22)',
    padding: 12,
    gap: 8,
  },
  deleteConfirmTitle: {
    color: '#FECACA',
    fontSize: 13,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  deleteConfirmText: {
    color: '#FCA5A5',
    fontSize: 13,
    lineHeight: 18,
  },
  deleteConfirmActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  deleteConfirmNoButton: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.35)',
    paddingVertical: 11,
    alignItems: 'center',
  },
  deleteConfirmNoText: {
    color: '#3A96DD',
    fontWeight: '700',
  },
  deleteConfirmYesButton: {
    flex: 1,
    borderRadius: 10,
    backgroundColor: '#DC2626',
    paddingVertical: 11,
    alignItems: 'center',
  },
  deleteConfirmYesText: {
    color: '#FFF',
    fontWeight: '800',
  },
  editorActions: {
    flexDirection: 'row',
    gap: 10,
  },
  actionPressed: {
    opacity: 0.85,
  },
  cancelButton: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.35)',
    paddingVertical: 14,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#3A96DD',
    fontWeight: '700',
  },
  saveButton: {
    flex: 1,
    borderRadius: 12,
    backgroundColor: '#3A96DD',
    borderWidth: 1,
    borderColor: '#1B4F8A',
    paddingVertical: 14,
    alignItems: 'center',
  },
  saveButtonPressed: {
    opacity: 0.88,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 15,
  },
});
