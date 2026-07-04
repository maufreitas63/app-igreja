import type { PaletaColors } from '@/lib/paletasTypes';
import { Platform } from 'react-native';

const STYLE_ELEMENT_ID = 'app-palette-theme-vars';

/**
 * Aplica variáveis CSS e fundo global no documento (web).
 * Facilita troca dinâmica sem conflitar com StyleSheets do RN.
 */
export function applyPaletteDocumentTheme(colors: PaletaColors, paletteName: string) {
  if (Platform.OS !== 'web' || typeof document === 'undefined') {
    return;
  }

  const root = document.documentElement;
  const themeSlug = paletteName
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-');

  root.dataset.appTheme = themeSlug || 'padrao';
  root.style.setProperty('--app-bg', colors.background);
  root.style.setProperty('--app-text', colors.text);
  root.style.setProperty('--app-text-muted', colors.textMuted);
  root.style.setProperty('--app-border', colors.border);
  root.style.setProperty('--app-primary', colors.primary);
  root.style.setProperty('--app-secondary', colors.secondary);
  root.style.setProperty('--app-accent', colors.accent);

  document.body.style.backgroundColor = colors.background;
  document.body.style.color = colors.text;

  let styleEl = document.getElementById(STYLE_ELEMENT_ID) as HTMLStyleElement | null;

  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = STYLE_ELEMENT_ID;
    document.head.appendChild(styleEl);
  }

  if (colors.isLight) {
    styleEl.textContent = `
      html, body, #root {
        background-color: var(--app-bg) !important;
        color: var(--app-text) !important;
      }
      /* Bordas azuis em elementos que já definem borda (border-width > 0). */
      #root * {
        border-color: var(--app-border);
      }
      /* Textos claros do tema escuro → preto no tema Basico/claro. */
      #root [style*="color: rgb(248, 250, 252)"],
      #root [style*="color: rgb(255, 255, 255)"],
      #root [style*="color: rgb(226, 232, 240)"],
      #root [style*="color: rgb(203, 213, 225)"],
      #root [style*="color: rgb(241, 245, 249)"] {
        color: var(--app-text) !important;
        font-weight: inherit;
      }
      #root [style*="font-weight: 700"],
      #root [style*="font-weight: 800"],
      #root [style*="font-weight: 900"],
      #root [style*="font-weight: bold"] {
        color: var(--app-text) !important;
        font-weight: 700 !important;
      }
    `;
  } else {
    styleEl.textContent = `
      html, body, #root {
        background-color: var(--app-bg);
      }
    `;
  }
}
