import { CardLoadingState } from '@/components/ui/CardLoadingState';
import { MaintenanceHelpInfoTitle } from '@/components/ui/MaintenanceHelpInfoTitle';
import { useWelcomeVisitorFollowup } from '@/hooks/useVisitorFollowup';
import { confirmDialog } from '@/lib/confirmDialog';
import { formatShortName } from '@/lib/formatShortName';
import {
  computeMaintenanceContentHeight,
  MAINTENANCE_SCROLL_PROPS,
  maintenancePanelStyles,
} from '@/lib/maintenanceCardStyles';
import { CONTAIN_WIDTH } from '@/lib/minimalPresentation';
import { MINIMAL_SECTION_TITLE, MINIMAL_UI } from '@/lib/minimalUiTheme';
import { pickRouteParam } from '@/lib/dashboardReturnNavigation';
import {
  formatVisitorFollowupDate,
  hasVisitorFollowupPhone,
  VISITOR_FOLLOWUP_TASK_LABEL,
  type VisitorFollowupBoardTask,
  type VisitorFollowupJourney,
  type VisitorFollowupTask,
} from '@/lib/visitorFollowupApi';
import { openWhatsAppLikeBirthdaysWithText } from '@/lib/whatsapp';
import { FontAwesome, MaterialIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
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
  minimal?: boolean;
};

const HELP_TEXT =
  'O registro não é feito nesta tela. Quando a Recepção Familiar aprova o visitante (status processado), a régua começa sozinha: D+1 WhatsApp da equipe, D+4 convite à célula mais próxima e D+8 verificação de check-in no culto. Aqui a equipe abre o WhatsApp com a mensagem pronta e toca em Concluir para avançar o passo. O D+8 é automático; se não houver culto, vira alerta para o pastor.';

const PROCEDURE_STEPS = [
  {
    day: 'D+1',
    title: 'WhatsApp',
    detail: 'Equipe de boas-vindas envia a mensagem e marca Concluir.',
  },
  {
    day: 'D+4',
    title: 'Célula',
    detail: 'Convite ao grupo mais próximo do CEP do visitante.',
  },
  {
    day: 'D+8',
    title: 'Culto',
    detail: 'Check-in automático. Sem presença, o pastor recebe o alerta.',
  },
] as const;

const stepStatusLabel = (task: VisitorFollowupBoardTask) => {
  if (task.status === 'Concluído') {
    return 'Feito';
  }

  if (task.responsavelCargo === 'system') {
    return `Automático · ${formatVisitorFollowupDate(task.dataProgramada)}`;
  }

  if (task.due) {
    return 'Fazer agora';
  }

  return `Agendado · ${formatVisitorFollowupDate(task.dataProgramada)}`;
};

