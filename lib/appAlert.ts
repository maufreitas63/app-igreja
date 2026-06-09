import { requestConfirmDialog } from '@/lib/confirmDialogHost';
import { Alert, Platform } from 'react-native';

/** Alerta com um botão — na web usa o mesmo modal do ConfirmDialogHost. */
export function appAlert(title: string, message: string, okLabel = 'OK') {
  if (Platform.OS === 'web') {
    const text = message.trim() ? `${title}\n\n${message}` : title;
    return requestConfirmDialog({
      message: text,
      confirmLabel: okLabel,
      cancelLabel: 'Cancelar',
      alertOnly: true,
    }).then(() => undefined);
  }

  return new Promise<void>((resolve) => {
    Alert.alert(title, message, [{ text: okLabel, onPress: () => resolve() }], {
      cancelable: true,
      onDismiss: () => resolve(),
    });
  });
}
