import { DropdownSelect } from '@/components/ui/DropdownSelect';
import { VIGILANCE_SCALES_UI } from '@/lib/dashboardCardThemes';
import { formatPhoneDisplay } from '@/lib/familyRegistration';
import { formatShortName } from '@/lib/formatShortName';
import { formatBrazilDateInput } from '@/lib/inputMasks';
import {
  listProfilesForAccessAdmin,
  type AccessProfileSearchResult,
} from '@/lib/maintenanceAccessControlApi';
import { useMaintenanceSupport } from '@/hooks/useMaintenanceSupport';
import { computeMaintenanceContentHeight, maintenancePanelStyles } from '@/lib/maintenanceCardStyles';
import {
  addMaintenanceSupportUserUpdate,
  createMaintenanceSupportRequest,
  fetchMaintenanceSupportThemes,
  MAINTENANCE_SUPPORT_RECORD_TYPE_LABELS,
  MAINTENANCE_SUPPORT_RECORD_TYPE_OPTIONS,
  MAINTENANCE_SUPPORT_STATUS_LABELS,
  MAINTENANCE_SUPPORT_STATUS_OPTIONS,
  pickMaintenanceSupportImagesFromGallery,
  recordMaintenanceSupportCommunication,
  sendMaintenanceSupportWhatsApp,
  updateMaintenanceSupportTreatment,
  type MaintenanceSupportCommunication,
  type MaintenanceSupportInteraction,
  type MaintenanceSupportLocalImage,
  type MaintenanceSupportRecordType,
  type MaintenanceSupportRequest,
  type MaintenanceSupportStatus,
  type MaintenanceSupportTheme,
} from '@/lib/maintenanceSupportApi';
import { FontAwesome, MaterialIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Toast from 'react-native-toast-message';

type Props = {
  isActive?: boolean;
  panelHeight: number;
  isSuperAdmin?: boolean;
  initialMode?: 'list' | 'new' | 'detail';
  returnOnCreate?: boolean;
  variant?: 'default' | 'vigilance';
  onNavigateBack?: () => void;
  onRequestCreated?: () => void;
};

type TimelineEntry =
  | {
      id: string;
      kind: 'interaction';
      date: string;
      title: string;
      message: string;
      meta: string;
    }
  | {
      id: string;
      kind: 'communication';
      date: string;
      title: string;
      message: string;
      meta: string;
    };

const ACCENT = '#3A96DD';
const DATE_INPUT_PLACEHOLDER = 'dd/mm/aaaa';
const OPENING_INTERACTION_MESSAGE = 'Solicitação aberta pelo usuário.';

const statusTone: Record<MaintenanceSupportStatus, { bg: string; border: string; text: string }> = {
  received: { bg: 'rgba(148, 163, 184, 0.16)', border: '#64748B', text: '#CBD5E1' },
  in_review: { bg: 'rgba(251, 191, 36, 0.16)', border: '#F59E0B', text: '#FDE68A' },
  in_development: { bg: 'rgba(56, 189, 248, 0.16)', border: '#38BDF8', text: '#BAE6FD' },
  awaiting_validation: { bg: 'rgba(168, 85, 247, 0.16)', border: '#A855F7', text: '#E9D5FF' },
  completed: { bg: 'rgba(34, 197, 94, 0.16)', border: '#22C55E', text: '#BBF7D0' },
  not_applicable: { bg: 'rgba(248, 113, 113, 0.16)', border: '#F87171', text: '#FECACA' },
};

const formatDateTime = (value: string | null | undefined) => {
  if (!value) {
    return '—';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatDate = (value: string | null | undefined) => {
  if (!value) {
    return '—';
  }

  const trimmed = value.trim();
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(trimmed)) {
    return trimmed;
  }

  const datePart = trimmed.split('T')[0];
  const [year, month, day] = datePart.split('-');
  if (year && month && day) {
    return `${day}/${month}/${year}`;
  }

  return trimmed;
};

const resolveEstimatedDateLabel = (value: string | null | undefined) => {
  if (!value?.trim()) {
    return null;
  }

  return formatDate(value);
};

type CommunicationMessageOverrides = {
  description?: string;
  developerAction?: string;
  developerGuidance?: string;
  estimatedCompletionDate?: string;
  status?: MaintenanceSupportStatus;
  pendingUserUpdateMessage?: string;
};

const buildDefaultCommunicationMessage = (
  request: MaintenanceSupportRequest,
  overrides?: CommunicationMessageOverrides
) => {
  const description = (overrides?.description ?? request.description).trim();
  const developerAction = (overrides?.developerAction ?? request.developer_action ?? '').trim();
  const developerGuidance = (
    overrides?.developerGuidance ?? request.developer_guidance ?? ''
  ).trim();
  const status = overrides?.status ?? request.status;
  const estimatedDateLabel = resolveEstimatedDateLabel(
    overrides?.estimatedCompletionDate ?? request.estimated_completion_date
  );

  const lines: string[] = [
    `Olá, ${request.requester_name}. Atualização da sua solicitação em Sugestões e Melhorias.`,
    `Status: ${MAINTENANCE_SUPPORT_STATUS_LABELS[status]}.`,
  ];

  if (description) {
    lines.push('', `Sugestão (${formatDate(request.created_at)}):`, description);
  }

  const userUpdates = request.interactions.filter(
    (interaction) =>
      interaction.actor_role === 'user'
      && interaction.channel === 'app'
      && interaction.message.trim()
      && interaction.message.trim() !== OPENING_INTERACTION_MESSAGE
  );

  userUpdates.forEach((interaction) => {
    lines.push(
      '',
      `Atualização do usuário (${formatDate(interaction.created_at)}):`,
      interaction.message.trim()
    );
  });

  const pendingUserUpdate = overrides?.pendingUserUpdateMessage?.trim();
  if (pendingUserUpdate) {
    lines.push('', `Atualização do usuário (${formatDate(new Date().toISOString())}):`, pendingUserUpdate);
  }

  if (developerAction) {
    const actionDate = request.responded_at ?? request.updated_at;
    lines.push(
      '',
      `Ação tomada ou planejada (${formatDate(actionDate)}):`,
      developerAction
    );
  }

  if (estimatedDateLabel && estimatedDateLabel !== '—') {
    lines.push('', `Previsão de implementação/conclusão: ${estimatedDateLabel}`);
  }

  if (developerGuidance) {
    lines.push('', 'Orientações detalhadas ao usuário:', developerGuidance);
  }

  return lines.join('\n');
};

const formatEstimatedDateInput = (value: string | null | undefined) => {
  if (!value?.trim()) {
    return '';
  }

  const isoMatch = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    return `${isoMatch[3]}/${isoMatch[2]}/${isoMatch[1]}`;
  }

  return formatBrazilDateInput(value);
};

const normalizeDateInput = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const brMatch = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (brMatch) {
    return `${brMatch[3]}-${brMatch[2]}-${brMatch[1]}`;
  }

  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    return trimmed;
  }

  throw new Error('Informe a previsão no formato dd/mm/aaaa.');
};