export function MaintenanceVisitorFollowupCard({
  isActive = true,
  panelHeight,
  minimal = false,
}: Props) {
  const router = useRouter();
  const { presentation: presentationParam } = useLocalSearchParams<{
    presentation?: string | string[];
  }>();
  const { tasks, journeys, loading, error, completingId, refetch, completeTask } =
    useWelcomeVisitorFollowup(isActive);
  const contentHeight = computeMaintenanceContentHeight(panelHeight);

  const openWhatsAppFor = (phone: string | null, message: string, missingLabel: string) => {
    if (!hasVisitorFollowupPhone(phone)) {
      Toast.show({
        type: 'error',
        text1: 'Telefone indisponível',
        text2: missingLabel,
      });
      return;
    }

    const opened = openWhatsAppLikeBirthdaysWithText(phone, message);

    if (!opened) {
      Toast.show({
        type: 'error',
        text1: 'WhatsApp',
        text2: 'Não foi possível abrir o WhatsApp deste contato.',
      });
    }
  };

  const handleWhatsApp = (task: VisitorFollowupTask) => {
    openWhatsAppFor(task.phone, task.descricao, 'Este visitante não tem telefone cadastrado.');
  };

  const handleComplete = async (taskId: string, visitorName: string) => {
    const confirmed = await confirmDialog(
      'Concluir passo',
      `Marcar como feito o contato com ${formatShortName(visitorName)}?`,
      'Concluir',
      'Cancelar'
    );

    if (!confirmed) {
      return;
    }

    const result = await completeTask(taskId);
    Toast.show({
      type: result.success ? 'success' : 'error',
      text1: 'Régua de acolhimento',
      text2: result.success ? 'Passo atualizado.' : result.message,
    });
  };

  const openFamilyReception = () => {
    const presentation = pickRouteParam(presentationParam);
    router.setParams(
      presentation
        ? { panel: 'family_reception', presentation }
        : { panel: 'family_reception' }
    );
  };

  return (
    <View style={[styles.panel, minimal && styles.panelMinimal, { height: contentHeight }]}>
      <MaintenanceHelpInfoTitle
        title="Régua de Acolhimento"
        helpText={HELP_TEXT}
        minimal={minimal}
        titleStyle={minimal ? styles.sectionTitle : maintenancePanelStyles.panelTitle}
      />

      <View style={styles.toolbar}>
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
      </View>

      {error ? (
        <Text style={[styles.errorText, minimal && styles.errorTextMinimal]}>{error}</Text>
      ) : null}

      {loading && !tasks.length && !journeys.length ? (
        <CardLoadingState lines={4} compact minimal={minimal} />
      ) : (
        <ScrollView
          style={styles.list}
          contentContainerStyle={styles.listContent}
          nestedScrollEnabled
          {...MAINTENANCE_SCROLL_PROPS}
        >
          <View style={[styles.guideBox, minimal && styles.guideBoxMinimal]}>
            <Text style={[styles.guideTitle, minimal && styles.guideTitleMinimal]}>
              Procedimento (automático)
            </Text>
            <Text style={[styles.guideIntro, minimal && styles.guideIntroMinimal]}>
              O visitante entra na régua quando a Recepção Familiar aprova o cadastro. Não há
              inclusão manual nesta tela.
            </Text>
            {PROCEDURE_STEPS.map((step) => (
              <View key={step.day} style={styles.guideStep}>
                <Text style={[styles.guideDay, minimal && styles.guideDayMinimal]}>{step.day}</Text>
                <View style={styles.guideStepBody}>
                  <Text style={[styles.guideStepTitle, minimal && styles.guideStepTitleMinimal]}>
                    {step.title}
                  </Text>
                  <Text style={[styles.guideStepDetail, minimal && styles.guideStepDetailMinimal]}>
                    {step.detail}
                  </Text>
                </View>
              </View>
            ))}
            <TouchableOpacity
              style={[styles.receptionButton, minimal && styles.receptionButtonMinimal]}
              onPress={openFamilyReception}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Abrir Recepção Familiar"
            >
              <Text
                style={[styles.receptionButtonText, minimal && styles.receptionButtonTextMinimal]}
              >
                Abrir Recepção Familiar
              </Text>
            </TouchableOpacity>
          </View>

          <Text style={[styles.blockTitle, minimal && styles.blockTitleMinimal]}>
            Para fazer agora
          </Text>
          {!tasks.length ? (
            <Text style={[styles.emptyText, minimal && styles.emptyTextMinimal]}>
              Nenhuma tarefa da equipe para hoje. Os acolhimentos em andamento aparecem abaixo,
              com a data de cada passo.
            </Text>
          ) : (
            tasks.map((task) => {
              const busy = completingId === task.id;
              const canWhatsApp = hasVisitorFollowupPhone(task.phone);

              return (
                <View
                  key={task.id}
                  style={[styles.taskCard, minimal && styles.taskCardMinimal]}
                >
                  <Text
                    style={[styles.taskName, minimal && styles.taskNameMinimal]}
                    numberOfLines={1}
                  >
                    {formatShortName(task.visitorName)}
                  </Text>
                  <Text style={[styles.taskMeta, minimal && styles.taskMetaMinimal]}>
                    {VISITOR_FOLLOWUP_TASK_LABEL[task.tipoTarefa]}
                    {' · '}
                    {formatVisitorFollowupDate(task.dataProgramada)}
                  </Text>
                  <Text style={[styles.taskDesc, minimal && styles.taskDescMinimal]}>
                    {task.descricao}
                  </Text>
                  <View style={styles.taskActions}>
                    <TouchableOpacity
                      style={[
                        styles.whatsappButton,
                        minimal && styles.whatsappButtonMinimal,
                        !canWhatsApp && styles.whatsappButtonDisabled,
                      ]}
                      onPress={() => handleWhatsApp(task)}
                      disabled={!canWhatsApp}
                      activeOpacity={0.85}
                      accessibilityLabel={
                        canWhatsApp ? 'Abrir WhatsApp' : 'Telefone indisponível'
                      }
                    >
                      <FontAwesome
                        name="whatsapp"
                        size={18}
                        color={canWhatsApp ? (minimal ? '#16A34A' : '#4ADE80') : '#94A3B8'}
                      />
                      <Text
                        style={[
                          styles.whatsappLabel,
                          minimal && styles.whatsappLabelMinimal,
                          !canWhatsApp && styles.whatsappLabelDisabled,
                        ]}
                      >
                        WhatsApp
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.doneButton, minimal && styles.doneButtonMinimal]}
                      onPress={() => void handleComplete(task.id, task.visitorName)}
                      disabled={busy}
                      activeOpacity={0.85}
                    >
                      {busy ? (
                        <ActivityIndicator size="small" color={minimal ? MINIMAL_UI.blueDark : '#FFF'} />
                      ) : (
                        <Text style={[styles.doneButtonText, minimal && styles.doneButtonTextMinimal]}>
                          Concluir
                        </Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })
          )}

          <Text style={[styles.blockTitle, minimal && styles.blockTitleMinimal]}>
            Acolhimentos em andamento
          </Text>
          {!journeys.length ? (
            <Text style={[styles.emptyText, minimal && styles.emptyTextMinimal]}>
              Ainda não há régua ativa. Processe um visitante na Recepção Familiar para gerar os
              passos D+1, D+4 e D+8.
            </Text>
          ) : (
            journeys.map((journey) => (
              <JourneyCard
                key={journey.followupId}
                journey={journey}
                minimal={minimal}
                completingId={completingId}
                onWhatsApp={(task) =>
                  openWhatsAppFor(
                    journey.phone,
                    task.descricao,
                    'Este visitante não tem telefone cadastrado.'
                  )
                }
                onComplete={(task) => void handleComplete(task.id, journey.visitorName)}
              />
            ))
          )}
        </ScrollView>
      )}
    </View>
  );
}

function JourneyCard({
  journey,
  minimal,
  completingId,
  onWhatsApp,
  onComplete,
}: {
  journey: VisitorFollowupJourney;
  minimal: boolean;
  completingId: string | null;
  onWhatsApp: (task: VisitorFollowupBoardTask) => void;
  onComplete: (task: VisitorFollowupBoardTask) => void;
}) {
  const canWhatsApp = hasVisitorFollowupPhone(journey.phone);

  return (
    <View style={[styles.taskCard, minimal && styles.taskCardMinimal]}>
      <Text style={[styles.taskName, minimal && styles.taskNameMinimal]} numberOfLines={1}>
        {formatShortName(journey.visitorName)}
      </Text>
      <Text style={[styles.taskMeta, minimal && styles.taskMetaMinimal]}>
        Aprovado em {formatVisitorFollowupDate(journey.dataAprovacao)}
      </Text>
      {journey.tasks.map((task) => {
        const busy = completingId === task.id;
        const canAct = task.due && task.responsavelCargo === 'welcome_team';
        const done = task.status === 'Concluído';

        return (
          <View key={task.id} style={styles.stepRow}>
            <View style={styles.stepRowText}>
              <Text style={[styles.stepLabel, minimal && styles.stepLabelMinimal]}>
                {VISITOR_FOLLOWUP_TASK_LABEL[task.tipoTarefa]}
              </Text>
              <Text
                style={[
                  styles.stepStatus,
                  minimal && styles.stepStatusMinimal,
                  done && styles.stepStatusDone,
                  task.due && !done && styles.stepStatusDue,
                ]}
              >
                {stepStatusLabel(task)}
              </Text>
            </View>
            {canAct ? (
              <View style={styles.stepActions}>
                <TouchableOpacity
                  onPress={() => onWhatsApp(task)}
                  disabled={!canWhatsApp}
                  accessibilityLabel="Abrir WhatsApp"
                >
                  <FontAwesome
                    name="whatsapp"
                    size={16}
                    color={canWhatsApp ? (minimal ? '#16A34A' : '#4ADE80') : '#94A3B8'}
                  />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => onComplete(task)}
                  disabled={busy}
                  accessibilityLabel="Concluir passo"
                >
                  {busy ? (
                    <ActivityIndicator size="small" color={minimal ? MINIMAL_UI.blueDark : '#1D4ED8'} />
                  ) : (
                    <Text style={[styles.stepComplete, minimal && styles.stepCompleteMinimal]}>
                      Concluir
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    flex: 1,
    minHeight: 0,
    gap: 8,
  },
  panelMinimal: {
    ...CONTAIN_WIDTH,
    backgroundColor: MINIMAL_UI.background,
  },
  sectionTitle: {
    ...MINIMAL_SECTION_TITLE,
  },
  toolbar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  toolbarButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  toolbarButtonMinimal: {
    borderWidth: 1,
    borderColor: MINIMAL_UI.border,
    borderRadius: 999,
  },
  toolbarButtonText: {
    color: '#E2E8F0',
    fontSize: 13,
    fontWeight: '700',
  },
  toolbarButtonTextMinimal: {
    color: MINIMAL_UI.text,
  },
  errorText: {
    color: '#FCA5A5',
    fontSize: 12,
  },
  errorTextMinimal: {
    color: '#DC2626',
  },
  list: {
    flex: 1,
    minHeight: 0,
  },
  listContent: {
    gap: 10,
    paddingBottom: 16,
  },
  guideBox: {
    borderWidth: 1,
    borderColor: 'rgba(58, 150, 221, 0.35)',
    borderRadius: 10,
    padding: 12,
    gap: 8,
  },
  guideBoxMinimal: {
    borderColor: MINIMAL_UI.border,
    backgroundColor: MINIMAL_UI.background,
  },
  guideTitle: {
    color: '#3A96DD',
    fontSize: 13,
    fontWeight: '800',
  },
  guideTitleMinimal: {
    color: MINIMAL_UI.blueDark,
  },
  guideIntro: {
    color: 'rgba(226, 232, 240, 0.9)',
    fontSize: 12,
    lineHeight: 17,
  },
  guideIntroMinimal: {
    color: MINIMAL_UI.textMuted,
  },
  guideStep: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
  },
  guideDay: {
    color: '#FCD34D',
    fontSize: 12,
    fontWeight: '800',
    width: 36,
    paddingTop: 1,
  },
  guideDayMinimal: {
    color: MINIMAL_UI.blueDark,
  },
  guideStepBody: {
    flex: 1,
    gap: 1,
  },
  guideStepTitle: {
    color: '#E2E8F0',
    fontSize: 13,
    fontWeight: '700',
  },
  guideStepTitleMinimal: {
    color: MINIMAL_UI.text,
  },
  guideStepDetail: {
    color: 'rgba(226, 232, 240, 0.82)',
    fontSize: 12,
    lineHeight: 16,
  },
  guideStepDetailMinimal: {
    color: MINIMAL_UI.textMuted,
  },
  receptionButton: {
    marginTop: 4,
    alignSelf: 'flex-start',
    borderRadius: 8,
    backgroundColor: '#1D4ED8',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  receptionButtonMinimal: {
    backgroundColor: MINIMAL_UI.background,
    borderWidth: 1,
    borderColor: MINIMAL_UI.blueDark,
  },
  receptionButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  receptionButtonTextMinimal: {
    color: MINIMAL_UI.blueDark,
  },
  blockTitle: {
    color: '#3A96DD',
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginTop: 6,
  },
  blockTitleMinimal: {
    color: MINIMAL_UI.textMuted,
  },
  emptyText: {
    color: 'rgba(226, 232, 240, 0.8)',
    fontSize: 13,
    lineHeight: 19,
    paddingVertical: 8,
  },
  emptyTextMinimal: {
    color: MINIMAL_UI.textMuted,
  },
  taskCard: {
    borderWidth: 1,
    borderColor: 'rgba(58, 150, 221, 0.35)',
    borderRadius: 10,
    padding: 12,
    gap: 4,
  },
  taskCardMinimal: {
    borderColor: MINIMAL_UI.border,
    backgroundColor: MINIMAL_UI.background,
  },
  taskName: {
    color: '#3A96DD',
    fontSize: 15,
    fontWeight: '800',
  },
  taskNameMinimal: {
    color: MINIMAL_UI.blueDark,
  },
  taskMeta: {
    color: 'rgba(226, 232, 240, 0.82)',
    fontSize: 12,
    fontWeight: '600',
  },
  taskMetaMinimal: {
    color: MINIMAL_UI.textMuted,
  },
  taskDesc: {
    color: '#E2E8F0',
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4,
  },
  taskDescMinimal: {
    color: MINIMAL_UI.text,
  },
  taskActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  whatsappButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  whatsappButtonMinimal: {
    borderWidth: 1,
    borderColor: MINIMAL_UI.border,
    borderRadius: 999,
  },
  whatsappLabel: {
    color: '#4ADE80',
    fontSize: 13,
    fontWeight: '700',
  },
  whatsappLabelMinimal: {
    color: '#15803D',
  },
  whatsappButtonDisabled: {
    opacity: 0.45,
  },
  whatsappLabelDisabled: {
    color: '#94A3B8',
  },
  doneButton: {
    marginLeft: 'auto',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#1D4ED8',
    minWidth: 88,
    alignItems: 'center',
  },
  doneButtonMinimal: {
    backgroundColor: MINIMAL_UI.background,
    borderWidth: 1,
    borderColor: MINIMAL_UI.blueDark,
  },
  doneButtonText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '700',
  },
  doneButtonTextMinimal: {
    color: MINIMAL_UI.blueDark,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  stepRowText: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  stepLabel: {
    color: '#E2E8F0',
    fontSize: 12,
    fontWeight: '700',
  },
  stepLabelMinimal: {
    color: MINIMAL_UI.text,
  },
  stepStatus: {
    color: 'rgba(226, 232, 240, 0.75)',
    fontSize: 11,
    fontWeight: '600',
  },
  stepStatusMinimal: {
    color: MINIMAL_UI.textMuted,
  },
  stepStatusDone: {
    color: '#16A34A',
  },
  stepStatusDue: {
    color: '#B45309',
  },
  stepActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  stepComplete: {
    color: '#93C5FD',
    fontSize: 12,
    fontWeight: '800',
  },
  stepCompleteMinimal: {
    color: MINIMAL_UI.blueDark,
  },
});
