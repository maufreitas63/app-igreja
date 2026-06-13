import { CardLoadingState } from '@/components/ui/CardLoadingState';
import { DropdownSelect } from '@/components/ui/DropdownSelect';
import { SectionLabel } from '@/components/ui/SectionLabel';
import { useMaintenancePastoralCare } from '@/hooks/useMaintenancePastoralCare';
import {
  computeMaintenanceContentHeight,
  maintenancePanelStyles,
} from '@/lib/maintenanceCardStyles';
import { MAINTENANCE_PASTORAL_CARE_SQL_HINT } from '@/hooks/useMaintenancePastoralCare';
import {
  canApprovePastoralCancellation,
  pastoralDestinationIsIntercession,
  PASTORAL_DESTINATION_INTERCESSION,
} from '@/lib/pastoralAccess';
import { formatShortName } from '@/lib/formatShortName';
import { confirmDialog } from '@/lib/confirmDialog';
import {
  hasPastoralCancellationRequested,
  normalizePastoralFollowUpStage,
  formatPastoralBeneficiarySummary,
  formatPastoralRequestForLabel,
  PASTORAL_FOLLOW_UP_STAGES,
} from '@/lib/pastoralRequest';
import { openRoomContactWhatsapp } from '@/lib/whatsapp';
import { FontAwesome } from '@expo/vector-icons';
import React, { useEffect, useMemo, useState } from 'react';
import Toast from 'react-native-toast-message';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

type Props = {
  isActive?: boolean;
  panelHeight: number;
};

