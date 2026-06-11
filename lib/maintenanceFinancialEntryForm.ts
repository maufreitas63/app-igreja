import type { FinancialEntry } from '@/lib/financialEntry';
import {
  formatFinancialDateForInput,
  MAINTENANCE_FINANCIAL_BUDGET_VERSIONS,
  MAINTENANCE_FINANCIAL_MOVEMENTS,
  MAINTENANCE_FINANCIAL_TRANSACTION_KINDS,
  parseFinancialDateInputToIso,
  parseMaintenanceFinancialAmount,
} from '@/lib/maintenanceFinancialApi';

export type FinancialEntryEditFormState = {
  transactionDateInput: string;
  account: string;
  ministry: string;
  transactionKind: string;
  movement: string;
  budgetVersion: string;
  amountInput: string;
};

export const FINANCIAL_ENTRY_TRANSACTION_KIND_OPTIONS = MAINTENANCE_FINANCIAL_TRANSACTION_KINDS.map(
  (value) => ({ value, label: value })
);

export const FINANCIAL_ENTRY_MOVEMENT_OPTIONS = MAINTENANCE_FINANCIAL_MOVEMENTS.map((value) => ({
  value,
  label: value,
}));

export const FINANCIAL_ENTRY_BUDGET_VERSION_OPTIONS = MAINTENANCE_FINANCIAL_BUDGET_VERSIONS.map(
  (value) => ({ value, label: value })
);

const formatAmountForInput = (amount: number) => {
  const absolute = Math.abs(amount);

  if (Number.isInteger(absolute)) {
    return String(absolute);
  }

  return absolute.toFixed(2);
};

export const buildFinancialEntryEditForm = (entry: FinancialEntry): FinancialEntryEditFormState => ({
  transactionDateInput: formatFinancialDateForInput(entry.transaction_date),
  account: entry.account,
  ministry: entry.ministry,
  transactionKind: entry.transaction_kind,
  movement: entry.movement,
  budgetVersion: entry.budget_version,
  amountInput: formatAmountForInput(Number(entry.amount) || 0),
});

export const validateFinancialEntryEditForm = (
  form: FinancialEntryEditFormState
): { valid: true; draft: FinancialEntryEditDraft } | { valid: false; message: string } => {
  const transactionDateIso = parseFinancialDateInputToIso(form.transactionDateInput);

  if (!transactionDateIso) {
    return { valid: false, message: 'Informe a data no formato DD/MM/AA.' };
  }

  const account = form.account.trim();
  const ministry = form.ministry.trim();
  const transactionKind = form.transactionKind.trim();
  const movement = form.movement.trim();
  const budgetVersion = form.budgetVersion.trim();
  const amount = parseMaintenanceFinancialAmount(form.amountInput);

  if (!account) {
    return { valid: false, message: 'Informe a conta.' };
  }

  if (!ministry) {
    return { valid: false, message: 'Informe o ministério.' };
  }

  if (!transactionKind) {
    return { valid: false, message: 'Informe o tipo de transação.' };
  }

  if (!movement) {
    return { valid: false, message: 'Informe o movimento.' };
  }

  if (!budgetVersion) {
    return { valid: false, message: 'Informe a versão (planejado/realizado).' };
  }

  if (amount === null) {
    return { valid: false, message: 'Informe o valor com ponto (.) se houver decimais.' };
  }

  return {
    valid: true,
    draft: {
      transactionDateIso,
      account,
      ministry,
      transactionKind,
      movement,
      budgetVersion,
      amount,
    },
  };
};

export type FinancialEntryEditDraft = {
  transactionDateIso: string;
  account: string;
  ministry: string;
  transactionKind: string;
  movement: string;
  budgetVersion: string;
  amount: number;
};
