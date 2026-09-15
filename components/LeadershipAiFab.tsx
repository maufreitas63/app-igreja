import { AiAssistantChatPanel } from '@/components/AiAssistantChatPanel';
import { CloseFooterBar } from '@/components/minimal/CloseFooterBar';
import { useSessionCanUseAiAssistant } from '@/hooks/useSessionIsLeadership';
import { ABIGAIL_NAME } from '@/lib/abigailPersona';
import { sessionCanUseAiAssistant } from '@/lib/aiLeadershipAccess';
import { MINIMAL_ICON, MINIMAL_UI } from '@/lib/minimalUiTheme';
import { FontAwesome } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const FAB_SIZE = 56;

export function LeadershipAiFab() {
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

  if (!allowed) {
    return null;
  }

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Abrir ${ABIGAIL_NAME}`}
        onPress={() => void handleOpen()}
        style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
      >
        <FontAwesome name="comments" size={MINIMAL_ICON.menu} color="#FFFFFF" />
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
    elevation: 6,
    shadowColor: '#00008B',
    shadowOpacity: 0.28,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    zIndex: 40,
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
