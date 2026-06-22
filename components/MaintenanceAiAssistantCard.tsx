import { CardLoadingState } from '@/components/ui/CardLoadingState';
import { SectionLabel } from '@/components/ui/SectionLabel';
import { useAiChat } from '@/hooks/useAiChat';
import { AI_CHAT_SQL_HINT } from '@/lib/aiChatApi';
import { fetchAiAuditLogs, type AiAuditLogRow } from '@/lib/aiAuditLogsApi';
import {
  fetchGeminiApiKeyConfigured,
  GEMINI_KEY_SETUP_HINT,
  saveGeminiApiKeyAdmin,
} from '@/lib/aiServerConfigApi';
import { computeMaintenanceContentHeight, maintenancePanelStyles } from '@/lib/maintenanceCardStyles';
import { sessionHasAccess } from '@/lib/accessControl';
import { resolveActorProfileId } from '@/lib/maintenanceAccessControlApi';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Toast from 'react-native-toast-message';

type Props = {
  isActive?: boolean;
  panelHeight: number;
};

const ACCENT = '#A78BFA';

const formatAuditTimestamp = (value: string) => {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '—';
  }

  return date.toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export function MaintenanceAiAssistantCard({ isActive = true, panelHeight }: Props) {
  const contentHeight = computeMaintenanceContentHeight(panelHeight);
  const { messages, draft, setDraft, streaming, error, sendMessage, clearConversation } = useAiChat();
  const [canUseAssistant, setCanUseAssistant] = useState<boolean | null>(null);
  const [canViewAudit, setCanViewAudit] = useState(false);
  const [activeTab, setActiveTab] = useState<'chat' | 'audit' | 'config'>('chat');
  const [auditLogs, setAuditLogs] = useState<AiAuditLogRow[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditError, setAuditError] = useState<string | null>(null);
  const [geminiKeyDraft, setGeminiKeyDraft] = useState('');
  const [geminiConfigured, setGeminiConfigured] = useState<boolean | null>(null);
  const [configLoading, setConfigLoading] = useState(false);
  const [configSaving, setConfigSaving] = useState(false);
  const [configError, setConfigError] = useState<string | null>(null);

  useEffect(() => {
    if (!isActive) {
      return;
    }

    let cancelled = false;

    const loadAccess = async () => {
      try {
        const [assistantAccess, auditAccess] = await Promise.all([
          sessionHasAccess('screen', 'maintenance.card.ai_assistant', 'view'),
          sessionHasAccess('screen', 'maintenance.card.ai_audit_logs', 'view'),
        ]);

        if (cancelled) {
          return;
        }

        setCanUseAssistant(assistantAccess);
        setCanViewAudit(auditAccess);

        if (!assistantAccess && auditAccess) {
          setActiveTab('config');
        }
      } catch {
        if (!cancelled) {
          setCanUseAssistant(false);
        }
      }
    };

    void loadAccess();

    return () => {
      cancelled = true;
    };
  }, [isActive]);

  const loadAuditLogs = useCallback(async () => {
    setAuditLoading(true);
    setAuditError(null);

    try {
      await resolveActorProfileId();
      const rows = await fetchAiAuditLogs(150);
      setAuditLogs(rows);
    } catch (loadError) {
      setAuditLogs([]);
      setAuditError(
        loadError instanceof Error
          ? loadError.message
          : 'Não foi possível carregar a auditoria de IA.'
      );
    } finally {
      setAuditLoading(false);
    }
  }, []);

  const loadGeminiConfigStatus = useCallback(async () => {
    setConfigLoading(true);
    setConfigError(null);

    try {
      await resolveActorProfileId();
      const configured = await fetchGeminiApiKeyConfigured();
      setGeminiConfigured(configured);
    } catch (loadError) {
      setGeminiConfigured(false);
      setConfigError(
        loadError instanceof Error
          ? loadError.message
          : 'Não foi possível verificar a configuração da chave Gemini.'
      );
    } finally {
      setConfigLoading(false);
    }
  }, []);

  const handleSaveGeminiKey = useCallback(async () => {
    setConfigSaving(true);
    setConfigError(null);

    try {
      await saveGeminiApiKeyAdmin(geminiKeyDraft);
      setGeminiKeyDraft('');
      setGeminiConfigured(true);
      Toast.show({
        type: 'success',
        text1: 'Chave Gemini salva',
        text2: 'O assistente de IA já pode ser usado pelos curadores.',
      });
    } catch (saveError) {
      setConfigError(
        saveError instanceof Error
          ? saveError.message
          : 'Não foi possível salvar a chave Gemini.'
      );
    } finally {
      setConfigSaving(false);
    }
  }, [geminiKeyDraft]);

  useEffect(() => {
    if (!isActive || !canViewAudit || activeTab !== 'audit') {
      return;
    }

    void loadAuditLogs();
  }, [activeTab, canViewAudit, isActive, loadAuditLogs]);

  useEffect(() => {
    if (!isActive || !canViewAudit || activeTab !== 'config') {
      return;
    }

    void loadGeminiConfigStatus();
  }, [activeTab, canViewAudit, isActive, loadGeminiConfigStatus]);

  if (canUseAssistant === null) {
    return (
      <View style={[styles.panel, { height: contentHeight }]}>
        <CardLoadingState lines={4} />
      </View>
    );
  }

  if (!canUseAssistant && !canViewAudit) {
    return (
      <View style={[styles.panel, { height: contentHeight }]}>
        <Text style={maintenancePanelStyles.panelTitle}>Assistente IA</Text>
        <View style={maintenancePanelStyles.panelSubtitleSpacer} />
        <Text style={styles.helpText}>
          Você não possui o papel Curador IA para usar este módulo. Solicite a atribuição em
          Controle de Acesso.
        </Text>
        <Text style={styles.metaText}>{AI_CHAT_SQL_HINT}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.panel, { height: contentHeight }]}>
      <Text style={maintenancePanelStyles.panelTitle}>Assistente IA</Text>
      <View style={maintenancePanelStyles.panelSubtitleSpacer} />

      {canViewAudit ? (
        <View style={styles.tabRow}>
          {canUseAssistant ? (
            <TouchableOpacity
              style={[styles.tabChip, activeTab === 'chat' && styles.tabChipActive]}
              onPress={() => setActiveTab('chat')}
            >
              <Text style={[styles.tabChipText, activeTab === 'chat' && styles.tabChipTextActive]}>
                Chat
              </Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity
            style={[styles.tabChip, activeTab === 'audit' && styles.tabChipActive]}
            onPress={() => setActiveTab('audit')}
          >
            <Text style={[styles.tabChipText, activeTab === 'audit' && styles.tabChipTextActive]}>
              Auditoria
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabChip, activeTab === 'config' && styles.tabChipActive]}
            onPress={() => setActiveTab('config')}
          >
            <Text style={[styles.tabChipText, activeTab === 'config' && styles.tabChipTextActive]}>
              Chave API
            </Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {activeTab === 'config' && canViewAudit ? (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.configContent}
          nestedScrollEnabled
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.helpText}>{GEMINI_KEY_SETUP_HINT}</Text>
          <Text style={styles.metaText}>
            A chave fica armazenada no Supabase da igreja (não no código do app) e só é usada pelo
            servidor ao atender curadores IA. Você pode trocá-la quando quiser.
          </Text>

          {configLoading ? <CardLoadingState lines={2} /> : null}

          {!configLoading ? (
            <View style={styles.configStatusRow}>
              <Text style={styles.configStatusLabel}>Status:</Text>
              <Text
                style={[
                  styles.configStatusValue,
                  geminiConfigured ? styles.configStatusOk : styles.configStatusMissing,
                ]}
              >
                {geminiConfigured ? 'Chave cadastrada' : 'Chave ainda não cadastrada'}
              </Text>
            </View>
          ) : null}

          {configError ? <Text style={styles.errorText}>{configError}</Text> : null}

          <SectionLabel variant="maintenance">Chave da API Gemini (conta da igreja)</SectionLabel>
          <TextInput
            style={styles.input}
            placeholder="Cole a chave AIza… criada no Google AI Studio"
            placeholderTextColor="#64748B"
            value={geminiKeyDraft}
            onChangeText={setGeminiKeyDraft}
            editable={!configSaving}
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry
            maxLength={256}
          />

          <View style={styles.toolbarRow}>
            <TouchableOpacity
              style={[styles.sendButton, (configSaving || !geminiKeyDraft.trim()) && styles.sendButtonDisabled]}
              onPress={() => void handleSaveGeminiKey()}
              disabled={configSaving || !geminiKeyDraft.trim()}
            >
              {configSaving ? (
                <ActivityIndicator size="small" color={ACCENT} />
              ) : (
                <Text style={styles.sendButtonText}>Salvar chave</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => void loadGeminiConfigStatus()}
              disabled={configLoading || configSaving}
            >
              <Text style={styles.secondaryButtonText}>Atualizar status</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      ) : activeTab === 'audit' && canViewAudit ? (
        <>
          <View style={styles.toolbarRow}>
            <TouchableOpacity style={styles.secondaryButton} onPress={() => void loadAuditLogs()}>
              <Text style={styles.secondaryButtonText}>Atualizar histórico</Text>
            </TouchableOpacity>
          </View>
          {auditError ? <Text style={styles.errorText}>{auditError}</Text> : null}
          {auditLoading ? <CardLoadingState lines={5} /> : null}
          {!auditLoading ? (
            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.auditContent}
              nestedScrollEnabled
              showsVerticalScrollIndicator={false}
            >
              {auditLogs.length === 0 ? (
                <Text style={styles.metaText}>Nenhuma interação registrada ainda.</Text>
              ) : (
                auditLogs.map((log) => (
                  <View key={log.id} style={styles.auditCard}>
                    <Text style={styles.auditMeta}>
                      {formatAuditTimestamp(log.createdAt)} · {log.userName} · {log.roleAtTime}
                    </Text>
                    <SectionLabel variant="maintenance">Pergunta</SectionLabel>
                    <Text style={styles.auditQuestion}>{log.question}</Text>
                    <SectionLabel variant="maintenance">Resposta</SectionLabel>
                    <Text style={styles.auditAnswer}>{log.aiResponse}</Text>
                  </View>
                ))
              )}
            </ScrollView>
          ) : null}
        </>
      ) : (
        <>
          <Text style={styles.helpText}>
            Assistente de Gestão da Igreja (Gemini). Respostas em tempo real; cada consulta é
            registrada para auditoria.
          </Text>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.chatContent}
            nestedScrollEnabled
            showsVerticalScrollIndicator={false}
          >
            {messages.length === 0 ? (
              <Text style={styles.metaText}>
                Faça uma pergunta sobre gestão, eventos, comunicação ou organização da igreja.
              </Text>
            ) : (
              messages.map((message) => (
                <View
                  key={message.id}
                  style={[
                    styles.messageBubble,
                    message.role === 'user' ? styles.userBubble : styles.assistantBubble,
                  ]}
                >
                  <Text style={styles.messageRole}>
                    {message.role === 'user' ? 'Você' : 'Assistente'}
                  </Text>
                  <Text style={styles.messageText}>
                    {message.content}
                    {message.role === 'assistant' && streaming && !message.content
                      ? '…'
                      : ''}
                  </Text>
                </View>
              ))
            )}
          </ScrollView>

          <View style={styles.composerRow}>
            <TextInput
              style={styles.input}
              placeholder="Digite sua pergunta..."
              placeholderTextColor="#64748B"
              value={draft}
              onChangeText={setDraft}
              editable={!streaming}
              multiline
              maxLength={2000}
              onSubmitEditing={() => void sendMessage()}
            />
            <TouchableOpacity
              style={[styles.sendButton, streaming && styles.sendButtonDisabled]}
              onPress={() => void sendMessage()}
              disabled={streaming || !draft.trim()}
            >
              <Text style={styles.sendButtonText}>{streaming ? '...' : 'Enviar'}</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={clearConversation}
            disabled={streaming || messages.length === 0}
          >
            <Text style={styles.secondaryButtonText}>Limpar conversa</Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    flex: 1,
    minHeight: 0,
  },
  helpText: {
    color: '#94A3B8',
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 8,
  },
  metaText: {
    color: '#94A3B8',
    fontSize: 11,
    lineHeight: 15,
  },
  errorText: {
    color: '#FCA5A5',
    fontSize: 12,
    marginBottom: 8,
  },
  tabRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  tabChip: {
    borderWidth: 1,
    borderColor: 'rgba(167, 139, 250, 0.35)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  tabChipActive: {
    backgroundColor: 'rgba(167, 139, 250, 0.18)',
    borderColor: ACCENT,
  },
  tabChipText: {
    color: '#CBD5E1',
    fontSize: 12,
    fontWeight: '700',
  },
  tabChipTextActive: {
    color: ACCENT,
  },
  toolbarRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  scroll: {
    flex: 1,
    minHeight: 0,
  },
  chatContent: {
    gap: 8,
    paddingBottom: 8,
  },
  auditContent: {
    gap: 10,
    paddingBottom: 12,
  },
  configContent: {
    gap: 10,
    paddingBottom: 12,
  },
  configStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  configStatusLabel: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '700',
  },
  configStatusValue: {
    fontSize: 12,
    fontWeight: '800',
  },
  configStatusOk: {
    color: '#86EFAC',
  },
  configStatusMissing: {
    color: '#FCD34D',
  },
  messageBubble: {
    borderRadius: 10,
    padding: 10,
    gap: 4,
  },
  userBubble: {
    alignSelf: 'flex-end',
    maxWidth: '92%',
    backgroundColor: 'rgba(167, 139, 250, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(167, 139, 250, 0.35)',
  },
  assistantBubble: {
    alignSelf: 'flex-start',
    maxWidth: '96%',
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.2)',
  },
  messageRole: {
    color: '#CBD5E1',
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  messageText: {
    color: '#F8FAFC',
    fontSize: 13,
    lineHeight: 18,
  },
  composerRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    marginTop: 8,
  },
  input: {
    flex: 1,
    minHeight: 42,
    maxHeight: 120,
    borderWidth: 1,
    borderColor: 'rgba(167, 139, 250, 0.35)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#F8FAFC',
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    fontSize: 13,
  },
  sendButton: {
    borderRadius: 10,
    backgroundColor: 'rgba(167, 139, 250, 0.28)',
    borderWidth: 1,
    borderColor: ACCENT,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  sendButtonDisabled: {
    opacity: 0.6,
  },
  sendButtonText: {
    color: ACCENT,
    fontSize: 12,
    fontWeight: '800',
  },
  secondaryButton: {
    alignSelf: 'flex-start',
    marginTop: 8,
    borderWidth: 1,
    borderColor: 'rgba(167, 139, 250, 0.35)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  secondaryButtonText: {
    color: ACCENT,
    fontSize: 12,
    fontWeight: '700',
  },
  auditCard: {
    borderWidth: 1,
    borderColor: 'rgba(167, 139, 250, 0.25)',
    borderRadius: 10,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    padding: 10,
    gap: 4,
  },
  auditMeta: {
    color: '#CBD5E1',
    fontSize: 10,
    lineHeight: 14,
    marginBottom: 4,
  },
  auditQuestion: {
    color: '#E2E8F0',
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 6,
  },
  auditAnswer: {
    color: '#F8FAFC',
    fontSize: 12,
    lineHeight: 17,
  },
});
