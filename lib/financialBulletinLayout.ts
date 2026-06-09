export const MOVEMENT_BLOCK_TITLES = ['ORDINÁRIO', 'EXTRAORDINÁRIO'] as const;

export const BULLETIN_FLOW_SECTIONS = [
  { key: 'entradas' as const, title: 'RECEITAS' },
  { key: 'saidas' as const, title: 'DESPESAS' },
  { key: 'entreContas' as const, title: 'ENTRE CONTAS' },
] as const;

export type BulletinRowLevel = 'balance' | 'block' | 'flow' | 'line' | 'total';

export type BulletinRowRef = {
  key: string;
  label: string;
  level: BulletinRowLevel;
};

export type BulletinRowSlot = BulletinRowRef;

const collectLineLabelsForFlow = (flatRowsList: BulletinRowRef[][], flowKey: string) => {
  const labels = new Set<string>();

  for (const flatRows of flatRowsList) {
    for (const row of flatRows) {
      if (row.level === 'line' && row.key.startsWith(`${flowKey}:line:`)) {
        labels.add(row.label);
      }
    }
  }

  return Array.from(labels).sort((left, right) => left.localeCompare(right, 'pt-BR'));
};

/** Estrutura fixa: saldo anterior → ordinário/extraordinário (receitas, despesas, entre contas) → saldo atual. */
export const buildCanonicalBulletinRowStructure = (
  flatRowsList: BulletinRowRef[][]
): BulletinRowSlot[] => {
  const structure: BulletinRowSlot[] = [
    {
      key: 'saldo-anterior',
      label: 'Saldo anterior',
      level: 'balance',
    },
  ];

  for (const blockTitle of MOVEMENT_BLOCK_TITLES) {
    const blockKey = `block:${blockTitle}`;

    structure.push({
      key: blockKey,
      label: blockTitle,
      level: 'block',
    });

    for (const flowSection of BULLETIN_FLOW_SECTIONS) {
      const flowKey = `${blockKey}:flow:${flowSection.key}`;

      structure.push({
        key: flowKey,
        label: flowSection.title,
        level: 'flow',
      });

      for (const label of collectLineLabelsForFlow(flatRowsList, flowKey)) {
        structure.push({
          key: `${flowKey}:line:${label}`,
          label,
          level: 'line',
        });
      }
    }
  }

  structure.push({
    key: 'saldo-atual',
    label: 'Saldo acumulado até o mês',
    level: 'total',
  });

  return structure;
};
