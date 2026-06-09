import { requestConfirmDialog } from '@/lib/confirmDialogHost';
import { Alert, Platform } from 'react-native';

export function confirmDialog(
  title: string,
  message: string,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Não',
  options?: { destructive?: boolean }
) {
  if (Platform.OS === 'web') {
    const text = message.trim() || title.trim();
    return requestConfirmDialog({
      message: text,
      confirmLabel,
      cancelLabel,
      destructive: options?.destructive,
    });
  }

  return new Promise<boolean>((resolve) => {
    Alert.alert(
      title,
      message,
      [
        { text: cancelLabel, style: 'cancel', onPress: () => resolve(false) },
        {
          text: confirmLabel,
          style: options?.destructive ? 'destructive' : 'default',
          onPress: () => resolve(true),
        },
      ],
      { cancelable: true, onDismiss: () => resolve(false) }
    );
  });
}
