import {
  isFinancialEntrada,
  isFinancialMovementOrdinario,
  isFinancialRealizado,
  signedFinancialAmount,
  type FinancialEntry,
} from '@/lib/financialEntry';

const normalizeMinistry = (value: string) =>
  value
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');

/** Dízimos e ofertas ordinárias realizadas (entradas). */
export const isOrdinaryTithesOrOfferingsEntry = (entry: FinancialEntry) => {
  if (!isFinancialRealizado(entry.budget_version)) {
    return false;
  }

  if (!isFinancialEntrada(entry.transaction_kind)) {
    return false;
  }

  if (!isFinancialMovementOrdinario(entry.movement)) {
    return false;
  }

  const ministry = normalizeMinistry(entry.ministry);

  return (
    ministry === 'OFERTAS'
    || ministry.includes('DIZIM')
    || ministry.includes('DIZIMO')
  );
};

export const sumOrdinaryTithesOfferingsRevenue = (entries: FinancialEntry[]) =>
  entries
    .filter(isOrdinaryTithesOrOfferingsEntry)
    .reduce((total, entry) => total + Math.max(0, signedFinancialAmount(entry)), 0);
