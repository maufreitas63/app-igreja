import { requestConfirmDialog } from '@/lib/confirmDialogHost';
import {
  copyExecutionErrorToClipboard,
  looksLikeExecutionError,
  withCopiedErrorHint,
} from '@/lib/errorClipboard';
import { Alert, Platform } from 'react-native';

async function presentAlert(title: string, message: string, okLabel: string) {
  if (Platform.OS === 'web') {
    await requestConfirmDialog({
      title,
      message,
      confirmLabel: okLabel,
      cancelLabel: 'Cancelar',
      alertOnly: true,
    });
    return;
  }

  await new Promise<void>((resolve) => {
    Alert.alert(title, message, [{ text: okLabel, onPress: () => resolve() }], {
      cancelable: true,
      onDismiss: () => resolve(),
    });
  });
}

/** Alerta com um botão — na web usa o mesmo modal do ConfirmDialogHost. */
export async function appAlert(title: string, message: string, okLabel = 'OK') {
  const shouldCopy = looksLikeExecutionError(title, message);
  let displayMessage = message;

  if (shouldCopy) {
    const copied = await copyExecutionErrorToClipboard({
      title,
      message,
      type: 'app-alert-error',
    });
    if (copied) {
      displayMessage = withCopiedErrorHint(message) ?? message;
    }
  }

  await presentAlert(title, displayMessage, okLabel);
}

/** Alerta de erro de execução — copia só para super administrador. */
export async function appErrorAlert(title: string, message: string, okLabel = 'OK') {
  const copied = await copyExecutionErrorToClipboard({
    title,
    message,
    type: 'app-error-alert',
  });
  const displayMessage = copied ? withCopiedErrorHint(message) ?? message : message;
  await presentAlert(title, displayMessage, okLabel);
}
