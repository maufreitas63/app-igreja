import { signedFinancialAmount, type FinancialEntry } from '@/lib/financialEntry';

export type FinancialAccountBalanceRow = {
  account: string;
  accountLabel: string;
  balance: number;
};

const normalizeFinancialAccountKey = (account: string) =>
  account
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');

const FINANCIAL_ACCOUNT_LABELS: Record<string, string> = {
  'AP.MPAGO': 'Mercado Pago - Aplicações',
  'AP.SICREDI': 'Sicredi - Aplicações',
  MPAGO: 'Mercado Pago - Conta Corrente',
  SICREDI: 'Sicredi - Conta Corrente',
};

export const formatFinancialAccountLabel = (account: string) => {
  const trimmed = account.trim();

  if (!trimmed) {
    return '';
  }

  return FINANCIAL_ACCOUNT_LABELS[normalizeFinancialAccountKey(trimmed)] ?? trimmed;
};

/** Saldo acumulado por conta (realizado) até a data dos lançamentos informados. */
export const computeFinancialAccountClosingBalances = (
  entries: FinancialEntry[]
): FinancialAccountBalanceRow[] => {
  const totals = new Map<string, { account: string; accountLabel: string; balance: number }>();

  for (const entry of entries) {
    const account = entry.account.trim();

    if (!account) {
      continue;
    }

    const key = normalizeFinancialAccountKey(account);
    const current = totals.get(key) ?? {
      account,
      accountLabel: formatFinancialAccountLabel(account),
      balance: 0,
    };

    current.balance += signedFinancialAmount(entry);
    totals.set(key, current);
  }

  return Array.from(totals.values())
    .filter((row) => Math.abs(row.balance) > 0.009)
    .sort((left, right) => left.accountLabel.localeCompare(right.accountLabel, 'pt-BR'));
};
