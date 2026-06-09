import {
  buildFinancialLineLabel,
  classifyFinancialMovement,
  computeFinancialBalance,
  matchesFinancialTransactionFlow,
  resolveAggregatedLineComment,
  signedFinancialAmount,
  type FinancialEntry,
  type FinancialTransactionFlowKind,
} from '@/lib/financialEntry';
import { MOVEMENT_BLOCK_TITLES } from '@/lib/financialBulletinLayout';
import type { FinancialMonthKey } from '@/lib/financialMonth';

export type { FinancialEntry } from '@/lib/financialEntry';

export type BulletinLine = {
  label: string;
  amount: number;
  comment?: string | null;
};

export type BulletinFlow = {
  total: number;
  lines: BulletinLine[];
};

export type BulletinMovementBlock = {
  title: string;
  total: number;
  entradas: BulletinFlow;
  saidas: BulletinFlow;
  entreContas: BulletinFlow;
  outros: BulletinFlow;
};

export type FinancialBulletin = {
  organizationName: string;
  periodLabel: string;
  periodCode: string;
  previousBalance: number;
  currentBalance: number;
  blocks: BulletinMovementBlock[];
  monthTotal: number;
};

const ORGANIZATION_NAME = 'Igreja Batista Norte';

export const formatBulletinAmount = (value: number) =>
  new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0);

const aggregateLines = (entries: FinancialEntry[]) => {
  const totals = new Map<string, number>();

  for (const entry of entries) {
    const label = buildFinancialLineLabel(entry);
    totals.set(label, (totals.get(label) ?? 0) + signedFinancialAmount(entry));
  }

  return Array.from(totals.entries())
    .map(([label, amount]) => ({
      label,
      amount,
      comment: resolveAggregatedLineComment(entries, label),
    }))
    .filter((line) => Math.abs(line.amount) > 0.009)
    .sort((left, right) => left.label.localeCompare(right.label, 'pt-BR'));
};

const buildFlow = (entries: FinancialEntry[], kind: FinancialTransactionFlowKind): BulletinFlow => {
  const filtered = entries.filter((entry) => matchesFinancialTransactionFlow(entry, kind));
  const lines = aggregateLines(filtered);
  const total = lines.reduce((sum, line) => sum + line.amount, 0);

  return { total, lines };
};

const createEmptyMovementBlock = (title: string): BulletinMovementBlock => {
  const emptyFlow = { total: 0, lines: [] };

  return {
    title,
    total: 0,
    entradas: emptyFlow,
    saidas: emptyFlow,
    entreContas: emptyFlow,
    outros: emptyFlow,
  };
};

const buildMovementBlock = (
  title: string,
  entries: FinancialEntry[]
): BulletinMovementBlock => {
  const entradas = buildFlow(entries, 'entrada');
  const saidas = buildFlow(entries, 'saida');
  const entreContas = buildFlow(entries, 'entre_contas');
  const outros = buildFlow(entries, 'outros');

  return {
    title,
    total: computeFinancialBalance(entries),
    entradas,
    saidas,
    entreContas,
    outros,
  };
};

export const buildFinancialBulletin = (
  monthEntries: FinancialEntry[],
  month: FinancialMonthKey,
  balances: {
    previousBalance: number;
    currentBalance: number;
  }
): FinancialBulletin => {
  const blocksByMovement = new Map<string, FinancialEntry[]>();

  for (const entry of monthEntries) {
    const classified = classifyFinancialMovement(entry.movement);
    const blockTitle =
      classified === 'ORDINÁRIO' || classified === 'EXTRAORDINÁRIO' ? classified : 'ORDINÁRIO';
    const bucket = blocksByMovement.get(blockTitle);

    if (bucket) {
      bucket.push(entry);
      continue;
    }

    blocksByMovement.set(blockTitle, [entry]);
  }

  const blocks = MOVEMENT_BLOCK_TITLES.map((title) => {
    const blockEntries = blocksByMovement.get(title) ?? [];
    return blockEntries.length
      ? buildMovementBlock(title, blockEntries)
      : createEmptyMovementBlock(title);
  });

  const monthTotal = computeFinancialBalance(monthEntries);

  return {
    organizationName: ORGANIZATION_NAME,
    periodLabel: `${String(month.month).padStart(2, '0')} / ${month.year}`,
    periodCode: `${month.year}${String(month.month).padStart(2, '0')}`,
    previousBalance: balances.previousBalance,
    currentBalance: balances.currentBalance,
    blocks,
    monthTotal,
  };
};
