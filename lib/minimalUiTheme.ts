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

export const MINIMAL_TYPO = {
  churchName: { fontSize: 12, fontWeight: '600' as const, color: MINIMAL_UI.text },
  greeting: { fontSize: 16, fontWeight: '700' as const, color: MINIMAL_UI.text },
  screenTitle: { fontSize: 18, fontWeight: '700' as const, color: MINIMAL_UI.text },
  inboxSubject: { fontSize: 15, fontWeight: '600' as const, color: MINIMAL_UI.text },
  inboxPreview: { fontSize: 13, color: MINIMAL_UI.textMuted },
  menuItem: { fontSize: 15, fontWeight: '500' as const, color: MINIMAL_UI.text },
  sectionLabel: { fontSize: 13, fontWeight: '700' as const, color: MINIMAL_UI.textMuted },
};
