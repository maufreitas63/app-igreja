import { useEffect } from 'react';
import { Platform } from 'react-native';

export const DEFAULT_WEB_DOCUMENT_TITLE = 'Comunidade Digital';

export function useWebDocumentTitle(title: string | null | undefined) {
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') {
      return;
    }

    const previousTitle = document.title;
    document.title = title?.trim() ? title.trim() : DEFAULT_WEB_DOCUMENT_TITLE;

    return () => {
      document.title = previousTitle;
    };
  }, [title]);
}
