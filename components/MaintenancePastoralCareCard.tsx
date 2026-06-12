import { CardLoadingState } from '@/components/ui/CardLoadingState';
import { DropdownSelect } from '@/components/ui/DropdownSelect';
import { SectionLabel } from '@/components/ui/SectionLabel';
import { useMaintenancePastoralCare } from '@/hooks/useMaintenancePastoralCare';
import {
  computeMaintenanceContentHeight,
  maintenancePanelStyles,
} from '@/lib/maintenanceCardStyles';
import { MAINTENANCE_PASTORAL_CARE_SQL_HINT } from '@/hooks/useMaintenancePastoralCare';
import { PASTORAL_DESTINATION_INTERCESSION } from '@/lib/pastoralAccess';
import { PASTORAL_FOLLOW_UP_STAGES } from '@/lib/pastoralRequest';
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
    followUpStages = PASTORAL_FOLLOW_UP_STAGES,
    error,
    rpcMissing,
    selectProfileId,
    setFollowUpStage,
    canAdvanceToFollowUpStage,
    isFollowUpStageDone,
    formatRequestDateTimeLabel,
    accessContext,
  } = useMaintenancePastoralCare(isActive);

  const accessHint = accessContext.hasFullPastoralAccess
    ? null
    : accessContext.isIntercessionVolunteer
      ? `Você visualiza apenas pedidos encaminhados ao ${PASTORAL_DESTINATION_INTERCESSION}.`
      : null;

  const [filterProfileId, setFilterProfileId] = useState(allSubmittersFilterValue);

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
        <>
          <SectionLabel label="Filtrar solicitante" />
          <DropdownSelect
            options={filterDropdownOptions}
            selectedValue={filterProfileId}
            onValueChange={handleFilterChange}
            modalTitle="Filtrar solicitante"
            placeholder="Todos os usuários"
            style={styles.filterDropdown}
            disabled={rpcMissing}
          />

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
        </>
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
            <View style={styles.contactRow}>
              <Text style={styles.contactName} numberOfLines={1}>
                {selectedSubmitter?.shortName ?? selectedRequest.submitterName}
              </Text>
              <Text style={styles.contactPhone} numberOfLines={1}>
                {selectedRequest.phone?.trim() || '—'}
              </Text>
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
            </View>

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
            <Text style={styles.detailValue}>{selectedRequest.requestForLabel}</Text>

            <Text style={styles.detailLabel}>Acompanhamento</Text>
            <View style={styles.stageRow}>
              {followUpStages.map((stage) => {
                const currentStage = selectedRequest.followUpStage;
                const isDone = isFollowUpStageDone(currentStage, stage);
                const canAdvance = canAdvanceToFollowUpStage(currentStage, stage);
                const isLocked = !isDone && !canAdvance;

                return (
                  <TouchableOpacity
                    key={stage}
                    style={[
                      styles.stageButton,
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
  sectionLabel: {
    color: '#CBD5E1',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  filterDropdown: {
    marginBottom: 8,
    height: 40,
    borderColor: '#334155',
    backgroundColor: '#0f172a',
  },
  inlineLoader: {
    marginVertical: 8,
  },
  hintText: {
    color: '#94A3B8',
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 6,
  },
  submitterList: {
    flexGrow: 0,
    maxHeight: 148,
    marginBottom: 8,
  },
  submitterListContent: {
    gap: 6,
  },
  submitterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: 'rgba(15, 23, 42, 0.9)',
    paddingHorizontal: 10,
    paddingVertical: 8,
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
    marginBottom: 4,
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
    paddingHorizontal: 14,
    paddingVertical: 10,
    minWidth: 92,
    alignItems: 'center',
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
});
