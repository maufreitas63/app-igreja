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
import {
  formatVisitorFollowupDate,
  VISITOR_FOLLOWUP_TASK_LABEL,
  type VisitorFollowupTask,
} from '@/lib/visitorFollowupApi';
import { openWhatsAppLikeBirthdaysWithText } from '@/lib/whatsapp';
import { FontAwesome, MaterialIcons } from '@expo/vector-icons';
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

export function MaintenanceVisitorFollowupCard({
  isActive = true,
  panelHeight,
  minimal = false,
}: Props) {
  const { tasks, loading, error, completingId, refetch, completeTask } =
    useWelcomeVisitorFollowup(isActive);
  const contentHeight = computeMaintenanceContentHeight(panelHeight);

  const handleWhatsApp = (task: VisitorFollowupTask) => {
    if (!task.phone) {
      Toast.show({
        type: 'error',
        text1: 'Telefone indisponível',
        text2: 'Este visitante não tem telefone cadastrado.',
      });
      return;
    }

    const opened = openWhatsAppLikeBirthdaysWithText(task.phone, task.descricao);

    if (!opened) {
      Toast.show({
        type: 'error',
        text1: 'WhatsApp',
        text2: 'Não foi possível abrir o WhatsApp deste contato.',
      });
    }
  };

  const handleComplete = async (task: VisitorFollowupTask) => {
    const confirmed = await confirmDialog(
      'Concluir tarefa',
      `Marcar como concluído o contato com ${formatShortName(task.visitorName)}?`,
      'Concluir',
      'Cancelar'
    );

    if (!confirmed) {
      return;
    }

    const result = await completeTask(task.id);
    Toast.show({
      type: result.success ? 'success' : 'error',
      text1: 'Régua de acolhimento',
      text2: result.success ? 'Tarefa concluída.' : result.message,
    });
  };

  return (
    <View style={[styles.panel, minimal && styles.panelMinimal, { height: contentHeight }]}>
      <MaintenanceHelpInfoTitle
        title="Régua de Acolhimento"
        helpText="Após a aprovação na Recepção Familiar, a equipe envia o WhatsApp no dia 1 e o convite à célula mais próxima no dia 4. Use o atalho do WhatsApp com a mensagem já pronta e marque a tarefa ao concluir o contato."
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

      {loading && !tasks.length ? (
        <CardLoadingState lines={4} compact minimal={minimal} />
      ) : (
        <ScrollView
          style={styles.list}
          contentContainerStyle={styles.listContent}
          nestedScrollEnabled
          {...MAINTENANCE_SCROLL_PROPS}
        >
          {!tasks.length ? (
            <Text style={[styles.emptyText, minimal && styles.emptyTextMinimal]}>
              Nenhuma tarefa pendente para hoje.
            </Text>
          ) : (
            tasks.map((task) => {
              const busy = completingId === task.id;

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
                      style={[styles.whatsappButton, minimal && styles.whatsappButtonMinimal]}
                      onPress={() => handleWhatsApp(task)}
                      activeOpacity={0.85}
                      accessibilityLabel="Abrir WhatsApp"
                    >
                      <FontAwesome name="whatsapp" size={18} color={minimal ? '#16A34A' : '#4ADE80'} />
                      <Text style={[styles.whatsappLabel, minimal && styles.whatsappLabelMinimal]}>
                        WhatsApp
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.doneButton, minimal && styles.doneButtonMinimal]}
                      onPress={() => void handleComplete(task)}
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
        </ScrollView>
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
  emptyText: {
    color: 'rgba(226, 232, 240, 0.8)',
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: 24,
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
});
