import * as Clipboard from 'expo-clipboard';
import { Platform } from 'react-native';

export type ExecutionErrorClipboardInput = {
  title?: string | null;
  message?: string | null;
  /** Ex.: error | alert | exception */
  type?: string | null;
  /** Stack ou detalhe técnico opcional */
  detail?: string | null;
};

const ERROR_HINT_MARK = '· Copiado';

export function looksLikeExecutionError(
  title?: string | null,
  message?: string | null
): boolean {
  const blob = `${title ?? ''} ${message ?? ''}`.toLocaleLowerCase();
  return /erro|falha|fail|exception|denied|inv[aá]lid|n[aã]o foi poss[ií]vel|rpc|sql|timeout|network|sem permiss|bloquead|ausente|inesperado|unexpected|reject/.test(
    blob
  );
}

export function formatExecutionErrorClipboardText(
  input: ExecutionErrorClipboardInput
): string {
  const type = (input.type ?? 'error').trim() || 'error';
  const title = (input.title ?? '').trim() || 'Erro de execução';
  const message = (input.message ?? '')
    .replace(new RegExp(`\\s*${ERROR_HINT_MARK}\\s*$`), '')
    .trim();
  const detail = (input.detail ?? '').trim();

  return [
    `[${type}] ${title}`,
    message || null,
    detail || null,
    `Quando: ${new Date().toISOString()}`,
    Platform.OS ? `Plataforma: ${Platform.OS}` : null,
  ]
    .filter(Boolean)
    .join('\n');
}

export function withCopiedErrorHint(message?: string | null): string | undefined {
  const base = (message ?? '').trim();
  if (!base) {
    return ERROR_HINT_MARK;
  }
  if (base.includes(ERROR_HINT_MARK)) {
    return base;
  }
  return `${base} ${ERROR_HINT_MARK}`;
}

/** Copia o erro para a área de transferência. Falhas de clipboard são silenciosas. */
export async function copyExecutionErrorToClipboard(
  input: ExecutionErrorClipboardInput
): Promise<boolean> {
  const text = formatExecutionErrorClipboardText(input);
  if (!text.trim()) {
    return false;
  }

  try {
    await Clipboard.setStringAsync(text);
    return true;
  } catch (error) {
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch {
        console.warn('Falha ao copiar erro para a área de transferência:', error);
        return false;
      }
    }
    console.warn('Falha ao copiar erro para a área de transferência:', error);
    return false;
  }
}
