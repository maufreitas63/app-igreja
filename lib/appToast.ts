import Toast, { type ToastShowParams } from 'react-native-toast-message';

type AppToastOptions = {
  afterMs?: number;
};

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
