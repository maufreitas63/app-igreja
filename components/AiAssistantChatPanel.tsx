import { useAiChat } from '@/hooks/useAiChat';
import { useKeyboardOverlap } from '@/hooks/useKeyboardOverlap';
import { ABIGAIL_NAME } from '@/lib/abigailPersona';
import { CLOSE_FOOTER_DOCK_HEIGHT } from '@/components/minimal/CloseFooterBar';
import { MINIMAL_UI } from '@/lib/minimalUiTheme';
import * as Clipboard from 'expo-clipboard';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

const ACCENT = MINIMAL_UI.accent;
const FLOAT_COMPOSER = Platform.OS === 'web';

export function AiAssistantChatPanel() {
  const { messages, draft, setDraft, streaming, error, sendMessage, clearConversation } = useAiChat();
  const scrollRef = useRef<ScrollView>(null);
  const overlap = useKeyboardOverlap();
  const [dockHeight, setDockHeight] = useState(96);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const dockBottom = overlap > 12 ? overlap : CLOSE_FOOTER_DOCK_HEIGHT;

  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [messages, streaming, overlap]);

  const keepViewportStill = () => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') {
      return;
    }

    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  };

  const copyMessage = async (id: string, content: string) => {
    const text = content.trim();

    if (!text) {
      return;
    }

    try {
      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        await Clipboard.setStringAsync(text);
      }
    } catch {
      await Clipboard.setStringAsync(text);
    }

    setCopiedId(id);
  };

  const composer = (
    <>
      <View style={styles.composerRow}>
        <TextInput
          style={styles.input}
          placeholder={`Pergunte à ${ABIGAIL_NAME}...`}
          placeholderTextColor={MINIMAL_UI.textMuted}
          value={draft}
          onChangeText={setDraft}
          editable={!streaming}
          multiline
          maxLength={2000}
          onFocus={keepViewportStill}
          scrollEnabled
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
        disabled={streaming || messages.every((message) => message.localOnly)}
      >
        <Text style={styles.secondaryButtonText}>Limpar conversa</Text>
      </TouchableOpacity>
    </>
  );

  const body = (
    <>
      <Text style={styles.helpText}>
        {ABIGAIL_NAME} ajuda a liderança com a gestão da instância. Não substitui aconselhamento
        pastoral confidencial.
      </Text>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={styles.chatContent}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="none"
        showsVerticalScrollIndicator={false}
      >
        {messages.map((message) => (
          <View
            key={message.id}
            style={[
              styles.messageBubble,
              message.role === 'user' ? styles.userBubble : styles.assistantBubble,
            ]}
          >
            <View style={styles.messageHead}>
              <Text style={styles.messageRole}>
                {message.role === 'user' ? 'Você' : ABIGAIL_NAME}
              </Text>
              {message.role === 'assistant' && message.content.trim() ? (
                <Pressable
                  onPress={() => void copyMessage(message.id, message.content)}
                  accessibilityRole="button"
                  accessibilityLabel="Copiar resposta"
                  style={styles.copyButton}
                >
                  <Text style={styles.copyText}>{copiedId === message.id ? 'Copiado' : 'Copiar'}</Text>
                </Pressable>
              ) : null}
            </View>
            <Text selectable style={styles.messageText}>
              {message.content}
              {message.role === 'assistant' && streaming && !message.content ? '…' : ''}
            </Text>
          </View>
        ))}
      </ScrollView>

      {FLOAT_COMPOSER ? (
        <>
          <View style={{ height: dockHeight, pointerEvents: 'none' }} />
          <View
            onLayout={(event) => setDockHeight(event.nativeEvent.layout.height)}
            style={[styles.composerDock, { bottom: dockBottom }]}
          >
            {composer}
          </View>
        </>
      ) : (
        <View style={styles.composerDockFlow}>{composer}</View>
      )}
    </>
  );

  if (Platform.OS === 'ios') {
    return (
      <KeyboardAvoidingView style={styles.panel} behavior="padding">
        {body}
      </KeyboardAvoidingView>
    );
  }

  return <View style={styles.panel}>{body}</View>;
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
    flexShrink: 0,
  },
  errorText: {
    color: '#B91C1C',
    fontSize: 13,
    marginBottom: 8,
    flexShrink: 0,
  },
  scroll: {
    flex: 1,
    minHeight: 0,
  },
  chatContent: {
    gap: 8,
    paddingBottom: 24,
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
  messageHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  messageRole: {
    color: MINIMAL_UI.textMuted,
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    flexShrink: 1,
  },
  messageText: {
    color: MINIMAL_UI.text,
    fontSize: 14,
    lineHeight: 20,
    ...(Platform.OS === 'web' ? { userSelect: 'text' as const } : null),
  },
  copyButton: {
    borderWidth: 1,
    borderColor: MINIMAL_UI.accent,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    minHeight: 28,
    minWidth: 72,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copyText: {
    color: MINIMAL_UI.accent,
    fontSize: 12,
    fontWeight: '800',
  },
  composerDock: {
    position: Platform.OS === 'web' ? 'fixed' : 'absolute',
    left: 16,
    right: 16,
    zIndex: 50,
    backgroundColor: MINIMAL_UI.background,
    paddingTop: 8,
    paddingBottom: 4,
  },
  composerDockFlow: {
    backgroundColor: MINIMAL_UI.background,
    paddingTop: 8,
  },
  composerRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
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
