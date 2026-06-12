import {
  emptyMaintenanceEventForm,
  formFromMaintenanceEvent,
  formatEventTimeInputMask,
  summarizeMaintenanceEvent,
  isMaintenanceEventFormDateInPast,
  validateMaintenanceEventForm,
  type MaintenanceEventFormState,
} from '@/lib/maintenanceEventForm';
import { ActiveScreenBadge } from '@/components/ui/ActiveScreenBadge';
import { MonthlyDatePickerModal } from '@/components/ui/MonthlyDatePickerModal';
import { CarouselFooterNav } from '@/components/ui/CarouselFooterNav';
import { EventsGanttChart } from '@/components/EventsGanttChart';
import { MaintenanceQuorumPresenceCard } from '@/components/MaintenanceQuorumPresenceCard';
import { MaintenanceScaleTypesCard } from '@/components/MaintenanceScaleTypesCard';
import { MaintenanceScaleVolunteersCard } from '@/components/MaintenanceScaleVolunteersCard';
import { MaintenanceAccessControlCard } from '@/components/MaintenanceAccessControlCard';
import { MaintenanceFinancialsCard } from '@/components/MaintenanceFinancialsCard';
import { MaintenancePastoralCareCard } from '@/components/MaintenancePastoralCareCard';
import { MaintenancePastoralRoleChangeCard } from '@/components/MaintenancePastoralRoleChangeCard';
import { MaintenanceFamilyReceptionCard } from '@/components/MaintenanceFamilyReceptionCard';
import { MaintenanceProfileCadastroCard } from '@/components/MaintenanceProfileCadastroCard';
import { MaintenanceScalesCard } from '@/components/MaintenanceScalesCard';
import { MaintenanceSalaMonitorCard } from '@/components/MaintenanceSalaMonitorCard';
import { QuorumCheckinRegistryTable } from '@/components/QuorumCheckinRegistryTable';
import { ACCESS_SCREEN, sessionHasAccess } from '@/lib/accessControl';
import { resolveMaintenancePanelAccessResourceKey } from '@/lib/screenAccessResourceKeys';
import { useShowAclTechnicalKeys } from '@/hooks/useShowAclTechnicalKeys';
import {
  checkSessionIsSuperAdmin,
  sessionCanAccessAccessControlPanel,
} from '@/lib/maintenanceAccessControlApi';
import { loadPastoralCarePanelAccess } from '@/lib/pastoralAccess';
import { sessionCanAccessPastoralRoleChangePanel } from '@/lib/pastoralRoleChangeApi';
import {
  loadMaintenanceScalePanelAccess,
  type MaintenanceScalePanelContent,
} from '@/lib/scaleAccess';
import {
  getStoredProfileId,
  getStoredUserPhone,
  repairUserSessionReference,
} from '@/lib/userSession';
import {
  ensureEventsOptionalColumns,
  isRequerQuorumColumnAvailable,
  isTotemAtivoColumnAvailable,
  REQUER_QUORUM_COLUMN_SQL_HINT,
  TOTEM_COLUMN_SQL_HINT,
} from '@/lib/eventsColumnSupport';
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
import {
  MAINTENANCE_SHORTCUT_ICON_ACTIVE_COLOR,
  MAINTENANCE_SHORTCUT_ICON_COLORS,
  MAINTENANCE_SHORTCUT_ICONS,
  type MaintenancePanelContent,
} from '@/lib/maintenanceShortcutIcons';
import {
  computeMaintenancePanelInsets,
  UI_COLORS,
  UI_MAINTENANCE_PANEL_BORDERS,
  UI_PANEL_TYPO,
  UI_RADIUS,
  UI_SPACING,
} from '@/lib/uiTokens';
import { confirmDialog } from '@/lib/confirmDialog';
import { loadSessionProfile } from '@/lib/loadSessionProfile';
import {
  deleteMaintenanceEvent,
  replicateMaintenanceEventFromRecord,
  saveMaintenanceEvent,
} from '@/lib/saveMaintenanceEvent';
import { useFamilyReceptionSuperAdminNotifier } from '@/hooks/useFamilyReceptionSuperAdminNotifier';
import { useMaintenanceEvents, type MaintenanceEvent } from '@/hooks/useMaintenanceEvents';
import { useQuorumRegistry } from '@/hooks/useQuorumRegistry';
import { FontAwesome, MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Keyboard,
  Platform,
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

/** Mesmas cores do card Check In (dashboard). */
const ROOM_CHIP_KIDS_ACTIVE: ViewStyle = {
  backgroundColor: 'rgba(250, 204, 21, 0.12)',
  borderColor: 'rgba(250, 204, 21, 0.35)',
};
const ROOM_CHIP_TEENS_ACTIVE: ViewStyle = {
  backgroundColor: 'rgba(239, 68, 68, 0.12)',
  borderColor: 'rgba(239, 68, 68, 0.35)',
};

/** Fundo distinto do dashboard principal (degradê azul ardósia `#1e3a5f` → `#020617`). */
const MAINTENANCE_SCREEN_GRADIENT = ['#422006', '#1c1917'] as const;
const FOOTER_NAV_REPEAT_MS = 500;

const STATIC_MAINTENANCE_PANEL_INSETS = computeMaintenancePanelInsets(390);

type MaintenanceCarouselCard = {
  id: string;
  title: string;
  content:
    | 'menu'
    | 'events'
    | 'events_gantt'
    | 'sala_monitor'
    | 'quorum_presence'
    | 'scale_types'
    | 'scale_volunteers'
    | 'scales'
    | 'pastoral_care'
    | 'mudanca_papeis'
    | 'profile_cadastro'
    | 'family_reception'
    | 'financials'
    | 'access_control';
};

type MaintenanceShortcut = {
  id: string;
  label: string;
  content: MaintenancePanelContent;
};

const formatDisplayName = (fullName: string) => {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);

  if (parts.length <= 1) {
    return parts[0] ?? fullName;
  }

  return `${parts[0]} ${parts[parts.length - 1]}`;
};

