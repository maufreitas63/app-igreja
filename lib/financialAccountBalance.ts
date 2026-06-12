import { signedFinancialAmount, type FinancialEntry } from '@/lib/financialEntry';

export type FinancialAccountBalanceRow = {
  account: string;
  balance: number;
};

/** Saldo acumulado por conta (realizado) até a data dos lançamentos informados. */
export const computeFinancialAccountClosingBalances = (
  entries: FinancialEntry[]
): FinancialAccountBalanceRow[] => {
  const totals = new Map<string, number>();

  for (const entry of entries) {
    const account = entry.account.trim();

    if (!account) {
      continue;
    }

    totals.set(account, (totals.get(account) ?? 0) + signedFinancialAmount(entry));
  }

  return Array.from(totals.entries())
    .map(([account, balance]) => ({ account, balance }))
    .sort((left, right) => left.account.localeCompare(right.account, 'pt-BR'));
};
