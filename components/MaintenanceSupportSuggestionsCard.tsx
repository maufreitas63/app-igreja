import { DropdownSelect } from '@/components/ui/DropdownSelect';
import { formatBrazilDateInput } from '@/lib/inputMasks';
import { useMaintenanceSupport } from '@/hooks/useMaintenanceSupport';
import { computeMaintenanceContentHeight, maintenancePanelStyles } from '@/lib/maintenanceCardStyles';
import {
  addMaintenanceSupportUserUpdate,
  createMaintenanceSupportRequest,
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
} from '@/lib/maintenanceSupportApi';
import { FontAwesome, MaterialIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
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

const ACCENT = '#38BDF8';
const DATE_INPUT_PLACEHOLDER = 'dd/mm/aaaa';

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

  const [year, month, day] = value.split('-');
  if (year && month && day) {
    return `${day}/${month}/${year}`;
  }

  return value;
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

const buildDefaultCommunicationMessage = (request: MaintenanceSupportRequest) => {
  const lines = [
    `Olá, ${request.requester_name}. Atualização da sua solicitação em Sugestões e Melhorias.`,
    `Status: ${MAINTENANCE_SUPPORT_STATUS_LABELS[request.status]}.`,
    request.estimated_completion_date
      ? `Previsão: ${formatDate(request.estimated_completion_date)}.`
      : null,
    request.developer_action?.trim() ? `Ação: ${request.developer_action.trim()}` : null,
    request.developer_guidance?.trim()
      ? `Orientações: ${request.developer_guidance.trim()}`
      : null,
  ];

  return lines.filter(Boolean).join('\n\n');
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
}: {
  image: MaintenanceSupportLocalImage;
  onRemove: () => void;
}) => (
  <View style={styles.localImageChip}>
    <Image source={{ uri: image.uri }} style={styles.localImagePreview} contentFit="cover" />
    <TouchableOpacity style={styles.localImageRemove} onPress={onRemove} activeOpacity={0.85}>
      <FontAwesome name="times" size={12} color="#FECACA" />
    </TouchableOpacity>
  </View>
);

const RequestStatusBadge = ({ status }: { status: MaintenanceSupportStatus }) => {
  const tone = statusTone[status];

  return (
    <View style={[styles.statusBadge, { backgroundColor: tone.bg, borderColor: tone.border }]}>
      <Text style={[styles.statusBadgeText, { color: tone.text }]}>
        {MAINTENANCE_SUPPORT_STATUS_LABELS[status]}
      </Text>
    </View>
  );
};

