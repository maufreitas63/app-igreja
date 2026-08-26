import { CardLoadingState } from '@/components/ui/CardLoadingState';
import { DropdownSelect } from '@/components/ui/DropdownSelect';
import { SegmentChipRow } from '@/components/ui/SegmentChipRow';
import { MaintenancePastoralAgendaPanel } from '@/components/MaintenancePastoralAgendaPanel';
import { useMaintenancePastoralCare } from '@/hooks/useMaintenancePastoralCare';
import {
  computeMaintenanceContentHeight,
  MAINTENANCE_SCROLL_PROPS,
  maintenancePanelStyles,
} from '@/lib/maintenanceCardStyles';
import { MAINTENANCE_PASTORAL_CARE_SQL_HINT } from '@/hooks/useMaintenancePastoralCare';
import {
  canApprovePastoralCancellation,
  pastoralDestinationIsIntercession,
  PASTORAL_DESTINATION_INTERCESSION,
  PASTORAL_AGENDA_RESOURCE,
} from '@/lib/pastoralAccess';
import { sessionHasAccess } from '@/lib/accessControl';
import { formatShortName } from '@/lib/formatShortName';
import { confirmDialog } from '@/lib/confirmDialog';
import {
  hasPastoralCancellationRequested,
  normalizePastoralFollowUpStage,
  formatPastoralBeneficiarySummary,
  formatPastoralRequestForLabel,
  PASTORAL_FOLLOW_UP_STAGES,
} from '@/lib/pastoralRequest';
import { CONTAIN_WIDTH } from '@/lib/minimalPresentation';
import { MINIMAL_SECTION_TITLE, MINIMAL_UI } from '@/lib/minimalUiTheme';
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

const PANEL_TITLE = 'Cuidado Pastoral';
const POOL_BLUE = '#22D3EE';

type Props = {
  isActive?: boolean;
  panelHeight: number;
  minimal?: boolean;
};

function FieldLabel({ children, minimal }: { children: string; minimal: boolean }) {
  return (
    <Text style={minimal ? styles.fieldLabelMinimal : styles.fieldLabel}>{children}</Text>
  );
}