const buildTimeline = (request: MaintenanceSupportRequest): TimelineEntry[] => {
  const interactions: TimelineEntry[] = request.interactions.map(
    (interaction: MaintenanceSupportInteraction) => ({
      id: `interaction-${interaction.id}`,
      kind: 'interaction',
      date: interaction.created_at,
      title:
        interaction.actor_role === 'developer'
          ? 'Desenvolvedor'
          : interaction.actor_role === 'system'
            ? 'Sistema'
            : 'Usuário',
      message: interaction.message,
      meta: `${interaction.actor_name} · ${interaction.channel}`,
    })
  );

  const communications: TimelineEntry[] = request.communications.map(
    (communication: MaintenanceSupportCommunication) => ({
      id: `communication-${communication.id}`,
      kind: 'communication',
      date: communication.sent_at,
      title: communication.channel === 'whatsapp' ? 'WhatsApp' : 'Comunicação no app',
      message: communication.message,
      meta: `${communication.delivery_status}${communication.authorized ? '' : ' · sem autorização'}`,
    })
  );

  return [...interactions, ...communications].sort((left, right) =>
    left.date.localeCompare(right.date)
  );
};

const LocalImageChip = ({
  image,
  onRemove,
  chipStyle,
  previewStyle,
  removeStyle,
}: {
  image: MaintenanceSupportLocalImage;
  onRemove: () => void;
  chipStyle: object;
  previewStyle: object;
  removeStyle: object;
}) => (
  <View style={chipStyle}>
    <Image source={{ uri: image.uri }} style={previewStyle} contentFit="cover" />
    <TouchableOpacity style={removeStyle} onPress={onRemove} activeOpacity={0.85}>
      <FontAwesome name="times" size={12} color="#FECACA" />
    </TouchableOpacity>
  </View>
);

const RequestStatusBadge = ({
  status,
  tone,
  badgeStyle,
  badgeTextStyle,
}: {
  status: MaintenanceSupportStatus;
  tone: { bg: string; border: string; text: string };
  badgeStyle: object;
  badgeTextStyle: object;
}) => (
  <View style={[badgeStyle, { backgroundColor: tone.bg, borderColor: tone.border }]}>
    <Text style={[badgeTextStyle, { color: tone.text }]}>
      {MAINTENANCE_SUPPORT_STATUS_LABELS[status]}
    </Text>
  </View>
);

