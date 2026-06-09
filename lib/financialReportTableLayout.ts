/** Altura do cabeçalho da grade (Descrição / Valor / obs.). */
export const FINANCIAL_REPORT_TABLE_HEADER_HEIGHT = 36;

/** Altura do corpo rolável — comparativos e telas amplas. */
export const FINANCIAL_REPORT_TABLE_BODY_MAX_HEIGHT = 420;

/** Corpo rolável do boletim mensal dentro do card (evita estourar o container). */
export const FINANCIAL_MONTHLY_RESULT_BODY_MAX_HEIGHT = 280;

export const financialReportTableLayoutMaxHeight = (bodyMaxHeight: number) =>
  bodyMaxHeight + FINANCIAL_REPORT_TABLE_HEADER_HEIGHT;

/** Cabeçalho + corpo padrão (comparativo, etc.). */
export const FINANCIAL_REPORT_TABLE_LAYOUT_MAX_HEIGHT = financialReportTableLayoutMaxHeight(
  FINANCIAL_REPORT_TABLE_BODY_MAX_HEIGHT
);

/** Estilos compartilhados — altura fixa evita que a coluna de descrição estique o relatório. */
export const financialReportTableFrameStyle = {
  borderWidth: 1,
  borderColor: '#E2E8F0',
  borderRadius: 8,
  overflow: 'hidden' as const,
};

export const financialReportTableLayoutStyle = {
  flexDirection: 'row' as const,
  height: FINANCIAL_REPORT_TABLE_LAYOUT_MAX_HEIGHT,
};

export const financialReportTableBodyScrollStyle = {
  height: FINANCIAL_REPORT_TABLE_BODY_MAX_HEIGHT,
  flexGrow: 0,
  flexShrink: 0,
};
