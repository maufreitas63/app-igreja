import {
  copyExecutionErrorToClipboard,
  looksLikeExecutionError,
  withCopiedErrorHint,
} from '@/lib/errorClipboard';
import Toast, { type ToastShowParams } from 'react-native-toast-message';
import { Alert, type AlertButton, type AlertOptions } from 'react-native';

type AppToastOptions = {
  afterMs?: number;
};

let globalErrorClipboardInstalled = false;

/**
 * Intercepta Toast.show (type=error) e Alert.alert (títulos/mensagens de falha)
 * para copiar o erro automaticamente — apenas super administrador.
 */
export function installExecutionErrorClipboard(): void {
  if (globalErrorClipboardInstalled) {
    return;
  }
  globalErrorClipboardInstalled = true;

  const originalToastShow = Toast.show.bind(Toast);
  Toast.show = ((params: ToastShowParams) => {
    if (params?.type === 'error') {
      const title = typeof params.text1 === 'string' ? params.text1 : null;
      const message = typeof params.text2 === 'string' ? params.text2 : null;
      void (async () => {
        const copied = await copyExecutionErrorToClipboard({
          title,
          message,
          type: 'toast-error',
        });
        originalToastShow({
          ...params,
          text2: copied ? withCopiedErrorHint(message) : message ?? undefined,
        });
      })();
      return;
    }
    return originalToastShow(params);
  }) as typeof Toast.show;

  const originalAlert = Alert.alert.bind(Alert);
  Alert.alert = ((
    title: string,
    message?: string,
    buttons?: AlertButton[],
    options?: AlertOptions
  ) => {
    if (!looksLikeExecutionError(title, message)) {
      return originalAlert(title, message, buttons, options);
    }

    void (async () => {
      const copied = await copyExecutionErrorToClipboard({
        title,
        message,
        type: 'alert-error',
      });
      const displayMessage = copied ? withCopiedErrorHint(message) : message;
      originalAlert(title, displayMessage, buttons, options);
    })();
  }) as typeof Alert.alert;
}

export function showAppToast(params: ToastShowParams, options?: AppToastOptions): void {
  const visibilityTime =
    params.visibilityTime ??
    (params.type === 'error' ? 4500 : params.type === 'info' ? 3000 : 2800);

  const show = () => {
    Toast.show({
      ...params,
      visibilityTime,
    });
  };

  const afterMs = options?.afterMs ?? 0;

  if (afterMs > 0) {
    setTimeout(show, afterMs);
    return;
  }

  show();
}
