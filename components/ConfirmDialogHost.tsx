import { settleConfirmDialog, subscribeConfirmDialogHost, type ConfirmDialogRequest } from '@/lib/confirmDialogHost';
import React, { useEffect, useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

export function ConfirmDialogHost() {
  const [request, setRequest] = useState<ConfirmDialogRequest | null>(null);

  useEffect(() => {
    if (Platform.OS !== 'web') {
      return;
    }

    return subscribeConfirmDialogHost(setRequest);
  }, []);

  if (Platform.OS !== 'web' || !request) {
    return null;
  }

  const close = (confirmed: boolean) => {
    settleConfirmDialog(confirmed);
  };

  const dismiss = () => {
    close(request.alertOnly ? true : false);
  };

  return (
    <Modal transparent visible animationType="fade" onRequestClose={dismiss}>
      <View style={styles.modalRoot}>
      <Pressable style={styles.backdrop} onPress={dismiss}>
        <Pressable style={styles.card} onPress={(event) => event.stopPropagation()}>
          <Text style={styles.message}>{request.message}</Text>
          <View style={[styles.actions, request.alertOnly && styles.actionsSingle]}>
            {request.alertOnly ? null : (
              <Pressable
                style={({ pressed }) => [styles.button, styles.cancelButton, pressed && styles.buttonPressed]}
                onPress={() => close(false)}
              >
                <Text style={styles.cancelButtonText}>{request.cancelLabel}</Text>
              </Pressable>
            )}
            <Pressable
              style={({ pressed }) => [
                styles.button,
                request.destructive ? styles.destructiveButton : styles.confirmButton,
                pressed && styles.buttonPressed,
              ]}
              onPress={() => close(true)}
            >
              <Text
                style={request.destructive ? styles.destructiveButtonText : styles.confirmButtonText}
              >
                {request.confirmLabel}
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalRoot: Platform.select({
    web: {
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 999998,
    },
    default: {
      flex: 1,
    },
  }),
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.72)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#1E293B',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(129, 140, 248, 0.35)',
    padding: 20,
    gap: 20,
  },
  message: {
    color: '#F8FAFC',
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
  },
  actionsSingle: {
    justifyContent: 'center',
  },
  button: {
    flex: 1,
    minHeight: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  buttonPressed: {
    opacity: 0.85,
  },
  cancelButton: {
    backgroundColor: 'rgba(51, 65, 85, 0.9)',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.35)',
  },
  cancelButtonText: {
    color: '#E2E8F0',
    fontSize: 15,
    fontWeight: '600',
  },
  confirmButton: {
    backgroundColor: 'rgba(79, 70, 229, 0.9)',
    borderWidth: 1,
    borderColor: 'rgba(129, 140, 248, 0.5)',
  },
  confirmButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  destructiveButton: {
    backgroundColor: 'rgba(220, 38, 38, 0.9)',
    borderWidth: 1,
    borderColor: 'rgba(248, 113, 113, 0.45)',
  },
  destructiveButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
