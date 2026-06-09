import {
  buildFinancialBulletin,
  type FinancialBulletin,
} from '@/lib/financialBulletin';
import {
  BULLETIN_FLOW_SECTIONS,
  buildCanonicalBulletinRowStructure,
  MOVEMENT_BLOCK_TITLES,
  type BulletinRowLevel,
} from '@/lib/financialBulletinLayout';
import { findCommentForBulletinRow, type FinancialEntry } from '@/lib/financialEntry';
import type { FinancialMonthKey } from '@/lib/financialMonth';

export type BulletinComparisonRowLevel = BulletinRowLevel;

export type BulletinComparisonRow = {
  key: string;
  label: string;
  level: BulletinComparisonRowLevel;
  previousValue: number;
  currentValue: number;
  variation: number;
  /** Observações agregadas de `financials.comments` (linhas de detalhe). */
  comment?: string | null;
};

export type FinancialBulletinComparison = {
  previousMonth: FinancialMonthKey;
  currentMonth: FinancialMonthKey;
  rows: BulletinComparisonRow[];
};

export type FlatBulletinRow = {
  key: string;
  label: string;
  level: BulletinComparisonRowLevel;
  amount: number;
  comment?: string | null;
};

export const flattenBulletinRows = (bulletin: FinancialBulletin): FlatBulletinRow[] => {
  const blockMap = new Map(bulletin.blocks.map((block) => [block.title, block]));

  const rows: FlatBulletinRow[] = [
    {
      key: 'saldo-anterior',
      label: 'Saldo anterior',
      level: 'balance',
      amount: bulletin.previousBalance,
    },
  ];

  for (const blockTitle of MOVEMENT_BLOCK_TITLES) {
    const block = blockMap.get(blockTitle);
    if (!block) {
      continue;
    }

    rows.push({
      key: `block:${blockTitle}`,
      label: block.title,
      level: 'block',
      amount: block.total,
    });

    for (const flowSection of BULLETIN_FLOW_SECTIONS) {
      const flow = block[flowSection.key];

      rows.push({
        key: `block:${blockTitle}:flow:${flowSection.key}`,
        label: flowSection.title,
        level: 'flow',
        amount: flow.total,
      });

      for (const line of flow.lines) {
        rows.push({
          key: `block:${blockTitle}:flow:${flowSection.key}:line:${line.label}`,
          label: line.label,
          level: 'line',
          amount: line.amount,
          comment: line.comment ?? null,
        });
      }
    }
  }

  rows.push({
    key: 'saldo-atual',
    label: 'Saldo acumulado até o mês',
    level: 'total',
    amount: bulletin.currentBalance,
  });

  return rows;
};

/** Apenas blocos de movimento (sem saldo anterior / saldo atual). */
export const flattenBulletinMovementRows = (bulletin: FinancialBulletin): FlatBulletinRow[] =>
  flattenBulletinRows(bulletin).filter(
    (row) => row.key !== 'saldo-anterior' && row.key !== 'saldo-atual'
  );

const mergeFlatRows = (
  previousRows: FlatBulletinRow[],
  currentRows: FlatBulletinRow[]
): BulletinComparisonRow[] => {
  const previousByKey = new Map(previousRows.map((row) => [row.key, row]));
  const currentByKey = new Map(currentRows.map((row) => [row.key, row]));
  const structure = buildCanonicalBulletinRowStructure([previousRows, currentRows]);

  return structure.map((slot) => {
    const previousRow = previousByKey.get(slot.key);
    const currentRow = currentByKey.get(slot.key);
    const previousValue = previousRow?.amount ?? 0;
    const currentValue = currentRow?.amount ?? 0;

    return {
      key: slot.key,
      label: slot.label,
      level: slot.level,
      previousValue,
      currentValue,
      variation: currentValue - previousValue,
    };
  });
};

type BulletinMonthSnapshot = {
  month: FinancialMonthKey;
  entries: FinancialEntry[];
  previousBalance: number;
  currentBalance: number;
};

export const buildFinancialBulletinPairComparison = (
  left: BulletinMonthSnapshot,
  right: BulletinMonthSnapshot
): BulletinComparisonRow[] => {
  const leftBulletin = buildFinancialBulletin(left.entries, left.month, {
    previousBalance: left.previousBalance,
    currentBalance: left.currentBalance,
  });
  const rightBulletin = buildFinancialBulletin(right.entries, right.month, {
    previousBalance: right.previousBalance,
    currentBalance: right.currentBalance,
  });

  return mergeFlatRows(flattenBulletinRows(leftBulletin), flattenBulletinRows(rightBulletin));
};

/** Linhas para tabela de coluna única. */
export const toSingleColumnComparisonRows = (
  flatRows: FlatBulletinRow[]
): BulletinComparisonRow[] =>
  flatRows.map((row) => ({
    key: row.key,
    label: row.label,
    level: row.level,
    previousValue: 0,
    currentValue: row.amount,
    variation: row.amount,
    comment: row.comment ?? null,
  }));

/** Garante `comment` nas linhas de detalhe a partir dos lançamentos brutos do mês. */
export const enrichBulletinComparisonRowsWithEntryComments = (
  rows: BulletinComparisonRow[],
  entries: FinancialEntry[]
): BulletinComparisonRow[] =>
  rows.map((row) => {
    const resolved = findCommentForBulletinRow(row, entries);

    if (!resolved) {
      return row.comment ? { ...row, comment: null } : row;
    }

    return { ...row, comment: resolved };
  });

export const buildMonthlyBulletinTableRows = (
  bulletin: FinancialBulletin,
  entries: FinancialEntry[]
): BulletinComparisonRow[] =>
  enrichBulletinComparisonRowsWithEntryComments(
    toSingleColumnComparisonRows(flattenBulletinRows(bulletin)),
    entries
  );

export const buildFinancialBulletinComparison = (
  previousMonth: BulletinMonthSnapshot,
  currentMonth: BulletinMonthSnapshot
): FinancialBulletinComparison => ({
  previousMonth: previousMonth.month,
  currentMonth: currentMonth.month,
  rows: buildFinancialBulletinPairComparison(previousMonth, currentMonth),
});

export type FinancialPlannedRealizedComparison = {
  month: FinancialMonthKey;
  rows: BulletinComparisonRow[];
};

const PLANNED_REALIZED_EXCLUDED_ROW_KEYS = new Set(['saldo-anterior', 'saldo-atual']);

export const buildFinancialPlannedRealizedComparison = (
  month: FinancialMonthKey,
  planned: Omit<BulletinMonthSnapshot, 'month'>,
  realized: Omit<BulletinMonthSnapshot, 'month'>
): FinancialPlannedRealizedComparison => ({
  month,
  rows: buildFinancialBulletinPairComparison(
    { month, ...planned },
    { month, ...realized }
  ).filter((row) => !PLANNED_REALIZED_EXCLUDED_ROW_KEYS.has(row.key)),
});
