/** ID do card no carrossel do dashboard (`dashboard.tsx`). */
export const DASHBOARD_FINANCIAL_CARD_ID = '11';

export type FinancialHubAction =
  | { type: 'coming_soon'; featureId: string }
  | { type: 'route'; path: string };

export type FinancialHubItem = {
  id: string;
  title: string;
  subtitle: string;
  icon: 'exchange' | 'list-alt' | 'tags' | 'bar-chart';
  action: FinancialHubAction;
  /** Destaque visual no card Financeiro (ação diferenciada do usuário). */
  highlight?: boolean;
};

export const FINANCIAL_HUB_ITEMS: FinancialHubItem[] = [
  {
    id: 'cashflow',
    title: 'Fluxo de caixa',
    subtitle: 'Entradas e saídas do período',
    icon: 'exchange',
    action: { type: 'coming_soon', featureId: 'cashflow' },
  },
  {
    id: 'entries',
    title: 'Relatório de Despesas (RD)',
    subtitle: 'Solicitar reembolso de despesas',
    icon: 'list-alt',
    action: { type: 'route', path: '/expense-report' },
    highlight: true,
  },
  {
    id: 'categories',
    title: 'Categorias',
    subtitle: 'Plano de contas e centros de custo',
    icon: 'tags',
    action: { type: 'coming_soon', featureId: 'categories' },
  },
  {
    id: 'reports',
    title: 'Relatórios',
    subtitle: 'Resumos e exportações',
    icon: 'bar-chart',
    action: { type: 'coming_soon', featureId: 'reports' },
  },
];