const MAINTENANCE_PANEL_CARDS: MaintenanceCarouselCard[] = [
  { id: '1', title: 'Programação de Eventos', content: 'events' },
  { id: '2', title: 'Cronograma de Eventos', content: 'events_gantt' },
  { id: '3', title: 'Sala(s) - Check In', content: 'sala_monitor' },
  { id: '5', title: 'Tipos de Escala', content: 'scale_types' },
  { id: '6', title: 'Servos em Disponibilidade', content: 'scale_volunteers' },
  { id: '7', title: 'Programação de Escalas', content: 'scales' },
  { id: '8', title: 'Cuidado Pastoral', content: 'pastoral_care' },
  { id: '9', title: 'Informações Financeiras', content: 'financials' },
  { id: '4', title: 'Lista de Presença', content: 'quorum_presence' },
  { id: '11', title: 'Cadastro de Usuário', content: 'profile_cadastro' },
  { id: '12', title: 'Recepção Familiar', content: 'family_reception' },
  { id: '10', title: 'Controle de Acesso', content: 'access_control' },
  { id: '13', title: 'Mudança de Papéis', content: 'mudanca_papeis' },
];

type FeatureToggleProps = {
  label: string;
  value: boolean;
  onValueChange: (next: boolean) => void;
  activeStyle: ViewStyle;
  roomDot?: 'kids' | 'teens';
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

  return message;
};

const FeatureToggle = ({ label, value, onValueChange, activeStyle, roomDot }: FeatureToggleProps) => (
  <TouchableOpacity
    style={[styles.featureChip, value && activeStyle]}
    onPress={() => onValueChange(!value)}
    activeOpacity={0.85}
  >
    {roomDot ? (
      <View
        style={[
          styles.roomDot,
          roomDot === 'kids' ? styles.roomDotKids : styles.roomDotTeens,
        ]}
      />
    ) : null}
    <Text style={[styles.featureChipText, value && styles.featureChipTextActive]}>{label}</Text>
  </TouchableOpacity>
);

type SimNaoToggleProps = {
  value: boolean;
  onValueChange: (next: boolean) => void;
  disabled?: boolean;
};

const SimNaoToggle = ({ value, onValueChange, disabled }: SimNaoToggleProps) => (
  <View style={styles.totemBlock}>
    <View style={styles.totemChoiceRow}>
      <TouchableOpacity
        style={[
          styles.totemChoiceButton,
          value && styles.totemChoiceButtonSimActive,
        ]}
        onPress={() => onValueChange(true)}
        activeOpacity={0.85}
        disabled={disabled}
      >
        <Text style={[styles.totemChoiceText, value && styles.totemChoiceTextActive]}>Sim</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[
          styles.totemChoiceButton,
          !value && styles.totemChoiceButtonNaoActive,
        ]}
        onPress={() => onValueChange(false)}
        activeOpacity={0.85}
        disabled={disabled}
      >
        <Text style={[styles.totemChoiceText, !value && styles.totemChoiceTextActive]}>Não</Text>
      </TouchableOpacity>
    </View>
  </View>
);

