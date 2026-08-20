import { settleConfirmDialog, subscribeConfirmDialogHost, type ConfirmDialogRequest } from '@/lib/confirmDialogHost';
import { MINIMAL_TYPO, MINIMAL_UI } from '@/lib/minimalUiTheme';
import React, { useEffect, useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

function DialogCopy({ request }: { request: ConfirmDialogRequest }) {
  const title = request.title?.trim() ?? '';
  const message = request.message.trim();

  if (title && message) {
    return (
      <View style={styles.copyBlock}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.message}>{message}</Text>
      </View>
    );
  }

  const primaryText = message || title;

  return <Text style={[styles.message, styles.messageStandalone]}>{primaryText}</Text>;
}

export function ConfirmDialogHost() {
  const [request, setRequest] = useState<ConfirmDialogRequest | null>(null);

  useEffect(() => {
    // Host só renderiza UI na web; no nativo confirmDialog usa Alert.
    return subscribeConfirmDialogHost((next) => {
      setRequest(next);
    });
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
        <Pressable style={styles.backdrop} onPress={dismiss} accessibilityRole="button" />
        <View style={styles.cardShell} pointerEvents="box-none">
          <View style={styles.card}>
            <DialogCopy request={request} />
            <View style={[styles.actions, request.alertOnly && styles.actionsSingle]}>
              {request.alertOnly ? null : (
                <TouchableOpacity
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  style={styles.button}
                  onPress={() => close(false)}
                >
                  <View style={[styles.buttonInner, styles.cancelButton]}>
                    <Text style={styles.cancelButtonText} pointerEvents="none">
                      {request.cancelLabel}
                    </Text>
                  </View>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                activeOpacity={0.85}
                accessibilityRole="button"
                style={styles.button}
                onPress={() => close(true)}
              >
                <View
                  style={[
                    styles.buttonInner,
                    request.destructive ? styles.destructiveButton : styles.confirmButton,
                  ]}
                >
                  <Text
                    style={request.destructive ? styles.destructiveButtonText : styles.confirmButtonText}
                    pointerEvents="none"
                  >
                    {request.confirmLabel}
                  </Text>
                </View>
              </TouchableOpacity>
            </View>
          </View>
        </View>
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
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    zIndex: 0,
  },
  cardShell: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    zIndex: 1,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: MINIMAL_UI.background,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: MINIMAL_UI.border,
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 18,
    gap: 18,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
  },
  copyBlock: {
    gap: 8,
    alignItems: 'center',
  },
  title: {
    ...MINIMAL_TYPO.screenTitle,
    color: MINIMAL_UI.blueDark,
    lineHeight: 24,
    textAlign: 'center',
  },
  message: {
    ...MINIMAL_TYPO.inboxPreview,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  messageStandalone: {
    color: MINIMAL_UI.blueDark,
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
  },
  buttonInner: {
    flex: 1,
    minHeight: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  cancelButton: {
    backgroundColor: MINIMAL_UI.background,
    borderWidth: 1,
    borderColor: MINIMAL_UI.blueDark,
  },
  cancelButtonText: {
    color: MINIMAL_UI.blueDark,
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
    width: '100%',
  },
  confirmButton: {
    backgroundColor: MINIMAL_UI.blueDark,
    borderWidth: 1,
    borderColor: MINIMAL_UI.blueDark,
  },
  confirmButtonText: {
    color: MINIMAL_UI.onDark,
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
    width: '100%',
  },
  destructiveButton: {
    backgroundColor: MINIMAL_UI.blueDark,
    borderWidth: 1,
    borderColor: MINIMAL_UI.blueDark,
  },
  destructiveButtonText: {
    color: MINIMAL_UI.onDark,
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
    width: '100%',
  },
});