export function MaintenanceSupportSuggestionsCard({
  isActive = true,
  panelHeight,
  isSuperAdmin = false,
  initialMode = 'list',
  returnOnCreate = false,
  variant = 'default',
  onNavigateBack,
  onRequestCreated,
}: Props) {
  const isVigilance = variant === 'vigilance';
  const themedStyles = useMemo(
    () => createSupportSuggestionsStyles(isVigilance),
    [isVigilance]
  );
  const accentColor = isVigilance ? VIGILANCE_SCALES_UI.accent : ACCENT;
  const iconColor = isVigilance ? '#1B4F8A' : '#BAE6FD';
  const statusToneMap = isVigilance ? statusToneVigilance : statusTone;
  const contentHeight = computeMaintenanceContentHeight(panelHeight);
  const { requests, loading, refreshing, schemaMissing, schemaHint, error, reload } =
    useMaintenanceSupport(isActive);

  const [mode, setMode] = useState<'list' | 'new' | 'detail'>(initialMode);
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [newRecordType, setNewRecordType] =
    useState<MaintenanceSupportRecordType>('suggestion');
  const [newThemeId, setNewThemeId] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newWhatsappAuthorized, setNewWhatsappAuthorized] = useState(false);
  const [newNotifyInApp, setNewNotifyInApp] = useState(true);
  const [newImages, setNewImages] = useState<MaintenanceSupportLocalImage[]>([]);
  const [newRequesterProfileId, setNewRequesterProfileId] = useState('');
  const [memberProfiles, setMemberProfiles] = useState<AccessProfileSearchResult[]>([]);
  const [loadingMemberProfiles, setLoadingMemberProfiles] = useState(false);
  const [memberProfilesError, setMemberProfilesError] = useState<string | null>(null);

  const [userUpdateDescription, setUserUpdateDescription] = useState('');
  const [userUpdateMessage, setUserUpdateMessage] = useState('');
  const [userUpdateImages, setUserUpdateImages] = useState<MaintenanceSupportLocalImage[]>([]);

  const [treatmentStatus, setTreatmentStatus] =
    useState<MaintenanceSupportStatus>('received');
  const [treatmentThemeId, setTreatmentThemeId] = useState('');
  const [developerAction, setDeveloperAction] = useState('');
  const [developerGuidance, setDeveloperGuidance] = useState('');
  const [estimatedDate, setEstimatedDate] = useState('');
  const [communicationMessage, setCommunicationMessage] = useState('');

  const [themes, setThemes] = useState<MaintenanceSupportTheme[]>([]);
  const [loadingThemes, setLoadingThemes] = useState(false);
  const [themesError, setThemesError] = useState<string | null>(null);

  const selectedRequest = useMemo(
    () => requests.find((request) => request.id === selectedRequestId) ?? null,
    [requests, selectedRequestId]
  );

  const selectedNewRequester = useMemo(
    () => memberProfiles.find((profile) => profile.id === newRequesterProfileId) ?? null,
    [memberProfiles, newRequesterProfileId]
  );

  const memberDropdownOptions = useMemo(
    () => [
      { value: '', label: 'Eu mesmo (registrar em meu nome)' },
      ...memberProfiles.map((profile) => {
        const phoneLabel = profile.phone
          ? formatPhoneDisplay(profile.phone)
          : 'sem celular cadastrado';

        return {
          value: profile.id,
          label: `${formatShortName(profile.fullName)} · ${phoneLabel}`,
        };
      }),
    ],
    [memberProfiles]
  );

  const themeDropdownOptions = useMemo(
    () => [
      { value: '', label: 'Selecione o tema...' },
      ...themes.map((theme) => ({
        value: theme.id,
        label: theme.titulo,
      })),
    ],
    [themes]
  );

  useEffect(() => {
    if (!isActive) {
      return;
    }

    setMode(initialMode);
  }, [initialMode, isActive]);

  useEffect(() => {
    if (!isActive) {
      return;
    }

    let cancelled = false;

    void (async () => {
      setLoadingThemes(true);
      setThemesError(null);

      try {
        const rows = await fetchMaintenanceSupportThemes();
        if (!cancelled) {
          setThemes(rows);
        }
      } catch (loadError) {
        console.error('Erro ao carregar temas de suporte:', loadError);
        if (!cancelled) {
          setThemes([]);
          setThemesError(
            loadError instanceof Error
              ? loadError.message
              : 'Não foi possível carregar os temas.'
          );
        }
      } finally {
        if (!cancelled) {
          setLoadingThemes(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isActive]);

  useEffect(() => {
    if (!isSuperAdmin || !isActive || mode !== 'new') {
      return;
    }

    let cancelled = false;

    void (async () => {
      setLoadingMemberProfiles(true);
      setMemberProfilesError(null);

      try {
        const rows = await listProfilesForAccessAdmin();
        if (!cancelled) {
          setMemberProfiles(rows);
        }
      } catch (loadError) {
        console.error('Erro ao carregar membros para sugestão de terceiros:', loadError);
        if (!cancelled) {
          setMemberProfiles([]);
          setMemberProfilesError(
            loadError instanceof Error
              ? loadError.message
              : 'Não foi possível carregar a lista de membros.'
          );
        }
      } finally {
        if (!cancelled) {
          setLoadingMemberProfiles(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isActive, isSuperAdmin, mode]);

  const timeline = useMemo(
    () => (selectedRequest ? buildTimeline(selectedRequest) : []),
    [selectedRequest]
  );

  const hydratedRequestIdRef = useRef<string | null>(null);
  const communicationMessageTouchedRef = useRef(false);

  const applyCommunicationMessage = useCallback(
    (request: MaintenanceSupportRequest, overrides?: CommunicationMessageOverrides) => {
      setCommunicationMessage(buildDefaultCommunicationMessage(request, overrides));
    },
    []
  );

  useEffect(() => {
    if (!selectedRequestId) {
      hydratedRequestIdRef.current = null;
      return;
    }

    if (!selectedRequest) {
      return;
    }

    if (hydratedRequestIdRef.current === selectedRequestId) {
      return;
    }

    hydratedRequestIdRef.current = selectedRequestId;
    setTreatmentStatus(selectedRequest.status);
    setTreatmentThemeId(selectedRequest.tema_id ?? '');
    setDeveloperAction(selectedRequest.developer_action ?? '');
    setDeveloperGuidance(selectedRequest.developer_guidance ?? '');
    setEstimatedDate(formatEstimatedDateInput(selectedRequest.estimated_completion_date));
    setUserUpdateDescription(selectedRequest.description);
    setUserUpdateMessage('');
    setUserUpdateImages([]);
    communicationMessageTouchedRef.current = false;
    applyCommunicationMessage(selectedRequest, {
      description: selectedRequest.description,
      developerAction: selectedRequest.developer_action ?? '',
      developerGuidance: selectedRequest.developer_guidance ?? '',
      estimatedCompletionDate: selectedRequest.estimated_completion_date ?? '',
      status: selectedRequest.status,
    });
  }, [applyCommunicationMessage, selectedRequest, selectedRequestId]);

  useEffect(() => {
    if (!selectedRequest || communicationMessageTouchedRef.current) {
      return;
    }

    applyCommunicationMessage(selectedRequest, {
      description: userUpdateDescription,
      developerAction,
      developerGuidance,
      estimatedCompletionDate: estimatedDate,
      status: treatmentStatus,
      pendingUserUpdateMessage: userUpdateMessage,
    });
  }, [
    applyCommunicationMessage,
    developerAction,
    developerGuidance,
    estimatedDate,
    selectedRequest,
    treatmentStatus,
    userUpdateDescription,
    userUpdateMessage,
  ]);

  const resetNewForm = useCallback(() => {
    setNewRecordType('suggestion');
    setNewThemeId('');
    setNewDescription('');
    setNewWhatsappAuthorized(false);
    setNewNotifyInApp(true);
    setNewImages([]);
    setNewRequesterProfileId('');
  }, []);

  const appendPickedImages = useCallback(
    async (target: 'new' | 'user') => {
      try {
        const images = await pickMaintenanceSupportImagesFromGallery();
        if (!images.length) {
          return;
        }

        if (target === 'new') {
          setNewImages((current) => [...current, ...images]);
        } else {
          setUserUpdateImages((current) => [...current, ...images]);
        }
      } catch (pickError) {
        const message =
          pickError instanceof Error ? pickError.message : 'Não foi possível selecionar imagens.';
        Toast.show({ type: 'error', text1: 'Imagem', text2: message, visibilityTime: 5000 });
      }
    },
    []
  );

  const handleCreateRequest = useCallback(async () => {
    setSaving(true);

    try {
      const created = await createMaintenanceSupportRequest({
        recordType: newRecordType,
        description: newDescription,
        whatsappAuthorized: newWhatsappAuthorized,
        notifyInApp: newNotifyInApp,
        images: newImages,
        temaId: newThemeId || null,
        requester: selectedNewRequester
          ? {
              profileId: selectedNewRequester.id,
              name: selectedNewRequester.fullName,
              phone: selectedNewRequester.phone,
            }
          : undefined,
      });

      resetNewForm();
      await reload({ silent: true });

      if (returnOnCreate) {
        Toast.show({
          type: 'success',
          text1: 'Solicitação registrada',
          text2: 'Sua sugestão foi enviada com sucesso.',
        });
        onRequestCreated?.();
        return;
      }

      setSelectedRequestId(created.id);
      setMode('detail');
      Toast.show({
        type: 'success',
        text1: 'Solicitação registrada',
        text2: 'A ocorrência já está disponível para acompanhamento.',
      });
    } catch (createError) {
      const message =
        createError instanceof Error ? createError.message : 'Não foi possível salvar a solicitação.';
      Toast.show({ type: 'error', text1: 'Erro ao salvar', text2: message, visibilityTime: 6000 });
    } finally {
      setSaving(false);
    }
  }, [
    newDescription,
    newImages,
    newNotifyInApp,
    newRecordType,
    newThemeId,
    newWhatsappAuthorized,
    onRequestCreated,
    reload,
    resetNewForm,
    returnOnCreate,
    selectedNewRequester,
  ]);

  const handleSaveUserUpdate = useCallback(async () => {
    if (!selectedRequest) {
      return;
    }

    setSaving(true);

    try {
      await addMaintenanceSupportUserUpdate({
        requestId: selectedRequest.id,
        description:
          userUpdateDescription.trim() !== selectedRequest.description.trim()
            ? userUpdateDescription
            : undefined,
        message: userUpdateMessage,
        images: userUpdateImages,
      });

      setUserUpdateMessage('');
      setUserUpdateImages([]);
      await reload({ silent: true });
      Toast.show({ type: 'success', text1: 'Histórico atualizado' });
    } catch (updateError) {
      const message =
        updateError instanceof Error ? updateError.message : 'Não foi possível atualizar.';
      Toast.show({ type: 'error', text1: 'Erro', text2: message, visibilityTime: 6000 });
    } finally {
      setSaving(false);
    }
  }, [
    reload,
    selectedRequest,
    userUpdateDescription,
    userUpdateImages,
    userUpdateMessage,
  ]);

  const handleSaveTreatment = useCallback(async () => {
    if (!selectedRequest) {
      return;
    }

    setSaving(true);

    try {
      const normalizedDate = normalizeDateInput(estimatedDate);
      await updateMaintenanceSupportTreatment({
        requestId: selectedRequest.id,
        status: treatmentStatus,
        developerAction,
        developerGuidance,
        estimatedCompletionDate: normalizedDate,
        temaId: treatmentThemeId || null,
      });

      await reload({ silent: true });
      communicationMessageTouchedRef.current = false;
      if (selectedRequest) {
        applyCommunicationMessage(selectedRequest, {
          description: userUpdateDescription,
          developerAction,
          developerGuidance,
          estimatedCompletionDate: estimatedDate,
          status: treatmentStatus,
        });
      }
      Toast.show({ type: 'success', text1: 'Tratamento salvo' });
    } catch (treatmentError) {
      const message =
        treatmentError instanceof Error ? treatmentError.message : 'Não foi possível salvar.';
      Toast.show({ type: 'error', text1: 'Erro', text2: message, visibilityTime: 6000 });
    } finally {
      setSaving(false);
    }
  }, [
    developerAction,
    developerGuidance,
    estimatedDate,
    applyCommunicationMessage,
    reload,
    selectedRequest,
    treatmentStatus,
    treatmentThemeId,
    userUpdateDescription,
  ]);

  const handleRegisterInAppCommunication = useCallback(async () => {
    if (!selectedRequest) {
      return;
    }

    setSaving(true);

    try {
      await recordMaintenanceSupportCommunication({
        request: selectedRequest,
        channel: 'in_app',
        subject: 'Atualização de solicitação',
        message: communicationMessage,
        deliveryStatus: 'registered',
      });

      await reload({ silent: true });
      Toast.show({ type: 'success', text1: 'Comunicação registrada' });
    } catch (communicationError) {
      const message =
        communicationError instanceof Error
          ? communicationError.message
          : 'Não foi possível registrar a comunicação.';
      Toast.show({ type: 'error', text1: 'Erro', text2: message, visibilityTime: 6000 });
    } finally {
      setSaving(false);
    }
  }, [communicationMessage, reload, selectedRequest]);

  const handleSendWhatsApp = useCallback(async () => {
    if (!selectedRequest) {
      return;
    }

    setSaving(true);

    try {
      await sendMaintenanceSupportWhatsApp({
        request: selectedRequest,
        message: communicationMessage,
      });

      await reload({ silent: true });
      Toast.show({ type: 'success', text1: 'WhatsApp aberto', text2: 'Envio registrado no histórico.' });
    } catch (whatsappError) {
      const message =
        whatsappError instanceof Error ? whatsappError.message : 'Não foi possível abrir o WhatsApp.';
      Toast.show({ type: 'error', text1: 'WhatsApp', text2: message, visibilityTime: 6000 });
    } finally {
      setSaving(false);
    }
  }, [communicationMessage, reload, selectedRequest]);

  const renderNewRequestForm = () => (
    <ScrollView
      style={themedStyles.bodyScroll}
      contentContainerStyle={themedStyles.bodyContent}
      nestedScrollEnabled
      keyboardShouldPersistTaps="handled"
    >
      <View style={themedStyles.headerRow}>
        <TouchableOpacity
          style={themedStyles.backButton}
          onPress={() => {
            if (onNavigateBack) {
              onNavigateBack();
              return;
            }

            setMode('list');
          }}
          activeOpacity={0.85}
        >
          <FontAwesome name="chevron-left" size={13} color={iconColor} />
          <Text style={themedStyles.backButtonText}>Voltar</Text>
        </TouchableOpacity>
        <Text style={themedStyles.formTitle}>Nova sugestão</Text>
      </View>

      {isSuperAdmin ? (
        <View style={themedStyles.requesterSection}>
          <Text style={themedStyles.label}>Solicitante</Text>
          <Text style={themedStyles.fieldHint}>
            Como super administrador, você pode registrar a sugestão em nome de um membro da igreja.
          </Text>
          {loadingMemberProfiles ? (
            <ActivityIndicator color={accentColor} style={themedStyles.inlineLoader} />
          ) : memberProfilesError ? (
            <Text style={themedStyles.errorTextInline}>{memberProfilesError}</Text>
          ) : (
            <DropdownSelect
              options={memberDropdownOptions}
              selectedValue={newRequesterProfileId}
              onValueChange={setNewRequesterProfileId}
              modalTitle="Selecionar membro"
              placeholder="Buscar membro por nome ou celular..."
              searchPlaceholder="Digite nome ou celular..."
              searchable
              variant={isVigilance ? 'vigilance' as const : 'default' as const}
        style={themedStyles.dropdown}
              disabled={saving || memberProfiles.length === 0}
            />
          )}
          {selectedNewRequester ? (
            <View style={themedStyles.selectedRequesterCard}>
              <Text style={themedStyles.selectedRequesterTitle}>Registrando para</Text>
              <Text style={themedStyles.selectedRequesterName}>{selectedNewRequester.fullName}</Text>
              <Text style={themedStyles.selectedRequesterMeta}>
                Celular:{' '}
                {selectedNewRequester.phone
                  ? formatPhoneDisplay(selectedNewRequester.phone)
                  : 'não cadastrado'}
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}

      <Text style={themedStyles.label}>Tipo de registro</Text>
      <DropdownSelect
        options={MAINTENANCE_SUPPORT_RECORD_TYPE_OPTIONS}
        selectedValue={newRecordType}
        onValueChange={(value) => setNewRecordType(value as MaintenanceSupportRecordType)}
        modalTitle="Tipo de registro"
        variant={isVigilance ? 'vigilance' as const : 'default' as const}
        style={themedStyles.dropdown}
      />

      <Text style={themedStyles.label}>Tema</Text>
      {loadingThemes ? (
        <ActivityIndicator color={accentColor} style={themedStyles.inlineLoader} />
      ) : themesError ? (
        <Text style={themedStyles.errorTextInline}>{themesError}</Text>
      ) : (
        <DropdownSelect
          options={themeDropdownOptions}
          selectedValue={newThemeId}
          onValueChange={setNewThemeId}
          modalTitle="Selecionar tema"
          placeholder="Buscar tema..."
          searchPlaceholder="Digite para filtrar..."
          searchable
          variant={isVigilance ? 'vigilance' as const : 'default' as const}
        style={themedStyles.dropdown}
          disabled={saving || themes.length === 0}
        />
      )}

      <Text style={themedStyles.label}>Descrição detalhada</Text>
      <TextInput
        style={[themedStyles.input, themedStyles.textArea]}
        value={newDescription}
        onChangeText={setNewDescription}
        placeholder="Explique a sugestão, dúvida, comentário ou incidente com detalhes."
        placeholderTextColor={isVigilance ? VIGILANCE_SCALES_UI.accent : '#64748B'}
        multiline
        textAlignVertical="top"
      />

      <View style={themedStyles.switchCard}>
        <View style={themedStyles.switchText}>
          <Text style={themedStyles.switchTitle}>Notificações no aplicativo</Text>
          <Text style={themedStyles.switchHint}>Registrar atualizações para acompanhamento no histórico.</Text>
        </View>
        <Switch
          value={newNotifyInApp}
          onValueChange={setNewNotifyInApp}
          trackColor={{ false: '#475569', true: '#0EA5E9' }}
          thumbColor="#F8FAFC"
        />
      </View>

      <View style={themedStyles.switchCard}>
        <View style={themedStyles.switchText}>
          <Text style={themedStyles.switchTitle}>Autorizar WhatsApp</Text>
          <Text style={themedStyles.switchHint}>Permite receber atualizações da ocorrência por WhatsApp.</Text>
        </View>
        <Switch
          value={newWhatsappAuthorized}
          onValueChange={setNewWhatsappAuthorized}
          trackColor={{ false: '#475569', true: '#22C55E' }}
          thumbColor="#F8FAFC"
        />
      </View>

      <TouchableOpacity
        style={themedStyles.secondaryButton}
        onPress={() => void appendPickedImages('new')}
        activeOpacity={0.85}
      >
        <MaterialIcons name="add-photo-alternate" size={18} color={iconColor} />
        <Text style={themedStyles.secondaryButtonText}>
          {newImages.length ? 'Adicionar/substituir imagens' : 'Anexar imagem da galeria'}
        </Text>
      </TouchableOpacity>

      {newImages.length ? (
        <View style={themedStyles.localImagesRow}>
          {newImages.map((image, index) => (
            <LocalImageChip
              key={`${image.uri}-${index}`}
              image={image}
              onRemove={() => setNewImages((current) => current.filter((_, idx) => idx !== index))}
              chipStyle={themedStyles.localImageChip}
              previewStyle={themedStyles.localImagePreview}
              removeStyle={themedStyles.localImageRemove}
            />
          ))}
        </View>
      ) : null}

      <TouchableOpacity
        style={[themedStyles.primaryButton, saving && themedStyles.buttonDisabled]}
        onPress={() => void handleCreateRequest()}
        disabled={saving}
        activeOpacity={0.85}
      >
        {saving ? <ActivityIndicator color={isVigilance ? VIGILANCE_SCALES_UI.accent : "#0F172A"} /> : <Text style={themedStyles.primaryButtonText}>Registrar solicitação</Text>}
      </TouchableOpacity>
    </ScrollView>
  );

  const renderList = () => (
    <View style={themedStyles.listBody}>
      <View style={themedStyles.summaryCard}>
        <Text style={themedStyles.summaryTitle}>Central de relacionamento e suporte</Text>
        <Text style={themedStyles.summaryText}>
          Registre sugestões, dúvidas, comentários e incidentes com rastreabilidade até a conclusão.
        </Text>
      </View>

      <View style={themedStyles.actionsRow}>
        <TouchableOpacity
          style={themedStyles.primaryButtonCompact}
          onPress={() => setMode('new')}
          activeOpacity={0.85}
        >
          <FontAwesome name="plus" size={14} color={isVigilance ? VIGILANCE_SCALES_UI.accent : "#0F172A"} />
          <Text style={themedStyles.primaryButtonCompactText}>Nova</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={themedStyles.secondaryButtonCompact}
          onPress={() => void reload({ silent: true })}
          activeOpacity={0.85}
        >
          {refreshing ? (
            <ActivityIndicator color={iconColor} size="small" />
          ) : (
            <FontAwesome name="refresh" size={14} color={iconColor} />
          )}
          <Text style={themedStyles.secondaryButtonCompactText}>Atualizar</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={themedStyles.requestList} nestedScrollEnabled showsVerticalScrollIndicator>
        {requests.length ? (
          requests.map((request) => (
            <TouchableOpacity
              key={request.id}
              style={themedStyles.requestCard}
              onPress={() => {
                hydratedRequestIdRef.current = null;
                setSelectedRequestId(request.id);
                setMode('detail');
              }}
              activeOpacity={0.9}
            >
              <View style={themedStyles.requestHeader}>
                <View style={themedStyles.requestMain}>
                  <Text style={themedStyles.requestTitle} numberOfLines={2}>
                    {MAINTENANCE_SUPPORT_RECORD_TYPE_LABELS[request.record_type]}
                  </Text>
                  <Text style={themedStyles.requestMeta} numberOfLines={1}>
                    {request.requester_name} · {formatDateTime(request.created_at)}
                  </Text>
                  {request.tema ? (
                    <Text style={themedStyles.requestTheme} numberOfLines={2}>
                      {request.tema}
                    </Text>
                  ) : null}
                </View>
                <RequestStatusBadge
                  status={request.status}
                  tone={statusToneMap[request.status]}
                  badgeStyle={themedStyles.statusBadge}
                  badgeTextStyle={themedStyles.statusBadgeText}
                />
              </View>
              <Text style={themedStyles.requestDescription} numberOfLines={3}>
                {request.description}
              </Text>
              <View style={themedStyles.requestFooter}>
                <Text style={themedStyles.requestFooterText}>
                  {request.attachments.length} anexo(s) · {request.communications.length} comunicação(ões)
                </Text>
                <FontAwesome name="chevron-right" size={12} color="#64748B" />
              </View>
            </TouchableOpacity>
          ))
        ) : (
          <Text style={themedStyles.emptyText}>Nenhuma solicitação registrada ainda.</Text>
        )}
      </ScrollView>
    </View>
  );

  const renderDetail = () => {
    if (!selectedRequest) {
      return (
        <View style={themedStyles.centerBox}>
          <Text style={themedStyles.emptyText}>Solicitação não encontrada.</Text>
          <TouchableOpacity style={themedStyles.secondaryButtonCompact} onPress={() => setMode('list')}>
            <Text style={themedStyles.secondaryButtonCompactText}>Voltar</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <ScrollView
        style={themedStyles.bodyScroll}
        contentContainerStyle={themedStyles.bodyContent}
        nestedScrollEnabled
        keyboardShouldPersistTaps="handled"
      >
        <View style={themedStyles.headerRow}>
          <TouchableOpacity
            style={themedStyles.backButton}
            onPress={() => {
              hydratedRequestIdRef.current = null;
              setMode('list');
            }}
            activeOpacity={0.85}
          >
            <FontAwesome name="chevron-left" size={13} color={iconColor} />
            <Text style={themedStyles.backButtonText}>Lista</Text>
          </TouchableOpacity>
          <RequestStatusBadge
            status={isSuperAdmin ? treatmentStatus : selectedRequest.status}
            tone={statusToneMap[isSuperAdmin ? treatmentStatus : selectedRequest.status]}
            badgeStyle={themedStyles.statusBadge}
            badgeTextStyle={themedStyles.statusBadgeText}
          />
        </View>

        <View style={themedStyles.detailCard}>
          <Text style={themedStyles.detailTitle}>
            {MAINTENANCE_SUPPORT_RECORD_TYPE_LABELS[selectedRequest.record_type]}
          </Text>
          <Text style={themedStyles.detailMeta}>
            {selectedRequest.requester_name} · aberta em {formatDateTime(selectedRequest.created_at)}
          </Text>
          <Text style={themedStyles.detailMeta}>
            Resposta: {formatDateTime(selectedRequest.responded_at)}
          </Text>
          {selectedRequest.tema ? (
            <Text style={themedStyles.detailTheme}>Tema: {selectedRequest.tema}</Text>
          ) : null}
          <Text style={themedStyles.detailDescription}>{selectedRequest.description}</Text>
          <View style={themedStyles.authorizationRow}>
            <Text style={themedStyles.authorizationText}>
              WhatsApp {selectedRequest.whatsapp_authorized ? 'autorizado' : 'não autorizado'}
            </Text>
            <Text style={themedStyles.authorizationText}>
              Notificação app {selectedRequest.notify_in_app ? 'ativa' : 'inativa'}
            </Text>
          </View>
        </View>

        {selectedRequest.attachments.length ? (
          <View style={themedStyles.sectionCard}>
            <Text style={themedStyles.sectionTitle}>Anexos</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={themedStyles.attachmentRow}>
              {selectedRequest.attachments.map((attachment) => (
                <View key={attachment.id} style={themedStyles.attachmentItem}>
                  {attachment.signedUrl ? (
                    <Image source={{ uri: attachment.signedUrl }} style={themedStyles.attachmentImage} contentFit="cover" />
                  ) : (
                    <View style={themedStyles.attachmentMissing}>
                      <FontAwesome name="image" size={20} color="#64748B" />
                    </View>
                  )}
                  <Text style={themedStyles.attachmentCaption} numberOfLines={1}>
                    {attachment.file_name ?? 'imagem'}
                  </Text>
                </View>
              ))}
            </ScrollView>
          </View>
        ) : null}

        <View style={themedStyles.sectionCard}>
          <Text style={themedStyles.sectionTitle}>Atualização do usuário</Text>
          <TextInput
            style={[themedStyles.input, themedStyles.textAreaSmall]}
            value={userUpdateDescription}
            onChangeText={setUserUpdateDescription}
            placeholder="Atualize a descrição se necessário."
            placeholderTextColor={isVigilance ? VIGILANCE_SCALES_UI.accent : '#64748B'}
            multiline
            textAlignVertical="top"
          />
          <TextInput
            style={[themedStyles.input, themedStyles.textAreaSmall]}
            value={userUpdateMessage}
            onChangeText={setUserUpdateMessage}
            placeholder="Registre uma alteração, complemento ou comentário para o histórico."
            placeholderTextColor={isVigilance ? VIGILANCE_SCALES_UI.accent : '#64748B'}
            multiline
            textAlignVertical="top"
          />
          <TouchableOpacity style={themedStyles.secondaryButton} onPress={() => void appendPickedImages('user')} activeOpacity={0.85}>
            <MaterialIcons name="add-photo-alternate" size={18} color={iconColor} />
            <Text style={themedStyles.secondaryButtonText}>Adicionar imagens complementares</Text>
          </TouchableOpacity>
          {userUpdateImages.length ? (
            <View style={themedStyles.localImagesRow}>
              {userUpdateImages.map((image, index) => (
                <LocalImageChip
                  key={`${image.uri}-${index}`}
                  image={image}
                  onRemove={() =>
                    setUserUpdateImages((current) => current.filter((_, idx) => idx !== index))
                  }
                  chipStyle={themedStyles.localImageChip}
                  previewStyle={themedStyles.localImagePreview}
                  removeStyle={themedStyles.localImageRemove}
                />
              ))}
            </View>
          ) : null}
          <TouchableOpacity
            style={[themedStyles.secondaryButton, saving && themedStyles.buttonDisabled]}
            onPress={() => void handleSaveUserUpdate()}
            disabled={saving}
            activeOpacity={0.85}
          >
            <Text style={themedStyles.secondaryButtonText}>Salvar atualização do usuário</Text>
          </TouchableOpacity>
        </View>

        {isSuperAdmin ? (
          <View style={themedStyles.developerCard}>
            <Text style={themedStyles.sectionTitle}>Tratamento pelo desenvolvedor</Text>
            <Text style={themedStyles.label}>Tema</Text>
            {loadingThemes ? (
              <ActivityIndicator color={accentColor} style={themedStyles.inlineLoader} />
            ) : themesError ? (
              <Text style={themedStyles.errorTextInline}>{themesError}</Text>
            ) : (
              <DropdownSelect
                options={themeDropdownOptions}
                selectedValue={treatmentThemeId}
                onValueChange={setTreatmentThemeId}
                modalTitle="Selecionar tema"
                placeholder="Buscar tema..."
                searchPlaceholder="Digite para filtrar..."
                searchable
                variant={isVigilance ? 'vigilance' as const : 'default' as const}
        style={themedStyles.dropdown}
                disabled={saving || themes.length === 0}
              />
            )}
            <Text style={themedStyles.label}>Status da solicitação</Text>
            <Text style={themedStyles.helperText}>
              Toque em um status abaixo e depois em Salvar tratamento para aplicar a alteração.
            </Text>
            <View style={themedStyles.statusChipRow}>
              {MAINTENANCE_SUPPORT_STATUS_OPTIONS.map((option) => {
                const value = option.value as MaintenanceSupportStatus;
                const selected = treatmentStatus === value;
                const tone = statusToneMap[value];

                return (
                  <Pressable
                    key={option.value}
                    style={[
                      themedStyles.statusChip,
                      {
                        backgroundColor: selected ? tone.bg : 'rgba(15, 23, 42, 0.55)',
                        borderColor: selected ? tone.border : '#475569',
                      },
                    ]}
                    onPress={() => setTreatmentStatus(value)}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                  >
                    <Text
                      style={[
                        themedStyles.statusChipText,
                        { color: selected ? tone.text : '#CBD5E1' },
                      ]}
                    >
                      {option.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={themedStyles.label}>Ação tomada ou planejada</Text>
            <TextInput
              style={[themedStyles.input, themedStyles.textAreaSmall]}
              value={developerAction}
              onChangeText={setDeveloperAction}
              placeholder="Descreva a ação tomada ou a ser tomada."
              placeholderTextColor={isVigilance ? VIGILANCE_SCALES_UI.accent : '#64748B'}
              multiline
              textAlignVertical="top"
            />

            <Text style={themedStyles.label}>Previsão de implementação/conclusão</Text>
            <TextInput
              style={themedStyles.input}
              value={estimatedDate}
              onChangeText={(value) => setEstimatedDate(formatBrazilDateInput(value))}
              placeholder={DATE_INPUT_PLACEHOLDER}
              placeholderTextColor={isVigilance ? VIGILANCE_SCALES_UI.accent : '#64748B'}
              autoCapitalize="none"
              keyboardType="number-pad"
            />

            <Text style={themedStyles.label}>Orientações detalhadas ao usuário</Text>
            <TextInput
              style={[themedStyles.input, themedStyles.textArea]}
              value={developerGuidance}
              onChangeText={setDeveloperGuidance}
              placeholder="Explique a solução, localização da funcionalidade e passo a passo de uso."
              placeholderTextColor={isVigilance ? VIGILANCE_SCALES_UI.accent : '#64748B'}
              multiline
              textAlignVertical="top"
            />

            <TouchableOpacity
              style={[themedStyles.primaryButton, saving && themedStyles.buttonDisabled]}
              onPress={() => void handleSaveTreatment()}
              disabled={saving}
              activeOpacity={0.85}
            >
              <Text style={themedStyles.primaryButtonText}>Salvar tratamento</Text>
            </TouchableOpacity>

            <Text style={themedStyles.label}>Mensagem ao usuário</Text>
            <TextInput
              style={[themedStyles.input, themedStyles.textArea]}
              value={communicationMessage}
              onChangeText={(value) => {
                communicationMessageTouchedRef.current = true;
                setCommunicationMessage(value);
              }}
              placeholder="Mensagem de atualização para o usuário."
              placeholderTextColor={isVigilance ? VIGILANCE_SCALES_UI.accent : '#64748B'}
              multiline
              textAlignVertical="top"
            />
            <View style={themedStyles.communicationButtons}>
              <TouchableOpacity
                style={themedStyles.secondaryButtonCompact}
                onPress={() => void handleRegisterInAppCommunication()}
                disabled={saving}
                activeOpacity={0.85}
              >
                <FontAwesome name="bell" size={14} color={iconColor} />
                <Text style={themedStyles.secondaryButtonCompactText}>Registrar no app</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  themedStyles.whatsappButton,
                  (!selectedRequest.whatsapp_authorized || !selectedRequest.requester_phone) && themedStyles.buttonDisabled,
                ]}
                onPress={() => void handleSendWhatsApp()}
                disabled={saving || !selectedRequest.whatsapp_authorized || !selectedRequest.requester_phone}
                activeOpacity={0.85}
              >
                <FontAwesome name="whatsapp" size={15} color="#DCFCE7" />
                <Text style={themedStyles.whatsappButtonText}>WhatsApp</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}

        <View style={themedStyles.sectionCard}>
          <Text style={themedStyles.sectionTitle}>Histórico cronológico</Text>
          {timeline.length ? (
            timeline.map((entry) => (
              <View key={entry.id} style={themedStyles.timelineItem}>
                <View style={themedStyles.timelineDot} />
                <View style={themedStyles.timelineBody}>
                  <View style={themedStyles.timelineHeader}>
                    <Text style={themedStyles.timelineTitle}>{entry.title}</Text>
                    <Text style={themedStyles.timelineDate}>{formatDateTime(entry.date)}</Text>
                  </View>
                  <Text style={themedStyles.timelineMeta}>{entry.meta}</Text>
                  <Text style={themedStyles.timelineMessage}>{entry.message}</Text>
                </View>
              </View>
            ))
          ) : (
            <Text style={themedStyles.emptyText}>Nenhuma interação registrada.</Text>
          )}
        </View>
      </ScrollView>
    );
  };

  return (
    <View style={[themedStyles.panel, { height: contentHeight }]}>
      <Text style={[maintenancePanelStyles.panelTitle, isVigilance && { color: VIGILANCE_SCALES_UI.accent }]}>Sugestões e Melhorias</Text>
      <Text style={themedStyles.subtitle}>
        Registro, acompanhamento, respostas e comunicações das solicitações dos usuários.
      </Text>

      {schemaMissing ? <Text style={themedStyles.warningText}>{schemaHint}</Text> : null}
      {error ? <Text style={themedStyles.errorText}>{error}</Text> : null}

      <View style={themedStyles.contentArea}>
        {loading ? (
          <View style={themedStyles.centerBox}>
            <ActivityIndicator color={accentColor} />
            <Text style={themedStyles.loadingText}>Carregando solicitações...</Text>
          </View>
        ) : mode === 'new' ? (
          renderNewRequestForm()
        ) : mode === 'detail' ? (
          renderDetail()
        ) : (
          renderList()
        )}
      </View>
    </View>
  );
}

function createSupportSuggestionsStyles(isVigilance: boolean) {
  const base = StyleSheet.create({
  panel: {
    flex: 1,
    minHeight: 0,
    gap: 8,
  },
  contentArea: {
    flex: 1,
    minHeight: 0,
  },
  subtitle: {
    color: 'rgba(58, 150, 221, 0.82)',
    fontSize: 12,
    lineHeight: 16,
    textAlign: 'center',
  },
  warningText: {
    color: '#FDE68A',
    fontSize: 11,
    lineHeight: 16,
    textAlign: 'center',
  },
  errorText: {
    color: '#FCA5A5',
    fontSize: 12,
    lineHeight: 17,
    textAlign: 'center',
  },
  centerBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  loadingText: {
    color: 'rgba(58, 150, 221, 0.82)',
    fontSize: 12,
  },
  listBody: {
    flex: 1,
    minHeight: 0,
    gap: 10,
  },
  summaryCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.35)',
    backgroundColor: 'rgba(14, 165, 233, 0.10)',
    padding: 12,
    gap: 4,
  },
  summaryTitle: {
    color: '#3A96DD',
    fontSize: 14,
    fontWeight: '800',
  },
  summaryText: {
    color: '#1B4F8A',
    fontSize: 12,
    lineHeight: 17,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  requestList: {
    flex: 1,
    minHeight: 0,
  },
  requestCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(51, 65, 85, 0.95)',
    backgroundColor: '#FFFFFF',
    padding: 12,
    gap: 8,
    marginBottom: 8,
  },
  requestHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
    flexWrap: 'wrap',
  },
  requestMain: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  requestTitle: {
    color: '#3A96DD',
    fontSize: 15,
    fontWeight: '800',
  },
  requestMeta: {
    color: 'rgba(58, 150, 221, 0.82)',
    fontSize: 11,
  },
  requestTheme: {
    color: '#1B4F8A',
    fontSize: 11,
    lineHeight: 15,
  },
  requestDescription: {
    color: '#3A96DD',
    fontSize: 12,
    lineHeight: 17,
  },
  requestFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  requestFooterText: {
    color: '#1B4F8A',
    fontSize: 11,
    fontWeight: '700',
  },
  emptyText: {
    color: 'rgba(58, 150, 221, 0.82)',
    fontSize: 12,
    lineHeight: 17,
    textAlign: 'center',
    paddingVertical: 12,
  },
  primaryButtonCompact: {
    flex: 1,
    minHeight: 42,
    borderRadius: 12,
    backgroundColor: '#7DD3FC',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  primaryButtonCompactText: {
    color: '#0F172A',
    fontSize: 13,
    fontWeight: '800',
  },
  secondaryButtonCompact: {
    flex: 1,
    minHeight: 42,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(125, 211, 252, 0.45)',
    backgroundColor: 'rgba(14, 165, 233, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 10,
  },
  secondaryButtonCompactText: {
    color: '#1B4F8A',
    fontSize: 12,
    fontWeight: '800',
  },
  bodyScroll: {
    flex: 1,
    minHeight: 0,
  },
  bodyContent: {
    gap: 10,
    paddingBottom: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
    flexWrap: 'wrap',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(125, 211, 252, 0.35)',
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  backButtonText: {
    color: '#1B4F8A',
    fontSize: 12,
    fontWeight: '800',
  },
  formTitle: {
    flex: 1,
    minWidth: 0,
    color: '#3A96DD',
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'right',
  },
  label: {
    color: '#1B4F8A',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  fieldHint: {
    color: 'rgba(58, 150, 221, 0.82)',
    fontSize: 11,
    lineHeight: 15,
  },
  requesterSection: {
    gap: 6,
  },
  inlineLoader: {
    alignSelf: 'flex-start',
    paddingVertical: 4,
  },
  errorTextInline: {
    color: '#FCA5A5',
    fontSize: 11,
    lineHeight: 15,
  },
  selectedRequesterCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.35)',
    backgroundColor: 'rgba(14, 165, 233, 0.10)',
    padding: 10,
    gap: 2,
  },
  selectedRequesterTitle: {
    color: 'rgba(58, 150, 221, 0.82)',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  selectedRequesterName: {
    color: '#3A96DD',
    fontSize: 13,
    fontWeight: '800',
  },
  selectedRequesterMeta: {
    color: '#1B4F8A',
    fontSize: 12,
    lineHeight: 16,
  },
  dropdown: {
    flex: 0,
    width: '100%',
  },
  input: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.35)',
    backgroundColor: 'rgba(15, 23, 42, 0.72)',
    color: '#3A96DD',
    fontSize: 13,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  textArea: {
    minHeight: 116,
    lineHeight: 18,
  },
  textAreaSmall: {
    minHeight: 78,
    lineHeight: 18,
  },
  switchCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.35)',
    backgroundColor: '#FFFFFF',
    padding: 12,
  },
  switchText: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  switchTitle: {
    color: '#3A96DD',
    fontSize: 13,
    fontWeight: '800',
  },
  switchHint: {
    color: 'rgba(58, 150, 221, 0.82)',
    fontSize: 11,
    lineHeight: 15,
  },
  secondaryButton: {
    minHeight: 42,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(125, 211, 252, 0.45)',
    backgroundColor: 'rgba(14, 165, 233, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 12,
  },
  secondaryButtonText: {
    color: '#1B4F8A',
    fontSize: 12,
    fontWeight: '800',
  },
  primaryButton: {
    minHeight: 46,
    borderRadius: 12,
    backgroundColor: '#7DD3FC',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 12,
  },
  primaryButtonText: {
    color: '#0F172A',
    fontSize: 14,
    fontWeight: '900',
  },
  buttonDisabled: {
    opacity: 0.48,
  },
  localImagesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  localImageChip: {
    width: 74,
    height: 74,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.35)',
    overflow: 'hidden',
    position: 'relative',
  },
  localImagePreview: {
    width: '100%',
    height: '100%',
  },
  localImageRemove: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 22,
    height: 22,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(127, 29, 29, 0.85)',
  },
  statusBadge: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
    flexShrink: 0,
  },
  statusBadgeText: {
    fontSize: 9,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  detailCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.32)',
    backgroundColor: '#FFFFFF',
    padding: 12,
    gap: 7,
  },
  detailTitle: {
    color: '#3A96DD',
    fontSize: 17,
    fontWeight: '900',
  },
  detailMeta: {
    color: 'rgba(58, 150, 221, 0.82)',
    fontSize: 11,
    lineHeight: 16,
  },
  detailTheme: {
    color: '#1B4F8A',
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '700',
  },
  detailDescription: {
    color: '#3A96DD',
    fontSize: 13,
    lineHeight: 19,
  },
  authorizationRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  authorizationText: {
    color: '#1B4F8A',
    fontSize: 11,
    fontWeight: '800',
  },
  sectionCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.35)',
    backgroundColor: '#FFFFFF',
    padding: 12,
    gap: 9,
  },
  developerCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.38)',
    backgroundColor: 'rgba(20, 83, 45, 0.14)',
    padding: 12,
    gap: 9,
  },
  helperText: {
    color: 'rgba(58, 150, 221, 0.82)',
    fontSize: 11,
    lineHeight: 16,
  },
  statusChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    alignItems: 'flex-start',
  },
  statusChip: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 7,
    maxWidth: '100%',
  },
  statusChipText: {
    fontSize: 11,
    fontWeight: '800',
  },
  sectionTitle: {
    color: '#3A96DD',
    fontSize: 13,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  attachmentRow: {
    gap: 10,
    paddingVertical: 2,
  },
  attachmentItem: {
    width: 100,
    gap: 5,
  },
  attachmentImage: {
    width: 100,
    height: 76,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.35)',
  },
  attachmentMissing: {
    width: 100,
    height: 76,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  attachmentCaption: {
    color: 'rgba(58, 150, 221, 0.82)',
    fontSize: 10,
  },
  communicationButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  whatsappButton: {
    flex: 1,
    minHeight: 42,
    borderRadius: 12,
    backgroundColor: '#16A34A',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 10,
  },
  whatsappButtonText: {
    color: '#DCFCE7',
    fontSize: 12,
    fontWeight: '900',
  },
  timelineItem: {
    flexDirection: 'row',
    gap: 9,
  },
  timelineDot: {
    width: 9,
    height: 9,
    borderRadius: 999,
    backgroundColor: ACCENT,
    marginTop: 5,
  },
  timelineBody: {
    flex: 1,
    minWidth: 0,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(52, 211, 153, 0.35)',
    paddingBottom: 9,
    gap: 3,
  },
  timelineHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    flexWrap: 'wrap',
  },
  timelineTitle: {
    flex: 1,
    minWidth: 0,
    color: '#3A96DD',
    fontSize: 12,
    fontWeight: '900',
  },
  timelineDate: {
    color: 'rgba(58, 150, 221, 0.82)',
    fontSize: 10,
    flexShrink: 0,
  },
  timelineMeta: {
    color: '#1B4F8A',
    fontSize: 10,
    fontWeight: '700',
  },
  timelineMessage: {
    color: '#3A96DD',
    fontSize: 12,
    lineHeight: 17,
  },
});
  if (!isVigilance) {
    return base;
  }

  const surface = '#FFFFFF';
  const accent = VIGILANCE_SCALES_UI.accent;
  const icon = '#1B4F8A';

  return StyleSheet.create({
    ...base,
    panel: { ...base.panel, backgroundColor: surface },
    subtitle: { ...base.subtitle, color: accent, opacity: 0.88 },
    warningText: { ...base.warningText, color: accent },
    errorText: { ...base.errorText, color: accent },
    loadingText: { ...base.loadingText, color: accent },
    summaryCard: { ...base.summaryCard, borderColor: accent, backgroundColor: '#F0F9FF' },
    summaryTitle: { ...base.summaryTitle, color: accent },
    summaryText: { ...base.summaryText, color: accent },
    requestCard: { ...base.requestCard, borderColor: accent, backgroundColor: surface },
    requestTitle: { ...base.requestTitle, color: accent },
    requestMeta: { ...base.requestMeta, color: accent, opacity: 0.82 },
    requestTheme: { ...base.requestTheme, color: icon },
    requestDescription: { ...base.requestDescription, color: accent },
    requestFooterText: { ...base.requestFooterText, color: icon },
    emptyText: { ...base.emptyText, color: accent, opacity: 0.82 },
    primaryButtonCompact: { ...base.primaryButtonCompact, backgroundColor: surface, borderWidth: 1, borderColor: accent },
    primaryButtonCompactText: { ...base.primaryButtonCompactText, color: accent },
    secondaryButtonCompact: { ...base.secondaryButtonCompact, borderColor: accent, backgroundColor: surface },
    secondaryButtonCompactText: { ...base.secondaryButtonCompactText, color: accent },
    backButton: { ...base.backButton, borderColor: accent, backgroundColor: surface },
    backButtonText: { ...base.backButtonText, color: accent },
    formTitle: { ...base.formTitle, color: accent },
    label: { ...base.label, color: accent },
    fieldHint: { ...base.fieldHint, color: accent, opacity: 0.88 },
    errorTextInline: { ...base.errorTextInline, color: accent },
    selectedRequesterCard: { ...base.selectedRequesterCard, borderColor: accent, backgroundColor: '#F0F9FF' },
    selectedRequesterTitle: { ...base.selectedRequesterTitle, color: accent },
    selectedRequesterName: { ...base.selectedRequesterName, color: accent },
    selectedRequesterMeta: { ...base.selectedRequesterMeta, color: accent },
    input: { ...base.input, borderColor: accent, backgroundColor: surface, color: accent },
    switchCard: { ...base.switchCard, borderColor: accent, backgroundColor: surface },
    switchTitle: { ...base.switchTitle, color: accent },
    switchHint: { ...base.switchHint, color: accent, opacity: 0.82 },
    secondaryButton: { ...base.secondaryButton, borderColor: accent, backgroundColor: surface },
    secondaryButtonText: { ...base.secondaryButtonText, color: accent },
    primaryButton: { ...base.primaryButton, backgroundColor: surface, borderWidth: 1, borderColor: accent },
    primaryButtonText: { ...base.primaryButtonText, color: accent },
    localImageChip: { ...base.localImageChip, borderColor: accent },
    detailCard: { ...base.detailCard, borderColor: accent, backgroundColor: surface },
    detailTitle: { ...base.detailTitle, color: accent },
    detailMeta: { ...base.detailMeta, color: accent, opacity: 0.82 },
    detailTheme: { ...base.detailTheme, color: icon },
    detailDescription: { ...base.detailDescription, color: accent },
    authorizationText: { ...base.authorizationText, color: icon },
    sectionCard: { ...base.sectionCard, borderColor: accent, backgroundColor: surface },
    developerCard: { ...base.developerCard, borderColor: '#16A34A', backgroundColor: '#F0FDF4' },
    helperText: { ...base.helperText, color: accent, opacity: 0.88 },
    sectionTitle: { ...base.sectionTitle, color: accent },
    attachmentImage: { ...base.attachmentImage, borderColor: accent },
    attachmentMissing: { ...base.attachmentMissing, borderColor: accent },
    attachmentCaption: { ...base.attachmentCaption, color: accent },
    timelineDot: { ...base.timelineDot, backgroundColor: accent },
    timelineBody: { ...base.timelineBody, borderBottomColor: accent },
    timelineTitle: { ...base.timelineTitle, color: accent },
    timelineDate: { ...base.timelineDate, color: accent, opacity: 0.82 },
    timelineMeta: { ...base.timelineMeta, color: icon },
    timelineMessage: { ...base.timelineMessage, color: accent },
  } as typeof base);
}

const styles = createSupportSuggestionsStyles(false);

