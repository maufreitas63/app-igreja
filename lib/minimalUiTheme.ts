/** Identidade visual minimalista (fundo branco, textos/ícones azuis). */
import { StyleSheet, type TextStyle, type ViewStyle } from 'react-native';

export const MINIMAL_UI = {
  background: '#FFFFFF',
  text: '#1E40AF',
  textMuted: '#3B82F6',
  icon: '#00008B',
  /** Azul escuro — fundo da primeira faixa de texto. */
  blueDark: '#00008B',
  /** Azul — fundo da segunda faixa de texto e destaques. */
  blue: '#1E40AF',
  border: '#BFDBFE',
  divider: '#E2E8F0',
  accent: '#1D4ED8',
  rowHover: '#F8FAFC',
  expandedBg: '#FFFFFF',
  onDark: '#FFFFFF',
} as const;

export const MINIMAL_ICON = {
  logo: 180,
  menu: 26,
  chevron: 24,
  action: 18,
} as const;

/** Altura reservada para a barra inferior fixa (Sair do Aplicativo). */
export const MINIMAL_EXIT_BAR_HEIGHT = 56;

/** Faixa superior: saudação (esquerda) e logo (direita) — 50% da largura, alinhada à esquerda. */
export const MINIMAL_TOP_IDENTITY_BAR_HEIGHT = 80;

/** Padding horizontal do chrome e do corpo — o conteúdo alinha com «Olá, …». */
export const MINIMAL_SCREEN_PADDING_LEFT = 16;
export const MINIMAL_SCREEN_PADDING_RIGHT = 20;

/** Logo da instância no chrome (dobrado para melhor visibilidade). */
export const MINIMAL_TOP_IDENTITY_LOGO_HEIGHT = 72;

/**
 * Altura mínima do chrome superior (`MinimalTopLeftChrome`).
 * O drawer e o corpo da tela devem alinhar a esta margem.
 */
export const MINIMAL_TOP_CHROME_MIN_HEIGHT = 96;

/** Box do chrome superior — também usado no corpo (`flexContent`) para o mesmo recorte. */
export const MINIMAL_CHROME_WRAP: ViewStyle = {
  flexShrink: 0,
  paddingLeft: MINIMAL_SCREEN_PADDING_LEFT,
  paddingRight: MINIMAL_SCREEN_PADDING_RIGHT,
  paddingTop: 8,
  paddingBottom: 8,
  backgroundColor: MINIMAL_UI.background,
  zIndex: 30,
  borderBottomWidth: StyleSheet.hairlineWidth,
  borderBottomColor: MINIMAL_UI.divider,
  minHeight: MINIMAL_TOP_CHROME_MIN_HEIGHT,
};

/** Altura base do chrome superior (menu + safe area aproximada). */
export const MINIMAL_TOP_CHROME_BASE = 52;

/** Chrome superior com evento expandido na mesma linha do menu (50/50). */
export const MINIMAL_TOP_CHROME_EXPANDED = 56;

/** @deprecated Use MINIMAL_TOP_CHROME_EXPANDED */
export const MINIMAL_EXPANDED_EVENT_BAR_HEIGHT = MINIMAL_TOP_CHROME_EXPANDED;

/** Espaço extra quando há saudação no topo esquerdo. */
export const MINIMAL_TOP_CHROME_HEADER = 36;

/** Logo maior no topo direito. */
export const MINIMAL_TOP_CHROME_LOGO = MINIMAL_ICON.logo;

/** @deprecated Use MINIMAL_EXIT_BAR_HEIGHT */
export const MINIMAL_BOTTOM_DOCK_HEIGHT = MINIMAL_EXIT_BAR_HEIGHT;

export const MINIMAL_TYPO = {
  churchName: { fontSize: 12, fontWeight: '600' as const, color: MINIMAL_UI.text },
  greeting: { fontSize: 16, fontWeight: '700' as const, color: MINIMAL_UI.text },
  screenTitle: { fontSize: 18, fontWeight: '700' as const, color: MINIMAL_UI.text },
  inboxSubject: { fontSize: 15, fontWeight: '700' as const, color: MINIMAL_UI.text },
  inboxPreview: { fontSize: 13, color: MINIMAL_UI.textMuted },
  menuItem: { fontSize: 15, fontWeight: '500' as const, color: MINIMAL_UI.text },
  sectionLabel: { fontSize: 13, fontWeight: '700' as const, color: MINIMAL_UI.textMuted },
};

/** Título de seção minimalista — ex.: «Proximos Eventos», «Financeiro». */
export const MINIMAL_SECTION_TITLE_FONT_SIZE = Math.round(MINIMAL_TYPO.screenTitle.fontSize * 1.3);

export const MINIMAL_SECTION_TITLE: TextStyle = {
  fontSize: MINIMAL_SECTION_TITLE_FONT_SIZE,
  lineHeight: Math.round(MINIMAL_SECTION_TITLE_FONT_SIZE * 1.25),
  fontWeight: MINIMAL_TYPO.screenTitle.fontWeight,
  color: MINIMAL_UI.blueDark,
  backgroundColor: MINIMAL_UI.background,
  textAlign: 'center',
  paddingHorizontal: 12,
  paddingVertical: 10,
  flexShrink: 0,
  zIndex: 1,
};