export default function MaintenanceDashboard() {
  const { width: pageWidth, height: windowHeight } = useWindowDimensions();
  const previousPageWidthRef = useRef(pageWidth);
  const carouselPageStyle = useMemo(() => ({ width: pageWidth }), [pageWidth]);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { events, loading, error, refetch } = useMaintenanceEvents();
  const safeEvents = events ?? [];
  const hasQuorumEvent = useMemo(
    () => safeEvents.some((event) => event.requer_quorum === true),
    [safeEvents]
  );
  const quorumPresenceShortcutEnabled = !loading && hasQuorumEvent;

  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [form, setForm] = useState<MaintenanceEventFormState>(emptyMaintenanceEventForm);
  const [isSaving, setIsSaving] = useState(false);
  const [isReplicatingSeven, setIsReplicatingSeven] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteConfirmPending, setDeleteConfirmPending] = useState(false);
  /** ID/nome fixados ao abrir a confirmação — evita apagar outro evento se a seleção mudar. */
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [deleteTargetName, setDeleteTargetName] = useState('');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [eventDatePickerVisible, setEventDatePickerVisible] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const carouselRef = useRef<FlatList<MaintenanceCarouselCard>>(null);
  const currentIndexRef = useRef(0);
  const footerNavRepeatIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const footerNavRepeatActiveRef = useRef(false);
  const pendingMaintenancePanelRef = useRef<MaintenancePanelContent | null>(null);
  const activeMaintenanceContentRef = useRef<MaintenancePanelContent>('menu');
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
  const [totemSchemaReady, setTotemSchemaReady] = useState(isTotemAtivoColumnAvailable());
  const [quorumSchemaReady, setQuorumSchemaReady] = useState(isRequerQuorumColumnAvailable());
  const [quorumRegistrySchemaMissing, setQuorumRegistrySchemaMissing] = useState(
    !isQuorumRegistryTableAvailable()
  );

  useFamilyReceptionSuperAdminNotifier(
    accessState === 'allowed' && canMonitorFamilyReception
  );

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
    refetch: refetchQuorumRegistry,
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
    }
  }, [loading, safeEvents.length]);

  useFocusEffect(
    useCallback(() => {
      let active = true;

      void ensureEventsOptionalColumns().then(({ totem, quorum }) => {
        if (active) {
          setTotemSchemaReady(totem);
          setQuorumSchemaReady(quorum);
        }
      });

      void ensureEventQuorumRegistry().then((ready) => {
        if (active) {
          setQuorumRegistrySchemaMissing(!ready);
        }
      });

      void (async () => {
        setAccessState('checking');
        const allowed = await sessionHasAccess('screen', ACCESS_SCREEN.maintenance, 'view');

        if (!active) {
          return;
        }

        if (!allowed) {
          setAccessState('denied');
          Alert.alert(
            'Sem permissão',
            'Você não tem acesso à manutenção do sistema.',
            [{ text: 'OK', onPress: () => router.replace('/(tabs)/dashboard') }]
          );
          return;
        }

        try {
          const [isSuperAdmin, canOpenAccessControlCard, canAccessProfileCadastro] =
            await Promise.all([
              checkSessionIsSuperAdmin(),
              sessionCanAccessAccessControlPanel(),
              sessionHasAccess('screen', 'maintenance.card.profile_cadastro', 'view'),
            ]);

          if (active) {
            setCanManageAccessControl(isSuperAdmin);
            setCanAccessAccessControlCard(canOpenAccessControlCard);
            setCanMonitorFamilyReception(isSuperAdmin || canAccessProfileCadastro);
          }
        } catch {
          if (active) {
            setCanManageAccessControl(false);
            setCanAccessAccessControlCard(false);
            setCanMonitorFamilyReception(false);
          }
        }

        try {
          let profileId = await getStoredProfileId();

          if (!profileId) {
            profileId = await repairUserSessionReference();
          }

          if (active && profileId) {
            const [panelAccess, pastoralCareAccess, pastoralRoleChangeAccess] = await Promise.all([
              loadMaintenanceScalePanelAccess(profileId),
              loadPastoralCarePanelAccess(profileId),
              sessionCanAccessPastoralRoleChangePanel(),
            ]);
            setScalePanelAccess(panelAccess);
            setCanAccessPastoralCare(pastoralCareAccess);
            setCanAccessPastoralRoleChange(pastoralRoleChangeAccess);
          } else if (active) {
            setScalePanelAccess({});
            setCanAccessPastoralCare(false);
            setCanAccessPastoralRoleChange(false);
          }
        } catch {
          if (active) {
            setScalePanelAccess({});
            setCanAccessPastoralCare(false);
            setCanAccessPastoralRoleChange(false);
          }
        }

        if (active) {
          setAccessState('allowed');
        }

        const phone = await getStoredUserPhone();
        if (active && phone) {
          const sessionProfile = await loadSessionProfile(phone);
          if (active) {
            const profileName = sessionProfile?.full_name?.trim();
            if (profileName) {
              setHeaderUserName(formatDisplayName(profileName));
            }
          }
        }
      })();

      return () => {
        active = false;
      };
    }, [router])
  );

  const handleSave = useCallback(async () => {
    Keyboard.dismiss();
    setStatusMessage(null);

    const validation = validateMaintenanceEventForm(form);
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
      Toast.show({
        type: 'success',
        text1: wasCreating ? 'Evento criado' : 'Evento atualizado',
        text2: 'Alterações gravadas com sucesso.',
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
  }, [closeEditor, form, refetch, selectedEventId]);

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

      if (card.content === 'mudanca_papeis') {
        return canAccessPastoralRoleChange || canManageAccessControl;
      }

      if (card.content === 'profile_cadastro' || card.content === 'family_reception') {
        return canManageAccessControl;
      }

      return true;
    });
  }, [
    canAccessAccessControlCard,
    canAccessPastoralCare,
    canAccessPastoralRoleChange,
    canManageAccessControl,
    scalePanelAccess,
  ]);

  const maintenanceCarouselCards = useMemo<MaintenanceCarouselCard[]>(
    () => [{ id: 'menu', title: 'Manutenção', content: 'menu' }, ...maintenancePanelCards],
    [maintenancePanelCards]
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

  const cardHeight = useMemo(
    () => computeDashboardCardHeight(windowHeight, insets.top, insets.bottom),
    [insets.bottom, insets.top, windowHeight]
  );

  const panelCardSizeStyle = useMemo(
    () => buildDashboardPanelCardSizeStyle(pageWidth, cardHeight),
    [cardHeight, pageWidth]
  );

  const scrollToMaintenanceCard = useCallback((targetIndex: number, animated = false) => {
    if (targetIndex < 0 || targetIndex >= maintenanceCardCount || pageWidth <= 0) {
      return;
    }

    currentIndexRef.current = targetIndex;
    setCurrentIndex(targetIndex);

    const list = carouselRef.current;
    if (!list) {
      return;
    }

    list.scrollToIndex({ index: targetIndex, animated, viewPosition: 0 });
    requestAnimationFrame(() => {
      list.scrollToOffset({
        offset: targetIndex * pageWidth,
        animated: false,
      });
    });
  }, [maintenanceCardCount, pageWidth]);

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
    if (currentIndex < maintenanceCardCount) {
      return;
    }

    const nextIndex = Math.max(maintenanceCardCount - 1, 0);
    scrollToMaintenanceCard(nextIndex, false);
  }, [currentIndex, maintenanceCardCount, scrollToMaintenanceCard]);

  useEffect(() => {
    const content = maintenanceCarouselCards[currentIndex]?.content;

    if (content && content !== 'menu') {
      activeMaintenanceContentRef.current = content as MaintenancePanelContent;
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
      if (info.index < 0 || info.index >= maintenanceCardCount || pageWidth <= 0) {
        return;
      }

      carouselRef.current?.scrollToOffset({
        offset: info.index * pageWidth,
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
    [maintenanceCardCount, pageWidth]
  );

  useEffect(() => {
    currentIndexRef.current = currentIndex;
  }, [currentIndex]);

  useEffect(() => {
    if (previousPageWidthRef.current === pageWidth) {
      return;
    }

    previousPageWidthRef.current = pageWidth;
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
      const index = Math.round(event.nativeEvent.contentOffset.x / pageWidth);
      if (index >= 0 && index < maintenanceCardCount && index !== currentIndex) {
        setCurrentIndex(index);
      }
    },
    [currentIndex, maintenanceCardCount, pageWidth]
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

  const renderCarouselItem = useCallback(
    ({ item, index }: { item: MaintenanceCarouselCard; index: number }) => (
      <View style={[styles.cardWrapper, carouselPageStyle]}>
        <View
          style={[
            styles.panelCard,
            panelCardSizeStyle,
            item.content === 'sala_monitor' && styles.panelCardSala,
            item.content === 'events_gantt' && styles.panelCardGantt,
            item.content === 'quorum_presence' && styles.panelCardQuorumPresence,
            item.content === 'scale_types' && styles.panelCardScaleTypes,
            item.content === 'scale_volunteers' && styles.panelCardScaleVolunteers,
            item.content === 'scales' && styles.panelCardScales,
            item.content === 'pastoral_care' && styles.panelCardPastoralCare,
            item.content === 'mudanca_papeis' && styles.panelCardPastoralRoleChange,
            item.content === 'profile_cadastro' && styles.panelCardProfileCadastro,
            item.content === 'family_reception' && styles.panelCardFamilyReception,
            item.content === 'financials' && styles.panelCardFinancials,
            item.content === 'access_control' && styles.panelCardAccessControl,
            item.content === 'menu' && styles.panelCardMenu,
          ]}
        >
          {item.content === 'menu' ? (
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
            />
          ) : item.content === 'scale_types' ? (
            <MaintenanceScaleTypesCard isActive={currentIndex === index} panelHeight={cardHeight} />
          ) : item.content === 'scale_volunteers' ? (
            <MaintenanceScaleVolunteersCard
              isActive={currentIndex === index}
              panelHeight={cardHeight}
            />
          ) : item.content === 'scales' ? (
            <MaintenanceScalesCard isActive={currentIndex === index} panelHeight={cardHeight} />
          ) : item.content === 'pastoral_care' ? (
            <MaintenancePastoralCareCard isActive={currentIndex === index} panelHeight={cardHeight} />
          ) : item.content === 'mudanca_papeis' ? (
            <MaintenancePastoralRoleChangeCard isActive={currentIndex === index} panelHeight={cardHeight} />
          ) : item.content === 'profile_cadastro' ? (
            <MaintenanceProfileCadastroCard isActive={currentIndex === index} panelHeight={cardHeight} />
          ) : item.content === 'family_reception' ? (
            <MaintenanceFamilyReceptionCard isActive={currentIndex === index} panelHeight={cardHeight} />
          ) : item.content === 'financials' ? (
            <MaintenanceFinancialsCard isActive={currentIndex === index} panelHeight={cardHeight} />
          ) : item.content === 'access_control' ? (
            <MaintenanceAccessControlCard isActive={currentIndex === index} panelHeight={cardHeight} />
          ) : item.content === 'sala_monitor' ? (
            <MaintenanceSalaMonitorCard embedded panelHeight={cardHeight} />
          ) : item.content === 'events_gantt' ? (
            <View style={styles.ganttPanel}>
              <Text style={styles.ganttPanelTitle}>Cronograma de Eventos</Text>
              <View style={styles.ganttPanelSubtitleSpacer} />
              <EventsGanttChart
                events={safeEvents}
                loading={loading}
                error={error}
                onRetry={() => void refetch()}
                onEventPress={handleGanttEventPress}
              />
            </View>
          ) : item.content === 'events' ? (
            <ScrollView
              style={styles.panelScroll}
              contentContainerStyle={styles.panelScrollContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="always"
            >
              <>
                <TouchableOpacity
                  style={styles.newEventButton}
                  onPress={startNewEvent}
                  activeOpacity={0.85}
                  disabled={deleteConfirmPending || isBusy}
                >
                  <FontAwesome name="plus" size={16} color="#0f172a" />
                  <Text style={styles.newEventButtonText}>Novo evento</Text>
                </TouchableOpacity>

                <View style={styles.listSection}>
                  <Text style={styles.sectionTitle}>Eventos cadastrados</Text>

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
                        summary: summarizeMaintenanceEvent(event),
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
                            deleteConfirmPending && styles.eventCardDisabled,
                          ]}
                          onPress={() => startEditEvent(event)}
                          disabled={deleteConfirmPending || isBusy}
                          activeOpacity={0.9}
                        >
                          <View style={styles.eventCardHeader}>
                            <Text style={styles.eventCardName} numberOfLines={2}>
                              {event.name}
                            </Text>
                            <View
                              style={[
                                styles.statusBadge,
                                summary.isPublished
                                  ? styles.statusBadgeActive
                                  : styles.statusBadgeInactive,
                              ]}
                            >
                              <Text
                                style={[
                                  styles.statusBadgeText,
                                  summary.isPublished
                                    ? styles.statusBadgeTextActive
                                    : styles.statusBadgeTextInactive,
                                ]}
                              >
                                {summary.isPublished ? 'Publicado' : 'Rascunho'}
                              </Text>
                            </View>
                          </View>
                          <Text style={styles.eventCardMeta}>{summary.dateLabel}</Text>
                          <Text style={styles.eventCardMeta}>
                            {summary.localLabel} · {summary.capacityLabel}
                          </Text>
                          <Text style={styles.eventCardFlags}>{summary.flagsLabel}</Text>
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
    ),
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
      carouselPageStyle,
      panelCardSizeStyle,
      quorumPresenceShortcutEnabled,
      quorumRegistrySchemaMissing,
      refetch,
      scrollToMaintenancePanel,
      startEditEvent,
      startNewEvent,
    ]
  );

  if (accessState === 'checking' || accessState === 'denied') {
    return (
      <LinearGradient colors={MAINTENANCE_SCREEN_GRADIENT} style={styles.container}>
        <SafeAreaView style={styles.accessGate} edges={['top', 'left', 'right', 'bottom']}>
          <ActivityIndicator color="#fbbf24" size="large" />
          {accessState === 'denied' ? (
            <Text style={styles.accessGateText}>Redirecionando...</Text>
          ) : null}
        </SafeAreaView>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={MAINTENANCE_SCREEN_GRADIENT} style={styles.container}>
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
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

        <View style={styles.mainStage}>
          <View style={styles.carouselStage}>
            <View style={styles.listContainer}>
              <FlatList
                ref={carouselRef}
                style={styles.carouselFlatList}
                data={maintenanceCarouselCards}
                extraData={currentIndex}
                horizontal
                pagingEnabled
                scrollEnabled={false}
                keyboardShouldPersistTaps="handled"
                showsHorizontalScrollIndicator={false}
                initialNumToRender={maintenanceCardCount}
                maxToRenderPerBatch={maintenanceCardCount}
                windowSize={Math.max(5, maintenanceCardCount)}
                removeClippedSubviews={Platform.OS !== 'web'}
                onScroll={handleCarouselScroll}
                onScrollToIndexFailed={handleCarouselScrollToIndexFailed}
                scrollEventThrottle={16}
                keyExtractor={(item) => item.id}
                getItemLayout={(_, index) => ({
                  length: pageWidth,
                  offset: pageWidth * index,
                  index,
                })}
                snapToAlignment="start"
                snapToInterval={pageWidth}
                snapToOffsets={maintenanceCarouselCards.map((_, index) => index * pageWidth)}
                decelerationRate="fast"
                disableIntervalMomentum
                renderItem={renderCarouselItem}
              />
            </View>

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
          </View>

          {showEditor ? (
            <View style={styles.editorOverlay}>
              <ScrollView
                style={styles.scroll}
                contentContainerStyle={[
                  styles.scrollContent,
                  styles.scrollContentWithFooter,
                  { paddingBottom: 16 },
                ]}
                keyboardShouldPersistTaps="always"
                showsVerticalScrollIndicator={false}
              >
            <View style={styles.editorSection}>
              <View style={styles.editorCard}>
                <Text style={styles.fieldLabel}>Nome do evento</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Ex.: Culto de domingo"
                  placeholderTextColor="#64748B"
                  value={form.name}
                  onChangeText={(text) => patchForm({ name: text })}
                />

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

                <Text style={styles.fieldLabel}>Local do evento</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Ex.: Templo principal"
                  placeholderTextColor="#64748B"
                  value={form.eventLocal}
                  onChangeText={(text) => patchForm({ eventLocal: text })}
                />

                <Text style={styles.fieldLabel}>Capacidade (vagas) *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Obrigatório — ex.: 200"
                  placeholderTextColor="#64748B"
                  value={form.maxCapacity}
                  keyboardType="number-pad"
                  onChangeText={(text) => patchForm({ maxCapacity: text.replace(/\D/g, '') })}
                />

                {!totemSchemaReady && !loading ? (
                  <View style={styles.totemSqlWarning}>
                    <Text style={styles.totemSqlWarningText}>
                      Não foi possível preparar a coluna totem_ativo automaticamente. O botão
                      Sim/Não só será salvo após habilitar a migração no Supabase.
                    </Text>
                    <Text style={styles.totemSqlWarningHint}>{TOTEM_COLUMN_SQL_HINT}</Text>
                  </View>
                ) : null}

                <View style={styles.featureLabelRow}>
                  <Text style={styles.fieldLabel}>Salas e recursos</Text>
                  <Text style={styles.totemFieldLabel}>Ativação de Totem</Text>
                  <Text style={styles.totemFieldLabel}>Requer Quorum</Text>
                </View>
                <View style={styles.featureRow}>
                  <View style={styles.featureRowChips}>
                    <FeatureToggle
                      label="Kids"
                      value={form.kidsRoom}
                      onValueChange={(kidsRoom) => patchForm({ kidsRoom })}
                      activeStyle={ROOM_CHIP_KIDS_ACTIVE}
                      roomDot="kids"
                    />
                    <FeatureToggle
                      label="Teens"
                      value={form.teensRoom}
                      onValueChange={(teensRoom) => patchForm({ teensRoom })}
                      activeStyle={ROOM_CHIP_TEENS_ACTIVE}
                      roomDot="teens"
                    />
                  </View>
                  <View style={styles.featureToggleGroup}>
                    <SimNaoToggle
                      value={form.totemAtivo}
                      onValueChange={(totemAtivo) => patchForm({ totemAtivo })}
                      disabled={isBusy}
                    />
                    <SimNaoToggle
                      value={form.requerQuorum}
                      onValueChange={(requerQuorum) => patchForm({ requerQuorum })}
                      disabled={isBusy}
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

                <View style={styles.publishRow}>
                  <View style={styles.publishCopy}>
                    <Text style={styles.fieldLabel}>Publicação</Text>
                    <Text style={styles.publishHint}>
                      {form.isPublished
                        ? 'Publicado — visível no dashboard e cronograma (verde)'
                        : 'Rascunho — oculto para membros; no cronograma aparece em laranja'}
                    </Text>
                  </View>
                  <Switch
                    value={form.isPublished}
                    onValueChange={(isPublished) => patchForm({ isPublished })}
                    trackColor={{ false: '#475569', true: '#22C55E' }}
                    thumbColor="#F8FAFC"
                  />
                </View>
                {isEventDateInPast && form.isPublished ? (
                  <Text style={styles.publishPastWarning}>
                    Esta data é anterior a hoje. Só eventos de hoje ou futuros permanecem
                    publicados — confira o ano no calendário (ex.: 2026, não 2021).
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
                        <ActivityIndicator color="#C7D2FE" size="small" />
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
          <View style={[styles.editorFooter, { paddingBottom: insets.bottom + 12 }]}>
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
            ) : !isCreating ? (
              <Pressable
                style={({ pressed }) => [
                  styles.deleteButton,
                  (pressed || isBusy) && styles.actionPressed,
                ]}
                onPress={beginDeleteConfirm}
                disabled={isBusy}
                accessibilityRole="button"
                accessibilityLabel="Apagar evento"
              >
                <FontAwesome name="trash-o" size={16} color="#FCA5A5" />
                <Text style={styles.deleteButtonText}>Apagar evento</Text>
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
      </SafeAreaView>
    </LinearGradient>
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
    color: '#94A3B8',
    fontSize: 14,
  },
  header: { paddingHorizontal: 24, paddingTop: 10, paddingBottom: 8 },
  welcomeBox: {
    width: '100%',
    borderRadius: 18,
    backgroundColor: 'rgba(41, 37, 36, 0.72)',
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.22)',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 4,
  },
  welcomeText: {
    color: '#94A3B8',
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
    color: '#fcd34d',
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
  },
  carouselStage: {
    flex: 1,
    minHeight: 0,
  },
  editorOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 2,
    backgroundColor: '#1c1917',
  },
  listContainer: {
    flex: 1,
    minHeight: 0,
  },
  carouselFlatList: {
    flex: 1,
    minHeight: 0,
  },
  cardWrapper: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 0,
    paddingBottom: 8,
  },
  panelCard: {
    borderRadius: STATIC_MAINTENANCE_PANEL_INSETS.borderRadius,
    borderWidth: 1,
    borderColor: UI_MAINTENANCE_PANEL_BORDERS.default,
    backgroundColor: UI_COLORS.maintenanceSurface,
    overflow: 'hidden',
  },
  panelCardSala: {
    borderColor: UI_MAINTENANCE_PANEL_BORDERS.sala,
  },
  panelCardGantt: {
    borderColor: UI_MAINTENANCE_PANEL_BORDERS.gantt,
  },
  panelCardQuorumPresence: {
    borderColor: UI_MAINTENANCE_PANEL_BORDERS.quorum,
    backgroundColor: 'rgba(15, 23, 42, 0.35)',
    padding: STATIC_MAINTENANCE_PANEL_INSETS.innerPadding,
  },
  panelCardScaleTypes: {
    borderColor: UI_MAINTENANCE_PANEL_BORDERS.scaleTypes,
    padding: STATIC_MAINTENANCE_PANEL_INSETS.innerPadding,
  },
  panelCardScaleVolunteers: {
    borderColor: UI_MAINTENANCE_PANEL_BORDERS.scaleVolunteers,
    padding: STATIC_MAINTENANCE_PANEL_INSETS.innerPadding,
  },
  panelCardScales: {
    borderColor: UI_MAINTENANCE_PANEL_BORDERS.scales,
    padding: STATIC_MAINTENANCE_PANEL_INSETS.innerPadding,
  },
  panelCardPastoralCare: {
    borderColor: UI_MAINTENANCE_PANEL_BORDERS.pastoral,
    padding: STATIC_MAINTENANCE_PANEL_INSETS.innerPadding,
  },
  panelCardPastoralRoleChange: {
    borderColor: '#FB7185',
    padding: STATIC_MAINTENANCE_PANEL_INSETS.innerPadding,
  },
  panelCardProfileCadastro: {
    borderColor: UI_MAINTENANCE_PANEL_BORDERS.profile,
    padding: STATIC_MAINTENANCE_PANEL_INSETS.innerPadding,
  },
  panelCardFamilyReception: {
    borderColor: '#34D399',
    padding: STATIC_MAINTENANCE_PANEL_INSETS.innerPadding,
  },
  panelCardFinancials: {
    borderColor: UI_MAINTENANCE_PANEL_BORDERS.financials,
    padding: STATIC_MAINTENANCE_PANEL_INSETS.innerPadding,
  },
  panelCardAccessControl: {
    borderColor: UI_MAINTENANCE_PANEL_BORDERS.accessControl,
    padding: STATIC_MAINTENANCE_PANEL_INSETS.innerPadding,
  },
  panelCardMenu: {
    borderColor: UI_MAINTENANCE_PANEL_BORDERS.menu,
    padding: STATIC_MAINTENANCE_PANEL_INSETS.menuPadding,
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
    borderColor: UI_COLORS.borderMuted,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    paddingVertical: UI_SPACING.sm,
    paddingRight: UI_SPACING.md,
    paddingLeft: 0,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  menuShortcutButtonActive: {
    borderColor: '#A5B4FC',
    backgroundColor: 'rgba(99, 102, 241, 0.22)',
  },
  menuShortcutButtonDisabled: {
    opacity: 0.45,
    borderColor: '#334155',
    backgroundColor: 'rgba(30, 41, 59, 0.45)',
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
    color: '#E2E8F0',
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 19,
    textAlign: 'left',
    flex: 1,
    minWidth: 0,
  },
  menuShortcutButtonTextActive: {
    color: '#E0E7FF',
  },
  menuShortcutButtonTextDisabled: {
    color: '#64748B',
  },
  ganttPanel: {
    flex: 1,
    padding: STATIC_MAINTENANCE_PANEL_INSETS.menuPadding,
    minHeight: 0,
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
  scrollContentWithFooter: {
    paddingBottom: 8,
  },
  newEventButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#A5B4FC',
    borderRadius: 14,
    paddingVertical: 14,
  },
  newEventButtonText: {
    color: '#0f172a',
    fontSize: 15,
    fontWeight: '800',
  },
  listSection: {
    gap: 10,
  },
  sectionTitle: {
    color: '#C7D2FE',
    fontSize: 13,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
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
    borderColor: '#818CF8',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  retryButtonText: {
    color: '#C7D2FE',
    fontWeight: '700',
  },
  eventCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(129, 140, 248, 0.35)',
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    padding: 14,
    gap: 6,
  },
  eventCardSelected: {
    borderColor: '#A5B4FC',
    backgroundColor: 'rgba(99, 102, 241, 0.22)',
  },
  eventCardDisabled: {
    opacity: 0.45,
  },
  eventCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  eventCardName: {
    flex: 1,
    color: '#F8FAFC',
    fontSize: 17,
    fontWeight: '700',
  },
  statusBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
  },
  statusBadgeActive: {
    backgroundColor: 'rgba(34, 197, 94, 0.18)',
    borderColor: '#22C55E',
  },
  statusBadgeInactive: {
    backgroundColor: 'rgba(148, 163, 184, 0.14)',
    borderColor: '#64748B',
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
    color: '#94A3B8',
  },
  eventCardMeta: {
    color: '#CBD5E1',
    fontSize: 13,
  },
  eventCardFlags: {
    color: '#A5B4FC',
    fontSize: 12,
    fontWeight: '600',
  },
  emptyText: {
    color: '#94A3B8',
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
    borderColor: 'rgba(129, 140, 248, 0.45)',
    backgroundColor: 'rgba(15, 23, 42, 0.88)',
    padding: 16,
    gap: 10,
  },
  fieldLabel: {
    color: '#C7D2FE',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  input: {
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 12,
    color: '#F8FAFC',
    fontSize: 15,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  dateTimeRow: {
    flexDirection: 'row',
    gap: 10,
  },
  dateTimeField: {
    flex: 1,
  },
  dateInputTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  dateInputText: {
    flex: 1,
    color: '#F8FAFC',
    fontSize: 15,
  },
  dateInputPlaceholder: {
    color: '#64748B',
  },
  featureLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  totemFieldLabel: {
    color: '#C7D2FE',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    textAlign: 'right',
    flexShrink: 0,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  featureRowChips: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    minWidth: 0,
  },
  featureToggleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
  },
  totemBlock: {
    flexShrink: 0,
  },
  totemChoiceRow: {
    flexDirection: 'row',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#475569',
    overflow: 'hidden',
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
  },
  totemChoiceButton: {
    minWidth: 44,
    paddingHorizontal: 14,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  totemChoiceButtonSimActive: {
    backgroundColor: 'rgba(34, 197, 94, 0.22)',
  },
  totemChoiceButtonNaoActive: {
    backgroundColor: 'rgba(100, 116, 139, 0.45)',
  },
  totemChoiceText: {
    color: '#64748B',
    fontSize: 13,
    fontWeight: '700',
  },
  totemChoiceTextActive: {
    color: '#F8FAFC',
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
    gap: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#475569',
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
  },
  roomDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.35)',
  },
  roomDotKids: {
    backgroundColor: '#facc15',
  },
  roomDotTeens: {
    backgroundColor: '#ef4444',
  },
  featureChipText: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '700',
  },
  featureChipTextActive: {
    color: '#E2E8F0',
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
  },
  publishCopy: {
    flex: 1,
    gap: 4,
  },
  publishHint: {
    color: '#94A3B8',
    fontSize: 12,
  },
  publishPastWarning: {
    color: '#FCD34D',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
  },
  replicateSevenSection: {
    gap: 6,
    marginTop: 4,
  },
  replicateSevenButton: {
    alignSelf: 'flex-start',
    minWidth: 56,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(129, 140, 248, 0.55)',
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  replicateSevenButtonText: {
    color: '#E0E7FF',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  replicateSevenHint: {
    color: '#94A3B8',
    fontSize: 12,
    lineHeight: 17,
  },
  editorFooter: {
    paddingHorizontal: 20,
    paddingTop: 10,
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(129, 140, 248, 0.35)',
    backgroundColor: 'rgba(15, 23, 42, 0.95)',
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
  },
  deleteButtonText: {
    color: '#FCA5A5',
    fontWeight: '700',
    fontSize: 14,
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
    borderColor: '#64748B',
    paddingVertical: 11,
    alignItems: 'center',
  },
  deleteConfirmNoText: {
    color: '#CBD5E1',
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
    borderColor: '#475569',
    paddingVertical: 14,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#CBD5E1',
    fontWeight: '700',
  },
  saveButton: {
    flex: 1,
    borderRadius: 12,
    backgroundColor: '#A5B4FC',
    paddingVertical: 14,
    alignItems: 'center',
  },
  saveButtonPressed: {
    opacity: 0.88,
  },
  saveButtonText: {
    color: '#0f172a',
    fontWeight: '800',
    fontSize: 15,
  },
});
