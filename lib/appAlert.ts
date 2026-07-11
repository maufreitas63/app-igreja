import { requestConfirmDialog } from '@/lib/confirmDialogHost';
import {
  copyExecutionErrorToClipboard,
  looksLikeExecutionError,
  withCopiedErrorHint,
} from '@/lib/errorClipboard';
import { Alert, Platform } from 'react-native';

/** Alerta com um botão — na web usa o mesmo modal do ConfirmDialogHost. */
export function appAlert(title: string, message: string, okLabel = 'OK') {
  const shouldCopy = looksLikeExecutionError(title, message);
  const displayMessage = shouldCopy ? withCopiedErrorHint(message) ?? message : message;

  if (shouldCopy) {
    void copyExecutionErrorToClipboard({
      title,
      message,
      type: 'app-alert-error',
    });
  }

  if (Platform.OS === 'web') {
    return requestConfirmDialog({
      title,
      message: displayMessage,
      confirmLabel: okLabel,
      cancelLabel: 'Cancelar',
      alertOnly: true,
    }).then(() => undefined);
  }

  return new Promise<void>((resolve) => {
    Alert.alert(title, displayMessage, [{ text: okLabel, onPress: () => resolve() }], {
      cancelable: true,
      onDismiss: () => resolve(),
    });
  });
}

/** Alerta de erro de execução — sempre copia para a área de transferência. */
export function appErrorAlert(title: string, message: string, okLabel = 'OK') {
  void copyExecutionErrorToClipboard({
    title,
    message,
    type: 'app-error-alert',
  });

  const displayMessage = withCopiedErrorHint(message) ?? message;

  if (Platform.OS === 'web') {
    return requestConfirmDialog({
      title,
      message: displayMessage,
      confirmLabel: okLabel,
      cancelLabel: 'Cancelar',
      alertOnly: true,
    }).then(() => undefined);
  }

  return new Promise<void>((resolve) => {
    Alert.alert(title, displayMessage, [{ text: okLabel, onPress: () => resolve() }], {
      cancelable: true,
      onDismiss: () => resolve(),
    });
  });
}