export function MaintenanceSupportSuggestionsCard({
  isActive = true,
  panelHeight,
  isSuperAdmin = false,
}: Props) {
  const contentHeight = computeMaintenanceContentHeight(panelHeight);
  const { requests, loading, refreshing, schemaMissing, schemaHint, error, reload } =
    useMaintenanceSupport(isActive);

  const [mode, setMode] = useState<'list' | 'new' | 'detail'>('list');
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [newRecordType, setNewRecordType] =
    useState<MaintenanceSupportRecordType>('suggestion');
  const [newDescription, setNewDescription] = useState('');
  const [newWhatsappAuthorized, setNewWhatsappAuthorized] = useState(false);
  const [newNotifyInApp, setNewNotifyInApp] = useState(true);
  const [newImages, setNewImages] = useState<MaintenanceSupportLocalImage[]>([]);

  const [userUpdateDescription, setUserUpdateDescription] = useState('');
  const [userUpdateMessage, setUserUpdateMessage] = useState('');
  const [userUpdateImages, setUserUpdateImages] = useState<MaintenanceSupportLocalImage[]>([]);

  const [treatmentStatus, setTreatmentStatus] =
    useState<MaintenanceSupportStatus>('received');
  const [developerAction, setDeveloperAction] = useState('');
  const [developerGuidance, setDeveloperGuidance] = useState('');
  const [estimatedDate, setEstimatedDate] = useState('');
  const [communicationMessage, setCommunicationMessage] = useState('');

  const selectedRequest = useMemo(
    () => requests.find((request) => request.id === selectedRequestId) ?? null,
    [requests, selectedRequestId]
  );

  const timeline = useMemo(
    () => (selectedRequest ? buildTimeline(selectedRequest) : []),
    [selectedRequest]
  );

  useEffect(() => {
    if (!selectedRequest) {
      return;
    }

    setTreatmentStatus(selectedRequest.status);
    setDeveloperAction(selectedRequest.developer_action ?? '');
    setDeveloperGuidance(selectedRequest.developer_guidance ?? '');
    setEstimatedDate(formatEstimatedDateInput(selectedRequest.estimated_completion_date));
    setUserUpdateDescription(selectedRequest.description);
    setUserUpdateMessage('');
    setUserUpdateImages([]);
    setCommunicationMessage(buildDefaultCommunicationMessage(selectedRequest));
  }, [selectedRequest]);

  const resetNewForm = useCallback(() => {
    setNewRecordType('suggestion');
    setNewDescription('');
    setNewWhatsappAuthorized(false);
    setNewNotifyInApp(true);
    setNewImages([]);
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
      });

      resetNewForm();
      setSelectedRequestId(created.id);
      setMode('detail');
      await reload({ silent: true });
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
    newWhatsappAuthorized,
    reload,
    resetNewForm,
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
      });

      await reload({ silent: true });
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
    reload,
    selectedRequest,
    treatmentStatus,
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
      style={styles.bodyScroll}
      contentContainerStyle={styles.bodyContent}
      nestedScrollEnabled
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.headerRow}>
        <TouchableOpacity style={styles.backButton} onPress={() => setMode('list')} activeOpacity={0.85}>
          <FontAwesome name="chevron-left" size={13} color="#BAE6FD" />
          <Text style={styles.backButtonText}>Voltar</Text>
        </TouchableOpacity>
        <Text style={styles.formTitle}>Nova sugestão</Text>
      </View>

      <Text style={styles.label}>Tipo de registro</Text>
      <DropdownSelect
        options={MAINTENANCE_SUPPORT_RECORD_TYPE_OPTIONS}
        selectedValue={newRecordType}
        onValueChange={(value) => setNewRecordType(value as MaintenanceSupportRecordType)}
        modalTitle="Tipo de registro"
        style={styles.dropdown}
      />

      <Text style={styles.label}>Descrição detalhada</Text>
      <TextInput
        style={[styles.input, styles.textArea]}
        value={newDescription}
        onChangeText={setNewDescription}
        placeholder="Explique a sugestão, dúvida, comentário ou incidente com detalhes."
        placeholderTextColor="#64748B"
        multiline
        textAlignVertical="top"
      />

      <View style={styles.switchCard}>
        <View style={styles.switchText}>
          <Text style={styles.switchTitle}>Notificações no aplicativo</Text>
          <Text style={styles.switchHint}>Registrar atualizações para acompanhamento no histórico.</Text>
        </View>
        <Switch
          value={newNotifyInApp}
          onValueChange={setNewNotifyInApp}
          trackColor={{ false: '#475569', true: '#0EA5E9' }}
          thumbColor="#F8FAFC"
        />
      </View>

      <View style={styles.switchCard}>
        <View style={styles.switchText}>
          <Text style={styles.switchTitle}>Autorizar WhatsApp</Text>
          <Text style={styles.switchHint}>Permite receber atualizações da ocorrência por WhatsApp.</Text>
        </View>
        <Switch
          value={newWhatsappAuthorized}
          onValueChange={setNewWhatsappAuthorized}
          trackColor={{ false: '#475569', true: '#22C55E' }}
          thumbColor="#F8FAFC"
        />
      </View>

      <TouchableOpacity
        style={styles.secondaryButton}
        onPress={() => void appendPickedImages('new')}
        activeOpacity={0.85}
      >
        <MaterialIcons name="add-photo-alternate" size={18} color="#BAE6FD" />
        <Text style={styles.secondaryButtonText}>
          {newImages.length ? 'Adicionar/substituir imagens' : 'Anexar imagem da galeria'}
        </Text>
      </TouchableOpacity>

      {newImages.length ? (
        <View style={styles.localImagesRow}>
          {newImages.map((image, index) => (
            <LocalImageChip
              key={`${image.uri}-${index}`}
              image={image}
              onRemove={() => setNewImages((current) => current.filter((_, idx) => idx !== index))}
            />
          ))}
        </View>
      ) : null}

      <TouchableOpacity
        style={[styles.primaryButton, saving && styles.buttonDisabled]}
        onPress={() => void handleCreateRequest()}
        disabled={saving}
        activeOpacity={0.85}
      >
        {saving ? <ActivityIndicator color="#0F172A" /> : <Text style={styles.primaryButtonText}>Registrar solicitação</Text>}
      </TouchableOpacity>
    </ScrollView>
  );

  const renderList = () => (
    <View style={styles.listBody}>
      <View style={styles.summaryCard}>
        <Text style={styles.summaryTitle}>Central de relacionamento e suporte</Text>
        <Text style={styles.summaryText}>
          Registre sugestões, dúvidas, comentários e incidentes com rastreabilidade até a conclusão.
        </Text>
      </View>

      <View style={styles.actionsRow}>
        <TouchableOpacity
          style={styles.primaryButtonCompact}
          onPress={() => setMode('new')}
          activeOpacity={0.85}
        >
          <FontAwesome name="plus" size={14} color="#0F172A" />
          <Text style={styles.primaryButtonCompactText}>Nova</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.secondaryButtonCompact}
          onPress={() => void reload({ silent: true })}
          activeOpacity={0.85}
        >
          {refreshing ? (
            <ActivityIndicator color="#BAE6FD" size="small" />
          ) : (
            <FontAwesome name="refresh" size={14} color="#BAE6FD" />
          )}
          <Text style={styles.secondaryButtonCompactText}>Atualizar</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.requestList} nestedScrollEnabled showsVerticalScrollIndicator>
        {requests.length ? (
          requests.map((request) => (
            <TouchableOpacity
              key={request.id}
              style={styles.requestCard}
              onPress={() => {
                setSelectedRequestId(request.id);
                setMode('detail');
              }}
              activeOpacity={0.9}
            >
              <View style={styles.requestHeader}>
                <View style={styles.requestMain}>
                  <Text style={styles.requestTitle} numberOfLines={2}>
                    {MAINTENANCE_SUPPORT_RECORD_TYPE_LABELS[request.record_type]}
                  </Text>
                  <Text style={styles.requestMeta} numberOfLines={1}>
                    {request.requester_name} · {formatDateTime(request.created_at)}
                  </Text>
                </View>
                <RequestStatusBadge status={request.status} />
              </View>
              <Text style={styles.requestDescription} numberOfLines={3}>
                {request.description}
              </Text>
              <View style={styles.requestFooter}>
                <Text style={styles.requestFooterText}>
                  {request.attachments.length} anexo(s) · {request.communications.length} comunicação(ões)
                </Text>
                <FontAwesome name="chevron-right" size={12} color="#64748B" />
              </View>
            </TouchableOpacity>
          ))
        ) : (
          <Text style={styles.emptyText}>Nenhuma solicitação registrada ainda.</Text>
        )}
      </ScrollView>
    </View>
  );

  const renderDetail = () => {
    if (!selectedRequest) {
      return (
        <View style={styles.centerBox}>
          <Text style={styles.emptyText}>Solicitação não encontrada.</Text>
          <TouchableOpacity style={styles.secondaryButtonCompact} onPress={() => setMode('list')}>
            <Text style={styles.secondaryButtonCompactText}>Voltar</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <ScrollView
        style={styles.bodyScroll}
        contentContainerStyle={styles.bodyContent}
        nestedScrollEnabled
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.headerRow}>
          <TouchableOpacity style={styles.backButton} onPress={() => setMode('list')} activeOpacity={0.85}>
            <FontAwesome name="chevron-left" size={13} color="#BAE6FD" />
            <Text style={styles.backButtonText}>Lista</Text>
          </TouchableOpacity>
          <RequestStatusBadge status={isSuperAdmin ? treatmentStatus : selectedRequest.status} />
        </View>

        <View style={styles.detailCard}>
          <Text style={styles.detailTitle}>
            {MAINTENANCE_SUPPORT_RECORD_TYPE_LABELS[selectedRequest.record_type]}
          </Text>
          <Text style={styles.detailMeta}>
            {selectedRequest.requester_name} · aberta em {formatDateTime(selectedRequest.created_at)}
          </Text>
          <Text style={styles.detailMeta}>
            Resposta: {formatDateTime(selectedRequest.responded_at)}
          </Text>
          <Text style={styles.detailDescription}>{selectedRequest.description}</Text>
          <View style={styles.authorizationRow}>
            <Text style={styles.authorizationText}>
              WhatsApp {selectedRequest.whatsapp_authorized ? 'autorizado' : 'não autorizado'}
            </Text>
            <Text style={styles.authorizationText}>
              Notificação app {selectedRequest.notify_in_app ? 'ativa' : 'inativa'}
            </Text>
          </View>
        </View>

        {selectedRequest.attachments.length ? (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Anexos</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.attachmentRow}>
              {selectedRequest.attachments.map((attachment) => (
                <View key={attachment.id} style={styles.attachmentItem}>
                  {attachment.signedUrl ? (
                    <Image source={{ uri: attachment.signedUrl }} style={styles.attachmentImage} contentFit="cover" />
                  ) : (
                    <View style={styles.attachmentMissing}>
                      <FontAwesome name="image" size={20} color="#64748B" />
                    </View>
                  )}
                  <Text style={styles.attachmentCaption} numberOfLines={1}>
                    {attachment.file_name ?? 'imagem'}
                  </Text>
                </View>
              ))}
            </ScrollView>
          </View>
        ) : null}

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Atualização do usuário</Text>
          <TextInput
            style={[styles.input, styles.textAreaSmall]}
            value={userUpdateDescription}
            onChangeText={setUserUpdateDescription}
            placeholder="Atualize a descrição se necessário."
            placeholderTextColor="#64748B"
            multiline
            textAlignVertical="top"
          />
          <TextInput
            style={[styles.input, styles.textAreaSmall]}
            value={userUpdateMessage}
            onChangeText={setUserUpdateMessage}
            placeholder="Registre uma alteração, complemento ou comentário para o histórico."
            placeholderTextColor="#64748B"
            multiline
            textAlignVertical="top"
          />
          <TouchableOpacity style={styles.secondaryButton} onPress={() => void appendPickedImages('user')} activeOpacity={0.85}>
            <MaterialIcons name="add-photo-alternate" size={18} color="#BAE6FD" />
            <Text style={styles.secondaryButtonText}>Adicionar imagens complementares</Text>
          </TouchableOpacity>
          {userUpdateImages.length ? (
            <View style={styles.localImagesRow}>
              {userUpdateImages.map((image, index) => (
                <LocalImageChip
                  key={`${image.uri}-${index}`}
                  image={image}
                  onRemove={() =>
                    setUserUpdateImages((current) => current.filter((_, idx) => idx !== index))
                  }
                />
              ))}
            </View>
          ) : null}
          <TouchableOpacity
            style={[styles.secondaryButton, saving && styles.buttonDisabled]}
            onPress={() => void handleSaveUserUpdate()}
            disabled={saving}
            activeOpacity={0.85}
          >
            <Text style={styles.secondaryButtonText}>Salvar atualização do usuário</Text>
          </TouchableOpacity>
        </View>

        {isSuperAdmin ? (
          <View style={styles.developerCard}>
            <Text style={styles.sectionTitle}>Tratamento pelo desenvolvedor</Text>
            <Text style={styles.label}>Status da solicitação</Text>
            <Text style={styles.helperText}>
              Toque em um status abaixo e depois em Salvar tratamento para aplicar a alteração.
            </Text>
            <View style={styles.statusChipRow}>
              {MAINTENANCE_SUPPORT_STATUS_OPTIONS.map((option) => {
                const value = option.value as MaintenanceSupportStatus;
                const selected = treatmentStatus === value;
                const tone = statusTone[value];

                return (
                  <Pressable
                    key={option.value}
                    style={[
                      styles.statusChip,
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
                        styles.statusChipText,
                        { color: selected ? tone.text : '#CBD5E1' },
                      ]}
                    >
                      {option.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={styles.label}>Ação tomada ou planejada</Text>
            <TextInput
              style={[styles.input, styles.textAreaSmall]}
              value={developerAction}
              onChangeText={setDeveloperAction}
              placeholder="Descreva a ação tomada ou a ser tomada."
              placeholderTextColor="#64748B"
              multiline
              textAlignVertical="top"
            />

            <Text style={styles.label}>Previsão de implementação/conclusão</Text>
            <TextInput
              style={styles.input}
              value={estimatedDate}
              onChangeText={(value) => setEstimatedDate(formatBrazilDateInput(value))}
              placeholder={DATE_INPUT_PLACEHOLDER}
              placeholderTextColor="#64748B"
              autoCapitalize="none"
              keyboardType="number-pad"
            />

            <Text style={styles.label}>Orientações detalhadas ao usuário</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={developerGuidance}
              onChangeText={setDeveloperGuidance}
              placeholder="Explique a solução, localização da funcionalidade e passo a passo de uso."
              placeholderTextColor="#64748B"
              multiline
              textAlignVertical="top"
            />

            <TouchableOpacity
              style={[styles.primaryButton, saving && styles.buttonDisabled]}
              onPress={() => void handleSaveTreatment()}
              disabled={saving}
              activeOpacity={0.85}
            >
              <Text style={styles.primaryButtonText}>Salvar tratamento</Text>
            </TouchableOpacity>

            <Text style={styles.label}>Mensagem ao usuário</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={communicationMessage}
              onChangeText={setCommunicationMessage}
              placeholder="Mensagem de atualização para o usuário."
              placeholderTextColor="#64748B"
              multiline
              textAlignVertical="top"
            />
            <View style={styles.communicationButtons}>
              <TouchableOpacity
                style={styles.secondaryButtonCompact}
                onPress={() => void handleRegisterInAppCommunication()}
                disabled={saving}
                activeOpacity={0.85}
              >
                <FontAwesome name="bell" size={14} color="#BAE6FD" />
                <Text style={styles.secondaryButtonCompactText}>Registrar no app</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.whatsappButton,
                  (!selectedRequest.whatsapp_authorized || !selectedRequest.requester_phone) && styles.buttonDisabled,
                ]}
                onPress={() => void handleSendWhatsApp()}
                disabled={saving || !selectedRequest.whatsapp_authorized || !selectedRequest.requester_phone}
                activeOpacity={0.85}
              >
                <FontAwesome name="whatsapp" size={15} color="#DCFCE7" />
                <Text style={styles.whatsappButtonText}>WhatsApp</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Histórico cronológico</Text>
          {timeline.length ? (
            timeline.map((entry) => (
              <View key={entry.id} style={styles.timelineItem}>
                <View style={styles.timelineDot} />
                <View style={styles.timelineBody}>
                  <View style={styles.timelineHeader}>
                    <Text style={styles.timelineTitle}>{entry.title}</Text>
                    <Text style={styles.timelineDate}>{formatDateTime(entry.date)}</Text>
                  </View>
                  <Text style={styles.timelineMeta}>{entry.meta}</Text>
                  <Text style={styles.timelineMessage}>{entry.message}</Text>
                </View>
              </View>
            ))
          ) : (
            <Text style={styles.emptyText}>Nenhuma interação registrada.</Text>
          )}
        </View>
      </ScrollView>
    );
  };

  return (
    <View style={[styles.panel, { height: contentHeight }]}>
      <Text style={maintenancePanelStyles.panelTitle}>Sugestões e Melhorias</Text>
      <Text style={styles.subtitle}>
        Registro, acompanhamento, respostas e comunicações das solicitações dos usuários.
      </Text>

      {schemaMissing ? <Text style={styles.warningText}>{schemaHint}</Text> : null}
      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {loading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator color={ACCENT} />
          <Text style={styles.loadingText}>Carregando solicitações...</Text>
        </View>
      ) : mode === 'new' ? (
        renderNewRequestForm()
      ) : mode === 'detail' ? (
        renderDetail()
      ) : (
        renderList()
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    flex: 1,
    minHeight: 0,
    gap: 8,
  },
  subtitle: {
    color: '#94A3B8',
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
    color: '#94A3B8',
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
    color: '#E0F2FE',
    fontSize: 14,
    fontWeight: '800',
  },
  summaryText: {
    color: '#BAE6FD',
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
    backgroundColor: 'rgba(15, 23, 42, 0.68)',
    padding: 12,
    gap: 8,
    marginBottom: 8,
  },
  requestHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  requestMain: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  requestTitle: {
    color: '#F8FAFC',
    fontSize: 15,
    fontWeight: '800',
  },
  requestMeta: {
    color: '#94A3B8',
    fontSize: 11,
  },
  requestDescription: {
    color: '#CBD5E1',
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
    color: '#7DD3FC',
    fontSize: 11,
    fontWeight: '700',
  },
  emptyText: {
    color: '#94A3B8',
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
    color: '#BAE6FD',
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
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
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
    color: '#BAE6FD',
    fontSize: 12,
    fontWeight: '800',
  },
  formTitle: {
    color: '#E0F2FE',
    fontSize: 14,
    fontWeight: '800',
  },
  label: {
    color: '#BAE6FD',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  dropdown: {
    flex: 0,
    width: '100%',
  },
  input: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: 'rgba(15, 23, 42, 0.72)',
    color: '#F8FAFC',
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
    borderColor: '#334155',
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    padding: 12,
  },
  switchText: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  switchTitle: {
    color: '#E2E8F0',
    fontSize: 13,
    fontWeight: '800',
  },
  switchHint: {
    color: '#94A3B8',
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
    color: '#BAE6FD',
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
    borderColor: '#334155',
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
    backgroundColor: 'rgba(15, 23, 42, 0.68)',
    padding: 12,
    gap: 7,
  },
  detailTitle: {
    color: '#F8FAFC',
    fontSize: 17,
    fontWeight: '900',
  },
  detailMeta: {
    color: '#94A3B8',
    fontSize: 11,
    lineHeight: 16,
  },
  detailDescription: {
    color: '#E2E8F0',
    fontSize: 13,
    lineHeight: 19,
  },
  authorizationRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  authorizationText: {
    color: '#7DD3FC',
    fontSize: 11,
    fontWeight: '800',
  },
  sectionCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
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
    color: '#94A3B8',
    fontSize: 11,
    lineHeight: 16,
  },
  statusChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  statusChip: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  statusChipText: {
    fontSize: 11,
    fontWeight: '800',
  },
  sectionTitle: {
    color: '#E0F2FE',
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
    borderColor: '#334155',
  },
  attachmentMissing: {
    width: 100,
    height: 76,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
  },
  attachmentCaption: {
    color: '#94A3B8',
    fontSize: 10,
  },
  communicationButtons: {
    flexDirection: 'row',
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
    borderBottomColor: 'rgba(51, 65, 85, 0.72)',
    paddingBottom: 9,
    gap: 3,
  },
  timelineHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  timelineTitle: {
    color: '#E2E8F0',
    fontSize: 12,
    fontWeight: '900',
  },
  timelineDate: {
    color: '#64748B',
    fontSize: 10,
  },
  timelineMeta: {
    color: '#7DD3FC',
    fontSize: 10,
    fontWeight: '700',
  },
  timelineMessage: {
    color: '#CBD5E1',
    fontSize: 12,
    lineHeight: 17,
  },
});
