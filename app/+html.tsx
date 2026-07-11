import { ScrollViewStyleReset } from 'expo-router/html';
import { WEB_NON_SELECTABLE_CSS } from '@/lib/webTextSelectionGuard';
import { type PropsWithChildren } from 'react';

const PWA_THEME_COLOR = '#0f172a';
const APP_DISPLAY_NAME = 'Comunidade Digital';

/** Define o título inicial do PWA (evita fallback do Chrome para o hostname). */
const LOCK_DOCUMENT_TITLE_SCRIPT = `
(function () {
  try { document.title = ${JSON.stringify(APP_DISPLAY_NAME)}; } catch (e) {}
})();
`;

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="pt-BR">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no"
        />
        <title>{APP_DISPLAY_NAME}</title>
        <meta name="theme-color" content={PWA_THEME_COLOR} />
        <meta name="application-name" content={APP_DISPLAY_NAME} />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content={APP_DISPLAY_NAME} />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta property="og:site_name" content={APP_DISPLAY_NAME} />
        <meta property="og:title" content={APP_DISPLAY_NAME} />
        <link rel="manifest" href="/manifest.webmanifest" />
        <link rel="apple-touch-icon" href="/pwa/icon-192.png" />
        <script dangerouslySetInnerHTML={{ __html: LOCK_DOCUMENT_TITLE_SCRIPT }} />
        <ScrollViewStyleReset />
        <style dangerouslySetInnerHTML={{ __html: WEB_NON_SELECTABLE_CSS }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
