import * as Clipboard from 'expo-clipboard';
import { Platform } from 'react-native';

export type ClipboardTextResult =
  | { ok: true; text: string }
  | { ok: false; reason: 'denied' | 'empty' | 'unavailable' };

export function isClipboardPermissionDenied(error: unknown): boolean {
  const name = error instanceof Error ? error.name : '';
  const message = error instanceof Error ? error.message : String(error ?? '');
  return (
    name === 'NotAllowedError' ||
    /denied permission to access clipboard|clipboard.*denied|read permission denied|notallowederror/i.test(
      message
    )
  );
}

export async function readClipboardText(): Promise<ClipboardTextResult> {
  if (Platform.OS === 'web' && typeof navigator !== 'undefined') {
    try {
      const query = navigator.permissions?.query;
      if (query) {
        const status = await query.call(
          navigator.permissions,
          { name: 'clipboard-read' } as PermissionDescriptor
        );
        if (status.state === 'denied') {
          return { ok: false, reason: 'denied' };
        }
      }
    } catch {
      // Firefox/Safari: clipboard-read não existe em Permissions.
    }

    if (navigator.clipboard?.readText) {
      try {
        const text = await navigator.clipboard.readText();
        if (!text.trim()) {
          return { ok: false, reason: 'empty' };
        }
        return { ok: true, text };
      } catch (error) {
        if (isClipboardPermissionDenied(error)) {
          return { ok: false, reason: 'denied' };
        }
      }
    }
  }

  try {
    const text = await Clipboard.getStringAsync();
    if (!text.trim()) {
      return { ok: false, reason: 'empty' };
    }
    return { ok: true, text };
  } catch (error) {
    if (isClipboardPermissionDenied(error)) {
      return { ok: false, reason: 'denied' };
    }
    return { ok: false, reason: 'unavailable' };
  }
}
