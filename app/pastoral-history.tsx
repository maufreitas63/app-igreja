import { formatShortName } from '@/lib/formatShortName';
import {
  canDeletePastoralRequest,
  deleteMyPastoralRequest,
  fetchMyPastoralRequests,
  formatPastoralBeneficiarySummary,
  formatPastoralRequestDate,
  formatPastoralStatusLabel,
  getPastoralRequestDeleteBlockedMessage,
  getSupabaseErrorMessage,
  hasPastoralCancellationRequested,
  isPastoralRequestCareStarted,
  MIN_PASTORAL_CANCELLATION_REASON_LENGTH,
  requestMyPastoralCancellation,
  resolvePastoralSessionProfile,
  type PastoralRequestHistoryItem,
} from '@/lib/pastoralRequest';
import { appAlert } from '@/lib/appAlert';
import { confirmDialog } from '@/lib/confirmDialog';
import { ACCESS_SCREEN } from '@/lib/accessControl';
import { CloseFooterBar } from '@/components/minimal/CloseFooterBar';
import { MinimalScreenLayout } from '@/components/minimal/MinimalScreenLayout';
import { ScreenAccessGate } from '@/components/ScreenAccessGate';
import { useScreenAccessGuard } from '@/hooks/useScreenAccessGuard';
import {
  fetchMyPastoralAppointments,
  formatPastoralSlotTimeRange,
  PASTORAL_ATTENDANCE_TYPE_LABEL,
  PASTORAL_SLOT_STATUS_LABEL,
  type MyPastoralAppointment,
} from '@/lib/pastoralSlotsApi';
import {
  isMinimalPresentationRoute,
  withMinimalPresentation,
  buildReturnToDashboardHref,
  resolveReturnDashboardCardParam,
} from '@/lib/dashboardReturnNavigation';
import { MINIMAL_SECTION_TITLE, MINIMAL_UI } from '@/lib/minimalUiTheme';
import { FontAwesome } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const HISTORY_VIGILANCE_SURFACE = '#FFFFFF';
const HISTORY_VIGILANCE_ICON = '#1B4F8A';
const HISTORY_VIGILANCE_SUBMIT_BG = '#3A96DD';
const HISTORY_VIGILANCE_SUBMIT_TEXT = '#FFFFFF';
const HISTORY_SOFT_BORDER = 'rgba(52, 211, 153, 0.35)';

