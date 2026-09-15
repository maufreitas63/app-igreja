import { useAiChat } from '@/hooks/useAiChat';
import { MINIMAL_UI } from '@/lib/minimalUiTheme';
import React, { useEffect, useRef } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

const ACCENT = MINIMAL_UI.accent;

export function AiAssistantChatPanel() {
  const { messages, draft, setDraft, streaming, error, sendMessage, clearConversation } = useAiChat();
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [messages, streaming]);

  return (
    <KeyboardAvoidingView
      style={styles.panel}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Text style={styles.helpText}>
        Assistente de Gestão da Igreja. Pergunte sobre organização, eventos, comunicação ou
        liderança. Não substitui aconselhamento pastoral confidencial.
      </Text>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={styles.chatContent}
        keyboardShouldPersistTaps="handled"
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
                {message.role === 'assistant' && streaming && !message.content ? '…' : ''}
              </Text>
            </View>
          ))
        )}
      </ScrollView>

      <View style={styles.composerRow}>
        <TextInput
          style={styles.input}
          placeholder="Digite sua pergunta..."
          placeholderTextColor={MINIMAL_UI.textMuted}
          value={draft}
          onChangeText={setDraft}
          editable={!streaming}
          multiline
          maxLength={2000}
        />
        <TouchableOpacity
          style={[styles.sendButton, (streaming || !draft.trim()) && styles.sendButtonDisabled]}
          onPress={() => void sendMessage()}
          disabled={streaming || !draft.trim()}
          accessibilityRole="button"
          accessibilityLabel="Enviar pergunta"
        >
          {streaming ? (
            <ActivityIndicator size="small" color={ACCENT} />
          ) : (
            <Text style={styles.sendButtonText}>Enviar</Text>
          )}
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={styles.secondaryButton}
        onPress={clearConversation}
        disabled={streaming || messages.length === 0}
      >
        <Text style={styles.secondaryButtonText}>Limpar conversa</Text>
      </TouchableOpacity>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  panel: {
    flex: 1,
    minHeight: 0,
  },
  helpText: {
    color: MINIMAL_UI.textMuted,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 8,
  },
  metaText: {
    color: MINIMAL_UI.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
  errorText: {
    color: '#B91C1C',
    fontSize: 13,
    marginBottom: 8,
  },
  scroll: {
    flex: 1,
    minHeight: 0,
  },
  chatContent: {
    gap: 8,
    paddingBottom: 8,
    flexGrow: 1,
  },
  messageBubble: {
    borderRadius: 10,
    padding: 10,
    gap: 4,
  },
  userBubble: {
    alignSelf: 'flex-end',
    maxWidth: '92%',
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: MINIMAL_UI.border,
  },
  assistantBubble: {
    alignSelf: 'flex-start',
    maxWidth: '96%',
    backgroundColor: MINIMAL_UI.rowHover,
    borderWidth: 1,
    borderColor: MINIMAL_UI.divider,
  },
  messageRole: {
    color: MINIMAL_UI.textMuted,
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  messageText: {
    color: MINIMAL_UI.text,
    fontSize: 14,
    lineHeight: 20,
  },
  composerRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    marginTop: 8,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    borderWidth: 1,
    borderColor: MINIMAL_UI.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: MINIMAL_UI.text,
    backgroundColor: MINIMAL_UI.background,
    fontSize: 14,
  },
  sendButton: {
    borderRadius: 10,
    backgroundColor: MINIMAL_UI.accent,
    minWidth: 72,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  sendButtonDisabled: {
    opacity: 0.55,
  },
  sendButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  secondaryButton: {
    alignSelf: 'flex-start',
    marginTop: 8,
    paddingVertical: 6,
  },
  secondaryButtonText: {
    color: MINIMAL_UI.accent,
    fontSize: 13,
    fontWeight: '700',
  },
});
