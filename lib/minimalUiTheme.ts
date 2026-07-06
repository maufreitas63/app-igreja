/** Identidade visual minimalista (fundo branco, textos/ícones azuis). */
export const MINIMAL_UI = {
  background: '#FFFFFF',
  text: '#1E40AF',
  textMuted: '#3B82F6',
  icon: '#00008B',
  border: '#BFDBFE',
  divider: '#E2E8F0',
  accent: '#1D4ED8',
  rowHover: '#F8FAFC',
  expandedBg: '#F1F5F9',
} as const;

export const MINIMAL_ICON = {
  logo: 60,
  menu: 26,
  chevron: 16,
  action: 18,
} as const;

/** Altura reservada para a barra inferior fixa (Sair do Aplicativo). */
export const MINIMAL_EXIT_BAR_HEIGHT = 56;

/** Altura base do chrome superior (menu + safe area aproximada). */
export const MINIMAL_TOP_CHROME_BASE = 52;

/** Espaço extra quando há header da igreja no topo esquerdo. */
export const MINIMAL_TOP_CHROME_HEADER = 88;

/** Espaço extra para o contador Inscritos / Limite. */
export const MINIMAL_TOP_CHROME_COUNTER = 22;

/** @deprecated Use MINIMAL_EXIT_BAR_HEIGHT */
export const MINIMAL_BOTTOM_DOCK_HEIGHT = MINIMAL_EXIT_BAR_HEIGHT;

export const MINIMAL_TYPO = {
  churchName: { fontSize: 12, fontWeight: '600' as const, color: MINIMAL_UI.text },
  greeting: { fontSize: 16, fontWeight: '700' as const, color: MINIMAL_UI.text },
  screenTitle: { fontSize: 18, fontWeight: '700' as const, color: MINIMAL_UI.text },
  inboxSubject: { fontSize: 15, fontWeight: '600' as const, color: MINIMAL_UI.text },
  inboxPreview: { fontSize: 13, color: MINIMAL_UI.textMuted },
  menuItem: { fontSize: 15, fontWeight: '500' as const, color: MINIMAL_UI.text },
  sectionLabel: { fontSize: 13, fontWeight: '700' as const, color: MINIMAL_UI.textMuted },
};