export default function PastoralHistoryScreen() {
  const params = useLocalSearchParams<{
    userId?: string | string[];
    presentation?: string | string[];
    returnDashboardCard?: string | string[];
  }>();
  const routeUserId = Array.isArray(params.userId) ? params.userId[0] : params.userId;
  const isMinimalPresentation = isMinimalPresentationRoute(params.presentation);
  const useVigilanceTheme = isMinimalPresentation;
  const router = useRouter();

  const accessStatus = useScreenAccessGuard({
    resourceKey: ACCESS_SCREEN.pastoralHistory,
    deniedMessage: 'Você não tem permissão para ver seus pedidos pastorais.',
  });

  const [profileId, setProfileId] = useState<string | null>(null);
  const [requests, setRequests] = useState<PastoralRequestHistoryItem[]>([]);
  const [appointments, setAppointments] = useState<MyPastoralAppointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [deletingRequestId, setDeletingRequestId] = useState<string | null>(null);
  const [cancellationModalRequest, setCancellationModalRequest] =
    useState<PastoralRequestHistoryItem | null>(null);
  const [cancellationReason, setCancellationReason] = useState('');
  const [submittingCancellationId, setSubmittingCancellationId] = useState<string | null>(null);
  const lastHistoryFetchAtRef = useRef(0);
  const HISTORY_FOCUS_STALE_MS = 60_000;

  const buildPastoralHrefParams = useCallback(() => {
    const next: Record<string, string> = {};
    if (profileId) {
      next.userId = profileId;
    }
    return useVigilanceTheme ? withMinimalPresentation(next) : next;
  }, [profileId, useVigilanceTheme]);

  const loadHistory = useCallback(
    async (options?: { refresh?: boolean; force?: boolean }) => {
      const isRefresh = options?.refresh === true;
      const force = options?.force === true;

      if (
        !force
        && !isRefresh
        && lastHistoryFetchAtRef.current > 0
        && Date.now() - lastHistoryFetchAtRef.current < HISTORY_FOCUS_STALE_MS
      ) {
        return;
      }

      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setErrorMessage(null);

      try {
        const session = await resolvePastoralSessionProfile(routeUserId ?? null);
        const activeProfileId = session?.userId ?? null;

        if (!activeProfileId) {
          setProfileId(null);
          setRequests([]);
          setAppointments([]);
          setErrorMessage('Faça login novamente para ver seus pedidos.');
          return;
        }

        setProfileId(activeProfileId);
        const items = await fetchMyPastoralRequests(activeProfileId);
        let nextAppointments: MyPastoralAppointment[] = [];

        try {
          nextAppointments = await fetchMyPastoralAppointments();
        } catch (appointmentError) {
          console.warn('Agendamentos pastorais indisponíveis:', appointmentError);
        }

        setRequests(items);
        setAppointments(nextAppointments);
        lastHistoryFetchAtRef.current = Date.now();
      } catch (error) {
        console.error('Erro ao carregar histórico pastoral:', error);
        setErrorMessage(getSupabaseErrorMessage(error));
        setRequests([]);
        setAppointments([]);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [routeUserId]
  );

  const appointmentByRequestId = useMemo(() => {
    const map = new Map<string, MyPastoralAppointment>();

    for (const item of appointments) {
      if (item.pastoral_request_id) {
        map.set(item.pastoral_request_id, item);
      }
    }

    return map;
  }, [appointments]);

  const standaloneAppointments = useMemo(
    () =>
      appointments.filter(
        (item) =>
          !item.pastoral_request_id
          || !requests.some((request) => request.id === item.pastoral_request_id)
      ),
    [appointments, requests]
  );

  useFocusEffect(
    useCallback(() => {
      void loadHistory({ force: lastHistoryFetchAtRef.current === 0 });
    }, [loadHistory])
  );

  const handleBack = () => {
    const returnCard = resolveReturnDashboardCardParam(params);

    if (returnCard) {
      router.replace(buildReturnToDashboardHref(returnCard));
      return;
    }

    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace({
      pathname: '/pastoral',
      params: buildPastoralHrefParams(),
    });
  };

  const handleNewRequest = () => {
    router.replace({
      pathname: '/pastoral',
      params: buildPastoralHrefParams(),
    });
  };

  const handleDeleteRequest = useCallback(
    async (item: PastoralRequestHistoryItem) => {
      if (!profileId) {
        await appAlert('Erro', 'Faça login novamente para excluir pedidos.');
        return;
      }

      const motivoLabel = item.motivo?.trim() || 'este pedido';

      if (!canDeletePastoralRequest(item.status)) {
        await appAlert('Exclusão bloqueada', getPastoralRequestDeleteBlockedMessage());
        return;
      }

      const confirmed = await confirmDialog(
        'Excluir pedido',
        `Deseja excluir o pedido "${motivoLabel}"? Esta ação não pode ser desfeita.`,
        'Excluir',
        'Cancelar',
        { destructive: true }
      );

      if (!confirmed) {
        return;
      }

      setDeletingRequestId(item.id);

      try {
        await deleteMyPastoralRequest(item.id, profileId);
        setRequests((current) => current.filter((entry) => entry.id !== item.id));
        lastHistoryFetchAtRef.current = Date.now();
        await appAlert('Pedido excluído', 'O pedido foi removido com sucesso.');
      } catch (error) {
        console.error('Erro ao excluir pedido pastoral:', error);
        await appAlert('Erro', getSupabaseErrorMessage(error));
      } finally {
        setDeletingRequestId(null);
      }
    },
    [profileId]
  );

  const handleOpenCancellationModal = useCallback((item: PastoralRequestHistoryItem) => {
    setCancellationModalRequest(item);
    setCancellationReason('');
  }, []);

  const handleCloseCancellationModal = useCallback(() => {
    if (submittingCancellationId) {
      return;
    }

    setCancellationModalRequest(null);
    setCancellationReason('');
  }, [submittingCancellationId]);

  const handleSubmitCancellationRequest = useCallback(async () => {
    if (!profileId || !cancellationModalRequest) {
      await appAlert('Erro', 'Faça login novamente para solicitar cancelamento.');
      return;
    }

    const trimmedReason = cancellationReason.trim();

    if (trimmedReason.length < MIN_PASTORAL_CANCELLATION_REASON_LENGTH) {
      await appAlert(
        'Justificativa obrigatória',
        `Informe uma justificativa com pelo menos ${MIN_PASTORAL_CANCELLATION_REASON_LENGTH} caracteres.`
      );
      return;
    }

    setSubmittingCancellationId(cancellationModalRequest.id);

    try {
      const result = await requestMyPastoralCancellation(
        cancellationModalRequest.id,
        profileId,
        trimmedReason
      );

      setRequests((current) =>
        current.map((entry) =>
          entry.id === cancellationModalRequest.id
            ? {
                ...entry,
                cancellation_requested_at: result.cancellationRequestedAt,
                cancellation_request_reason: result.cancellationRequestReason,
              }
            : entry
        )
      );
      setCancellationModalRequest(null);
      setCancellationReason('');
      lastHistoryFetchAtRef.current = Date.now();
      await appAlert(
        'Solicitação enviada',
        'O Cuidado Pastoral foi notificado. Aguarde a confirmação do cancelamento.'
      );
    } catch (error) {
      console.error('Erro ao solicitar cancelamento pastoral:', error);
      await appAlert('Erro', getSupabaseErrorMessage(error));
    } finally {
      setSubmittingCancellationId(null);
    }
  }, [cancellationModalRequest, cancellationReason, profileId]);

  const content = (
    <>
      <Modal
        visible={cancellationModalRequest !== null}
        transparent
        animationType="fade"
        onRequestClose={handleCloseCancellationModal}
      >
        <Pressable
          style={[
            styles.cancellationBackdrop,
            useVigilanceTheme && styles.cancellationBackdropVigilance,
          ]}
          onPress={handleCloseCancellationModal}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.cancellationKeyboardWrap}
          >
            <Pressable
              style={[
                styles.cancellationModalCard,
                useVigilanceTheme && styles.cancellationModalCardVigilance,
              ]}
              onPress={() => undefined}
            >
              <Text
                style={[
                  styles.cancellationModalTitle,
                  useVigilanceTheme && styles.cancellationModalTitleVigilance,
                ]}
              >
                Solicitar cancelamento
              </Text>
              <Text
                style={[
                  styles.cancellationModalHint,
                  useVigilanceTheme && styles.cancellationModalHintVigilance,
                ]}
              >
                Informe o motivo do cancelamento. O Cuidado Pastoral verá esta justificativa
                antes de confirmar a exclusão.
              </Text>
              <TextInput
                accessibilityLabel="Justificativa do cancelamento"
                editable={!submittingCancellationId}
                multiline
                numberOfLines={4}
                onChangeText={setCancellationReason}
                placeholder="Descreva o motivo do cancelamento..."
                placeholderTextColor={
                  useVigilanceTheme ? VIGILANCE_SCALES_UI.accent : '#64748B'
                }
                style={[
                  styles.cancellationReasonInput,
                  useVigilanceTheme && styles.cancellationReasonInputVigilance,
                ]}
                textAlignVertical="top"
                value={cancellationReason}
              />
              <View style={styles.cancellationModalActions}>
                <TouchableOpacity
                  accessibilityLabel="Fechar solicitação de cancelamento"
                  accessibilityRole="button"
                  activeOpacity={0.85}
                  disabled={Boolean(submittingCancellationId)}
                  onPress={handleCloseCancellationModal}
                  style={[
                    styles.cancellationSecondaryButton,
                    useVigilanceTheme && styles.cancellationSecondaryButtonVigilance,
                  ]}
                >
                  <Text
                    style={[
                      styles.cancellationSecondaryButtonText,
                      useVigilanceTheme && styles.cancellationSecondaryButtonTextVigilance,
                    ]}
                  >
                    Voltar
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  accessibilityLabel="Enviar solicitação de cancelamento"
                  accessibilityRole="button"
                  activeOpacity={0.85}
                  disabled={Boolean(submittingCancellationId)}
                  onPress={() => void handleSubmitCancellationRequest()}
                  style={[
                    styles.cancellationPrimaryButton,
                    useVigilanceTheme && styles.cancellationPrimaryButtonVigilance,
                    submittingCancellationId && styles.cancellationPrimaryButtonDisabled,
                  ]}
                >
                  {submittingCancellationId ? (
                    <ActivityIndicator
                      color={useVigilanceTheme ? HISTORY_VIGILANCE_SUBMIT_TEXT : '#FFF'}
                      size="small"
                    />
                  ) : (
                    <Text
                      style={[
                        styles.cancellationPrimaryButtonText,
                        useVigilanceTheme && styles.cancellationPrimaryButtonTextVigilance,
                      ]}
                    >
                      Enviar
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </Pressable>
          </KeyboardAvoidingView>
        </Pressable>
      </Modal>

      <View style={styles.headerBar}>
        <View style={styles.headerTitles}>
          {!useVigilanceTheme ? (
            <>
              <Text style={styles.title}>Meus pedidos</Text>
              <Text style={styles.subtitle}>Histórico do Coração Aberto</Text>
            </>
          ) : (
            <>
              <Text style={styles.titleVigilance}>Meus pedidos</Text>
              <Text style={styles.subtitleVigilance}>Histórico do Coração Aberto</Text>
            </>
          )}
        </View>
        {!useVigilanceTheme ? (
          <TouchableOpacity
            accessibilityLabel="Voltar"
            accessibilityRole="button"
            activeOpacity={0.85}
            onPress={handleBack}
            style={styles.headerBackButton}
          >
            <Text style={styles.headerBackText}>Voltar</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            accessibilityLabel="Voltar"
            accessibilityRole="button"
            activeOpacity={0.85}
            onPress={handleBack}
            style={styles.headerBackButtonVigilance}
          >
            <Text style={styles.headerBackTextVigilance}>Voltar</Text>
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator
            color={useVigilanceTheme ? VIGILANCE_SCALES_UI.accent : '#C4B5FD'}
            size="large"
          />
          <Text style={[styles.loadingText, useVigilanceTheme && styles.loadingTextVigilance]}>
            Carregando pedidos...
          </Text>
        </View>
      ) : errorMessage ? (
        <View style={styles.centered}>
          <Text style={[styles.errorText, useVigilanceTheme && styles.errorTextVigilance]}>
            {errorMessage}
          </Text>
          <TouchableOpacity
            style={[styles.retryButton, useVigilanceTheme && styles.retryButtonVigilance]}
            onPress={() => void loadHistory()}
            activeOpacity={0.85}
          >
            <Text
              style={[styles.retryButtonText, useVigilanceTheme && styles.retryButtonTextVigilance]}
            >
              Tentar novamente
            </Text>
          </TouchableOpacity>
        </View>
      ) : requests.length === 0 && appointments.length === 0 ? (
        <View style={styles.centered}>
          <FontAwesome
            name="inbox"
            size={40}
            color={useVigilanceTheme ? HISTORY_VIGILANCE_ICON : '#64748b'}
          />
          <Text style={[styles.emptyTitle, useVigilanceTheme && styles.emptyTitleVigilance]}>
            Nenhum pedido ainda
          </Text>
          <Text
            style={[styles.emptySubtitle, useVigilanceTheme && styles.emptySubtitleVigilance]}
          >
            Quando você enviar um pedido pelo Coração Aberto, ele aparecerá aqui.
          </Text>
          <TouchableOpacity
            style={[styles.primaryButton, useVigilanceTheme && styles.primaryButtonVigilance]}
            onPress={handleNewRequest}
            activeOpacity={0.85}
          >
            <Text
              style={[
                styles.primaryButtonText,
                useVigilanceTheme && styles.primaryButtonTextVigilance,
              ]}
            >
              Fazer um pedido
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          style={styles.listScroll}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => void loadHistory({ refresh: true })}
              tintColor={useVigilanceTheme ? VIGILANCE_SCALES_UI.accent : '#C4B5FD'}
              colors={[useVigilanceTheme ? VIGILANCE_SCALES_UI.accent : '#C4B5FD']}
            />
          }
        >
          {requests.map((item) => {
            const canDelete = canDeletePastoralRequest(item.status);
            const careStarted = isPastoralRequestCareStarted(item.status);
            const cancellationRequested = hasPastoralCancellationRequested(item);
            const canRequestCancellation = careStarted && !cancellationRequested;
            const isDeleting = deletingRequestId === item.id;
            const isSubmittingCancellation = submittingCancellationId === item.id;
            const handlerDisplayName =
              careStarted && item.handler_name?.trim()
                ? formatShortName(item.handler_name)
                : null;
            const appointment = appointmentByRequestId.get(item.id);

            return (
              <View
                key={item.id}
                style={[styles.card, useVigilanceTheme && styles.cardVigilance]}
              >
                <View style={styles.cardHeader}>
                  <Text
                    style={[styles.cardDate, useVigilanceTheme && styles.cardDateVigilance]}
                  >
                    {formatPastoralRequestDate(item.created_at)}
                  </Text>
                  <View style={styles.cardHeaderActions}>
                    {canDelete ? (
                      <TouchableOpacity
                        accessibilityLabel="Excluir pedido pastoral"
                        accessibilityRole="button"
                        accessibilityState={{ disabled: isDeleting }}
                        activeOpacity={0.85}
                        disabled={isDeleting}
                        onPress={() => void handleDeleteRequest(item)}
                        style={[
                          styles.cardDeleteButton,
                          useVigilanceTheme && styles.cardDeleteButtonVigilance,
                          isDeleting && styles.cardDeleteButtonDisabled,
                          isDeleting && useVigilanceTheme && styles.cardDeleteButtonDisabledVigilance,
                        ]}
                      >
                        {isDeleting ? (
                          <ActivityIndicator
                            color={useVigilanceTheme ? '#DC2626' : '#FCA5A5'}
                            size="small"
                          />
                        ) : (
                          <FontAwesome
                            name="eraser"
                            size={16}
                            color={useVigilanceTheme ? '#DC2626' : '#FCA5A5'}
                          />
                        )}
                      </TouchableOpacity>
                    ) : null}
                    <View
                      style={[
                        styles.statusBadge,
                        useVigilanceTheme && styles.statusBadgeVigilance,
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusBadgeText,
                          useVigilanceTheme && styles.statusBadgeTextVigilance,
                        ]}
                      >
                        {formatPastoralStatusLabel(item.status)}
                      </Text>
                    </View>
                  </View>
                </View>

                <Text
                  style={[styles.cardMotivo, useVigilanceTheme && styles.cardMotivoVigilance]}
                  numberOfLines={2}
                >
                  {item.motivo?.trim() || 'Motivo não informado'}
                </Text>
                <Text
                  style={[
                    styles.cardSituacao,
                    useVigilanceTheme && styles.cardSituacaoVigilance,
                  ]}
                  numberOfLines={2}
                >
                  {item.situacao?.trim() || 'Situação não informada'}
                </Text>

                <View style={styles.metaRow}>
                  <Text
                    style={[styles.metaLabel, useVigilanceTheme && styles.metaLabelVigilance]}
                  >
                    Para:
                  </Text>
                  <Text
                    style={[styles.metaValue, useVigilanceTheme && styles.metaValueVigilance]}
                  >
                    {formatPastoralBeneficiarySummary(item)}
                  </Text>
                </View>

                {item.destination_label ? (
                  <View style={styles.metaBlock}>
                    <View style={styles.metaRow}>
                      <Text
                        style={[
                          styles.metaLabel,
                          useVigilanceTheme && styles.metaLabelVigilance,
                        ]}
                      >
                        Encaminhado para:
                      </Text>
                      <Text
                        style={[
                          styles.metaValue,
                          useVigilanceTheme && styles.metaValueVigilance,
                        ]}
                      >
                        {item.destination_label}
                      </Text>
                    </View>
                    {handlerDisplayName ? (
                      <View style={styles.metaRow}>
                        <Text
                          style={[
                            styles.metaLabel,
                            useVigilanceTheme && styles.metaLabelVigilance,
                          ]}
                        >
                          Acompanhado por:
                        </Text>
                        <Text
                          style={[
                            styles.metaValue,
                            useVigilanceTheme && styles.metaValueVigilance,
                          ]}
                          numberOfLines={1}
                        >
                          {handlerDisplayName}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                ) : null}

                {appointment ? (
                  <View style={styles.metaBlock}>
                    <View style={styles.metaRow}>
                      <Text
                        style={[
                          styles.metaLabel,
                          useVigilanceTheme && styles.metaLabelVigilance,
                        ]}
                      >
                        Agendamento:
                      </Text>
                      <Text
                        style={[
                          styles.metaValue,
                          useVigilanceTheme && styles.metaValueVigilance,
                        ]}
                      >
                        {formatPastoralSlotTimeRange(
                          appointment.data_hora_inicio,
                          appointment.data_hora_fim
                        )}
                      </Text>
                    </View>
                    <View style={styles.metaRow}>
                      <Text
                        style={[
                          styles.metaLabel,
                          useVigilanceTheme && styles.metaLabelVigilance,
                        ]}
                      >
                        Local:
                      </Text>
                      <Text
                        style={[
                          styles.metaValue,
                          useVigilanceTheme && styles.metaValueVigilance,
                        ]}
                      >
                        {PASTORAL_ATTENDANCE_TYPE_LABEL[appointment.tipo_atendimento]}
                        {' · '}
                        {PASTORAL_SLOT_STATUS_LABEL[appointment.status]}
                      </Text>
                    </View>
                    {appointment.pastor_name ? (
                      <View style={styles.metaRow}>
                        <Text
                          style={[
                            styles.metaLabel,
                            useVigilanceTheme && styles.metaLabelVigilance,
                          ]}
                        >
                          Atendente:
                        </Text>
                        <Text
                          style={[
                            styles.metaValue,
                            useVigilanceTheme && styles.metaValueVigilance,
                          ]}
                          numberOfLines={1}
                        >
                          {appointment.pastor_name}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                ) : null}

                {item.description?.trim() ? (
                  <Text
                    style={[
                      styles.cardDescription,
                      useVigilanceTheme && styles.cardDescriptionVigilance,
                    ]}
                    numberOfLines={3}
                  >
                    {item.description.trim()}
                  </Text>
                ) : null}

                {cancellationRequested ? (
                  <View
                    style={[
                      styles.cancellationPendingBox,
                      useVigilanceTheme && styles.cancellationPendingBoxVigilance,
                    ]}
                  >
                    <Text
                      style={[
                        styles.cancellationPendingTitle,
                        useVigilanceTheme && styles.cancellationPendingTitleVigilance,
                      ]}
                    >
                      Cancelamento solicitado
                    </Text>
                    {item.cancellation_request_reason?.trim() ? (
                      <Text
                        style={[
                          styles.cancellationPendingReason,
                          useVigilanceTheme && styles.cancellationPendingReasonVigilance,
                        ]}
                      >
                        {item.cancellation_request_reason.trim()}
                      </Text>
                    ) : null}
                    <Text
                      style={[
                        styles.cancellationPendingHint,
                        useVigilanceTheme && styles.cancellationPendingHintVigilance,
                      ]}
                    >
                      Aguarde o Cuidado Pastoral confirmar a exclusão.
                    </Text>
                  </View>
                ) : null}

                {canRequestCancellation ? (
                  <TouchableOpacity
                    accessibilityLabel="Solicitar cancelamento do pedido pastoral"
                    accessibilityRole="button"
                    activeOpacity={0.85}
                    disabled={isSubmittingCancellation}
                    onPress={() => handleOpenCancellationModal(item)}
                    style={[
                      styles.requestCancellationButton,
                      useVigilanceTheme && styles.requestCancellationButtonVigilance,
                      isSubmittingCancellation && styles.requestCancellationButtonDisabled,
                    ]}
                  >
                    {isSubmittingCancellation ? (
                      <ActivityIndicator
                        color={useVigilanceTheme ? '#DC2626' : '#FECACA'}
                        size="small"
                      />
                    ) : (
                      <Text
                        style={[
                          styles.requestCancellationButtonText,
                          useVigilanceTheme && styles.requestCancellationButtonTextVigilance,
                        ]}
                      >
                        Solicitar cancelamento
                      </Text>
                    )}
                  </TouchableOpacity>
                ) : null}
              </View>
            );
          })}
          {standaloneAppointments.map((appointment) => (
            <View
              key={`slot-${appointment.id}`}
              style={[styles.card, useVigilanceTheme && styles.cardVigilance]}
            >
              <View style={styles.cardHeader}>
                <Text style={[styles.cardDate, useVigilanceTheme && styles.cardDateVigilance]}>
                  {formatPastoralSlotTimeRange(
                    appointment.data_hora_inicio,
                    appointment.data_hora_fim
                  )}
                </Text>
                <View
                  style={[styles.statusBadge, useVigilanceTheme && styles.statusBadgeVigilance]}
                >
                  <Text
                    style={[
                      styles.statusBadgeText,
                      useVigilanceTheme && styles.statusBadgeTextVigilance,
                    ]}
                  >
                    {PASTORAL_SLOT_STATUS_LABEL[appointment.status]}
                  </Text>
                </View>
              </View>
              <Text
                style={[styles.cardMotivo, useVigilanceTheme && styles.cardMotivoVigilance]}
                numberOfLines={2}
              >
                Atendimento {PASTORAL_ATTENDANCE_TYPE_LABEL[appointment.tipo_atendimento]}
              </Text>
              {appointment.pastor_name ? (
                <View style={styles.metaRow}>
                  <Text style={[styles.metaLabel, useVigilanceTheme && styles.metaLabelVigilance]}>
                    Atendente:
                  </Text>
                  <Text style={[styles.metaValue, useVigilanceTheme && styles.metaValueVigilance]}>
                    {appointment.pastor_name}
                  </Text>
                </View>
              ) : null}
              {appointment.request_status ? (
                <View style={styles.metaRow}>
                  <Text style={[styles.metaLabel, useVigilanceTheme && styles.metaLabelVigilance]}>
                    Pedido:
                  </Text>
                  <Text style={[styles.metaValue, useVigilanceTheme && styles.metaValueVigilance]}>
                    {formatPastoralStatusLabel(appointment.request_status)}
                  </Text>
                </View>
              ) : null}
            </View>
          ))}
        </ScrollView>
      )}

      {!loading && !errorMessage ? (
        <View style={[styles.footerBar, useVigilanceTheme && styles.footerBarVigilance]}>
          <View style={styles.footerActions}>
            <TouchableOpacity
              accessibilityLabel="Novo pedido pastoral"
              accessibilityRole="button"
              style={[styles.footerButton, useVigilanceTheme && styles.footerButtonVigilance]}
              onPress={handleNewRequest}
              activeOpacity={0.85}
            >
              <Text
                style={[
                  styles.footerButtonText,
                  useVigilanceTheme && styles.footerButtonTextVigilance,
                ]}
              >
                Novo pedido
              </Text>
            </TouchableOpacity>
          </View>
          <CloseFooterBar
            onPress={handleBack}
            variant={useVigilanceTheme ? 'minimal' : 'dark'}
          />
        </View>
      ) : null}
    </>
  );

  return (
    <ScreenAccessGate status={accessStatus}>
      {useVigilanceTheme ? (
        <MinimalScreenLayout title="Meus pedidos" scroll={false}>
          <View style={styles.vigilanceRoot}>{content}</View>
        </MinimalScreenLayout>
      ) : (
        <LinearGradient colors={['#0f172a', '#020617']} style={styles.container}>
          <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
            {content}
          </SafeAreaView>
        </LinearGradient>
      )}
    </ScreenAccessGate>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  vigilanceRoot: {
    flex: 1,
    minHeight: 0,
    backgroundColor: HISTORY_VIGILANCE_SURFACE,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: 4,
    paddingBottom: 12,
  },
  headerBackButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#64748b',
    backgroundColor: 'rgba(51, 65, 85, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 6,
  },
  headerBackText: {
    color: '#E2E8F0',
    fontSize: 14,
    fontWeight: '800',
  },
  headerBackButtonVigilance: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: HISTORY_SOFT_BORDER,
    backgroundColor: HISTORY_VIGILANCE_SURFACE,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 6,
  },
  headerBackTextVigilance: {
    color: VIGILANCE_SCALES_UI.accent,
    fontSize: 14,
    fontWeight: '800',
  },
  headerTitles: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFF',
  },
  subtitle: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 2,
  },
  titleVigilance: {
    ...MINIMAL_SECTION_TITLE,
    fontSize: 20,
    paddingHorizontal: 0,
    paddingVertical: 0,
    textAlign: 'left',
  },
  subtitleVigilance: {
    color: VIGILANCE_SCALES_UI.accent,
    fontSize: 12,
    marginTop: 2,
    opacity: 0.9,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    gap: 12,
  },
  loadingText: {
    color: '#94A3B8',
    fontSize: 14,
  },
  loadingTextVigilance: {
    color: VIGILANCE_SCALES_UI.accent,
  },
  errorText: {
    color: '#FCA5A5',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  errorTextVigilance: {
    color: '#DC2626',
  },
  retryButton: {
    marginTop: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#64748b',
  },
  retryButtonVigilance: {
    borderRadius: 16,
    borderColor: HISTORY_SOFT_BORDER,
    backgroundColor: HISTORY_VIGILANCE_SURFACE,
  },
  retryButtonText: {
    color: '#E2E8F0',
    fontWeight: '700',
  },
  retryButtonTextVigilance: {
    color: VIGILANCE_SCALES_UI.accent,
  },
  emptyTitle: {
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: '800',
    marginTop: 8,
  },
  emptyTitleVigilance: {
    color: MINIMAL_UI.blueDark,
  },
  emptySubtitle: {
    color: '#94A3B8',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  emptySubtitleVigilance: {
    color: VIGILANCE_SCALES_UI.accent,
  },
  primaryButton: {
    marginTop: 8,
    backgroundColor: '#a855f7',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 14,
  },
  primaryButtonVigilance: {
    backgroundColor: HISTORY_VIGILANCE_SUBMIT_BG,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: HISTORY_VIGILANCE_ICON,
  },
  primaryButtonText: {
    color: '#FFF',
    fontWeight: '800',
    fontSize: 15,
  },
  primaryButtonTextVigilance: {
    color: HISTORY_VIGILANCE_SUBMIT_TEXT,
  },
  listScroll: { flex: 1 },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 12,
  },
  card: {
    backgroundColor: 'rgba(30, 41, 59, 0.75)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#334155',
    padding: 14,
    gap: 6,
  },
  cardVigilance: {
    backgroundColor: HISTORY_VIGILANCE_SURFACE,
    borderRadius: 16,
    borderColor: HISTORY_SOFT_BORDER,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 2,
  },
  cardHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
  },
  cardDeleteButton: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(248, 113, 113, 0.45)',
    backgroundColor: 'rgba(127, 29, 29, 0.2)',
  },
  cardDeleteButtonVigilance: {
    borderRadius: 12,
    borderColor: 'rgba(220, 38, 38, 0.35)',
    backgroundColor: 'rgba(254, 226, 226, 0.65)',
  },
  cardDeleteButtonDisabled: {
    borderColor: '#334155',
    backgroundColor: 'rgba(30, 41, 59, 0.45)',
    opacity: 0.72,
  },
  cardDeleteButtonDisabledVigilance: {
    borderColor: HISTORY_SOFT_BORDER,
    backgroundColor: MINIMAL_UI.rowHover,
  },
  cardDate: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  cardDateVigilance: {
    color: VIGILANCE_SCALES_UI.accent,
    opacity: 0.85,
  },
  statusBadge: {
    backgroundColor: 'rgba(168, 85, 247, 0.2)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.45)',
  },
  statusBadgeVigilance: {
    backgroundColor: 'rgba(58, 150, 221, 0.12)',
    borderRadius: 10,
    borderColor: HISTORY_SOFT_BORDER,
  },
  statusBadgeText: {
    color: '#E9D5FF',
    fontSize: 11,
    fontWeight: '800',
  },
  statusBadgeTextVigilance: {
    color: VIGILANCE_SCALES_UI.accent,
  },
  cardMotivo: {
    color: '#F8FAFC',
    fontSize: 15,
    fontWeight: '800',
    lineHeight: 20,
  },
  cardMotivoVigilance: {
    color: MINIMAL_UI.blueDark,
  },
  cardSituacao: {
    color: '#CBD5E1',
    fontSize: 13,
    lineHeight: 18,
  },
  cardSituacaoVigilance: {
    color: VIGILANCE_SCALES_UI.accent,
  },
  metaBlock: {
    gap: 2,
    marginTop: 2,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  metaLabel: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '700',
  },
  metaLabelVigilance: {
    color: VIGILANCE_SCALES_UI.accent,
    opacity: 0.75,
  },
  metaValue: {
    color: '#E2E8F0',
    fontSize: 12,
    flex: 1,
  },
  metaValueVigilance: {
    color: VIGILANCE_SCALES_UI.accent,
  },
  cardDescription: {
    color: '#94A3B8',
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4,
  },
  cardDescriptionVigilance: {
    color: VIGILANCE_SCALES_UI.accent,
    opacity: 0.9,
  },
  requestCancellationButton: {
    marginTop: 8,
    alignSelf: 'stretch',
    minHeight: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(248, 113, 113, 0.55)',
    backgroundColor: 'rgba(127, 29, 29, 0.35)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  requestCancellationButtonVigilance: {
    borderRadius: 16,
    borderColor: 'rgba(220, 38, 38, 0.35)',
    backgroundColor: 'rgba(254, 226, 226, 0.55)',
  },
  requestCancellationButtonDisabled: {
    opacity: 0.7,
  },
  requestCancellationButtonText: {
    color: '#FECACA',
    fontSize: 14,
    fontWeight: '800',
  },
  requestCancellationButtonTextVigilance: {
    color: '#DC2626',
  },
  cancellationPendingBox: {
    marginTop: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.45)',
    backgroundColor: 'rgba(120, 53, 15, 0.25)',
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 4,
  },
  cancellationPendingBoxVigilance: {
    borderRadius: 12,
    borderColor: 'rgba(217, 119, 6, 0.35)',
    backgroundColor: 'rgba(254, 243, 199, 0.65)',
  },
  cancellationPendingTitle: {
    color: '#FDE68A',
    fontSize: 12,
    fontWeight: '800',
  },
  cancellationPendingTitleVigilance: {
    color: '#B45309',
  },
  cancellationPendingReason: {
    color: '#FEF3C7',
    fontSize: 13,
    lineHeight: 18,
  },
  cancellationPendingReasonVigilance: {
    color: '#92400E',
  },
  cancellationPendingHint: {
    color: '#FCD34D',
    fontSize: 11,
    lineHeight: 15,
  },
  cancellationPendingHintVigilance: {
    color: '#B45309',
  },
  cancellationBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 23, 0.72)',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  cancellationBackdropVigilance: {
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
  },
  cancellationKeyboardWrap: {
    width: '100%',
  },
  cancellationModalCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#475569',
    backgroundColor: '#1E293B',
    padding: 16,
    gap: 10,
  },
  cancellationModalCardVigilance: {
    borderColor: HISTORY_SOFT_BORDER,
    backgroundColor: HISTORY_VIGILANCE_SURFACE,
  },
  cancellationModalTitle: {
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: '800',
  },
  cancellationModalTitleVigilance: {
    color: MINIMAL_UI.blueDark,
  },
  cancellationModalHint: {
    color: '#94A3B8',
    fontSize: 13,
    lineHeight: 18,
  },
  cancellationModalHintVigilance: {
    color: VIGILANCE_SCALES_UI.accent,
  },
  cancellationReasonInput: {
    minHeight: 110,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#475569',
    backgroundColor: '#0F172A',
    color: '#F8FAFC',
    fontSize: 14,
    lineHeight: 20,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  cancellationReasonInputVigilance: {
    borderRadius: 16,
    borderColor: VIGILANCE_SCALES_UI.accent,
    backgroundColor: HISTORY_VIGILANCE_SURFACE,
    color: VIGILANCE_SCALES_UI.accent,
  },
  cancellationModalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  cancellationSecondaryButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#64748B',
    backgroundColor: 'rgba(51, 65, 85, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  cancellationSecondaryButtonVigilance: {
    borderRadius: 16,
    borderColor: HISTORY_SOFT_BORDER,
    backgroundColor: HISTORY_VIGILANCE_SURFACE,
  },
  cancellationSecondaryButtonText: {
    color: '#E2E8F0',
    fontSize: 14,
    fontWeight: '800',
  },
  cancellationSecondaryButtonTextVigilance: {
    color: VIGILANCE_SCALES_UI.accent,
  },
  cancellationPrimaryButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F87171',
    backgroundColor: 'rgba(127, 29, 29, 0.65)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  cancellationPrimaryButtonVigilance: {
    borderRadius: 16,
    borderWidth: 2,
    borderColor: HISTORY_VIGILANCE_ICON,
    backgroundColor: HISTORY_VIGILANCE_SUBMIT_BG,
  },
  cancellationPrimaryButtonDisabled: {
    opacity: 0.75,
  },
  cancellationPrimaryButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '800',
  },
  cancellationPrimaryButtonTextVigilance: {
    color: HISTORY_VIGILANCE_SUBMIT_TEXT,
  },
  footerBar: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    borderTopWidth: 1,
    borderTopColor: '#334155',
    backgroundColor: 'rgba(2, 6, 23, 0.92)',
  },
  footerBarVigilance: {
    borderTopColor: VIGILANCE_SCALES_UI.border,
    backgroundColor: HISTORY_VIGILANCE_SURFACE,
  },
  footerActions: {
    flexDirection: 'row',
    gap: 10,
  },
  footerButton: {
    flex: 1,
    backgroundColor: 'rgba(168, 85, 247, 0.25)',
    borderWidth: 1,
    borderColor: '#a855f7',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  footerButtonVigilance: {
    backgroundColor: HISTORY_VIGILANCE_SUBMIT_BG,
    borderWidth: 2,
    borderColor: HISTORY_VIGILANCE_ICON,
    borderRadius: 16,
  },
  footerButtonText: {
    color: '#F5F3FF',
    fontWeight: '800',
    fontSize: 15,
  },
  footerButtonTextVigilance: {
    color: HISTORY_VIGILANCE_SUBMIT_TEXT,
  },
});
