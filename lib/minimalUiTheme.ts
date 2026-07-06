/** Identidade visual minimalista (fundo branco, textos/ícones azuis). */
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

/** Faixa superior: saudação (esquerda) e logo (direita). */
export const MINIMAL_TOP_IDENTITY_BAR_HEIGHT = 40;

/** Logo compacto na faixa superior direita. */
export const MINIMAL_TOP_IDENTITY_LOGO_HEIGHT = 36;

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
