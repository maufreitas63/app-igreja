export type ConfirmDialogRequest = {
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  destructive?: boolean;
  alertOnly?: boolean;
  resolve: (confirmed: boolean) => void;
};

type ConfirmDialogListener = (request: ConfirmDialogRequest | null) => void;

let listener: ConfirmDialogListener | null = null;
let pending: ConfirmDialogRequest | null = null;

export function subscribeConfirmDialogHost(next: ConfirmDialogListener) {
  listener = next;
  next(pending);
  return () => {
    if (listener === next) {
      listener = null;
    }
  };
}

export function requestConfirmDialog(options: {
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  alertOnly?: boolean;
}): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    if (pending) {
      pending.resolve(false);
    }

    pending = {
      message: options.message,
      confirmLabel: options.confirmLabel ?? 'Confirmar',
      cancelLabel: options.cancelLabel ?? 'Não',
      destructive: options.destructive,
      alertOnly: options.alertOnly,
      resolve,
    };

    listener?.(pending);
  });
}

export function settleConfirmDialog(confirmed: boolean) {
  if (!pending) {
    return;
  }

  pending.resolve(confirmed);
  pending = null;
  listener?.(null);
}