export function MaintenancePastoralCareCard({ isActive = true, panelHeight }: Props) {
  const {
    submitterOptions,
    loadingOptions,
    selectedProfileId,
    allSubmittersFilterValue,
    selectedSubmitter,
    selectedRequest,
    selectedRequestId,
    setSelectedRequestId,
    requests,
    loadingRequests,
    isSavingFollowUpStage = false,
    isApprovingCancellation = false,
    approveCancellation,
    followUpStages = PASTORAL_FOLLOW_UP_STAGES,
    error,
    rpcMissing,
    selectProfileId,
    setFollowUpStage,
    canAdvanceToFollowUpStage,
    isFollowUpStageDone,
    formatRequestDateTimeLabel,
    accessContext,
    canUpdatePastoralRequestForSession: canUpdateRequest,
  } = useMaintenancePastoralCare(isActive);

  const canUpdateSelectedRequest = selectedRequest
    ? canUpdateRequest(selectedRequest, accessContext)
    : false;

  const isFollowUpStarted = Boolean(
    selectedRequest?.followUpStage
    ?? normalizePastoralFollowUpStage(selectedRequest?.status)
  );

  const handlerDisplayName = useMemo(() => {
    if (selectedRequest?.handler_name?.trim()) {
      return formatShortName(selectedRequest.handler_name);
    }

    if (
      isFollowUpStarted
      && accessContext.operatorFullName
      && (
        !selectedRequest?.handler_profile_id
        || selectedRequest.handler_profile_id === accessContext.profileId
      )
    ) {
      return formatShortName(accessContext.operatorFullName);
    }

    return null;
  }, [accessContext.operatorFullName, accessContext.profileId, isFollowUpStarted, selectedRequest]);

  const isIntercessionReadOnly =
    selectedRequest
    && pastoralDestinationIsIntercession(selectedRequest.destination_label)
    && !accessContext.hasFullPastoralAccess
    && Boolean(selectedRequest.handler_profile_id)
    && !canUpdateSelectedRequest;

  const cancellationRequested = selectedRequest
    ? hasPastoralCancellationRequested(selectedRequest)
    : false;

  const canCancelSelectedRequest =
    cancellationRequested
    && canApprovePastoralCancellation(accessContext)
    && !isIntercessionReadOnly;

  const accessHint = accessContext.hasFullPastoralAccess
    ? null
    : accessContext.isIntercessionVolunteer
      ? `Você visualiza apenas pedidos encaminhados ao ${PASTORAL_DESTINATION_INTERCESSION}.`
      : null;

  const [filterProfileId, setFilterProfileId] = useState(allSubmittersFilterValue);
  const [isDetailExpanded, setIsDetailExpanded] = useState(false);

  const POOL_BLUE = '#22D3EE';

  const contentHeight = computeMaintenanceContentHeight(panelHeight);

  const filterDropdownOptions = useMemo(
    () => [
      { value: allSubmittersFilterValue, label: 'Todos os usuários' },
      ...submitterOptions.map((submitter) => ({
        value: submitter.profileId,
        label:
          submitter.requestCount > 1
            ? `${submitter.shortName} (${submitter.requestCount})`
            : submitter.shortName,
      })),
    ],
    [allSubmittersFilterValue, submitterOptions]
  );

  const filteredSubmitters = useMemo(() => {
    if (!filterProfileId) {
      return submitterOptions;
    }

    return submitterOptions.filter((submitter) => submitter.profileId === filterProfileId);
  }, [filterProfileId, submitterOptions]);

  const totalRequestCount = useMemo(
    () => submitterOptions.reduce((sum, submitter) => sum + submitter.requestCount, 0),
    [submitterOptions]
  );

  const handleFilterChange = (value: string) => {
    setFilterProfileId(value);

    if (!value) {
      void selectProfileId(null);
      return;
    }

    void selectProfileId(value);
  };

  useEffect(() => {
    if (!isActive) {
      setFilterProfileId(allSubmittersFilterValue);
    }
  }, [allSubmittersFilterValue, isActive]);

  useEffect(() => {
    setIsDetailExpanded(false);
  }, [selectedRequestId]);

  const handleOpenWhatsApp = () => {
    const phone = selectedRequest?.phone;

    if (!phone) {
      return;
    }

    void openRoomContactWhatsapp(phone);
  };

  return (
    <View style={[styles.panel, { height: contentHeight }]}>
      <Text style={maintenancePanelStyles.panelTitle}>Cuidado Pastoral</Text>
      <View style={maintenancePanelStyles.panelSubtitleSpacer} />

      {rpcMissing ? <Text style={styles.warningText}>{MAINTENANCE_PASTORAL_CARE_SQL_HINT}</Text> : null}
      {accessHint ? <Text style={styles.accessHintText}>{accessHint}</Text> : null}
      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {loadingOptions ? (
        <ActivityIndicator color="#818CF8" style={styles.inlineLoader} />
      ) : submitterOptions.length ? (
        <View style={styles.submitterPickerSection}>
          <SectionLabel variant="maintenance" tight>
            Filtrar solicitante
          </SectionLabel>
          <View style={styles.filterDropdownWrap}>
            <DropdownSelect
              options={filterDropdownOptions}
              selectedValue={filterProfileId}
              onValueChange={handleFilterChange}
              modalTitle="Filtrar solicitante"
              placeholder="Todos os usuários"
              style={styles.filterDropdown}
              disabled={rpcMissing}
            />
          </View>

          <Text style={styles.hintText}>
            Selecione quem enviou o pedido pastoral.
            {totalRequestCount > 0
              ? ` ${totalRequestCount} pedido${totalRequestCount === 1 ? '' : 's'} no total.`
              : ''}
          </Text>

          <ScrollView
            style={styles.submitterList}
            contentContainerStyle={styles.submitterListContent}
            nestedScrollEnabled
            showsVerticalScrollIndicator
          >
            {filteredSubmitters.map((submitter) => {
              const isSelected = selectedProfileId === submitter.profileId;

              return (
                <TouchableOpacity
                  key={submitter.profileId}
                  style={[styles.submitterRow, isSelected && styles.submitterRowSelected]}
                  onPress={() => {
                    setFilterProfileId(submitter.profileId);
                    void selectProfileId(submitter.profileId);
                  }}
                  activeOpacity={0.85}
                >
                  <View style={styles.submitterRowMain}>
                    <Text style={styles.submitterName} numberOfLines={1}>
                      {submitter.shortName}
                    </Text>
                    <Text style={styles.submitterMeta} numberOfLines={1}>
                      {submitter.requestCount} pedido{submitter.requestCount === 1 ? '' : 's'}
                      {submitter.phone ? ` · ${submitter.phone}` : ''}
                    </Text>
                  </View>
                  <View style={styles.submitterCountBadge}>
                    <Text style={styles.submitterCountBadgeText}>{submitter.requestCount}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      ) : (
        <Text style={styles.hintText}>Nenhum pedido pastoral cadastrado ainda.</Text>
      )}

      {loadingRequests ? (
        <CardLoadingState lines={4} />
      ) : selectedRequest ? (
        <ScrollView style={styles.detailScroll} nestedScrollEnabled>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.requestChipRow}
            style={styles.requestChipScroll}
          >
            {requests.map((request) => {
              const isSelected = request.id === selectedRequestId;

              return (
                <TouchableOpacity
                  key={request.id}
                  style={[styles.requestChip, isSelected && styles.requestChipSelected]}
                  onPress={() => setSelectedRequestId(request.id)}
                  activeOpacity={0.85}
                  disabled={requests.length === 1}
                >
                  <Text
                    style={[styles.requestChipText, isSelected && styles.requestChipTextSelected]}
                  >
                    {formatRequestDateTimeLabel(request.created_at)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <View style={styles.detailCard}>
            <View style={styles.detailCardHeader}>
              <TouchableOpacity
                style={styles.detailCardHeaderMain}
                onPress={() => setIsDetailExpanded((current) => !current)}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityState={{ expanded: isDetailExpanded }}
                accessibilityLabel={
                  isDetailExpanded
                    ? 'Recolher detalhes do pedido pastoral'
                    : 'Expandir detalhes do pedido pastoral'
                }
              >
                <View style={styles.contactRow}>
                  <Text style={styles.contactName} numberOfLines={1}>
                    {selectedSubmitter?.shortName ?? selectedRequest.submitterName}
                  </Text>
                  <Text style={styles.contactPhone} numberOfLines={1}>
                    {selectedRequest.phone?.trim() || '—'}
                  </Text>
                </View>
                {!isDetailExpanded ? (
                  <Text style={styles.detailCollapsedHint} numberOfLines={1}>
                    {selectedRequest.request_for && selectedRequest.request_for !== 'self'
                      ? formatPastoralBeneficiarySummary(selectedRequest)
                      : selectedRequest.destination_label?.trim()
                        || selectedRequest.motivo?.trim()
                        || 'Toque para ver os detalhes do pedido'}
                  </Text>
                ) : null}
              </TouchableOpacity>
              {selectedRequest.phone ? (
                <TouchableOpacity
                  style={styles.whatsappButton}
                  onPress={() => void handleOpenWhatsApp()}
                  activeOpacity={0.85}
                  accessibilityLabel="Abrir WhatsApp"
                >
                  <FontAwesome name="whatsapp" size={20} color="#4ADE80" />
                </TouchableOpacity>
              ) : (
                <View style={styles.whatsappPlaceholder} />
              )}
              <TouchableOpacity
                style={styles.detailExpandButton}
                onPress={() => setIsDetailExpanded((current) => !current)}
                activeOpacity={0.85}
                accessibilityLabel={
                  isDetailExpanded ? 'Recolher detalhes' : 'Expandir detalhes'
                }
              >
                <FontAwesome
                  name={isDetailExpanded ? 'chevron-up' : 'chevron-down'}
                  size={14}
                  color="#94A3B8"
                />
              </TouchableOpacity>
            </View>

            {isDetailExpanded ? (
              <View style={styles.detailCardBody}>
                <Text style={styles.detailLabel}>Destino</Text>
                <Text style={styles.detailValue}>
                  {selectedRequest.destination_label?.trim() || '—'}
                </Text>

                <Text style={styles.detailLabel}>Motivo</Text>
                <Text style={styles.detailValueMultiline}>
                  {selectedRequest.motivo?.trim() || '—'}
                </Text>

                <Text style={styles.detailLabel}>Situação</Text>
                <Text style={styles.detailValueMultiline}>
                  {selectedRequest.situacao?.trim() || '—'}
                </Text>

                <Text style={styles.detailLabel}>Descrição</Text>
                <Text style={styles.detailValueMultiline}>
                  {selectedRequest.description?.trim() || '—'}
                </Text>

                <Text style={styles.detailLabel}>Pedido para</Text>
                <Text style={styles.detailValue}>
                  {formatPastoralRequestForLabel(selectedRequest.request_for)}
                </Text>

                {selectedRequest.request_for && selectedRequest.request_for !== 'self' ? (
                  <>
                    <Text style={styles.detailLabel}>Nome do necessitado</Text>
                    <Text style={styles.detailValue}>
                      {selectedRequest.beneficiary_name?.trim() || '—'}
                    </Text>

                    {selectedRequest.request_for === 'family' ? (
                      <>
                        <Text style={styles.detailLabel}>Grau de parentesco</Text>
                        <Text style={styles.detailValue}>
                          {selectedRequest.beneficiary_relationship?.trim() || '—'}
                        </Text>
                      </>
                    ) : (
                      <>
                        <Text style={styles.detailLabel}>Especifique (terceiros)</Text>
                        <Text style={styles.detailValueMultiline}>
                          {selectedRequest.beneficiary_details?.trim() || '—'}
                        </Text>
                      </>
                    )}
                  </>
                ) : null}
              </View>
            ) : null}

            <View style={styles.stageHeaderRow}>
              <View style={styles.stageSectionLabelWrap}>
                <Text style={styles.stageSectionLabel}>Acompanhamento</Text>
              </View>
              {isFollowUpStarted && handlerDisplayName ? (
                <Text style={styles.stageHandlerName} numberOfLines={1}>
                  {handlerDisplayName}
                </Text>
              ) : null}
            </View>
            {isIntercessionReadOnly ? (
              <Text style={styles.stageReadOnlyHint}>
                Pedido em acompanhamento por {handlerDisplayName ?? 'outra pessoa'} (somente leitura).
              </Text>
            ) : null}
            <View style={styles.stageRow}>
              {followUpStages.map((stage) => {
                const currentStage = selectedRequest.followUpStage;
                const isDone = isFollowUpStageDone(currentStage, stage);
                const canAdvance =
                  canUpdateSelectedRequest && canAdvanceToFollowUpStage(currentStage, stage);
                const isLocked = !isDone && !canAdvance;

                return (
                  <TouchableOpacity
                    key={stage}
                    style={[
                      styles.stageButton,
                      stage === 'Acolher' && styles.stageButtonLead,
                      isDone && styles.stageButtonDone,
                      isLocked && styles.stageButtonLocked,
                    ]}
                    onPress={() => {
                      if (
                        !selectedRequestId
                        || isSavingFollowUpStage
                        || !canAdvance
                      ) {
                        return;
                      }

                      void (async () => {
                        const result = await setFollowUpStage(selectedRequestId, stage);

                        if (!result.success && result.message) {
                          Toast.show({
                            type: 'error',
                            text1: 'Cuidado pastoral',
                            text2: result.message,
                            visibilityTime: 4500,
                          });
                        }
                      })();
                    }}
                    disabled={
                      isSavingFollowUpStage
                      || rpcMissing
                      || !selectedRequestId
                      || !canAdvance
                    }
                    activeOpacity={canAdvance ? 0.85 : 1}
                    accessibilityLabel={`${stage}${isDone ? ', concluído' : isLocked ? ', bloqueado' : ', disponível'}`}
                  >
                    <Text
                      style={[
                        styles.stageButtonText,
                        isDone && { color: POOL_BLUE },
                        isLocked && styles.stageButtonTextLocked,
                      ]}
                    >
                      {stage}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            {isSavingFollowUpStage ? (
              <ActivityIndicator color="#F9A8D4" size="small" style={styles.stageLoader} />
            ) : null}
            {cancellationRequested ? (
              <View style={styles.cancellationRequestBox}>
                <Text style={styles.cancellationRequestTitle}>Solicitação de cancelamento</Text>
                <Text style={styles.cancellationRequestMessage}>
                  O solicitante pediu o cancelamento de &quot;
                  {selectedRequest?.motivo?.trim() || 'este pedido'}&quot;.
                </Text>
                {selectedRequest?.cancellation_request_reason?.trim() ? (
                  <>
                    <Text style={styles.cancellationRequestReasonLabel}>Justificativa</Text>
                    <Text style={styles.cancellationRequestReasonText}>
                      {selectedRequest.cancellation_request_reason.trim()}
                    </Text>
                  </>
                ) : null}
              </View>
            ) : null}
            {canCancelSelectedRequest ? (
              <TouchableOpacity
                style={styles.cancellationButton}
                onPress={() => {
                  if (!selectedRequestId || isApprovingCancellation || rpcMissing) {
                    return;
                  }

                  void (async () => {
                    const motivoLabel = selectedRequest?.motivo?.trim() || 'este pedido';
                    const reasonText = selectedRequest?.cancellation_request_reason?.trim();
                    const dialogMessage = reasonText
                      ? `O solicitante pediu o cancelamento de "${motivoLabel}".\n\nJustificativa:\n${reasonText}\n\nDeseja excluir este pedido?`
                      : `O solicitante pediu o cancelamento de "${motivoLabel}".\n\nDeseja excluir este pedido?`;
                    const confirmed = await confirmDialog(
                      'Cancelar pedido',
                      dialogMessage,
                      'Cancelar pedido',
                      'Voltar',
                      { destructive: true }
                    );

                    if (!confirmed) {
                      return;
                    }

                    const result = await approveCancellation(selectedRequestId);

                    if (!result.success && result.message) {
                      Toast.show({
                        type: 'error',
                        text1: 'Cuidado pastoral',
                        text2: result.message,
                        visibilityTime: 4500,
                      });
                    }
                  })();
                }}
                disabled={isApprovingCancellation || rpcMissing || !selectedRequestId}
                activeOpacity={0.85}
                accessibilityLabel="Cancelar pedido em acompanhamento"
              >
                {isApprovingCancellation ? (
                  <ActivityIndicator color="#FECACA" size="small" />
                ) : (
                  <Text style={styles.cancellationButtonText}>Cancelar pedido</Text>
                )}
              </TouchableOpacity>
            ) : null}
          </View>
        </ScrollView>
      ) : selectedSubmitter ? (
        <Text style={styles.hintText}>Nenhum pedido encontrado para este perfil.</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    padding: 12,
    minHeight: 0,
  },
  panelTitle: {
    color: '#E2E8F0',
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 2,
  },
  panelSubtitle: {
    color: '#64748B',
    fontSize: 11,
    marginBottom: 8,
  },
  warningText: {
    color: '#FBBF24',
    fontSize: 11,
    lineHeight: 16,
    marginBottom: 6,
  },
  accessHintText: {
    color: '#93C5FD',
    fontSize: 11,
    lineHeight: 16,
    marginBottom: 6,
  },
  errorText: {
    color: '#FCA5A5',
    fontSize: 12,
    marginBottom: 6,
  },
  submitterPickerSection: {
    flexGrow: 0,
    flexShrink: 0,
    gap: 4,
    marginBottom: 6,
  },
  filterDropdownWrap: {
    flexGrow: 0,
    flexShrink: 0,
    alignSelf: 'stretch',
  },
  filterDropdown: {
    flex: 0,
    flexGrow: 0,
    alignSelf: 'stretch',
    height: 52,
    borderColor: '#334155',
    backgroundColor: '#0f172a',
    paddingHorizontal: 10,
  },
  inlineLoader: {
    marginVertical: 8,
  },
  hintText: {
    color: '#94A3B8',
    fontSize: 11,
    lineHeight: 14,
    marginBottom: 2,
  },
  submitterList: {
    flexGrow: 0,
    flexShrink: 0,
    maxHeight: 110,
  },
  submitterListContent: {
    gap: 6,
  },
  submitterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 52,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: 'rgba(15, 23, 42, 0.9)',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  submitterRowSelected: {
    borderColor: '#F472B6',
    backgroundColor: 'rgba(244, 114, 182, 0.14)',
  },
  submitterRowMain: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  submitterName: {
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '800',
  },
  submitterMeta: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '600',
  },
  submitterCountBadge: {
    minWidth: 28,
    height: 28,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#475569',
    backgroundColor: 'rgba(30, 41, 59, 0.95)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  submitterCountBadgeText: {
    color: '#E2E8F0',
    fontSize: 12,
    fontWeight: '800',
  },
  detailLoader: {
    marginTop: 12,
  },
  detailScroll: {
    flex: 1,
    minHeight: 0,
  },
  requestChipScroll: {
    flexGrow: 0,
    maxHeight: 36,
    marginBottom: 8,
  },
  requestChipRow: {
    gap: 8,
    paddingHorizontal: 2,
  },
  requestChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#475569',
    backgroundColor: 'rgba(30, 41, 59, 0.8)',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  requestChipSelected: {
    borderColor: '#F472B6',
    backgroundColor: 'rgba(244, 114, 182, 0.2)',
  },
  requestChipText: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '600',
  },
  requestChipTextSelected: {
    color: '#FBCFE8',
    fontWeight: '800',
  },
  detailCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    padding: 12,
    gap: 4,
  },
  detailCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  detailCardHeaderMain: {
    flex: 1,
    minWidth: 0,
  },
  detailCollapsedHint: {
    color: '#64748B',
    fontSize: 11,
    lineHeight: 14,
    marginTop: 2,
  },
  detailExpandButton: {
    width: 28,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginTop: 2,
  },
  detailCardBody: {
    gap: 4,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: 'rgba(51, 65, 85, 0.65)',
  },
  detailLabel: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginTop: 6,
  },
  detailValue: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '700',
  },
  detailValueMultiline: {
    color: '#F8FAFC',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  contactName: {
    flex: 1,
    minWidth: 0,
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '800',
  },
  contactPhone: {
    flexShrink: 0,
    maxWidth: '42%',
    color: '#CBD5E1',
    fontSize: 13,
    fontWeight: '600',
  },
  whatsappButton: {
    width: 36,
    height: 36,
    flexShrink: 0,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(74, 222, 128, 0.45)',
    backgroundColor: 'rgba(22, 101, 52, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  whatsappPlaceholder: {
    width: 36,
    height: 36,
    flexShrink: 0,
  },
  stageHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
    width: '100%',
  },
  stageSectionLabelWrap: {
    maxWidth: 112,
    flexShrink: 0,
  },
  stageSectionLabel: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  stageHandlerName: {
    flex: 1,
    minWidth: 0,
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'right',
  },
  stageReadOnlyHint: {
    color: '#93C5FD',
    fontSize: 11,
    lineHeight: 14,
    marginTop: 2,
    marginBottom: 2,
  },
  stageRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  stageButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#475569',
    backgroundColor: 'rgba(30, 41, 59, 0.8)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    minWidth: 84,
    alignItems: 'center',
  },
  stageButtonLead: {
    minWidth: 78,
  },
  stageButtonDone: {
    borderColor: 'rgba(34, 211, 238, 0.65)',
    backgroundColor: 'rgba(34, 211, 238, 0.2)',
  },
  stageButtonLocked: {
    opacity: 0.4,
    borderColor: '#334155',
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
  },
  stageButtonText: {
    color: '#CBD5E1',
    fontSize: 13,
    fontWeight: '800',
  },
  stageButtonTextLocked: {
    color: '#64748B',
  },
  stageLoader: {
    alignSelf: 'flex-start',
    marginTop: 6,
  },
  cancellationRequestBox: {
    marginTop: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.45)',
    backgroundColor: 'rgba(120, 53, 15, 0.25)',
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 4,
  },
  cancellationRequestTitle: {
    color: '#FDE68A',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  cancellationRequestMessage: {
    color: '#FEF3C7',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
  cancellationRequestReasonLabel: {
    color: '#FCD34D',
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginTop: 2,
  },
  cancellationRequestReasonText: {
    color: '#FFFBEB',
    fontSize: 13,
    lineHeight: 18,
  },
  cancellationButton: {
    alignSelf: 'stretch',
    width: '100%',
    marginTop: 10,
    minHeight: 40,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#F87171',
    backgroundColor: 'rgba(127, 29, 29, 0.55)',
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancellationButtonText: {
    color: '#FECACA',
    fontSize: 14,
    fontWeight: '800',
  },
});
