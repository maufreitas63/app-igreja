import { useEntityPrefix } from '@/context/EntityPrefixContext';
import { CardLoadingState } from '@/components/ui/CardLoadingState';
import { MaintenanceHelpInfoTitle } from '@/components/ui/MaintenanceHelpInfoTitle';
import { SectionLabel } from '@/components/ui/SectionLabel';
import { useMaintenanceFamilyReception } from '@/hooks/useMaintenanceFamilyReception';
import {
  buildFamilyRegistrationShareUrl,
  buildFamilyRegistrationWhatsAppUrl,
  parseBrazilianDateToIso,
} from '@/lib/familyRegistration';
import {
  informantHasValidCep,
  isPlaceholderCellBirthDate,
  type FamilyReceptionMatch,
} from '@/lib/familyReceptionApi';
import { formatBrazilCepInput, formatBrazilDateInput } from '@/lib/inputMasks';
import { computeMaintenanceContentHeight, maintenancePanelStyles } from '@/lib/maintenanceCardStyles';
import { confirmDialog } from '@/lib/confirmDialog';
import { formatShortName } from '@/lib/formatShortName';
import { CONTAIN_WIDTH } from '@/lib/minimalPresentation';
import { MINIMAL_SECTION_TITLE, MINIMAL_UI } from '@/lib/minimalUiTheme';
import { getStoredActiveIgrejaBranding } from '@/lib/tenantSession';
import { MaterialIcons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as Linking from 'expo-linking';
import React, { useState } from 'react';
import Toast from 'react-native-toast-message';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

type Props = {
  isActive?: boolean;
  panelHeight: number;
  minimal?: boolean;
};

const ACCENT = '#3A96DD';

const formatSubmissionDate = (value: string) => {
  const parsed = Date.parse(value);

  if (!Number.isFinite(parsed)) {
    return '—';
  }

  return new Date(parsed).toLocaleString('pt-BR');
};

const formatBirthDateDisplay = (value: string | null | undefined) => {
  const raw = (value ?? '').trim().slice(0, 10);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (!match) {
    return value?.trim() || '—';
  }
  return `${match[3]}/${match[2]}/${match[1]}`;
};

const formatMatchReasons = (match: FamilyReceptionMatch) => {
  const reasons = [
    match.matchByName ? 'nome' : null,
    match.matchByBirth ? 'nascimento' : null,
    match.matchByPhone ? 'telefone' : null,
  ].filter(Boolean);

  return reasons.length > 0 ? reasons.join(', ') : 'dados cadastrais';
};

function SectionHeading({ children, minimal }: { children: string; minimal: boolean }) {
  return minimal ? (
    <Text style={styles.sectionLabelMinimal}>{children}</Text>
  ) : (
    <SectionLabel variant="maintenance">{children}</SectionLabel>
  );
}

export function MaintenanceFamilyReceptionCard({
  isActive = true,
  panelHeight,
  minimal = false,
}: Props) {
  const { prefix, newFamilyRecordingHint } = useEntityPrefix();
  const {
    submissions,
    loading,
    processing,
    error,
    statusMessage,
    expandedSubmissionId,
    inspectBySubmissionId,
    inspectLoadingId,
    refetch,
    toggleExpanded,
    processSubmission,
    rejectSubmission,
    discardMember,
    updatePendingBirthDate,
    updatePendingCep,
  } = useMaintenanceFamilyReception(isActive);
  const [birthDrafts, setBirthDrafts] = useState<Record<string, string>>({});
  const [cepDrafts, setCepDrafts] = useState<Record<string, string>>({});
  const [savingBirthId, setSavingBirthId] = useState<string | null>(null);
  const [savingCepId, setSavingCepId] = useState<string | null>(null);
  const [sharingInvite, setSharingInvite] = useState(false);

  const contentHeight = computeMaintenanceContentHeight(panelHeight);

  const handleShareInvite = async () => {
    setSharingInvite(true);
    try {
      const branding = await getStoredActiveIgrejaBranding();
      const tenantCode = (branding?.code || prefix).trim().toUpperCase();

      if (!tenantCode || tenantCode === 'APP') {
        Toast.show({
          type: 'error',
          text1: 'Recepção familiar',
          text2: 'Código da instância indisponível para montar o convite.',
          visibilityTime: 4000,
        });
        return;
      }

      const formUrl = buildFamilyRegistrationShareUrl(tenantCode);
      const churchName = branding?.name?.trim() || tenantCode;
      const waUrl = buildFamilyRegistrationWhatsAppUrl(formUrl, churchName);

      await Clipboard.setStringAsync(formUrl);
      await Linking.openURL(waUrl);

      Toast.show({
        type: 'success',
        text1: 'Convite copiado e WhatsApp aberto',
        text2: formUrl,
        visibilityTime: 4500,
      });
    } catch (shareError) {
      Toast.show({
        type: 'error',
        text1: 'Recepção familiar',
        text2:
          shareError instanceof Error
            ? shareError.message
            : 'Não foi possível abrir o WhatsApp com o convite.',
        visibilityTime: 4000,
      });
    } finally {
      setSharingInvite(false);
    }
  };

  const handleSaveBirthDate = async (memberId: string) => {
    const iso = parseBrazilianDateToIso(birthDrafts[memberId] ?? '');
    if (!iso) {
      Toast.show({
        type: 'error',
        text1: 'Data inválida',
        text2: 'Informe a data real no formato dd/mm/aaaa.',
        visibilityTime: 3500,
      });
      return;
    }

    setSavingBirthId(memberId);
    const result = await updatePendingBirthDate(memberId, iso);
    setSavingBirthId(null);
    Toast.show({
      type: result.success ? 'success' : 'error',
      text1: 'Data de nascimento',
      text2: result.message,
      visibilityTime: 3500,
    });
    if (result.success) {
      setBirthDrafts((current) => {
        const next = { ...current };
        delete next[memberId];
        return next;
      });
    }
  };

  const handleSaveCep = async (memberId: string) => {
    const cep = (cepDrafts[memberId] ?? '').replace(/\D/g, '');
    if (cep.length !== 8) {
      Toast.show({
        type: 'error',
        text1: 'CEP inválido',
        text2: 'Informe um CEP com 8 dígitos.',
        visibilityTime: 3500,
      });
      return;
    }

    setSavingCepId(memberId);
    const result = await updatePendingCep(memberId, cep);
    setSavingCepId(null);
    Toast.show({
      type: result.success ? 'success' : 'error',
      text1: 'CEP',
      text2: result.message,
      visibilityTime: 3500,
    });
    if (result.success) {
      setCepDrafts((current) => {
        const next = { ...current };
        delete next[memberId];
        return next;
      });
    }
  };

  const handleProcess = async (submissionId: string) => {
    const result = await processSubmission(submissionId);
    Toast.show({
      type: result.success ? 'success' : 'error',
      text1: 'Recepção familiar',
      text2: result.message,
      visibilityTime: 4500,
    });
  };

  const handleReject = async (submissionId: string) => {
    const confirmed = await confirmDialog(
      'Rejeitar lote',
      'Descartar todos os integrantes deste cadastro familiar?',
      'Rejeitar',
      'Cancelar',
      { destructive: true }
    );
    if (!confirmed) {
      return;
    }

    const result = await rejectSubmission(submissionId);
    Toast.show({
      type: result.success ? 'success' : 'error',
      text1: 'Recepção familiar',
      text2: result.message,
      visibilityTime: 4500,
    });
  };

  const handleDiscardMember = async (memberId: string, submissionId: string, memberName: string) => {
    const confirmed = await confirmDialog(
      'Descartar integrante',
      `Descartar ${memberName} deste lote? O cadastro já existente na instância será mantido.`,
      'Descartar',
      'Cancelar',
      { destructive: true }
    );
    if (!confirmed) {
      return;
    }

    const result = await discardMember(memberId, submissionId);
    Toast.show({
      type: result.success ? 'success' : 'error',
      text1: 'Recepção familiar',
      text2: result.message,
      visibilityTime: 4500,
    });
  };

  const handleDiscardFamily = async (submissionId: string) => {
    const confirmed = await confirmDialog(
      'Descartar família do lote',
      'Descartar todos os integrantes deste cadastro? Nada será gravado nas tabelas finais.',
      'Descartar todos',
      'Cancelar',
      { destructive: true }
    );
    if (!confirmed) {
      return;
    }

    const result = await rejectSubmission(submissionId);
    Toast.show({
      type: result.success ? 'success' : 'error',
      text1: 'Recepção familiar',
      text2: result.message,
      visibilityTime: 4500,
    });
  };

  return (
    <View style={[styles.panel, minimal && styles.panelMinimal, { height: contentHeight }]}>
      <MaintenanceHelpInfoTitle
        title="Recepção — Cadastro Familiar"
        helpText={`Formulários públicos entram aqui antes de profiles/members. Use o botão WhatsApp para enviar o link /cadastro-familia/?tenant=${prefix}. Lotes com código familiar detectado usam o mesmo ${prefix}; conflitos, data 01/01/1900 ou CEP ausente ficam travados até revisão.`}
        minimal={minimal}
        titleStyle={minimal ? styles.sectionTitle : maintenancePanelStyles.panelTitle}
      />

      {error ? (
        <Text style={[styles.errorText, minimal && styles.errorTextMinimal]}>{error}</Text>
      ) : null}
      {statusMessage ? (
        <Text style={[styles.successText, minimal && styles.successTextMinimal]}>
          {statusMessage}
        </Text>
      ) : null}

      <View style={[styles.toolbar, minimal && styles.toolbarMinimal]}>
        <TouchableOpacity
          style={[styles.toolbarButton, minimal && styles.toolbarButtonMinimal]}
          onPress={() => void refetch()}
          activeOpacity={0.85}
        >
          <MaterialIcons name="refresh" size={18} color={minimal ? MINIMAL_UI.icon : '#E2E8F0'} />
          <Text style={[styles.toolbarButtonText, minimal && styles.toolbarButtonTextMinimal]}>
            Atualizar
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.toolbarButton, styles.whatsappButton, minimal && styles.toolbarButtonMinimal]}
          onPress={() => void handleShareInvite()}
          disabled={sharingInvite}
          activeOpacity={0.85}
        >
          <MaterialIcons name="chat" size={18} color={minimal ? MINIMAL_UI.icon : '#E2E8F0'} />
          <Text style={[styles.toolbarButtonText, minimal && styles.toolbarButtonTextMinimal]}>
            {sharingInvite ? 'Abrindo…' : 'WhatsApp — convite'}
          </Text>
        </TouchableOpacity>
      </View>

      <SectionHeading minimal={minimal}>{`Fila pendente (${submissions.length})`}</SectionHeading>

      {loading ? (
        <CardLoadingState label="Carregando recepção..." minimal={minimal} />
      ) : submissions.length === 0 ? (
        <Text style={[styles.emptyText, minimal && styles.emptyTextMinimal]}>
          Nenhum cadastro aguardando análise.
        </Text>
      ) : (
        <ScrollView
          style={[styles.list, minimal && styles.listMinimal]}
          contentContainerStyle={styles.listContent}
          nestedScrollEnabled
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator
        >
          {submissions.map((submission) => {
            const expanded = expandedSubmissionId === submission.submissionId;
            const inspect =
              inspectBySubmissionId[submission.submissionId] ?? submission.inspect ?? null;
            const inspectLoading = inspectLoadingId === submission.submissionId;
            const hasPlaceholderBirth = submission.members.some((member) =>
              isPlaceholderCellBirthDate(member.birthDate)
            );
            const informant = submission.members.find((member) => member.isInformant);
            const missingCep = Boolean(informant) && !informantHasValidCep(informant?.cep);
            const incomingWithMatches = inspect?.incoming.filter((item) => item.matches.length > 0) ?? [];
            const hasMatches = incomingWithMatches.length > 0;
            const canGravar =
              !hasMatches
              && !submission.hasFamilyConflict
              && !hasPlaceholderBirth
              && !missingCep;

            return (
              <View
                key={submission.submissionId}
                style={[
                  styles.submissionCard,
                  minimal && styles.submissionCardMinimal,
                  expanded && styles.submissionCardSelected,
                  minimal && expanded && styles.submissionCardSelectedMinimal,
                ]}
              >
                <TouchableOpacity
                  style={styles.submissionHeader}
                  onPress={() => toggleExpanded(submission.submissionId)}
                  activeOpacity={0.9}
                  hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
                >
                  <Text style={[styles.submissionTitle, minimal && styles.submissionTitleMinimal]}>
                    {submission.memberCount} integrante(s) · {formatSubmissionDate(submission.createdAt)}
                  </Text>
                  {submission.hasFamilyConflict ? (
                    <Text style={[styles.conflictBadge, minimal && styles.conflictBadgeMinimal]}>
                      Conflito de família
                    </Text>
                  ) : null}
                </TouchableOpacity>

                {hasPlaceholderBirth ? (
                  <Text style={[styles.placeholderAlert, minimal && styles.placeholderAlertMinimal]}>
                    Visitante de célula: corrija a data de nascimento (01/01/1900) antes de gravar.
                  </Text>
                ) : null}
                {missingCep ? (
                  <Text style={[styles.placeholderAlert, minimal && styles.placeholderAlertMinimal]}>
                    CEP do representante legal ausente ou inválido — o lote fica travado até corrigir.
                  </Text>
                ) : null}

                <Text style={[styles.submissionMeta, minimal && styles.submissionMetaMinimal]}>
                  Protocolo: {submission.submissionId.slice(0, 8).toUpperCase()}
                </Text>
                <Text style={[styles.submissionMeta, minimal && styles.submissionMetaMinimal]}>
                  Código detectado: {submission.detectedFamilyId ?? newFamilyRecordingHint}
                </Text>

                {submission.members.map((member) => {
                  const placeholderBirth = isPlaceholderCellBirthDate(member.birthDate);

                  return (
                    <View
                      key={member.id}
                      style={[styles.memberRow, minimal && styles.memberRowMinimal]}
                    >
                      <Text style={[styles.memberName, minimal && styles.memberNameMinimal]}>
                        {member.isInformant ? '★ ' : '• '}
                        {formatShortName(member.fullName)} — {member.relationship}
                      </Text>
                      <Text style={[styles.memberHint, minimal && styles.memberHintMinimal]}>
                        {`nasc. ${formatBirthDateDisplay(member.birthDate)}`}
                        {member.phone ? ` · ${member.phone}` : ''}
                      </Text>
                      {placeholderBirth ? (
                        <View style={styles.birthEditor}>
                          <TextInput
                            value={birthDrafts[member.id] ?? ''}
                            onChangeText={(value) =>
                              setBirthDrafts((current) => ({
                                ...current,
                                [member.id]: formatBrazilDateInput(value),
                              }))
                            }
                            placeholder="dd/mm/aaaa"
                            placeholderTextColor={minimal ? MINIMAL_UI.textMuted : 'rgba(58, 150, 221, 0.55)'}
                            keyboardType="number-pad"
                            maxLength={10}
                            style={[styles.birthInput, minimal && styles.birthInputMinimal]}
                          />
                          <TouchableOpacity
                            style={[styles.birthSaveButton, minimal && styles.birthSaveButtonMinimal]}
                            onPress={() => void handleSaveBirthDate(member.id)}
                            disabled={savingBirthId === member.id}
                            activeOpacity={0.85}
                          >
                            <Text
                              style={[
                                styles.birthSaveButtonText,
                                minimal && styles.birthSaveButtonTextMinimal,
                              ]}
                            >
                              {savingBirthId === member.id ? 'Salvando…' : 'Corrigir data'}
                            </Text>
                          </TouchableOpacity>
                        </View>
                      ) : null}
                      {member.isInformant && missingCep ? (
                        <View style={styles.birthEditor}>
                          <TextInput
                            value={cepDrafts[member.id] ?? ''}
                            onChangeText={(value) =>
                              setCepDrafts((current) => ({
                                ...current,
                                [member.id]: formatBrazilCepInput(value),
                              }))
                            }
                            placeholder="00000-000"
                            placeholderTextColor={minimal ? MINIMAL_UI.textMuted : 'rgba(58, 150, 221, 0.55)'}
                            keyboardType="number-pad"
                            maxLength={9}
                            style={[styles.birthInput, minimal && styles.birthInputMinimal]}
                          />
                          <TouchableOpacity
                            style={[styles.birthSaveButton, minimal && styles.birthSaveButtonMinimal]}
                            onPress={() => void handleSaveCep(member.id)}
                            disabled={savingCepId === member.id}
                            activeOpacity={0.85}
                          >
                            <Text
                              style={[
                                styles.birthSaveButtonText,
                                minimal && styles.birthSaveButtonTextMinimal,
                              ]}
                            >
                              {savingCepId === member.id ? 'Salvando…' : 'Informar CEP'}
                            </Text>
                          </TouchableOpacity>
                        </View>
                      ) : null}
                    </View>
                  );
                })}

                {inspectLoading && !inspect ? (
                  <ActivityIndicator
                    color={minimal ? MINIMAL_UI.blueDark : ACCENT}
                    size="small"
                  />
                ) : null}

                {inspect ? (
                  <View style={styles.expandedBlock}>
                    <Text style={[styles.familyListTitle, minimal && styles.familyListTitleMinimal]}>
                      {inspect.detectedFamilyId
                        ? `Família já cadastrada (${inspect.detectedFamilyId})`
                        : 'Nenhum código familiar detectado — família nova'}
                    </Text>
                    {inspect.existingMembers.length === 0 ? (
                      <Text style={[styles.memberHint, minimal && styles.memberHintMinimal]}>
                        Nenhum integrante com este código nesta instância.
                      </Text>
                    ) : (
                      inspect.existingMembers.map((person) => (
                        <Text
                          key={person.profileId}
                          style={[styles.existingMember, minimal && styles.existingMemberMinimal]}
                        >
                          • {formatShortName(person.fullName)}
                          {person.birthDate ? ` · nasc. ${formatBirthDateDisplay(person.birthDate)}` : ''}
                          {person.phone ? ` · ${person.phone}` : ''}
                        </Text>
                      ))
                    )}

                    {hasMatches ? (
                      <View style={[styles.matchBox, minimal && styles.matchBoxMinimal]}>
                        <Text style={[styles.matchTitle, minimal && styles.matchTitleMinimal]}>
                          Integrante(s) já identificados no cadastro desta instância
                        </Text>
                        {incomingWithMatches.map((person) => (
                          <View key={person.id} style={styles.matchPerson}>
                            <Text style={[styles.matchPersonName, minimal && styles.matchPersonNameMinimal]}>
                              {formatShortName(person.fullName)}
                            </Text>
                            {person.matches.map((match) => (
                              <Text
                                key={match.profileId}
                                style={[styles.matchDetail, minimal && styles.matchDetailMinimal]}
                              >
                                {match.sameFamily
                                  ? `Já consta nesta família (${match.familyId ?? inspect.detectedFamilyId}).`
                                  : `Possivelmente de outra família (${match.familyId ?? 'sem código'}).`}
                                {` Conferência por ${formatMatchReasons(match)}: ${formatShortName(match.fullName)}.`}
                              </Text>
                            ))}
                            <TouchableOpacity
                              style={[styles.discardButton, processing && styles.buttonDisabled]}
                              onPress={() =>
                                void handleDiscardMember(
                                  person.id,
                                  submission.submissionId,
                                  person.fullName
                                )
                              }
                              disabled={processing}
                              activeOpacity={0.85}
                            >
                              <Text style={styles.discardButtonText}>Descartar este integrante</Text>
                            </TouchableOpacity>
                          </View>
                        ))}
                        <TouchableOpacity
                          style={[
                            styles.discardAllButton,
                            minimal && styles.discardAllButtonMinimal,
                            processing && styles.buttonDisabled,
                          ]}
                          onPress={() => void handleDiscardFamily(submission.submissionId)}
                          disabled={processing}
                          activeOpacity={0.85}
                        >
                          <Text
                            style={[
                              styles.discardAllButtonText,
                              minimal && styles.discardAllButtonTextMinimal,
                            ]}
                          >
                            Descartar todos os integrantes da família
                          </Text>
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <View style={styles.itemActions}>
                        <TouchableOpacity
                          style={[
                            styles.primaryButton,
                            minimal && styles.primaryButtonMinimal,
                            (!canGravar || processing) && styles.buttonDisabled,
                          ]}
                          onPress={() => void handleProcess(submission.submissionId)}
                          disabled={!canGravar || processing}
                          activeOpacity={0.85}
                        >
                          {processing ? (
                            <ActivityIndicator
                              color={minimal ? MINIMAL_UI.onDark : '#052e16'}
                              size="small"
                            />
                          ) : (
                            <Text
                              style={[
                                styles.primaryButtonText,
                                minimal && styles.primaryButtonTextMinimal,
                              ]}
                            >
                              Gravar
                            </Text>
                          )}
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[
                            styles.secondaryButton,
                            minimal && styles.secondaryButtonMinimal,
                            processing && styles.buttonDisabled,
                          ]}
                          onPress={() => void handleReject(submission.submissionId)}
                          disabled={processing}
                          activeOpacity={0.85}
                        >
                          <Text
                            style={[
                              styles.secondaryButtonText,
                              minimal && styles.secondaryButtonTextMinimal,
                            ]}
                          >
                            Rejeitar
                          </Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                ) : null}
              </View>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    flex: 1,
  },
  errorText: {
    color: '#FCA5A5',
    fontSize: 13,
    marginBottom: 8,
  },
  successText: {
    color: ACCENT,
    fontSize: 13,
    marginBottom: 8,
  },
  toolbar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  toolbarButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(148, 163, 184, 0.12)',
  },
  toolbarButtonText: {
    color: '#3A96DD',
    fontSize: 12,
    fontWeight: '700',
  },
  batchActions: {
    gap: 8,
    marginBottom: 12,
  },
  itemActions: {
    gap: 8,
    marginTop: 12,
  },
  expandedBlock: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(148, 163, 184, 0.25)',
    gap: 6,
  },
  familyListTitle: {
    color: '#3A96DD',
    fontSize: 12,
    fontWeight: '800',
    marginTop: 4,
    marginBottom: 2,
  },
  existingMember: {
    color: 'rgba(58, 150, 221, 0.92)',
    fontSize: 12,
    lineHeight: 18,
  },
  matchBox: {
    marginTop: 8,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(220, 38, 38, 0.45)',
    backgroundColor: 'rgba(220, 38, 38, 0.08)',
    gap: 8,
    flexShrink: 0,
  },
  matchTitle: {
    color: '#DC2626',
    fontSize: 12,
    fontWeight: '800',
  },
  matchPerson: {
    gap: 4,
  },
  matchPersonName: {
    color: '#DC2626',
    fontSize: 13,
    fontWeight: '800',
  },
  matchDetail: {
    color: '#B91C1C',
    fontSize: 12,
    lineHeight: 16,
  },
  discardButton: {
    alignSelf: 'flex-start',
    marginTop: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(220, 38, 38, 0.55)',
  },
  discardButtonText: {
    color: '#DC2626',
    fontSize: 12,
    fontWeight: '700',
  },
  discardAllButton: {
    marginTop: 4,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
    backgroundColor: 'rgba(220, 38, 38, 0.16)',
  },
  discardAllButtonText: {
    color: '#DC2626',
    fontSize: 13,
    fontWeight: '800',
  },
  primaryButton: {
    backgroundColor: ACCENT,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#052e16',
    fontSize: 14,
    fontWeight: '800',
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: 'rgba(248, 113, 113, 0.45)',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#FCA5A5',
    fontSize: 13,
    fontWeight: '700',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  emptyText: {
    color: 'rgba(58, 150, 221, 0.82)',
    fontSize: 14,
    fontStyle: 'italic',
  },
  list: {
    flex: 1,
    minHeight: 0,
  },
  listContent: {
    gap: 10,
    paddingBottom: 16,
  },
  submissionCard: {
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.25)',
    borderRadius: 12,
    padding: 12,
    backgroundColor: 'rgba(15, 23, 42, 0.35)',
  },
  submissionCardSelected: {
    borderColor: ACCENT,
    backgroundColor: 'rgba(52, 211, 153, 0.08)',
  },
  submissionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  submissionTitle: {
    color: '#3A96DD',
    fontSize: 14,
    fontWeight: '800',
    flex: 1,
  },
  conflictBadge: {
    color: '#FDE68A',
    fontSize: 11,
    fontWeight: '800',
  },
  placeholderAlert: {
    color: '#FDE68A',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6,
    lineHeight: 16,
  },
  birthEditor: {
    marginTop: 8,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    alignItems: 'center',
  },
  birthInput: {
    minWidth: 120,
    borderWidth: 1,
    borderColor: 'rgba(253, 230, 138, 0.55)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    color: '#FDE68A',
    fontSize: 13,
  },
  birthSaveButton: {
    backgroundColor: 'rgba(253, 230, 138, 0.18)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  birthSaveButtonText: {
    color: '#FDE68A',
    fontSize: 12,
    fontWeight: '800',
  },
  whatsappButton: {
    backgroundColor: 'rgba(37, 211, 102, 0.16)',
  },
  submissionMeta: {
    color: 'rgba(58, 150, 221, 0.82)',
    fontSize: 12,
    marginBottom: 2,
  },
  memberRow: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(148, 163, 184, 0.2)',
  },
  memberName: {
    color: '#3A96DD',
    fontSize: 13,
    fontWeight: '700',
  },
  memberHint: {
    color: 'rgba(58, 150, 221, 0.82)',
    fontSize: 11,
    marginTop: 2,
  },
  panelMinimal: {
    ...CONTAIN_WIDTH,
    paddingHorizontal: 0,
    paddingVertical: 4,
    borderRadius: 0,
    backgroundColor: MINIMAL_UI.background,
    overflow: 'visible',
  },
  sectionTitle: {
    ...MINIMAL_SECTION_TITLE,
    alignSelf: 'stretch',
    maxWidth: '100%',
    minWidth: 0,
    paddingHorizontal: 0,
  },
  sectionLabelMinimal: {
    color: MINIMAL_UI.textMuted,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 6,
    marginTop: 4,
  },
  errorTextMinimal: {
    color: '#DC2626',
  },
  successTextMinimal: {
    color: '#16A34A',
  },
  toolbarMinimal: {
    ...CONTAIN_WIDTH,
  },
  toolbarButtonMinimal: {
    borderWidth: 1,
    borderColor: MINIMAL_UI.border,
    backgroundColor: MINIMAL_UI.background,
    borderRadius: 10,
  },
  toolbarButtonTextMinimal: {
    color: MINIMAL_UI.blueDark,
  },
  batchActionsMinimal: {
    ...CONTAIN_WIDTH,
  },
  familyListTitleMinimal: {
    color: MINIMAL_UI.blueDark,
  },
  existingMemberMinimal: {
    color: MINIMAL_UI.text,
  },
  matchBoxMinimal: {
    borderColor: '#DC2626',
    backgroundColor: '#FEF2F2',
  },
  matchTitleMinimal: {
    color: '#DC2626',
  },
  matchPersonNameMinimal: {
    color: '#DC2626',
  },
  matchDetailMinimal: {
    color: '#B91C1C',
  },
  discardAllButtonMinimal: {
    backgroundColor: '#FEE2E2',
  },
  discardAllButtonTextMinimal: {
    color: '#DC2626',
  },
  primaryButtonMinimal: {
    backgroundColor: MINIMAL_UI.blueDark,
  },
  primaryButtonTextMinimal: {
    color: MINIMAL_UI.onDark,
  },
  secondaryButtonMinimal: {
    borderColor: '#DC2626',
    backgroundColor: MINIMAL_UI.background,
  },
  secondaryButtonTextMinimal: {
    color: '#DC2626',
  },
  emptyTextMinimal: {
    color: MINIMAL_UI.textMuted,
    fontStyle: 'normal',
  },
  listMinimal: {
    ...CONTAIN_WIDTH,
  },
  submissionCardMinimal: {
    borderColor: MINIMAL_UI.border,
    backgroundColor: MINIMAL_UI.background,
  },
  submissionCardSelectedMinimal: {
    borderColor: MINIMAL_UI.blueDark,
    backgroundColor: '#EFF6FF',
  },
  submissionTitleMinimal: {
    color: MINIMAL_UI.blueDark,
  },
  conflictBadgeMinimal: {
    color: '#B45309',
  },
  placeholderAlertMinimal: {
    color: '#B45309',
  },
  birthInputMinimal: {
    borderColor: '#F59E0B',
    color: MINIMAL_UI.text,
    backgroundColor: MINIMAL_UI.background,
  },
  birthSaveButtonMinimal: {
    backgroundColor: '#FEF3C7',
  },
  birthSaveButtonTextMinimal: {
    color: '#B45309',
  },
  submissionMetaMinimal: {
    color: MINIMAL_UI.textMuted,
  },
  memberRowMinimal: {
    borderTopColor: MINIMAL_UI.divider,
  },
  memberNameMinimal: {
    color: MINIMAL_UI.text,
  },
  memberHintMinimal: {
    color: MINIMAL_UI.textMuted,
  },
});
