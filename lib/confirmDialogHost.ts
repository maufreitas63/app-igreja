export type ConfirmDialogRequest = {
  title?: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  destructive?: boolean;
  alertOnly?: boolean;
  onConfirmed?: () => void;
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
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  alertOnly?: boolean;
  onConfirmed?: () => void;
}): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    if (pending) {
      pending.resolve(false);
    }

    pending = {
      title: options.title?.trim() || undefined,
      message: options.message,
      confirmLabel: options.confirmLabel ?? 'Confirmar',
      cancelLabel: options.cancelLabel ?? 'Não',
      destructive: options.destructive,
      alertOnly: options.alertOnly,
      onConfirmed: options.onConfirmed,
      resolve,
    };

    listener?.(pending);
  });
}

export function settleConfirmDialog(confirmed: boolean) {
  if (!pending) {
    return;
  }

  const current = pending;
  pending = null;
  listener?.(null);

  if (confirmed && current.onConfirmed) {
    current.onConfirmed();
  }

  current.resolve(confirmed);
}
