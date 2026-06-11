import { computeResponsiveCardInsets } from '@/lib/uiTokens';

export const DASHBOARD_HEADER_RESERVE = 100;
/** Botões ‹ › / Menu (ou Voltar), margens e padding inferior extra (além do safe area). */
export const DASHBOARD_FOOTER_RESERVE = 98;

/** Altura dos cards sem sobrepor o header nem os botões inferiores. */
export const computeDashboardCardHeight = (
  screenHeight: number,
  topInset: number,
  bottomInset: number
) => {
  const available =
    screenHeight
    - topInset
    - bottomInset
    - DASHBOARD_HEADER_RESERVE
    - DASHBOARD_FOOTER_RESERVE
    - 20;

  return Math.max(280, Math.min(available, Math.round(screenHeight * 0.72)));
};

/** Card Agenda da Família: um pouco mais alto que o padrão. */
export const computeEventPanelCardHeight = (
  screenHeight: number,
  topInset: number,
  bottomInset: number
) => {
  const available =
    screenHeight
    - topInset
    - bottomInset
    - DASHBOARD_HEADER_RESERVE
    - DASHBOARD_FOOTER_RESERVE
    - 14;

  const base = computeDashboardCardHeight(screenHeight, topInset, bottomInset);

  return Math.max(base + 28, Math.min(available, Math.round(screenHeight * 0.78)));
};

export const buildDashboardPanelCardSizeStyle = (
  screenWidth: number,
  cardHeight: number
) => ({
  width: screenWidth * 0.9,
  minHeight: cardHeight,
  maxHeight: cardHeight,
  alignSelf: 'center' as const,
});

/** Reexporta tokens de padding responsivo dos cards do dashboard e manutenção. */
export { computeMaintenancePanelInsets, computeResponsiveCardInsets } from '@/lib/uiTokens';

export const resolveDashboardCardIndex = (
  cards: ReadonlyArray<{ id: string; content: string }>,
  cardParam?: string | null
) => {
  if (!cardParam?.trim()) {
    return -1;
  }

  return cards.findIndex(
    (item) => item.id === cardParam || item.content === cardParam
  );
};

/** Índice do painel de manutenção pelo `content` ou `id` do card. */
export const resolveMaintenancePanelIndex = (
  cards: ReadonlyArray<{ id: string; content: string }>,
  panelParam?: string | null
) => resolveDashboardCardIndex(cards, panelParam);

/** Tipografia do título «Índice do Aplicativo» (painel superior do card). */
export const DASHBOARD_PANEL_TITLE_TYPO = {
  fontSize: 17,
  fontWeight: '800' as const,
  lineHeight: 22,
  color: '#F8FAFC',
};

/** Padding interno superior do painel — alinha o título ao mesmo Y do índice. */
export const computeDashboardPanelInnerPadding = (screenWidth: number) =>
  Math.max(14, computeResponsiveCardInsets(screenWidth).padding - 18);

/** Mesmo limite superior do card Agenda da Família (centralizado no corpo do dashboard). */
export const computePanelCardTopPadding = (
  screenHeight: number,
  topInset: number,
  bottomInset: number,
  cardHeight: number
) => {
  const bodyHeight =
    screenHeight
    - topInset
    - bottomInset
    - DASHBOARD_HEADER_RESERVE
    - DASHBOARD_FOOTER_RESERVE;

  return Math.max(0, Math.round((bodyHeight - cardHeight) / 2));
};

/** Distância do topo da tela até o topo do card principal do dashboard. */
export const computePanelCardTopOffset = (
  screenHeight: number,
  topInset: number,
  bottomInset: number,
  cardHeight: number
) =>
  topInset
  + DASHBOARD_HEADER_RESERVE
  + computePanelCardTopPadding(screenHeight, topInset, bottomInset, cardHeight);