export function MaintenancePastoralCareCard({
  isActive = true,
  panelHeight,
  minimal = false,
}: Props) {
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
  const [panelTab, setPanelTab] = useState<'pedidos' | 'agenda'>('pedidos');
  const [canManageAgenda, setCanManageAgenda] = useState(false);

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
      return;
    }

    let mounted = true;

    void sessionHasAccess('screen', PASTORAL_AGENDA_RESOURCE, 'view').then((allowed) => {
      if (mounted) {
        setCanManageAgenda(allowed);

        if (!allowed) {
          setPanelTab('pedidos');
        }
      }
    });

    return () => {
      mounted = false;
    };
  }, [isActive]);

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

  const accentColor = minimal ? MINIMAL_UI.accent : '#818CF8';
  const stageDoneColor = minimal ? MINIMAL_UI.blueDark : POOL_BLUE;
  const chevronColor = minimal ? MINIMAL_UI.icon : '#94A3B8';
  const whatsappColor = minimal ? '#16A34A' : '#4ADE80';

  return (
    <View style={[styles.panel, minimal && styles.panelMinimal, { height: contentHeight }]}>
      <Text style={minimal ? styles.sectionTitle : maintenancePanelStyles.panelTitle}>
        {PANEL_TITLE}
      </Text>
      {!minimal ? <View style={maintenancePanelStyles.panelSubtitleSpacer} /> : null}

      {canManageAgenda ? (
        <SegmentChipRow
          variant={minimal ? 'vigilance' : 'default'}
          compact
          options={[
            { value: 'pedidos', label: 'Pedidos' },
            { value: 'agenda', label: 'Minha Agenda' },
          ]}
          selectedValue={panelTab}
          onSelect={(value) => setPanelTab(value as 'pedidos' | 'agenda')}
        />
      ) : null}

      {panelTab === 'agenda' && canManageAgenda ? (
        <ScrollView
          style={styles.agendaScroll}
          contentContainerStyle={styles.agendaScrollContent}
          nestedScrollEnabled
          {...MAINTENANCE_SCROLL_PROPS}
        >
          <MaintenancePastoralAgendaPanel isActive={isActive} minimal={minimal} />
        </ScrollView>
      ) : (
      <>

      {rpcMissing ? (
        <Text style={[styles.warningText, minimal && styles.warningTextMinimal]}>
          {MAINTENANCE_PASTORAL_CARE_SQL_HINT}
        </Text>
      ) : null}
      {accessHint ? (
        <Text style={[styles.accessHintText, minimal && styles.accessHintTextMinimal]}>
          {accessHint}
        </Text>
      ) : null}
      {error ? (
        <Text style={[styles.errorText, minimal && styles.errorTextMinimal]}>{error}</Text>
      ) : null}

      {loadingOptions ? (
        <ActivityIndicator color={accentColor} style={styles.inlineLoader} />
      ) : submitterOptions.length ? (
        <View style={[styles.submitterPickerSection, minimal && styles.submitterPickerSectionMinimal]}>
          <FieldLabel minimal={minimal}>Filtrar solicitante</FieldLabel>
          <View style={[styles.filterDropdownWrap, minimal && styles.filterDropdownWrapMinimal]}>
            <DropdownSelect
              options={filterDropdownOptions}
              selectedValue={filterProfileId}
              onValueChange={handleFilterChange}
              modalTitle="Filtrar solicitante"
              placeholder="Todos os usuários"
              variant={minimal ? 'minimal' : 'default'}
              style={[styles.filterDropdown, minimal && styles.filterDropdownMinimal]}
              disabled={rpcMissing}
            />
          </View>

          <Text style={[styles.hintText, minimal && styles.hintTextMinimal]}>
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
                  style={[
                    styles.submitterRow,
                    minimal && styles.submitterRowMinimal,
                    isSelected && styles.submitterRowSelected,
                    minimal && isSelected && styles.submitterRowSelectedMinimal,
                  ]}
                  onPress={() => {
                    setFilterProfileId(submitter.profileId);
                    void selectProfileId(submitter.profileId);
                  }}
                  activeOpacity={0.85}
                >
                  <View style={styles.submitterRowMain}>
                    <Text
                      style={[styles.submitterName, minimal && styles.submitterNameMinimal]}
                      numberOfLines={1}
                    >
                      {submitter.shortName}
                    </Text>
                    <Text
                      style={[styles.submitterMeta, minimal && styles.submitterMetaMinimal]}
                      numberOfLines={1}
                    >
                      {submitter.requestCount} pedido{submitter.requestCount === 1 ? '' : 's'}
                      {submitter.phone ? ` · ${submitter.phone}` : ''}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.submitterCountBadge,
                      minimal && styles.submitterCountBadgeMinimal,
                      isSelected && minimal && styles.submitterCountBadgeSelectedMinimal,
                    ]}
                  >
                    <Text
                      style={[
                        styles.submitterCountBadgeText,
                        minimal && styles.submitterCountBadgeTextMinimal,
                        isSelected && minimal && styles.submitterCountBadgeTextSelectedMinimal,
                      ]}
                    >
                      {submitter.requestCount}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      ) : (
        <Text style={[styles.hintText, minimal && styles.hintTextMinimal]}>
          Nenhum pedido pastoral cadastrado ainda.
        </Text>
      )}

      {loadingRequests ? (
        <CardLoadingState lines={4} minimal={minimal} />
      ) : selectedRequest ? (
        <ScrollView
          style={[styles.detailScroll, minimal && styles.detailScrollMinimal]}
          nestedScrollEnabled
        >
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
                  style={[
                    styles.requestChip,
                    minimal && styles.requestChipMinimal,
                    isSelected && styles.requestChipSelected,
                    minimal && isSelected && styles.requestChipSelectedMinimal,
                  ]}
                  onPress={() => setSelectedRequestId(request.id)}
                  activeOpacity={0.85}
                  disabled={requests.length === 1}
                >
                  <Text
                    style={[
                      styles.requestChipText,
                      minimal && styles.requestChipTextMinimal,
                      isSelected && styles.requestChipTextSelected,
                      minimal && isSelected && styles.requestChipTextSelectedMinimal,
                    ]}
                  >
                    {formatRequestDateTimeLabel(request.created_at)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <View style={[styles.detailCard, minimal && styles.detailCardMinimal]}>
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
                  <Text
                    style={[styles.contactName, minimal && styles.contactNameMinimal]}
                    numberOfLines={1}
                  >
                    {selectedSubmitter?.shortName ?? selectedRequest.submitterName}
                  </Text>
                  <Text
                    style={[styles.contactPhone, minimal && styles.contactPhoneMinimal]}
                    numberOfLines={1}
                  >
                    {selectedRequest.phone?.trim() || '—'}
                  </Text>
                </View>
                {!isDetailExpanded ? (
                  <Text
                    style={[styles.detailCollapsedHint, minimal && styles.detailCollapsedHintMinimal]}
                    numberOfLines={1}
                  >
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
                  style={[styles.whatsappButton, minimal && styles.whatsappButtonMinimal]}
                  onPress={() => void handleOpenWhatsApp()}
                  activeOpacity={0.85}
                  accessibilityLabel="Abrir WhatsApp"
                >
                  <FontAwesome name="whatsapp" size={20} color={whatsappColor} />
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
                  color={chevronColor}
                />
              </TouchableOpacity>
            </View>

            {isDetailExpanded ? (
              <View style={[styles.detailCardBody, minimal && styles.detailCardBodyMinimal]}>
                {(
                  [
                    ['Destino', selectedRequest.destination_label?.trim() || '—', false],
                    ['Motivo', selectedRequest.motivo?.trim() || '—', true],
                    ['Situação', selectedRequest.situacao?.trim() || '—', true],
                    ['Descrição', selectedRequest.description?.trim() || '—', true],
                    [
                      'Pedido para',
                      formatPastoralRequestForLabel(selectedRequest.request_for),
                      false,
                    ],
                  ] as const
                ).map(([label, value, multiline]) => (
                  <View key={label}>
                    <Text style={[styles.detailLabel, minimal && styles.detailLabelMinimal]}>
                      {label}
                    </Text>
                    <Text
                      style={[
                        multiline ? styles.detailValueMultiline : styles.detailValue,
                        minimal &&
                          (multiline
                            ? styles.detailValueMultilineMinimal
                            : styles.detailValueMinimal),
                      ]}
                    >
                      {value}
                    </Text>
                  </View>
                ))}

                {selectedRequest.request_for && selectedRequest.request_for !== 'self' ? (
                  <>
                    <Text style={[styles.detailLabel, minimal && styles.detailLabelMinimal]}>
                      Nome do necessitado
                    </Text>
                    <Text style={[styles.detailValue, minimal && styles.detailValueMinimal]}>
                      {selectedRequest.beneficiary_name?.trim() || '—'}
                    </Text>

                    {selectedRequest.request_for === 'family' ? (
                      <>
                        <Text style={[styles.detailLabel, minimal && styles.detailLabelMinimal]}>
                          Grau de parentesco
                        </Text>
                        <Text style={[styles.detailValue, minimal && styles.detailValueMinimal]}>
                          {selectedRequest.beneficiary_relationship?.trim() || '—'}
                        </Text>
                      </>
                    ) : (
                      <>
                        <Text style={[styles.detailLabel, minimal && styles.detailLabelMinimal]}>
                          Especifique (terceiros)
                        </Text>
                        <Text
                          style={[
                            styles.detailValueMultiline,
                            minimal && styles.detailValueMultilineMinimal,
                          ]}
                        >
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
                <Text style={[styles.stageSectionLabel, minimal && styles.stageSectionLabelMinimal]}>
                  Acompanhamento
                </Text>
              </View>
              {isFollowUpStarted && handlerDisplayName ? (
                <Text
                  style={[styles.stageHandlerName, minimal && styles.stageHandlerNameMinimal]}
                  numberOfLines={1}
                >
                  {handlerDisplayName}
                </Text>
              ) : null}
            </View>
            {isIntercessionReadOnly ? (
              <Text style={[styles.stageReadOnlyHint, minimal && styles.stageReadOnlyHintMinimal]}>
                Pedido em acompanhamento por {handlerDisplayName ?? 'outra pessoa'} (somente
                leitura).
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
                      minimal && styles.stageButtonMinimal,
                      stage === 'Acolher' && styles.stageButtonLead,
                      isDone && styles.stageButtonDone,
                      minimal && isDone && styles.stageButtonDoneMinimal,
                      isLocked && styles.stageButtonLocked,
                      minimal && isLocked && styles.stageButtonLockedMinimal,
                    ]}
                    onPress={() => {
                      if (!selectedRequestId || isSavingFollowUpStage || !canAdvance) {
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
                        minimal && styles.stageButtonTextMinimal,
                        isDone && { color: stageDoneColor },
                        isLocked && styles.stageButtonTextLocked,
                        minimal && isLocked && styles.stageButtonTextLockedMinimal,
                      ]}
                    >
                      {stage}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            {isSavingFollowUpStage ? (
              <ActivityIndicator
                color={minimal ? MINIMAL_UI.accent : '#F9A8D4'}
                size="small"
                style={styles.stageLoader}
              />
            ) : null}
            {cancellationRequested ? (
              <View
                style={[
                  styles.cancellationRequestBox,
                  minimal && styles.cancellationRequestBoxMinimal,
                ]}
              >
                <Text
                  style={[
                    styles.cancellationRequestTitle,
                    minimal && styles.cancellationRequestTitleMinimal,
                  ]}
                >
                  Solicitação de cancelamento
                </Text>
                <Text
                  style={[
                    styles.cancellationRequestMessage,
                    minimal && styles.cancellationRequestMessageMinimal,
                  ]}
                >
                  O solicitante pediu o cancelamento de &quot;
                  {selectedRequest?.motivo?.trim() || 'este pedido'}&quot;.
                </Text>
                {selectedRequest?.cancellation_request_reason?.trim() ? (
                  <>
                    <Text
                      style={[
                        styles.cancellationRequestReasonLabel,
                        minimal && styles.cancellationRequestReasonLabelMinimal,
                      ]}
                    >
                      Justificativa
                    </Text>
                    <Text
                      style={[
                        styles.cancellationRequestReasonText,
                        minimal && styles.cancellationRequestReasonTextMinimal,
                      ]}
                    >
                      {selectedRequest.cancellation_request_reason.trim()}
                    </Text>
                  </>
                ) : null}
              </View>
            ) : null}
            {canCancelSelectedRequest ? (
              <TouchableOpacity
                style={[styles.cancellationButton, minimal && styles.cancellationButtonMinimal]}
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
                  <ActivityIndicator
                    color={minimal ? MINIMAL_UI.onDark : '#FECACA'}
                    size="small"
                  />
                ) : (
                  <Text
                    style={[
                      styles.cancellationButtonText,
                      minimal && styles.cancellationButtonTextMinimal,
                    ]}
                  >
                    Cancelar pedido
                  </Text>
                )}
              </TouchableOpacity>
            ) : null}
          </View>
        </ScrollView>
      ) : selectedSubmitter ? (
        <Text style={[styles.hintText, minimal && styles.hintTextMinimal]}>
          Nenhum pedido encontrado para este perfil.
        </Text>
      ) : null}
      </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    ...CONTAIN_WIDTH,
    flex: 1,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    padding: 12,
    minHeight: 0,
  },
  panelMinimal: {
    ...CONTAIN_WIDTH,
    paddingHorizontal: 0,
    paddingVertical: 4,
    borderRadius: 0,
    backgroundColor: MINIMAL_UI.background,
    overflow: 'hidden',
  },
  sectionTitle: {
    ...MINIMAL_SECTION_TITLE,
    ...CONTAIN_WIDTH,
  },
  agendaScroll: {
    flex: 1,
    minHeight: 0,
  },
  agendaScrollContent: {
    paddingBottom: 12,
  },
  fieldLabel: {
    color: '#3A96DD',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  fieldLabelMinimal: {
    color: MINIMAL_UI.textMuted,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 6,
  },
  warningText: {
    color: '#FBBF24',
    fontSize: 11,
    lineHeight: 16,
    marginBottom: 6,
  },
  warningTextMinimal: {
    color: '#B45309',
  },
  accessHintText: {
    color: '#93C5FD',
    fontSize: 11,
    lineHeight: 16,
    marginBottom: 6,
  },
  accessHintTextMinimal: {
    color: MINIMAL_UI.textMuted,
  },
  errorText: {
    color: '#FCA5A5',
    fontSize: 12,
    marginBottom: 6,
  },
  errorTextMinimal: {
    color: '#DC2626',
  },
  submitterPickerSection: {
    flexGrow: 0,
    flexShrink: 0,
    gap: 4,
    marginBottom: 6,
    maxWidth: '100%',
    minWidth: 0,
  },
  submitterPickerSectionMinimal: {
    ...CONTAIN_WIDTH,
  },
  filterDropdownWrap: {
    flexGrow: 0,
    flexShrink: 0,
    alignSelf: 'stretch',
    maxWidth: '100%',
    minWidth: 0,
  },
  filterDropdownWrapMinimal: {
    ...CONTAIN_WIDTH,
  },
  filterDropdown: {
    ...CONTAIN_WIDTH,
    flexGrow: 0,
    flexShrink: 1,
  },
  filterDropdownMinimal: {
    ...CONTAIN_WIDTH,
  },
  inlineLoader: {
    marginVertical: 8,
  },
  hintText: {
    color: 'rgba(58, 150, 221, 0.82)',
    fontSize: 11,
    lineHeight: 14,
    marginBottom: 2,
  },
  hintTextMinimal: {
    color: MINIMAL_UI.textMuted,
  },
  submitterList: {
    flexGrow: 0,
    flexShrink: 0,
    maxHeight: 110,
    maxWidth: '100%',
    minWidth: 0,
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
    borderColor: 'rgba(52, 211, 153, 0.35)',
    backgroundColor: 'rgba(15, 23, 42, 0.9)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    maxWidth: '100%',
    minWidth: 0,
  },
  submitterRowMinimal: {
    borderColor: MINIMAL_UI.border,
    backgroundColor: MINIMAL_UI.background,
    borderRadius: 12,
  },
  submitterRowSelected: {
    borderColor: '#F472B6',
    backgroundColor: 'rgba(244, 114, 182, 0.14)',
  },
  submitterRowSelectedMinimal: {
    borderColor: MINIMAL_UI.blueDark,
    backgroundColor: '#EFF6FF',
  },
  submitterRowMain: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  submitterName: {
    color: '#3A96DD',
    fontSize: 13,
    fontWeight: '800',
  },
  submitterNameMinimal: {
    color: MINIMAL_UI.blueDark,
    fontWeight: '700',
  },
  submitterMeta: {
    color: 'rgba(58, 150, 221, 0.82)',
    fontSize: 11,
    fontWeight: '600',
  },
  submitterMetaMinimal: {
    color: MINIMAL_UI.textMuted,
  },
  submitterCountBadge: {
    minWidth: 28,
    height: 28,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.35)',
    backgroundColor: 'rgba(30, 41, 59, 0.95)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    flexShrink: 0,
  },
  submitterCountBadgeMinimal: {
    borderColor: MINIMAL_UI.border,
    backgroundColor: MINIMAL_UI.rowHover,
    borderRadius: 10,
  },
  submitterCountBadgeSelectedMinimal: {
    borderColor: MINIMAL_UI.blueDark,
    backgroundColor: MINIMAL_UI.blueDark,
  },
  submitterCountBadgeText: {
    color: '#3A96DD',
    fontSize: 12,
    fontWeight: '800',
  },
  submitterCountBadgeTextMinimal: {
    color: MINIMAL_UI.text,
    fontWeight: '700',
  },
  submitterCountBadgeTextSelectedMinimal: {
    color: MINIMAL_UI.onDark,
  },
  detailScroll: {
    flex: 1,
    minHeight: 0,
    maxWidth: '100%',
    minWidth: 0,
  },
  detailScrollMinimal: {
    ...CONTAIN_WIDTH,
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
    borderColor: 'rgba(52, 211, 153, 0.35)',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  requestChipMinimal: {
    borderRadius: 10,
    borderColor: MINIMAL_UI.border,
    backgroundColor: MINIMAL_UI.background,
  },
  requestChipSelected: {
    borderColor: '#F472B6',
    backgroundColor: 'rgba(244, 114, 182, 0.2)',
  },
  requestChipSelectedMinimal: {
    borderColor: MINIMAL_UI.blueDark,
    backgroundColor: MINIMAL_UI.blueDark,
  },
  requestChipText: {
    color: 'rgba(58, 150, 221, 0.82)',
    fontSize: 11,
    fontWeight: '600',
  },
  requestChipTextMinimal: {
    color: MINIMAL_UI.text,
  },
  requestChipTextSelected: {
    color: '#FBCFE8',
    fontWeight: '800',
  },
  requestChipTextSelectedMinimal: {
    color: MINIMAL_UI.onDark,
    fontWeight: '700',
  },
  detailCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.35)',
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    padding: 12,
    gap: 4,
    maxWidth: '100%',
    minWidth: 0,
  },
  detailCardMinimal: {
    borderColor: MINIMAL_UI.border,
    backgroundColor: MINIMAL_UI.background,
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
    color: 'rgba(58, 150, 221, 0.82)',
    fontSize: 11,
    lineHeight: 14,
    marginTop: 2,
  },
  detailCollapsedHintMinimal: {
    color: MINIMAL_UI.textMuted,
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
  detailCardBodyMinimal: {
    borderTopColor: MINIMAL_UI.divider,
  },
  detailLabel: {
    color: 'rgba(58, 150, 221, 0.82)',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginTop: 6,
  },
  detailLabelMinimal: {
    color: MINIMAL_UI.textMuted,
    textTransform: 'none',
    letterSpacing: 0,
    fontSize: 12,
  },
  detailValue: {
    color: '#3A96DD',
    fontSize: 14,
    fontWeight: '700',
  },
  detailValueMinimal: {
    color: MINIMAL_UI.text,
    fontWeight: '600',
  },
  detailValueMultiline: {
    color: '#3A96DD',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
  detailValueMultilineMinimal: {
    color: MINIMAL_UI.text,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  contactName: {
    flex: 1,
    minWidth: 0,
    color: '#3A96DD',
    fontSize: 14,
    fontWeight: '800',
  },
  contactNameMinimal: {
    color: MINIMAL_UI.blueDark,
    fontWeight: '700',
  },
  contactPhone: {
    flexShrink: 0,
    maxWidth: '42%',
    color: '#3A96DD',
    fontSize: 13,
    fontWeight: '600',
  },
  contactPhoneMinimal: {
    color: MINIMAL_UI.text,
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
  whatsappButtonMinimal: {
    borderRadius: 12,
    borderColor: '#BBF7D0',
    backgroundColor: '#F0FDF4',
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
    maxWidth: 140,
    flexShrink: 0,
  },
  stageSectionLabel: {
    color: 'rgba(58, 150, 221, 0.82)',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  stageSectionLabelMinimal: {
    color: MINIMAL_UI.textMuted,
    textTransform: 'none',
    letterSpacing: 0,
    fontSize: 12,
  },
  stageHandlerName: {
    flex: 1,
    minWidth: 0,
    color: '#3A96DD',
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'right',
  },
  stageHandlerNameMinimal: {
    color: MINIMAL_UI.blueDark,
    fontWeight: '700',
  },
  stageReadOnlyHint: {
    color: '#93C5FD',
    fontSize: 11,
    lineHeight: 14,
    marginTop: 2,
    marginBottom: 2,
  },
  stageReadOnlyHintMinimal: {
    color: MINIMAL_UI.textMuted,
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
    borderColor: 'rgba(52, 211, 153, 0.35)',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    minWidth: 84,
    alignItems: 'center',
  },
  stageButtonMinimal: {
    borderRadius: 10,
    borderColor: MINIMAL_UI.border,
    backgroundColor: MINIMAL_UI.background,
  },
  stageButtonLead: {
    minWidth: 78,
  },
  stageButtonDone: {
    borderColor: 'rgba(34, 211, 238, 0.65)',
    backgroundColor: 'rgba(34, 211, 238, 0.2)',
  },
  stageButtonDoneMinimal: {
    borderColor: MINIMAL_UI.blueDark,
    backgroundColor: '#EFF6FF',
  },
  stageButtonLocked: {
    opacity: 0.4,
    borderColor: 'rgba(52, 211, 153, 0.35)',
    backgroundColor: '#FFFFFF',
  },
  stageButtonLockedMinimal: {
    borderColor: MINIMAL_UI.divider,
    backgroundColor: MINIMAL_UI.rowHover,
  },
  stageButtonText: {
    color: '#3A96DD',
    fontSize: 13,
    fontWeight: '800',
  },
  stageButtonTextMinimal: {
    color: MINIMAL_UI.text,
    fontWeight: '700',
  },
  stageButtonTextLocked: {
    color: 'rgba(58, 150, 221, 0.82)',
  },
  stageButtonTextLockedMinimal: {
    color: MINIMAL_UI.textMuted,
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
  cancellationRequestBoxMinimal: {
    borderColor: '#F59E0B',
    backgroundColor: '#FFFBEB',
    borderRadius: 12,
  },
  cancellationRequestTitle: {
    color: '#FDE68A',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  cancellationRequestTitleMinimal: {
    color: '#B45309',
    textTransform: 'none',
    letterSpacing: 0,
    fontSize: 13,
    fontWeight: '700',
  },
  cancellationRequestMessage: {
    color: '#FEF3C7',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
  cancellationRequestMessageMinimal: {
    color: '#92400E',
  },
  cancellationRequestReasonLabel: {
    color: '#FCD34D',
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginTop: 2,
  },
  cancellationRequestReasonLabelMinimal: {
    color: '#B45309',
    textTransform: 'none',
    letterSpacing: 0,
    fontSize: 12,
  },
  cancellationRequestReasonText: {
    color: '#FFFBEB',
    fontSize: 13,
    lineHeight: 18,
  },
  cancellationRequestReasonTextMinimal: {
    color: '#78350F',
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
  cancellationButtonMinimal: {
    borderRadius: 12,
    borderColor: '#DC2626',
    backgroundColor: '#DC2626',
  },
  cancellationButtonText: {
    color: '#FECACA',
    fontSize: 14,
    fontWeight: '800',
  },
  cancellationButtonTextMinimal: {
    color: MINIMAL_UI.onDark,
    fontWeight: '700',
  },
});
