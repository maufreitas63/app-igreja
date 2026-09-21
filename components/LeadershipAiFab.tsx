import { AiAssistantChatPanel } from '@/components/AiAssistantChatPanel';
import { CloseFooterBar } from '@/components/minimal/CloseFooterBar';
import { useSessionCanUseAiAssistant } from '@/hooks/useSessionIsLeadership';
import { ABIGAIL_NAME } from '@/lib/abigailPersona';
import { sessionCanUseAiAssistant } from '@/lib/aiLeadershipAccess';
import { boxShadowStyle } from '@/lib/boxShadow';
import { MINIMAL_ICON, MINIMAL_UI } from '@/lib/minimalUiTheme';
import { FontAwesome } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const FAB_SIZE = 56;
const FAB_INLINE_SIZE = 40;

type Props = {
  /** `inline` alinha o botão na linha do título (Eu quero…). */
  variant?: 'overlay' | 'inline';
};

export function LeadershipAiFab({ variant = 'overlay' }: Props) {
  const { allowed, refresh } = useSessionCanUseAiAssistant();
  const [open, setOpen] = useState(false);
  const [chatKey, setChatKey] = useState(0);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh])
  );

  const handleOpen = async () => {
    const canOpen = await sessionCanUseAiAssistant();

    if (!canOpen) {
      setOpen(false);
      void refresh();
      return;
    }

    setChatKey((current) => current + 1);
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
  };

  useEffect(() => {
    if (Platform.OS !== 'web' || !open || typeof document === 'undefined') {
      return;
    }

    const html = document.documentElement;
    const body = document.body;
    const previousHtmlOverflow = html.style.overflow;
    const previousBodyOverflow = body.style.overflow;
    const previousHtmlOverscroll = html.style.overscrollBehavior;
    html.style.overflow = 'hidden';
    body.style.overflow = 'hidden';
    html.style.overscrollBehavior = 'none';
    window.scrollTo(0, 0);

    return () => {
      html.style.overflow = previousHtmlOverflow;
      body.style.overflow = previousBodyOverflow;
      html.style.overscrollBehavior = previousHtmlOverscroll;
    };
  }, [open]);

  if (!allowed) {
    return null;
  }

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Abrir ${ABIGAIL_NAME}`}
        onPress={() => void handleOpen()}
        style={({ pressed }) => [
          variant === 'inline' ? styles.fabInline : styles.fab,
          pressed && styles.fabPressed,
        ]}
      >
        <FontAwesome
          name="comments"
          size={variant === 'inline' ? 18 : MINIMAL_ICON.menu}
          color="#FFFFFF"
        />
      </Pressable>

      <Modal animationType="slide" visible={open} onRequestClose={handleClose}>
        <SafeAreaView style={styles.modalSafe} edges={['top', 'left', 'right']}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{ABIGAIL_NAME}</Text>
            <Text style={styles.modalHint}>Assistente da liderança</Text>
          </View>
          <View style={styles.modalBody}>
            {open ? <AiAssistantChatPanel key={chatKey} /> : null}
          </View>
          <CloseFooterBar onPress={handleClose} accessibilityLabel={`Fechar ${ABIGAIL_NAME}`} />
        </SafeAreaView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: 8,
    bottom: 12,
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: FAB_SIZE / 2,
    backgroundColor: MINIMAL_UI.blueDark,
    alignItems: 'center',
    justifyContent: 'center',
    ...boxShadowStyle({
      color: '#00008B',
      offsetY: 3,
      blurRadius: 8,
      opacity: 0.28,
      elevation: 6,
    }),
    zIndex: 40,
  },
  fabInline: {
    width: FAB_INLINE_SIZE,
    height: FAB_INLINE_SIZE,
    borderRadius: FAB_INLINE_SIZE / 2,
    backgroundColor: MINIMAL_UI.blueDark,
    alignItems: 'center',
    justifyContent: 'center',
    ...boxShadowStyle({
      color: '#00008B',
      offsetY: 2,
      blurRadius: 6,
      opacity: 0.22,
      elevation: 4,
    }),
    flexShrink: 0,
  },
  fabPressed: {
    opacity: 0.85,
  },
  modalSafe: {
    flex: 1,
    backgroundColor: MINIMAL_UI.background,
  },
  modalHeader: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: MINIMAL_UI.divider,
    gap: 2,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: MINIMAL_UI.text,
  },
  modalHint: {
    fontSize: 12,
    color: MINIMAL_UI.textMuted,
  },
  modalBody: {
    flex: 1,
    minHeight: 0,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
});
